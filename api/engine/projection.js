// projection.js — PROJECTION pass (structural v1)
// Input:  allStates[] (from activation + inference)
// Output: allStates[] with future_projection added
//
// Two projection types (defined here structurally, not yet calibrated):
//   RISK_BASED:       current profile → future risk probability
//   TRAJECTORY_BASED: trend + time → future state (requires temporal observations)
//
// v1 status: structural placeholders only.
// No calibrated numeric scoring — confidence is marked 'low' throughout.
// Numeric risk models will be added when DataDictionary activation rules are complete
// and when temporal observation data (labs with dates, weight trend) is available.

export function projection(allStates) {
  return allStates.map(state => ({
    ...state,
    future_projection: buildProjection(state, allStates),
  }));
}

function buildProjection(state, allStates) {
  const stateById = Object.fromEntries(allStates.map(s => [s.node_id, s]));

  switch (state.node_id) {

    case 'ERECTILE_DYSFUNCTION':
      // ED is an epidemiological RISK_MARKER_FOR future cardiovascular events.
      // The association is well-established (Montorsi et al., Princeton Consensus).
      // Projection type: RISK_BASED (cross-sectional marker, not trajectory)
      return {
        type: 'RISK_BASED',
        risk: 'elevated',
        horizon: 'medium',
        confidence: 'low',
        target_nodes: ['CARDIOVASCULAR_DISEASE'],
        relation: 'RISK_MARKER_FOR',
        note: 'ED předchází KV příhodám průměrně o 2–3 roky (Inman 2009). ' +
              'Tato projekce je strukturální — risk=elevated je placeholder, nikoli kalibrovaný skóre. ' +
              'Kalibrace vyžaduje ApoB, HRV, koronární CT skóre.',
      };

    case 'HYPERTENSION':
      if (state.current_state === 'CONFIRMED') {
        const hasEd = !!stateById['ERECTILE_DYSFUNCTION'];
        const hasIr = !!stateById['INSULIN_RESISTANCE'];
        return {
          type: 'RISK_BASED',
          risk: (hasEd || hasIr) ? 'high' : 'elevated',
          horizon: 'long',
          confidence: 'low',
          target_nodes: ['ENDOTHELIAL_DYSFUNCTION', 'STROKE_RISK', 'CARDIAC_FAILURE_RISK'],
          relation: 'CONTRIBUTES_TO',
          note: 'Riziko závisí na adherenci k léčbě a aktuálním TK — bez temporálního měření TK ' +
                'není možné určit trajektorii.',
        };
      }
      return null;

    case 'INSULIN_RESISTANCE':
      if (state.current_state === 'PREDICTED_CURRENT') {
        return {
          type: 'RISK_BASED',
          risk: 'elevated',
          horizon: 'long',
          confidence: 'low',
          target_nodes: ['DIABETES_T2', 'ENDOTHELIAL_DYSFUNCTION'],
          relation: 'CONTRIBUTES_TO',
          note: 'PREDICTED_CURRENT → projekce má nízkou confidence dokud není IR potvrzena ' +
                'HOMA-IR nebo HbA1c. Bez HOMA-IR nelze rozlišit kompenzovanou IR od prediabetu.',
        };
      }
      return null;

    case 'EXCESS_ADIPOSITY':
      if (state.current_state === 'MEASURED') {
        return {
          type: 'TRAJECTORY_BASED',
          risk: 'low',
          horizon: 'medium',
          confidence: 'low',
          target_nodes: ['INSULIN_RESISTANCE'],
          relation: 'CONTRIBUTES_TO',
          note: 'Bez trendu (temporální weight observations s datem) nelze určit trajektorii. ' +
                'Single measurement = stav, ne směr.',
        };
      }
      return null;

    case 'ENDOTHELIAL_DYSFUNCTION':
      return {
        type: 'RISK_BASED',
        risk: 'elevated',
        horizon: 'long',
        confidence: 'low',
        target_nodes: ['STROKE_RISK', 'CARDIAC_FAILURE_RISK'],
        relation: 'CONTRIBUTES_TO',
        note: 'PREDICTED_CURRENT → projekce je podpůrná. Confidence závisí na potvrzení stavu ' +
              'přímým testem (FMD, ABI).',
      };

    case 'PHYSICAL_INACTIVITY':
      return {
        type: 'TRAJECTORY_BASED',
        risk: 'elevated',
        horizon: 'long',
        confidence: 'low',
        target_nodes: ['INSULIN_RESISTANCE', 'EXCESS_ADIPOSITY', 'FUNCTIONAL_DECLINE'],
        relation: 'CONTRIBUTES_TO',
        note: 'Fyzická inaktivita je reverzibilní — každý zásah pohybem mění trajektorii. ' +
              'Projekce vyžaduje trend dat (VO2max, síla) pro kalibraci.',
      };

    default:
      return null;
  }
}
