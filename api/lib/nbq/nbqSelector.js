// api/lib/nbq/nbqSelector.js
// Selects the next INFORMATION_NEED or terminates with STOP_QUESTIONING.
//
// Selection rules (in order):
//   Rule A: Emergency (existing isEmergency — unchanged) → URGENT_EXIT
//   Rule 0: No specific hypothesis evidence yet → OPEN_INFORMATION_NEED
//   Rule B: Find causal information need that can change a POSSIBLE/SUPPORTED hypothesis
//   Rule C: No such need exists → STOP_QUESTIONING
//
// LOCK: selector NEVER selects root cause, constraint, leverage, or action.
// LOCK: no new medicinal soft-safety rules — only existing isEmergency() (LOCK 2).

import { INFORMATION_NEEDS, STATUSES } from './scenarioEvidenceMap.js';
import { resolveInformationNeed, needPrerequisiteMet } from './evidenceResolver.js';
import { isEmergency } from '../../pre-intake.js';

const { POSSIBLE, SUPPORTED } = STATUSES;

// Returns one of:
//   { outcome: 'URGENT_EXIT' }
//   { outcome: 'OPEN_INFORMATION_NEED' }
//   { outcome: 'ASK', information_need: string }
//   { outcome: 'STOP_QUESTIONING' }
export function selectInformationNeed(lastUserText, hypothesisState, evidenceTypes, knownFacts) {
  // Rule A: deterministic emergency check (existing logic, unchanged)
  if (isEmergency(lastUserText)) {
    return { outcome: 'URGENT_EXIT' };
  }

  // Rule 0: if no hypothesis node has specific evidence yet, we cannot identify
  // a targeted information need — signal open question strategy.
  const hasSpecificEvidence = Object.values(hypothesisState).some(
    s => s === POSSIBLE || s === SUPPORTED,
  );
  if (!hasSpecificEvidence) {
    return { outcome: 'OPEN_INFORMATION_NEED' };
  }

  // Rule B: find causal information needs whose resolution changes a POSSIBLE/SUPPORTED node.
  const candidates = [];
  for (const [needKey, need] of Object.entries(INFORMATION_NEEDS)) {
    if (!needPrerequisiteMet(needKey, evidenceTypes)) continue;

    const resolved = resolveInformationNeed(needKey, evidenceTypes, knownFacts);
    if (resolved.known) continue;

    // canChange: [] means this need has no causal hypothesis impact in v1.
    const canChangeDecision = need.canChange.some(
      nodeId => hypothesisState[nodeId] === POSSIBLE || hypothesisState[nodeId] === SUPPORTED,
    );
    if (canChangeDecision) candidates.push(needKey);
  }

  if (candidates.length > 0) {
    // Sort by priority (lowest number = highest priority = asked first).
    // Priority is explicitly encoded in scenarioEvidenceMap — not mathematical scoring.
    candidates.sort(
      (a, b) => (INFORMATION_NEEDS[a].priority ?? 99) - (INFORMATION_NEEDS[b].priority ?? 99),
    );
    return { outcome: 'ASK', information_need: candidates[0] };
  }

  // Rule C: no decision-changing unknown remains
  return { outcome: 'STOP_QUESTIONING' };
}
