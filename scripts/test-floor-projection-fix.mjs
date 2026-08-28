// test-floor-projection-fix.mjs — Regression tests for floorRiseProjection null-guard
// Run: node --env-file=.env.local scripts/test-floor-projection-fix.mjs
//
// Fix: projections.js floorRiseProjection now returns null when evidence.length === 0,
// matching the guard already present in cvDiseaseProjection.
//
// Tests:
//   FP1 — unit: floorRiseProjection returns null when no upstream nodes present
//   FP2 — unit: floorRiseProjection returns projection when PHYSICAL_DECONDITIONING present
//   FP3 — engine: clean profile produces no LONGEVITY_FUNCTION projection (no phantom context)
//   FP4 — engine: clean profile ASK_BLOCKING primary_item=null (no phantom NBE)
//   FP5 — engine: sedentary_hours_day=8 activates PHYSICAL_INACTIVITY PREDICTED_CURRENT
//   FP6 — engine: sedentary_hours_day=8 → system_leverage selected=PHYSICAL_INACTIVITY
//   FP7 — engine: sedentary_hours_day=8 → NBA status=SELECTED (engine can reach ACT)
//   FP8 — engine: sedentary_hours_day=8 → PHYSICAL_DECONDITIONING inferred (upstream of floor projection)
//   FP9 — engine: sedentary_hours_day=8 → floorRiseProjection returns projection (evidence>0)
//   FP10 — anti-regression: S5 upstream path unchanged — sedentary_hours_day=10 still generates projection

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient }       from '@supabase/supabase-js';
import { applyHealthEvent }   from '../api/engine/healthEventAdapter.js';
import { runEngine }          from '../api/engine/engine.js';
import { computeProjections } from '../api/engine/projections.js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let passed = 0;
let failed = 0;

function sep(title) { console.log(`\n── ${title} ─────────────────────`); }
function check(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${detail ? `\n      got: ${detail}` : ''}`);
    failed++;
  }
}

// ── FP1+FP2: Unit — computeProjections (no DB) ───────────────────────────────

function scenarioFPUnit() {
  sep('FP1+FP2 — unit: floorRiseProjection null-guard (no DB needed)');

  const emptyPerson          = { birth_year: 1960, sex: 'male', height_cm: 178 };
  const emptyClinicalHistory = {
    diagnoses: [], medications: [], observations: [], lifestyle: {},
    onboarding_inputs: {}, evidence_availability: {},
  };

  // FP1: zero upstream node_states → evidence=[] → must return null
  const projectionsZero = computeProjections([], emptyPerson, emptyClinicalHistory);
  const floorZero = projectionsZero.find(p => p.target_node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');
  check(
    floorZero === undefined,
    'FP1: no upstream nodes → floorRiseProjection returns null (no LOSS_OF_FLOOR_RISE_ABILITY in output)',
    `actual: ${floorZero ? JSON.stringify({ risk: floorZero.risk }) : 'absent ✓'}`
  );

  // FP2: PHYSICAL_DECONDITIONING present → evidence.length=1 → must return projection
  const physDeconState = [{
    node_id:       'PHYSICAL_DECONDITIONING',
    current_state: 'PREDICTED_CURRENT',
    confidence:    'low',
    evidence:      { direct: [], supporting: [], inferred_from_nodes: [] },
    missing_evidence: [],
  }];
  const projectionsWithUpstream = computeProjections(physDeconState, emptyPerson, emptyClinicalHistory);
  const floorWithUpstream = projectionsWithUpstream.find(p => p.target_node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');
  check(
    floorWithUpstream !== undefined,
    'FP2: PHYSICAL_DECONDITIONING present → floorRiseProjection returns projection',
    `actual: ${floorWithUpstream ? 'present ✓' : 'absent — BUG'}`
  );
  if (floorWithUpstream) {
    check(
      floorWithUpstream.projection_type === 'TRAJECTORY_BASED',
      'FP2b: projection_type === TRAJECTORY_BASED',
      `actual: ${floorWithUpstream.projection_type}`
    );
    check(
      floorWithUpstream.risk === 'unknown',
      'FP2c: risk === unknown (no trajectory data)',
      `actual: ${floorWithUpstream.risk}`
    );
    check(
      Array.isArray(floorWithUpstream.evidence) && floorWithUpstream.evidence.some(e => e.node_id === 'PHYSICAL_DECONDITIONING'),
      'FP2d: evidence contains PHYSICAL_DECONDITIONING entry',
      `actual evidence: ${JSON.stringify(floorWithUpstream.evidence?.map(e => e.node_id ?? e.note))}`
    );
  }
}

// ── FP3+FP4: Engine — clean profile ─────────────────────────────────────────

async function scenarioFPClean() {
  sep('FP3+FP4 — engine: clean profile produces no phantom LONGEVITY_FUNCTION projection');

  const UID = `test-fp-clean-${Date.now()}`;
  try {
    // No data at all — fully clean profile
    const result = await runEngine(UID);

    const floorProj = (result.projections ?? []).find(p => p.target_node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');
    const longevityCtx = (result.decision_gate?.contexts ?? []).find(c => c.context_id === 'LONGEVITY_FUNCTION');
    const dd = result.daily_decision;

    console.log(`  projections: ${JSON.stringify((result.projections ?? []).map(p => p.target_node_id))}`);
    console.log(`  LONGEVITY_FUNCTION ctx: ${longevityCtx ? longevityCtx.status : 'absent'}`);
    console.log(`  daily_decision.mode: ${dd?.mode} | reason_code: ${dd?.reason_code}`);
    console.log(`  primary_item: ${JSON.stringify(dd?.primary_item)}`);

    check(
      floorProj === undefined,
      'FP3: clean profile → no LOSS_OF_FLOOR_RISE_ABILITY projection (phantom gone)',
      `actual: ${floorProj ? `present with risk=${floorProj.risk}` : 'absent ✓'}`
    );

    // Without phantom projection, LONGEVITY_FUNCTION may still exist from node_states
    // (but node_states=[] for clean profile → context absent entirely)
    const hasPhantomContext = longevityCtx?.status === 'NEED_MORE_EVIDENCE' && longevityCtx?.next_best_evidence != null;
    check(
      !hasPhantomContext,
      'FP4: clean profile → no phantom NBE from LONGEVITY_FUNCTION (no budget-burning questions)',
      `actual: next_best_evidence=${JSON.stringify(longevityCtx?.next_best_evidence)}`
    );
  } finally {
    await sb.from('user_health_profile').delete().eq('user_id', UID);
    await sb.from('user_constraints').delete().eq('user_id', UID);
  }
}

// ── FP5+FP6+FP7+FP8+FP9: Engine — sedentary_hours_day = 8 → ACT path ────────

async function scenarioFPSedentary() {
  sep('FP5-FP9 — engine: sedentary_hours_day=8 → PHYSICAL_INACTIVITY → leverage → NBA SELECTED');

  const UID = `test-fp-sed-${Date.now()}`;
  try {
    await applyHealthEvent(UID, {
      event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
      payload: { evidence_type: 'sedentary_hours_day', value: 8 },
    });

    const result = await runEngine(UID);

    const physInactNode = (result.node_states ?? []).find(s => s.node_id === 'PHYSICAL_INACTIVITY');
    const physDeconNode = (result.node_states ?? []).find(s => s.node_id === 'PHYSICAL_DECONDITIONING');
    const floorProj     = (result.projections ?? []).find(p => p.target_node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');
    const leverage      = result.system_leverage;
    const nba           = result.next_best_action;
    const dd            = result.daily_decision;

    console.log(`  node_states: ${(result.node_states ?? []).map(s => `${s.node_id}(${s.current_state})`).join(', ') || 'empty'}`);
    console.log(`  projections: ${JSON.stringify((result.projections ?? []).map(p => p.target_node_id))}`);
    console.log(`  system_leverage.selected.node_id: ${leverage?.selected?.node_id ?? 'null'}`);
    console.log(`  NBA status: ${nba?.status}`);
    console.log(`  daily_decision.mode: ${dd?.mode}`);

    check(
      physInactNode?.current_state === 'PREDICTED_CURRENT',
      'FP5: sedentary_hours_day=8 → PHYSICAL_INACTIVITY PREDICTED_CURRENT',
      `actual: ${physInactNode?.current_state ?? 'absent'}`
    );

    check(
      physDeconNode?.current_state === 'PREDICTED_CURRENT',
      'FP8: PHYSICAL_DECONDITIONING inferred (upstream of floor projection)',
      `actual: ${physDeconNode?.current_state ?? 'absent'}`
    );

    check(
      floorProj !== undefined,
      'FP9: sedentary_hours_day=8 → PHYSICAL_DECONDITIONING upstream → floorRiseProjection returns projection',
      `actual: ${floorProj ? `present risk=${floorProj.risk}` : 'absent — BUG'}`
    );

    const leverageNodeId = leverage?.selected?.node_id;
    check(
      leverageNodeId === 'PHYSICAL_INACTIVITY',
      'FP6: system_leverage selected = PHYSICAL_INACTIVITY',
      `actual: ${leverageNodeId ?? 'null'}`
    );

    check(
      nba?.status === 'SELECTED',
      'FP7: NBA status = SELECTED (engine can reach ACT)',
      `actual: ${nba?.status}`
    );

    if (nba?.status === 'SELECTED') {
      const sel = nba.selected;
      console.log(`  [info] NBA selected: ${sel?.action_id} / ${sel?.intervention_id} / tier:${sel?.tier}`);
    }
  } finally {
    await sb.from('user_health_profile').delete().eq('user_id', UID);
    await sb.from('user_constraints').delete().eq('user_id', UID);
  }
}

// ── FP10: Anti-regression — S5 upstream path (sedentary_hours_day=10) ────────

async function scenarioFP10() {
  sep('FP10 — anti-regression: sedentary_hours_day=10 still generates floor projection');

  const UID = `test-fp-s5-${Date.now()}`;
  try {
    await applyHealthEvent(UID, {
      event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
      payload: { evidence_type: 'sedentary_hours_day', value: 10 },
    });

    const result = await runEngine(UID);

    const floorProj = (result.projections ?? []).find(p => p.target_node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');
    const physDecon = (result.node_states ?? []).find(s => s.node_id === 'PHYSICAL_DECONDITIONING');

    console.log(`  PHYSICAL_DECONDITIONING: ${physDecon?.current_state ?? 'absent'}`);
    console.log(`  floor projection: ${floorProj ? `present (risk=${floorProj.risk})` : 'absent'}`);

    check(
      physDecon?.current_state === 'PREDICTED_CURRENT',
      'FP10a: PHYSICAL_DECONDITIONING inferred from sedentary_hours_day=10',
      `actual: ${physDecon?.current_state ?? 'absent'}`
    );

    check(
      floorProj !== undefined,
      'FP10b: upstream evidence → floorRiseProjection still returns projection (anti-regression)',
      `actual: ${floorProj ? 'present ✓' : 'absent — BUG (fix too aggressive)'}`
    );

    if (floorProj) {
      check(
        floorProj.evidence.some(e => e.node_id === 'PHYSICAL_DECONDITIONING'),
        'FP10c: projection evidence contains PHYSICAL_DECONDITIONING entry',
        `actual evidence nodes: ${JSON.stringify(floorProj.evidence.map(e => e.node_id ?? 'note'))}`
      );
    }
  } finally {
    await sb.from('user_health_profile').delete().eq('user_id', UID);
    await sb.from('user_constraints').delete().eq('user_id', UID);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('FLOOR PROJECTION NULL-GUARD REGRESSION TESTS\n');

  scenarioFPUnit();
  await scenarioFPClean();
  await scenarioFPSedentary();
  await scenarioFP10();

  console.log(`\n── RESULT: ${passed}/${passed + failed} passed${failed > 0 ? ` — ${failed} FAILED` : ' — all clear'} ──`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n💥 FATAL:', err.message, '\n', err.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
