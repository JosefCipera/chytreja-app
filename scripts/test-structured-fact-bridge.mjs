// scripts/test-structured-fact-bridge.mjs — Structured Fact Bridge #1 Tests
// Run: node scripts/test-structured-fact-bridge.mjs
//
// Pure unit tests — no API key required, no HTTP calls, no database.
// Tests T1–T8 (required) + negative/safety tests.

import {
  extractStructuredFacts,
  CLAIM_TYPES,
  ENTITY_TYPES,
  PRECISION,
  SPEAKER_CERTAINTY,
  CLAIMED_SOURCE_TYPES,
  TEMPORAL_SCOPES,
} from '../api/lib/bridge/structuredFactBridge.js';

// ── Test runner ────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const results = [];

function check(condition, label, detail = '') {
  if (condition) {
    results.push(`  ✅  ${label}`);
    passed++;
  } else {
    results.push(`  ❌  ${label}${detail ? `\n      GOT: ${detail}` : ''}`);
    failed++;
  }
}

function sep(label) {
  results.push(`\n${'─'.repeat(64)}\n  ${label}\n${'─'.repeat(64)}`);
}

// Deterministic test helpers
const FIXED_ID  = 'test-id-fixed';
const FIXED_TS  = '2026-09-16T10:00:00.000Z';
const idFactory = () => FIXED_ID;

function extract(utterance, turn = 1) {
  return extractStructuredFacts({
    utterance,
    conversationTurn: turn,
    extractedAt:      FIXED_TS,
    _idFactory:       idFactory,
  });
}

// ── T1: USER_INTENTION — weight loss ──────────────────────────────────────────

sep('T1: "Chci zhubnout." → USER_INTENTION');

{
  const facts = extract('Chci zhubnout.');

  check(facts.length >= 1,
    'T1a: at least one fact extracted');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.USER_INTENTION);
  check(!!f,
    'T1b: claim_type = USER_INTENTION');
  check(f?.subject === 'body_weight',
    'T1c: subject = body_weight', f?.subject);
  check(f?.entity?.type === ENTITY_TYPES.PERSON_SELF,
    'T1d: entity.type = PERSON_SELF', f?.entity?.type);
  check(f?.value === 'reduce',
    'T1e: value = reduce', String(f?.value));
  check(f?.precision === PRECISION.QUALITATIVE,
    'T1f: precision = QUALITATIVE', f?.precision);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T1g: speaker_certainty = ASSERTED', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
    'T1h: claimed_source.type = SELF', f?.claimed_source?.type);
  check(f?.temporal?.scope === TEMPORAL_SCOPES.FUTURE,
    'T1i: temporal.scope = FUTURE', f?.temporal?.scope);

  // Contract fields present
  check(typeof f?.fact_id === 'string',           'T1j: fact_id is string');
  check(f?.source_type === 'CONVERSATION',        'T1k: source_type = CONVERSATION');
  check(f?.source_utterance === 'Chci zhubnout.', 'T1l: source_utterance preserved verbatim');
  check(f?.conversation_turn === 1,               'T1m: conversation_turn = 1');
  check(f?.extracted_at === FIXED_TS,             'T1n: extracted_at is ISO string');
}

// ── T2: SELF_REPORTED_STATE — nadváha ─────────────────────────────────────────

sep('T2: "Mám nadváhu." → SELF_REPORTED_STATE');

{
  const facts = extract('Mám nadváhu.');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SELF_REPORTED_STATE);
  check(!!f,
    'T2a: claim_type = SELF_REPORTED_STATE');
  check(f?.subject === 'body_weight_category',
    'T2b: subject = body_weight_category', f?.subject);
  check(f?.value === 'overweight',
    'T2c: value = overweight', String(f?.value));
  check(f?.precision === PRECISION.QUALITATIVE,
    'T2d: precision = QUALITATIVE', f?.precision);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T2e: speaker_certainty = ASSERTED', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
    'T2f: claimed_source.type = SELF', f?.claimed_source?.type);
  check(f?.temporal?.scope === TEMPORAL_SCOPES.CURRENT,
    'T2g: temporal.scope = CURRENT', f?.temporal?.scope);
  check(f?.entity?.type === ENTITY_TYPES.PERSON_SELF,
    'T2h: entity.type = PERSON_SELF', f?.entity?.type);

  // Negative: must NOT produce BMI, numeric weight, EXCESS_ADIPOSITY
  const hasNumericWeight = facts.some(f =>
    typeof f.value === 'number' && f.subject === 'body_weight',
  );
  check(!hasNumericWeight,
    'T2i: does NOT produce numeric body_weight');
  const hasBmi = facts.some(f =>
    JSON.stringify(f).toLowerCase().includes('bmi'),
  );
  check(!hasBmi,
    'T2j: does NOT produce BMI');
  const hasAdiposity = facts.some(f =>
    JSON.stringify(f).includes('EXCESS_ADIPOSITY') ||
    JSON.stringify(f).includes('excess_adiposity'),
  );
  check(!hasAdiposity,
    'T2k: does NOT produce EXCESS_ADIPOSITY');
}

// ── T3: SELF_REPORTED_MEASUREMENT — body weight ───────────────────────────────

sep('T3: "Vážím 95 kilo." → SELF_REPORTED_MEASUREMENT');

{
  const facts = extract('Vážím 95 kilo.');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SELF_REPORTED_MEASUREMENT);
  check(!!f,
    'T3a: claim_type = SELF_REPORTED_MEASUREMENT');
  check(f?.subject === 'body_weight',
    'T3b: subject = body_weight', f?.subject);
  check(f?.entity?.type === ENTITY_TYPES.PERSON_SELF,
    'T3c: entity.type = PERSON_SELF', f?.entity?.type);
  check(f?.value === 95,
    'T3d: value = 95 (number)', String(f?.value));
  check(f?.unit === 'kg',
    'T3e: unit = kg', f?.unit);
  check(f?.precision === PRECISION.EXACT,
    'T3f: precision = EXACT', f?.precision);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T3g: speaker_certainty = ASSERTED', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
    'T3h: claimed_source.type = SELF', f?.claimed_source?.type);
  check(f?.temporal?.scope === TEMPORAL_SCOPES.CURRENT,
    'T3i: temporal.scope = CURRENT', f?.temporal?.scope);
}

// ── T4: SELF_REPORTED_STATE — uncertain blood pressure ───────────────────────

sep('T4: "Myslím, že mám vysoký tlak." → SELF_REPORTED_STATE + UNCERTAIN');

{
  const facts = extract('Myslím, že mám vysoký tlak.');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SELF_REPORTED_STATE
                         && f.subject === 'blood_pressure');
  check(!!f,
    'T4a: claim_type = SELF_REPORTED_STATE, subject = blood_pressure');
  check(f?.value === 'high',
    'T4b: value = high (not hypertension, not clinical label)', String(f?.value));
  check(f?.precision === PRECISION.QUALITATIVE,
    'T4c: precision = QUALITATIVE', f?.precision);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.UNCERTAIN,
    'T4d: speaker_certainty = UNCERTAIN (from "Myslím, že")', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
    'T4e: claimed_source.type = SELF', f?.claimed_source?.type);
  check(f?.temporal?.scope === TEMPORAL_SCOPES.CURRENT,
    'T4f: temporal.scope = CURRENT', f?.temporal?.scope);
  check(f?.entity?.type === ENTITY_TYPES.PERSON_SELF,
    'T4g: entity.type = PERSON_SELF', f?.entity?.type);

  // Negative: must NOT produce diagnosis or engine states
  const hasEngineState = facts.some(f => {
    const raw = JSON.stringify(f);
    return raw.includes('CONFIRMED') || raw.includes('MEASURED') ||
           raw.includes('PREDICTED_CURRENT') || raw.includes('POSSIBLE') ||
           raw.includes('SUPPORTED');
  });
  check(!hasEngineState,
    'T4h: does NOT produce Engine node states or hypothesis statuses');
  const hasDiagnosis = facts.some(f => {
    const v = String(f.value);
    return v.includes('hypertension') || v.includes('diagnosis') || v.includes('diagnosed');
  });
  check(!hasDiagnosis,
    'T4i: value does NOT contain clinical diagnosis label');
}

// ── T5: SELF_REPORTED_STATE — doctor claimed origin ──────────────────────────

sep('T5: "Doktor mi diagnostikoval vysoký tlak." → claimed_source = DOCTOR');

{
  const facts = extract('Doktor mi diagnostikoval vysoký tlak.');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SELF_REPORTED_STATE
                         && f.subject === 'blood_pressure');
  check(!!f,
    'T5a: claim_type = SELF_REPORTED_STATE, subject = blood_pressure');
  check(f?.value === 'high',
    'T5b: value = high (not hypertension_diagnosed)', String(f?.value));
  check(f?.precision === PRECISION.QUALITATIVE,
    'T5c: precision = QUALITATIVE', f?.precision);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T5d: speaker_certainty = ASSERTED (no hedge)', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.DOCTOR,
    'T5e: claimed_source.type = DOCTOR (speaker claims doctor origin)', f?.claimed_source?.type);
  check(f?.temporal?.scope === TEMPORAL_SCOPES.CURRENT,
    'T5f: temporal.scope = CURRENT', f?.temporal?.scope);
  check(f?.entity?.type === ENTITY_TYPES.PERSON_SELF,
    'T5g: entity.type = PERSON_SELF', f?.entity?.type);

  // Semantic lock: T4 and T5 are epistemic siblings — same claim_type + subject + value.
  // Only claimed_source and speaker_certainty distinguish them.
  const t4facts = extract('Myslím, že mám vysoký tlak.');
  const t4f = t4facts.find(f => f.subject === 'blood_pressure');
  const t5f = f;
  check(t4f && t5f && t4f.value === t5f.value,
    'T5h: T4 and T5 produce same value — epistemic difference is in claimed_source + certainty only');
  check(t4f?.claimed_source?.type !== t5f?.claimed_source?.type,
    'T5i: T4.claimed_source ≠ T5.claimed_source');
  check(t4f?.speaker_certainty !== t5f?.speaker_certainty,
    'T5j: T4.speaker_certainty ≠ T5.speaker_certainty');
}

// ── T6: SUBJECTIVE_SYMPTOM — dyspnea with exertional context ─────────────────

sep('T6: "Zadýchávám se, když vyjdu dvě patra." → SUBJECTIVE_SYMPTOM');

{
  const facts = extract('Zadýchávám se, když vyjdu dvě patra.');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SUBJECTIVE_SYMPTOM);
  check(!!f,
    'T6a: claim_type = SUBJECTIVE_SYMPTOM');
  check(f?.subject === 'dyspnea',
    'T6b: subject = dyspnea', f?.subject);
  check(f?.entity?.type === ENTITY_TYPES.PERSON_SELF,
    'T6c: entity.type = PERSON_SELF', f?.entity?.type);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T6d: speaker_certainty = ASSERTED', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
    'T6e: claimed_source.type = SELF', f?.claimed_source?.type);
  check(f?.temporal?.scope === TEMPORAL_SCOPES.CURRENT,
    'T6f: temporal.scope = CURRENT', f?.temporal?.scope);

  // Value may preserve stated context — must NOT infer medical cause
  const raw = JSON.stringify(f?.value ?? '');
  check(!raw.includes('VO2max') && !raw.includes('vo2') && !raw.includes('LOW_VO2MAX'),
    'T6g: value does NOT contain VO2max or LOW_VO2MAX');
  check(!raw.includes('decondition') && !raw.includes('cardiac') && !raw.includes('pulmonary'),
    'T6h: value does NOT infer medical cause (deconditioning/cardiac/pulmonary)');

  // Stated context ("když vyjdu", "dvě patra") may be preserved
  const valueStr = typeof f?.value === 'object' ? JSON.stringify(f.value) : String(f?.value ?? '');
  check(
    valueStr.includes('exertion') || valueStr.includes('stairs') ||
    valueStr.includes('dyspnea'),
    'T6i: value preserves symptom identity',
    valueStr,
  );
}

// ── T7: SELF_REPORTED_BEHAVIOR — low activity ─────────────────────────────────

sep('T7: "Málo se hýbu." → SELF_REPORTED_BEHAVIOR + RECURRING');

{
  const facts = extract('Málo se hýbu.');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SELF_REPORTED_BEHAVIOR);
  check(!!f,
    'T7a: claim_type = SELF_REPORTED_BEHAVIOR');
  check(f?.subject === 'physical_activity',
    'T7b: subject = physical_activity', f?.subject);
  check(f?.value === 'low',
    'T7c: value = low', String(f?.value));
  check(f?.precision === PRECISION.QUALITATIVE,
    'T7d: precision = QUALITATIVE', f?.precision);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T7e: speaker_certainty = ASSERTED', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
    'T7f: claimed_source.type = SELF', f?.claimed_source?.type);
  check(f?.temporal?.scope === TEMPORAL_SCOPES.RECURRING,
    'T7g: temporal.scope = RECURRING (habitual pattern)', f?.temporal?.scope);
  check(f?.entity?.type === ENTITY_TYPES.PERSON_SELF,
    'T7h: entity.type = PERSON_SELF', f?.entity?.type);

  // Negative: must NOT produce Engine field mappings
  const raw = JSON.stringify(facts);
  check(!raw.includes('sedentary_work'),
    'T7i: does NOT produce sedentary_work');
  check(!raw.includes('steps') && !raw.includes('step_count'),
    'T7j: does NOT produce step count');
  check(!raw.includes('PHYSICAL_INACTIVITY'),
    'T7k: does NOT produce PHYSICAL_INACTIVITY node');
  check(!raw.includes('hours'),
    'T7l: does NOT produce hours');
}

// ── T8: SELF_REPORTED_STATE — business domain, PROCESS entity ─────────────────

sep('T8: "Myslím, že problém je v plánování." → PROCESS entity, no root_cause_hypothesis');

{
  const facts = extract('Myslím, že problém je v plánování.');

  check(facts.length >= 1,
    'T8a: at least one fact extracted');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SELF_REPORTED_STATE);
  check(!!f,
    'T8b: claim_type = SELF_REPORTED_STATE');
  check(f?.entity?.type === ENTITY_TYPES.PROCESS,
    'T8c: entity.type = PROCESS (not PERSON_SELF)', f?.entity?.type);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.UNCERTAIN,
    'T8d: speaker_certainty = UNCERTAIN (from "Myslím, že")', f?.speaker_certainty);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
    'T8e: claimed_source.type = SELF', f?.claimed_source?.type);

  // Subject must NOT be root_cause_hypothesis
  check(f?.subject !== 'root_cause_hypothesis',
    'T8f: subject is NOT root_cause_hypothesis', f?.subject);

  // Value must preserve "planning" as what was named
  const valueStr = typeof f?.value === 'object' ? JSON.stringify(f.value) : String(f?.value ?? '');
  const subjectStr = f?.subject ?? '';
  check(
    valueStr.includes('planning') || valueStr.includes('problematic') ||
    subjectStr.includes('planning'),
    'T8g: fact preserves "planning" as the named element',
    `subject=${subjectStr}, value=${valueStr}`,
  );

  // Domain independence: Bridge handles PROCESS entity without health knowledge
  check(f?.entity?.type === ENTITY_TYPES.PROCESS,
    'T8h: entity.type = PROCESS — domain-independent contract works');

  check(f?.temporal?.scope === TEMPORAL_SCOPES.CURRENT,
    'T8i: temporal.scope = CURRENT', f?.temporal?.scope);
}

// ── NEGATIVE / SAFETY TESTS ───────────────────────────────────────────────────

sep('NEG: Forbidden fields must NOT appear in any fact');

{
  const allFacts = [
    ...extract('Chci zhubnout.'),
    ...extract('Mám nadváhu.'),
    ...extract('Vážím 95 kilo.'),
    ...extract('Myslím, že mám vysoký tlak.'),
    ...extract('Doktor mi diagnostikoval vysoký tlak.'),
    ...extract('Zadýchávám se, když vyjdu dvě patra.'),
    ...extract('Málo se hýbu.'),
    ...extract('Myslím, že problém je v plánování.'),
  ];

  const forbiddenKeys = ['node_id', 'hypothesis_id', 'confidence', 'constraint', 'leverage'];
  for (const key of forbiddenKeys) {
    const hasKey = allFacts.some(f => key in f);
    check(!hasKey, `NEG: no fact has field "${key}"`);
  }

  const forbiddenValues = [
    'CONFIRMED', 'MEASURED', 'PREDICTED_CURRENT',
    'POSSIBLE', 'SUPPORTED', 'WEAKENED',
    'EXCESS_ADIPOSITY', 'PHYSICAL_INACTIVITY', 'LOW_VO2MAX', 'HYPERTENSION',
    'sedentary_work',
  ];
  for (const val of forbiddenValues) {
    const hasVal = allFacts.some(f => JSON.stringify(f).includes(val));
    check(!hasVal, `NEG: no fact contains value "${val}"`);
  }

  // "Mám nadváhu." must not generate numeric weight or BMI
  const nadvahaFacts = extract('Mám nadváhu.');
  const numericWeight = nadvahaFacts.find(f =>
    f.subject === 'body_weight' && typeof f.value === 'number',
  );
  check(!numericWeight,
    'NEG: "Mám nadváhu." → no numeric body_weight fact');

  const bmiPresent = nadvahaFacts.some(f =>
    JSON.stringify(f).toLowerCase().includes('bmi'),
  );
  check(!bmiPresent,
    'NEG: "Mám nadváhu." → no BMI anywhere in facts');

  // "Málo se hýbu." must not produce sedentary_work
  const actFacts = extract('Málo se hýbu.');
  check(
    !JSON.stringify(actFacts).includes('sedentary_work'),
    'NEG: "Málo se hýbu." → no sedentary_work',
  );

  // "Myslím, že mám vysoký tlak." must not produce diagnosis
  const bpFacts = extract('Myslím, že mám vysoký tlak.');
  const hasDiagnosis = bpFacts.some(f => {
    const v = String(f.value);
    return v.includes('hypertension') || v.includes('CONFIRMED') ||
           v.includes('diagnosis') || v.includes('diagnosed');
  });
  check(!hasDiagnosis,
    'NEG: "Myslím, že mám vysoký tlak." → no diagnosis in value');
}

sep('NEG: Empty / unhandled utterances');

{
  check(extractStructuredFacts({ utterance: '' }).length === 0,
    'NEG-E1: empty string → []');
  check(extractStructuredFacts({ utterance: null }).length === 0,
    'NEG-E2: null → []');
  check(extractStructuredFacts({ utterance: '   ' }).length === 0,
    'NEG-E3: whitespace-only → []');

  // Genuinely unhandled utterance should return [] not invented facts
  const unknown = extract('Dobré ráno, jak se máš?');
  check(unknown.length === 0,
    'NEG-E4: unhandled utterance returns [] (no invented facts)');
}

sep('NEG: claimed_source is claimed origin only — not verified');

{
  // Both T4 and T5 have claim_type SELF_REPORTED_STATE — bridge does not upgrade T5 to verified
  const t5facts = extract('Doktor mi diagnostikoval vysoký tlak.');
  const t5f = t5facts.find(f => f.subject === 'blood_pressure');
  check(t5f?.claim_type === CLAIM_TYPES.SELF_REPORTED_STATE,
    'NEG-CS1: T5 claim_type is SELF_REPORTED_STATE even with claimed_source=DOCTOR');
  // No "verified" or "confirmed" field
  check(!('verified' in (t5f ?? {})) && !('confirmed' in (t5f ?? {})),
    'NEG-CS2: no "verified" or "confirmed" field added by Bridge');
}

sep('NEG: Contract schema — all facts have required fields');

{
  const required = [
    'fact_id', 'source_type', 'source_utterance', 'conversation_turn',
    'extracted_at', 'claim_type', 'subject', 'entity', 'value',
    'precision', 'speaker_certainty', 'claimed_source', 'temporal',
  ];

  const allFacts = [
    ...extract('Chci zhubnout.'),
    ...extract('Mám nadváhu.'),
    ...extract('Vážím 95 kilo.'),
    ...extract('Myslím, že mám vysoký tlak.'),
    ...extract('Doktor mi diagnostikoval vysoký tlak.'),
    ...extract('Zadýchávám se, když vyjdu dvě patra.'),
    ...extract('Málo se hýbu.'),
    ...extract('Myslím, že problém je v plánování.'),
  ];

  for (const field of required) {
    const allHave = allFacts.every(f => field in f);
    check(allHave,
      `NEG-SCHEMA: all facts have field "${field}"`);
  }

  const validClaimTypes = new Set(Object.values(CLAIM_TYPES));
  const allValidTypes = allFacts.every(f => validClaimTypes.has(f.claim_type));
  check(allValidTypes,
    'NEG-SCHEMA: all claim_types are from locked set');

  const validEntityTypes = new Set(Object.values(ENTITY_TYPES));
  const allValidEntities = allFacts.every(f => validEntityTypes.has(f.entity?.type));
  check(allValidEntities,
    'NEG-SCHEMA: all entity.types are from locked set');
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log('\n══ STRUCTURED FACT BRIDGE #1 TESTS ════════════════════════');
for (const r of results) console.log(r);
console.log(`\n${'─'.repeat(64)}`);
console.log(`Total: ${passed + failed} | Pass: ${passed} | Fail: ${failed}`);
if (failed > 0) {
  console.log('\nFAILED TESTS:');
  results.filter(r => r.includes('❌')).forEach(r => console.log(r));
  process.exit(1);
}
