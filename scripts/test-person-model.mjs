// scripts/test-person-model.mjs — Person Model #1 Tests
// Run: node scripts/test-person-model.mjs
//
// Tests Person Model lifecycle management, temporal supersession,
// explicit correction, retrieval filtering, and immutability.
// No API key, no HTTP, no database.

import { PersonModel, LIFECYCLE } from '../api/lib/personModel/personModel.js';
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
    results.push(`  ❌  ${label}${detail ? `\n      GOT: ${JSON.stringify(detail)}` : ''}`);
    failed++;
  }
}

function sep(label) {
  results.push(`\n${'─'.repeat(64)}\n  ${label}\n${'─'.repeat(64)}`);
}

// ── Fact builder helpers ───────────────────────────────────────────────────────

let _nextId = 1;
function nextId() { return `fact-${String(_nextId++).padStart(3, '0')}`; }

function makeFact(overrides = {}) {
  return {
    fact_id:           nextId(),
    source_type:       'CONVERSATION',
    source_utterance:  'test utterance',
    conversation_turn: 1,
    extracted_at:      '2026-09-16T10:00:00.000Z',
    claim_type:        CLAIM_TYPES.SELF_REPORTED_STATE,
    subject:           'test_subject',
    entity:            { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
    value:             'test_value',
    precision:         PRECISION.QUALITATIVE,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    claimed_source:    { type: CLAIMED_SOURCE_TYPES.SELF },
    temporal:          { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    ...overrides,
  };
}

function makeMeasurement(value, temporalOverride = {}, tsOverride = null) {
  return makeFact({
    claim_type:   CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    subject:      'body_weight',
    entity:       { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
    value,
    unit:         'kg',
    precision:    PRECISION.EXACT,
    extracted_at: tsOverride ?? '2026-09-16T10:00:00.000Z',
    temporal:     { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, ...temporalOverride },
  });
}

// Bridge extraction helper
const FIXED_ID_IDX = { v: 0 };
function extract(utterance, turn = 1, ts = '2026-09-16T10:00:00.000Z') {
  return extractStructuredFacts({
    utterance,
    conversationTurn: turn,
    extractedAt:      ts,
    _idFactory:       () => `bridge-${String(++FIXED_ID_IDX.v).padStart(3, '0')}`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// S1 — SIMPLE STABLE FACT
// ══════════════════════════════════════════════════════════════════════════════

sep('S1: 95 kg current → ACTIVE');

{
  const pm = new PersonModel();
  const facts = extract('Vážím 95 kilo.', 1, '2026-09-01T10:00:00.000Z');

  check(facts.length >= 1, 'S1a: bridge extracts at least one fact');

  const f = facts.find(f => f.claim_type === CLAIM_TYPES.SELF_REPORTED_MEASUREMENT);
  check(!!f, 'S1b: measurement fact extracted');

  if (f) {
    pm.ingest(f);

    const active = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
    check(active.length === 1, 'S1c: exactly one ACTIVE fact in model');

    const r = active[0];
    check(r.lifecycle.status === LIFECYCLE.ACTIVE, 'S1d: lifecycle is ACTIVE');
    check(r.fact.value === 95, 'S1e: value preserved as 95', r.fact.value);
    check(r.fact.precision === PRECISION.EXACT, 'S1f: precision preserved', r.fact.precision);
    check(r.fact.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
      'S1g: speaker_certainty preserved', r.fact.speaker_certainty);
    check(r.fact.claimed_source?.type === CLAIMED_SOURCE_TYPES.SELF,
      'S1h: claimed_source preserved', r.fact.claimed_source);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// S2 — NEW MEASUREMENT (Day 1 → Day 14)
// ══════════════════════════════════════════════════════════════════════════════

sep('S2: Day 1 95 kg → Day 14 92 kg → 95 HISTORICAL, 92 ACTIVE');

{
  const pm = new PersonModel();

  const f95 = makeMeasurement(95, { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    '2026-09-01T10:00:00.000Z');
  const f92 = makeMeasurement(92, { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    '2026-09-15T10:00:00.000Z');

  pm.ingest(f95);
  pm.ingest(f92);

  const active    = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  const historical = pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL });

  check(active.length === 1,     'S2a: exactly one ACTIVE after update');
  check(historical.length === 1, 'S2b: exactly one HISTORICAL');

  const currentFact = active[0]?.fact;
  const historicFact = historical[0]?.fact;

  check(currentFact?.value === 92,  'S2c: ACTIVE value is 92', currentFact?.value);
  check(historicFact?.value === 95, 'S2d: HISTORICAL value is 95', historicFact?.value);
  check(pm.size === 2, 'S2e: both facts remain in history (size=2)', pm.size);
}

// ══════════════════════════════════════════════════════════════════════════════
// S3 — APPARENT CONTRADICTION (behaviors coexist)
// ══════════════════════════════════════════════════════════════════════════════

sep('S3: "Málo se hýbu" + "Chodím hodinu denně" → both ACTIVE');

{
  const pm = new PersonModel();

  const facts1 = extract('Málo se hýbu.', 1);
  const facts2 = extract('Chodím každý den hodinu se psem.', 2);

  for (const f of [...facts1, ...facts2]) pm.ingest(f);

  const behaviorFacts = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    subject:          'physical_activity',
    lifecycle_status: LIFECYCLE.ACTIVE,
  });

  check(behaviorFacts.length >= 1, 'S3a: at least one behavior fact ACTIVE');
  // Bridge may not extract the dog-walk utterance yet (no extractor) — but
  // the key contract is: behavior facts are never auto-superseded
  const lowFact = behaviorFacts.find(r => r.fact.value === 'low');
  check(!!lowFact, 'S3b: "low" activity fact is ACTIVE (not superseded)');

  // Verify no automatic supersession occurred for non-measurement types
  const corrected = pm.query({ lifecycle_status: LIFECYCLE.CORRECTED });
  check(corrected.length === 0, 'S3c: no CORRECTED facts (no explicit correction given)');
}

// ══════════════════════════════════════════════════════════════════════════════
// S4 — EXPLICIT CORRECTION (correction_of)
// ══════════════════════════════════════════════════════════════════════════════

sep('S4: 95 kg corrected to 85 kg via correction_of');

{
  const pm = new PersonModel();

  const f95 = makeMeasurement(95);
  const f85 = makeMeasurement(85);

  pm.ingest(f95);
  pm.ingest(f85, { correction_of: f95.fact_id });

  const active    = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  const corrected = pm.query({ lifecycle_status: LIFECYCLE.CORRECTED });
  const historical = pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL });

  check(active.length === 1,    'S4a: exactly one ACTIVE after correction');
  check(corrected.length === 1, 'S4b: exactly one CORRECTED');
  check(historical.length === 0,'S4c: no HISTORICAL (correction ≠ supersession)');

  check(active[0]?.fact.value === 85,    'S4d: ACTIVE value is 85', active[0]?.fact.value);
  check(corrected[0]?.fact.value === 95, 'S4e: CORRECTED value is 95', corrected[0]?.fact.value);

  const corrEntry = corrected[0]?.lifecycle;
  check(corrEntry?.corrected_by === f85.fact_id,
    'S4f: corrected_by points to replacement fact', corrEntry?.corrected_by);

  // Both facts remain in history
  check(pm.size === 2, 'S4g: both facts remain in history', pm.size);
}

// ══════════════════════════════════════════════════════════════════════════════
// S5 — COMPETING INTENTIONS (no auto-supersession)
// ══════════════════════════════════════════════════════════════════════════════

sep('S5: competing USER_INTENTION facts → both ACTIVE');

{
  const pm = new PersonModel();

  const f1 = makeFact({
    claim_type: CLAIM_TYPES.USER_INTENTION,
    subject:    'body_weight',
    value:      'reduce',
    temporal:   { scope: TEMPORAL_SCOPES.FUTURE, explicit: false },
  });
  const f2 = makeFact({
    claim_type: CLAIM_TYPES.USER_INTENTION,
    subject:    'body_weight',
    value:      'deprioritize',
    temporal:   { scope: TEMPORAL_SCOPES.FUTURE, explicit: false },
  });

  pm.ingest(f1);
  pm.ingest(f2);

  const active = pm.query({
    claim_type:       CLAIM_TYPES.USER_INTENTION,
    lifecycle_status: LIFECYCLE.ACTIVE,
  });

  check(active.length === 2, 'S5a: both INTENTION facts remain ACTIVE', active.length);
  check(pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL }).length === 0,
    'S5b: no HISTORICAL — intentions are not auto-superseded');
}

// ══════════════════════════════════════════════════════════════════════════════
// S6 — PREFERENCE (retrievable, ACTIVE)
// ══════════════════════════════════════════════════════════════════════════════

sep('S6: PREFERENCE fact → retrievable as ACTIVE');

{
  const pm = new PersonModel();

  const f = makeFact({
    claim_type: CLAIM_TYPES.PREFERENCE,
    subject:    'exercise_duration',
    value:      'low',
  });

  pm.ingest(f);

  const result = pm.query({
    claim_type:       CLAIM_TYPES.PREFERENCE,
    lifecycle_status: LIFECYCLE.ACTIVE,
  });

  check(result.length === 1, 'S6a: preference retrievable');
  check(result[0]?.fact.value === 'low', 'S6b: value preserved');
  check(result[0]?.lifecycle.status === LIFECYCLE.ACTIVE, 'S6c: status is ACTIVE');
}

// ══════════════════════════════════════════════════════════════════════════════
// S7 — TEMPORAL BEHAVIORS (coexist with distinct temporal metadata)
// ══════════════════════════════════════════════════════════════════════════════

sep('S7: two behavior facts with different temporal → both ACTIVE, temporal preserved');

{
  const pm = new PersonModel();

  const f1 = makeFact({
    claim_type: CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    subject:    'physical_activity',
    value:      'inactive',
    temporal:   { scope: TEMPORAL_SCOPES.HISTORICAL, explicit: true, reference: 'last month' },
  });
  const f2 = makeFact({
    claim_type: CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    subject:    'physical_activity',
    value:      'three_times_weekly',
    temporal:   { scope: TEMPORAL_SCOPES.RECURRING, explicit: true },
  });

  pm.ingest(f1);
  pm.ingest(f2);

  const active = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    subject:          'physical_activity',
    lifecycle_status: LIFECYCLE.ACTIVE,
  });

  check(active.length === 2, 'S7a: both behavior facts ACTIVE', active.length);

  const r1 = active.find(r => r.fact.value === 'inactive');
  const r2 = active.find(r => r.fact.value === 'three_times_weekly');

  check(!!r1, 'S7b: "inactive" fact present');
  check(!!r2, 'S7c: "three_times_weekly" fact present');

  // Temporal metadata preserved intact
  check(r1?.fact.temporal.scope === TEMPORAL_SCOPES.HISTORICAL,
    'S7d: temporal.scope=HISTORICAL preserved for past-month fact');
  check(r2?.fact.temporal.scope === TEMPORAL_SCOPES.RECURRING,
    'S7e: temporal.scope=RECURRING preserved for current fact');
}

// ══════════════════════════════════════════════════════════════════════════════
// S8 — WORLD MODEL (entity_ref = laser)
// ══════════════════════════════════════════════════════════════════════════════

sep('S8: laser world facts → retrievable by entity_ref');

{
  const pm = new PersonModel();

  const fState = makeFact({
    claim_type: CLAIM_TYPES.SELF_REPORTED_STATE,
    subject:    'availability',
    entity:     { ref: 'laser', type: ENTITY_TYPES.PROCESS },
    value:      'frequently_down',
  });
  const fMeasure = makeFact({
    claim_type: CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    subject:    'downtime_hours',
    entity:     { ref: 'laser', type: ENTITY_TYPES.PROCESS },
    value:      14,
    unit:       'hours',
    precision:  PRECISION.EXACT,
    temporal:   { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'last week' },
  });

  pm.ingest(fState);
  pm.ingest(fMeasure);

  const laserFacts = pm.query({ entity_ref: 'laser' });

  check(laserFacts.length === 2, 'S8a: both laser facts retrieved', laserFacts.length);
  check(laserFacts.every(r => r.fact.entity.ref === 'laser'),
    'S8b: all results have entity_ref=laser');
  check(laserFacts.every(r => r.fact.entity.type === ENTITY_TYPES.PROCESS),
    'S8c: entity.type=PROCESS preserved');

  // Past-scoped measurement arrives HISTORICAL
  const mResult = laserFacts.find(r => r.fact.subject === 'downtime_hours');
  check(mResult?.lifecycle.status === LIFECYCLE.HISTORICAL,
    'S8d: past-scoped measurement arrives as HISTORICAL');

  // State fact is ACTIVE
  const sResult = laserFacts.find(r => r.fact.subject === 'availability');
  check(sResult?.lifecycle.status === LIFECYCLE.ACTIVE,
    'S8e: state fact is ACTIVE');
}

// ══════════════════════════════════════════════════════════════════════════════
// S9 — OTHER PERSON (entity_type = PERSON_OTHER, stays separate from self)
// ══════════════════════════════════════════════════════════════════════════════

sep('S9: daughter / PERSON_OTHER → remains distinct from self');

{
  const pm = new PersonModel();

  const fDaughter = makeFact({
    claim_type: CLAIM_TYPES.USER_INTENTION,
    subject:    'company_succession',
    entity:     { ref: 'dcera', type: ENTITY_TYPES.PERSON_OTHER },
    value:      'take_over',
  });
  const fSelf = makeFact({
    claim_type: CLAIM_TYPES.USER_INTENTION,
    subject:    'company_succession',
    entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
    value:      'hand_over',
  });

  pm.ingest(fDaughter);
  pm.ingest(fSelf);

  const daughterFacts = pm.query({ entity_ref: 'dcera' });
  const selfFacts     = pm.query({ entity_ref: 'self' });

  check(daughterFacts.length === 1, 'S9a: one fact for dcera');
  check(selfFacts.length === 1,     'S9b: one fact for self');
  check(daughterFacts[0]?.fact.entity.type === ENTITY_TYPES.PERSON_OTHER,
    'S9c: daughter entity.type=PERSON_OTHER preserved');
  check(selfFacts[0]?.fact.entity.type === ENTITY_TYPES.PERSON_SELF,
    'S9d: self entity.type=PERSON_SELF preserved');

  // Entity_type filter
  const otherPeople = pm.query({ entity_type: ENTITY_TYPES.PERSON_OTHER });
  check(otherPeople.length === 1, 'S9e: entity_type=PERSON_OTHER filter works');
}

// ══════════════════════════════════════════════════════════════════════════════
// S10 — CLAIMED SOURCE = DOCTOR (never upgraded to verified)
// ══════════════════════════════════════════════════════════════════════════════

sep('S10: claimed_source=DOCTOR preserved exactly, never upgraded');

{
  const pm = new PersonModel();

  const facts = extract('Doktor mi diagnostikoval vysoký tlak.', 1);
  for (const f of facts) pm.ingest(f);

  const bpFacts = pm.query({ subject: 'blood_pressure', lifecycle_status: LIFECYCLE.ACTIVE });
  check(bpFacts.length >= 1, 'S10a: blood_pressure fact ACTIVE');

  const r = bpFacts[0];
  check(r?.fact.claimed_source?.type === CLAIMED_SOURCE_TYPES.DOCTOR,
    'S10b: claimed_source.type=DOCTOR preserved', r?.fact.claimed_source);
  check(r?.fact.value === 'high',
    'S10c: value="high" (not clinical label)', r?.fact.value);
  check(r?.fact.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'S10d: speaker_certainty preserved', r?.fact.speaker_certainty);
}

// ══════════════════════════════════════════════════════════════════════════════
// TEMPORAL REGRESSIONS
// ══════════════════════════════════════════════════════════════════════════════

sep('T1: today 92 kg, then "last week 94 kg" → 92 ACTIVE, 94 HISTORICAL');

{
  const pm = new PersonModel();

  // Extracted today
  const f92 = makeMeasurement(92,
    { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'today' },
    '2026-09-16T10:00:00.000Z');

  // Extracted later in same conversation, but refers to last week
  const f94 = makeMeasurement(94,
    { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'last week' },
    '2026-09-16T10:05:00.000Z');

  pm.ingest(f92);
  pm.ingest(f94);

  const active    = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  const historical = pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL });

  check(active.length === 1, 'T1a: exactly one ACTIVE');
  check(historical.length === 1, 'T1b: exactly one HISTORICAL');
  check(active[0]?.fact.value === 92,    'T1c: ACTIVE is 92 (today)', active[0]?.fact.value);
  check(historical[0]?.fact.value === 94,'T1d: HISTORICAL is 94 (last week)', historical[0]?.fact.value);
}

sep('T2: two measurements with indeterminate temporal → both ACTIVE');

{
  const pm = new PersonModel();

  const f1 = makeMeasurement(95,
    { scope: TEMPORAL_SCOPES.UNSPECIFIED, explicit: false },
    '2026-09-16T10:00:00.000Z');
  const f2 = makeMeasurement(92,
    { scope: TEMPORAL_SCOPES.UNSPECIFIED, explicit: false },
    '2026-09-16T10:05:00.000Z');

  pm.ingest(f1);
  pm.ingest(f2);

  const active = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  check(active.length === 2, 'T2a: both ACTIVE when temporal ordering is indeterminate', active.length);
  check(pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL }).length === 0,
    'T2b: no HISTORICAL — ingestion order alone must not cause supersession');
}

sep('T3: conversation order alone must never cause supersession');

{
  const pm = new PersonModel();

  // Two measurements where second (higher turn) refers to an earlier real time
  const fEarlier = makeMeasurement(95,
    { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'last week' },
    '2026-09-16T10:00:00.000Z');  // ingested first

  const fLater = makeMeasurement(92,
    { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'today' },
    '2026-09-16T10:05:00.000Z');  // ingested second

  // Also test reverse order: today ingested first, last-week ingested second
  const pm2 = new PersonModel();
  const fToday = makeMeasurement(92,
    { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'today' },
    '2026-09-16T10:00:00.000Z'); // ingested first
  const fLastWeek = makeMeasurement(94,
    { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'last week' },
    '2026-09-16T10:05:00.000Z'); // ingested second, higher conversation_turn

  pm.ingest(fEarlier);
  pm.ingest(fLater);

  pm2.ingest(fToday);
  pm2.ingest(fLastWeek);

  // Model 1: last-week first, today second → today ACTIVE, last-week HISTORICAL
  const m1Active = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  check(m1Active[0]?.fact.value === 92,
    'T3a: today fact ACTIVE when ingested after last-week fact', m1Active[0]?.fact.value);

  // Model 2: today first, last-week ingested later → today still ACTIVE
  // last-week must NOT supersede today merely because it arrived later
  const m2Active = pm2.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  const m2Historical = pm2.query({ lifecycle_status: LIFECYCLE.HISTORICAL });
  check(m2Active.length === 1 && m2Active[0]?.fact.value === 92,
    'T3b: today stays ACTIVE even when last-week fact arrives later', m2Active[0]?.fact.value);
  check(m2Historical.length === 1 && m2Historical[0]?.fact.value === 94,
    'T3c: last-week fact arrives as HISTORICAL regardless of ingestion order');
}

sep('T4: explicit correction independent of temporal supersession');

{
  const pm = new PersonModel();

  // Same-timestamp facts — temporal ordering is ambiguous — but correction_of is explicit
  const f95 = makeMeasurement(95,
    { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    '2026-09-16T10:00:00.000Z');
  const f85 = makeMeasurement(85,
    { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    '2026-09-16T10:00:00.000Z'); // same timestamp

  pm.ingest(f95);
  pm.ingest(f85, { correction_of: f95.fact_id });

  const corrected = pm.query({ lifecycle_status: LIFECYCLE.CORRECTED });
  const active    = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });

  check(corrected.length === 1 && corrected[0]?.fact.value === 95,
    'T4a: 95 is CORRECTED via explicit correction_of');
  check(active.length === 1 && active[0]?.fact.value === 85,
    'T4b: 85 is ACTIVE');
  check(corrected[0]?.lifecycle.corrected_by === f85.fact_id,
    'T4c: corrected_by traces to replacement fact');
  check(pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL }).length === 0,
    'T4d: status is CORRECTED not HISTORICAL (distinct from time-based supersession)');
}

// ══════════════════════════════════════════════════════════════════════════════
// IMMUTABILITY TEST
// ══════════════════════════════════════════════════════════════════════════════

sep('IMMUTABILITY: PersonModel must never mutate ingested facts');

{
  const pm = new PersonModel();

  const original = makeFact({
    claim_type:        CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    subject:           'body_weight',
    entity:            { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
    value:             95,
    unit:              'kg',
    precision:         PRECISION.EXACT,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    claimed_source:    { type: CLAIMED_SOURCE_TYPES.SELF },
    temporal:          { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
  });

  // Capture all original field values
  const snap = {
    fact_id:           original.fact_id,
    claim_type:        original.claim_type,
    subject:           original.subject,
    value:             original.value,
    unit:              original.unit,
    precision:         original.precision,
    speaker_certainty: original.speaker_certainty,
    claimed_source_type: original.claimed_source?.type,
    entity_ref:        original.entity?.ref,
    entity_type:       original.entity?.type,
    temporal_scope:    original.temporal?.scope,
    extracted_at:      original.extracted_at,
    conversation_turn: original.conversation_turn,
  };

  pm.ingest(original);

  // Ingest a second measurement to trigger supersession
  const f92 = makeMeasurement(92, {}, '2026-09-17T10:00:00.000Z');
  pm.ingest(f92);

  // Retrieve the fact from the model
  const fromModel = pm.query({ subject: 'body_weight', lifecycle_status: LIFECYCLE.HISTORICAL })[0]?.fact;

  check(fromModel !== undefined, 'IMM-a: fact is retrievable from model');

  if (fromModel) {
    check(fromModel.fact_id           === snap.fact_id,           'IMM-b: fact_id unchanged');
    check(fromModel.claim_type        === snap.claim_type,        'IMM-c: claim_type unchanged');
    check(fromModel.subject           === snap.subject,           'IMM-d: subject unchanged');
    check(fromModel.value             === snap.value,             'IMM-e: value unchanged (95)');
    check(fromModel.unit              === snap.unit,              'IMM-f: unit unchanged');
    check(fromModel.precision         === snap.precision,         'IMM-g: precision unchanged');
    check(fromModel.speaker_certainty === snap.speaker_certainty, 'IMM-h: speaker_certainty unchanged');
    check(fromModel.claimed_source?.type === snap.claimed_source_type, 'IMM-i: claimed_source unchanged');
    check(fromModel.entity?.ref       === snap.entity_ref,        'IMM-j: entity.ref unchanged');
    check(fromModel.entity?.type      === snap.entity_type,       'IMM-k: entity.type unchanged');
    check(fromModel.temporal?.scope   === snap.temporal_scope,    'IMM-l: temporal.scope unchanged');
    check(fromModel.extracted_at      === snap.extracted_at,      'IMM-m: extracted_at unchanged');
    check(fromModel.conversation_turn === snap.conversation_turn, 'IMM-n: conversation_turn unchanged');
  }

  // Attempt to mutate the returned fact — model's stored copy must be unaffected
  try {
    fromModel.value = 999;
    // If no error thrown, re-read and verify model copy is unchanged
    const reread = pm.query({ subject: 'body_weight', lifecycle_status: LIFECYCLE.HISTORICAL })[0]?.fact;
    check(reread?.value === 95, 'IMM-o: mutation of returned fact does not affect stored copy');
  } catch (e) {
    // Object.freeze — mutation threw in strict mode, which is the desired behavior
    check(true, 'IMM-o: fact is frozen, mutation attempt threw (strict mode)');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RETRIEVAL FILTERS
// ══════════════════════════════════════════════════════════════════════════════

sep('RETRIEVAL: multi-filter query contract');

{
  const pm = new PersonModel();

  // Mixed facts
  const fWeight = makeMeasurement(92, {}, '2026-09-16T10:00:00.000Z');
  const fBP = makeFact({
    claim_type: CLAIM_TYPES.SELF_REPORTED_STATE,
    subject:    'blood_pressure',
    value:      'high',
  });
  const fPref = makeFact({
    claim_type: CLAIM_TYPES.PREFERENCE,
    subject:    'exercise_duration',
    value:      'low',
  });
  const fDaughter = makeFact({
    claim_type: CLAIM_TYPES.USER_INTENTION,
    subject:    'company_succession',
    entity:     { ref: 'dcera', type: ENTITY_TYPES.PERSON_OTHER },
    value:      'take_over',
  });

  for (const f of [fWeight, fBP, fPref, fDaughter]) pm.ingest(f);

  // All ACTIVE
  const allActive = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  check(allActive.length === 4, 'RET-a: all 4 facts ACTIVE', allActive.length);

  // Filter by claim_type
  const prefs = pm.query({ claim_type: CLAIM_TYPES.PREFERENCE });
  check(prefs.length === 1 && prefs[0]?.fact.subject === 'exercise_duration',
    'RET-b: filter by claim_type=PREFERENCE works');

  // Filter by entity_ref
  const dcera = pm.query({ entity_ref: 'dcera' });
  check(dcera.length === 1 && dcera[0]?.fact.entity.type === ENTITY_TYPES.PERSON_OTHER,
    'RET-c: filter by entity_ref=dcera works');

  // Filter by subject + entity_ref combination
  const weightFacts = pm.query({ subject: 'body_weight', entity_ref: 'self' });
  check(weightFacts.length === 1, 'RET-d: combined subject+entity_ref filter works');

  // Empty result when nothing matches
  const none = pm.query({ entity_ref: 'nonexistent' });
  check(none.length === 0, 'RET-e: no results for unknown entity_ref');

  // No filters = all facts
  const all = pm.query();
  check(all.length === 4, 'RET-f: empty filters returns all facts', all.length);
}

// ══════════════════════════════════════════════════════════════════════════════
// NO AUTO-SUPERSESSION FOR NON-MEASUREMENT TYPES
// ══════════════════════════════════════════════════════════════════════════════

sep('NON-MEASUREMENT: no auto-supersession for other claim types');

{
  const pm = new PersonModel();

  const claimTypesToTest = [
    CLAIM_TYPES.USER_INTENTION,
    CLAIM_TYPES.PREFERENCE,
    CLAIM_TYPES.SELF_REPORTED_STATE,
    CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    CLAIM_TYPES.SUBJECTIVE_SYMPTOM,
    CLAIM_TYPES.FUNCTIONAL_ABILITY,
  ];

  for (const ct of claimTypesToTest) {
    const f1 = makeFact({ claim_type: ct, subject: 'test', value: 'value_a' });
    const f2 = makeFact({ claim_type: ct, subject: 'test', value: 'value_b',
      extracted_at: '2026-09-17T10:00:00.000Z' });
    pm.ingest(f1);
    pm.ingest(f2);
  }

  const active = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  check(active.length === claimTypesToTest.length * 2,
    `NON-MEAS-a: all ${claimTypesToTest.length * 2} non-measurement facts remain ACTIVE`,
    active.length);

  const historical = pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL });
  check(historical.length === 0,
    'NON-MEAS-b: zero HISTORICAL for non-measurement types');
}

// ══════════════════════════════════════════════════════════════════════════════
// BRIDGE INTEGRATION — end-to-end ingest from real utterances
// ══════════════════════════════════════════════════════════════════════════════

sep('BRIDGE-INT: end-to-end utterance → PersonModel');

{
  const pm = new PersonModel();

  const utterances = [
    'Chci zhubnout.',
    'Vážím 95 kilo.',
    'Málo se hýbu.',
    'Doktor mi diagnostikoval vysoký tlak.',
    'Nevstanu ze země bez opory.',
  ];

  for (const u of utterances) {
    const facts = extract(u, 1);
    for (const f of facts) pm.ingest(f);
  }

  const allActive = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  check(allActive.length >= 4, 'BINT-a: at least 4 facts from 5 utterances', allActive.length);

  // claimed_source from doctor utterance preserved through ingest
  const bpFacts = pm.query({ subject: 'blood_pressure' });
  check(bpFacts[0]?.fact.claimed_source?.type === CLAIMED_SOURCE_TYPES.DOCTOR,
    'BINT-b: doctor claimed_source preserved through bridge+ingest');

  // Functional ability preserved
  const fa = pm.query({ claim_type: CLAIM_TYPES.FUNCTIONAL_ABILITY });
  check(fa.length >= 1 && fa[0]?.fact.value?.ability === false,
    'BINT-c: FUNCTIONAL_ABILITY with ability=false preserved');
}

// ══════════════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPERSON MODEL #1 — TEST RESULTS\n');
for (const line of results) console.log(line);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  Total: ${passed + failed}  |  ✅ ${passed} passed  |  ❌ ${failed} failed`);
console.log(`${'═'.repeat(64)}\n`);

if (failed > 0) process.exit(1);
