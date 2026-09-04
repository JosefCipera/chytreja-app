// test-tester-reset.mjs — Full Reset contract tests
// Run: node --env-file=.env.local scripts/test-tester-reset.mjs
//
// Tests that tester-reset.js Full Reset clears all expected fields,
// including pending_clarifications (regression for 2026-09-04 bug
// where stale acute symptoms survived reset and triggered ACUTE_SYMPTOM_GATE_TERMINAL).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { runTesterReset, TESTER_UIDS } from '../api/tester-reset.js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Use a disposable ephemeral UID for the regression test.
// Never use real tester or protected UIDs in automated tests.
const EPHEMERAL_UID = `test-reset-${Date.now()}`;

let passed = 0;
let failed = 0;

function check(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`);
    failed++;
  }
}

function sep(label) {
  console.log(`\n${'─'.repeat(64)}\n  ${label}\n${'─'.repeat(64)}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedEphemeral() {
  // Add the ephemeral UID to the whitelist temporarily (in-memory only — not persisted)
  TESTER_UIDS.add(EPHEMERAL_UID);

  await sb.from('user_health_profile').upsert({
    user_id:                EPHEMERAL_UID,
    diagnoses:              ['hypertenze'],
    symptoms:               ['bolí mě záda'],
    medications:            ['prestarium'],
    labs:                   { ldl: 3.2 },
    physical:               { sedentary_hours_day: 8 },
    lifestyle:              { sleep_hours: 6 },
    behavior_flags:         { HYPERTENSION: 'some warning' },
    crt_cache:              { _v: 1, nodes: [] },
    pending_clarifications: [
      {
        type:             'new_symptom',
        reason:           'non_idempotent_handoff',
        raw_text:         'Od rána se motám.',
        timestamp:        '2026-08-26T05:57:33.084Z',
        session_id:       'test-session-id',
        utterance_index:  0,
        temporal_context: 'acute',
      },
    ],
  }, { onConflict: 'user_id' });
}

async function getProfile() {
  const { data, error } = await sb
    .from('user_health_profile')
    .select('diagnoses, symptoms, medications, labs, physical, lifestyle, behavior_flags, crt_cache, pending_clarifications')
    .eq('user_id', EPHEMERAL_UID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function cleanup() {
  await sb.from('user_health_profile').delete().eq('user_id', EPHEMERAL_UID);
  TESTER_UIDS.delete(EPHEMERAL_UID);
}

// ── Test: Full Reset clears all expected fields ───────────────────────────────

async function testFullReset() {
  sep('Full Reset — clears all user_health_profile fields');

  await seedEphemeral();

  // Verify seed is present
  const before = await getProfile();
  check(Array.isArray(before?.pending_clarifications) && before.pending_clarifications.length > 0,
    'Seed: pending_clarifications contains stale acute symptom entry',
    `actual: ${JSON.stringify(before?.pending_clarifications)}`);
  check(Array.isArray(before?.symptoms) && before.symptoms.length > 0,
    'Seed: symptoms populated');
  check(before?.physical?.sedentary_hours_day != null,
    'Seed: physical.sedentary_hours_day set');

  // Run full reset
  const result = await runTesterReset(EPHEMERAL_UID, 'full', sb);
  check(result.status === 200,
    `Full Reset returns 200`,
    `actual status: ${result.status}, body: ${JSON.stringify(result.body)}`);
  check(result.body?.health_profile_cleared === true,
    'Full Reset body.health_profile_cleared = true');

  // Verify all fields cleared
  const after = await getProfile();

  check(after?.pending_clarifications == null || (Array.isArray(after.pending_clarifications) && after.pending_clarifications.length === 0),
    'REGRESSION: pending_clarifications cleared after Full Reset (stale acute symptom gone)',
    `actual: ${JSON.stringify(after?.pending_clarifications)}`);

  check(after?.diagnoses == null,   'diagnoses cleared',   `actual: ${JSON.stringify(after?.diagnoses)}`);
  check(after?.symptoms == null,    'symptoms cleared',    `actual: ${JSON.stringify(after?.symptoms)}`);
  check(after?.medications == null, 'medications cleared', `actual: ${JSON.stringify(after?.medications)}`);
  check(after?.labs == null,        'labs cleared',        `actual: ${JSON.stringify(after?.labs)}`);
  check(after?.physical == null,    'physical cleared',    `actual: ${JSON.stringify(after?.physical)}`);
  check(after?.lifestyle == null,   'lifestyle cleared',   `actual: ${JSON.stringify(after?.lifestyle)}`);
  check(after?.behavior_flags == null, 'behavior_flags cleared', `actual: ${JSON.stringify(after?.behavior_flags)}`);
  check(after?.crt_cache == null,   'crt_cache cleared',   `actual: ${JSON.stringify(after?.crt_cache)}`);
}

// ── Test: Session reset is a no-op for DB ────────────────────────────────────

async function testSessionReset() {
  sep('Session Reset — no DB changes (client-only contract)');

  const result = await runTesterReset(EPHEMERAL_UID, 'session', sb);
  check(result.status === 200, 'Session Reset returns 200');
  check(result.body?.mode === 'session', 'Session Reset body.mode = session');
  check(result.body?.local_session_cleared === true, 'Session Reset body.local_session_cleared = true');
}

// ── Test: Protected UID rejected ─────────────────────────────────────────────

async function testProtectedRejected() {
  sep('Full Reset — protected UID (Josef) rejected');

  const JOSEF = 'vPrm5PNzLWWWhi9sSwYVbkb9FaD3';
  const result = await runTesterReset(JOSEF, 'full', sb);
  check(result.status === 403, 'Full Reset on protected UID returns 403',
    `actual: ${result.status}`);
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nTester Reset contract tests`);
  console.log(`Ephemeral UID: ${EPHEMERAL_UID}  |  Date: ${new Date().toISOString().slice(0, 10)}`);

  try {
    await testSessionReset();
    await testFullReset();
    await testProtectedRejected();

    const total = passed + failed;
    sep(`Results: ${passed}/${total} passed${failed ? ` — ${failed} FAILED` : ''}`);
    process.exitCode = failed > 0 ? 1 : 0;
  } finally {
    await cleanup();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
