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
  console.log(`  │  effect_leverage: ${s.effect_on_leverage}`);
  console.log(`  │  goal_impact:     ${s.goal_impact.branches.join(', ')}`);
  console.log(`  │  feasibility:     ${s.feasibility}`);
  console.log(`  │  friction:        ${s.friction}`);
  console.log(`  │  time_to_feedback:${s.time_to_feedback}`);
  console.log(`  └────`);

  console.log(`\n  CV risk context:   ${nba.cv_risk_context}`);
  console.log(`  Parsed constraints: ${JSON.stringify(nba.parsed_constraints)}`);
  console.log(`  Viable / non-viable: ${nba.viable_count} / ${nba.non_viable_count}`);

  console.log('\n  Top 5 by selection order:');
  const ranked = [...nba.all_candidates]
    .filter(c => ['SAFE','SAFE_WITH_MODIFICATION'].includes(c.safety.level))
    .slice(0, 5);
  for (const c of ranked) {
    console.log(`    ${c.action_id.padEnd(28)} safety=${c.safety.level.padEnd(24)} MME=${c.min_meaningful_effect.level.padEnd(11)} friction=${c.friction}`);
  }
} else {
  console.log(`  reason: ${nba.reason}`);
  if (nba.next_best_question) console.log(`  next_best_question: ${nba.next_best_question}`);
}

console.log('\n══════════════════════════════════════════\n');
