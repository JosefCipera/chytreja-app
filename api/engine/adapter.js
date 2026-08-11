// adapter.js — Health Data Model v1 translation layer
// Reads from current Supabase tables, returns {person, clinicalHistory, observations}.
// Does NOT change DB schema. Enforces canonical birth_year from user_profiles.

import { createClient } from '@supabase/supabase-js';

const DIAG_KEYWORDS = [
  { kws: ['fibrilace', 'fap', 'atrial fibrillation', 'arytmie'],                id: 'ATRIAL_FIBRILLATION' },
  { kws: ['hypertenze', 'hypertension', 'vysoký tlak', 'vysoky tlak'],          id: 'HYPERTENSION' },
  { kws: ['dyslipid', 'cholesterol', 'ldl', 'hypercholesterol'],                id: 'DYSLIPIDEMIA' },
  { kws: ['hyperurik', 'kyselina mocova', 'kyselina močová', 'gout', 'dna'],    id: 'HYPERURICEMIA' },
  { kws: ['erektil', 'erectile', 'impotence'],                                  id: 'ERECTILE_DYSFUNCTION' },
  { kws: ['chronicke stres', 'chronický stres', 'burnout', 'vyhoren'],          id: 'CHRONIC_STRESS' },
  { kws: ['obezita', 'obese'],                                                  id: 'OBESITY' },
  { kws: ['nadváha', 'nadva', 'overweight'],                                    id: 'OVERWEIGHT' },
  { kws: ['diabetes', 'cukrovka', 'inzulin'],                                   id: 'INSULIN_RESISTANCE' },
  { kws: ['prostata', 'bph', 'hyperplazie prostaty', 'benign'],                 id: 'BENIGN_PROSTATIC_HYPERPLASIA' },
  { kws: ['extrasystol'],                                                       id: 'EXTRASYSTOLES' },
  { kws: ['fibrilace predsi', 'flutter', 'af ablace', 'ablace'],                id: 'AF_ABLATION' },
];

function mapDiagnosis(rawString) {
  const s = rawString.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const { kws, id } of DIAG_KEYWORDS) {
    if (kws.some(kw => s.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, '')))) return id;
  }
  return null;
}

export async function fetchHealthData(userId) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [
    { data: userProfile },
    { data: hp },
    { data: checkins },
    { data: nodeInputs },
  ] = await Promise.all([
    supabase.from('user_profiles')
      .select('birth_year, gender, height, weight')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('user_health_profile')
      .select('diagnoses, symptoms, medications, supplements, labs, lifestyle, capacity, physical')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('daily_checkin')
      .select('weight_kg, waist_cm, energy, sleep_hours, stress, movement_level, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30),
    supabase.from('node_inputs')
      .select('node_id, question_id, value')
      .eq('user_id', userId),
  ]);

  // ── PERSON ────────────────────────────────────────────────────────────────
  // Canonical birth_year = user_profiles.birth_year (1957 for Josef).
  // user_health_profile.birth_year (1971) is known to be wrong — never read it here.
  const person = {
    person_id: userId,
    sex: userProfile?.gender || hp?.sex || null,
    birth_year: userProfile?.birth_year || null,
    height_cm: userProfile?.height || null,
  };

  // ── CLINICAL HISTORY ─────────────────────────────────────────────────────
  const rawDiagnoses = [
    ...(hp?.diagnoses || []),
    ...(hp?.symptoms  || []),
  ];
  const diagnoses = rawDiagnoses
    .map(raw => {
      const rawStr = typeof raw === 'string' ? raw : (raw?.name || '');
      const id = mapDiagnosis(rawStr);
      return id ? { id, raw_label: rawStr, status: 'confirmed' } : null;
    })
    .filter(Boolean);

  const medications = (hp?.medications || []).map(m => ({
    substance: typeof m === 'string' ? m : m?.name,
    dose: m?.dose || null,
    status: 'active',
  })).filter(m => m.substance);

  const supplements = (hp?.supplements || []).map(s => ({
    substance: typeof s === 'string' ? s : s?.name,
    dose: s?.dose || null,
    status: 'active',
  })).filter(s => s.substance);

  const lifestyle = hp?.lifestyle || {};
  const clinicalHistory = {
    diagnoses,
    medications,
    supplements,
    lifestyle: {
      sedentary_work: lifestyle.sedentary === true,
      smoking_history: 'unknown',
      alcohol_history: 'unknown',
    },
    capacity: hp?.capacity || {},
    // Flat map of all onboarding node_inputs: question_id → raw value
    onboarding_inputs: Object.fromEntries(
      (nodeInputs || []).map(n => [n.question_id, n.value])
    ),
  };

  // ── OBSERVATIONS ──────────────────────────────────────────────────────────
  const observations = [];

  for (const c of (checkins || [])) {
    if (c.weight_kg != null)
      observations.push({ obs_type: 'weight_kg', value: c.weight_kg, unit: 'kg', measured_at: c.date, source: 'daily_checkin', confidence: 'confirmed' });
    if (c.waist_cm != null)
      observations.push({ obs_type: 'waist_cm', value: c.waist_cm, unit: 'cm', measured_at: c.date, source: 'daily_checkin', confidence: 'confirmed' });
    if (c.movement_level != null)
      observations.push({ obs_type: 'activity_level', value: c.movement_level, measured_at: c.date, source: 'daily_checkin', confidence: 'confirmed' });
    if (c.stress != null)
      observations.push({ obs_type: 'stress_1_5', value: c.stress, measured_at: c.date, source: 'daily_checkin', confidence: 'confirmed' });
  }

  // Weight from user_health_profile.physical (entered via health profile form, no date)
  const physicalWeight = hp?.physical?.weight ?? hp?.physical?.weight_kg ?? null;
  if (physicalWeight != null)
    observations.push({ obs_type: 'weight_kg', value: parseFloat(physicalWeight), unit: 'kg', measured_at: null, source: 'health_profile', confidence: 'estimated' });

  // Weight from user_profiles (avatar/onboarding estimate, no date, lowest priority)
  if (userProfile?.weight)
    observations.push({ obs_type: 'weight_kg', value: userProfile.weight, unit: 'kg', measured_at: null, source: 'onboarding', confidence: 'estimated' });

  // Labs from user_health_profile
  const labs = hp?.labs || {};
  const labMap = {
    ldl:             { obsType: 'lab_ldl',             unit: 'mmol/L' },
    hdl:             { obsType: 'lab_hdl',             unit: 'mmol/L' },
    triglycerides:   { obsType: 'lab_triglycerides',   unit: 'mmol/L' },
    fasting_glucose: { obsType: 'lab_glucose_fasting', unit: 'mmol/L' },
    hba1c:           { obsType: 'lab_hba1c',           unit: '%' },
    alt:             { obsType: 'lab_alt',             unit: 'µkat/L' },
    ast:             { obsType: 'lab_ast',             unit: 'µkat/L' },
    uric_acid:       { obsType: 'lab_uric_acid',       unit: 'µmol/L' },
    crp:             { obsType: 'lab_crp',             unit: 'mg/L' },
    apob:            { obsType: 'lab_apob',            unit: 'g/L' },
    testosterone:    { obsType: 'lab_testosterone',    unit: 'nmol/L' },
    hrv:             { obsType: 'lab_hrv',             unit: 'ms' },
  };
  for (const [key, { obsType, unit }] of Object.entries(labMap)) {
    if (labs[key] != null)
      observations.push({ obs_type: obsType, value: parseFloat(labs[key]), unit, measured_at: labs.date || null, source: 'lab_report', confidence: 'estimated' });
  }

  // Sedentary hours from onboarding
  const sedNode = (nodeInputs || []).find(n => n.question_id === 'sedentary_hours_day');
  if (sedNode)
    observations.push({ obs_type: 'sedentary_hours_day', value: parseFloat(sedNode.value), unit: 'hours', measured_at: null, source: 'onboarding', confidence: 'estimated' });

  return { person, clinicalHistory, observations };
}
