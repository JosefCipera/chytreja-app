// decisionGate.js — DECISION_GATE evaluation (Engine v1)
//
// Core question: "Do we know enough for the NEXT DECISION?"
// NOT: "Do we have a complete health profile?"
//
// NEED_MORE_EVIDENCE: only when a missing item would change the decision BRANCH
//   (whether a problem exists, its significance, or which action to take)
//   AND acquiring it is proportionate to the decision's importance.
//
// EVIDENCE_SUFFICIENT: when the decision direction is already clear from existing
//   evidence — even if many missing_evidence items remain in the system.
//
// SAFETY OVERRIDE: if any finding is SAFETY_RELEVANT, never delay for evidence.

// Domain sets (mirrors informationNeeds.js concept — no shared import to keep modules flat)
const CV_NODES        = new Set(['HYPERTENSION', 'ENDOTHELIAL_DYSFUNCTION', 'ERECTILE_DYSFUNCTION', 'ATRIAL_FIBRILLATION']);
const METABOLIC_NODES = new Set(['EXCESS_ADIPOSITY', 'INSULIN_RESISTANCE']);
const FUNCTIONAL_NODES = new Set([
  'PHYSICAL_INACTIVITY', 'PHYSICAL_DECONDITIONING',
  'LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE', 'LOSS_OF_FLOOR_RISE_ABILITY',
]);
const CV_PROJ_TARGETS   = new Set(['CARDIOVASCULAR_DISEASE']);
const FUNC_PROJ_TARGETS = new Set(['LOSS_OF_FLOOR_RISE_ABILITY']);

// ── Actionability rules ───────────────────────────────────────────────────────

function nodeDomain(node_id) {
  if (CV_NODES.has(node_id) || node_id === 'ERECTILE_DYSFUNCTION') return 'cv';
  if (METABOLIC_NODES.has(node_id))  return 'metabolic';
  if (FUNCTIONAL_NODES.has(node_id)) return 'functional';
  return 'other';
}

function nodeActionability(state) {
  const { node_id, current_state, confidence } = state;
  if (current_state === 'CONFIRMED')
    return CV_NODES.has(node_id) ? 'SAFETY_RELEVANT' : 'ACTIONABLE';
  if (current_state === 'MEASURED')
    return 'ACTIONABLE';
  if (current_state === 'PREDICTED_CURRENT') {
    // Behavioral nodes: action direction is clear regardless of measurement precision
    if (node_id === 'PHYSICAL_INACTIVITY' || node_id === 'PHYSICAL_DECONDITIONING')
      return 'ACTIONABLE';
    return 'MONITOR';
  }
  return 'NOT_YET_ACTIONABLE';
}

function projectionActionability(proj) {
  if (proj.risk === 'unknown' || proj.confidence === 'unknown') return 'NOT_YET_ACTIONABLE';
  if (proj.risk === 'elevated') return 'ACTIONABLE'; // direction clear even without calibration
  return 'MONITOR';
}

function nodeActionReason(state) {
  const { node_id, current_state, confidence } = state;
  const act = nodeActionability(state);
  if (act === 'SAFETY_RELEVANT')
    return `Potvrzená diagnóza v KV doméně — vyžaduje aktivní sledování a management`;
  if (current_state === 'CONFIRMED')
    return `Potvrzená diagnóza`;
  if (current_state === 'MEASURED')
    return `Přímo změřeno — data pro rozhodnutí k dispozici`;
  if (current_state === 'PREDICTED_CURRENT') {
    if (node_id === 'PHYSICAL_INACTIVITY')
      return `Sedavý životní styl identifikován — behaviorální změna indikována bez ohledu na přesnost měření`;
    if (node_id === 'PHYSICAL_DECONDITIONING')
      return `Fyzická dekondice predikována z inaktivity — pohybová intervence indikována`;
    return `Predikováno z kombinace dat (confidence=${confidence}) — monitorovat, potvrdit přímou evidencí`;
  }
  return `Stav neznámý — čeká na evidenci`;
}

function projActionReason(proj) {
  if (proj.risk === 'elevated')
    return `Směr rizika jasný (elevated) i při nekalibrované projekci — základ pro rozhodnutí existuje`;
  if (proj.risk === 'unknown')
    return `risk=unknown — projekci nelze použít pro rozhodnutí bez dalších dat`;
  return `Monitorovat vývoj`;
}

// ── Decision contexts ─────────────────────────────────────────────────────────
// Derived from active node_states and projections — not a hardcoded catalog.

function inferDecisionContexts(nodeStates, projections) {
  const contexts = [];

  const cvNodes = nodeStates.filter(s => CV_NODES.has(s.node_id) || s.node_id === 'ERECTILE_DYSFUNCTION');
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

// ── Blocking uncertainties ────────────────────────────────────────────────────
// Scans high-impact INFORMATION_NEEDs for material blockers.
//
// A blocking uncertainty is MATERIAL when:
//   1. There is an UNKNOWN node state (existence of the problem is undetermined)
//      OR a projection with risk=unknown (direction is unknown)
//   2. AND the same domain has NO other ACTIONABLE or SAFETY_RELEVANT finding
//      (meaning nothing else already determines the decision branch for that domain)
//
// If the domain already has an actionable finding, the UNKNOWN adds detail
// but does not change which branch to take → NOT a material blocker.

function identifyBlockingUncertainties(informationNeeds, nodeStates, projections) {
  const stateById = Object.fromEntries(nodeStates.map(s => [s.node_id, s]));
  const projById  = Object.fromEntries(projections.map(p => [p.target_node_id, p]));

  // Domains where the decision direction is already determined
  const domainsWithAction = new Set();
  for (const s of nodeStates) {
    const act = nodeActionability(s);
    if (act === 'ACTIONABLE' || act === 'SAFETY_RELEVANT') {
      domainsWithAction.add(nodeDomain(s.node_id));
    }
  }
  for (const p of projections) {
    if (projectionActionability(p) === 'ACTIONABLE') {
      if (CV_PROJ_TARGETS.has(p.target_node_id))   domainsWithAction.add('cv');
      if (FUNC_PROJ_TARGETS.has(p.target_node_id)) domainsWithAction.add('functional');
    }
  }

  const all = [];
  const seenTypes = new Set();

  for (const need of informationNeeds) {
    if (need.decision_impact !== 'high') continue;
    if (seenTypes.has(need.evidence_type)) continue;

    for (const nf of need.needed_for) {
      const id = nf.entity_id;

      if (nf.entity_type === 'NODE_STATE') {
        const s = stateById[id];
        if (s?.current_state !== 'UNKNOWN') continue;

        const domain = nodeDomain(id);
        const is_material_blocker = !domainsWithAction.has(domain);
        all.push({
          evidence_type: need.evidence_type,
          entity_id:     id,
          domain,
          is_material_blocker,
          reason: is_material_blocker
            ? `${id} (UNKNOWN) je jedinou evidencí v doméně "${domain}" — bez ní nelze určit existenci problému`
            : `${id} (UNKNOWN) — doména "${domain}" má jiný ACTIONABLE finding; UNKNOWN neblokuje NEXT DECISION`,
        });
        seenTypes.add(need.evidence_type);
        break;
      }

      if (nf.entity_type === 'PROJECTION') {
        const proj = projById[id];
        if (proj?.risk !== 'unknown') continue;

        const domain = CV_PROJ_TARGETS.has(id) ? 'cv' :
                       FUNC_PROJ_TARGETS.has(id) ? 'functional' : 'other';
        const is_material_blocker = !domainsWithAction.has(domain);
        all.push({
          evidence_type: need.evidence_type,
          entity_id:     id,
          domain,
          is_material_blocker,
          reason: is_material_blocker
            ? `Projekce ${id} (risk=unknown) — směr rizika neurčen a doména "${domain}" nemá jinou actionable evidenci`
            : `Projekce ${id} (risk=unknown) — doména "${domain}" má jiný ACTIONABLE finding; projekce neblokuje NEXT DECISION`,
        });
        seenTypes.add(need.evidence_type);
        break;
      }
    }
  }

  // Return only material blockers — non-blockers are implicit in the EVIDENCE_SUFFICIENT decision
  return all.filter(b => b.is_material_blocker);
}

// ── Gate evaluation ───────────────────────────────────────────────────────────

export function evaluateDecisionGate(nodeStates, projections, informationNeeds, engineVersion) {
  const now = new Date().toISOString();

  const decision_context = inferDecisionContexts(nodeStates, projections);

  const actionable_findings = [
    ...nodeStates.map(s => ({
      entity_type:   'NODE_STATE',
      entity_id:     s.node_id,
      state:         s.current_state,
      confidence:    s.confidence,
      actionability: nodeActionability(s),
      reason:        nodeActionReason(s),
    })),
    ...projections.map(p => ({
      entity_type:   'PROJECTION',
      entity_id:     p.target_node_id,
      state:         p.risk,
      confidence:    p.confidence,
      actionability: projectionActionability(p),
      reason:        projActionReason(p),
    })),
  ];

  const blocking_uncertainties = identifyBlockingUncertainties(informationNeeds, nodeStates, projections);
  const hasMaterialBlocker     = blocking_uncertainties.length > 0;
  const hasSafetyRelevant      = actionable_findings.some(f => f.actionability === 'SAFETY_RELEVANT');
  const hasActionable          = actionable_findings.some(f =>
    f.actionability === 'ACTIONABLE' || f.actionability === 'SAFETY_RELEVANT'
  );

  // Count high-impact needs evaluated (for reason transparency)
  const highImpactNeeds = informationNeeds.filter(n => n.decision_impact === 'high');

  let status, reason;

  if (hasSafetyRelevant && !hasMaterialBlocker) {
    // Safety override: confirmed high-risk condition warrants action now
    const safetyNodes = actionable_findings
      .filter(f => f.actionability === 'SAFETY_RELEVANT')
      .map(f => f.entity_id).join(', ');
    status = 'EVIDENCE_SUFFICIENT';
    reason =
      `Safety override: ${safetyNodes} jsou SAFETY_RELEVANT potvrzené nálezy — ` +
      `další sběr dat nesmí zdržovat bezpečný postup. ` +
      `Vyhodnoceno ${highImpactNeeds.length} high-impact INFORMATION_NEED(s): ` +
      `žádný není materiálním blokerem — každá doména má alespoň jeden ACTIONABLE finding.`;
  } else if (hasMaterialBlocker) {
    status = 'NEED_MORE_EVIDENCE';
    const blockerList = blocking_uncertainties.map(b => `${b.entity_id} (${b.domain})`).join(', ');
    reason =
      `Existuje ${blocking_uncertainties.length} materiální bloking uncertainty: ${blockerList}. ` +
      `Bez ní nelze určit existenci problému nebo volbu akce v dané doméně.`;
  } else if (hasActionable) {
    status = 'EVIDENCE_SUFFICIENT';
    const actionableList = actionable_findings
      .filter(f => f.actionability === 'ACTIONABLE' || f.actionability === 'SAFETY_RELEVANT')
      .map(f => f.entity_id).join(', ');
    reason =
      `Actionable findings jsou k dispozici: ${actionableList}. ` +
      `Žádná high-impact blocking uncertainty — každá doména má alespoň jeden ACTIONABLE finding. ` +
      `Chybějící evidence zpřesňuje detail, nezmění rozhodovací větev.`;
  } else {
    status = 'NEED_MORE_EVIDENCE';
    reason = `Žádný ACTIONABLE finding dosud — více evidence potřeba před zahájením rozhodnutí.`;
  }

  return {
    status,
    decision_context,
    blocking_uncertainties,
    actionable_findings,
    reason,
    evaluated_at:   now,
    engine_version: engineVersion,
  };
}
