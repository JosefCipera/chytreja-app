// api/lib/nbq/hypothesisState.js
// Computes hypothesis state from evidence items.
// Stateless — always re-computed from full evidence set.
// Returns {nodeId: status} with no scores and no winner.
// LOCK: never selects root, constraint, leverage, or action.

import { HYPOTHESIS_NODES, EVIDENCE_RULES, STATUSES, ET } from './scenarioEvidenceMap.js';

const { SUPPORTED, POSSIBLE, WEAKENED, UNKNOWN } = STATUSES;

export function computeHypothesisState(evidenceItems) {
  const types = new Set(evidenceItems.map(e => e.type));

  const supportCount = Object.fromEntries(HYPOTHESIS_NODES.map(n => [n, 0]));
  const weakenCount  = Object.fromEntries(HYPOTHESIS_NODES.map(n => [n, 0]));

  for (const [evType, rule] of Object.entries(EVIDENCE_RULES)) {
    if (!types.has(evType)) continue;
    for (const node of rule.supports) if (node in supportCount) supportCount[node]++;
    for (const node of rule.weakens)  if (node in weakenCount)  weakenCount[node]++;
  }

  const state = {};
  for (const node of HYPOTHESIS_NODES) {
    const s = supportCount[node];
    const w = weakenCount[node];
    if (s === 0 && w === 0) state[node] = UNKNOWN;
    else if (w > 0 && s === 0) state[node] = WEAKENED;
    else state[node] = POSSIBLE;
  }

  // Upgrade rule: LOW_VO2MAX → SUPPORTED requires dyspnea AND exertional qualifier.
  // Either alone stays POSSIBLE.
  if (types.has(ET.SELF_REPORTED_DYSPNEA) && types.has(ET.EXERTIONAL_QUALIFIER)) {
    if (state.LOW_VO2MAX !== WEAKENED) {
      state.LOW_VO2MAX = SUPPORTED;
    }
  }

  // Pattern inference: OBESITY POSSIBLE + LOW_VO2MAX POSSIBLE/SUPPORTED
  // → SEDENTARY and INACTIVITY become POSSIBLE if still UNKNOWN.
  // This reflects causal consistency (not causation assignment).
  if (
    (state.OBESITY === POSSIBLE || state.OBESITY === SUPPORTED) &&
    (state.LOW_VO2MAX === POSSIBLE || state.LOW_VO2MAX === SUPPORTED)
  ) {
    if (state.SEDENTARY_LIFESTYLE_ROOT === UNKNOWN) state.SEDENTARY_LIFESTYLE_ROOT = POSSIBLE;
    if (state.INACTIVITY_ROOT          === UNKNOWN) state.INACTIVITY_ROOT          = POSSIBLE;
  }

  return state;
}

// User intention is captured separately — it is NOT a health hypothesis.
export function extractUserIntention(evidenceItems) {
  const types = new Set(evidenceItems.map(e => e.type));
  return types.has(ET.USER_INTENTION_WEIGHT_LOSS) ? 'weight_loss_goal' : null;
}
