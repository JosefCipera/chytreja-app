import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';

const map = JSON.parse(fs.readFileSync(new URL('../data/engine/intervention-map.json', import.meta.url), 'utf8')).mappings;
const row = { id: 'fixture-press', label: 'Fixed load', protocol_type: 'SILOVY_PROTOKOL', type: 'reps', reps: 10, tier: 1, tags: ['sila'], constraint_exclude: [], intensity: 'LIGHT' };
function run(node, interventions, extra = {}) {
  return computeNextBestAction({ leverageNodeId: node, interventions, actionPool: [row], personConstraints: [], clinicalHistory: { clinical_history_documented: true }, decisionGate: { context_gates: [] }, node_states: [], engineVersion: '1.0.0', ...extra });
}
const original = structuredClone(map.PHYSICAL_INACTIVITY.interventions);
assert.equal(run('PHYSICAL_INACTIVITY', original).selected.action_id, row.id, 'Absent allowlist preserves existing intervention contract');
const resistance = original.find(i => i.id === 'RESISTANCE_TRAINING');
resistance.allowed_action_ids = [];
assert.equal(run('PHYSICAL_INACTIVITY', original).selected, null, 'Empty is not unrestricted');
resistance.allowed_action_ids = [row.id];
assert.equal(run('PHYSICAL_INACTIVITY', original).selected.action_id, row.id, 'Explicit reviewed bridge permits the action');
resistance.allowed_action_ids = ['another-action'];
assert.equal(run('PHYSICAL_INACTIVITY', original).selected, null);
resistance.allowed_action_ids = [row.id];
assert.equal(run('PHYSICAL_INACTIVITY', original, { actionPool: [{ ...row, constraint_exclude: ['shoulder'] }], personConstraints: [{ constraint_value: 'rameno', severity: 'severe' }] }).selected, null, 'Allowlist must not override safety');
for (const id of ['shoulder_press_light', 'shoulder_press_med', 'step_down']) {
  const result = run('EXCESS_ADIPOSITY', map.EXCESS_ADIPOSITY.interventions, { actionPool: [{ ...row, id }] });
  assert.equal(result.selected, null, id);
  assert.equal(result.all_candidates.length, 0, 'Deferred catalog mapping is not a clinical contraindication');
}
assert.equal(run('PHYSICAL_INACTIVITY', map.PHYSICAL_INACTIVITY.interventions).selected.action_id, row.id, 'Restriction is target-specific');
console.log('PASS: optional reviewed action bridge, empty/nonempty lists, safety precedence, three deferred adiposity rows and unchanged other target.');
