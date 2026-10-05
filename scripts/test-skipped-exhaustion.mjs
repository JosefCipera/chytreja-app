import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';

const interventions = JSON.parse(fs.readFileSync(new URL('../data/engine/intervention-map.json', import.meta.url))).mappings.LOW_MUSCLE_STRENGTH.interventions;
const action = { id: 'sit_to_stand_supported', label: 'Vstaň 5× ze židle s oporou.', protocol_type: 'FUNKCNI_SILOVY_PROTOKOL', tags: ['sit_to_stand'], tier: 1, constraint_exclude: [] };
const input = { leverageNodeId: 'LOW_MUSCLE_STRENGTH', interventions, actionPool: [action], personConstraints: [], clinicalHistory: { clinical_history_documented: true, onboarding_inputs: { vstat_ze_zeme: false } }, decisionGate: { context_gates: [] }, node_states: [], engineVersion: '1.0.0' };
const before = computeNextBestAction(input);
assert.equal(before.status, 'SELECTED');
const skipped = computeNextBestAction({ ...input, skippedTodayActionIds: new Set([action.id]) });
const dd = computeDailyDecision({ next_best_action: skipped, decision_gate: input.decisionGate }, '2026-10-05T04:00:00Z');
console.log(JSON.stringify({before: before.status, after: skipped.status, decision: dd}));
assert.equal(dd.reason_code, 'HOLD_SKIPPED_TODAY');
assert.equal(dd.mode, 'HOLD');
assert.equal(dd.reevaluate_after, '2026-10-06');
assert.equal(dd.primary_item, null);
const missingPool = computeDailyDecision({ next_best_action: computeNextBestAction({...input, actionPool: [], skippedTodayActionIds: new Set([action.id])}), decision_gate: input.decisionGate });
assert.equal(missingPool.mode, 'ASK'); // A missing action pool is not skipped exhaustion.
const sibling = computeNextBestAction({...input, actionPool: [action, {...action, id: 'sibling'}], skippedTodayActionIds: new Set([action.id])});
assert.equal(sibling.status, 'SELECTED');
assert.equal(sibling.selected.action_id, 'sibling');
const tomorrow = computeNextBestAction({...input, skippedTodayActionIds: new Set()});
assert.equal(tomorrow.selected.action_id, action.id);
const safety = computeDailyDecision({ next_best_action: skipped, decision_gate: {context_gates: [{ decision_context: {id: 'acute'}, actionable_findings: [{actionability: 'SAFETY_CRITICAL', node_id: 'acute'}] }]} });
assert.equal(safety.mode, 'SAFETY');
console.log('PASS: skip exhaustion, sibling alternative, tomorrow, empty pool, safety priority.');
