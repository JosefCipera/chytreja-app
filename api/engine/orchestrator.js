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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Presentation data ─────────────────────────────────────────────────────────
// master.json node labels (id → label_cs) — loaded once at module init.
const _dir = dirname(fileURLToPath(import.meta.url));
const _masterNodes = JSON.parse(
  readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8')
).nodes;
const NODE_LABEL_CS = Object.fromEntries(_masterNodes.map(n => [n.id, n.label_cs]));

// Czech translations of English modification strings from nextBestAction.js.
// Internal engine metadata stays English; user-facing text is translated here.
const MODIFICATIONS_CS = {
  'Monitor blood pressure before and after':
    'Sleduj krevní tlak před cvičením i po něm',
  'Avoid Valsalva (breath-holding during exertion)':
    'Nevydrž dech při cvičení',
  'Stop if chest pain, severe dyspnea, or dizziness':
    'Zastav při bolesti na hrudi, dušnosti nebo závratích',
  'Consult cardiologist or GP before beginning':
    'Nejprve se poraď s kardiologem nebo svým lékařem',
  'Start with LIGHT or MODERATE intensity first':
    'Začni s lehkou nebo střední intenzitou',
  'Monitor blood pressure and heart rate response':
    'Sleduj krevní tlak a pulz',
  'Fill in health profile (diagnoses, medications)':
    'Doplň zdravotní profil (diagnózy, léky)',
  'Start with MODERATE intensity actions until baseline is documented':
    'Začni se střední intenzitou, dokud nemáš zdokumentovaný výchozí stav',
  'Clarify injury severity (mild / moderate / severe) before proceeding':
    'Upřesni závažnost zranění (mírné / střední / závažné)',
  'Use stable wall or chair support for all single-leg variants':
    'Při cvičení na jedné noze drž stěnu nebo opěradlo',
  'Begin with eyes-open only; progress to eyes-closed only when stable':
    'Začni jen s otevřenýma očima; na zavřené oči přejdi až budeš stabilní',
  'Supervised or near-support setting for first sessions':
    'První cvičení s dohledem nebo v blízkosti opory',
};

function localizeMod(s) {
  return MODIFICATIONS_CS[s] ?? s;
}

const GOAL_BRANCH_CS = {
  SURVIVAL_HEALTHSPAN:     'Zdravé přežití',
  FUNCTIONAL_INDEPENDENCE: 'Funkční samostatnost',
};

let client;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ── Intent Classifier ─────────────────────────────────────────────────────────
// Claude Haiku: maps Czech natural language → event_type + payload.
// No health reasoning here — pure classification.

// Tool-based classifier: forces Haiku to call classify_intent tool → guaranteed schema.
// enum on event_type eliminates "missing event_type" fallback path.

const CLASSIFIER_TOOL = {
  name: 'classify_intent',
  description: 'Classify Czech health app user input into a structured event. Call this tool for every input.',
  input_schema: {
    type: 'object',
    properties: {
      event_type: {
        type: 'string',
        enum: [
          'ACTION_COMPLETED', 'ACTION_SKIPPED', 'ANSWER_TO_EVIDENCE_QUESTION',
          'NEW_SYMPTOM', 'NEW_MEASUREMENT', 'NEW_CONSTRAINT',
          'WHY_REQUEST', 'DOMAIN_REQUEST', 'USER_PREFERENCE', 'GENERAL_HEALTH_REQUEST',
        ],
        description: 'Classified event type',
      },
      payload: {
        type: 'object',
        description: 'Event-specific payload. Use only fields relevant to the event_type.',
        properties: {
          body_part:      { type: 'string',  description: 'Czech body part name for NEW_SYMPTOM' },
          severity:       { type: 'string',  description: 'mild | moderate | severe (null for NEW_SYMPTOM)' },
          evidence_type:  { type: 'string',  description: 'From pending_question.evidence_type for ANSWER' },
          value:          { description: 'Answer value (string or number)' },
          obs_type:       { type: 'string',  description: 'Observation type for NEW_MEASUREMENT' },
          unit:           { type: 'string',  description: 'Unit for NEW_MEASUREMENT' },
          constraint_key: { type: 'string',  description: 'Body region in English for NEW_CONSTRAINT' },
          text:           { type: 'string',  description: 'Original text for GENERAL_HEALTH_REQUEST / USER_PREFERENCE' },
        },
        additionalProperties: false,
      },
    },
    required: ['event_type', 'payload'],
  },
};

const CLASSIFIER_SYSTEM = `You are a text classifier for CHJ (Chytré Já) health navigation system.
Your ONLY job: classify Czech user input and extract payload. No health reasoning. No advice.

RULES:
1. pending_question set + short answer (yes/no/word/number) → ANSWER_TO_EVIDENCE_QUESTION
2. current_action set + "done/hotovo/splněno/udělal" → ACTION_COMPLETED
3. current_action set + "přeskočím/nemůžu/dnes ne/vynechám" → ACTION_SKIPPED
4. "proč" in input → WHY_REQUEST
5. Simple single-pain statement ONLY — "bolí mě [body part]" or "bolest v [body part]" with no other health facts → NEW_SYMPTOM (payload.body_part = body part, payload.severity = null)
6. Measurement number + unit → NEW_MEASUREMENT
7. "co mám dělat / co teď / poraď / co dál" → DOMAIN_REQUEST
8. Health declaration with diagnoses, age, medications, or multiple health facts ("mám X", "je mi X let", "trpím X", sentences combining age + diagnoses + pain) → GENERAL_HEALTH_REQUEST (payload.text = full input)
9. Anything else → GENERAL_HEALTH_REQUEST (payload.text = full input)`;

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
      model:       'claude-haiku-4-5',
      max_tokens:  256,
      system:      CLASSIFIER_SYSTEM,
      tools:       [CLASSIFIER_TOOL],
      tool_choice: { type: 'tool', name: 'classify_intent' },
      messages:    [{ role: 'user', content: userContent }],
    });

    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (!toolUse) throw new Error('no tool_use block in response');
    return { event_type: toolUse.input.event_type, payload: toolUse.input.payload ?? {} };
  } catch (err) {
    console.warn('[orchestrator:classifier] fallback —', err?.message ?? err);
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
  if (modification) text += ` Úprava: ${localizeMod(modification)}.`;

  return {
    mode:          'ACT',
    text,
    buttons:       ['Hotovo', 'Přeskočit'],
    expects_reply: false,
    session_updates: sessionUpdates,
    debug:         { reason_code: dd.reason_code, warnings },
  };
}

function buildAskResponse(dd, ctx, sessionUpdates, warnings) {
  // ASK_BLOCKING with null primary_item: engine ran but couldn't generate a specific question.
  // Two sub-cases based on whether we have any leverage context:
  if (!dd.primary_item && dd.reason_code === 'ASK_BLOCKING') {
    const hasLeverageContext = Boolean(ctx?.system_leverage?.node_id);

    const text = hasLeverageContext
      // Data present but no action available yet — acknowledge and ask for movement data
      ? 'Díky, beru to v úvahu. Pro konkrétní doporučení potřebuji ještě vědět o pohybových vzorcích — jak aktivní jsi přes den?'
      // True zero-data — guide toward profile entry
      : 'Zatím o tobě vím málo. Můžeš mi stručně říct, co je pro tebe zdravotně důležité — věk, diagnózy, omezení nebo co tě dnes trápí.';

    return {
      mode:          'ASK',
      text,
      buttons:       ['Zdravotní profil'],
      expects_reply: true,
      session_updates: sessionUpdates,
      debug:         { reason_code: dd.reason_code, warnings },
    };
  }

  const question = sessionUpdates.pending_question?.text
    ?? dd.primary_item?.question
    ?? dd.primary_item?.question_text
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

const HEALTH_INPUT_TYPES = new Set([
  'NEW_SYMPTOM', 'NEW_CONSTRAINT', 'NEW_MEASUREMENT',
]);

function buildHoldResponse(dd, _ctx, sessionUpdates, warnings, eventType) {
  const label    = dd.primary_item?.label ?? 'Akce';
  const holdText = dd.reason_code === 'HOLD_TOO_EARLY'
    ? `${label} — výsledky ještě dozrávají. Počkej na příští hodnocení.`
    : `${label} — potřebuji více opakování pro přehodnocení.`;

  // Acknowledge health input so user knows CHJ processed the new information
  const ackText = HEALTH_INPUT_TYPES.has(eventType)
    ? 'Beru novou informaci v úvahu. Po přepočtu se dnešní doporučení nemění. '
    : '';

  return {
    mode:          'HOLD',
    text:          ackText + holdText,
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
    buttons:       ['Co mám udělat?'],
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
  const leverage    = ctx.system_leverage;
  const constraint  = ctx.system_constraint;
  const action      = ctx.action_context?.selected;

  // Both selected objects have node_id (not label) — resolve from master.json
  const leverageLabel   = NODE_LABEL_CS[leverage?.node_id]   ?? null;
  const constraintLabel = NODE_LABEL_CS[constraint?.node_id] ?? null;
  const actionLabel     = action?.label ?? null;
  const affinity        = action?.leverage_affinity ?? null;

  // Primary: SYSTEM_LEVERAGE — why this area
  if (leverageLabel) {
    parts.push(`Teď je největší páka v oblasti: ${leverageLabel}.`);
  }

  // Secondary: action + goal_impact — why this intervention, what it achieves
  if (actionLabel) {
    const branches = (action?.goal_impact?.branches ?? [])
      .map(b => GOAL_BRANCH_CS[b]).filter(Boolean);
    const verb     = affinity === 'high' ? 'přímo ovlivňuje' : 'ovlivňuje';
    const goalPart = branches.length > 0
      ? ` a podporuje ${branches.map(b => b.toLowerCase()).join(' a ')}`
      : '';

    if (leverageLabel) {
      // "Svižná chůze ji přímo ovlivňuje a podporuje zdravé přežití."
      parts.push(`${actionLabel} ji ${verb}${goalPart}.`);
    } else if (branches.length > 0) {
      // No leverage identified — neutral reference to goal
      parts.push(`${actionLabel} cílí na ${branches.map(b => b.toLowerCase()).join(' a ')}.`);
    }
  }

  // Optional: SYSTEM_CONSTRAINT — deeper WHY; shown only when different from leverage
  if (constraintLabel && constraintLabel !== leverageLabel) {
    parts.push(`Aktuální hlavní omezení: ${constraintLabel}.`);
  }

  // Modification hint when action has safety condition
  if (action?.safety?.level === 'SAFE_WITH_MODIFICATION') {
    const mod = action?.safety?.modifications_suggested?.[0];
    if (mod) parts.push(`Doporučená úprava: ${localizeMod(mod)}.`);
  }

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
    case 'HOLD':            return buildHoldResponse(dd, ctx, sessionUpdates, warnings, eventType);
    case 'SAFETY':          return buildSafetyBlockedResponse(dd, sessionUpdates, warnings);
    case 'SAFETY_CRITICAL': return buildSafetyCriticalResponse(dd, sessionUpdates, warnings);
    default:                return buildFallbackResponse(result, sessionUpdates, warnings);
  }
}

// ── Adapter-supported event types ────────────────────────────────────────────
// GENERAL_HEALTH_REQUEST is now handled (persists text to symptoms for DIAG_KEYWORDS parsing).
const ADAPTER_EVENT_TYPES = new Set([
  'ACTION_COMPLETED', 'ACTION_SKIPPED', 'ANSWER_TO_EVIDENCE_QUESTION',
  'NEW_SYMPTOM', 'NEW_MEASUREMENT', 'NEW_CONSTRAINT',
  'USER_PREFERENCE', 'DOMAIN_REQUEST', 'GENERAL_HEALTH_REQUEST',
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
  let adapterType = ADAPTER_EVENT_TYPES.has(event_type) ? event_type : 'DOMAIN_REQUEST';

  // ACTION events require a valid session assignment (action_id + intervention_id).
  // If the session has no assignment, degrade to DOMAIN_REQUEST (no valid action to confirm).
  if ((adapterType === 'ACTION_COMPLETED' || adapterType === 'ACTION_SKIPPED')
      && (!state.current_action_assignment?.action_id
          || !state.current_action_assignment?.intervention_id)) {
    adapterType = 'DOMAIN_REQUEST';
  }

  // 4. Build domain event (use adapter type for the event, keep original for session logic)
  // Enrich NEW_SYMPTOM with full user text so compound sentences (e.g. "bolí mě koleno a mám
  // vysoký tlak") carry diagnosis keywords for DIAG_KEYWORDS matching in healthEventAdapter.
  const enrichedPayload = (adapterType === 'NEW_SYMPTOM' && userText && !payload?.symptom_raw)
    ? { ...payload, symptom_raw: userText }
    : payload;
  const event = buildEvent({ event_type: adapterType, payload: enrichedPayload }, state);

  // 5. Persist + run engine via adapter (no direct DB access here)
  const result = await applyHealthEvent(userId, event);

  // 6. Build session updates (use original classifier event_type for session logic)
  const sessionUpdates = buildSessionUpdates(event_type, payload, result);

  // 7. Build presentation from DOMAIN_RESPONSE only
  const presentation = buildPresentation(event_type, payload, result, sessionUpdates);

  // Enrich debug with leverage + NBA label for internal debug overlay (?debug=1).
  // Never shown to regular users — Launcher gates on query param.
  const ctx = result.domain_response?.explanation_context;
  if (presentation.debug && ctx) {
    presentation.debug.leverage_node = ctx.system_leverage?.node_id
      ? (NODE_LABEL_CS[ctx.system_leverage.node_id] ?? ctx.system_leverage.node_id)
      : null;
    presentation.debug.nba_label = ctx.action_context?.selected?.label ?? null;
  }

  return presentation;
}
