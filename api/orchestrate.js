// api/orchestrate.js — AI Orchestrator v0.1 endpoint
//
// POST { userId, text, session?, _request_id? }
// → ORCHESTRATOR_RESPONSE { mode, text, buttons, expects_reply, session_updates, debug }
//
// Session state lives with the caller — this endpoint is stateless.
// The caller must merge session_updates into its session store after each call.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { processInput } from './engine/orchestrator.js';

export const config = { maxDuration: 30 };

const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7);

let _sb = null;
function getSb() {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _sb;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, text, session = {}, _request_id } = req.body ?? {};
  const request_id = _request_id ?? `srv-${Date.now().toString(36)}`;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' });
  }
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
    // Fetch pending_clarifications server-side so the orchestrator can apply safety gates
    // (e.g. acute symptom ACT gate) without trusting client-provided session state.
    // Client session is the authority for temporal session fields; DB is authority for health facts.
    const { data: profileRow } = await getSb()
      .from('user_health_profile')
      .select('pending_clarifications, physical')
      .eq('user_id', userId)
      .maybeSingle();
    const pendingClarifications = Array.isArray(profileRow?.pending_clarifications)
      ? profileRow.pending_clarifications
      : [];
    const fatigueContext = profileRow?.physical?.fatigue_context ?? null;

    const sessionWithPending = { ...session, pending_clarifications: pendingClarifications, fatigue_context: fatigueContext };

    const response = await processInput(userId, text.trim(), sessionWithPending);

    // ── TRACE: query action_assignments for this user ──────────────────────
    const { data: assignments, error: _traceErr } = await getSb()
      .from('action_assignments')
      .select('action_id, status, assigned_at, intervention_id')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false })
      .limit(5);
    if (_traceErr) console.error(`[trace:${request_id}] assignments query error:`, _traceErr.message);

    const assignCount  = assignments?.length ?? 0;
    const latestAssign = assignments?.[0] ?? null;

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

    // ── Augment debug with trace fields ────────────────────────────────────
    const debug = {
      ...response.debug,
      _trace: {
        request_id,
        commit:    COMMIT,
        deployment: process.env.VERCEL_URL ?? 'local',
        action_assignments_count: assignCount,
        latest_assignment: latestAssign ? {
          intervention_id: latestAssign.intervention_id,
          status:          latestAssign.status,
          created_at:      latestAssign.created_at,
        } : null,
      },
    };

    return res.status(200).json({ ...response, debug });
  } catch (err) {
    console.error(`[trace:${request_id}] ERROR:`, err?.message ?? err);
    return res.status(500).json({ error: 'Internal error', detail: err?.message });
  }
}
