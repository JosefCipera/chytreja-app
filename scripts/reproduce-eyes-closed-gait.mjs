// Diagnostic reproduction, not a clinical acceptance test.
// Only user-reported answers are fixtures; no private DB reads or real account IDs.
import assert from 'node:assert/strict';
import { inference } from '../api/engine/inference.js';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';
const action = { id: 'walking-fixture', label: 'Walking fixture', protocol_type: 'KARDIO_PROTOKOL', type: 'timed', duration: 1200, tier: 1, tags: [], constraint_exclude: [], intensity: 'LIGHT' };
function evaluate(physical) {
 const history = { diagnoses: [], clinical_history_documented: true, onboarding_inputs: physical };
 const states = inference([], {}, history, []);
 const nba = computeNextBestAction({ leverageNodeId: 'EXCESS_ADIPOSITY',
 interventions: [{ id: 'AEROBIC_TRAINING', protocol_types: ['KARDIO_PROTOKOL'], mechanism_targets: ['EXCESS_ADIPOSITY'], goal_branches: [] }],
 actionPool: [action], personConstraints: [], clinicalHistory: history,
 decisionGate: { context_gates: [] }, node_states: states, engineVersion: '1.0.0' });
 return { states, nba, decision: computeDailyDecision({ next_best_action: nba, decision_gate: { context_gates: [] } }) };
}
const before = evaluate({ rovnovaha_zavrene_oci: false });
assert.equal(before.states.find(s => s.node_id === 'GAIT_INSTABILITY')?.current_state, 'PREDICTED_CURRENT');
assert.equal(before.decision.mode, 'ASK');
assert.equal(before.decision.primary_item.evidence_type, 'gait_stability');
for (const answer of [true, false, 'Nevím']) {
 const after = evaluate({ rovnovaha_zavrene_oci: false, gait_stability: answer });
 assert.equal(after.states.find(s => s.node_id === 'GAIT_INSTABILITY')?.current_state, 'PREDICTED_CURRENT');
 assert.equal(after.nba.selected, null);
 assert.equal(after.decision.mode, 'SAFETY');
 assert.equal(after.nba.all_candidates[0].safety.level, 'NEEDS_CLINICAL_CLEARANCE');
}
const control = evaluate({ rovnovaha_zavrene_oci: true, gait_stability: true });
assert.equal(control.states.some(s => s.node_id === 'GAIT_INSTABILITY'), false);
assert.equal(control.nba.selected.action_id, action.id);
console.log('REPRODUCED KNOWN ISSUE: eyes-closed answer alone activates predicted gait instability; stable/unstable/unknown walking answers all lead to clearance. Control has no gait blocker. This documents current behavior, not its clinical validity.');
