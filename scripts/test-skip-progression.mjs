import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';

const interventions = JSON.parse(fs.readFileSync(new URL('../data/engine/intervention-map.json', import.meta.url), 'utf8')).mappings.LOW_MUSCLE_STRENGTH.interventions;
const action = (id, tier) => ({ id, tier, label: id, protocol_type: 'FUNKCNI_SILOVY_PROTOKOL', type: 'reps', reps: 5, tags: ['nohy', 'sit_to_stand'], constraint_exclude: [], intensity: 'LIGHT' });
const starter = action('starter', 1), same = action('same', 1), advanced = action('advanced', 2);
const input = { leverageNodeId: 'LOW_MUSCLE_STRENGTH', interventions, actionPool: [starter, same, advanced], personConstraints: [], clinicalHistory: { clinical_history_documented: true, onboarding_inputs: { vstat_ze_zeme: false } }, decisionGate: { context_gates: [] }, node_states: [], engineVersion: '1.0.0' };
const run = patch => computeNextBestAction({ ...input, ...patch });
const daily = nba => computeDailyDecision({ next_best_action: nba, decision_gate: input.decisionGate }, '2026-10-07T09:00:00Z');
const before = run({});
assert.equal(before.selected.action_id, run({ skippedTodayActionIds: new Set() }).selected.action_id);
const oneSkip = run({ skippedTodayActionIds: new Set(['starter']) });
assert.equal(oneSkip.selected.action_id, 'same');
assert.ok(!oneSkip.all_candidates.some(c => c.action_id === 'advanced'));
assert.ok(oneSkip.progression_policy.deferred_action_ids.includes('advanced'));
const exhausted = run({ skippedTodayActionIds: new Set(['starter', 'same']) });
assert.equal(exhausted.status, 'NO_CANDIDATES');
assert.equal(daily(exhausted).reason_code, 'HOLD_SKIPPED_TODAY');
assert.equal(daily(exhausted).reevaluate_after, '2026-10-08');
assert.equal(run({ skippedTodayActionIds: new Set() }).selected.action_id, before.selected.action_id);

const high = action('high', 3), medium = action('medium', 2);
const lower = run({ actionPool: [starter, medium, high], skippedTodayActionIds: new Set(['medium']) });
assert.equal(lower.selected.action_id, 'starter');
assert.deepEqual(lower.progression_policy.tier_ceilings, { FUNCTIONAL_STRENGTH_TRAINING: 2 });
const unknown = run({ actionPool: [action('unknown', null), same], skippedTodayActionIds: new Set(['unknown']) });
assert.equal(unknown.selected, null); // A missing dose/tier is not permission to progress.
const unknownAlternative = run({ actionPool: [starter, action('unknown-alternative', null)], skippedTodayActionIds: new Set(['starter']) });
assert.equal(unknownAlternative.selected, null);

const other = { ...action('other', 3), protocol_type: 'MOBILITY_PROTOKOL' };
const unrelated = run({ actionPool: [starter, other], interventions: [...interventions, { id: 'OTHER_INTERVENTION', protocol_types: ['MOBILITY_PROTOKOL'], mechanism_targets: ['LOW_MUSCLE_STRENGTH'], goal_branches: [] }], skippedTodayActionIds: new Set(['starter']) });
assert.ok(unrelated.all_candidates.some(c => c.action_id === 'other')); // Ceilings are intervention-local.

const evidenceOnly = { ...action('assess', 1), constraint_exclude: [], intensity: 'HIGH_INTENSITY_INTERVAL' };
const noBaseline = run({ actionPool: [starter, evidenceOnly], clinicalHistory: { clinical_history_documented: false, onboarding_inputs: {} }, skippedTodayActionIds: new Set(['starter']) });
assert.equal(noBaseline.status, 'NO_CANDIDATES');
assert.equal(noBaseline.all_candidates[0].safety.level, 'NEEDS_MORE_EVIDENCE');
assert.equal(daily(noBaseline).mode, 'HOLD'); // No irrelevant assessment loop after available actions were declined.

const severe = run({ personConstraints: [{ constraint_value: 'koleno', severity: 'severe' }], skippedTodayActionIds: new Set(['starter']) });
assert.equal(daily(severe).mode, 'SAFETY'); // Fresh safety facts still take priority.
const unknownSeverity = run({ personConstraints: [{ constraint_value: 'koleno', severity: null }], skippedTodayActionIds: new Set(['starter']) });
assert.equal(daily(unknownSeverity).mode, 'ASK'); // New necessary evidence is not hidden by exhaustion.
const acute = computeDailyDecision({ next_best_action: exhausted, decision_gate: { context_gates: [{ decision_context: { id: 'acute' }, actionable_findings: [{ actionability: 'SAFETY_CRITICAL', node_id: 'acute' }] }] } });
assert.equal(acute.mode, 'SAFETY');
assert.equal(daily(run({ actionPool: [], skippedTodayActionIds: new Set(['starter']) })).mode, 'ASK');
console.log('PASS: same/lower-tier alternatives, exhaustion, next-day reset, unknown tiers, intervention-local ceiling, evidence-only remainder, safety and necessary-evidence priority.');
