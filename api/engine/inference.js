// inference.js — INFERENCE pass
// Input:  activatedStates[], {person, clinicalHistory, observations}
// Output: additional PERSON_NODE_STATE[] with current_state = PREDICTED_CURRENT
//
// Rules:
//   Inference uses activated states + additional clinical evidence to predict
//   hidden states that are not yet directly measured or diagnosed.
//   Inference does NOT reverse Master edges — it's a diagnostic direction
//   that runs from observed effects toward hidden causes.
//
// Example: ED (confirmed) + HTN (confirmed) + DYSLIPIDEMIA → ENDOTHELIAL_DYSFUNCTION (predicted)
//   This is NOT "ED causes endothelial dysfunction."
//   It IS "presence of ED + vascular risk factors makes endothelial dysfunction likely."

export function inference(activatedStates, person, clinicalHistory, observations) {
  const states = [];
  const stateById = Object.fromEntries(activatedStates.map(s => [s.node_id, s]));
  const diagById  = id => clinicalHistory.diagnoses.find(d => d.id === id && d.status === 'confirmed');

  // ── INSULIN_RESISTANCE ──────────────────────────────────────────────────
  if (!stateById['INSULIN_RESISTANCE']) {
    const signals = [];
    let strength = 0;

    const adiposity = stateById['EXCESS_ADIPOSITY'];
    if (adiposity) {
      signals.push({ node_id: 'EXCESS_ADIPOSITY', current_state: adiposity.current_state, role: 'primary metabolic contributor (visceral fat → IR)' });
      strength += adiposity.confidence === 'high' ? 2 : 1;
    }

    const inactivity = stateById['PHYSICAL_INACTIVITY'];
    if (inactivity) {
      signals.push({ node_id: 'PHYSICAL_INACTIVITY', current_state: inactivity.current_state, role: 'reduces muscle glucose uptake → IR' });
      strength += 1;
    }

    const htn = stateById['HYPERTENSION'];
    if (htn) {
      signals.push({ node_id: 'HYPERTENSION', current_state: htn.current_state, role: 'metabolic syndrome cluster signal' });
      strength += 1;
    }

    if (diagById('DYSLIPIDEMIA')) {
      signals.push({ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'DYSLIPIDEMIA', role: 'atherogenic dyslipidemia associated with IR' });
      strength += 1;
    }
    if (diagById('HYPERURICEMIA')) {
      signals.push({ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERURICEMIA', role: 'hyperuricemia correlates with metabolic dysregulation' });
      strength += 1;
    }

    const glucoseObs = observations.filter(o => o.obs_type === 'lab_glucose_fasting');
    if (glucoseObs.length > 0) {
      const maxGlucose = Math.max(...glucoseObs.map(o => o.value));
      if (maxGlucose >= 5.6) {
        signals.push({ source: 'OBSERVATION', obs_type: 'lab_glucose_fasting', value: maxGlucose, note: maxGlucose >= 7.0 ? 'Diabetické rozmezí' : 'Prediabetické rozmezí' });
        strength += maxGlucose >= 7.0 ? 2 : 1;
      }
    }

    if (strength >= 2) {
      states.push({
        node_id: 'INSULIN_RESISTANCE',
        current_state: 'PREDICTED_CURRENT',
        confidence: strength >= 5 ? 'medium' : 'low',
        evidence: {
          direct: [],
          supporting: [],
          inferred_from_nodes: signals,
        },
        missing_evidence: [
          { type: 'OBSERVATION', obs_type: 'lab_homa_ir', note: 'HOMA-IR (lačný inzulín + glukóza) — nejpřesnější dostupný marker' },
          { type: 'OBSERVATION', obs_type: 'lab_hba1c',   note: 'HbA1c — 3měsíční průměr glykémie' },
          { type: 'OBSERVATION', obs_type: 'waist_cm',    note: 'Obvod pasu > 94 cm (muž) = metabolický rizikový faktor' },
        ],
      });
    }
  }

  // ── ENDOTHELIAL_DYSFUNCTION ──────────────────────────────────────────────
  // Diagnostic inference: downstream functional outcome (ED) + vascular stressors
  // → predict upstream mechanism (endothelial dysfunction)
  // This is NOT reversing the Master edge ENDOTHELIAL_DYSFUNCTION → ED.
  // It IS: "vaskulární ED + HTN + dyslipidémie = vysoká pravděpodobnost endoteliální dysfunkce"
  if (!stateById['ENDOTHELIAL_DYSFUNCTION']) {
    const signals = [];
    let strength = 0;

    const ed = stateById['ERECTILE_DYSFUNCTION'];
    if (ed?.current_state === 'CONFIRMED') {
      signals.push({ node_id: 'ERECTILE_DYSFUNCTION', current_state: 'CONFIRMED', role: 'vaskulární ED je z >70 % endoteliálního původu; downstream indicator' });
      strength += 2;
    }

    const htn = stateById['HYPERTENSION'];
    if (htn?.current_state === 'CONFIRMED') {
      signals.push({ node_id: 'HYPERTENSION', current_state: 'CONFIRMED', role: 'chronická HTN poškozuje endotel mechanicky i oxidativně' });
      strength += 2;
    }

    if (diagById('DYSLIPIDEMIA')) {
      signals.push({ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'DYSLIPIDEMIA', role: 'aterogenní LDL a oxidativní stres poškozují endotel' });
      strength += 1;
    }
    if (diagById('HYPERURICEMIA')) {
      signals.push({ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERURICEMIA', role: 'kyselina močová inhibuje NO syntázu → endoteliální dysfunkce' });
      strength += 1;
    }

    if (strength >= 3) {
      states.push({
        node_id: 'ENDOTHELIAL_DYSFUNCTION',
        current_state: 'PREDICTED_CURRENT',
        confidence: strength >= 5 ? 'medium' : 'low',
        evidence: {
          direct: [],
          supporting: [],
          inferred_from_nodes: signals,
        },
        missing_evidence: [
          { type: 'OBSERVATION', obs_type: 'fmd_test',    note: 'FMD (flow-mediated dilation) — zlatý standard funkce endotelu' },
          { type: 'OBSERVATION', obs_type: 'abi_index',   note: 'ABI index — neinvazivní marker periferní vaskulární funkce' },
          { type: 'OBSERVATION', obs_type: 'lab_apob',    note: 'ApoB — silnější aterogenní marker než LDL' },
        ],
      });
    }
  }

  return states;
}
