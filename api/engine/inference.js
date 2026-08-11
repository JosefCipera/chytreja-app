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
          { type: 'OBSERVATION', obs_type: 'lab_homa_ir', note: 'HOMA-IR (lačný inzulín + glukóza) — praktický nepřímý odhad inzulinové rezistence; referenční metodou je euglykaemický clamp' },
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
      signals.push({ node_id: 'ERECTILE_DYSFUNCTION', current_state: 'CONFIRMED', role: 'ED je uznávaným markerem zvýšeného kardiovaskulárního rizika a může být spojena s endoteliální/vaskulární dysfunkcí; downstream indicator' });
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

  // ── PHYSICAL_DECONDITIONING ──────────────────────────────────────────────
  // Inferred from PHYSICAL_INACTIVITY state. Sustained inactivity leads to progressive
  // loss of cardiovascular and musculoskeletal fitness.
  // Confidence inherits from upstream: MEASURED inactivity → medium; PREDICTED → low.
  // Age is used as a contextual accelerator signal only — not a primary activator.
  if (!stateById['PHYSICAL_DECONDITIONING']) {
    const inactivity = stateById['PHYSICAL_INACTIVITY'];
    if (inactivity) {
      const signals = [{
        node_id:      'PHYSICAL_INACTIVITY',
        current_state: inactivity.current_state,
        role:          'sustained inactivity drives progressive deconditioning over months to years',
      }];

      const age = person.birth_year ? (new Date().getFullYear() - person.birth_year) : null;
      if (age && age >= 50) {
        signals.push({
          source: 'PERSON',
          field:  'age',
          value:  age,
          role:   'contextual accelerator — deconditioning progresses faster with age; not a primary activator',
        });
      }

      states.push({
        node_id:       'PHYSICAL_DECONDITIONING',
        current_state: 'PREDICTED_CURRENT',
        confidence:    inactivity.current_state === 'MEASURED' ? 'medium' : 'low',
        evidence: {
          direct: [],
          supporting: [],
          inferred_from_nodes: signals,
        },
        missing_evidence: [
          { type: 'OBSERVATION', obs_type: 'vo2max_test',  note: 'VO2max — přímý marker kardiorespirační kondice' },
          { type: 'OBSERVATION', obs_type: 'steps_day',    note: 'Kroky/den (wearable) pro objektivní měření aktivity v čase' },
        ],
      });
    }
  }

  // ── REDUCED_FUNCTIONAL_RESERVE ────────────────────────────────────────────
  // Inferred from LOW_MUSCLE_STRENGTH (activation pass). Represents the shrinking buffer
  // between current functional capacity and the thresholds for everyday tasks.
  // Only activates when LOW_MUSCLE_STRENGTH has direct evidence — not from inactivity alone.
  if (!stateById['REDUCED_FUNCTIONAL_RESERVE']) {
    const lowStrength = stateById['LOW_MUSCLE_STRENGTH'];
    if (lowStrength) {
      states.push({
        node_id:       'REDUCED_FUNCTIONAL_RESERVE',
        current_state: 'PREDICTED_CURRENT',
        confidence:    lowStrength.confidence === 'medium' ? 'medium' : 'low',
        evidence: {
          direct: [],
          supporting: [],
          inferred_from_nodes: [{
            node_id:       'LOW_MUSCLE_STRENGTH',
            current_state: lowStrength.current_state,
            role:          'reduced strength shrinks the buffer between capacity and functional task thresholds',
          }],
        },
        missing_evidence: [
          { type: 'OBSERVATION', obs_type: 'tug_test',
            note: 'Timed Up and Go (TUG) — validovaný marker funkční rezervy a rizika pádu' },
          { type: 'OBSERVATION', obs_type: 'chair_stand_30s',
            note: '30-sekundový chair stand test — populační normy pro věkové skupiny' },
        ],
      });
    }
  }

  // ── RELEVANT_UNKNOWN detection ────────────────────────────────────────────
  // Rule: UNKNOWN node state is created ONLY when all three conditions hold:
  //   1. The node is part of a currently active inference/projection path
  //   2. Its state cannot be determined from available data
  //   3. Missing state materially affects inference or projection output
  //
  // This is NOT a global scan of all unknown Master nodes.
  // Nodes outside active paths stay absent from node_states entirely.
  //
  // Currently active longevity path:
  //   PHYSICAL_INACTIVITY → PHYSICAL_DECONDITIONING → LOW_MUSCLE_STRENGTH
  //   → REDUCED_FUNCTIONAL_RESERVE → LOSS_OF_FLOOR_RISE_ABILITY
  //
  // REDUCED_FUNCTIONAL_RESERVE: excluded from UNKNOWN detection for now —
  //   its absence does not materially change the projection output independently
  //   of LOW_MUSCLE_STRENGTH (which is already flagged as UNKNOWN).

  const physDecondActive = stateById['PHYSICAL_DECONDITIONING']
    || states.find(s => s.node_id === 'PHYSICAL_DECONDITIONING');

  // RELEVANT_UNKNOWN: LOW_MUSCLE_STRENGTH
  // Path: active (PHYSICAL_DECONDITIONING in path)
  // Data gap: no strength evidence reached activation (onboarding unanswered, no validated test)
  // Material impact: without LOW_MUSCLE_STRENGTH, trajectory to LOSS_OF_FLOOR_RISE_ABILITY
  //   cannot be computed — risk stays unknown and the reason is not surfaced to the user.
  const lowStrengthPresent = stateById['LOW_MUSCLE_STRENGTH']
    || states.find(s => s.node_id === 'LOW_MUSCLE_STRENGTH');

  if (physDecondActive && !lowStrengthPresent) {
    states.push({
      node_id:       'LOW_MUSCLE_STRENGTH',
      current_state: 'UNKNOWN',
      confidence:    'unknown',
      evidence:      { direct: [], supporting: [], inferred_from_nodes: [] },
      missing_evidence: [
        {
          type:     'OBSERVATION',
          obs_type: 'validated_strength_assessment',
          note:     'Validované posouzení svalové síly (EWGSOP2): handgrip strength (dynamometr) nebo 30s chair stand test — klíčový chybějící vstup pro longevity trajectory inference.',
        },
        {
          type:        'ONBOARDING',
          question_id: 'vynest_nakup',
          note:        'CHJ Decathlon funkční otázka: "Vynést nákup do 3. patra bez zastavení?" — nevyplněno',
        },
        {
          type:        'ONBOARDING',
          question_id: 'zvednout_vnouce',
          note:        'CHJ Decathlon funkční otázka: "Zvednout vnouče / těžký předmět (10+ kg)?" — nevyplněno',
        },
      ],
    });
  }

  // RELEVANT_UNKNOWN: LOSS_OF_FLOOR_RISE_ABILITY
  // Path: active (PHYSICAL_DECONDITIONING in path)
  // Data gap: no floor-rise test and no vstat_ze_zeme onboarding answer
  // Material impact: this IS the projection target — its unknown state is the direct
  //   reason the TRAJECTORY_BASED projection carries risk=unknown.
  const oi = clinicalHistory.onboarding_inputs || {};
  const hasFloorData = oi['vstat_ze_zeme'] != null;
  const floorPresent  = stateById['LOSS_OF_FLOOR_RISE_ABILITY']
    || states.find(s => s.node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');

  if (physDecondActive && !hasFloorData && !floorPresent) {
    states.push({
      node_id:       'LOSS_OF_FLOOR_RISE_ABILITY',
      current_state: 'UNKNOWN',
      confidence:    'unknown',
      evidence:      { direct: [], supporting: [], inferred_from_nodes: [] },
      missing_evidence: [
        {
          type:     'OBSERVATION',
          obs_type: 'floor_rise_test',
          note:     'CHJ functional assessment: vstání ze země bez opory (ano/ne). ' +
                    'Dekatlon onboarding: vstat_ze_zeme. ' +
                    '(Bez konkrétního validovaného protokolu — zatím interní CHJ screening.)',
        },
      ],
    });
  }

  return states;
}
