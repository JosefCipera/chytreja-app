// informationNeeds.js — INFORMATION_NEED aggregation (Engine v1)
//
// Collects missing_evidence from all node_states and projections,
// deduplicates by evidence type, and annotates each candidate with:
//   decision_impact, uncertainty_reduction, acquisition_cost, urgency, acquisition_method.
//
// Does NOT select. Selection is in nextBestEvidence.js.
//
// Deduplication rule: same obs_type (or question_id) from multiple entities
// → one INFORMATION_NEED with multiple needed_for[] entries.

// Some obs_type strings refer to the same measurement under a different name.
// Canonical form is the simpler one (without qualifiers).
const EVIDENCE_SYNONYMS = {
  bp_systolic_controlled: 'bp_systolic',
};

function canonicalKey(item) {
  const k = item.obs_type || item.question_id;
  if (!k) return null;
  return EVIDENCE_SYNONYMS[k] || k;
}

// Domain sets drive urgency inference
const CV_ENTITIES = new Set([
  'HYPERTENSION', 'ENDOTHELIAL_DYSFUNCTION', 'ERECTILE_DYSFUNCTION',
  'CARDIOVASCULAR_DISEASE', 'ATRIAL_FIBRILLATION',
]);
const METABOLIC_NODES = new Set(['EXCESS_ADIPOSITY', 'INSULIN_RESISTANCE']);
const FUNCTIONAL_NODES = new Set([
  'PHYSICAL_DECONDITIONING', 'LOW_MUSCLE_STRENGTH',
  'REDUCED_FUNCTIONAL_RESERVE', 'LOSS_OF_FLOOR_RISE_ABILITY',
]);
const MOBILITY_NODES = new Set(['GAIT_INSTABILITY', 'FALL_RISK', 'PERIPHERAL_NEUROPATHY']);

// Acquisition method from evidence type
function inferAcquisitionMethod(evidenceType, rawType) {
  if (rawType === 'ONBOARDING') return 'question';
  if (evidenceType === 'activity_level') return 'question';
  if (['bp_systolic', 'bp_diastolic', 'weight_kg', 'waist_cm'].includes(evidenceType))
    return 'home_measurement';
  if (evidenceType.startsWith('lab_')) return 'laboratory';
  if (['steps_day', 'temporal_activity_trend'].includes(evidenceType)) return 'wearable';
  if (['floor_rise_test', 'validated_strength_assessment', 'grip_strength',
       'chair_stand_30s', 'tug_test'].includes(evidenceType)) return 'functional_test';
  // Mobility assessment — quick self-report questions
  if (['gait_stability', 'recent_falls', 'current_assistive_device', 'instability_laterality'].includes(evidenceType))
    return 'question';
  return 'clinician';
}

const ACQUISITION_COST = {
  question:         'very_low',
  home_measurement: 'low',
  functional_test:  'medium',
  wearable:         'medium',
  laboratory:       'high',
  clinician:        'high',
};

// Urgency: driven by domain and actionability of the needed evidence.
//
// HIGH: evidence is needed for a CONFIRMED CV node state — it is actionable for
//   current management (e.g. bp_systolic for HYPERTENSION already confirmed).
//   Evidence needed only for a projection or a PREDICTED_CURRENT state is
//   risk-refinement, not urgently actionable → medium.
//
// MEDIUM: metabolic or functional domain, or CV but not confirmed/actionable.
// LOW: lifestyle/behavioral or other.
function inferUrgency(neededFor, stateById) {
  let max = 'low';
  for (const n of neededFor) {
    const id = n.entity_id;
    if (CV_ENTITIES.has(id)) {
      if (n.entity_type === 'NODE_STATE') {
        const s = stateById[id];
        // HIGH only when the CV condition is confirmed — evidence is actionable NOW
        if (s?.current_state === 'CONFIRMED') return 'high';
      }
      // CV projection or PREDICTED_CURRENT → risk-refinement, not urgent
      if (max !== 'high') max = 'medium';
    } else if (MOBILITY_NODES.has(id)) {
      // Fall prevention is time-critical — even PREDICTED_CURRENT gait instability warrants urgent assessment
      return 'high';
    } else if (METABOLIC_NODES.has(id) || FUNCTIONAL_NODES.has(id)) {
      if (max === 'low') max = 'medium';
    }
  }
  return max;
}

// Decision impact: highest possible change this evidence could enable.
//   UNKNOWN → any direct measurement: high
//   projection risk/confidence = 'unknown': high
//   PREDICTED_CURRENT → MEASURED: medium
//   projection confidence = 'low': medium
//   only supporting a CONFIRMED/MEASURED: low
function inferDecisionImpact(neededFor, stateById, projById) {
  let max = 'low';
  for (const n of neededFor) {
    let impact = 'low';
    if (n.entity_type === 'NODE_STATE') {
      const s = stateById[n.entity_id];
      if (s?.current_state === 'UNKNOWN') return 'high';
      if (s?.current_state === 'PREDICTED_CURRENT') impact = 'medium';
    } else if (n.entity_type === 'PROJECTION') {
      const p = projById[n.entity_id];
      if (p?.risk === 'unknown' || p?.confidence === 'unknown') return 'high';
      if (p?.confidence === 'low') impact = 'medium';
    }
    if (impact === 'medium') max = 'medium';
  }
  return max;
}

// Uncertainty reduction: how much does obtaining this evidence shrink key unknowns?
//   Any needed_for UNKNOWN state: high (direct resolution)
//   needed_for 2+ entities (broad leverage): high
//   PREDICTED_CURRENT or any projection benefit: medium
//   otherwise: low
function inferUncertaintyReduction(neededFor, stateById) {
  for (const n of neededFor) {
    if (n.entity_type === 'NODE_STATE' && stateById[n.entity_id]?.current_state === 'UNKNOWN')
      return 'high';
  }
  if (neededFor.length >= 2) return 'high';

  for (const n of neededFor) {
    if (n.entity_type === 'PROJECTION') return 'medium';
    if (n.entity_type === 'NODE_STATE' && stateById[n.entity_id]?.current_state === 'PREDICTED_CURRENT')
      return 'medium';
  }
  return 'low';
}

export function buildInformationNeeds(nodeStates, projections) {
  // 1. Collect raw missing_evidence with provenance
  const raw = [];
  for (const state of nodeStates) {
    for (const me of (state.missing_evidence || [])) {
      raw.push({ ...me, _from_entity_type: 'NODE_STATE', _from_entity_id: state.node_id });
    }
  }
  for (const proj of projections) {
    for (const me of (proj.missing_evidence || [])) {
      raw.push({ ...me, _from_entity_type: 'PROJECTION', _from_entity_id: proj.target_node_id });
    }
  }

  // 2. Deduplicate by canonical evidence key
  const needMap = new Map();
  for (const item of raw) {
    const key = canonicalKey(item);
    if (!key) continue;
    if (!needMap.has(key)) {
      needMap.set(key, {
        id:          `NEED_${key.toUpperCase()}`,
        evidence_type: key,
        needed_for:  [],
        _rawType:    item.type,
        _notes:      [],
      });
    }
    const need = needMap.get(key);
    const nf = { entity_type: item._from_entity_type, entity_id: item._from_entity_id };
    if (!need.needed_for.some(n => n.entity_type === nf.entity_type && n.entity_id === nf.entity_id))
      need.needed_for.push(nf);
    if (item.note) need._notes.push(item.note);
  }

  // 3. Annotate each candidate
  const stateById = Object.fromEntries(nodeStates.map(s => [s.node_id, s]));
  const projById  = Object.fromEntries(projections.map(p => [p.target_node_id, p]));

  return Array.from(needMap.values()).map(need => {
    const method             = inferAcquisitionMethod(need.evidence_type, need._rawType);
    const acquisition_cost   = ACQUISITION_COST[method];
    const urgency            = inferUrgency(need.needed_for, stateById);
    const decision_impact    = inferDecisionImpact(need.needed_for, stateById, projById);
    const uncertainty_reduction = inferUncertaintyReduction(need.needed_for, stateById);
    const explanation        = need._notes[0] || `Evidence "${need.evidence_type}" chybí pro: ${need.needed_for.map(n => n.entity_id).join(', ')}.`;

    return {
      id: need.id,
      evidence_type: need.evidence_type,
      needed_for: need.needed_for,
      decision_impact,
      uncertainty_reduction,
      acquisition_cost,
      urgency,
      acquisition_method: method,
      explanation,
    };
  });
}
