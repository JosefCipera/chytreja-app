// activation.js — ACTIVATION pass
// Input:  {person, clinicalHistory, observations}
// Output: PERSON_NODE_STATE[] — states supported by direct data
//
// Rules:
//   CONFIRMED  = present in CLINICAL_HISTORY.diagnoses with status=confirmed
//   MEASURED   = directly derivable from OBSERVATIONS with sufficient data
//   Only these two states come from activation.
//   PREDICTED_CURRENT and UNKNOWN are handled in inference.js.

export function activation(person, clinicalHistory, observations) {
  const states = [];

  const diagById = id => clinicalHistory.diagnoses.find(d => d.id === id && d.status === 'confirmed');

  // ── HYPERTENSION ──────────────────────────────────────────────────────────
  // Source: CLINICAL_HISTORY.diagnoses (confirmed clinical fact)
  // BP observations are supporting evidence only — a single reading does not confirm HTN
  const htDiag = diagById('HYPERTENSION');
  if (htDiag) {
    const bpObs = observations.filter(o => o.obs_type === 'bp_systolic' || o.obs_type === 'bp_diastolic');
    states.push({
      node_id: 'HYPERTENSION',
      current_state: 'CONFIRMED',
      confidence: 'high',
      evidence: {
        direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: htDiag.raw_label }],
        supporting: bpObs.map(o => ({ source: 'OBSERVATION', obs_type: o.obs_type, value: o.value, unit: o.unit, measured_at: o.measured_at, data_confidence: o.confidence })),
        inferred_from_nodes: [],
      },
      missing_evidence: bpObs.length === 0
        ? [{ type: 'OBSERVATION', obs_type: 'bp_systolic', note: 'Aktuální měření TK s datumem pro sledování kontroly HTN' }]
        : [],
    });
  }

  // ── ERECTILE_DYSFUNCTION ─────────────────────────────────────────────────
  // Source: CLINICAL_HISTORY.diagnoses (confirmed clinical fact)
  const edDiag = diagById('ERECTILE_DYSFUNCTION');
  if (edDiag) {
    states.push({
      node_id: 'ERECTILE_DYSFUNCTION',
      current_state: 'CONFIRMED',
      confidence: 'high',
      evidence: {
        direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'ERECTILE_DYSFUNCTION', raw_label: edDiag.raw_label }],
        supporting: [],
        inferred_from_nodes: [],
      },
      missing_evidence: [],
    });
  }

  // ── PHYSICAL_INACTIVITY ──────────────────────────────────────────────────
  // MEASURED: consistent low activity in daily_checkin (min 5 entries for reliability)
  // sedentary_work=true alone → supporting evidence only, not sufficient for MEASURED
  const activityObs = observations.filter(o => o.obs_type === 'activity_level' && o.source === 'daily_checkin');
  const sedHoursObs = observations.find(o => o.obs_type === 'sedentary_hours_day');
  const lowDays = activityObs.filter(o => o.value === 'low').length;
  const totalDays = activityObs.length;
  const lowRatio = totalDays >= 5 ? lowDays / totalDays : null;

  if (lowRatio !== null && lowRatio >= 0.7) {
    states.push({
      node_id: 'PHYSICAL_INACTIVITY',
      current_state: 'MEASURED',
      confidence: lowRatio >= 0.85 ? 'high' : 'medium',
      evidence: {
        direct: [{
          source: 'OBSERVATION',
          obs_type: 'activity_level',
          summary: `${lowDays}/${totalDays} dní s nízkou aktivitou (${Math.round(lowRatio * 100)}%)`,
        }],
        supporting: [
          ...(clinicalHistory.lifestyle.sedentary_work ? [{ source: 'CLINICAL_HISTORY', type: 'LIFESTYLE', field: 'sedentary_work', value: true }] : []),
          ...(sedHoursObs ? [{ source: 'OBSERVATION', obs_type: 'sedentary_hours_day', value: sedHoursObs.value }] : []),
        ],
        inferred_from_nodes: [],
      },
      missing_evidence: [
        { type: 'OBSERVATION', obs_type: 'steps_day', note: 'Kroky/den (wearable) pro objektivnější měření aktivity' },
      ],
    });
  } else if (clinicalHistory.lifestyle.sedentary_work || (sedHoursObs && sedHoursObs.value >= 8)) {
    // Sedentary work or hours known, but no check-in data → PREDICTED_CURRENT here
    // (activation can produce PREDICTED_CURRENT if direct data is behavioral self-report)
    states.push({
      node_id: 'PHYSICAL_INACTIVITY',
      current_state: 'PREDICTED_CURRENT',
      confidence: 'low',
      evidence: {
        direct: [],
        supporting: [
          ...(clinicalHistory.lifestyle.sedentary_work ? [{ source: 'CLINICAL_HISTORY', type: 'LIFESTYLE', field: 'sedentary_work', value: true, note: 'Sedentary work alone is supporting, not direct evidence' }] : []),
          ...(sedHoursObs ? [{ source: 'OBSERVATION', obs_type: 'sedentary_hours_day', value: sedHoursObs.value }] : []),
        ],
        inferred_from_nodes: [],
      },
      missing_evidence: [
        { type: 'OBSERVATION', obs_type: 'activity_level', note: 'Min. 5 daily check-inů pro určení MEASURED stavu' },
        { type: 'OBSERVATION', obs_type: 'steps_day', note: 'Kroky/den (wearable)' },
      ],
    });
  }

  // ── EXCESS_ADIPOSITY ─────────────────────────────────────────────────────
  // MEASURED from latest reliable weight observation + person.height_cm → derived BMI
  // BMI is a proxy for adiposity, not a direct measure of body fat.
  // This node does NOT map to OBESITY. Adiposity categories require DataDictionary rules
  // (waist_cm + body_fat_pct thresholds — not yet defined).
  // Selection rule (Health Data Model v1):
  // 1. Dated observation always beats undated — regardless of confidence/source.
  // 2. Among dated: newest measured_at wins.
  // 3. Among undated (tie on date criterion): higher confidence/source quality wins.
  // 4. Historical observations are never deleted — only the selected one is used here.
  const weightObs = observations
    .filter(o => o.obs_type === 'weight_kg')
    .sort((a, b) => {
      if (a.measured_at && !b.measured_at) return -1;
      if (!a.measured_at && b.measured_at) return 1;
      if (a.measured_at && b.measured_at) return b.measured_at.localeCompare(a.measured_at);
      if (a.confidence === 'confirmed' && b.confidence !== 'confirmed') return -1;
      if (b.confidence === 'confirmed' && a.confidence !== 'confirmed') return 1;
      return 0;
    });
  const latestWeight = weightObs[0];

  if (latestWeight && person.height_cm) {
    const bmi = latestWeight.value / ((person.height_cm / 100) ** 2);
    if (bmi >= 25) {
      const waistObs = observations.find(o => o.obs_type === 'waist_cm');
      const bfObs    = observations.find(o => o.obs_type === 'body_fat_pct');
      states.push({
        node_id: 'EXCESS_ADIPOSITY',
        current_state: 'MEASURED',
        confidence: waistObs ? 'medium' : 'low',  // BMI alone is imprecise proxy
        evidence: {
          direct: [{
            source: 'OBSERVATION',
            obs_type: 'weight_kg',
            value: latestWeight.value,
            unit: 'kg',
            measured_at: latestWeight.measured_at,
            derived_bmi: parseFloat(bmi.toFixed(1)),
            height_cm: person.height_cm,
            note: 'BMI = hrubý proxy adipozity. Nepotvrzen přesnějšími markery.',
          }],
          supporting: [
            ...(waistObs ? [{ source: 'OBSERVATION', obs_type: 'waist_cm', value: waistObs.value, unit: 'cm' }] : []),
            ...(bfObs    ? [{ source: 'OBSERVATION', obs_type: 'body_fat_pct', value: bfObs.value }] : []),
          ],
          inferred_from_nodes: [],
        },
        missing_evidence: [
          ...(!waistObs ? [{ type: 'OBSERVATION', obs_type: 'waist_cm', note: 'Obvod pasu — silnější marker viscerální adipozity než BMI' }] : []),
          ...(!bfObs    ? [{ type: 'OBSERVATION', obs_type: 'body_fat_pct', note: 'Podíl tělesného tuku (DEXA nebo bioimpedance)' }] : []),
        ],
      });
    }
  }

  return states;
}
