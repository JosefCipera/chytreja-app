import assert from 'node:assert/strict';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';
const action = { id: 'walking-fixture', label: 'Walking', protocol_type: 'KARDIO_PROTOKOL', type: 'timed', duration: 20, tier: 1, tags: [], constraint_exclude: [], intensity: 'LIGHT' };
const input = { leverageNodeId: 'EXCESS_ADIPOSITY', interventions: [{ id: 'AEROBIC_TRAINING', protocol_types: ['KARDIO_PROTOKOL'], mechanism_targets: ['EXCESS_ADIPOSITY'], goal_branches: [] }], actionPool: [action], personConstraints: [], clinicalHistory: { clinical_history_documented: true, onboarding_inputs: {} }, decisionGate: { context_gates: [] }, node_states: [{ node_id: 'GAIT_INSTABILITY', current_state: 'PREDICTED_CURRENT' }], engineVersion: '1.0.0' };
const nba = patch => computeNextBestAction({ ...input, ...patch });
const dd = result => computeDailyDecision({ next_best_action: result, decision_gate: input.decisionGate });
const first = dd(nba({}));
assert.equal(first.mode, 'ASK');
assert.equal(first.primary_item.evidence_type, 'gait_stability');
assert.equal(first.primary_item.question, 'Cítíš se při běžné chůzi stabilně?');
for (const value of [true, false, 'Ano', 'Ne']) {
 const result = nba({ clinicalHistory: { clinical_history_documented: true, onboarding_inputs: { gait_stability: value } } });
 assert.equal(result.selected, null);
 assert.equal(result.all_candidates[0].safety.level, 'NEEDS_CLINICAL_CLEARANCE');
 assert.equal(dd(result).mode, 'SAFETY');
 assert.equal(dd(result).primary_item?.evidence_type, undefined);
}
const unavailable = nba({ clinicalHistory: { clinical_history_documented: true, onboarding_inputs: {}, evidence_availability: { gait_stability: 'NOT_AVAILABLE' } } });
assert.equal(dd(unavailable).mode, 'SAFETY', 'Unavailable is dialogue resolution, not clearance');
assert.equal(nba({ node_states: [] }).selected.action_id, action.id, 'No active gait finding preserves ordinary walking eligibility');
const knee = dd(nba({ node_states: [], personConstraints: [{ constraint_value: 'koleno', severity: null }] }));
assert.equal(knee.mode, 'ASK');
assert.equal(knee.primary_item.evidence_type, 'knee_severity');
assert.match(knee.primary_item.question, /koleno/);
console.log('PASS: typed blocking questions survive DD; four answered gait variants and unavailable stop repetition without clearance; knee and ordinary walking remain distinct.');
