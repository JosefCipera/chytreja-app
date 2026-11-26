// Regression contract: a directly reported limitation of everyday strength determines
// today's action even when EXCESS_ADIPOSITY remains the broader systemic leverage.
import assert from 'node:assert/strict';
import { findAvailableLeverage } from '../api/engine/dailyDecision.js';

const strengthCandidate = evidence => ({
  node_id: 'LOW_MUSCLE_STRENGTH', current_state: 'MEASURED', confidence: 'medium',
  threat: 'medium', time_sensitivity: 'medium', changeability: 'high',
  causal_reach: { level: 'medium', affected_nodes: ['REDUCED_FUNCTIONAL_RESERVE'] },
  cross_context_leverage: { level: 'low', contexts: ['LONGEVITY_FUNCTION'] },
  evidence,
});
const adiposityCandidate = {
  node_id: 'EXCESS_ADIPOSITY', current_state: 'MEASURED', confidence: 'medium',
  threat: 'medium', time_sensitivity: 'medium', changeability: 'high',
  causal_reach: { level: 'high', affected_nodes: ['INSULIN_RESISTANCE'] },
  cross_context_leverage: { level: 'medium', contexts: ['METABOLIC_STATE'] }, evidence: [],
};
const primaryNba = { status: 'SELECTED', selected: {
  action_id: 'walk', intervention_id: 'AEROBIC_TRAINING', label: 'Chůze', safety: { level: 'SAFE' },
}, all_candidates: [] };
const strengthNba = { status: 'SELECTED', selected: {
  action_id: 'sit_to_stand_supported', intervention_id: 'FUNCTIONAL_STRENGTH_TRAINING',
  label: 'Vstávání ze židle', safety: { level: 'SAFE' },
}, all_candidates: [] };
const mappings = { LOW_MUSCLE_STRENGTH: { interventions: [{ id: 'FUNCTIONAL_STRENGTH_TRAINING' }] } };

async function choose(evidence, { selectedNode = 'EXCESS_ADIPOSITY', alternativeNba = strengthNba } = {}) {
  const systemLeverage = {
    status: 'IDENTIFIED',
    selected: { node_id: selectedNode, current_state: 'MEASURED', confidence: 'medium' },
    candidates: [adiposityCandidate, strengthCandidate(evidence)],
    selection_basis: {}, affected_contexts: ['METABOLIC_STATE'],
  };
  return findAvailableLeverage({
    systemLeverage, primaryNba, decisionGate: { context_gates: [] },
    responseEvaluations: [], interventionExposure: [], mappings,
    evaluate: async () => alternativeNba,
  });
}

for (const value of [false, 'Ne.', 'no']) {
  const result = await choose([{ source: 'ONBOARDING', question_id: 'vstat_ze_zeme', value }]);
  assert.equal(result.actionLeverage.selected.node_id, 'LOW_MUSCLE_STRENGTH');
  assert.equal(result.nba.selected.action_id, 'sit_to_stand_supported');
  assert.equal(result.fallback, null);
}

const threeLimitations = await choose([
  { source: 'ONBOARDING', question_id: 'vstat_ze_zeme', value: false },
  { source: 'ONBOARDING', question_id: 'zvednout_vnouce', value: false },
  { source: 'ONBOARDING', question_id: 'vynest_nakup', value: false },
]);
assert.equal(threeLimitations.nba.selected.action_id, 'sit_to_stand_supported');

const noLimitation = await choose([
  { source: 'ONBOARDING', question_id: 'vstat_ze_zeme', value: true },
]);
assert.equal(noLimitation.actionLeverage.selected.node_id, 'EXCESS_ADIPOSITY');
assert.equal(noLimitation.nba.selected.action_id, 'walk');

const otherSystemicPriority = await choose([
  { source: 'ONBOARDING', question_id: 'vstat_ze_zeme', value: false },
], { selectedNode: 'HYPERTENSION' });
assert.equal(otherSystemicPriority.actionLeverage.selected.node_id, 'HYPERTENSION');
assert.equal(otherSystemicPriority.nba.selected.action_id, 'walk');

const unsafeStrength = await choose([
  { source: 'ONBOARDING', question_id: 'vstat_ze_zeme', value: false },
], { alternativeNba: { status: 'SAFETY_BLOCKED', selected: null,
  all_candidates: [{ safety: { level: 'NEEDS_CLINICAL_CLEARANCE' } }] } });
assert.equal(unsafeStrength.actionLeverage.selected.node_id, 'EXCESS_ADIPOSITY');
assert.equal(unsafeStrength.nba.selected.action_id, 'walk');

console.log('PASS: direct functional-strength limitation outranks adiposity for today without changing systemic leverage or safety.');
