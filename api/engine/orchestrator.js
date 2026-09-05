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
import { selectNextBestEvidence } from './nextBestEvidence.js';
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

// Narrow unlock: bootstrap candidate list for skip/defer handling and override detection.
const _bootstrapNeeds = JSON.parse(
  readFileSync(join(_dir, '../../data/engine/bootstrap-needs.json'), 'utf8')
);
const BOOTSTRAP_TYPES = new Set(_bootstrapNeeds.map(n => n.evidence_type));

// Single source of bootstrap candidate eligibility used by all continuation paths.
// Mirrors the filter in synthesizeBootstrapGate (decisionGate.js) — both must stay in sync.
//   birthYrKnown:    person_birth_year != null
//   resolvedPhysical: Object.keys(physical) — keys already answered in a previous or same turn
//   skippedSet:      Set of evidence_types refused/skipped this session
function filterBootstrapCandidates(needs, { birthYrKnown, resolvedPhysical = [], skippedSet }) {
  return needs.filter(c => {
    if (c.skip_if_known === 'birth_year' && birthYrKnown)                                      return false;
    if (c.skip_if_known && c.skip_if_known !== 'birth_year'
        && resolvedPhysical.includes(c.skip_if_known))                                         return false;
    return !skippedSet.has(c.evidence_type);
  });
}

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

// ── Fatigue standalone matcher ────────────────────────────────────────────────
// Anchored ^...$ — compound statements ("Jsem unavený a bolí mě na hrudi")
// do NOT match and flow to Haiku / safety path normally.
// Shared by pre-classifier guard and post-presentation fatigue clarification guard.
export const FATIGUE_STANDALONE_RE =
  /^(jsem\s+(unaven[aáý]|vyčerpan[aáý]|malátný|malátná|bez\s+energie)|cítím\s+(únavu|vyčerpání|malátnost)|nemám\s+energii|mám\s+(únavu|vyčerpání))[\s.,!?]*$/i;

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

export function buildEvent(classified, sessionState) {
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

  // Attach evidence_type from session for answer events.
  // Haiku classifier may omit evidence_type from payload — session pending_question
  // is the canonical source. Only fills the gap; never overwrites classifier's value.
  if (event_type === 'ANSWER_TO_EVIDENCE_QUESTION') {
    const pq = sessionState.pending_question;
    if (!event.payload.evidence_type && pq?.evidence_type) {
      event.payload.evidence_type = pq.evidence_type;
    }
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

// ── Evidence question bridge ──────────────────────────────────────────────────
// Maps NEXT_BEST_EVIDENCE {evidence_type, acquisition_method} → Czech user-facing question.
// Central function: both buildSessionUpdates and buildAskResponse must use this so
// pending_question.text and response.text never diverge.
// Never adds "question"/"question_text" to the NBE engine object — pure presentation bridge.

const NBE_QUESTION_MAP = {
  // Bootstrap PROFILE evidence (narrow unlock)
  birth_year:       'Kolik ti je let?',
  // Bootstrap CLINICAL evidence (narrow unlock) — answer routes through GENERAL_HEALTH_REQUEST
  clinical_context: 'Léčíš se s něčím nebo bereš pravidelně nějaké léky?',
  // Vitals / anthropometrics
  weight_kg:       'Kolik teď vážíš?',
  waist_cm:        'Jaký je tvůj obvod pasu v centimetrech?',
  bp_systolic:     'Jaký máš aktuálně systolický krevní tlak?',
  bp_diastolic:    'Jaký máš aktuálně diastolický krevní tlak?',
  heart_rate:      'Jaký je tvůj klidový tep?',
  // Activity
  activity_level:  'Jaký byl dnes tvůj pohyb? Nízký, střední, nebo vysoký?',
  sedentary_hours_day: 'Kolik hodin denně průměrně sedíš?',
  // Falls / stability
  recent_falls:    'Upadl/a jsi během posledních 12 měsíců?',
  fall_history:    'Upadl/a jsi během posledních 12 měsíců?',
  gait_stability:  'Cítíš se při běžné chůzi stabilně?',
  // Functional tests (onboarding)
  vynest_nakup:    'Zvládneš vynést nákup (5 kg) do 2. patra bez zastavení?',
  zvednout_vnouce: 'Zvládneš zvednout dítě nebo těžší předmět ze země bez bolesti?',
  vstat_ze_zeme:   'Dokážeš vstát ze země bez opory rukou?',
  // Functional tests (clinical / semi-clinical)
  floor_rise_test: 'Pokud je pro tebe bezpečné jít na zem, zkus si sednout na zem a vstát s co nejmenší oporou. Zvládneš vstát? Pokud si nejsi jistý/á stabilitou, test nedělej sám/sama.',
  chair_stand_30s: 'Pokud je to pro tebe bezpečné, kolikrát vstaneš ze židle za 30 sekund bez opory rukou? Napiš číslo.',
  tug_test:        'Máš změřený TUG test — vstát ze židle, ujít 3 m, otočit se a vrátit? Pokud ano, napiš čas v sekundách.',
  grip_strength:   'Máš změřenou sílu stisku dynamometrem? Pokud ano, napiš hodnotu.',
  validated_strength_assessment: 'Máš výsledek ověřeného testu svalové síly? Pokud ano, napiš typ testu a výsledek.',
  // Constraint severity
  knee_severity:       'Jak moc tě koleno omezuje? Mírně, středně, nebo výrazně?',
  hip_severity:        'Jak moc tě kyčel omezuje? Mírně, středně, nebo výrazně?',
  lower_back_severity: 'Jak moc tě záda omezují? Mírně, středně, nebo výrazně?',
  shoulder_severity:   'Jak moc tě rameno omezuje? Mírně, středně, nebo výrazně?',
  elbow_severity:      'Jak moc tě loket omezuje? Mírně, středně, nebo výrazně?',
  ankle_foot_severity: 'Jak moc tě kotník nebo chodidlo omezuje? Mírně, středně, nebo výrazně?',
  wrist_severity:      'Jak moc tě zápěstí omezuje? Mírně, středně, nebo výrazně?',
  // Labs
  lab_hba1c:       'Máš k dispozici výsledek HbA1c? Pokud ano, napiš hodnotu.',
  lab_apob:        'Máš k dispozici výsledek ApoB? Pokud ano, napiš hodnotu.',
  lab_ldl:         'Máš k dispozici výsledek LDL cholesterolu? Pokud ano, napiš hodnotu.',
  lab_hdl:         'Máš k dispozici výsledek HDL cholesterolu? Pokud ano, napiš hodnotu.',
  lab_triglycerides: 'Máš k dispozici výsledek triglyceridů? Pokud ano, napiš hodnotu.',
  lab_glucose_fasting: 'Máš k dispozici výsledek glykémie nalačno? Pokud ano, napiš hodnotu.',
  lab_crp:         'Máš k dispozici výsledek CRP (zánětlivý marker)? Pokud ano, napiš hodnotu.',
  lab_uric_acid:   'Máš k dispozici výsledek kyseliny močové? Pokud ano, napiš hodnotu.',
  lab_alt:         'Máš k dispozici výsledek ALT (jaterní enzym)? Pokud ano, napiš hodnotu.',
  lab_ast:         'Máš k dispozici výsledek AST (jaterní enzym)? Pokud ano, napiš hodnotu.',
  lab_testosterone: 'Máš k dispozici výsledek testosteronu? Pokud ano, napiš hodnotu.',
  lab_hrv:         'Máš k dispozici výsledek HRV (variabilita srdečního tepu)? Pokud ano, napiš hodnotu.',
};

// Acquisition-method fallbacks for unknown evidence_type
const NBE_METHOD_FALLBACK = {
  question:         'Potřebuji od tebe jednu informaci. Můžeš odpovědět přímo?',
  home_measurement: 'Potřebuji jedno domácí měření. Máš hodnotu k dispozici?',
  functional_test:  'Potřebuji výsledek funkčního testu. Zvládneš ho teď?',
  wearable:         'Máš data z wearablu nebo sporttestru? Jaká je aktuální hodnota?',
  laboratory:       'Potřebuji laboratorní výsledek. Máš ho k dispozici?',
  clinician:        'Tuto hodnotu je třeba změřit u lékaře. Máš aktuální výsledek?',
};

function buildEvidenceQuestion(nbe) {
  if (!nbe) return null;
  return NBE_QUESTION_MAP[nbe.evidence_type]
    ?? NBE_METHOD_FALLBACK[nbe.acquisition_method]
    ?? (nbe.evidence_type
        ? `Potřebuji informaci o: ${nbe.evidence_type}. Máš ji k dispozici?`
        : 'Potřebuji jednu konkrétní informaci. Můžeš mi ji poskytnout?');
}

// ── Session update builder ────────────────────────────────────────────────────

// Exported for unit testing only — not part of the public API.
export function _buildSessionUpdates_test(eventType, classifiedPayload, result) {
  return buildSessionUpdates(eventType, classifiedPayload, result);
}

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

  // Clear pending when answered — runs BEFORE ASK so that if engine immediately
  // returns a new ASK question in the same turn, the ASK block wins (sets new pending).
  if (eventType === 'ANSWER_TO_EVIDENCE_QUESTION') {
    updates.pending_question = null;
  }

  // ASK: set pending_question with evidence_type derived from context.
  // This must run AFTER the ANSWER clear so the new question is preserved in session.
  if (dd?.mode === 'ASK') {
    const item = dd.primary_item;
    updates.current_action_assignment = null;
    if (item) {
      // For NEXT_BEST_EVIDENCE items the engine provides evidence_type/acquisition_method
      // but no question field. buildEvidenceQuestion is the single source of truth for
      // converting NBE metadata → Czech user-facing question text.
      const questionText = item?.question ?? item?.question_text ?? buildEvidenceQuestion(item);

      // Derive evidence_type: prefer explicit field, fallback to body_part from triggering event
      const evidenceType = item?.evidence_type
        ?? (eventType === 'NEW_SYMPTOM' ? bodyPartToEvidenceType(classifiedPayload?.body_part) : null);

      updates.pending_question = {
        text:          questionText,
        evidence_type: evidenceType,
        // Narrow unlock: BOOTSTRAP context_id takes precedence over engine's generic NBE type.
        type:          item?.context_id === 'BOOTSTRAP' ? 'BOOTSTRAP' : (item?.type ?? 'GENERAL'),
      };
    } else {
      // primary_item = null (ASK_BLOCKING zero-data): explicitly clear pending_question
      // so the launcher's session merge does not preserve any stale pending value.
      // Next input → GENERAL_HEALTH_REQUEST → stored in symptoms for DIAG_KEYWORDS matching.
      updates.pending_question = null;
    }
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

    if (hasLeverageContext) {
      // Data present but PHYSICAL_INACTIVITY not yet activated — ask for sedentary hours.
      // NBE rule: question must match the data type the engine reads (physical.sedentary_hours_day).
      // Pending question is set so the answer routes through ANSWER_TO_EVIDENCE_QUESTION
      // and is persisted to physical — not lost in symptoms[].
      const text = 'Přibližně kolik hodin za běžný den prosedíš?';
      return {
        mode:          'ASK',
        text,
        buttons:       [],
        expects_reply: true,
        session_updates: {
          ...sessionUpdates,
          pending_question: { text, evidence_type: 'sedentary_hours_day', type: 'GENERAL' },
        },
        debug: { reason_code: dd.reason_code, warnings },
      };
    }

    // True zero-data — guide toward conversational profile entry
    return {
      mode:          'ASK',
      text:          'Zatím o tobě vím málo. Můžeš mi stručně říct, co je pro tebe zdravotně důležité — věk, diagnózy, omezení nebo co tě dnes trápí.',
      buttons:       [],
      expects_reply: true,
      session_updates: sessionUpdates,
      debug:         { reason_code: dd.reason_code, warnings },
    };
  }

  const question = sessionUpdates.pending_question?.text
    ?? dd.primary_item?.question
    ?? dd.primary_item?.question_text
    ?? buildEvidenceQuestion(dd.primary_item)
    ?? 'Potřebuji konkrétní informaci. Napiš mi ji.';

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

function buildHoldResponse(dd, _ctx, sessionUpdates, warnings, eventType, isFollowUp = false) {
  // Follow-up "co místo toho?" while all candidates still in HOLD:
  // don't repeat the original action label — explain the system state instead.
  if (isFollowUp) {
    return {
      mode:          'HOLD',
      text:          'Pro dnešek je hotovo. U vhodných možností ještě čekám na dostatek času nebo dat k vyhodnocení. Vrať se zítra.',
      buttons:       [],
      expects_reply: false,
      session_updates: sessionUpdates,
      debug:         { reason_code: dd.reason_code, warnings },
    };
  }

  // ACTION_COMPLETED → user just finished the action; acknowledge, don't repeat the label
  if (eventType === 'ACTION_COMPLETED') {
    return {
      mode:            'HOLD',
      text:            'Hotovo. Pro dnešek stačí. Výsledek budeme hodnotit až po několika opakováních.',
      buttons:         [],
      expects_reply:   false,
      session_updates: sessionUpdates,
      debug:           { reason_code: dd.reason_code, warnings },
    };
  }

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
    buttons:       sessionState.current_action_assignment ? ['Hotovo', 'Přeskočit'] : [],
    expects_reply: false,
    session_updates: {},
    debug:         { source: 'explanation_context' },
  };
}

// ── Presentation dispatcher ───────────────────────────────────────────────────

function buildPresentation(eventType, classifiedPayload, result, sessionUpdates, isHoldFollowUp = false) {
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
    case 'HOLD':            return buildHoldResponse(dd, ctx, sessionUpdates, warnings, eventType, isHoldFollowUp);
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
  // Pre-classifier guard: short-circuits Haiku for pure subjective fatigue statements.
  // Haiku is non-deterministic for these inputs — returns NEW_SYMPTOM ~50% of calls
  // despite rule 5 requiring "bolí mě [body part]". FATIGUE_STANDALONE_RE is anchored
  // ^...$ so compound statements ("Jsem unavený a bolí mě na hrudi") do NOT match
  // and still reach Haiku and the standard safety/symptom flow.
  // Guard is skipped when pending_question or current_action_assignment is set —
  // those flows own the turn.
  let classified;
  if (!state.pending_question
      && !state.current_action_assignment
      && FATIGUE_STANDALONE_RE.test(userText.trim())) {
    classified = { event_type: 'GENERAL_HEALTH_REQUEST', payload: { text: userText } };
  } else {
    classified = await classifyIntent(state, userText);
  }
  const { event_type, payload } = classified;

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

  // ── Bootstrap refusal pre-classifier override (narrow unlock) ───────────────
  // Haiku may classify Czech refusal phrases ("Nechci uvést.", "Nevím.") as
  // ANSWER_TO_EVIDENCE_QUESTION when a BOOTSTRAP pending_question is set — it sees
  // a pending question and treats any reply as an answer. Override to USER_PREFERENCE
  // so the skip/defer early-return path below fires reliably.
  // Only fires when a BOOTSTRAP evidence_type is the active pending question.
  const BOOTSTRAP_REFUSAL_RE = /^(nev[ií]m|nechci|p[rř]esko[cč]it|skip)\b/i;
  if (BOOTSTRAP_TYPES.has(state.pending_question?.evidence_type)
      && BOOTSTRAP_REFUSAL_RE.test(userText.trim())) {
    adapterType = 'USER_PREFERENCE';
  }

  // ── Bootstrap clinical_context answer routing (narrow unlock) ───────────────
  // clinical_context answers cannot flow through ANSWER_TO_EVIDENCE_QUESTION
  // (no EVIDENCE_STORAGE_REGISTRY entry).
  //
  // Negative answers ("Ne.", "Nemám.", "Nic.", "Neberu."): EARLY RETURN — no DB
  // write of any kind (no diagnosis, no symptom, no medication). Marks
  // clinical_context session-resolved and selects next bootstrap candidate.
  // Budget IS decremented (definitive answer, not a refusal).
  //
  // Substantive answers ("Mám vysoký tlak", "Beru Prestarium"): route through
  // GENERAL_HEALTH_REQUEST so the existing free-text clinical extractor handles
  // diagnoses persistence. No second parser created.
  let _clinicalContextRouted = false; // flag: re-point enrichedPayload to { text: userText }
  if (adapterType === 'ANSWER_TO_EVIDENCE_QUESTION'
      && state.pending_question?.evidence_type === 'clinical_context') {
    // Detect unambiguously negative answers — e.g. "Ne.", "Nemám.", "Nic.", "Žádné."
    if (/^\s*(ne|nem[aá]m|nic|n[eě]beru|žádn[éý][^a-z]|žádná)\s*[.,!]?\s*$/i.test(userText.trim())) {
      // EARLY RETURN — no applyHealthEvent call, no DB write.
      const newSkipped   = [...(state.skipped_bootstrap_types ?? []), 'clinical_context'];
      const skippedSet   = new Set(newSkipped);
      const birthYrKnown = state.person_birth_year != null;
      const available    = filterBootstrapCandidates(_bootstrapNeeds, {
        birthYrKnown,
        resolvedPhysical: state.resolved_physical ?? [],
        skippedSet,
      });
      const next        = selectNextBestEvidence(available, [], [], '1.0.0');
      // Bootstrap questions do not consume the clinical question budget.
      // Budget is preserved as-is; it applies only to non-Bootstrap ASK turns.
      const baseUpdates = {
        last_daily_decision:       state.last_daily_decision       ?? null,
        last_domain_response:      state.last_domain_response      ?? null,
        current_action_assignment: null,
        skipped_bootstrap_types:   newSkipped,
        question_budget_remaining: typeof state.question_budget_remaining === 'number'
          ? state.question_budget_remaining : 3,
      };
      if (next) {
        const questionText = buildEvidenceQuestion(next);
        return {
          mode:          'ASK',
          text:          questionText,
          buttons:       [],
          expects_reply: true,
          session_updates: {
            ...baseUpdates,
            pending_question: { text: questionText, evidence_type: next.evidence_type, type: 'BOOTSTRAP' },
          },
          debug: { reason_code: 'BOOTSTRAP_CLINICAL_NEGATIVE', skipped: 'clinical_context' },
        };
      }
      return {
        mode:          'ASK',
        text:          'Dobře. Pokud chceš, řekni mi něco o svém zdraví nebo co tě trápí.',
        buttons:       [],
        expects_reply: true,
        session_updates: { ...baseUpdates, pending_question: null },
        debug: { reason_code: 'BOOTSTRAP_EXHAUSTED_AFTER_CLINICAL_NEGATIVE' },
      };
    }
    // Substantive answer — route through existing free-text clinical extraction
    adapterType = 'GENERAL_HEALTH_REQUEST';
    _clinicalContextRouted = true;
  }

  // ── Bootstrap skip/defer (narrow unlock) ─────────────────────────────────────
  // Fires when the user declines a bootstrap question ("nevím", "nechci uvést", etc.).
  // Classifier returns USER_PREFERENCE for declination inputs.
  // Immediately selects the next-best bootstrap candidate from the declarative list.
  // Budget NOT decremented (refusal is not forward progress).
  // EARLY RETURN — skips applyHealthEvent and the normal budget gate.
  if (adapterType === 'USER_PREFERENCE' && BOOTSTRAP_TYPES.has(state.pending_question?.evidence_type)) {
    const deferredType = state.pending_question.evidence_type;
    const newSkipped   = [...(state.skipped_bootstrap_types ?? []), deferredType];
    const skippedSet   = new Set(newSkipped);
    const birthYrKnown = state.person_birth_year != null;

    const available = filterBootstrapCandidates(_bootstrapNeeds, {
      birthYrKnown,
      resolvedPhysical: state.resolved_physical ?? [],
      skippedSet,
    });

    const next = selectNextBestEvidence(available, [], [], '1.0.0');
    const baseUpdates = {
      last_daily_decision:       state.last_daily_decision       ?? null,
      last_domain_response:      state.last_domain_response      ?? null,
      current_action_assignment: null,
      skipped_bootstrap_types:   newSkipped,
      question_budget_remaining: typeof state.question_budget_remaining === 'number'
        ? state.question_budget_remaining
        : 3,
    };

    if (next) {
      const questionText = buildEvidenceQuestion(next);
      return {
        mode:          'ASK',
        text:          questionText,
        buttons:       [],
        expects_reply: true,
        session_updates: {
          ...baseUpdates,
          pending_question: { text: questionText, evidence_type: next.evidence_type, type: 'BOOTSTRAP' },
        },
        debug: { reason_code: 'BOOTSTRAP_SKIP_NEXT', skipped: deferredType },
      };
    }
    // No more bootstrap candidates available
    return {
      mode:          'ASK',
      text:          'Dobře. Pokud chceš, řekni mi něco o svém zdraví nebo co tě trápí.',
      buttons:       [],
      expects_reply: true,
      session_updates: { ...baseUpdates, pending_question: null },
      debug: { reason_code: 'BOOTSTRAP_EXHAUSTED_AFTER_SKIP', skipped: deferredType },
    };
  }

  // 4. Build domain event (use adapter type for the event, keep original for session logic)
  // Enrich NEW_SYMPTOM with full user text so compound sentences (e.g. "bolí mě koleno a mám
  // vysoký tlak") carry diagnosis keywords for DIAG_KEYWORDS matching in healthEventAdapter.
  const enrichedPayload = _clinicalContextRouted
    ? { text: userText }
    : (adapterType === 'NEW_SYMPTOM' && userText && !payload?.symptom_raw)
      ? { ...payload, symptom_raw: userText }
      : payload;
  const event = buildEvent({ event_type: adapterType, payload: enrichedPayload }, state);

  // 4b. Sedentary hours clarification guard.
  // NBE rule: a question must match the data type the engine reads — never infer a number
  // from vague text ("Většinu dne sedím", "hodně", "skoro pořád").
  // Guard fires only when evidence_type='sedentary_hours_day' AND the user did not say a digit.
  // If the user said a digit (e.g. "9 hodin") → falls through to normal applyHealthEvent path.
  if (adapterType === 'ANSWER_TO_EVIDENCE_QUESTION'
      && event.payload.evidence_type === 'sedentary_hours_day') {
    const hasExplicitNumber = /\d/.test(userText);
    const numericValue = parseFloat(String(event.payload.value ?? '').replace(',', '.').trim());
    const isValidHours  = hasExplicitNumber && !isNaN(numericValue) && numericValue > 0 && numericValue <= 24;
    if (!isValidHours) {
      return {
        mode:          'ASK',
        text:          'Přibližně kolik hodin denně — třeba 6, 8 nebo 10?',
        buttons:       [],
        expects_reply: true,
        session_updates: {
          pending_question:          state.pending_question,
          last_daily_decision:       state.last_daily_decision       ?? null,
          last_domain_response:      state.last_domain_response      ?? null,
          current_action_assignment: state.current_action_assignment ?? null,
        },
        debug: { reason_code: 'SEDENTARY_HOURS_CLARIFICATION' },
      };
    }
  }

  // ── Fatigue context value normalization ──────────────────────────────────────
  // Fires when the user's answer to the fatigue clarification question is received.
  // Normalizes free-text answer to canonical enum before routeAnswer persists it.
  if (adapterType === 'ANSWER_TO_EVIDENCE_QUESTION'
      && event.payload.evidence_type === 'fatigue_context') {
    const raw = String(event.payload.value ?? userText).toLowerCase();
    event.payload.value =
      /nová|neobvykl|nezvykl|jinak|poprvé|nikdy.{0,8}dřív|zvláštní/.test(raw) ? 'NEW_OR_UNUSUAL'
      : /běžná|obvykl|normáln|vždy|po.{0,6}námaze|po.{0,6}náročném|tak.jako.vždy/.test(raw) ? 'ROUTINE'
      : 'UNKNOWN';
  }

  // 5. Persist + run engine via adapter (no direct DB access here)
  const result = await applyHealthEvent(userId, event);

  // 6. Build session updates (use original classifier event_type for session logic)
  const sessionUpdates = buildSessionUpdates(event_type, payload, result);

  // 7. Build presentation from DOMAIN_RESPONSE only
  // HOLD follow-up: user asked "what else?" while previous decision was also HOLD.
  // Triggers explanatory text instead of repeating the original action label.
  const isHoldFollowUp = adapterType === 'DOMAIN_REQUEST'
    && state.last_daily_decision?.mode === 'HOLD';
  let presentation = buildPresentation(event_type, payload, result, sessionUpdates, isHoldFollowUp);

  // ── Bootstrap skipped-type override ──────────────────────────────────────────
  // If the engine selected a bootstrap question that the user has already deferred
  // this session, override with the next available non-skipped bootstrap candidate.
  // Needed because skipped_bootstrap_types is session-local (not persisted to DB)
  // so the engine cannot filter them out itself.
  // Uses the effective skipped set: sessionUpdates may have added new types this turn
  // (e.g. clinical_context marked session-resolved after a negative "Ne." answer).
  const effectiveSkipped = sessionUpdates.skipped_bootstrap_types ?? state.skipped_bootstrap_types ?? [];
  if (presentation.mode === 'ASK'
      && Array.isArray(effectiveSkipped)
      && effectiveSkipped.length > 0) {
    const pendingEvType  = presentation.session_updates?.pending_question?.evidence_type;
    const isBootstrapCtx = result.domain_response?.daily_decision?.primary_item?.context_id === 'BOOTSTRAP';
    if (pendingEvType && isBootstrapCtx && effectiveSkipped.includes(pendingEvType)) {
      const skippedSet   = new Set(effectiveSkipped);
      const birthYrKnown = state.person_birth_year != null;
      // state.resolved_physical is injected before applyHealthEvent writes to DB.
      // If this turn answered a bootstrap evidence_type, it is now in the DB but not yet
      // in state.resolved_physical. Augment with the just-answered key so the override
      // does not immediately re-select the answer we just received.
      const justAnswered = (adapterType === 'ANSWER_TO_EVIDENCE_QUESTION' && event.payload.evidence_type)
        ? [event.payload.evidence_type]
        : [];
      const available    = filterBootstrapCandidates(_bootstrapNeeds, {
        birthYrKnown,
        resolvedPhysical: [...(state.resolved_physical ?? []), ...justAnswered],
        skippedSet,
      });
      const next = selectNextBestEvidence(available, [], [], '1.0.0');
      if (next) {
        const questionText = buildEvidenceQuestion(next);
        presentation = {
          ...presentation,
          text: questionText,
          session_updates: {
            ...presentation.session_updates,
            pending_question: { text: questionText, evidence_type: next.evidence_type, type: 'BOOTSTRAP' },
            skipped_bootstrap_types: effectiveSkipped,
          },
          debug: { ...presentation.debug, reason_code: 'BOOTSTRAP_SKIP_OVERRIDE' },
        };
      }
    }
  }

  // ── ZERO_DATA_FOLLOWUP guard ──────────────────────────────────────────────────
  // Invariant: user must never receive the same zero-data general-profile text twice in a row.
  // Condition: this turn AND the previous turn were both zero-data ASK_BLOCKING
  //   (no primary_item → pending_question not set in session_updates).
  // Fix: replace with the sedentary_hours_day question, which has a valid evidence_type
  //   and will be persisted by ANSWER_TO_EVIDENCE_QUESTION on the next turn.
  // Budget: falls through to the normal budget gate below — costs one budget slot.
  if (presentation.mode === 'ASK'
      && presentation.debug?.reason_code === 'ASK_BLOCKING'
      && !presentation.session_updates?.pending_question
      && state.last_daily_decision?.mode === 'ASK'
      && state.last_daily_decision?.reason_code === 'ASK_BLOCKING'
      && !state.last_daily_decision?.primary_item
      && event_type !== 'ANSWER_TO_EVIDENCE_QUESTION') {
    const sed_text = 'Přibližně kolik hodin za běžný den prosedíš?';
    presentation = {
      mode:          'ASK',
      text:          sed_text,
      buttons:       [],
      expects_reply: true,
      session_updates: {
        ...sessionUpdates,
        pending_question: { text: sed_text, evidence_type: 'sedentary_hours_day', type: 'GENERAL' },
      },
      debug: { reason_code: 'ZERO_DATA_FOLLOWUP', warnings: result.warnings ?? [] },
    };
  }

  // ── Subjective fatigue clarification guard ────────────────────────────────────
  // Fires when the user says "Jsem unavený/vyčerpaný/…" and the engine returns ASK
  // (high-urgency NBE like gait_stability dominates), but we haven't yet asked about
  // the fatigue context (new/unusual vs routine).
  //
  // applyHealthEvent already ran — "Jsem unavený." is stored to symptoms[].
  // This guard replaces the engine-selected NBE with a contextual clarification question
  // as an EARLY RETURN — bypasses the budget gate (clarification costs 0 budget slots).
  //
  // Guards:
  //   event_type check — prevents firing on ANSWER/WHY turns
  //   state.fatigue_context — cross-session: skip if already set in DB (via orchestrate.js)
  //   state.pending_question — in-session: skip if a question is already pending
  //   presentation.mode === 'ASK' — only intercept when engine wants to ask anyway
  if (event_type === 'GENERAL_HEALTH_REQUEST'
      && !state.fatigue_context
      && !state.pending_question
      && presentation.mode === 'ASK'
      && FATIGUE_STANDALONE_RE.test(userText.trim())) {
    const clarText =
      'Je ta únava něco nového nebo nezvyklého, nebo je to spíš běžná únava po náročném dni?';
    return {
      mode:          'ASK',
      text:          clarText,
      buttons:       [],
      expects_reply: true,
      session_updates: {
        ...sessionUpdates,
        pending_question: {
          text:          clarText,
          evidence_type: 'fatigue_context',
          type:          'EVIDENCE',
        },
      },
      debug: { reason_code: 'SUBJECTIVE_FATIGUE_CLARIFICATION', warnings: result.warnings ?? [] },
    };
  }

  // ── P0 Safety gates (post-presentation) ──────────────────────────────────────
  // These gates run after buildPresentation() so they can inspect the final mode.
  // They never modify health data or engine decisions — only gate presentation output.

  const budgetRemaining = typeof state.question_budget_remaining === 'number'
    ? state.question_budget_remaining : 3;

  // Acute symptom gate: unresolved acute new_symptom blocks physical exercise ACT.
  // pending_clarifications is fetched server-side by api/orchestrate.js — never trusted from client.
  const pending = state.pending_clarifications ?? [];
  const hasAcuteSymptom = pending.some(
    c => c.type === 'new_symptom' && c.temporal_context === 'acute'
  );

  if (hasAcuteSymptom && (presentation.mode === 'ACT' || presentation.mode === 'HOLD')) {
    if (budgetRemaining <= 0) {
      // Budget also exhausted: terminal state acknowledging acute symptom + no questions left.
      return {
        mode:          'ASK',
        text:          'Protože potíže přetrvávají, cvičení ti teď doporučit nechci. Pokud potíže pokračují nebo se zhoršují, nech se dnes vyšetřit.',
        buttons:       [],
        expects_reply: true,
        session_updates: { ...presentation.session_updates, question_budget_remaining: 0, current_action_assignment: null },
        debug:         { reason_code: 'ACUTE_SYMPTOM_GATE_TERMINAL' },
      };
    }
    // Budget available: ask about the acute symptom (uses one budget slot).
    return {
      mode:          'ASK',
      text:          'Zmínil/a jsi aktuální potíže, které potřebují víc kontextu. Jak se cítíš teď — lepší, stejně, nebo hůř?',
      buttons:       [],
      expects_reply: true,
      session_updates: {
        ...presentation.session_updates,
        question_budget_remaining: Math.max(0, budgetRemaining - 1),
        current_action_assignment: null,
      },
      debug:         { reason_code: 'ACUTE_SYMPTOM_GATE' },
    };
  }

  // Question budget enforcement: limit total ASK rounds across pre-intake + post-handoff.
  // Bootstrap questions are exempt — Bootstrap terminates by its own candidate-exhaustion
  // and model-sufficiency conditions, not by a question count.
  const isBootstrapQuestion = presentation.session_updates?.pending_question?.type === 'BOOTSTRAP';
  if (presentation.mode === 'ASK' && !isBootstrapQuestion) {
    if (budgetRemaining <= 0) {
      let text;
      if (hasAcuteSymptom) {
        text = 'Protože potíže přetrvávají, cvičení ti teď doporučit nechci. Pokud potíže pokračují nebo se zhoršují, nech se dnes vyšetřit.';
      } else {
        const _ctx  = result.domain_response?.explanation_context;
        const _cl   = _ctx?.system_constraint?.node_id ? (NODE_LABEL_CS[_ctx.system_constraint.node_id] ?? null) : null;
        const _ll   = _ctx?.system_leverage?.node_id   ? (NODE_LABEL_CS[_ctx.system_leverage.node_id]   ?? null) : null;
        const _node = _cl ?? _ll;
        text = _node
          ? `Dobře. Pro začátek mi to stačí. Jako důležitá se ukazuje: ${_node}. Na konkrétní doporučení ale zatím nemám dost podkladů.`
          : 'Zatím o tobě nevím dost, abych ti bezpečně doporučil konkrétní krok.';
      }
      return {
        mode:          'ASK',
        text,
        buttons:       [],
        expects_reply: true,
        session_updates: {
          ...presentation.session_updates,
          question_budget_remaining: 0,
          ...(hasAcuteSymptom ? { current_action_assignment: null } : {}),
        },
        debug:         { reason_code: hasAcuteSymptom ? 'ACUTE_SYMPTOM_GATE_TERMINAL' : 'BUDGET_EXHAUSTED' },
      };
    }
    presentation.session_updates = {
      ...presentation.session_updates,
      question_budget_remaining: budgetRemaining - 1,
    };
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Enrich debug with leverage + NBA label for internal debug overlay (?debug=1).
  // Never shown to regular users — Launcher gates on query param.
  const ctx = result.domain_response?.explanation_context;
  if (presentation.debug && ctx) {
    presentation.debug.leverage_node = ctx.system_leverage?.node_id
      ? (NODE_LABEL_CS[ctx.system_leverage.node_id] ?? ctx.system_leverage.node_id)
      : null;
    presentation.debug.nba_label = ctx.action_context?.selected?.label ?? null;
  }

  // Trace fields — readable in ?debug=1 overlay and Vercel function logs.
  if (presentation.debug != null) {
    presentation.debug.is_hold_follow_up = isHoldFollowUp;
    presentation.debug.engine_dd_mode    = result.domain_response?.daily_decision?.mode ?? null;
    presentation.debug.classifier_event  = event_type;
    presentation.debug.selected_intervention =
      result.domain_response?.daily_decision?.primary_item?.intervention_id ?? null;
  }

  return presentation;
}
