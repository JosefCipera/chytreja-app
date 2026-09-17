// api/lib/constraintReadiness/systemConstraintReadiness.js
// System Constraint Readiness #1 — SYSTEM_CONSTRAINT_SELECTION
//
// Evaluates whether computeSystemConstraint() output is epistemically
// sufficient to act on as the identified system constraint.
//
// Three conditions (all must hold for READY):
//
//   R-COND-1: systemConstraint.status === 'IDENTIFIED'
//   R-COND-2: winner.evidence_quality >= 'medium' (not 'low')
//   R-COND-3: No MATERIAL_COMPETING_UNKNOWN in nodeStates
//
// MATERIAL_COMPETING_UNKNOWN: an UNKNOWN node that has a valid causal path to
// a Goal gateway AND whose B@CONFIRMED profile ties or beats the winner on the
// same five-criterion ordinal ordering used by systemConstraint selection.
//
// Design guarantees:
//   - Reads only data/engine/master.json (same source as systemConstraint.js)
//   - Does NOT modify any locked Engine file
//   - Does NOT access conversation history, Person Model, or Supabase
//   - Causal graph and scoring logic are parity-aligned with systemConstraint.js
//   - No decisionGate.blocking_uncertainties dependency

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const _dir   = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../../data/engine/master.json'), 'utf8'));

// --- Constants — parity with systemConstraint.js ---

// Identical to CAUSAL_RELATIONS in systemConstraint.js.
// RISK_MARKER_FOR explicitly excluded: it does not establish a causal path to Goal.
const CAUSAL_RELATIONS = new Set(['CAUSES', 'CONTRIBUTES_TO']);

// Identical to keys of GOAL_GATEWAYS in systemConstraint.js.
const GOAL_GATEWAY_IDS = new Set(['CARDIOVASCULAR_DISEASE', 'LOSS_OF_FLOOR_RISE_ABILITY']);

// Branch membership for each gateway — mirrors systemConstraint.js GOAL_GATEWAYS.
const GATEWAY_BRANCH = {
  CARDIOVASCULAR_DISEASE:   'SURVIVAL_HEALTHSPAN',
  LOSS_OF_FLOOR_RISE_ABILITY: 'FUNCTIONAL_INDEPENDENCE',
};

// Identical ranking maps to systemConstraint.js SEVERITY_RANK and EQ_RANK.
const SEVERITY_RANK = { high: 3, medium: 2, low: 1, none: 0 };
const EQ_RANK       = { strong: 3, moderate: 2, weak: 1, unknown: 0 };

// --- Causal graph (CAUSES + CONTRIBUTES_TO only) ---
// Mirrors buildCausalGraph() in systemConstraint.js.

function buildCausalGraph(master) {
  const graph = {};
  for (const edge of master.edges) {
    if (!CAUSAL_RELATIONS.has(edge.relation)) continue;
    if (!graph[edge.from]) graph[edge.from] = [];
    graph[edge.from].push({
      to:               edge.to,
      evidence_quality: edge.evidence_quality ?? 'unknown',
    });
  }
  return graph;
}

// --- Goal path determination (BFS — parity with systemConstraint.js) ---
//
// Uses the same predecessor-map BFS as computeGoalImpact() in systemConstraint.js,
// then reconstructs each path to a gateway to compute minimum edge evidence_quality.
// Returns:
//   { hasGoalPath, threatens_branches, causal_relevance, breadth }

function computeGoalPath(nodeId, causalGraph) {
  // Predecessor-based BFS (same structure as systemConstraint.js computeGoalImpact)
  const predecessors = new Map();
  predecessors.set(nodeId, null);
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of (causalGraph[current] ?? [])) {
      if (!predecessors.has(edge.to)) {
        predecessors.set(edge.to, { from: current, edge_evidence_quality: edge.evidence_quality });
        queue.push(edge.to);
      }
    }
  }

  const threatens_branches = new Set();
  let best_path_rank = 0;

  for (const gatewayId of GOAL_GATEWAY_IDS) {
    // Gateway must be reachable AND must not be the starting node itself.
    if (!predecessors.has(gatewayId) || gatewayId === nodeId) continue;

    // Reconstruct path backward from gateway to nodeId, compute minimum edge quality.
    // Mirrors path reconstruction in systemConstraint.js computeGoalImpact.
    let minEQRank = 3; // sentinel (strong)
    let current = gatewayId;
    while (predecessors.get(current) !== null) {
      const pred = predecessors.get(current);
      const edgeRank = EQ_RANK[pred.edge_evidence_quality] ?? 0;
      minEQRank = Math.min(minEQRank, edgeRank);
      current = pred.from;
    }

    threatens_branches.add(GATEWAY_BRANCH[gatewayId]);
    best_path_rank = Math.max(best_path_rank, minEQRank);
  }

  const hasGoalPath = threatens_branches.size > 0;

  // Mirrors computeCausalRelevance() in systemConstraint.js.
  const causal_relevance = !hasGoalPath ? 'none'
    : best_path_rank >= 3 ? 'high'
    : best_path_rank >= 2 ? 'medium'
    : best_path_rank >= 1 ? 'low'
    : 'none';

  return {
    hasGoalPath,
    threatens_branches: [...threatens_branches],
    causal_relevance,
    breadth: threatens_branches.size,
  };
}

// --- B@CONFIRMED profile ---
//
// Constructs the five-criterion profile for an UNKNOWN node B resolved to CONFIRMED.
// Scoring rules mirror systemConstraint.js computeGoalThreatSeverity,
// computeTimeSensitivity, and computeEvidenceQuality exactly.
//
// Returns null when B has no Goal path.

function buildConfirmedProfile(nodeId, goalPath) {
  if (!goalPath.hasGoalPath) return null;

  const mn     = MASTER.nodes.find(n => n.id === nodeId);
  const domain = mn?.domain ?? '';

  return {
    // CONFIRMED + Goal path → always 'high' (computeGoalThreatSeverity line 222)
    goal_threat_severity: 'high',

    // CONFIRMED + cardiovascular → 'high'; otherwise → 'medium'
    // (computeTimeSensitivity lines 249–250)
    time_sensitivity: (domain === 'cardiovascular') ? 'high' : 'medium',

    // CONFIRMED → always 'high' (computeEvidenceQuality line 269)
    evidence_quality: 'high',

    // Path evidence quality from goal path BFS (mirrors computeCausalRelevance)
    causal_relevance: goalPath.causal_relevance,

    // Number of distinct Goal branches threatened
    breadth: goalPath.breadth,
  };
}

// --- Ordinal comparison: B@CONFIRMED vs winner ---
//
// Five-criterion comparison in the same order as selectConstraintCandidate()
// in systemConstraint.js. Returns 'beats', 'ties', or 'loses'.
// P4 guarantee: if W beats B on any criterion, later B superiority is irrelevant.

function compareToWinner(b, w) {
  const criteria = [
    [SEVERITY_RANK[b.goal_threat_severity] ?? 0, SEVERITY_RANK[w.goal_threat_severity] ?? 0],
    [SEVERITY_RANK[b.time_sensitivity]     ?? 0, SEVERITY_RANK[w.time_sensitivity]     ?? 0],
    [SEVERITY_RANK[b.evidence_quality]     ?? 0, SEVERITY_RANK[w.evidence_quality]     ?? 0],
    [SEVERITY_RANK[b.causal_relevance]     ?? 0, SEVERITY_RANK[w.causal_relevance]     ?? 0],
    [b.breadth                             ?? 0, w.breadth                             ?? 0],
  ];

  for (const [bRank, wRank] of criteria) {
    if (bRank > wRank) return 'beats';
    if (bRank < wRank) return 'loses';
  }
  return 'ties';
}

// --- Main export ---

/**
 * evaluateSystemConstraintReadiness
 *
 * Evaluates whether the systemConstraint result is epistemically sufficient
 * to act on as the identified system constraint.
 *
 * @param {object[]} nodeStates            PERSON_NODE_STATE[] (all states including UNKNOWN)
 * @param {object}   systemConstraintResult Output of computeSystemConstraint()
 * @returns {{ decision_type, status, unmet_requirements[] }}
 */
export function evaluateSystemConstraintReadiness(nodeStates, systemConstraintResult) {
  const decision_type = 'SYSTEM_CONSTRAINT_SELECTION';

  // ── R-COND-1: systemConstraint must have identified a unique winner ────────
  if (systemConstraintResult.status !== 'IDENTIFIED') {
    return {
      decision_type,
      status: 'NOT_READY',
      unmet_requirements: [{
        type:                    'NO_VIABLE_CANDIDATE',
        systemConstraint_status: systemConstraintResult.status,
        finalists:               systemConstraintResult.finalists ?? [],
      }],
    };
  }

  const winner = systemConstraintResult.selected;

  // ── R-COND-2: winner must have evidence_quality >= 'medium' ──────────────
  if (winner.evidence_quality !== 'medium' && winner.evidence_quality !== 'high') {
    const winnerState = nodeStates.find(s => s.node_id === winner.node_id);
    return {
      decision_type,
      status: 'NOT_READY',
      unmet_requirements: [{
        type:                    'INSUFFICIENT_CANDIDATE_EVIDENCE',
        node_id:                 winner.node_id,
        current_evidence_quality: winner.evidence_quality,
        required:                'medium',
        current_state:           winner.current_state,
        confidence:              winner.confidence,
        missing_evidence:        winnerState?.missing_evidence ?? [],
      }],
    };
  }

  // ── R-COND-3: No MATERIAL_COMPETING_UNKNOWN ──────────────────────────────
  const causalGraph = buildCausalGraph(MASTER);

  const unknownNodes    = nodeStates.filter(s => s.current_state === 'UNKNOWN');
  const materialNodeIds = [];

  for (const unknown of unknownNodes) {
    // Condition A: must have a causal path to a Goal gateway.
    const goalPath = computeGoalPath(unknown.node_id, causalGraph);
    if (!goalPath.hasGoalPath) continue;

    // Build B@CONFIRMED profile.
    const bProfile = buildConfirmedProfile(unknown.node_id, goalPath);
    if (!bProfile) continue;

    // Condition B: ties or beats winner on ordinal criteria.
    const comparison = compareToWinner(bProfile, winner);
    if (comparison === 'beats' || comparison === 'ties') {
      materialNodeIds.push(unknown.node_id);
    }
  }

  // Stable deterministic ordering: alphabetical by node_id.
  materialNodeIds.sort();

  if (materialNodeIds.length > 0) {
    return {
      decision_type,
      status: 'NOT_READY',
      unmet_requirements: [{
        type:              'UNRESOLVED_COMPETING_CANDIDATE',
        blocking_node_ids: materialNodeIds,
        winner_node_id:    winner.node_id,
        winner_scores: {
          goal_threat_severity: winner.goal_threat_severity,
          time_sensitivity:     winner.time_sensitivity,
          evidence_quality:     winner.evidence_quality,
          causal_relevance:     winner.causal_relevance,
          breadth:              winner.breadth,
        },
      }],
    };
  }

  // All three conditions pass.
  return {
    decision_type,
    status:            'READY',
    unmet_requirements: [],
  };
}

// --- Exported internals for parity testing ---
// These allow tests to verify readiness-side logic against actual systemConstraint output.

export { buildCausalGraph, computeGoalPath, buildConfirmedProfile, compareToWinner, MASTER };
