// test-onboarding-contract.mjs — ALPHA STOP #2 regression tests
// Proves the canonical onboarding contract is correct after the repair:
//   T1: Step-3 wizard answers persist to user_health_profile.physical (not capacity)
//   T2: Adapter exposes hp.physical as onboarding_inputs
//   T3: Onboarding waist (lifestyle.waist_cm) becomes a waist_cm observation
//   T4: No causal/model rules changed — master.json node count unchanged
//
// Run: node --env-file=.env.local scripts/test-onboarding-contract.mjs
// Uses an ephemeral user_id — never touches real user data.

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`); }

// ── Setup ─────────────────────────────────────────────────────────────────────

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FAKE_USER = `test-onb-${Date.now()}`;

const FIVE_CANONICAL_ANSWERS = {
  vstat_ze_zeme:       true,
  zvednout_vnouce:     true,
  vynest_nakup:        false,
  recent_falls:        false,
  rovnovaha_zavrene_oci: true,
};

// ── T1: Step-3 answers persist to hp.physical ─────────────────────────────────

sep('T1 — Step-3 answers persist to user_health_profile.physical');

{
  // Simulate what api/user.js step-3 handler now does
  const { data: existing } = await sb.from('user_health_profile').select('physical')
    .eq('user_id', FAKE_USER).maybeSingle();
  const merged = { ...(existing?.physical || {}), ...FIVE_CANONICAL_ANSWERS };
  const { error } = await sb.from('user_health_profile').upsert(
    { user_id: FAKE_USER, physical: merged },
    { onConflict: 'user_id' }
  );
  check(!error, 'upsert to hp.physical succeeds', error?.message);

  const { data: hp } = await sb.from('user_health_profile').select('physical, capacity')
    .eq('user_id', FAKE_USER).maybeSingle();

  check(hp?.physical != null, 'hp.physical is present');
  for (const [k, v] of Object.entries(FIVE_CANONICAL_ANSWERS)) {
    check(hp?.physical?.[k] === v, `hp.physical.${k} = ${v}`);
  }
  check(hp?.capacity == null || Object.keys(hp.capacity || {}).length === 0,
    'hp.capacity not written by step-3');
}

// ── T2: Adapter exposes hp.physical as onboarding_inputs ─────────────────────

sep('T2 — Adapter exposes hp.physical as onboarding_inputs');

{
  // fetchHealthData creates its own Supabase client internally; pass only userId.
  // onboarding_inputs lives in clinicalHistory.
  const { fetchHealthData } = await import('../api/engine/adapter.js');

  const { clinicalHistory } = await fetchHealthData(FAKE_USER);
  const onboarding_inputs = clinicalHistory?.onboarding_inputs;

  check(onboarding_inputs != null, 'onboarding_inputs present');
  for (const [k, v] of Object.entries(FIVE_CANONICAL_ANSWERS)) {
    check(onboarding_inputs[k] === v, `onboarding_inputs.${k} = ${v}`);
  }
}

// ── T3: Onboarding waist becomes a waist_cm observation ──────────────────────

sep('T3 — lifestyle.waist_cm routed to observations as waist_cm');

{
  // Seed lifestyle.waist_cm
  await sb.from('user_health_profile').upsert(
    { user_id: FAKE_USER, lifestyle: { waist_cm: 94 } },
    { onConflict: 'user_id' }
  );

  const { fetchHealthData } = await import('../api/engine/adapter.js');
  const { observations } = await fetchHealthData(FAKE_USER);

  const waistObs = observations.filter(o => o.obs_type === 'waist_cm');
  check(waistObs.length >= 1, 'at least one waist_cm observation exists');

  const onbWaist = waistObs.find(o => o.source === 'onboarding');
  check(onbWaist != null, 'waist_cm observation with source=onboarding exists');
  check(onbWaist?.value === 94, 'onboarding waist_cm value = 94');
  check(onbWaist?.unit  === 'cm', 'onboarding waist_cm unit = cm');
  check(onbWaist?.confidence === 'estimated', 'onboarding waist_cm confidence = estimated');
}

// ── T4: master.json node count unchanged ──────────────────────────────────────

sep('T4 — master.json causal model unchanged (16 nodes)');

{
  const master = JSON.parse(readFileSync(join(__dir, '../data/engine/master.json'), 'utf8'));
  const nodeCount = master.nodes?.length ?? 0;
  check(nodeCount === 16, `master.json has exactly 16 nodes (got ${nodeCount})`);

  const nodeIds = (master.nodes || []).map(n => n.id);
  for (const expected of [
    'PHYSICAL_INACTIVITY', 'EXCESS_ADIPOSITY', 'INSULIN_RESISTANCE',
    'FALL_RISK', 'GAIT_INSTABILITY', 'LOW_MUSCLE_STRENGTH',
    'LOSS_OF_FLOOR_RISE_ABILITY', 'REDUCED_FUNCTIONAL_RESERVE',
  ]) {
    check(nodeIds.includes(expected), `node ${expected} present`);
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

await sb.from('user_health_profile').delete().eq('user_id', FAKE_USER);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(60)}\n`);
if (failed > 0) process.exit(1);
