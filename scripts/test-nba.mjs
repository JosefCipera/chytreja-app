// test-nba.mjs — NEXT_BEST_ACTION v0.1 integration test (Josef)
// Run: node --env-file=.env.local scripts/test-nba.mjs

import { runEngine } from '../api/engine/engine.js';

const JOSEF_ID = 'vPrm5PNzLWWWhi9sSwYVbkb9FaD3';

const result = await runEngine(JOSEF_ID);

const nba = result.next_best_action;
const lev = result.system_leverage;
const con = result.system_constraint;

console.log('\n══════════════════════════════════════════');
console.log('  NEXT_BEST_ACTION v0.1 — Josef test');
console.log('══════════════════════════════════════════\n');

console.log(`SYSTEM_LEVERAGE:   ${lev.selected?.node_id ?? 'none'} (${lev.status})`);
console.log(`SYSTEM_CONSTRAINT: status=${con.status}, finalists=[${(con.finalists ?? []).join(', ')}]`);

console.log(`\nNEXT_BEST_ACTION: status=${nba.status}`);

if (nba.status === 'SELECTED') {
  const s = nba.selected;
  console.log(`\n  ┌── SELECTED`);
  console.log(`  │  action_id:       ${s.action_id}`);
  console.log(`  │  label:           ${s.label}`);
  console.log(`  │  intervention:    ${s.intervention_id}`);
  console.log(`  │  protocol_type:   ${s.protocol_type}`);
  console.log(`  │  tier:            ${s.tier}`);
  console.log(`  │  safety:          ${s.safety.level}`);
  console.log(`  │    reason:        ${s.safety.reason}`);
  if (s.safety.modifications_suggested?.length > 0) {
    console.log(`  │    mods:          ${s.safety.modifications_suggested.join(' | ')}`);
  }
  console.log(`  │  MME:             ${s.min_meaningful_effect.level} — ${s.min_meaningful_effect.reason}`);
  console.log(`  │  leverage_affinity: ${s.leverage_affinity}`);
  console.log(`  │  effect_leverage: ${s.effect_on_leverage}`);
  console.log(`  │  goal_impact:     ${s.goal_impact.branches.join(', ')}`);
  console.log(`  │  feasibility:     ${s.feasibility}`);
  console.log(`  │  friction:        ${s.friction}`);
  console.log(`  │  time_to_feedback:${s.time_to_feedback}`);
  console.log(`  └────`);

  console.log(`\n  CV risk context:   ${nba.cv_risk_context}`);
  console.log(`  Parsed constraints: ${JSON.stringify(nba.parsed_constraints)}`);
  console.log(`  Viable / non-viable: ${nba.viable_count} / ${nba.non_viable_count}`);

  console.log('\n  Top 5 viable (selection order — same sort as selectBestCandidate):');
  const SAFETY_RANK   = { SAFE: 5, SAFE_WITH_MODIFICATION: 4, NEEDS_MORE_EVIDENCE: 3, NEEDS_CLINICAL_CLEARANCE: 2, CONTRAINDICATED: 1 };
  const MME_RANK      = { MEANINGFUL: 3, PLAUSIBLE: 2, UNKNOWN: 1 };
  const AFFINITY_RANK = { PRIMARY: 4, CONTRIBUTORY: 3, ACCESSORY: 2, UNKNOWN: 1 };
  const LEV_RANK      = { high: 3, medium: 2, low: 1 };
  const FEAS_RANK     = { high: 3, medium: 2, low: 1 };
  const FRIC_RANK     = { low: 3, medium: 2, high: 1 };
  const TIME_RANK     = { days: 3, days_to_weeks: 2, weeks: 1, months: 0 };
  const sorted = [...nba.all_candidates]
    .filter(c => ['SAFE','SAFE_WITH_MODIFICATION'].includes(c.safety.level))
    .sort((a, b) => {
      let d;
      d = SAFETY_RANK[b.safety.level] - SAFETY_RANK[a.safety.level]; if (d) return d;
      d = MME_RANK[b.min_meaningful_effect.level] - MME_RANK[a.min_meaningful_effect.level]; if (d) return d;
      d = AFFINITY_RANK[b.leverage_affinity] - AFFINITY_RANK[a.leverage_affinity]; if (d) return d;
      d = LEV_RANK[b.effect_on_leverage] - LEV_RANK[a.effect_on_leverage]; if (d) return d;
      d = b.goal_impact.branches.length - a.goal_impact.branches.length; if (d) return d;
      d = FEAS_RANK[b.feasibility] - FEAS_RANK[a.feasibility]; if (d) return d;
      d = FRIC_RANK[b.friction] - FRIC_RANK[a.friction]; if (d) return d;
      return TIME_RANK[b.time_to_feedback] - TIME_RANK[a.time_to_feedback];
    })
    .slice(0, 5);
  for (const c of sorted) {
    const label = (c.label ?? c.action_id).slice(0, 40).padEnd(42);
    const aff = (c.leverage_affinity ?? 'UNKNOWN').padEnd(12);
    console.log(`    ${label} affinity=${aff} MME=${c.min_meaningful_effect.level.padEnd(11)} friction=${c.friction} ttf=${c.time_to_feedback}`);
  }
} else {
  console.log(`  reason: ${nba.reason}`);
  if (nba.next_best_question) console.log(`  next_best_question: ${nba.next_best_question}`);
}

console.log('\n══════════════════════════════════════════\n');
