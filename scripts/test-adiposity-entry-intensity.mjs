import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
const mappings = JSON.parse(fs.readFileSync(new URL('../data/engine/intervention-map.json', import.meta.url), 'utf8')).mappings;
const row = (id, intensity, tier = 1) => ({ id, label: id, protocol_type: 'KARDIO_PROTOKOL', type: 'timed', duration: 1200, tier, intensity, tags: [], constraint_exclude: [] });
const input = { leverageNodeId: 'EXCESS_ADIPOSITY', interventions: mappings.EXCESS_ADIPOSITY.interventions, actionPool: [row('vigorous', 'VIGOROUS'), row('moderate', 'MODERATE')], personConstraints: [], clinicalHistory: { clinical_history_documented: true }, decisionGate: { context_gates: [] }, node_states: [], engineVersion: '1.0.0' };
const run = patch => computeNextBestAction({ ...input, ...patch });
assert.equal(run({}).selected.action_id, 'moderate', 'An existing empty health row is not permission for a vigorous adiposity entry action');
for (const intensity of ['VIGOROUS', 'HIGH_INTENSITY_INTERVAL', null, 'unrecognized']) {
 const r = run({ actionPool: [row('deferred', intensity)] });
 assert.equal(r.selected, null);
 assert.equal(r.all_candidates.length, 0, 'Product deferral must not invent a clinical contraindication');
}
for (const intensity of ['LIGHT', 'MODERATE']) assert.equal(run({ actionPool: [row('eligible', intensity)] }).selected.action_id, 'eligible');
assert.equal(run({ actionPool: [{ ...row('unsafe', 'MODERATE'), constraint_exclude: ['knee'] }], personConstraints: [{ constraint_value: 'koleno', severity: 'severe' }] }).selected, null, 'Intensity whitelist never overrides safety');
assert.equal(run({ skippedTodayActionIds: new Set(['moderate']) }).selected, null, 'Skip cannot reveal deferred vigorous sibling');
assert.equal(run({ leverageNodeId: 'PHYSICAL_INACTIVITY', interventions: mappings.PHYSICAL_INACTIVITY.interventions, actionPool: [row('other-target', 'VIGOROUS')] }).selected.action_id, 'other-target', 'Other targets retain their existing contract; not a clinical approval');
console.log('PASS: conservative adiposity intensity admission, missing intensity, safety precedence, skip and target isolation.');
