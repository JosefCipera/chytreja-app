// test-daily-decision.mjs — Truth table test for computeDailyDecision
// Run: node --env-file=.env.local scripts/test-daily-decision.mjs
//
// Tests all 5 priority levels (6 reason_codes):
//   SAFETY_CRITICAL     — synthetic fixture
//   SAFETY_BLOCKED      — synthetic fixture
//   ASK_BLOCKING        — synthetic fixture (realistic gait+constraint scenario)
//   HOLD_TOO_EARLY      — real Josef DB, short-exposure assignments (< 7-day horizon)
//   ACT_READY           — real Josef DB, no assignments

// Ephemeral test UID seeded with a sedentary profile; deleted in finally.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { runEngine }    from '../api/engine/engine.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TEST_UID = process.argv[2] || `test-dd-${Date.now()}`;

const SEED_HP = {
  physical: { sedentary_hours_day: 8, steps_day: 4000 },
  diagnoses: [], symptoms: [], medications: [], lifestyle: {},
};
const SEED_UP = { birth_year: 1975 };

// ── Helpers ────────────────────────────────────────────────────────────────────

function sep(label) {
  const line = '─'.repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}`);
}

function assertMode(dd, expectedMode, expectedCode, label) {
  const ok    = dd.mode === expectedMode && dd.reason_code === expectedCode;
  const badge = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`  ${badge}  mode=${dd.mode}  reason_code=${dd.reason_code}`);
  if (!ok) {
    console.log(`          expected: mode=${expectedMode}  reason_code=${expectedCode}`);
  }
  if (dd.primary_item) {
    const piStr = JSON.stringify(dd.primary_item, null, 2)
      .split('\n').slice(0, 6).join('\n') + (JSON.stringify(dd.primary_item).length > 200 ? '\n    ...' : '');
    console.log(`  primary_item (truncated):\n    ${piStr.replace(/\n/g, '\n    ')}`);
  }
  if (dd.reevaluate_after) {
    console.log(`  reevaluate_after: ${dd.reevaluate_after}`);
  }
  return ok;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function tsAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// ── Synthetic engine result builder ───────────────────────────────────────────
// Creates a minimal engine-result-shaped object for unit testing.
// Does NOT call runEngine() — no DB access.

function syntheticResult(overrides) {
  return {
    decision_gate:        { context_gates: [] },
    next_best_action:     { status: 'NOT_COMPUTED', reason: 'default', all_candidates: [] },
    response_evaluations: [],
    intervention_exposure: [],
    ...overrides,
  };
}

// ── Test cases ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function run(label, dd, expectedMode, expectedCode) {
  const ok = assertMode(dd, expectedMode, expectedCode, label);
  if (ok) passed++; else failed++;
}

async function main() {
  // Seed ephemeral user so Cases 4 & 5 can call runEngine()
  await sb.from('user_health_profile').upsert({ user_id: TEST_UID, ...SEED_HP }, { onConflict: 'user_id' });
  await sb.from('user_profiles').upsert({ user_id: TEST_UID, ...SEED_UP }, { onConflict: 'user_id' });

  try {

// ── CASE 1: SAFETY_CRITICAL ───────────────────────────────────────────────────
// Synthetic: HYPERTENSION flips to SAFETY_CRITICAL (future engine extension mocked here).
// SAFETY_CRITICAL > everything, including a viable NBA action.

sep('CASE 1 — SAFETY_CRITICAL');
console.log('  Fixture: SAFETY_CRITICAL finding in CURRENT_CV_STATE gate, NBA has a SELECTED action.');

const sc = computeDailyDecision(syntheticResult({
  decision_gate: {
    context_gates: [{
      decision_context: { id: 'CURRENT_CV_STATE', label: 'Kardiovaskulární stav' },
      status:           'EVIDENCE_SUFFICIENT',
      actionable_findings: [
        { entity_id: 'HYPERTENSION', entity_type: 'NODE_STATE', actionability: 'SAFETY_CRITICAL',
          state: 'CONFIRMED', reason: 'Systolic BP > 180 — acute hypertensive urgency.' },
      ],
      next_best_evidence: null,
    }],
  },
  next_best_action: {
    status: 'SELECTED',
    selected: { action_id: 'a1', label: 'Chůze 20 min', protocol_type: 'KARDIO_PROTOKOL',
                intervention_id: 'AEROBIC_TRAINING', safety: { level: 'SAFE' } },
    viable_count: 1, non_viable_count: 0,
    all_candidates: [{ action_id: 'a1', safety: { level: 'SAFE' }, intervention_id: 'AEROBIC_TRAINING' }],
  },
}));

run('SAFETY_CRITICAL', sc, 'SAFETY', 'SAFETY_CRITICAL');

// ── CASE 2: SAFETY_BLOCKED ────────────────────────────────────────────────────
// Synthetic: severe knee constraint — all KARDIO candidates CONTRAINDICATED;
// one SILOVY candidate NEEDS_CLINICAL_CLEARANCE (CV risk + VIGOROUS).
// Both are hard-blocked → SAFETY_BLOCKED (not a personal crisis, but no viable action).

sep('CASE 2 — SAFETY_BLOCKED');
console.log('  Fixture: 2 candidates — CONTRAINDICATED (knee) + NEEDS_CLINICAL_CLEARANCE (CV+VIGOROUS). No viable.');

const sb2 = computeDailyDecision(syntheticResult({
  next_best_action: {
    status: 'SELECTED',
    selected: null,
    viable_count: 0, non_viable_count: 2,
    all_candidates: [
      {
        action_id: 'a1', label: 'Chůze 20 min', intervention_id: 'AEROBIC_TRAINING',
        safety: {
          level: 'CONTRAINDICATED',
          reason: 'constraint_exclude match: "knee" (severity=severe). Action explicitly excluded.',
          modifications_suggested: [],
        },
      },
      {
        action_id: 'a2', label: 'Sprint intervaly', intervention_id: 'AEROBIC_TRAINING',
        safety: {
          level: 'NEEDS_CLINICAL_CLEARANCE',
          reason: 'VIGOROUS intensity with confirmed cardiovascular risk.',
          modifications_suggested: ['Consult cardiologist', 'Start MODERATE first'],
        },
      },
    ],
  },
}));

run('SAFETY_BLOCKED', sb2, 'SAFETY', 'SAFETY_BLOCKED');

// ── CASE 3: ASK_BLOCKING — realistic gait + constraint scenario ───────────────
// Kovářová-like fixture: user mentioned knee pain, severity unknown.
// All walking candidates blocked by NEEDS_MORE_EVIDENCE (unknown severity → safety gate rule 4).
// NBA returns status=NEED_MORE_EVIDENCE with a constraint-severity question.
// No balance action in pool for this fixture.

sep('CASE 3 — ASK_BLOCKING (constraint severity unknown)');
console.log('  Fixture: knee pain severity unknown → all walking blocked → NBA.status=NEED_MORE_EVIDENCE.');

const ask = computeDailyDecision(syntheticResult({
  decision_gate: {
    context_gates: [{
      decision_context: { id: 'LONGEVITY_FUNCTION', label: 'Funkční kapacita' },
      status: 'NEED_MORE_EVIDENCE',
      actionable_findings: [
        { entity_id: 'PHYSICAL_INACTIVITY', entity_type: 'NODE_STATE',
          actionability: 'ACTIONABLE', state: 'PREDICTED_CURRENT' },
      ],
      next_best_evidence: {
        evidence_type:         'gait_stability',
        acquisition_method:    'question',
        decision_impact:       'high',
        urgency:               'high',
        uncertainty_reduction: 'high',
        acquisition_cost:      'very_low',
        reason:                'Gait stability unknown — cannot assess safe walking protocol.',
        expected_effect:       [{ entity_type: 'NODE_STATE', entity_id: 'GAIT_INSTABILITY',
                                  possible_change: 'UNKNOWN → MEASURED' }],
      },
    }],
  },
  next_best_action: {
    status:             'NEED_MORE_EVIDENCE',
    reason:             'All candidates blocked by unknown constraint severity. Clarify injury status to proceed.',
    next_best_question: 'Jak závažné je tvé omezení pohybu? (lehké / střední / závažné)',
    selected:           null,
    all_candidates: [
      {
        action_id: 'a1', label: 'Chůze 20 min', intervention_id: 'AEROBIC_TRAINING',
        safety: { level: 'NEEDS_MORE_EVIDENCE',
                  reason: 'Constraint on "knee" with unknown severity — cannot assess safe loading.' },
      },
    ],
  },
}));

run('ASK_BLOCKING', ask, 'ASK', 'ASK_BLOCKING');
console.log(`  primary_item.type: ${ask.primary_item?.type}`);
console.log(`  question: "${ask.primary_item?.question ?? ask.primary_item?.evidence_type}"`);

// ── CASE 4: HOLD_TOO_EARLY ────────────────────────────────────────────────────
// Seed COMPLETED assignments for all interventions viable on the ephemeral sedentary profile
// (AEROBIC_TRAINING, BREAK_UP_SEDENTARY_TIME, STRENGTH_TRAINING) so all response_evals
// return TOO_EARLY → HOLD_TOO_EARLY.

sep('CASE 4 — HOLD_TOO_EARLY');
console.log('  Setup: completed assignments for all viable interventions (days 3, 2, 1 ago)...');

let holdInsertedIds = [];

try {
  const { data: kardioAct }   = await sb.from('longevity_actions').select('id').eq('protocol_type', 'KARDIO_PROTOKOL').eq('active', true).limit(1).single();
  const { data: trainingAct } = await sb.from('longevity_actions').select('id').eq('protocol_type', 'TRAINING_PROTOKOL').eq('active', true).limit(1).single();
  const { data: silovyAct }   = await sb.from('longevity_actions').select('id').eq('protocol_type', 'SILOVY_PROTOKOL').eq('active', true).limit(1).single();

  const seeds = [
    { action_id: kardioAct?.id,   intervention_id: 'AEROBIC_TRAINING' },
    { action_id: trainingAct?.id, intervention_id: 'BREAK_UP_SEDENTARY_TIME' },
    { action_id: silovyAct?.id,   intervention_id: 'STRENGTH_TRAINING' },
  ].filter(s => s.action_id);

  const rows = seeds.flatMap(({ action_id, intervention_id }) =>
    [3, 2, 1].map(d => ({
      user_id:                TEST_UID,
      action_id,
      intervention_id,
      selected_leverage_node: 'PHYSICAL_INACTIVITY',
      engine_version:         '1.0.0',
      status:                 'COMPLETED',
      assigned_at:            tsAgo(d),
      completed_at:           tsAgo(d),
      actual_duration_seconds: 1200,
      assigned_date:          daysAgo(d),
    }))
  );

  const { data: inserted } = await sb.from('action_assignments').insert(rows).select('id');
  holdInsertedIds = inserted.map(r => r.id);
  console.log(`  Inserted ${holdInsertedIds.length} assignments (${seeds.length} interventions × 3 days).`);

  const engineResult = await runEngine(TEST_UID);
  const dd = computeDailyDecision(engineResult);
  run('HOLD_TOO_EARLY', dd, 'HOLD', 'HOLD_TOO_EARLY');

  const re = engineResult.response_evaluations;
  console.log(`  response_evaluations: ${re.length} total`);
  re.forEach(r => console.log(`    - ${r.intervention_id} / ${r.observable_obs_type}: ${r.result}`));

} finally {
  if (holdInsertedIds.length > 0) {
    await sb.from('action_assignments').delete().in('id', holdInsertedIds);
    console.log(`  Cleanup: removed ${holdInsertedIds.length} test assignments.`);
  }
}

// ── CASE 5: ACT_READY — real Josef DB, no assignments ─────────────────────────

sep('CASE 5 — ACT_READY (real Josef DB, no assignments)');
console.log('  Running engine with no action_assignments...');

const engineResult5 = await runEngine(TEST_UID);
const dd5 = computeDailyDecision(engineResult5);
run('ACT_READY', dd5, 'ACT', 'ACT_READY');

if (dd5.mode === 'ACT') {
  const p = dd5.primary_item;
  console.log(`  selected action: "${p?.label}" (${p?.protocol_type})`);
  console.log(`  intervention:    ${p?.intervention_id}`);
  console.log(`  safety:          ${p?.safety?.level}`);
}

  // ── Results ──────────────────────────────────────────────────────────────────

  sep('RESULTS');
  const total = passed + failed;
  console.log(`  ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`  ❌ ${failed} case(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('  All cases passed.');
  }
  console.log();

  } finally {
    await sb.from('action_assignments').delete().eq('user_id', TEST_UID);
    await sb.from('user_health_profile').delete().eq('user_id', TEST_UID);
    await sb.from('user_profiles').delete().eq('user_id', TEST_UID);
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
