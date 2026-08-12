// systemConstraint.js — SYSTEM_CONSTRAINT v0.1 (Engine v1)
//
// Identifies the CURRENT MASTER NODE or mechanism that most limits achieving
// the GOAL (LONG_HEALTHY_FUNCTIONAL_LIFE). This is a TOC-inspired constraint
// analysis — not a leverage/changeability analysis:
//
//   - changeability is NOT a selection criterion.
//   - A constraint can be something very hard to change.
//   - Terminal threats and PERSON_PROJECTIONs are NOT candidates.
//   - RISK_MARKER_FOR edges are NEVER part of causal paths to Goal.
//
// Selection (ordinal, no weighted score):
//   1. goal_threat_severity   (active threat magnitude to terminal Goal)
//   2. time_sensitivity       (is the damage mechanism active right now?)
//   3. evidence_quality       (how well-supported is the candidate's state?)
//   4. causal_relevance       (path quality from candidate to Goal gateway)
//   5. breadth                (# of Goal branches threatened)
//
// Allowed results:
//   IDENTIFIED          — single winner selected
//   INSUFFICIENT_EVIDENCE — model can decide, but person lacks discriminating data
//   INSUFFICIENT_MODEL    — master.json lacks necessary nodes/edges/rules
//
// Distinct from SYSTEM_LEVERAGE (cross-context reach + changeability).

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const _dir   = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8'));

// --- Constants ---

const CANDIDATE_STATES = new Set(['CONFIRMED', 'MEASURED', 'PREDICTED_CURRENT']);
const CAUSAL_RELATIONS  = new Set(['CAUSES', 'CONTRIBUTES_TO']);

// GOAL_MODEL v0.1
const GOAL_MODEL = {
  version: '0.1',
  goal:    'LONG_HEALTHY_FUNCTIONAL_LIFE',
  branches: {
    SURVIVAL_HEALTHSPAN: {
      pathway_threats:  ['ASCVD', 'CANCER', 'NEURODEGENERATION', 'METABOLIC_DYSFUNCTION'],
      terminal_threats: ['PREMATURE_MORTALITY', 'MAJOR_MORBIDITY'],
    },
    FUNCTIONAL_INDEPENDENCE: {
      pathway_threats:  [
        'CARDIORESPIRATORY_FITNESS_DECLINE', 'STRENGTH_LOSS', 'STABILITY_BALANCE_LOSS',
        'MOBILITY_LOSS', 'COGNITIVE_CAPACITY_DECLINE', 'FRAILTY_FUNCTIONAL_DECLINE',
      ],
      terminal_threats: ['LOSS_OF_INDEPENDENCE', 'COGNITIVE_DECLINE'],
    },
  },
};

// Gateway nodes — last MASTER nodes before Goal branches.
// Defines how the Master causal graph connects to Goal terminal threats.
// RISK_MARKER_FOR edges are not represented here.
const GOAL_GATEWAYS = {
  CARDIOVASCULAR_DISEASE: {
    pathway_threat:  'ASCVD',
    terminal_threats: ['PREMATURE_MORTALITY', 'MAJOR_MORBIDITY'],
    branch:           'SURVIVAL_HEALTHSPAN',
  },
  LOSS_OF_FLOOR_RISE_ABILITY: {
    pathway_threat:  'FRAILTY_FUNCTIONAL_DECLINE',
    terminal_threats: ['LOSS_OF_INDEPENDENCE'],
    branch:           'FUNCTIONAL_INDEPENDENCE',
  },
};

// Missing evidence catalog — keyed by node_id that requires it.
// Used when finalists are tied and specific personal data would resolve selection.
const MISSING_EVIDENCE_CATALOG = {
  HYPERTENSION: [
    {
      obs_type: 'bp_control_status',
      note: 'Blood pressure control status under current antihypertensive treatment. ' +
            'ESC Hypertension Guidelines (2021) target systolic 120–129 mmHg in most treated ' +
            'patients if tolerated, with individualization by age, frailty, and comorbidities. ' +
            'Confirmed on-target control reduces time_sensitivity (active hemodynamic ' +
            'endothelial injury diminished); uncontrolled HYPERTENSION confirms ongoing ' +
            'high-severity mechanism. Discriminates goal_threat_severity and ' +
            'time_sensitivity for HYPERTENSION.',
      discriminating_for: ['goal_threat_severity', 'time_sensitivity'],
    },
  ],
  DYSLIPIDEMIA: [
    {
      obs_type: 'lab_apob_or_ldl_p',
      note: 'ApoB or LDL-P as supplementary evidence of atherogenic lipoprotein burden. ' +
            'Elevated ApoB (guideline thresholds per ESC/EAS Dyslipidaemia Guidelines 2019, ' +
            'e.g. <65–70 mg/dL for very-high-risk, <80 mg/dL for high-risk) or elevated LDL-P ' +
            'supports atherogenic phenotype and confirms HIGH goal_threat_severity for ' +
            'DYSLIPIDEMIA. Supplementary evidence — not a sole arbiter between HYPERTENSION ' +
            'and DYSLIPIDEMIA. Strengthens evidence_quality for this candidate.',
      discriminating_for: ['evidence_quality', 'goal_threat_severity'],
    },
    {
      obs_type: 'lab_lipid_panel',
      note: 'Full fasting lipid panel (LDL-C, HDL-C, TG, non-HDL-C). Characterizes ' +
            'dyslipidemia phenotype: atherogenic (elevated LDL-C or TG, reduced HDL-C) ' +
            'vs isolated-HDL or triglyceride-only pattern. Phenotype affects causal_relevance ' +
            'to ASCVD pathway and goal_threat_severity.',
      discriminating_for: ['goal_threat_severity', 'causal_relevance'],
    },
  ],
  // Resolving evidence — applies when multiple CV finalists remain tied after all criteria.
  _cv_tie_resolution: [
    {
      obs_type: 'cac_score',
      note: 'Coronary Artery Calcium (CAC) score by non-contrast CT. ' +
            'If CAC > 0: confirms subclinical atherosclerosis — ATHEROSCLEROSIS becomes CONFIRMED ' +
            'as a new constraint candidate (1 hop from CARDIOVASCULAR_DISEASE gateway), with ' +
            'HYPERTENSION and DYSLIPIDEMIA repositioned as contributing upstream drivers. ' +
            'CAC = 0 in a high-risk profile is also informative (negative risk modifier, ' +
            'de-escalates short-term ASCVD risk). ESC/EAS Dyslipidaemia Guidelines 2019 — ' +
            'CAC as risk reclassification tool in intermediate CVD risk. ' +
            'Resolves finalist tie by repositioning the proximate constraint.',
      discriminating_for: ['finalist_resolution', 'causal_relevance'],
    },
  ],
};

const SEVERITY_RANK = { high: 3, medium: 2, low: 1, none: 0 };
const EQ_RANK       = { strong: 3, moderate: 2, weak: 1, unknown: 0 };

// --- Causal graph (CAUSES + CONTRIBUTES_TO only) ---

function buildCausalGraph() {
  const graph = {};
  for (const edge of MASTER.edges) {
    if (!CAUSAL_RELATIONS.has(edge.relation)) continue;
    if (!graph[edge.from]) graph[edge.from] = [];
    graph[edge.from].push({
      to:               edge.to,
      relation:         edge.relation,
      edge_id:          edge.id,
      evidence_quality: edge.evidence_quality ?? 'unknown',
      strength:         edge.strength ?? 'unknown',
    });
  }
  return graph;
}

// --- BFS with path reconstruction to find Goal gateway nodes ---
// Returns: { threatens_branches, terminal_threat_paths, gateway_nodes_reached }
// hop_count is included as metadata only — NOT used in selection.

function computeGoalImpact(nodeId, causalGraph) {
  const predecessors = new Map(); // nodeId → { from, edge } | null (for start)
  predecessors.set(nodeId, null);
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of (causalGraph[current] ?? [])) {
      if (!predecessors.has(edge.to)) {
        predecessors.set(edge.to, { from: current, edge });
        queue.push(edge.to);
      }
    }
  }

  const threatens_branches    = new Set();
  const terminal_threat_paths = [];
  const gateway_nodes_reached = [];

  for (const [gatewayId, gatewayDef] of Object.entries(GOAL_GATEWAYS)) {
    if (!predecessors.has(gatewayId)) continue;

    // Reconstruct path from nodeId to gatewayId
    const pathEdges = [];
    let current = gatewayId;
    while (predecessors.get(current) !== null) {
      const pred = predecessors.get(current);
      pathEdges.unshift({ from: pred.from, to: current, ...pred.edge });
      current = pred.from;
    }

    // Minimum evidence_quality along path (weakest link)
    const minEQRank = pathEdges.reduce(
      (min, e) => Math.min(min, EQ_RANK[e.evidence_quality] ?? 0), 3
    );
    const path_evidence_quality = Object.keys(EQ_RANK).find(k => EQ_RANK[k] === minEQRank) ?? 'unknown';

    threatens_branches.add(gatewayDef.branch);
    gateway_nodes_reached.push(gatewayId);

    for (const terminal of gatewayDef.terminal_threats) {
      terminal_threat_paths.push({
        gateway_node:         gatewayId,
        pathway_threat:       gatewayDef.pathway_threat,
        terminal_threat:      terminal,
        branch:               gatewayDef.branch,
        hop_count:            pathEdges.length, // metadata only — not a selection criterion
        relation_types:       pathEdges.map(e => e.relation),
        path_evidence_quality,
      });
    }
  }

  return {
    threatens_branches:    [...threatens_branches],
    terminal_threat_paths,
    gateway_nodes_reached,
  };
}

// --- Goal threat severity ---
// CONFIRMED disease with Goal path → HIGH.
// PREDICTED_CURRENT inferred from CONFIRMED CV upstream → HIGH (mechanism is active via upstream).
// MEASURED or other PREDICTED_CURRENT → MEDIUM.

function computeGoalThreatSeverity(state, nodeStates, goalImpact) {
  if (goalImpact.threatens_branches.length === 0) return 'none';

  const { node_id, current_state } = state;
  const mn = MASTER.nodes.find(n => n.id === node_id);

  if (current_state === 'CONFIRMED') return 'high';

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

  if (current_state === 'MEASURED') return 'medium';

  return 'low';
}

// --- Time sensitivity ---
// CONFIRMED CV disease → active mechanism, ongoing damage → high.
// PREDICTED_CURRENT from CONFIRMED CV upstream → high (mechanism is propagating via upstream).
// Others → medium.

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

// --- Evidence quality ---
// Reflects how well-supported the candidate's state is, not the path quality.

function computeEvidenceQuality(state) {
  const { current_state, confidence } = state;
  if (current_state === 'CONFIRMED') return 'high';
  if (current_state === 'MEASURED') {
    return confidence === 'high' ? 'high' : 'medium';
  }
  if (current_state === 'PREDICTED_CURRENT') {
    return (confidence === 'high' || confidence === 'medium') ? 'medium' : 'low';
  }
  return 'low';
}

// --- Causal relevance to terminal Goal threat ---
// Based on minimum edge evidence_quality along the path to gateway.
// 'strong' path → high; 'moderate' → medium; 'weak'/'unknown' → low; no path → none.

function computeCausalRelevance(goalImpact) {
  if (goalImpact.gateway_nodes_reached.length === 0) return 'none';

  const maxPathRank = goalImpact.terminal_threat_paths.reduce(
    (max, p) => Math.max(max, EQ_RANK[p.path_evidence_quality] ?? 0), 0
  );

  if (maxPathRank >= 3) return 'high';
  if (maxPathRank >= 2) return 'medium';
  if (maxPathRank >= 1) return 'low';
  return 'none';
}

// --- RISK_MARKER_FOR exclusion detection ---

function hasOnlyRiskMarkerEdges(nodeId, causalGraph) {
  const hasCausal     = (causalGraph[nodeId] ?? []).length > 0;
  const riskMarkerOut = MASTER.edges.some(e => e.from === nodeId && e.relation === 'RISK_MARKER_FOR');
  return !hasCausal && riskMarkerOut;
}

// --- Ordinal selection ---
// Returns: { selected: candidate | null, finalists: nodeId[] }
// finalists[] is non-empty when ≥2 candidates are tied on all criteria.

function selectConstraintCandidate(viable) {
  if (viable.length === 0) return { selected: null, finalists: [] };

  const sorted = [...viable].sort((a, b) => {
    const g = SEVERITY_RANK[b.goal_threat_severity]  - SEVERITY_RANK[a.goal_threat_severity];
    if (g !== 0) return g;
    const t = SEVERITY_RANK[b.time_sensitivity]       - SEVERITY_RANK[a.time_sensitivity];
    if (t !== 0) return t;
    const e = SEVERITY_RANK[b.evidence_quality]       - SEVERITY_RANK[a.evidence_quality];
    if (e !== 0) return e;
    const c = SEVERITY_RANK[b.causal_relevance]       - SEVERITY_RANK[a.causal_relevance];
    if (c !== 0) return c;
    return b.breadth - a.breadth;
  });

  const top = sorted[0];

  // Detect tie — all candidates matching top on every criterion
  const tied = sorted.filter(c =>
    SEVERITY_RANK[c.goal_threat_severity] === SEVERITY_RANK[top.goal_threat_severity] &&
    SEVERITY_RANK[c.time_sensitivity]     === SEVERITY_RANK[top.time_sensitivity]     &&
    SEVERITY_RANK[c.evidence_quality]     === SEVERITY_RANK[top.evidence_quality]     &&
    SEVERITY_RANK[c.causal_relevance]     === SEVERITY_RANK[top.causal_relevance]     &&
    c.breadth                             === top.breadth
  );

  if (tied.length > 1) return { selected: null, finalists: tied.map(c => c.node_id) };
  return { selected: top, finalists: [] };
}

// --- Build missing_evidence for INSUFFICIENT_EVIDENCE ---

function buildMissingEvidence(finalistIds) {
  const entries = [];
  const seen    = new Set();

  for (const id of finalistIds) {
    const catalog = MISSING_EVIDENCE_CATALOG[id] ?? [];
    for (const entry of catalog) {
      if (!seen.has(entry.obs_type)) {
        seen.add(entry.obs_type);
        entries.push({ ...entry, targets: [id] });
      }
    }
  }

  // CV tie-resolution evidence (CAC) if ≥2 CV finalists remain
  const cvGatewayNodes = new Set(['HYPERTENSION', 'DYSLIPIDEMIA', 'ENDOTHELIAL_DYSFUNCTION', 'ATHEROSCLEROSIS']);
  const hasCVTie = finalistIds.filter(id => cvGatewayNodes.has(id)).length >= 2;
  if (hasCVTie) {
    for (const entry of (MISSING_EVIDENCE_CATALOG._cv_tie_resolution ?? [])) {
      if (!seen.has(entry.obs_type)) {
        seen.add(entry.obs_type);
        entries.push({ ...entry, targets: finalistIds });
      }
    }
  }

  return entries;
}

// --- Dominant branch and threat pathway ---
// Determines the primary Goal branch / threat pathway across all viable candidates.

function computeDominantThreat(viable) {
  const branchCount = {};
  const pathwayCount = {};

  for (const c of viable) {
    for (const b of c.goal_impact.threatens_branches) {
      branchCount[b] = (branchCount[b] ?? 0) + 1;
    }
    for (const p of c.goal_impact.terminal_threat_paths) {
      pathwayCount[p.pathway_threat] = (pathwayCount[p.pathway_threat] ?? 0) + 1;
    }
  }

  const dominant_goal_branch   = Object.entries(branchCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const dominant_threat_pathway = Object.entries(pathwayCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { dominant_goal_branch, dominant_threat_pathway };
}

// --- Explanation ---

function buildExplanation(result, candidates, finalists, missingModel) {
  const lines = [];

  if (result.selected) {
    const s = result.selected;
    lines.push(`SYSTEM_CONSTRAINT: ${s.node_id} (${s.current_state}, confidence=${s.confidence}).`);
    lines.push(
      `Vybráno na základě: goal_threat_severity=${s.goal_threat_severity}, ` +
      `time_sensitivity=${s.time_sensitivity}, evidence_quality=${s.evidence_quality}, ` +
      `causal_relevance=${s.causal_relevance}, breadth=${s.breadth}.`
    );
    lines.push(
      `Cesta k terminální hrozbě: ` +
      s.goal_impact.terminal_threat_paths.slice(0, 1).map(p =>
        `${p.pathway_threat} → ${p.terminal_threat} ` +
        `přes ${p.gateway_node} (${p.hop_count} hops v Masteru, metadata).`
      ).join(' ')
    );
  } else if (finalists.length > 0) {
    lines.push(`SYSTEM_CONSTRAINT: INSUFFICIENT_EVIDENCE — ${finalists.join(' vs ')} jsou klinicky nerozlišitelní na všech kritériích.`);
    lines.push(
      `Oba jsou CONFIRMED, oba ohrožují SURVIVAL_HEALTHSPAN/ASCVD cestou přes ATHEROSCLEROSIS → CARDIOVASCULAR_DISEASE. ` +
      `Rozdíl v počtu hops (${
        candidates.filter(c => finalists.includes(c.node_id)).map(c =>
          `${c.node_id}: ${c.goal_impact.terminal_threat_paths[0]?.hop_count ?? '?'} hops`
        ).join(', ')
      }) je popisný — není selekčním kritériem.`
    );
    lines.push(`Chybí osobní evidence k rozlišení: viz missing_evidence.`);
  } else {
    lines.push(`SYSTEM_CONSTRAINT: INSUFFICIENT_MODEL — žádný viabilní kandidát s Goal path.`);
  }

  if (missingModel.length > 0) {
    lines.push(`Nekompletní model: ${missingModel.map(m => m.node_id).join(', ')} — viz missing_model_elements.`);
  }

  return lines.join('\n');
}

// --- Main export ---

export function computeSystemConstraint(nodeStates, projections, decisionGate, engineVersion) {
  const now         = new Date().toISOString();
  const causalGraph = buildCausalGraph();

  // Safety override (mirrors systemLeverage)
  const hasSafetyCritical = (decisionGate.context_gates ?? []).some(g =>
    (g.actionable_findings ?? []).some(f => f.actionability === 'SAFETY_CRITICAL')
  );

  if (hasSafetyCritical) {
    return {
      status:                 'SAFETY_OVERRIDE',
      selected:               null,
      finalists:              [],
      candidates:             [],
      dominant_goal_branch:   null,
      dominant_threat_pathway: null,
      missing_evidence:       [],
      selection_basis:        { safety_override: true },
      explanation:            'SAFETY OVERRIDE: SAFETY_CRITICAL finding present — constraint evaluation deferred to safety gate.',
      missing_model_elements: [],
      goal_model:             GOAL_MODEL,
      engine_version:         engineVersion,
      evaluated_at:           now,
    };
  }

  // Build all CONSTRAINT_CANDIDATEs
  const candidates   = [];
  const missing_model_elements = [];

  for (const state of nodeStates) {
    if (!CANDIDATE_STATES.has(state.current_state)) continue;

    const inMaster = MASTER.nodes.some(n => n.id === state.node_id);
    if (!inMaster) {
      missing_model_elements.push({
        node_id: state.node_id,
        issue:   'Active in person state but not defined in master.json — cannot evaluate Goal impact.',
      });
    }

    const goalImpact       = computeGoalImpact(state.node_id, causalGraph);
    const _riskMarkerOnly  = hasOnlyRiskMarkerEdges(state.node_id, causalGraph);
    const _noGoalPath      = goalImpact.threatens_branches.length === 0;

    const exclusionReason = _riskMarkerOnly
      ? 'Excluded: only RISK_MARKER_FOR downstream edges — not causally connected to Goal gateway.'
      : _noGoalPath
        ? 'Excluded: no causal path (CAUSES/CONTRIBUTES_TO) reaches any Goal gateway in master.json.'
        : null;

    const _excluded = _riskMarkerOnly || _noGoalPath;

    const goal_threat_severity = _excluded ? 'none'
      : computeGoalThreatSeverity(state, nodeStates, goalImpact);
    const time_sensitivity     = computeTimeSensitivity(state, nodeStates);
    const evidence_quality     = computeEvidenceQuality(state);
    const causal_relevance     = _excluded ? 'none' : computeCausalRelevance(goalImpact);
    const breadth              = goalImpact.threatens_branches.length;

    candidates.push({
      node_id:             state.node_id,
      current_state:       state.current_state,
      confidence:          state.confidence,
      goal_impact:         goalImpact,
      goal_threat_severity,
      time_sensitivity,
      evidence_quality,
      causal_relevance,
      breadth,
      exclusion_reason:    exclusionReason,
      _excluded,
    });
  }

  const viable = candidates.filter(c => !c._excluded);

  const { selected: winner, finalists } = selectConstraintCandidate(viable);

  const { dominant_goal_branch, dominant_threat_pathway } = computeDominantThreat(viable);

  // Strip internal flag from output
  const outputCandidates = candidates.map(({ _excluded, ...rest }) => rest);

  // INSUFFICIENT_EVIDENCE
  if (!winner && finalists.length > 0) {
    const missing_evidence = buildMissingEvidence(finalists);
    return {
      status:                  'INSUFFICIENT_EVIDENCE',
      selected:                null,
      finalists,
      candidates:              outputCandidates,
      dominant_goal_branch,
      dominant_threat_pathway,
      missing_evidence,
      selection_basis: {
        safety_override:      false,
        applied_criteria:     ['goal_threat_severity', 'time_sensitivity', 'evidence_quality', 'causal_relevance', 'breadth'],
        finalists_tied_on_all_criteria: true,
      },
      explanation: buildExplanation({ selected: null }, outputCandidates, finalists, missing_model_elements),
      missing_model_elements,
      goal_model:              GOAL_MODEL,
      engine_version:          engineVersion,
      evaluated_at:            now,
    };
  }

  // INSUFFICIENT_MODEL
  if (!winner) {
    return {
      status:                  'INSUFFICIENT_MODEL',
      selected:                null,
      finalists:               [],
      candidates:              outputCandidates,
      dominant_goal_branch,
      dominant_threat_pathway,
      missing_evidence:        [],
      selection_basis:         { safety_override: false },
      explanation:             buildExplanation({ selected: null }, outputCandidates, [], missing_model_elements),
      missing_model_elements,
      goal_model:              GOAL_MODEL,
      engine_version:          engineVersion,
      evaluated_at:            now,
    };
  }

  // IDENTIFIED
  const alternatives = viable
    .filter(c => c.node_id !== winner.node_id)
    .sort((a, b) => {
      const g = SEVERITY_RANK[b.goal_threat_severity]  - SEVERITY_RANK[a.goal_threat_severity];
      if (g !== 0) return g;
      const t = SEVERITY_RANK[b.time_sensitivity]       - SEVERITY_RANK[a.time_sensitivity];
      if (t !== 0) return t;
      const e = SEVERITY_RANK[b.evidence_quality]       - SEVERITY_RANK[a.evidence_quality];
      if (e !== 0) return e;
      const c = SEVERITY_RANK[b.causal_relevance]       - SEVERITY_RANK[a.causal_relevance];
      if (c !== 0) return c;
      return b.breadth - a.breadth;
    })
    .slice(0, 2)
    .map(({ _excluded, ...rest }) => rest);

  return {
    status:  'IDENTIFIED',
    selected: {
      node_id:             winner.node_id,
      current_state:       winner.current_state,
      confidence:          winner.confidence,
      goal_impact:         winner.goal_impact,
      goal_threat_severity: winner.goal_threat_severity,
      time_sensitivity:    winner.time_sensitivity,
      evidence_quality:    winner.evidence_quality,
      causal_relevance:    winner.causal_relevance,
      breadth:             winner.breadth,
    },
    finalists:               [],
    candidates:              outputCandidates,
    alternatives,
    dominant_goal_branch,
    dominant_threat_pathway,
    missing_evidence:        [],
    selection_basis: {
      safety_override:    false,
      goal_threat_severity: winner.goal_threat_severity,
      time_sensitivity:   winner.time_sensitivity,
      evidence_quality:   winner.evidence_quality,
      causal_relevance:   winner.causal_relevance,
      breadth:            winner.breadth,
    },
    explanation: buildExplanation({ selected: winner }, outputCandidates, [], missing_model_elements),
    missing_model_elements,
    goal_model:             GOAL_MODEL,
    engine_version:         engineVersion,
    evaluated_at:           now,
  };
}
