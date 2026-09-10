// test-functional-test-availability.mjs — ALPHA STOP #3 regression tests
// Proves that "Ne, nemám." answers for functional tests are persisted and break the repeat loop.
//
// S4: classifyAvailability unit test ("Ne, nemám." → NOT_AVAILABLE)
// Registry: tug_test / chair_stand_30s / grip_strength in both registries
// isEvidenceResolved unit tests
// S1: tug_test NOT_AVAILABLE persisted → next engine run: not in missing_evidence
// S2: After S1, chair_stand_30s still unresolved → still in missing_evidence
// S3: grip_strength NOT_AVAILABLE → disappears from missing_evidence
//
// Run: node --env-file=.env.local scripts/test-functional-test-availability.mjs

import { createClient } from '@supabase/supabase-js';

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`); }

// ── Module imports ────────────────────────────────────────────────────────────

const { classifyAvailability, applyHealthEvent, EVIDENCE_STORAGE_REGISTRY } =
  await import('../api/engine/healthEventAdapter.js');
const { isEvidenceResolved, EVIDENCE_RESOLUTION_REGISTRY } =
  await import('../api/engine/evidenceResolution.js');

// ── S4: classifyAvailability unit test ───────────────────────────────────────

sep('S4 — classifyAvailability("Ne, nemám.") → NOT_AVAILABLE');

{
  check(classifyAvailability('Ne, nemám.')  === 'NOT_AVAILABLE', `'Ne, nemám.' → NOT_AVAILABLE`);
  check(classifyAvailability('ne, nemám.')  === 'NOT_AVAILABLE', `lowercase 'ne, nemam.' → NOT_AVAILABLE`);
  check(classifyAvailability('Nemám')       === 'NOT_AVAILABLE', `'Nemám' → NOT_AVAILABLE`);
  check(classifyAvailability('nemám')       === 'NOT_AVAILABLE', `'nemám' → NOT_AVAILABLE`);
  check(classifyAvailability('Ne')          === 'NOT_AVAILABLE', `'Ne' → NOT_AVAILABLE`);
  check(classifyAvailability('12.4')        === 'AVAILABLE',     `numeric '12.4' → AVAILABLE`);
  check(classifyAvailability('14.2s')       === 'AVAILABLE',     `'14.2s' → AVAILABLE`);
  check(classifyAvailability(null)          === null,            `null → null`);
}

// ── Registry: EVIDENCE_STORAGE_REGISTRY entries ──────────────────────────────

sep('EVIDENCE_STORAGE_REGISTRY — tug_test / chair_stand_30s / grip_strength');

{
  for (const type of ['tug_test', 'chair_stand_30s', 'grip_strength']) {
    const reg = EVIDENCE_STORAGE_REGISTRY[type];
    check(reg != null,                         `${type} in EVIDENCE_STORAGE_REGISTRY`);
    check(reg?.table  === 'physical',          `${type}.table = physical`);
    check(reg?.key    === type,                `${type}.key = ${type}`);
    check(reg?.tracks_availability === true,   `${type}.tracks_availability = true`);
    check(reg?.evidence_kind === 'RAW_VALUE',  `${type}.evidence_kind = RAW_VALUE`);
  }
}

// ── Registry: EVIDENCE_RESOLUTION_REGISTRY entries ───────────────────────────

sep('EVIDENCE_RESOLUTION_REGISTRY — tug_test / chair_stand_30s / grip_strength');

{
  for (const type of ['tug_test', 'chair_stand_30s', 'grip_strength']) {
    const reg = EVIDENCE_RESOLUTION_REGISTRY[type];
    check(reg != null,                         `${type} in EVIDENCE_RESOLUTION_REGISTRY`);
    check(reg?.evidence_kind === 'RAW_VALUE',  `${type}.evidence_kind = RAW_VALUE`);
    check(reg?.value_source  === 'physical',   `${type}.value_source = physical`);
    check(reg?.value_key     === type,         `${type}.value_key = ${type}`);
    check(reg?.tracks_availability === true,   `${type}.tracks_availability = true`);
  }
}

// ── isEvidenceResolved unit tests ─────────────────────────────────────────────

sep('isEvidenceResolved — unit tests');

{
  check(isEvidenceResolved('unknown_type', { evidence_availability: {} }) === false,
    'unknown type → false');

  const withNA = { onboarding_inputs: {}, evidence_availability: { tug_test: 'NOT_AVAILABLE' } };
  check(isEvidenceResolved('tug_test', withNA) === true,
    'tug_test evidence_availability=NOT_AVAILABLE → resolved');

  const withVal = { onboarding_inputs: { tug_test: 14.2 }, evidence_availability: {} };
  check(isEvidenceResolved('tug_test', withVal) === true,
    'tug_test onboarding_inputs.tug_test = 14.2 → resolved');

  const empty = { onboarding_inputs: {}, evidence_availability: {} };
  check(isEvidenceResolved('tug_test', empty) === false,
    'tug_test no value, no availability → unresolved');

  const withNA2 = { onboarding_inputs: {}, evidence_availability: { chair_stand_30s: 'NOT_AVAILABLE' } };
  check(isEvidenceResolved('chair_stand_30s', withNA2) === true,
    'chair_stand_30s NOT_AVAILABLE → resolved');

  const withNA3 = { onboarding_inputs: {}, evidence_availability: { grip_strength: 'NOT_AVAILABLE' } };
  check(isEvidenceResolved('grip_strength', withNA3) === true,
    'grip_strength NOT_AVAILABLE → resolved');
}

// ── End-to-end: persistence + engine loop ────────────────────────────────────

const sb        = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FAKE_USER = `test-fta-${Date.now()}`;

// Seed: LOW_MUSCLE_STRENGTH activation conditions (vynest_nakup=false, age 67)
await sb.from('user_profiles').upsert(
  { user_id: FAKE_USER, birth_year: 1959, gender: 'female' },
  { onConflict: 'user_id' }
);
await sb.from('user_health_profile').upsert(
  { user_id: FAKE_USER, physical: {
    vynest_nakup: false, vstat_ze_zeme: true, zvednout_vnouce: true,
    recent_falls: false, rovnovaha_zavrene_oci: true,
  }},
  { onConflict: 'user_id' }
);

const { fetchHealthData } = await import('../api/engine/adapter.js');
const { activation }      = await import('../api/engine/activation.js');
const { inference }       = await import('../api/engine/inference.js');

function runEngine(ch, p, obs) {
  const activated = activation(p, ch, obs);
  const inferred  = inference(activated, p, ch, obs);
  return [...activated, ...inferred];
}

sep('S1 — tug_test "Ne, nemám." persisted → not in missing_evidence on next run');

{
  // First run: tug_test should be in missing_evidence
  const { person: p1, clinicalHistory: ch1, observations: obs1 } = await fetchHealthData(FAKE_USER);
  const states1   = runEngine(ch1, p1, obs1);
  const missing1  = states1.flatMap(s => s.missing_evidence || []);
  const tugBefore = missing1.filter(m => m.obs_type === 'tug_test');
  check(tugBefore.length > 0, 'Before answer: tug_test in ≥1 node missing_evidence');

  // Simulate: user answers "Ne, nemám." to tug_test evidence question
  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload:    { evidence_type: 'tug_test', value: 'Ne, nemám.' },
  };
  const result = await applyHealthEvent(FAKE_USER, event);
  check(result.persistence_status === 'ok', `routeAnswer persistence_status = ok (got: ${result.persistence_status})`);

  // Verify DB write
  const { data: hp } = await sb.from('user_health_profile').select('physical').eq('user_id', FAKE_USER).maybeSingle();
  const ea = hp?.physical?.evidence_availability || {};
  check(ea['tug_test'] === 'NOT_AVAILABLE', 'evidence_availability.tug_test = NOT_AVAILABLE in DB');

  // Second run: tug_test should NOT appear in missing_evidence
  const { person: p2, clinicalHistory: ch2, observations: obs2 } = await fetchHealthData(FAKE_USER);
  const states2  = runEngine(ch2, p2, obs2);
  const missing2 = states2.flatMap(s => s.missing_evidence || []);
  const tugAfter = missing2.filter(m => m.obs_type === 'tug_test');
  check(tugAfter.length === 0, 'After NOT_AVAILABLE: tug_test absent from all missing_evidence');
}

sep('S2 — chair_stand_30s still unresolved after tug_test resolved');

{
  const { person, clinicalHistory, observations } = await fetchHealthData(FAKE_USER);
  const states  = runEngine(clinicalHistory, person, observations);
  const missing = states.flatMap(s => s.missing_evidence || []);
  const chair   = missing.filter(m => m.obs_type === 'chair_stand_30s');
  check(chair.length > 0, 'chair_stand_30s still in missing_evidence (tug_test resolved, chair unresolved)');
}

sep('S3 — grip_strength "Ne, nemám." → disappears from missing_evidence');

{
  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload:    { evidence_type: 'grip_strength', value: 'Ne, nemám.' },
  };
  const result = await applyHealthEvent(FAKE_USER, event);
  check(result.persistence_status === 'ok', `grip_strength routeAnswer persistence_status = ok`);

  const { person, clinicalHistory, observations } = await fetchHealthData(FAKE_USER);
  const states  = runEngine(clinicalHistory, person, observations);
  const missing = states.flatMap(s => s.missing_evidence || []);
  const grip    = missing.filter(m => m.obs_type === 'grip_strength');
  check(grip.length === 0, 'grip_strength absent from missing_evidence after NOT_AVAILABLE');

  const { data: hp } = await sb.from('user_health_profile').select('physical').eq('user_id', FAKE_USER).maybeSingle();
  const ea = hp?.physical?.evidence_availability || {};
  check(ea['grip_strength'] === 'NOT_AVAILABLE', 'evidence_availability.grip_strength = NOT_AVAILABLE in DB');
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

await sb.from('user_health_profile').delete().eq('user_id', FAKE_USER);
await sb.from('user_profiles').delete().eq('user_id', FAKE_USER);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(60)}\n`);
if (failed > 0) process.exit(1);
