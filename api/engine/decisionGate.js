// decisionGate.js — DECISION_GATE per-context evaluation (Engine v1)
//
// Core question per context: "Do we know enough for the NEXT DECISION in THIS CONTEXT?"
//
// Each CONTEXT_DECISION_GATE is evaluated independently.
// A context with EVIDENCE_SUFFICIENT does NOT suppress NEXT_BEST_EVIDENCE
// for a different context that says NEED_MORE_EVIDENCE.
//
// Actionability levels:
//   SAFETY_CRITICAL     — specific current crisis value / explicit safety rule (NOT just confirmed diagnosis)
//   RISK_RELEVANT       — confirmed clinically significant risk condition (known direction, no current crisis)
//   ACTIONABLE          — clear action direction from measured / predicted data
//   MONITOR             — predicted mechanism node; watch and confirm
//   NOT_YET_ACTIONABLE  — state unknown; evidence needed before action
//
// Status rule per context:
//   has SAFETY_CRITICAL                        → EVIDENCE_SUFFICIENT (safety override)
//   has RISK_RELEVANT or ACTIONABLE (any)      → EVIDENCE_SUFFICIENT (direction clear)
//   no direction-level findings                → NEED_MORE_EVIDENCE
//
// Global output is purely aggregate (no global gate decision):
//   any_context_action_ready: bool
//   contexts_needing_evidence: string[]

import { selectNextBestEvidence } from './nextBestEvidence.js';

// ── Domain sets ───────────────────────────────────────────────────────────────
// CV nodes: confirmed diagnosis → RISK_RELEVANT
// All others: confirmed → ACTIONABLE

const CV_NODES = new Set([
  'HYPERTENSION', 'ENDOTHELIAL_DYSFUNCTION', 'ERECTILE_DYSFUNCTION',
  'ATRIAL_FIBRILLATION', 'DYSLIPIDEMIA',
]);
const METABOLIC_NODES = new Set(['EXCESS_ADIPOSITY', 'INSULIN_RESISTANCE']);
const FUNCTIONAL_NODES = new Set([
  'PHYSICAL_INACTIVITY', 'PHYSICAL_DECONDITIONING',
  'LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE', 'LOSS_OF_FLOOR_RISE_ABILITY',
]);
const CV_PROJ_TARGETS   = new Set(['CARDIOVASCULAR_DISEASE']);
const FUNC_PROJ_TARGETS = new Set(['LOSS_OF_FLOOR_RISE_ABILITY']);

// ── Actionability ─────────────────────────────────────────────────────────────

function nodeActionability(state) {
  const { node_id, current_state } = state;

  // SAFETY_CRITICAL is not triggered by confirmed diagnosis alone.
  // It requires a specific current crisis value (e.g. systolic BP > 180 confirmed,
  // known dangerous arrhythmia episode with active risk) — implemented as future extension.

  if (current_state === 'CONFIRMED') {
    // Confirmed CV-relevant conditions: direction is known, warrants management
    return CV_NODES.has(node_id) ? 'RISK_RELEVANT' : 'ACTIONABLE';
  }
  if (current_state === 'MEASURED') return 'ACTIONABLE';

  if (current_state === 'PREDICTED_CURRENT') {
    // Behavioral root nodes: action direction is clear regardless of measurement precision
    if (node_id === 'PHYSICAL_INACTIVITY' || node_id === 'PHYSICAL_DECONDITIONING')
      return 'ACTIONABLE';
    return 'MONITOR';
  }

  return 'NOT_YET_ACTIONABLE';
}

function projectionActionability(proj) {
  if (proj.risk === 'unknown' || proj.confidence === 'unknown') return 'NOT_YET_ACTIONABLE';
  if (proj.risk === 'elevated') return 'ACTIONABLE'; // direction clear even uncalibrated
  return 'MONITOR';
}

function nodeActionReason(state) {
  const { node_id, current_state, confidence } = state;
  const act = nodeActionability(state);
  if (act === 'RISK_RELEVANT')
    return `Potvrzená klinicky významná diagnóza — jasný směr managementu (${node_id})`;
  if (current_state === 'CONFIRMED')   return `Potvrzená diagnóza`;
  if (current_state === 'MEASURED')    return `Přímo změřeno — data pro rozhodnutí k dispozici`;
  if (current_state === 'PREDICTED_CURRENT') {
    if (node_id === 'PHYSICAL_INACTIVITY')
      return `Sedavý životní styl — behaviorální změna indikována bez ohledu na přesnost měření`;
    if (node_id === 'PHYSICAL_DECONDITIONING')
      return `Fyzická dekondice predikována z inaktivity — pohybová intervence indikována`;
    return `Predikováno z kombinace dat (confidence=${confidence}) — monitorovat, potvrdit přímou evidencí`;
  }
  return `Stav neznámý — čeká na evidenci`;
}

function projActionReason(proj) {
  if (proj.risk === 'elevated')
    return `Směr rizika jasný (elevated) i při nekalibrované projekci — základ pro rozhodnutí`;
  if (proj.risk === 'unknown')
    return `risk=unknown — projekce nelze použít pro rozhodnutí bez dalších dat`;
  return `Monitorovat vývoj`;
}

// ── Decision contexts ─────────────────────────────────────────────────────────
// Derived from active node_states and projections — not a hardcoded catalog.

function inferDecisionContexts(nodeStates, projections) {
  const contexts = [];

  const cvNodes = nodeStates.filter(s => CV_NODES.has(s.node_id));
  const cvProjs = projections.filter(p => CV_PROJ_TARGETS.has(p.target_node_id));
  if (cvNodes.length > 0 || cvProjs.length > 0) {
    contexts.push({
      id:    'CURRENT_CV_STATE',
      label: 'Kardiovaskulární stav',
      active_nodes:       cvNodes.map(s => ({ node_id: s.node_id, current_state: s.current_state, confidence: s.confidence })),
      active_projections: cvProjs.map(p => ({ target: p.target_node_id, risk: p.risk, confidence: p.confidence })),
    });
  }

  const metaNodes = nodeStates.filter(s => METABOLIC_NODES.has(s.node_id));
  if (metaNodes.length > 0) {
    contexts.push({
      id:    'METABOLIC_STATE',
      label: 'Metabolický stav',
      active_nodes:       metaNodes.map(s => ({ node_id: s.node_id, current_state: s.current_state, confidence: s.confidence })),
      active_projections: [],
    });
  }

  const funcNodes = nodeStates.filter(s => FUNCTIONAL_NODES.has(s.node_id));
  const funcProjs = projections.filter(p => FUNC_PROJ_TARGETS.has(p.target_node_id));
  if (funcNodes.length > 0 || funcProjs.length > 0) {
    contexts.push({
      id:    'LONGEVITY_FUNCTION',
      label: 'Funkční kapacita a pohyb',
      active_nodes:       funcNodes.map(s => ({ node_id: s.node_id, current_state: s.current_state, confidence: s.confidence })),
      active_projections: funcProjs.map(p => ({ target: p.target_node_id, risk: p.risk, confidence: p.confidence })),
    });
  }

  return contexts;
}

// ── Per-context gate evaluation ───────────────────────────────────────────────

const DIRECTION_LEVELS = new Set(['SAFETY_CRITICAL', 'RISK_RELEVANT', 'ACTIONABLE']);

function evaluateContextGate(ctx, nodeStates, projections, contextNeeds, engineVersion) {
  const ctxNodeIds = new Set(ctx.active_nodes.map(n => n.node_id));
  const ctxProjIds = new Set(ctx.active_projections.map(p => p.target));

  const ctxStates = nodeStates.filter(s => ctxNodeIds.has(s.node_id));
  const ctxProjs  = projections.filter(p => ctxProjIds.has(p.target_node_id));

  const actionable_findings = [
    ...ctxStates.map(s => ({
      entity_type:   'NODE_STATE',
      entity_id:     s.node_id,
      state:         s.current_state,
      confidence:    s.confidence,
      actionability: nodeActionability(s),
      reason:        nodeActionReason(s),
    })),
    ...ctxProjs.map(p => ({
      entity_type:   'PROJECTION',
      entity_id:     p.target_node_id,
      state:         p.risk,
      confidence:    p.confidence,
      actionability: projectionActionability(p),
      reason:        projActionReason(p),
    })),
  ];

  const hasSafetyCritical = actionable_findings.some(f => f.actionability === 'SAFETY_CRITICAL');
  const hasDirection      = actionable_findings.some(f => DIRECTION_LEVELS.has(f.actionability));

  // Blocking uncertainties exist only when the context has NO direction-level findings.
  // If direction is already established (RISK_RELEVANT or ACTIONABLE), unknowns refine
  // but don't change the decision branch — so no blocking.
  const blocking_uncertainties = [];

  if (!hasDirection) {
    const seenEntities = new Set();
    for (const need of contextNeeds) {
      if (need.decision_impact !== 'high') continue;
      for (const nf of need.needed_for) {
        if (!ctxNodeIds.has(nf.entity_id) && !ctxProjIds.has(nf.entity_id)) continue;
        if (seenEntities.has(nf.entity_id)) continue;

        if (nf.entity_type === 'NODE_STATE') {
          const s = ctxStates.find(s => s.node_id === nf.entity_id);
          if (s?.current_state !== 'UNKNOWN') continue;
          seenEntities.add(nf.entity_id);
          blocking_uncertainties.push({
            evidence_type: need.evidence_type,
            entity_id:     nf.entity_id,
            reason:        `${nf.entity_id} (UNKNOWN) — žádná jiná direction-level evidence v kontextu ${ctx.id}`,
          });
          break;
        }

        if (nf.entity_type === 'PROJECTION') {
          const p = ctxProjs.find(p => p.target_node_id === nf.entity_id);
          if (p?.risk !== 'unknown') continue;
          seenEntities.add(nf.entity_id);
          blocking_uncertainties.push({
            evidence_type: need.evidence_type,
            entity_id:     nf.entity_id,
            reason:        `Projekce ${nf.entity_id} (risk=unknown) — žádná jiná direction-level evidence v kontextu ${ctx.id}`,
          });
          break;
        }
      }
    }
  }

  // ── Status decision ───────────────────────────────────────────────────────
  let status, reason;

  if (hasSafetyCritical) {
    const critical = actionable_findings.filter(f => f.actionability === 'SAFETY_CRITICAL').map(f => f.entity_id).join(', ');
    status = 'EVIDENCE_SUFFICIENT';
    reason = `Safety override: SAFETY_CRITICAL nález (${critical}) — okamžitá akce, bez čekání na evidenci.`;
  } else if (hasDirection) {
    const dir = actionable_findings.filter(f => DIRECTION_LEVELS.has(f.actionability)).map(f => f.entity_id).join(', ');
    status = 'EVIDENCE_SUFFICIENT';
    reason = `Direction je jasný: ${dir}. Chybějící evidence zpřesňuje detail, nemění větev rozhodnutí.`;
  } else if (blocking_uncertainties.length > 0) {
    const bl = blocking_uncertainties.map(b => b.entity_id).join(', ');
    status = 'NEED_MORE_EVIDENCE';
    reason = `Žádné direction-level findings v kontextu ${ctx.id}. Blocking uncertainty: ${bl}.`;
  } else {
    status = 'NEED_MORE_EVIDENCE';
    reason = `Žádné actionable findings v kontextu ${ctx.id}.`;
  }

  // ── Per-context NEXT_BEST_EVIDENCE ────────────────────────────────────────
  // Only generated when this specific context needs more evidence.
  const next_best_evidence = status === 'NEED_MORE_EVIDENCE'
    ? selectNextBestEvidence(contextNeeds, ctxStates, ctxProjs, engineVersion)
    : null;

  return {
    decision_context: ctx,
    status,
    blocking_uncertainties,
    actionable_findings,
    next_best_evidence,
    reason,
  };
}

// ── Gate aggregate ────────────────────────────────────────────────────────────

export function evaluateDecisionGate(nodeStates, projections, informationNeeds, engineVersion) {
  const now = new Date().toISOString();

  const contexts = inferDecisionContexts(nodeStates, projections);

  const context_gates = contexts.map(ctx => {
    // Filter information needs to those relevant to this context's nodes/projections
    const ctxNodeIds = new Set(ctx.active_nodes.map(n => n.node_id));
    const ctxProjIds = new Set(ctx.active_projections.map(p => p.target));

    const contextNeeds = informationNeeds.filter(need =>
      need.needed_for.some(nf => ctxNodeIds.has(nf.entity_id) || ctxProjIds.has(nf.entity_id))
    );

    return evaluateContextGate(ctx, nodeStates, projections, contextNeeds, engineVersion);
  });

  // Global aggregate — never overrides per-context decisions
  const any_context_action_ready   = context_gates.some(g => g.status === 'EVIDENCE_SUFFICIENT');
  const contexts_needing_evidence  = context_gates
    .filter(g => g.status === 'NEED_MORE_EVIDENCE')
    .map(g => g.decision_context.id);

  return {
    context_gates,
    any_context_action_ready,
    contexts_needing_evidence,
    evaluated_at:   now,
    engine_version: engineVersion,
  };
}
