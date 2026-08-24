// api/pre-intake.js — CHJ Pre-intake API v0.1
//
// POST { history: [{role, content}] }
// → { outcome, message, structured_facts[], deferred_facts[], question_count }
//
// Stateless: client maintains full conversation history.
// question_count is DERIVED server-side from assistant turns in history —
// client-provided value is ignored (cannot bypass MAX_QUESTIONS by resetting).
//
// Does NOT call Health Engine, orchestrate.js, or write to DB.
// Uses claude-haiku-4-5 only — conversation extraction and routing.
//
// Outcomes:
//   URGENT_SAFETY_EXIT — deterministic pre-Haiku emergency escape (no AI judgment)
//   ASK               — need more info; one focused question (question_count < 3)
//   AHA               — first insight from ≥2 explicitly stated, safely connectable facts
//   NOT_ENOUGH_YET    — question limit reached or facts insufficient for safe AHA

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 30 };

const MAX_QUESTIONS = 3;

// Only event_types with idempotent persistence paths (type-based routing policy, P0 v2).
const ALLOWED_STRUCTURED_TYPES = new Set([
  'NEW_MEASUREMENT',
  'NEW_CONSTRAINT',
  'ANSWER_TO_EVIDENCE_QUESTION',
]);

const VALID_OUTCOMES = new Set(['ASK', 'AHA', 'NOT_ENOUGH_YET']);

// ── Emergency fail-safe (deterministic, pre-Haiku, no AI judgment) ─────────────
//
// Conservative: ambiguous single signals (omdlel, bolí na hrudi, špatně mluvím)
// require a companion emergency signal. Only clear combinations or unambiguous
// standalone phrases (nemůžu dýchat, dusím se, silně krvácím) trigger the escape.

const STANDALONE_EMERGENCY = [
  /nem[oůu][hž][uo]\s+(se\s+)?nadechnout/i,  // nemůžu/nemohu (se) nadechnout
  /nem[oůu][hž][uo]\s+dýchat/i,              // nemůžu/nemohu dýchat
  /nemohu\s+dýchat/i,
  /dusím\s+se\b/i,                            // dusím se (ASCII boundary OK)
  /silně\s+krvácím\b/i,                       // silně krvácím (ends ASCII 'm')
  /silné\s+krvácení/i,                        // silné krvácení (no \b — 'í' is non-ASCII)
  /ztrácím\s+vědomí/i,                        // ztrácím vědomí
  /ztrát[au]\s+vědomí/i,                      // ztráta/ztrátu vědomí (nominative + accusative)
];

// Chest symptom word + location word (both must be present, any order).
// No \b around Czech chars — 'á/í' are \W in JS regex, making \b unreliable.
function hasChestSymptom(t) {
  return /(bolest|tlak|svírání|tíha)/i.test(t) &&
         /(na\s+hrudi|v\s+hrudi|hrudník)/i.test(t);
}
// Breathing difficulty (must accompany chest symptom to trigger)
function hasBreathingDifficulty(t) {
  return /špatně\s+(se\s+(mi\s+)?)?dýchá[m]?/i.test(t) ||
         /\b(dušnost|dušno|zkrácen[ýá]\s+dech)\b/i.test(t);
}
// Speech impairment (must accompany limb impairment to trigger)
function hasSpeechImpairment(t) {
  return /špatně\s+mluvím/i.test(t) ||
         /nem[oůu][hž][uo]\s+mluvit/i.test(t) ||
         /nemohu\s+mluvit/i.test(t);
}
// Limb weakness/paralysis (must accompany speech impairment to trigger).
// Also catches "hýbat pravou rukou" even when not adjacent to "nemohu"
// (e.g. "Nemohu mluvit ani hýbat pravou rukou").
// \bhýbat\b is safe — 'hýbat' starts/ends with ASCII chars.
function hasLimbImpairment(t) {
  return /nem[oůu][hž][uo]\s+(hýbat|hnout)/i.test(t) ||
         /nemohu\s+(hýbat|hnout)/i.test(t) ||
         /\bochrnut[áý]/i.test(t) ||
         (/\bhýbat\b/i.test(t) && /(ruku|rukou|ruky|nohu|nohy|paž)/i.test(t));
}

export function isEmergency(text) {
  if (!text || typeof text !== 'string') return false;
  if (STANDALONE_EMERGENCY.some(p => p.test(text))) return true;
  if (hasChestSymptom(text) && hasBreathingDifficulty(text)) return true;  // heart attack signal
  if (hasSpeechImpairment(text) && hasLimbImpairment(text)) return true;   // stroke signal
  return false;
}

export const EMERGENCY_MESSAGE =
  'Tohle není situace pro Chytré já — vyhledej bezodkladně odbornou pomoc nebo zavolej záchrannou službu: 155.';

// ─────────────────────────────────────────────────────────────────────────────

// Lazy client — safe to import module without ANTHROPIC_API_KEY set (static tests).
let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

function buildSystemPrompt(questionCount) {
  const remaining = Math.max(0, MAX_QUESTIONS - questionCount);
  return `Jsi CHJ pre-intake asistent. Vedeš stručný anonymní rozhovor před přihlášením uživatele.
Cíl: porozumět situaci, extrahovat fakta a rozhodnout o výstupu.

AKTUÁLNÍ STAV: Dosud položeno otázek: ${questionCount} z ${MAX_QUESTIONS}. Zbývá: ${remaining}.
${questionCount >= MAX_QUESTIONS ? 'POZOR: Limit otázek dosažen. NESMÍŠ vrátit outcome=ASK.' : ''}

═══ ABSOLUTNÍ PRAVIDLA (porušení zakázáno) ═══
• Nikdy nediagnóstikuješ, nepřisuzuješ příčiny, nezávěruješ bez explicitního potvrzení uživatele.
• Nikdy nedodáváš informaci, kterou uživatel NEŘEKL (závažnost, příčina, prognóza, kauzalita).
• Nikdy nedáváš zdravotní rady ani doporučení léčby.
• Lék, dávkování, medikace → VŽDY deferred_facts jako "medication_mention". NIKDY structured_facts.
• Symptom, bolest, obtíž → VŽDY deferred_facts jako "new_symptom". NIKDY structured_facts.
• Diagnóza, chronický stav, obecný zdravotní kontext → VŽDY deferred_facts jako "general_health_request".
• NIKDY nepoužívej v poli "message" tato slova: musíš, okamžitě, je důležité, měl bys, hrozí, ohrožuje, trpí, špatně.
• Odpovídáš česky, tykáš, max 2 věty v poli "message".

═══ structured_facts[] — POVOLENÉ event_type ═══
NEW_MEASUREMENT             — uživatel uvede explicitní číselnou hodnotu
  payload: { "obs_type": "weight_kg|lab_ldl|lab_hdl|lab_hba1c|lab_glucose_fasting|lab_crp|lab_uric_acid|lab_apob|stress_1_5|sleep_hours|activity_level|steps_day", "value": číslo }

NEW_CONSTRAINT              — uživatel explicitně uvede fyzické omezení nebo úraz
  payload: { "affected_area": "koleno|záda|rameno|kyčel|...", "source_type": "injury|medical_restriction" }

ANSWER_TO_EVIDENCE_QUESTION — uživatel přímo odpovídá na konkrétní otázku o evidenci
  payload: { "evidence_type": "vstat_ze_zeme|gait_stability|recent_falls|vynest_nakup|...", "value": odpověď }

═══ deferred_facts[] — VŽDY tyto typy ═══
medication_mention   — JAKÁKOLIV zmínka o léku, dávce, medikaci
  reason: "unsupported_structured_persistence"
new_symptom          — bolest, obtíž, problém (i když zmiňuje tělesnou část)
  reason: "non_idempotent_handoff"
general_health_request — diagnóza, chronický stav, obecný zdravotní kontext
  reason: "non_idempotent_handoff"

═══ OUTCOMES ═══
ASK            — potřebuješ 1 konkrétní informaci; polož přesně 1 otázku
                 POUZE pokud zbývající otázky > 0 (aktuálně: ${remaining})
AHA            — máš ≥ 2 propojitelné fakty EXPLICITNĚ sdělené uživatelem
                 AHA = popis propojení bez závěru: "Vidím, že X a zároveň Y."
                 BEZ kauzality, BEZ diagnózy, BEZ doporučení
                 Pokud máš jen 1 fakt → NOT_ENOUGH_YET
NOT_ENOUGH_YET — limit dosažen NEBO nedostatek bezpečně propojitelných faktů

═══ VÝSTUP — POUZE validní JSON, žádný jiný text ═══
{
  "outcome": "ASK | AHA | NOT_ENOUGH_YET",
  "message": "...",
  "structured_facts": [
    {
      "event_type": "NEW_MEASUREMENT | NEW_CONSTRAINT | ANSWER_TO_EVIDENCE_QUESTION",
      "payload": { ... },
      "raw_text": "verbatim co uživatel napsal",
      "utterance_index": 0
    }
  ],
  "deferred_facts": [
    {
      "type": "medication_mention | new_symptom | general_health_request",
      "raw_text": "verbatim co uživatel napsal",
      "utterance_index": 0,
      "reason": "unsupported_structured_persistence | non_idempotent_handoff"
    }
  ]
}

utterance_index = pořadí uživatelovy zprávy v konverzaci (0 = první, 1 = druhá, ...).`;
}

function extractJson(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch {}
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) { try { return JSON.parse(codeBlock[1].trim()); } catch {} }
  const jsonObj = trimmed.match(/\{[\s\S]*\}/);
  if (jsonObj) { try { return JSON.parse(jsonObj[0]); } catch {} }
  return null;
}

// Validates and sanitizes facts from Haiku output.
// Moves forbidden event_types from structured_facts to deferred_facts.
export function sanitizeFacts(parsed, now) {
  const rawStructured = Array.isArray(parsed?.structured_facts) ? parsed.structured_facts : [];
  const rawDeferred   = Array.isArray(parsed?.deferred_facts)   ? parsed.deferred_facts   : [];

  const structured_facts = [];
  const overflow_deferred = [];

  for (const f of rawStructured) {
    if (!f || typeof f !== 'object') continue;
    if (ALLOWED_STRUCTURED_TYPES.has(f.event_type)) {
      structured_facts.push({
        event_type:      f.event_type,
        payload:         (f.payload && typeof f.payload === 'object') ? f.payload : {},
        raw_text:        String(f.raw_text ?? ''),
        utterance_index: Number.isInteger(f.utterance_index) ? f.utterance_index : 0,
        source:          'pre-intake',
        timestamp:       now,
      });
    } else {
      // Haiku put a forbidden type in structured_facts — reclassify to deferred.
      const type = f.event_type === 'NEW_SYMPTOM'           ? 'new_symptom'
                 : f.event_type === 'GENERAL_HEALTH_REQUEST' ? 'general_health_request'
                 : f.event_type === 'MEDICATION_CHANGE'      ? 'medication_mention'
                 : 'general_health_request';
      overflow_deferred.push({
        type,
        raw_text:        String(f.raw_text ?? ''),
        utterance_index: Number.isInteger(f.utterance_index) ? f.utterance_index : 0,
        reason:          'non_idempotent_handoff',
        timestamp:       now,
      });
    }
  }

  const deferred_facts = [
    ...rawDeferred
      .filter(f => f && typeof f === 'object')
      .map(f => ({
        type:            String(f.type ?? 'general_health_request'),
        raw_text:        String(f.raw_text ?? ''),
        utterance_index: Number.isInteger(f.utterance_index) ? f.utterance_index : 0,
        reason:          String(f.reason ?? 'non_idempotent_handoff'),
        timestamp:       now,
      })),
    ...overflow_deferred,
  ];

  return { structured_facts, deferred_facts };
}

const FALLBACK_MESSAGE = 'Ještě o tobě nevím dost. Pokračovat můžeš po přihlášení.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { history = [] } = req.body ?? {};

  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'history must be a non-empty array' });
  }

  const messages = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: String(m.content ?? '') }));

  if (messages.length === 0) {
    return res.status(400).json({ error: 'history contains no valid user/assistant messages' });
  }

  // Derive from history — client-provided question_count is intentionally ignored.
  // Each ASK response the user received corresponds to one assistant message in history.
  // A client cannot bypass the limit by sending question_count: 0.
  const qCount = messages.filter(m => m.role === 'assistant').length;

  // Emergency fail-safe: deterministic keyword check before any Haiku call.
  // Scans the last user message. Returns URGENT_SAFETY_EXIT immediately — no AI judgment.
  const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  if (isEmergency(lastUserText)) {
    return res.json({
      outcome:          'URGENT_SAFETY_EXIT',
      message:          EMERGENCY_MESSAGE,
      structured_facts: [],
      deferred_facts:   [],
      question_count:   qCount,
    });
  }

  let haiku_response;
  try {
    haiku_response = await getClient().messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 1024,
      system:     buildSystemPrompt(qCount),
      messages,
    });
  } catch (err) {
    console.error('[pre-intake] Haiku error:', err.message);
    return res.status(502).json({ error: 'AI service unavailable' });
  }

  const rawText = haiku_response.content?.[0]?.text ?? '';
  const parsed  = extractJson(rawText);

  const now = new Date().toISOString();

  if (!parsed || typeof parsed !== 'object') {
    console.warn('[pre-intake] JSON parse failed. Raw snippet:', rawText.slice(0, 200));
    return res.json({
      outcome:          'NOT_ENOUGH_YET',
      message:          FALLBACK_MESSAGE,
      structured_facts: [],
      deferred_facts:   [],
      question_count:   qCount,
    });
  }

  const { structured_facts, deferred_facts } = sanitizeFacts(parsed, now);

  let outcome = VALID_OUTCOMES.has(parsed.outcome) ? parsed.outcome : 'NOT_ENOUGH_YET';

  // Server-side enforcement: override ASK to NOT_ENOUGH_YET if limit already reached.
  if (outcome === 'ASK' && qCount >= MAX_QUESTIONS) {
    outcome = 'NOT_ENOUGH_YET';
  }

  const message = typeof parsed.message === 'string' && parsed.message.trim()
    ? parsed.message.trim()
    : outcome === 'NOT_ENOUGH_YET' ? FALLBACK_MESSAGE : '';

  return res.json({
    outcome,
    message,
    structured_facts,
    deferred_facts,
    question_count: outcome === 'ASK' ? qCount + 1 : qCount,
  });
}
