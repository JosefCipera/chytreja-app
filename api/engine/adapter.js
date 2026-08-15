// adapter.js — Health Data Model v1 translation layer
// Reads from current Supabase tables, returns {person, clinicalHistory, observations}.
// Does NOT change DB schema. Enforces canonical birth_year from user_profiles.

import { createClient } from '@supabase/supabase-js';

const DIAG_KEYWORDS = [
  { kws: ['fibrilace', 'fap', 'atrial fibrillation', 'arytmie'],                id: 'ATRIAL_FIBRILLATION' },
  { kws: ['hypertenze', 'hypertension', 'vysoký tlak', 'vysoky tlak', 'krevni tlak', 'tlak krve', 'high blood pressure'], id: 'HYPERTENSION' },
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
  { kws: ['neuropati', 'neuropathy', 'polyneuropati', 'polyneuropathy'],        id: 'PERIPHERAL_NEUROPATHY' },
];

export function mapDiagnosis(rawString) {
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
  ] = await Promise.all([
    supabase.from('user_profiles')
      .select('birth_year, gender, height, weight')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('user_health_profile')
      .select('diagnoses, symptoms, medications, supplements, labs, lifestyle, capacity, physical, doctor_notes')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('daily_checkin')
      .select('weight_kg, waist_cm, energy, sleep_hours, stress, movement_level, date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30),
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

  // Bridge: doctor_notes is raw text entered via CRT / health-profile UI.
  // Parse it with the same DIAG_KEYWORDS and merge into diagnoses (dedup by ID).
  // This ensures Safety Gate sees confirmed conditions regardless of how they were entered.
  // Source label 'doctor_notes' preserved for downstream auditability.
  if (hp?.doctor_notes) {
    const seenIds = new Set(diagnoses.map(d => d.id));
    const lines = hp.doctor_notes
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
    for (const line of lines) {
      const id = mapDiagnosis(line);
      if (id && !seenIds.has(id)) {
        diagnoses.push({ id, raw_label: line, status: 'confirmed', source: 'doctor_notes' });
        seenIds.add(id);
      }
    }
  }

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
    // Canonical source for functional assessment answers: user_health_profile.physical
    // node_inputs.question_id/value had no write path — migrated to physical in Health Event Adapter v0.1
    onboarding_inputs: hp?.physical || {},
    // Availability markers for functional tests where "I don't have the result" is valid.
    // Written by upsertEvidenceAvailability in healthEventAdapter.js.
    // Inference/projections: evidence need is resolved if actual_result exists OR availability != null.
    evidence_availability: (hp?.physical?.evidence_availability) || {},
    // True if user_health_profile row exists — proxy for "person has engaged with health history".
    // Used by Safety Gate: VIGOROUS/HIIT intensity requires clinical_history_documented = true
    // to proceed without NEEDS_MORE_EVIDENCE (cardiac safety cannot be assumed without baseline).
    clinical_history_documented: Boolean(hp),
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

  // Sedentary hours from physical (written by Health Event Adapter ANSWER events)
  const sedHours = hp?.physical?.sedentary_hours_day;
  if (sedHours != null)
    observations.push({ obs_type: 'sedentary_hours_day', value: parseFloat(sedHours), unit: 'hours', measured_at: null, source: 'physical', confidence: 'estimated' });

  return { person, clinicalHistory, observations };
}

export async function fetchActionPool(protocolTypes) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data, error } = await supabase
    .from('longevity_actions')
    .select('id, node_id, label, protocol_type, type, duration, reps, tier, tags, constraint_exclude, intensity, modality, support_sides, stability_support, upper_body_demand, load_distribution')
    .eq('active', true)
    .in('protocol_type', protocolTypes);
  if (error) throw new Error(`fetchActionPool: ${error.message}`);
  return data ?? [];
}

export async function fetchPersonConstraints(userId) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data, error } = await supabase
    .from('user_constraints')
    .select('constraint_type, constraint_key, constraint_value, severity')
    .eq('user_id', userId);
  if (error) throw new Error(`fetchPersonConstraints: ${error.message}`);
  return data ?? [];
}

export async function fetchActionAssignments(userId, days = 30) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('action_assignments')
    .select('id, action_id, intervention_id, selected_leverage_node, engine_version, status, assigned_at, completed_at, actual_duration_seconds, actual_reps, assigned_date')
    .eq('user_id', userId)
    .gte('assigned_date', since)
    .order('assigned_date', { ascending: false });
  if (error) throw new Error(`fetchActionAssignments: ${error.message}`);
  const rows = data ?? [];
  // TRACE diagnostic — remove after Full Reset FAIL root cause confirmed
  const summary = rows.slice(0, 5).map(a =>
    `${a.intervention_id}/${a.status}/${a.assigned_date}/${a.assigned_at?.slice(0, 16)}`
  );
  console.log(`[ORCHESTRATE] uid=${userId} loaded_action_assignments=${rows.length}`, rows.length ? summary : '(clean)');
  return rows;
}
