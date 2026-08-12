// systemLeverage.js — SYSTEM_LEVERAGE v0.1 (Engine v1)
//
// Identifies the most leveraged, changeable, currently active mechanism
// whose improvement has the highest potential to advance the whole person's
// system toward health and long-term functional independence.
//
// NOT "the worst decision context." A specific MASTER_NODE / mechanism.
// NOT a TOC constraint — this algorithm finds the current ovlivnitelný node
// with the highest causal and cross-context leverage. TOC constraint
// identification requires additional throughput analysis (future layer).
//
// Pipeline position: after decisionGate (reads activeContextIds from gate output).
//
// LEVERAGE_CANDIDATE rules:
//   CONFIRMED + MEASURED + PREDICTED_CURRENT → candidate
//   UNKNOWN → not a candidate
//   PERSON_PROJECTION → not a candidate (downstream risk signal, not upstream mechanism)
//
// Causal reach rules:
//   Only CAUSES + CONTRIBUTES_TO edges create causal reach.
//   RISK_MARKER_FOR does NOT — "treating ED does not causally reduce CVD risk."
//
// Selection: ordinal comparison (no numeric weighted score):
//   1. Safety override — SAFETY_CRITICAL in any gate → leverage defers to safety
//   2. Eliminate zero-causal-reach candidates (no systemic leverage)
//   3. Eliminate candidates with unmodeled causal paths (flag as missing_model_elements)
//   4. Rank: cross_context_leverage → causal_reach → changeability
//   5. Minimum changeability: 'medium' preferred; 'low'/'unknown' = fallback only
//
// Engine may return status: INSUFFICIENT_MODEL — better than false certainty.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const _dir   = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8'));

// --- Constants ---

const CANDIDATE_STATES = new Set(['CONFIRMED', 'MEASURED', 'PREDICTED_CURRENT']);
const CAUSAL_RELATIONS  = new Set(['CAUSES', 'CONTRIBUTES_TO']);

// Mirrors decisionGate.js context membership — must stay in sync.
const CONTEXT_MEMBERSHIP = {
  CURRENT_CV_STATE:   new Set(['HYPERTENSION', 'ENDOTHELIAL_DYSFUNCTION', 'ERECTILE_DYSFUNCTION', 'ATRIAL_FIBRILLATION', 'DYSLIPIDEMIA']),
  METABOLIC_STATE:    new Set(['EXCESS_ADIPOSITY', 'INSULIN_RESISTANCE']),
  LONGEVITY_FUNCTION: new Set(['PHYSICAL_INACTIVITY', 'PHYSICAL_DECONDITIONING', 'LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE', 'LOSS_OF_FLOOR_RISE_ABILITY']),
};

const LEVERAGE_RANK = { high: 3, medium: 2, low: 1, none: 0 };
const CHANGE_RANK   = { high: 3, medium: 2, low: 1, unknown: 0 };

// --- Causal graph (CAUSES + CONTRIBUTES_TO only) ---

function buildCausalGraph() {
  const graph = {};
  for (const edge of MASTER.edges) {
    if (!CAUSAL_RELATIONS.has(edge.relation)) continue;
    if (!graph[edge.from]) graph[edge.from] = [];
    graph[edge.from].push(edge);
  }
  return graph;
}

// --- BFS downstream causal reach ---

function computeCausalReach(nodeId, graph, projections) {
  const visited   = new Set();
  const edgesUsed = [];
  const queue     = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of (graph[current] ?? [])) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        edgesUsed.push({ from: edge.from, to: edge.to, relation: edge.relation, edge_id: edge.id });
        queue.push(edge.to);
      }
    }
  }

  const affectedNodes = [...visited];

  // Projections whose target is reachable via causal chain
  const affectedProjections = projections
    .filter(p => visited.has(p.target_node_id))
    .map(p => ({ target: p.target_node_id, risk: p.risk, confidence: p.confidence }));

  const level = affectedNodes.length >= 5 ? 'high'
              : affectedNodes.length >= 2 ? 'medium'
              : affectedNodes.length >= 1 ? 'low'
              : 'none';

  return { level, affected_nodes: affectedNodes, affected_projections: affectedProjections, edges_used: edgesUsed };
}

// --- Cross-context leverage ---
// Counts contexts touched by the candidate itself + its causal downstream.

function computeCrossContextLeverage(nodeId, affectedNodes, activeContextIds) {
  const affectedSet = new Set(affectedNodes);
  const contexts    = [];

  for (const [ctxId, members] of Object.entries(CONTEXT_MEMBERSHIP)) {
    if (!activeContextIds.has(ctxId)) continue;
    if (members.has(nodeId) || [...affectedSet].some(n => members.has(n))) {
      contexts.push(ctxId);
    }
  }

  const level = contexts.length >= 3 ? 'high'
              : contexts.length === 2 ? 'medium'
              : contexts.length === 1 ? 'low'
              : 'none';

  return { level, contexts };
}

// --- Threat ---
// CONFIRMED CV/metabolic disease or functional outcome → high.
// PREDICTED_CURRENT from a CONFIRMED CV upstream → high.
// All others → medium. UNKNOWN states not candidates.

function computeThreat(state, nodeStates) {
  const { node_id, current_state } = state;
  const mn = MASTER.nodes.find(n => n.id === node_id);

  if (current_state === 'CONFIRMED') {
    if (mn?.domain === 'cardiovascular' || mn?.domain === 'metabolic') return 'high';
    if (mn?.category === 'functional_outcome') return 'high';
    return 'medium';
  }
  if (current_state === 'MEASURED') return 'medium';
  if (current_state === 'PREDICTED_CURRENT') {
    const upstreamIds = state.evidence?.inferred_from_nodes ?? [];
    const hasConfirmedCVUpstream = upstreamIds.some(uid => {
      const us = nodeStates.find(s => s.node_id === uid);
      const um = MASTER.nodes.find(n => n.id === uid);
      return us?.current_state === 'CONFIRMED' && um?.domain === 'cardiovascular';
    });
    if (hasConfirmedCVUpstream && mn?.domain === 'cardiovascular') return 'high';
    return 'medium';
  }
  return 'low';
}

// --- Time sensitivity ---
// CONFIRMED CV → high (ongoing vascular damage).
// PREDICTED_CURRENT from CONFIRMED CV upstream → high.
// All others → medium.

function computeTimeSensitivity(state, nodeStates) {
  const { node_id, current_state } = state;
  const mn = MASTER.nodes.find(n => n.id === node_id);

  if (current_state === 'CONFIRMED' && mn?.domain === 'cardiovascular') return 'high';
  if (current_state === 'CONFIRMED') return 'medium';
  if (current_state === 'PREDICTED_CURRENT') {
    const upstreamIds = state.evidence?.inferred_from_nodes ?? [];
    const hasConfirmedCVUpstream = upstreamIds.some(uid => {
      const us = nodeStates.find(s => s.node_id === uid);
      const um = MASTER.nodes.find(n => n.id === uid);
      return us?.current_state === 'CONFIRMED' && um?.domain === 'cardiovascular';
    });
    if (hasConfirmedCVUpstream) return 'high';
  }
  return 'medium';
}

// --- Changeability from master.json ---

function getChangeability(nodeId) {
  const mn = MASTER.nodes.find(n => n.id === nodeId);
  return mn?.changeability ?? 'unknown';
}

// --- Missing model element detection ---
// Flags nodes active in person states but with no causal edges in master.json.

function detectMissingModelElements(nodeStates, causalGraph) {
  const missing       = [];
  const masterNodeIds = new Set(MASTER.nodes.map(n => n.id));

  for (const state of nodeStates) {
    if (!CANDIDATE_STATES.has(state.current_state)) continue;

    if (!masterNodeIds.has(state.node_id)) {
      missing.push({
        node_id: state.node_id,
        issue:   'Node is active in person state but not defined in master.json — causal reach and changeability cannot be evaluated.',
      });
      continue;
    }

    const causalEdges     = causalGraph[state.node_id] ?? [];
    const riskMarkerEdges = MASTER.edges.filter(e => e.from === state.node_id && e.relation === 'RISK_MARKER_FOR');

    if (causalEdges.length === 0) {
      if (riskMarkerEdges.length > 0) {
        missing.push({
          node_id: state.node_id,
          issue:   `Only RISK_MARKER_FOR downstream edges — no causal (CAUSES/CONTRIBUTES_TO) path modeled. ` +
                   `Treating this node does not causally improve downstream risk. Cannot be a leverage candidate.`,
        });
      } else {
        missing.push({
          node_id: state.node_id,
          issue:   `No causal edges (CAUSES/CONTRIBUTES_TO) in master.json — causal reach unknown. Likely incomplete model slice.`,
        });
      }
    }
  }

  return missing;
}

// --- Build candidate reason string ---

function buildCandidateReason(c, excluded, exclusionReason) {
  if (excluded) return exclusionReason;
  const parts = [
    `Threat=${c.threat}, time_sensitivity=${c.time_sensitivity}.`,
    `Causal reach ${c.causal_reach.level} — ${c.causal_reach.affected_nodes.length} downstream nodes via CAUSES/CONTRIBUTES_TO.`,
    `Cross-context leverage ${c.cross_context_leverage.level} (${c.cross_context_leverage.contexts.join(', ')}).`,
    `Changeability=${c.changeability}.`,
  ];
  return parts.join(' ');
}

// --- Selection (ordinal, no numeric score) ---
// cross_context_leverage → causal_reach → changeability

function selectLeverageCandidate(viable) {
  if (viable.length === 0) return null;

  // Prefer candidates with changeability ≥ medium
  const changeable = viable.filter(c => CHANGE_RANK[c.changeability] >= 2);
  const pool = changeable.length > 0 ? changeable : viable;

  const sorted = [...pool].sort((a, b) => {
    const lDiff = LEVERAGE_RANK[b.cross_context_leverage.level] - LEVERAGE_RANK[a.cross_context_leverage.level];
    if (lDiff !== 0) return lDiff;
    const rDiff = LEVERAGE_RANK[b.causal_reach.level] - LEVERAGE_RANK[a.causal_reach.level];
    if (rDiff !== 0) return rDiff;
    return CHANGE_RANK[b.changeability] - CHANGE_RANK[a.changeability];
  });

  return sorted[0];
}

// --- Explanation ---

function buildExplanation(selected, alternatives, missingElements) {
  const lines = [];

  lines.push(
    `SYSTEM_LEVERAGE: ${selected.node_id} (${selected.current_state}, confidence=${selected.confidence}).`
  );
  lines.push(
    `Josefův nejsilnější identifikovaný cross-domain leverage point v aktuálním Masteru.`
  );
  lines.push(
    `Kauzální dosah ${selected.causal_reach.level.toUpperCase()} — ` +
    `${selected.causal_reach.affected_nodes.length} uzlů downstream přes CAUSES/CONTRIBUTES_TO: ` +
    selected.causal_reach.edges_used.map(e => `${e.from}→${e.to}`).join(', ') + '.'
  );
  lines.push(
    `Cross-context leverage ${selected.cross_context_leverage.level.toUpperCase()} — zasahuje ` +
    `${selected.cross_context_leverage.contexts.length} aktivní decision_context(y): ` +
    selected.cross_context_leverage.contexts.join(', ') + '.'
  );
  lines.push(`Changeability=${selected.changeability}.`);

  if (alternatives.length > 0) {
    const runner = alternatives[0];
    const lossReason = (() => {
      if (LEVERAGE_RANK[runner.cross_context_leverage.level] < LEVERAGE_RANK[selected.cross_context_leverage.level])
        return `cross_context_leverage ${runner.cross_context_leverage.level} < ${selected.cross_context_leverage.level}`;
      if (LEVERAGE_RANK[runner.causal_reach.level] < LEVERAGE_RANK[selected.causal_reach.level])
        return `causal_reach ${runner.causal_reach.level} < ${selected.causal_reach.level}`;
      return `changeability ${runner.changeability} < ${selected.changeability}`;
    })();
    lines.push(`Druhý nejlepší: ${runner.node_id} — poražen na ${lossReason}.`);
  }

  if (missingElements.length > 0) {
    lines.push(
      `Nekompletní model: ${missingElements.map(m => m.node_id).join(', ')} — viz missing_model_elements.`
    );
  }

  return lines.join('\n');
}

// --- Main export ---

export function computeSystemLeverage(nodeStates, projections, decisionGate, engineVersion) {
  const now         = new Date().toISOString();
  const causalGraph = buildCausalGraph();

  // Active contexts from gate
  const activeContextIds = new Set(
    (decisionGate.context_gates ?? []).map(g => g.decision_context.id)
  );

  // Safety override
  const hasSafetyCritical = (decisionGate.context_gates ?? []).some(g =>
    (g.actionable_findings ?? []).some(f => f.actionability === 'SAFETY_CRITICAL')
  );

  if (hasSafetyCritical) {
    return {
      status:                 'IDENTIFIED',
      selected:               null,
      candidates:             [],
      alternatives:           [],
      selection_basis:        { safety_override: true },
      affected_contexts:      [],
      explanation:            'SAFETY OVERRIDE: SAFETY_CRITICAL finding present — leverage evaluation deferred to safety gate.',
      missing_model_elements: [],
      engine_version:         engineVersion,
      evaluated_at:           now,
    };
  }

  // Detect missing model elements
  const missing_model_elements = detectMissingModelElements(nodeStates, causalGraph);
  const missingNodeIds         = new Set(missing_model_elements.map(m => m.node_id));

  // Build all LEVERAGE_CANDIDATEs
  const candidates = [];

  for (const state of nodeStates) {
    if (!CANDIDATE_STATES.has(state.current_state)) continue;

    const causalReach   = computeCausalReach(state.node_id, causalGraph, projections);
    const leverage      = computeCrossContextLeverage(state.node_id, causalReach.affected_nodes, activeContextIds);
    const threat        = computeThreat(state, nodeStates);
    const timeSens      = computeTimeSensitivity(state, nodeStates);
    const changeability = getChangeability(state.node_id);

    const _excluded = causalReach.level === 'none';

    const exclusionReason = _excluded
      ? (missingNodeIds.has(state.node_id)
          ? `Excluded: no causal edges in master.json — causal reach unknown. See missing_model_elements.`
          : `Excluded: only RISK_MARKER_FOR downstream edges — zero systemic causal leverage.`)
      : null;

    candidates.push({
      node_id:                state.node_id,
      current_state:          state.current_state,
      confidence:             state.confidence,
      threat,
      time_sensitivity:       timeSens,
      causal_reach: {
        level:                causalReach.level,
        affected_nodes:       causalReach.affected_nodes,
        affected_projections: causalReach.affected_projections,
        edges_used:           causalReach.edges_used,
      },
      cross_context_leverage: leverage,
      changeability,
      evidence:               state.evidence?.direct ?? [],
      reason:                 buildCandidateReason(
        { threat, time_sensitivity: timeSens, causal_reach: causalReach, cross_context_leverage: leverage, changeability },
        _excluded, exclusionReason
      ),
      _excluded,
    });
  }

  const viable   = candidates.filter(c => !c._excluded);
  const selected = selectLeverageCandidate(viable);

  const outputCandidates = candidates.map(({ _excluded, ...rest }) => rest);

  if (!selected) {
    return {
      status:                 'INSUFFICIENT_MODEL',
      selected:               null,
      candidates:             outputCandidates,
      alternatives:           [],
      selection_basis:        { safety_override: false },
      affected_contexts:      [],
      explanation:            'No viable leverage candidate — all candidates have zero causal reach or unmodeled edges.',
      missing_model_elements,
      engine_version:         engineVersion,
      evaluated_at:           now,
    };
  }

  const alternatives = viable
    .filter(c => c.node_id !== selected.node_id)
    .sort((a, b) => {
      const lDiff = LEVERAGE_RANK[b.cross_context_leverage.level] - LEVERAGE_RANK[a.cross_context_leverage.level];
      if (lDiff !== 0) return lDiff;
      const rDiff = LEVERAGE_RANK[b.causal_reach.level] - LEVERAGE_RANK[a.causal_reach.level];
      if (rDiff !== 0) return rDiff;
      return CHANGE_RANK[b.changeability] - CHANGE_RANK[a.changeability];
    })
    .slice(0, 2)
    .map(({ _excluded, ...rest }) => rest);

  return {
    status:   'IDENTIFIED',
    selected: {
      node_id:       selected.node_id,
      current_state: selected.current_state,
      confidence:    selected.confidence,
    },
    candidates: outputCandidates,
    alternatives,
    selection_basis: {
      safety_override:        false,
      threat:                 selected.threat,
      time_sensitivity:       selected.time_sensitivity,
      causal_reach:           selected.causal_reach,
      cross_context_leverage: selected.cross_context_leverage,
      changeability:          selected.changeability,
    },
    affected_contexts:      selected.cross_context_leverage.contexts,
    explanation:            buildExplanation(selected, alternatives, missing_model_elements),
    missing_model_elements,
    engine_version:         engineVersion,
    evaluated_at:           now,
  };
}
