// Pure regression: synthetic answer fixtures only; no DB, secrets or account IDs.
import assert from 'node:assert/strict';
import { inference } from '../api/engine/inference.js';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';
const action = { id: 'walking-fixture', label: 'Walking fixture', protocol_type: 'KARDIO_PROTOKOL', type: 'timed', duration: 1200, tier: 1, tags: [], constraint_exclude: [], intensity: 'LIGHT' };
function evaluate(physical, activated = [], constraints = []) {
 const history = { diagnoses: [], clinical_history_documented: true, onboarding_inputs: physical };
 const states = [...activated, ...inference(activated, {}, history, [])];
 const nba = computeNextBestAction({ leverageNodeId: 'EXCESS_ADIPOSITY',
 interventions: [{ id: 'AEROBIC_TRAINING', protocol_types: ['KARDIO_PROTOKOL'], mechanism_targets: ['EXCESS_ADIPOSITY'], goal_branches: [] }],
 actionPool: [action], personConstraints: constraints, clinicalHistory: history,
 decisionGate: { context_gates: [] }, node_states: states, engineVersion: '1.0.0' });
 return { states, nba, decision: computeDailyDecision({ next_best_action: nba, decision_gate: { context_gates: [] } }) };
}
const gait = result => result.states.find(s => s.node_id === 'GAIT_INSTABILITY');
for (const physical of [
 { rovnovaha_zavrene_oci: false },
 { rovnovaha_zavrene_oci: false, gait_stability: true },
 { rovnovaha_zavrene_oci: false, gait_stability: 'Ano' },
 { rovnovaha_zavrene_oci: true, gait_stability: true },
]) {
 const result = evaluate(physical);
 assert.equal(gait(result), undefined, 'Eyes-closed answer alone is not ordinary-gait instability');
 assert.equal(result.nba.selected.action_id, action.id, 'No other fixture safety blocker');
 assert.equal(result.decision.mode, 'ACT');
}
for (const physical of [
 { rovnovaha_zavrene_oci: false, gait_stability: false },
 { rovnovaha_zavrene_oci: false, gait_stability: 'Ne' },
 { rovnovaha_zavrene_oci: false, gait_instability_reported: true, gait_stability: true },
 { rovnovaha_zavrene_oci: false, gait_instability_reported: true, gait_stability: 'Nevím' },
 { rovnovaha_zavrene_oci: false, balanc_jedna_noha: false, gait_stability: true },
 { rovnovaha_zavrene_oci: false, recent_falls: true, gait_stability: true },
]) {
 const result = evaluate(physical);
 assert.equal(gait(result)?.current_state, 'PREDICTED_CURRENT');
 assert.equal(result.nba.selected, null, 'A stable answer does not cancel independent adverse evidence');
 assert.equal(result.decision.mode, 'SAFETY');
}
for (const activated of [
 [{ node_id: 'LOW_MUSCLE_STRENGTH', current_state: 'PREDICTED_CURRENT' }],
 [{ node_id: 'PERIPHERAL_NEUROPATHY', current_state: 'CONFIRMED' }],
 [{ node_id: 'GAIT_INSTABILITY', current_state: 'CONFIRMED' }],
]) {
 const result = evaluate({ rovnovaha_zavrene_oci: false, gait_stability: true }, activated);
 assert.ok(gait(result));
 assert.equal(result.nba.selected, null);
 assert.equal(result.decision.mode, 'SAFETY');
}
const unsure = evaluate({ gait_stability: 'Nevím' });
assert.equal(gait(unsure), undefined, 'Uncertainty is not an adverse clinical fact');
const pending = evaluate({ gait_instability_reported: true });
assert.equal(pending.decision.mode, 'ASK');
assert.equal(pending.decision.primary_item.evidence_type, 'gait_stability');
const knee = evaluate({ rovnovaha_zavrene_oci: false, gait_stability: true }, [], [{ constraint_value: 'koleno', severity: null }]);
assert.equal(knee.decision.mode, 'ASK');
assert.equal(knee.decision.primary_item.evidence_type, 'knee_severity');

const floorProxy = [{ node_id: 'LOW_MUSCLE_STRENGTH', current_state: 'MEASURED',
 confidence: 'low', evidence: { direct: [{ question_id: 'vstat_ze_zeme', value: false }] } }];
const stablePhysical = { vstat_ze_zeme: false, rovnovaha_zavrene_oci: false, gait_stability: true, recent_falls: false };
const resolvedProxy = evaluate(stablePhysical, floorProxy);
assert.equal(gait(resolvedProxy), undefined, 'Stable gait and no falls reconcile only indirect floor-rise/eyes-closed proxies');
assert.equal(resolvedProxy.states.find(s => s.node_id === 'LOW_MUSCLE_STRENGTH'), floorProxy[0], 'Strength finding remains intact');
assert.equal(resolvedProxy.decision.mode, 'ACT');
for (const patch of [
 { gait_stability: false }, { gait_stability: 'Nevím' }, { gait_stability: undefined },
 { recent_falls: true }, { recent_falls: undefined }, { gait_instability_reported: true },
 { balanc_jedna_noha: false },
]) {
 const result = evaluate({ ...stablePhysical, ...patch }, floorProxy);
 assert.ok(gait(result), 'Independent adverse or unresolved evidence retains inference');
 assert.equal(result.nba.selected, null);
}
for (const independent of [
 { node_id: 'PERIPHERAL_NEUROPATHY', current_state: 'CONFIRMED' },
 { node_id: 'GAIT_INSTABILITY', current_state: 'CONFIRMED' },
]) {
 const result = evaluate(stablePhysical, [...floorProxy, independent]);
 assert.ok(gait(result)); assert.equal(result.nba.selected, null);
}
const measuredStrength = [{ ...floorProxy[0], evidence: { direct: [{ obs_type: 'grip_strength', value: 10 }] } }];
assert.ok(gait(evaluate(stablePhysical, measuredStrength)), 'Measured strength is not the floor-rise-only proxy');
const joint = evaluate(stablePhysical, floorProxy, [{ constraint_value: 'koleno', severity: 'severe' }]);
assert.equal(joint.nba.selected, null, 'Reconciled gait does not bypass independent joint safety');

console.log('PASS: eyes-closed-only proxy cannot establish gait instability; negative ordinary-gait self-report, independent findings, combined signals and region constraints retain safety. Fixture eligibility is not individual clinical clearance.');
