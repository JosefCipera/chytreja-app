// nextBestEvidence.js — NEXT_BEST_EVIDENCE selection (Engine v1)
//
// Lexicographic selection rule (no numeric pseudo-scoring):
//   A. urgency            high > medium > low
//   B. decision_impact    high > medium > low
//   C. uncertainty_reduction  high > medium > low
//   D. acquisition_cost   very_low < low < medium < high
//
// STOP RULE: returns null when no candidate would materially change the current decision.
// CHJ does not collect data just because it's missing.

const URGENCY_RANK = { high: 0, medium: 1, low: 2 };
const IMPACT_RANK  = { high: 0, medium: 1, low: 2 };
const UNCERT_RANK  = { high: 0, medium: 1, low: 2 };
const COST_RANK    = { very_low: 0, low: 1, medium: 2, high: 3 };

function lexRank(a, b) {
  const diff = (rank, key) => (rank[a[key]] ?? 99) - (rank[b[key]] ?? 99);
  return diff(URGENCY_RANK, 'urgency')
      || diff(IMPACT_RANK,  'decision_impact')
      || diff(UNCERT_RANK,  'uncertainty_reduction')
      || diff(COST_RANK,    'acquisition_cost');
}

function buildExpectedEffect(best, nodeStates, projections) {
  const stateById = Object.fromEntries(nodeStates.map(s => [s.node_id, s]));
  const projById  = Object.fromEntries(projections.map(p => [p.target_node_id, p]));
  const effects = [];

  for (const nf of best.needed_for) {
    if (nf.entity_type === 'NODE_STATE') {
      const s = stateById[nf.entity_id];
      let change;
      if (s?.current_state === 'UNKNOWN')
        change = 'UNKNOWN → MEASURED (pokud evidence potvrdí stav) nebo UNKNOWN → ABSENT (pokud stav vyloučí)';
      else if (s?.current_state === 'PREDICTED_CURRENT')
        change = 'PREDICTED_CURRENT → MEASURED (přímá evidence potvrdí) nebo zpřesnění confidence';
      else if (s?.current_state === 'CONFIRMED')
        change = 'CONFIRMED → zpřesnění aktuálního kontrolního stavu; supporting evidence zvýší confidence projekcí';
      else
        change = 'zpřesnění stavu';
      effects.push({ entity_type: 'NODE_STATE', entity_id: nf.entity_id, possible_change: change });
    } else if (nf.entity_type === 'PROJECTION') {
      const p = projById[nf.entity_id];
      const riskStr = p ? `risk=${p.risk}` : 'risk=unknown';
      const confStr = p?.confidence ?? 'unknown';
      effects.push({
        entity_type: 'PROJECTION',
        entity_id:   nf.entity_id,
        // risk_level and confidence are separate axes:
        //   risk_level  — may change based on the observed value
        //   confidence  — improves only with completeness of the full evidence set
        //                 AND a calibrated model; never auto-upgrades from a single observation
        possible_change:
          `${riskStr} může změnit kategorii podle naměřené hodnoty. ` +
          `confidence=${confStr} zůstává — zvýší se až při kompletní sadě evidence a kalibrovaném modelu (calibrated=false).`,
      });
    }
  }
  return effects;
}

function buildReason(best, ranked) {
  // Explain selection and why the next best candidates lost
  const parts = [
    `Vybráno lexikograficky (A→B→C→D): urgency=${best.urgency}, decision_impact=${best.decision_impact}, uncertainty_reduction=${best.uncertainty_reduction}, acquisition_cost=${best.acquisition_cost}.`,
  ];
  const losers = ranked.slice(1, 4).map(c => {
    if (URGENCY_RANK[c.urgency] > URGENCY_RANK[best.urgency])
      return `"${c.evidence_type}" ztratil na urgency (${c.urgency} < ${best.urgency})`;
    if (IMPACT_RANK[c.decision_impact] > IMPACT_RANK[best.decision_impact])
      return `"${c.evidence_type}" ztratil na decision_impact (${c.decision_impact} < ${best.decision_impact})`;
    if (UNCERT_RANK[c.uncertainty_reduction] > UNCERT_RANK[best.uncertainty_reduction])
      return `"${c.evidence_type}" ztratil na uncertainty_reduction`;
    if (COST_RANK[c.acquisition_cost] > COST_RANK[best.acquisition_cost])
      return `"${c.evidence_type}" ztratil na acquisition_cost (${c.acquisition_cost} > ${best.acquisition_cost})`;
    return `"${c.evidence_type}" (tie, secondary ordering)`;
  });
  if (losers.length > 0) parts.push(`Porazil: ${losers.join('; ')}.`);
  return parts.join(' ');
}

export function selectNextBestEvidence(informationNeeds, nodeStates, projections, engineVersion) {
  if (!informationNeeds || informationNeeds.length === 0) return null;

  // STOP RULE: skip candidates with no material decision impact
  const viable = informationNeeds.filter(n =>
    n.decision_impact === 'high' || n.decision_impact === 'medium'
  );
  if (viable.length === 0) return null;

  const ranked = [...viable].sort(lexRank);
  const best   = ranked[0];

  // Secondary STOP RULE: if the winner has all-low profile, no recommendation
  if (best.urgency === 'low' && best.decision_impact === 'low') return null;

  return {
    evidence_type:        best.evidence_type,
    acquisition_method:   best.acquisition_method,
    reason:               buildReason(best, ranked),
    expected_effect:      buildExpectedEffect(best, nodeStates, projections),
    decision_impact:      best.decision_impact,
    uncertainty_reduction: best.uncertainty_reduction,
    acquisition_cost:     best.acquisition_cost,
    urgency:              best.urgency,
    selected_at:          new Date().toISOString(),
    engine_version:       engineVersion,
  };
}
