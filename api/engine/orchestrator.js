// orchestrator.js — AI Orchestrator v0.1
//
// Thin orchestration layer over locked contracts:
//   applyHealthEvent()  ← Health Event Adapter v0.1
//   DAILY_DECISION      ← computeDailyDecision() via adapter
//   DOMAIN_RESPONSE     ← returned by applyHealthEvent()
//
// Hard boundaries:
//   - No direct Supabase access for health data
//   - No clinical reasoning / diagnosis
//   - No modification of NBA.selected or safety levels
//   - WHY flow reads explanation_context only — no new inference
//   - One domain: health (active_domain = 'health')
//
// ── ORCHESTRATOR_RESPONSE ────────────────────────────────────────────────────
// {
//   mode:            'ACT' | 'ASK' | 'HOLD' | 'SAFETY_BLOCKED' | 'SAFETY_CRITICAL' | 'EXPLAIN' | 'NOOP'
//   text:            string  (human-readable, built only from DOMAIN_RESPONSE)
//   buttons:         string[]
//   expects_reply:   boolean
//   session_updates: object  (caller merges into session state)
//   debug:           { reason_code?, warnings?, source? }
// }

import Anthropic from '@anthropic-ai/sdk';
import { applyHealthEvent } from './healthEventAdapter.js';

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ── Intent Classifier ─────────────────────────────────────────────────────────
// Claude Haiku: maps Czech natural language → event_type + payload.
// No health reasoning here — pure classification.

const CLASSIFIER_SYSTEM = `You are a text classifier for CHJ health navigation.
Your ONLY job: map Czech user input to one event type and extract a minimal payload.
Do NOT give health advice. Do NOT diagnose. Do NOT infer. Only classify.

EVENT TYPES:
ACTION_COMPLETED    — user signals they did the current action ("hotovo", "udělal/a jsem", "splněno")
ACTION_SKIPPED      — user signals skip ("přeskočím", "dnes ne", "nemůžu", "vynechám")
ANSWER_TO_EVIDENCE_QUESTION — user answers a pending question (use when pending_question is set)
NEW_SYMPTOM         — user reports body pain ("bolí mě koleno", "cítím bolest v rameni")
NEW_MEASUREMENT     — user reports a measurement ("vážím 85 kg", "tlak 140/90")
NEW_CONSTRAINT      — explicit physical limitation ("nesmím zatěžovat koleno")
WHY_REQUEST         — user asks why ("proč", "proč mám", "nechápu proč")
DOMAIN_REQUEST      — asks what to do ("co mám dělat?", "co teď?", "poraď mi")
USER_PREFERENCE     — expresses preference about approach ("nechci silový trénink")
GENERAL_HEALTH_REQUEST — health question not fitting above

CLASSIFICATION RULES:
1. If pending_question is set AND user gives a short answer (yes/no/word/number) → ANSWER_TO_EVIDENCE_QUESTION
2. If current_action is set AND input means "done/finished" → ACTION_COMPLETED
3. "proč" anywhere → WHY_REQUEST (unless clearly answering a question)
4. Body part + pain word → NEW_SYMPTOM

PAYLOAD per type (JSON):
ACTION_COMPLETED:              {}
ACTION_SKIPPED:                {}
ANSWER_TO_EVIDENCE_QUESTION:   {"evidence_type": "<from pending_question.evidence_type or null>", "value": "<normalized_answer>"}
NEW_SYMPTOM:                   {"body_part": "<Czech body part>", "severity": null}
NEW_MEASUREMENT:               {"obs_type": "<type>", "value": <number>, "unit": "<unit>"}
NEW_CONSTRAINT:                {"constraint_key": "<body_region_en>", "severity": "<mild|moderate|severe>"}
WHY_REQUEST:                   {}
DOMAIN_REQUEST:                {}
USER_PREFERENCE:               {"text": "<preference>"}
GENERAL_HEALTH_REQUEST:        {"text": "<original>"}

Respond with ONLY a valid JSON object. No markdown. No explanation.`;

async function classifyIntent(sessionState, userText) {
  const { pending_question, current_action_assignment } = sessionState;

  const contextLines = [];
  if (pending_question) {
    contextLines.push(`pending_question: ${JSON.stringify(pending_question)}`);
  }
  if (current_action_assignment?.label) {
    contextLines.push(`current_action: "${current_action_assignment.label}"`);
  }

  const userContent = contextLines.length
    ? `[Session]\n${contextLines.join('\n')}\n\n[Input]\n${userText}`
    : userText;

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });

    const raw = (response.content[0]?.text ?? '').trim();
    // Strip markdown code fences if Haiku wraps the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.event_type) throw new Error('missing event_type in response');
    return { event_type: parsed.event_type, payload: parsed.payload ?? {} };
  } catch (err) {
    console.warn('[orchestrator:classifier] fallback to GENERAL_HEALTH_REQUEST —', err?.message ?? err);
    return { event_type: 'GENERAL_HEALTH_REQUEST', payload: { text: userText } };
  }
}

// ── Event builder ─────────────────────────────────────────────────────────────

function buildEvent(classified, sessionState) {
  const { event_type, payload } = classified;
  const event = {
    event_type,
    event_id:  crypto.randomUUID(),
    source:    'text',
    timestamp: new Date().toISOString(),
    payload:   { ...(payload ?? {}) },
  };

  // Attach assignment IDs from session for action events
  if (event_type === 'ACTION_COMPLETED' || event_type === 'ACTION_SKIPPED') {
    const a = sessionState.current_action_assignment;
    if (a?.action_id)       event.payload.action_id       = a.action_id;
    if (a?.intervention_id) event.payload.intervention_id = a.intervention_id;
  }

  return event;
}

// ── Body part → evidence_type ─────────────────────────────────────────────────
// Mirrors BODY_REGION_KEYWORDS in healthEventAdapter.js / nextBestAction.js.

const BODY_PART_TO_EVIDENCE = {
  knee:       'knee_severity',
  hip:        'hip_severity',
  lower_back: 'lower_back_severity',
  shoulder:   'shoulder_severity',
  elbow:      'elbow_severity',
  ankle_foot: 'ankle_foot_severity',
  wrist:      'wrist_severity',
};

const BODY_PART_KEYWORDS = {
  knee:       ['koleno', 'kolena', 'kolenni', 'knee'],
  hip:        ['kycle', 'kycli', 'bok', 'hip'],
  lower_back: ['zada', 'bedra', 'bederni', 'lumbar'],
  shoulder:   ['rameno', 'ramena', 'ramenni', 'shoulder'],
  elbow:      ['loket', 'lokty', 'elbow'],
  ankle_foot: ['kotnik', 'chodidlo', 'pata', 'ankle', 'foot'],
  wrist:      ['zapesti', 'wrist'],
};

function bodyPartToEvidenceType(bodyPart) {
  if (!bodyPart) return null;
  const s = bodyPart.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [region, kws] of Object.entries(BODY_PART_KEYWORDS)) {
    if (kws.some(kw => s.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, '')))) {
      return BODY_PART_TO_EVIDENCE[region] ?? null;
    }
  }
  return null;
}

// ── Session update builder ────────────────────────────────────────────────────

function buildSessionUpdates(eventType, classifiedPayload, result) {
  const dr = result.domain_response;
  const dd = dr?.daily_decision;

  const updates = {
    last_daily_decision:  dd   ?? null,
    last_domain_response: dr   ?? null,
  };

  // ACT: set current_action_assignment, clear pending
  if (dd?.mode === 'ACT') {
    const item = dd.primary_item;
    updates.current_action_assignment = item?.action_id ? {
      action_id:       item.action_id,
      label:           item.label,
      intervention_id: item.intervention_id ?? null,
      assigned_at:     dd.evaluated_at,
    } : null;
    updates.pending_question = null;
  }

  // ASK: set pending_question with evidence_type derived from context
  if (dd?.mode === 'ASK') {
    const item = dd.primary_item;
    const questionText = item?.question ?? item?.question_text ?? 'Upřesni prosím.';

    // Derive evidence_type: prefer explicit field, fallback to body_part from triggering event
    const evidenceType = item?.evidence_type
      ?? (eventType === 'NEW_SYMPTOM' ? bodyPartToEvidenceType(classifiedPayload?.body_part) : null);

    updates.pending_question = {
      text:          questionText,
      evidence_type: evidenceType,
      type:          item?.type ?? 'GENERAL',
    };
    updates.current_action_assignment = null;
  }

  // Clear pending when answered
  if (eventType === 'ANSWER_TO_EVIDENCE_QUESTION') {
    updates.pending_question = null;
  }

  // Clear assignment when completed/skipped
  if (eventType === 'ACTION_COMPLETED' || eventType === 'ACTION_SKIPPED') {
    updates.current_action_assignment = null;
  }

  return updates;
}

// ── Presentation builders ─────────────────────────────────────────────────────
// Text is composed ONLY from structured DOMAIN_RESPONSE fields.
// No free-form health reasoning or diagnosis in this layer.

function buildActResponse(dd, ctx, sessionUpdates, warnings) {
  const action = dd.primary_item;
  let text = action?.label ? `${action.label}.` : 'Tvá dnešní akce je připravena.';

  const modification = action?.safety?.modifications_suggested?.[0];
  if (modification) text += ` Úprava: ${modification}.`;

  return {
    mode:          'ACT',
    text,
    buttons:       ['Hotovo', 'Přeskočit'],
    expects_reply: false,
    session_updates: sessionUpdates,
    debug:         { reason_code: dd.reason_code, warnings },
  };
}

function buildAskResponse(dd, _ctx, sessionUpdates, warnings) {
  const question = sessionUpdates.pending_question?.text
    ?? dd.primary_item?.question
    ?? 'Potřebuji více informací. Upřesni prosím.';

  return {
    mode:          'ASK',
    text:          question,
    buttons:       [],
    expects_reply: true,
    session_updates: sessionUpdates,
    debug:         { reason_code: dd.reason_code, warnings },
  };
}

function buildHoldResponse(dd, _ctx, sessionUpdates, warnings) {
  const label  = dd.primary_item?.label ?? 'Akce';
  const text   = dd.reason_code === 'HOLD_TOO_EARLY'
    ? `${label} — výsledky ještě dozrávají. Počkej na příští hodnocení.`
    : `${label} — potřebuji více opakování pro přehodnocení.`;

  return {
    mode:          'HOLD',
    text,
    buttons:       [],
    expects_reply: false,
    session_updates: sessionUpdates,
    debug:         { reason_code: dd.reason_code, warnings },
  };
}

function buildSafetyBlockedResponse(dd, sessionUpdates, warnings) {
  const worst = dd.primary_item?.worst_safety_level;
  const text  = worst === 'CONTRAINDICATED'
    ? 'Tato aktivita není s tvým aktuálním stavem vhodná. Konzultuj lékaře.'
    : 'Před touto aktivitou je potřeba souhlas lékaře.';

  return {
    mode:          'SAFETY_BLOCKED',
    text,
    buttons:       [],
    expects_reply: false,
    session_updates: sessionUpdates,
    debug:         { reason_code: dd.reason_code, warnings },
  };
}

function buildSafetyCriticalResponse(dd, sessionUpdates, warnings) {
  return {
    mode:          'SAFETY_CRITICAL',
    text:          'Detekuji stav vyžadující okamžitou pozornost. Kontaktuj lékaře.',
    buttons:       ['Zavolat lékaři'],
    expects_reply: false,
    session_updates: sessionUpdates,
    debug:         { reason_code: dd.reason_code, warnings },
  };
}

function buildFallbackResponse(result, sessionUpdates, warnings) {
  return {
    mode:          'NOOP',
    text:          'Rozumím. Pokud potřebuješ pomoci, zeptej se.',
    buttons:       [],
    expects_reply: true,
    session_updates: sessionUpdates,
    debug:         { warnings },
  };
}

// ── WHY response (no engine call) ─────────────────────────────────────────────
// Uses only cached explanation_context from last_domain_response.
// No new clinical inference, no new engine call.

function buildWhyResponse(sessionState) {
  const ctx = sessionState.last_domain_response?.explanation_context;

  if (!ctx) {
    return {
      mode:          'EXPLAIN',
      text:          'Nemám kontext předchozího doporučení. Zeptej se znovu po akci.',
      buttons:       [],
      expects_reply: false,
      session_updates: {},
      debug:         { source: 'no_cached_context' },
    };
  }

  const parts = [];
  const constraint = ctx.system_constraint;
  const leverage   = ctx.system_leverage;
  const action     = ctx.action_context?.selected;

  if (constraint?.label) parts.push(`Hlavní omezení: ${constraint.label}.`);
  if (leverage?.label)   parts.push(`Nejlepší páka: ${leverage.label}.`);
  const goalImpact = typeof action?.goal_impact === 'string'
    ? action.goal_impact
    : action?.goal_impact?.label ?? null;
  if (goalImpact) parts.push(`Vliv na cíl: ${goalImpact}.`);

  const text = parts.length > 0
    ? parts.join(' ')
    : 'Tato akce cílí na tvůj aktuální systémový bottleneck.';

  return {
    mode:          'EXPLAIN',
    text,
    buttons:       [],
    expects_reply: false,
    session_updates: {},
    debug:         { source: 'explanation_context' },
  };
}

// ── Presentation dispatcher ───────────────────────────────────────────────────

function buildPresentation(eventType, classifiedPayload, result, sessionUpdates) {
  if (result.error) {
    return {
      mode:          'NOOP',
      text:          'Nastala chyba. Zkus to znovu.',
      buttons:       [],
      expects_reply: false,
      session_updates: sessionUpdates,
      debug:         { error: result.error, warnings: result.warnings },
    };
  }

  const dd       = result.domain_response?.daily_decision;
  const ctx      = result.domain_response?.explanation_context;
  const warnings = result.warnings ?? [];

  if (!dd) return buildFallbackResponse(result, sessionUpdates, warnings);

  switch (dd.mode) {
    case 'ACT':             return buildActResponse(dd, ctx, sessionUpdates, warnings);
    case 'ASK':             return buildAskResponse(dd, ctx, sessionUpdates, warnings);
    case 'HOLD':            return buildHoldResponse(dd, ctx, sessionUpdates, warnings);
    case 'SAFETY':          return buildSafetyBlockedResponse(dd, sessionUpdates, warnings);
    case 'SAFETY_CRITICAL': return buildSafetyCriticalResponse(dd, sessionUpdates, warnings);
    default:                return buildFallbackResponse(result, sessionUpdates, warnings);
  }
}

// ── Adapter-supported event types ────────────────────────────────────────────
// All other classifier outputs map to DOMAIN_REQUEST for the adapter.
const ADAPTER_EVENT_TYPES = new Set([
  'ACTION_COMPLETED', 'ACTION_SKIPPED', 'ANSWER_TO_EVIDENCE_QUESTION',
  'NEW_SYMPTOM', 'NEW_MEASUREMENT', 'NEW_CONSTRAINT',
  'USER_PREFERENCE', 'DOMAIN_REQUEST',
]);

// ── Main export ───────────────────────────────────────────────────────────────
// Stateless: caller owns session state and merges session_updates.

export async function processInput(userId, userText, sessionState = {}) {
  const state = {
    active_domain:            'health',
    pending_question:          null,
    current_action_assignment: null,
    last_daily_decision:       null,
    last_domain_response:      null,
    ...sessionState,
  };

  // 1. Classify intent
  const { event_type, payload } = await classifyIntent(state, userText);

  // 2. WHY: use only cached context, no engine call
  // Also catch WHY via raw text fallback in case classifier missed it
  const textLower = userText.toLowerCase();
  const isWhy = event_type === 'WHY_REQUEST'
    || (textLower.startsWith('proč') || textLower.startsWith('proc'));
  if (isWhy) return buildWhyResponse(state);

  // 3. Map classifier event type to adapter-supported type
  const adapterType = ADAPTER_EVENT_TYPES.has(event_type) ? event_type : 'DOMAIN_REQUEST';

  // 4. Build domain event (use adapter type for the event, keep original for session logic)
  const event = buildEvent({ event_type: adapterType, payload }, state);

  // 5. Persist + run engine via adapter (no direct DB access here)
  const result = await applyHealthEvent(userId, event);

  // 6. Build session updates (use original classifier event_type for session logic)
  const sessionUpdates = buildSessionUpdates(event_type, payload, result);

  // 7. Build presentation from DOMAIN_RESPONSE only
  return buildPresentation(event_type, payload, result, sessionUpdates);
}
