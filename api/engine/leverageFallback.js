// Availability policy, not new clinical inference. Every alternative is evaluated
// by the existing NBA and Daily Decision with the same person/safety/exposure data.
import { computeDailyDecision } from './dailyDecision.js';
const rank = { none: 0, low: 1, medium: 2, high: 3 };
export async function findAvailableLeverage({ systemLeverage, primaryNba, decisionGate, responseEvaluations, interventionExposure, mappings, evaluate }) {
  const primaryDecision = computeDailyDecision({ decision_gate: decisionGate, next_best_action: primaryNba,
    response_evaluations: responseEvaluations, intervention_exposure: interventionExposure });
  const none = { actionLeverage: systemLeverage, nba: primaryNba, fallback: null };
  // Never reinterpret missing evidence, a crisis, an existing ACT, completion or skip as availability.
  if (primaryDecision.reason_code !== 'SAFETY_BLOCKED' || !systemLeverage.selected) return none;
  const primaryId = systemLeverage.selected.node_id;
  const candidates = (systemLeverage.candidates ?? []).filter(c => c.node_id !== primaryId
    && ['CONFIRMED', 'MEASURED', 'PREDICTED_CURRENT'].includes(c.current_state)
    && ['low', 'medium', 'high'].includes(c.causal_reach?.level) && mappings[c.node_id]?.interventions?.length)
    .sort((a, b) => (rank[b.cross_context_leverage?.level] ?? 0) - (rank[a.cross_context_leverage?.level] ?? 0)
      || (rank[b.causal_reach?.level] ?? 0) - (rank[a.causal_reach?.level] ?? 0)
      || (rank[b.changeability] ?? 0) - (rank[a.changeability] ?? 0));
  const attempts = [];
  for (const candidate of candidates) {
    const nba = await evaluate(candidate.node_id, mappings[candidate.node_id]);
    const dd = computeDailyDecision({ decision_gate: decisionGate, next_best_action: nba,
      response_evaluations: responseEvaluations, intervention_exposure: interventionExposure });
    attempts.push({ node_id: candidate.node_id, mode: dd.mode, reason_code: dd.reason_code, action_id: nba.selected?.action_id ?? null });
    // A completed/skipped alternative ends today's offer; do not hop to another branch.
    const viable = ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(nba.selected?.safety?.level);
    if (!(dd.mode === 'ACT' && viable)
        && !(dd.reason_code === 'HOLD_DONE_TODAY' && viable)
        && dd.reason_code !== 'HOLD_SKIPPED_TODAY') continue;
    const actionLeverage = { ...systemLeverage,
      selected: { node_id: candidate.node_id, current_state: candidate.current_state, confidence: candidate.confidence },
      selection_basis: { safety_override: false, threat: candidate.threat, time_sensitivity: candidate.time_sensitivity,
        causal_reach: candidate.causal_reach, cross_context_leverage: candidate.cross_context_leverage, changeability: candidate.changeability },
      affected_contexts: candidate.cross_context_leverage?.contexts ?? [],
      explanation: `Available action branch ${candidate.node_id}; primary ${primaryId} remains assessment-blocked.` };
    return { actionLeverage, nba, fallback: { status: 'SELECTED', primary_node_id: primaryId,
      selected_node_id: candidate.node_id, primary_decision: primaryDecision, attempts } };
  }
  return { ...none, fallback: { status: 'UNAVAILABLE', primary_node_id: primaryId,
    selected_node_id: null, primary_decision: primaryDecision, attempts } };
}
