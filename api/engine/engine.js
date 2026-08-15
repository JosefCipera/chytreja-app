// engine.js — CHJ Health Engine v1 main pipeline
//
// Pipeline:
//   fetchHealthData(userId)     → {person, clinicalHistory, observations}
//   activation()                → PERSON_NODE_STATE[] (CONFIRMED + MEASURED)
//   inference()                 → + PERSON_NODE_STATE[] (PREDICTED_CURRENT + UNKNOWN)
//   computeProjections()        → PERSON_PROJECTION[] (separate entity, M:N to node_states)
//   buildInformationNeeds()     → INFORMATION_NEED[] (deduplicated, annotated missing evidence)
//   evaluateDecisionGate()      → DECISION_GATE per context (EVIDENCE_SUFFICIENT | NEED_MORE_EVIDENCE)
//                                 each context_gate includes next_best_evidence if NEED_MORE_EVIDENCE
//
// PERSON_NODE_STATE  = current state of the person (no future_projection field)
// PERSON_PROJECTION  = future risk projection (separate entity, may reference multiple node_states)
// INFORMATION_NEED   = deduplicated missing evidence candidate with impact/cost annotation
// DECISION_GATE      = { context_gates[], any_context_action_ready, contexts_needing_evidence }
// NEXT_BEST_EVIDENCE = per context_gate (null when gate=EVIDENCE_SUFFICIENT)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchHealthData, fetchActionPool, fetchPersonConstraints, fetchActionAssignments } from './adapter.js';
import { activation }                from './activation.js';
import { inference }                 from './inference.js';
import { computeProjections }        from './projections.js';
import { buildInformationNeeds, mergeResponseNeeds } from './informationNeeds.js';
import { evaluateDecisionGate }      from './decisionGate.js';
import { computeSystemLeverage }     from './systemLeverage.js';
import { computeSystemConstraint }   from './systemConstraint.js';
import { computeNextBestAction }     from './nextBestAction.js';
import { computeInterventionExposure, evaluateResponseEvaluations, buildResponseInformationNeeds } from './adherence.js';
// selectNextBestEvidence is now called inside decisionGate.js per context

const _dir = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8'));
const INTERVENTION_MAP = JSON.parse(readFileSync(join(_dir, '../../data/engine/intervention-map.json'), 'utf8'));

export const ENGINE_VERSION = '1.0.0';
export const ENGINE_MASTER  = MASTER;

export async function runEngine(userId) {
  const { person, clinicalHistory, observations } = await fetchHealthData(userId);

  const activated  = activation(person, clinicalHistory, observations);
  const inferred   = inference(activated, person, clinicalHistory, observations);
  const allStates  = [...activated, ...inferred];

  const now = new Date().toISOString();

  const node_states = allStates.map(s => ({
    person_id:          userId,
    node_id:            s.node_id,
    current_state:      s.current_state,
    confidence:         s.confidence,
    evidence:           s.evidence,
    missing_evidence:   s.missing_evidence || [],
    evaluated_at:       now,
    engine_version:     ENGINE_VERSION,
    decision_relevance: null,
  }));

  const projections = computeProjections(allStates, person, clinicalHistory).map(p => ({
    person_id:      userId,
    ...p,
    evaluated_at:   now,
    engine_version: ENGINE_VERSION,
  }));

  const information_needs_base = buildInformationNeeds(node_states, projections);

  // decision_gate contains per-context CONTEXT_DECISION_GATE[] with embedded next_best_evidence.
  // Global aggregate: any_context_action_ready + contexts_needing_evidence.
  const decision_gate     = evaluateDecisionGate(node_states, projections, information_needs_base, ENGINE_VERSION);
  const system_leverage   = computeSystemLeverage(node_states, projections, decision_gate, ENGINE_VERSION);
  const system_constraint = computeSystemConstraint(node_states, projections, decision_gate, ENGINE_VERSION);

  // NEXT_BEST_ACTION — only when a leverage node is identified and has an intervention map
  const leverageNodeId   = system_leverage.selected?.node_id ?? null;
  const interventionData = leverageNodeId ? INTERVENTION_MAP.mappings?.[leverageNodeId] : null;

  let next_best_action      = { status: 'NOT_COMPUTED', reason: `No intervention map for leverage node: ${leverageNodeId ?? 'none'}` };
  let intervention_exposure = [];
  let response_evaluations  = [];

  // ── Feedback Loop v0.1 ──────────────────────────────────────────────────────
  // Fetch action_assignments regardless of interventionData (exposure may exist
  // from a previous leverage node selection).
  const actionAssignments = await fetchActionAssignments(userId, 30);
  intervention_exposure   = computeInterventionExposure(actionAssignments);

  // action_ids skipped today are ineligible for the remainder of the current day
  const today = new Date().toISOString().slice(0, 10);
  const skippedTodayActionIds = new Set(
    actionAssignments
      .filter(a => a.status === 'SKIPPED' && a.assigned_date === today)
      .map(a => a.action_id)
  );
  response_evaluations    = evaluateResponseEvaluations(
    intervention_exposure, INTERVENTION_MAP, observations, actionAssignments
  );

  // Merge INSUFFICIENT_OBSERVATION findings into information_needs
  const response_info_needs = buildResponseInformationNeeds(response_evaluations);
  const information_needs   = mergeResponseNeeds(information_needs_base, response_info_needs);

  if (interventionData) {
    const allProtocolTypes = [...new Set(interventionData.interventions.flatMap(i => i.protocol_types))];
    const [actionPool, personConstraints] = await Promise.all([
      fetchActionPool(allProtocolTypes),
      fetchPersonConstraints(userId),
    ]);
    next_best_action = computeNextBestAction({
      leverageNodeId,
      interventions:        interventionData.interventions,
      actionPool,
      personConstraints,
      clinicalHistory,
      decisionGate:         decision_gate,
      node_states,
      engineVersion:        ENGINE_VERSION,
      responseHistory:      response_evaluations,
      skippedTodayActionIds,
    });
  }

  return {
    person,
    engine_version:       ENGINE_VERSION,
    evaluated_at:         now,
    node_states,
    projections,
    information_needs,
    decision_gate,
    system_leverage,
    system_constraint,
    next_best_action,
    intervention_exposure,
    response_evaluations,
  };
}
