// test-functional-strength-training-e2e.mjs — C3 DB end-to-end test
//
// Full round-trip against the real DB: seeds an ephemeral test user with a confirmed
// functional-weakness signal (vstat_ze_zeme = "Ne", i.e. cannot rise from the floor
// unaided), runs the real engine pipeline (runEngine → DAILY_DECISION → orchestrator),
// and confirms the person is offered the new sit_to_stand_supported action instead of
// the generic "Zatím o tobě vím málo…" fallback (the bug this cut closes).
//
// PREREQUISITE: migrations/20260929_functional_strength_training.sql must have been run
// in the Supabase SQL Editor first — this test does not apply it. Without that row,
// LOW_MUSCLE_STRENGTH's mapping resolves to zero candidates (NBA.status = NO_CANDIDATES)
// and this test fails with a clear message, not a false pass.
//
// DB rows are deleted in finally regardless of test outcome.
//
// Run: node --env-file=.env.local scripts/test-functional-strength-training-e2e.mjs

import { createClient } from '@supabase/supabase-js';
import { runEngine }             from '../api/engine/engine.js';
import { computeDailyDecision }  from '../api/engine/dailyDecision.js';
import { processInput }          from '../api/engine/orchestrator.js';

const sb       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TEST_UID = `test-fst-e2e-${Date.now()}`;

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// No sedentary_hours_day / steps_day — must not also activate PHYSICAL_INACTIVITY,
// so LOW_MUSCLE_STRENGTH is the only leverage-eligible signal.
const SEED_HP = {
  physical: { vstat_ze_zeme: 'Ne.' },
  diagnoses: [], symptoms: [], medications: [], lifestyle: {},
};
const SEED_UP = { birth_year: 1955 };

async function run() {
  await sb.from('user_health_profile').upsert({ user_id: TEST_UID, ...SEED_HP }, { onConflict: 'user_id' });
  await sb.from('user_profiles').upsert({ user_id: TEST_UID, ...SEED_UP }, { onConflict: 'user_id' });

  try {
    sep('E1 — engine: system_leverage selects LOW_MUSCLE_STRENGTH');
    const engineResult = await runEngine(TEST_UID);
    check(engineResult.system_leverage?.selected?.node_id === 'LOW_MUSCLE_STRENGTH',
      'E1: system_leverage.selected.node_id = LOW_MUSCLE_STRENGTH',
      `actual: ${engineResult.system_leverage?.selected?.node_id}`);

    sep('E2 — NBA selects the migrated sit_to_stand_supported action');
    const nba = engineResult.next_best_action;
    check(nba.status === 'SELECTED',
      'E2: NBA.status = SELECTED (fails as NO_CANDIDATES if the migration has not been run yet)',
      `actual status: ${nba.status}  reason: ${nba.reason ?? ''}`);
    check(nba.selected?.action_id === 'sit_to_stand_supported',
      'E2: selected action_id = sit_to_stand_supported', `actual: ${nba.selected?.action_id}`);
    check(nba.selected?.intervention_id === 'FUNCTIONAL_STRENGTH_TRAINING',
      'E2: intervention_id = FUNCTIONAL_STRENGTH_TRAINING', `actual: ${nba.selected?.intervention_id}`);
    check(nba.selected?.safety?.level === 'SAFE',
      'E2: safety.level = SAFE (no constraints seeded)', `actual: ${nba.selected?.safety?.level}`);

    sep('E3 — DAILY_DECISION: mode=ACT, reason_code=ACT_READY');
    const dd = computeDailyDecision(engineResult);
    check(dd.mode === 'ACT' && dd.reason_code === 'ACT_READY',
      'E3: mode=ACT, reason_code=ACT_READY', `actual: ${dd.mode}/${dd.reason_code}`);

    sep('E4 — orchestrator: ACT text carries the label, not the generic fallback');
    const response = await processInput(TEST_UID, 'Co mám dnes dělat?', {});
    console.log(`  text: ${response.text}`);
    check(response.mode === 'ACT', 'E4: orchestrator mode = ACT', `actual: ${response.mode}`);
    check((response.text ?? '').includes('Vstaň 5×'),
      'E4: response text carries the sit-to-stand safety instruction',
      `text: ${response.text}`);
    check(!(response.text ?? '').includes('Zatím o tobě vím málo'),
      'E4: generic no-evidence fallback is NOT shown (the bug this cut closes)',
      `text: ${response.text}`);

    // buildActResponse appends the trailing period itself (`${action.label}.`) — the label
    // in the migration must NOT carry its own trailing period, or this doubles up ("..").
    const FULL_INSTRUCTION = 'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči.';
    check((response.text ?? '').includes(FULL_INSTRUCTION),
      'E4: ACT text contains the full safety instruction with exactly one trailing period',
      `text: ${response.text}`);
    check(!(response.text ?? '').includes('..'),
      'E4: ACT text contains no doubled/ellipsis periods',
      `text: ${response.text}`);
  } finally {
    await sb.from('user_health_profile').delete().eq('user_id', TEST_UID);
    await sb.from('user_profiles').delete().eq('user_id', TEST_UID);
    await sb.from('action_assignments').delete().eq('user_id', TEST_UID);
    await sb.from('user_constraints').delete().eq('user_id', TEST_UID);
    console.log('\n  state cleaned up ✓');
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  test-functional-strength-training-e2e: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(70)}`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
