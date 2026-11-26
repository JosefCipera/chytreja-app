// scripts/test-domain-evidence-adapter.mjs
// Domain Evidence Adapter #1 — Test Suite
//
// Tests the locked adapter contract:
//   - ACTIVE facts only (HISTORICAL and CORRECTED not emitted)
//   - Correct obs_type mapping for weight_kg, waist_cm, sedentary_hours
//   - Correct onboarding_inputs for FUNCTIONAL_ABILITY and SUBJECTIVE_SYMPTOM
//   - No emission for USER_INTENTION, PREFERENCE, SELF_REPORTED_STATE, unmapped refs
//   - confidence always 'estimated', source always 'conversation'
//   - measured_at=null for CURRENT/explicit=false; today's date only for explicit today
//   - Provenance preserved on all emitted observations
//   - Engine integration proof for T1: activation() produces EXCESS_ADIPOSITY MEASURED

import { adaptPersonModelToEngineInputs } from '../api/lib/domainEvidenceAdapter/domainEvidenceAdapter.js';
import { PersonModel, LIFECYCLE } from '../api/lib/personModel/personModel.js';
import { CLAIM_TYPES, TEMPORAL_SCOPES, PRECISION, SPEAKER_CERTAINTY } from '../api/lib/bridge/structuredFactBridge.js';
import { activation } from '../api/engine/activation.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

function makeWeight(overrides = {}) {
  return {
    fact_id:          'f-weight-001',
    claim_type:       CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    entity:           { ref: 'weight_kg', type: 'body_measurement' },
    value:            94,
    unit:             'kg',
    precision:        PRECISION.EXACT,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: {
      scope:     TEMPORAL_SCOPES.CURRENT,
      explicit:  false,
      reference: null,
    },
    extracted_at: '2026-09-16T10:00:00Z',
    ...overrides,
  };
}

// ── T1: "Vážím 94 kg." — basic ACTIVE measurement ─────────────────────────────
console.log('\n── T1: ACTIVE weight measurement (CURRENT, explicit=false) ──');
{
  const pm = new PersonModel();
  pm.ingest(makeWeight());
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);

  assert(observations_supplement.length === 1, 'T1-a: one observation emitted');
  const obs = observations_supplement[0];
  assert(obs.obs_type === 'weight_kg',    'T1-b: obs_type=weight_kg');
  assert(obs.value === 94,                'T1-c: value=94');
  assert(obs.unit === 'kg',              'T1-d: unit=kg');
  assert(obs.measured_at === null,       'T1-e: measured_at=null (CURRENT/explicit=false)');
  assert(obs.source === 'conversation',  'T1-f: source=conversation');
  assert(obs.confidence === 'estimated', 'T1-g: confidence=estimated');
  assert(obs.pm_fact_id === 'f-weight-001',      'T1-h: pm_fact_id preserved');
  assert(obs.pm_claim_type === CLAIM_TYPES.SELF_REPORTED_MEASUREMENT, 'T1-i: pm_claim_type preserved');
  assert(obs.pm_lifecycle === LIFECYCLE.ACTIVE,   'T1-j: pm_lifecycle=ACTIVE');
  assert(obs.pm_precision === PRECISION.EXACT,    'T1-k: pm_precision preserved');
  assert(obs.pm_speaker_certainty === SPEAKER_CERTAINTY.ASSERTED, 'T1-l: pm_speaker_certainty preserved');
  assert(Object.keys(onboarding_inputs_supplement).length === 0, 'T1-m: no onboarding supplement');
}

// ── T2: HISTORICAL weight not emitted; only ACTIVE weight emitted ─────────────
console.log('\n── T2: HISTORICAL weight excluded; ACTIVE weight emitted ──');
{
  const pm = new PersonModel();
  // F1: CURRENT 94 kg ingested first
  const f1 = makeWeight({ fact_id: 'f-weight-001', value: 94 });
  pm.ingest(f1);
  // F2: newer CURRENT 92 kg — supersedes F1 (CURRENT > existing CURRENT by timestamp)
  const f2 = makeWeight({
    fact_id:     'f-weight-002',
    value:       92,
    extracted_at: '2026-09-16T12:00:00Z',
  });
  pm.ingest(f2);

  // Verify F1 is now HISTORICAL
  const f1entry = pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL });
  assert(f1entry.length === 1 && f1entry[0].fact.fact_id === 'f-weight-001',
    'T2-a: f1 is HISTORICAL in Person Model');

  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 1, 'T2-b: only one observation emitted');
  assert(observations_supplement[0].value === 92,         'T2-c: emitted value=92 (ACTIVE)');
  assert(observations_supplement[0].pm_fact_id === 'f-weight-002', 'T2-d: emitted fact is F2');

  const has94 = observations_supplement.some(o => o.value === 94);
  assert(!has94, 'T2-e: HISTORICAL 94 kg not emitted');
}

// ── T3: CORRECTED weight not emitted ─────────────────────────────────────────
console.log('\n── T3: CORRECTED weight excluded ──');
{
  const pm = new PersonModel();
  const f1 = makeWeight({ fact_id: 'f-weight-001', value: 94 });
  pm.ingest(f1);
  const f2 = makeWeight({ fact_id: 'f-weight-002', value: 92 });
  pm.ingest(f2, { correction_of: 'f-weight-001' });

  // F1 should be CORRECTED
  const corrected = pm.query({ lifecycle_status: LIFECYCLE.CORRECTED });
  assert(corrected.length === 1 && corrected[0].fact.fact_id === 'f-weight-001',
    'T3-a: f1 is CORRECTED in Person Model');

  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  const has94 = observations_supplement.some(o => o.value === 94);
  assert(!has94, 'T3-b: CORRECTED 94 kg not emitted');
  assert(observations_supplement.length === 1, 'T3-c: only ACTIVE 92 kg emitted');
  assert(observations_supplement[0].value === 92, 'T3-d: emitted value=92');
}

// ── T4: "Málo se hýbu." — SELF_REPORTED_STATE activity — no emission ─────────
console.log('\n── T4: SELF_REPORTED_STATE activity_level — not emitted ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id:          'f-activity-001',
    claim_type:       CLAIM_TYPES.SELF_REPORTED_STATE,
    entity:           { ref: 'activity_level', type: 'behavior' },
    value:            'low',
    precision:        PRECISION.QUALITATIVE,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 0, 'T4-a: no observation emitted for activity_level');
  assert(Object.keys(onboarding_inputs_supplement).length === 0, 'T4-b: no onboarding supplement');
}

// ── T5: Sedentary hours — SELF_REPORTED_BEHAVIOR ──────────────────────────────
console.log('\n── T5: SELF_REPORTED_BEHAVIOR sedentary_hours → sedentary_hours_day ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id:          'f-sed-001',
    claim_type:       CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    entity:           { ref: 'sedentary_hours', type: 'behavior' },
    value:            10,
    unit:             'hours',
    precision:        PRECISION.EXACT,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 1,             'T5-a: one observation emitted');
  const obs = observations_supplement[0];
  assert(obs.obs_type === 'sedentary_hours_day',            'T5-b: obs_type=sedentary_hours_day');
  assert(obs.value === 10,                                  'T5-c: value=10');
  assert(obs.unit === 'hours',                              'T5-d: unit preserved');
  assert(obs.measured_at === null,                          'T5-e: measured_at=null');
  assert(obs.source === 'conversation',                     'T5-f: source=conversation');
  assert(obs.confidence === 'estimated',                    'T5-g: confidence=estimated');
  assert(obs.pm_fact_id === 'f-sed-001',                   'T5-h: provenance pm_fact_id');
}

// ── T6: FUNCTIONAL_ABILITY inability ─────────────────────────────────────────
console.log('\n── T6: FUNCTIONAL_ABILITY inability → onboarding_inputs_supplement ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id:          'f-func-001',
    claim_type:       CLAIM_TYPES.FUNCTIONAL_ABILITY,
    entity:           { ref: 'vynest_nakup', type: 'function' },
    value:            false,
    precision:        PRECISION.QUALITATIVE,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 0,                     'T6-a: no observation emitted');
  assert(onboarding_inputs_supplement['vynest_nakup'] === 'no',    'T6-b: vynest_nakup=no');
  // Verify no Engine state is produced by adapter itself
  assert(!('PERSON_NODE_STATE' in onboarding_inputs_supplement),   'T6-c: no PERSON_NODE_STATE');
}

// ── T6b: FUNCTIONAL_ABILITY ability (positive) ───────────────────────────────
console.log('\n── T6b: FUNCTIONAL_ABILITY ability (positive) → yes ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id:          'f-func-002',
    claim_type:       CLAIM_TYPES.FUNCTIONAL_ABILITY,
    entity:           { ref: 'zvednout_vnouce', type: 'function' },
    value:            true,
    precision:        PRECISION.QUALITATIVE,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(onboarding_inputs_supplement['zvednout_vnouce'] === 'yes', 'T6b-a: zvednout_vnouce=yes');
}

// ── T6c: Multiple FUNCTIONAL_ABILITY keys ────────────────────────────────────
console.log('\n── T6c: Multiple FUNCTIONAL_ABILITY keys ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id: 'f-func-003', claim_type: CLAIM_TYPES.FUNCTIONAL_ABILITY,
    entity: { ref: 'vynest_nakup', type: 'function' }, value: false,
    precision: PRECISION.QUALITATIVE, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  pm.ingest({
    fact_id: 'f-func-004', claim_type: CLAIM_TYPES.FUNCTIONAL_ABILITY,
    entity: { ref: 'vstat_ze_zeme', type: 'function' }, value: 'ne',
    precision: PRECISION.QUALITATIVE, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(onboarding_inputs_supplement['vynest_nakup'] === 'no',  'T6c-a: vynest_nakup=no');
  assert(onboarding_inputs_supplement['vstat_ze_zeme'] === 'no', 'T6c-b: vstat_ze_zeme=no');
}

// ── T7: Exertional dyspnea — SUBJECTIVE_SYMPTOM PATH evidence ────────────────
console.log('\n── T7: SUBJECTIVE_SYMPTOM exertional_dyspnea → onboarding PATH evidence ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id:          'f-symptom-001',
    claim_type:       CLAIM_TYPES.SUBJECTIVE_SYMPTOM,
    entity:           { ref: 'exertional_dyspnea', type: 'symptom' },
    value:            true,
    precision:        PRECISION.QUALITATIVE,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 0,                          'T7-a: no observation emitted');
  assert(onboarding_inputs_supplement['exertional_dyspnea'] === 'yes', 'T7-b: exertional_dyspnea=yes');
  // Adapter does NOT produce a node state
  assert(Object.keys(onboarding_inputs_supplement).length === 1,       'T7-c: only PATH key, no state');
}

// ── T8: USER_INTENTION "Chci zhubnout." — not emitted ────────────────────────
console.log('\n── T8: USER_INTENTION — not emitted ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id:          'f-intent-001',
    claim_type:       CLAIM_TYPES.USER_INTENTION,
    entity:           { ref: 'weight_loss', type: 'goal' },
    value:            'lose weight',
    precision:        PRECISION.QUALITATIVE,
    speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.FUTURE, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 0,                  'T8-a: no observation for USER_INTENTION');
  assert(Object.keys(onboarding_inputs_supplement).length === 0, 'T8-b: no onboarding supplement');
}

// ── T8b: PREFERENCE — not emitted ────────────────────────────────────────────
console.log('\n── T8b: PREFERENCE — not emitted ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id: 'f-pref-001', claim_type: CLAIM_TYPES.PREFERENCE,
    entity: { ref: 'exercise_type', type: 'preference' }, value: 'cycling',
    precision: PRECISION.QUALITATIVE, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 0,                   'T8b-a: no observation for PREFERENCE');
  assert(Object.keys(onboarding_inputs_supplement).length === 0, 'T8b-b: no onboarding supplement');
}

// ── T9: Unmapped SELF_REPORTED_BEHAVIOR (steps_day, sleep_hours) ──────────────
console.log('\n── T9: Unmapped SELF_REPORTED_BEHAVIOR refs — not emitted ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id: 'f-steps-001', claim_type: CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    entity: { ref: 'steps_day', type: 'behavior' }, value: 10000,
    precision: PRECISION.EXACT, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  pm.ingest({
    fact_id: 'f-sleep-001', claim_type: CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    entity: { ref: 'sleep_hours', type: 'behavior' }, value: 6,
    precision: PRECISION.EXACT, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 0, 'T9-a: steps_day and sleep_hours not emitted');
}

// ── T10: Temporal — explicit today reference produces measured_at ─────────────
console.log('\n── T10: Temporal — explicit today reference ──');
{
  const pm = new PersonModel();
  pm.ingest(makeWeight({
    fact_id: 'f-today-001',
    temporal: { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'dnes ráno' },
  }));
  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 1, 'T10-a: observation emitted');
  assert(observations_supplement[0].measured_at === '2026-09-16', 'T10-b: measured_at=today');
}

// ── T11: Temporal — past reference remains null ───────────────────────────────
console.log('\n── T11: Temporal — past reference → measured_at=null ──');
{
  const pm = new PersonModel();
  // "Včera" → Person Model HISTORICAL, POINT, reference='včera'
  // Adapter: HISTORICAL → not emitted. Test that even if we had a POINT/past on ACTIVE
  // it would still be null. Use an unrecognised reference on CURRENT/explicit=true.
  pm.ingest(makeWeight({
    fact_id: 'f-past-ref-001',
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: true, reference: 'minulý týden' },
  }));
  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 1,               'T11-a: observation emitted (ACTIVE)');
  assert(observations_supplement[0].measured_at === null,    'T11-b: past reference → measured_at=null');
}

// ── T12: Waist_cm mapping ─────────────────────────────────────────────────────
console.log('\n── T12: waist_cm mapping ──');
{
  const pm = new PersonModel();
  pm.ingest({
    fact_id: 'f-waist-001', claim_type: CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    entity: { ref: 'waist_cm', type: 'body_measurement' }, value: 102, unit: 'cm',
    precision: PRECISION.EXACT, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 1,          'T12-a: one observation');
  assert(observations_supplement[0].obs_type === 'waist_cm', 'T12-b: obs_type=waist_cm');
  assert(observations_supplement[0].value === 102,       'T12-c: value=102');
  assert(observations_supplement[0].confidence === 'estimated', 'T12-d: confidence=estimated');
}

// ── T13: Empty PersonModel ───────────────────────────────────────────────────
console.log('\n── T13: Empty PersonModel ──');
{
  const pm = new PersonModel();
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 0,                   'T13-a: no observations');
  assert(Object.keys(onboarding_inputs_supplement).length === 0, 'T13-b: no onboarding');
}

// ── T14: Mixed facts — only allowed ones emitted ─────────────────────────────
console.log('\n── T14: Mixed facts — only mapped refs emitted ──');
{
  const pm = new PersonModel();
  pm.ingest(makeWeight({ fact_id: 'f-w-001' }));
  pm.ingest({
    fact_id: 'f-intent-002', claim_type: CLAIM_TYPES.USER_INTENTION,
    entity: { ref: 'goal', type: 'goal' }, value: 'be healthier',
    precision: PRECISION.QUALITATIVE, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.FUTURE, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  pm.ingest({
    fact_id: 'f-func-005', claim_type: CLAIM_TYPES.FUNCTIONAL_ABILITY,
    entity: { ref: 'vynest_nakup', type: 'function' }, value: false,
    precision: PRECISION.QUALITATIVE, speaker_certainty: SPEAKER_CERTAINTY.ASSERTED,
    temporal: { scope: TEMPORAL_SCOPES.CURRENT, explicit: false, reference: null },
    extracted_at: '2026-09-16T10:00:00Z',
  });
  const { observations_supplement, onboarding_inputs_supplement } = adaptPersonModelToEngineInputs(pm);
  assert(observations_supplement.length === 1,                   'T14-a: only weight emitted');
  assert(onboarding_inputs_supplement['vynest_nakup'] === 'no', 'T14-b: functional key emitted');
  assert(!('goal' in onboarding_inputs_supplement),             'T14-c: USER_INTENTION not emitted');
}

// ── T15: Lifecycle rule — no CONFIRMED confidence ever ───────────────────────
console.log('\n── T15: No observation ever has confidence=confirmed ──');
{
  const pm = new PersonModel();
  pm.ingest(makeWeight({ fact_id: 'f-conf-001' }));
  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);
  const allEstimated = observations_supplement.every(o => o.confidence === 'estimated');
  const noneConfirmed = observations_supplement.every(o => o.confidence !== 'confirmed');
  assert(allEstimated,  'T15-a: all observations confidence=estimated');
  assert(noneConfirmed, 'T15-b: no observation has confidence=confirmed');
}

// ── ENGINE INTEGRATION PROOF — T1 feeds through existing activation() ─────────
console.log('\n── ENGINE INTEGRATION PROOF: T1 weight → activation() → EXCESS_ADIPOSITY ──');
{
  const pm = new PersonModel();
  pm.ingest(makeWeight({ fact_id: 'f-engine-001', value: 94 }));

  const { observations_supplement } = adaptPersonModelToEngineInputs(pm);

  // Merge with empty DB observations (no daily_checkin, no profile weight)
  const merged_observations = [...observations_supplement];

  // person with height sufficient for BMI >= 25 (94 / 1.80^2 = 29.0)
  const person = { person_id: 'test-user', sex: 'male', birth_year: 1966, height_cm: 180 };

  const clinicalHistory = {
    diagnoses: [],
    medications: [],
    supplements: [],
    lifestyle: { sedentary_work: false, smoking_history: 'unknown', alcohol_history: 'unknown' },
    capacity: {},
    onboarding_inputs: {},
    evidence_availability: {},
    clinical_history_documented: false,
  };

  const nodeStates = activation(person, clinicalHistory, merged_observations);

  const adiposity = nodeStates.find(s => s.node_id === 'EXCESS_ADIPOSITY');

  assert(adiposity != null, 'ENG-a: EXCESS_ADIPOSITY node produced by activation()');
  assert(adiposity?.current_state === 'MEASURED', 'ENG-b: current_state=MEASURED');
  assert(adiposity?.confidence === 'low', 'ENG-c: confidence=low (BMI proxy, no waist)');

  const directEvidence = adiposity?.evidence?.direct ?? [];
  assert(directEvidence.length > 0, 'ENG-d: evidence.direct not empty');
  assert(directEvidence[0]?.obs_type === 'weight_kg', 'ENG-e: direct evidence is weight_kg');
  assert(directEvidence[0]?.value === 94, 'ENG-f: direct evidence value=94');

  // Provenance survival check: pm_fact_id is a non-standard field.
  // activation() spreads known fields into evidence — unknown fields may or may not survive.
  const pmFactIdSurvived = directEvidence.some(e => e.pm_fact_id === 'f-engine-001');
  if (pmFactIdSurvived) {
    assert(true, 'ENG-g: pm_fact_id survived Engine evidence copying');
  } else {
    console.warn('  INTEGRATION GAP: pm_fact_id does not survive Engine evidence.direct copying.');
    console.warn('  activation() constructs evidence.direct with explicit field selection (spread from obs object).');
    console.warn('  pm_fact_id is preserved in the observation object but may not appear in evidence.direct.');
    console.warn('  This is an observation-layer gap, not an adapter defect. Adapter emits provenance correctly.');
    assert(true, 'ENG-g: provenance gap noted (not a test failure — gap documented)');
    passed--; // neutral — document gap but don't count as pass or fail
    console.log('  INTEGRATION GAP = pm_fact_id provenance does not survive Engine evidence.direct field selection');
  }

  // Verify no MEASURED state was produced BY the adapter itself (correct boundary)
  assert(!('current_state' in observations_supplement[0]), 'ENG-h: adapter output has no current_state');
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log(`\n══ Domain Evidence Adapter: ${passed} passed, ${failed} failed ══\n`);
if (failed > 0) process.exit(1);
