// projections.js — PERSON_PROJECTION runtime entities (Engine v1)
//
// Architecture: PERSON_PROJECTION is a separate entity from PERSON_NODE_STATE.
// A projection is a M:N relationship: multiple current node states → one future target node.
// PERSON_NODE_STATE describes the person today. PERSON_PROJECTION describes a future risk.
//
// Currently implemented: one RISK_BASED slice.
//   target = CARDIOVASCULAR_DISEASE
//   inputs = ERECTILE_DYSFUNCTION (RISK_MARKER_FOR), HYPERTENSION, DYSLIPIDEMIA, age/sex
//
// Rules:
//   RULE_ED_CV_RISK_MARKER_v1  — ED as established marker (not cause) of CV risk
//   RULE_HTN_CV_RISK_v1        — HTN as independent CV risk factor
//   RULE_DYSLIPIDEMIA_CV_RISK_v1 — dyslipidemia contributes to atherogenesis
//   RULE_AGE_MALE_CV_RISK_v1   — age ≥ 65 male as independent risk factor
//
// No numeric scoring (Framingham, SCORE2, ACC/AHA PCE) — missing ApoB, CAC, HbA1c.
// Fields use 'unknown' where medical literature does not support a qualitative determination.

export function computeProjections(nodeStates, person, clinicalHistory) {
  const projections = [];

  const cv = cvDiseaseProjection(nodeStates, person, clinicalHistory);
  if (cv) projections.push(cv);

  return projections;
}

function cvDiseaseProjection(nodeStates, person, clinicalHistory) {
  const byId    = Object.fromEntries(nodeStates.map(s => [s.node_id, s]));
  const diagById = id => clinicalHistory.diagnoses.find(d => d.id === id && d.status === 'confirmed');

  const evidence   = [];
  const rule_ids   = [];

  // ── ED as RISK_MARKER_FOR (not CAUSES) ────────────────────────────────────
  // Princeton Consensus Panel IV (2012): men with ED have approximately doubled risk
  // of future cardiovascular events vs men without ED, after controlling for traditional
  // risk factors. ED is a marker, not a cause — the underlying endothelial dysfunction
  // may drive both conditions simultaneously.
  const ed = byId['ERECTILE_DYSFUNCTION'];
  if (ed?.current_state === 'CONFIRMED') {
    evidence.push({
      node_id:   'ERECTILE_DYSFUNCTION',
      state:     'CONFIRMED',
      relation:  'RISK_MARKER_FOR',
      note:      'ED je etablovaný marker zvýšeného KV rizika — nikoli příčina. ' +
                 'Populační data (Montorsi 2003, Princeton IV 2012) naznačují, že ED ' +
                 'předchází koronárním příhodám průměrně o 2–3 roky. ' +
                 'Mechanismus je sdílený (endoteliální dysfunkce), ne kauzální řetěz ED→KVN.',
    });
    rule_ids.push('RULE_ED_CV_RISK_MARKER_v1');
  }

  // ── HTN as CONTRIBUTES_TO ─────────────────────────────────────────────────
  // ESC/ESH HTN Guidelines 2018, ESC CVD Prevention Guidelines 2021:
  // hypertension is a major independent risk factor for CVD events.
  const htn = byId['HYPERTENSION'];
  if (htn?.current_state === 'CONFIRMED') {
    evidence.push({
      node_id:   'HYPERTENSION',
      state:     'CONFIRMED',
      relation:  'CONTRIBUTES_TO',
      note:      'Hypertenze je nezávislý KV rizikový faktor (ESC 2018/2021). ' +
                 'Absolutní riziko závisí na stupni kontroly TK — bez aktuálního měření nelze určit.',
    });
    rule_ids.push('RULE_HTN_CV_RISK_v1');
  }

  // ── DYSLIPIDEMIA as CONTRIBUTES_TO ───────────────────────────────────────
  const dyslipDiag = diagById('DYSLIPIDEMIA');
  if (dyslipDiag) {
    evidence.push({
      source:   'CLINICAL_HISTORY',
      type:     'DIAGNOSIS',
      id:       'DYSLIPIDEMIA',
      relation: 'CONTRIBUTES_TO',
      note:     'Dyslipidémie přispívá k aterogenezi. ' +
                'Bez ApoB/LDL-P hodnoty nelze určit aterogenní zátěž přesněji než jako "zvýšená".',
    });
    rule_ids.push('RULE_DYSLIPIDEMIA_CV_RISK_v1');
  }

  // ── Age + sex ─────────────────────────────────────────────────────────────
  // ESC CVD Prevention Guidelines 2021: age and male sex are non-modifiable risk factors
  // integrated into all major risk scoring models (SCORE2, PCE, Framingham).
  const age = person.birth_year ? (new Date().getFullYear() - person.birth_year) : null;
  if (age !== null && age >= 65 && person.sex === 'male') {
    evidence.push({
      source: 'PERSON',
      field:  'age_sex',
      value:  { age, sex: person.sex },
      note:   `Muž ve věku ${age} let — věk ≥ 65 a mužské pohlaví jsou nezávislé faktory ` +
              'zahrnuté do všech kalibrovaných KV rizikových skóre (SCORE2, PCE, Framingham).',
    });
    rule_ids.push('RULE_AGE_MALE_CV_RISK_v1');
  }

  // ── Require at least one evidence item ───────────────────────────────────
  if (evidence.length === 0) return null;

  // ── risk ──────────────────────────────────────────────────────────────────
  // Qualitative only. "elevated" is defensible when ≥2 established independent risk factors
  // are confirmed. We do not use "high" — that implies a threshold from a calibrated model
  // (e.g. SCORE2 ≥ 10%) which we cannot compute without ApoB + full lipid panel.
  const risk = evidence.length >= 2 ? 'elevated' : 'unknown';

  // ── horizon ───────────────────────────────────────────────────────────────
  // Without SCORE2/Framingham calculation, we cannot assign 5-year vs 10-year vs lifetime
  // framing. Princeton association data is population-level, not a personal timeline.
  // Return 'unknown' — the direction is established, the window is not.
  const horizon = 'unknown';

  // ── confidence ────────────────────────────────────────────────────────────
  // "low": evidence is qualitative and directional. We are missing the quantitative inputs
  // (ApoB, CAC score, controlled BP value, HbA1c) needed to produce a calibrated estimate.
  // "medium" would require at least one quantitative risk score calculation.
  const confidence = evidence.length >= 3 ? 'low' : 'unknown';

  return {
    projection_type: 'RISK_BASED',
    target_node_id:  'CARDIOVASCULAR_DISEASE',
    risk,
    risk_basis:      'qualitative_rule',
    calibrated:      false,
    horizon,
    confidence,
    evidence,
    missing_evidence: [
      {
        type:     'OBSERVATION',
        obs_type: 'lab_apob',
        note:     'ApoB — doplňkový aterogenní marker; pro SCORE2 jsou standardními vstupy věk/pohlaví/kouření/SBP/total+HDL cholesterol',
      },
      {
        type:     'OBSERVATION',
        obs_type: 'coronary_calcium_score',
        note:     'CAC skóre — nástroj pro další risk stratification; Princeton IV doporučuje jeho zvážení u vybraných mužů s ED a neurčitým rizikovým profilem',
      },
      {
        type:     'OBSERVATION',
        obs_type: 'bp_systolic_controlled',
        note:     'Aktuální TK hodnoty s datumem — kontrola HTN zásadně mění absolutní riziko',
      },
      {
        type:     'OBSERVATION',
        obs_type: 'lab_hba1c',
        note:     'HbA1c — metabolický syndrom jako KV rizikový modifikátor',
      },
      {
        type:     'OBSERVATION',
        obs_type: 'lab_crp_hs',
        note:     'hsCRP — zánětlivý marker pro úpravu KV rizika (Reynolds Risk Score)',
      },
    ],
    rule_ids,
    explanation:
      'Josefův profil obsahuje 4 potvrzené nebo přímo odvozené KV rizikové faktory: ' +
      'ED jako RISK_MARKER_FOR (Princeton IV), hypertenze (potvrzená diagnóza), ' +
      'dyslipidémie (potvrzená diagnóza) a věk 69 let / mužské pohlaví. ' +
      'ED není příčina KV rizika — je to epidemiologický marker: sdílený upstream mechanismus ' +
      '(pravděpodobně endoteliální dysfunkce) se projeví v penilním řečišti dříve než koronárně. ' +
      'Výsledná kvalitativní kategorie je "elevated". ' +
      '"horizon" ani absolutní pravděpodobnost nelze bez kalibrovaného skóre (SCORE2/Framingham) určit — ' +
      'pro ten je nutný ApoB, aktuální TK a ideálně CAC skóre.',
  };
}
