// api/orchestrate.js — AI Orchestrator v0.1 endpoint
//
// POST { userId, text, session?, _request_id? }
// → ORCHESTRATOR_RESPONSE { mode, text, buttons, expects_reply, session_updates, debug }
//
// Session state lives with the caller — this endpoint is stateless.
// The caller must merge session_updates into its session store after each call.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic                               from '@anthropic-ai/sdk';
import { createClient }                        from '@supabase/supabase-js';
import { processInput }                        from './engine/orchestrator.js';
import { requireAuth }                         from './lib/requireAuth.js';
import { evaluateGate }                        from './lib/nbq/evidenceGate.js';
import { buildWordingPrompt, buildOpenPrompt } from './lib/nbq/nbqPromptBuilders.js';

export const config = { maxDuration: 30 };

const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

let _sb = null;
function getSb() {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _sb;
}

let _ai = null;
function getAI() {
  if (!_ai) _ai = new Anthropic();
  return _ai;
}

// Intercepts ACT responses for GENERAL_HEALTH_REQUEST when evidence is insufficient.
// traceData is the already-fetched action_assignments context so _trace is complete in both paths.
// Returns a replacement ASK response, or null to pass ACT through.
async function runNbqGate(response, session, userText, traceData) {
  if (response.mode !== 'ACT' || response.debug?.classifier_event !== 'GENERAL_HEALTH_REQUEST') {
    return null;
  }

  const prevMessages = Array.isArray(session.nbq_messages) ? session.nbq_messages : [];
  const gate = evaluateGate(prevMessages, userText);

  if (gate.outcome === 'URGENT_EXIT' || gate.outcome === 'STOP_QUESTIONING') {
    return null;
  }

  const messagesWithCurrent = [
    ...prevMessages,
    { role: 'user', content: userText },
  ];

  const prompt = gate.outcome === 'OPEN_INFORMATION_NEED'
    ? buildOpenPrompt(messagesWithCurrent)
    : buildWordingPrompt(gate.information_need, messagesWithCurrent);

  let questionText;
  try {
    const resp = await getAI().messages.create({
      model: 'claude-haiku-4-5', max_tokens: 256,
      system: prompt.system, messages: prompt.messages,
    });
    questionText = resp.content?.[0]?.text?.trim() ?? '';
  } catch (err) {
    console.error('[nbq-gate] Haiku error:', err.message);
    return null;
  }

  return {
    mode:          'ASK',
    text:          questionText,
    buttons:       [],
    expects_reply: true,
    session_updates: {
      ...(response.session_updates ?? {}),
      current_action_assignment: null,   // gate blocked ACT; unsubstantiated assignment must not enter session
      nbq_messages: [
        ...messagesWithCurrent,
        { role: 'assistant', content: questionText },
      ],
    },
    debug: {
      ...response.debug,
      nbq_gate: {
        outcome:          gate.outcome,
        information_need: gate.information_need ?? null,
      },
      _trace: traceData,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { text, session = {}, _request_id } = req.body ?? {};
  const userId = auth.uid;
  const request_id = _request_id ?? `srv-${Date.now().toString(36)}`;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  // ── TRACE: incoming request ────────────────────────────────────────────────
  console.log(
    `[trace:${request_id}] IN`,
    `userId=${userId}`,
    `text="${text.trim().slice(0, 50)}"`,
    `session.dd_mode=${session?.last_daily_decision?.mode ?? 'null'}`,
    `commit=${COMMIT}`,
    `deployment=${process.env.VERCEL_URL ?? 'local'}`,
  );

  try {
    const [{ data: profileRow }, { data: personRow }] = await Promise.all([
      getSb()
        .from('user_health_profile')
        .select('pending_clarifications, physical')
        .eq('user_id', userId)
        .maybeSingle(),
      getSb()
        .from('user_profiles')
        .select('birth_year, gender')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    const pendingClarifications = Array.isArray(profileRow?.pending_clarifications)
      ? profileRow.pending_clarifications
      : [];
    const fatigueContext = profileRow?.physical?.fatigue_context ?? null;

    const sessionWithPending = {
      ...session,
      pending_clarifications: pendingClarifications,
      fatigue_context:        fatigueContext,
      person_birth_year:      personRow?.birth_year ?? null,
      person_sex:             personRow?.gender     ?? null,
      resolved_physical:      Object.keys(profileRow?.physical ?? {}),
      hp_physical:            profileRow?.physical ?? {},
    };

    const response = await processInput(userId, text.trim(), sessionWithPending);

    // ── Query action_assignments — needed for _trace in ALL response paths ──
    const { data: assignments, error: _traceErr } = await getSb()
      .from('action_assignments')
      .select('action_id, status, assigned_at, intervention_id')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false })
      .limit(5);
    if (_traceErr) console.error(`[trace:${request_id}] assignments query error:`, _traceErr.message);

    const assignCount  = assignments?.length ?? 0;
    const latestAssign = assignments?.[0] ?? null;
    const traceData    = {
      request_id,
      commit:                   COMMIT,
      deployment:               process.env.VERCEL_URL ?? 'local',
      action_assignments_count: assignCount,
      latest_assignment:        latestAssign ? {
        intervention_id: latestAssign.intervention_id,
        status:          latestAssign.status,
        created_at:      latestAssign.created_at,
      } : null,
    };

    // ── NBQ Gate ───────────────────────────────────────────────────────────
    const nbqIntercept = await runNbqGate(response, session, text.trim(), traceData);
    if (nbqIntercept) {
      console.log(
        `[trace:${request_id}] OUT`,
        `mode=ASK(nbq-gate)`,
        `nbq_outcome=${nbqIntercept.debug.nbq_gate.outcome}`,
        `need=${nbqIntercept.debug.nbq_gate.information_need ?? '—'}`,
      );
      return res.status(200).json(nbqIntercept);
    }
    // ──────────────────────────────────────────────────────────────────────

    console.log(
      `[trace:${request_id}] OUT`,
      `mode=${response.mode}`,
      `engineDDMode=${response.debug?.engine_dd_mode ?? '—'}`,
      `reason=${response.debug?.reason_code ?? '—'}`,
      `isFollowUp=${response.debug?.is_hold_follow_up ?? '—'}`,
      `classifier=${response.debug?.classifier_event ?? '—'}`,
      `action_assignments=${assignCount}`,
      `latestIntervention=${latestAssign?.intervention_id ?? 'none'}`,
      `latestStatus=${latestAssign?.status ?? 'none'}`,
    );

    return res.status(200).json({ ...response, debug: { ...response.debug, _trace: traceData } });
  } catch (err) {
    console.error(`[trace:${request_id}] ERROR:`, err?.message ?? err);
    return res.status(500).json({ error: 'Internal error', detail: err?.message });
  }
}
