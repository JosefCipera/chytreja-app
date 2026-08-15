// healthEventAdapter.js — Health Event Adapter v0.1
//
// Boundary:
//   AI ORCHESTRATOR → NORMALIZED_DOMAIN_EVENT → applyHealthEvent() → persistence → runEngine() → DOMAIN_RESPONSE
//
// Rules:
//   1. No clinical reasoning — normalize, persist, call runEngine()
//   2. No new DB tables — existing: user_health_profile, user_constraints, daily_checkin, action_assignments
//   3. No write to node_inputs
//   4. null payload fields are valid — never block event emission
//   5. Engine decides via DAILY_DECISION if missing field requires ASK
//
// ── NORMALIZED_DOMAIN_EVENT v0.1 ─────────────────────────────────────────────
// {
//   event_type: 'ACTION_COMPLETED' | 'ACTION_SKIPPED' | 'ANSWER_TO_EVIDENCE_QUESTION'
//             | 'NEW_SYMPTOM' | 'NEW_MEASUREMENT' | 'NEW_CONSTRAINT'
//             | 'USER_PREFERENCE' | 'DOMAIN_REQUEST'
//   event_id:  string  (UUID)
//   source:    'voice' | 'text' | 'ui' | 'wearable' | 'api'
//   timestamp: string  (ISO 8601)
//   payload:   object  (event-specific, null fields are valid)
// }
//
// ── HEALTH_EVENT_RESULT v0.1 ──────────────────────────────────────────────────
// {
//   persistence_status: 'ok' | 'partial' | 'noop' | 'error'
//   engine_called:      boolean
//   domain_response:    DOMAIN_RESPONSE | null
//   warnings:           string[]
//   error:              string | null
// }
//
// ── DOMAIN_RESPONSE ───────────────────────────────────────────────────────────
// {
//   domain:              'health'
//   engine_version:      string
//   evaluated_at:        string
//   daily_decision:      DAILY_DECISION  (computeDailyDecision output)
//   explanation_context: { system_constraint, system_leverage, action_context, evidence_context }
// }

import { createClient } from '@supabase/supabase-js';
import { runEngine }           from './engine.js';
import { computeDailyDecision } from './dailyDecision.js';

// ── EVIDENCE_STORAGE_REGISTRY ─────────────────────────────────────────────────
// Deklarativní mapping: evidence_type / obs_type → canonical DB target.
// Used by ANSWER_TO_EVIDENCE_QUESTION and NEW_MEASUREMENT routing.
// Never add clinical logic here — this is pure storage routing.
export const EVIDENCE_STORAGE_REGISTRY = {
  // ── Functional assessment → user_health_profile.physical ──────────────────
  // Reads: adapter.js onboarding_inputs = hp?.physical
  // Activation checks: oi['vynest_nakup'], oi['recent_falls'], etc.
  vynest_nakup:          { table: 'physical', key: 'vynest_nakup' },
  zvednout_vnouce:       { table: 'physical', key: 'zvednout_vnouce' },
  vstat_ze_zeme:         { table: 'physical', key: 'vstat_ze_zeme' },
  gait_stability:        { table: 'physical', key: 'gait_stability' },
  balanc_jedna_noha:     { table: 'physical', key: 'balanc_jedna_noha' },
  rovnovaha_zavrene_oci: { table: 'physical', key: 'rovnovaha_zavrene_oci' },
  sedentary_hours_day:   { table: 'physical', key: 'sedentary_hours_day' },

  // Decision: fall_history stored in physical (NOT node_inputs).
  // Rationale: physical is canonical onboarding Q&A store.
  // activation.js checks oi['recent_falls']; oi = hp.physical.
  recent_falls:          { table: 'physical', key: 'recent_falls' },
  fall_history:          { table: 'physical', key: 'recent_falls' }, // canonical alias

  // ── Constraint severity answers → user_constraints ────────────────────────
  // Pattern: '{region}_severity' → constraint_key = '{region}'
  // Reads: fetchPersonConstraints() → Safety Gate rule 4 (null severity → NEEDS_MORE_EVIDENCE)
  knee_severity:         { table: 'constraints', key: 'knee' },
  hip_severity:          { table: 'constraints', key: 'hip' },
  lower_back_severity:   { table: 'constraints', key: 'lower_back' },
  shoulder_severity:     { table: 'constraints', key: 'shoulder' },
  ankle_foot_severity:   { table: 'constraints', key: 'ankle_foot' },
  elbow_severity:        { table: 'constraints', key: 'elbow' },
  wrist_severity:        { table: 'constraints', key: 'wrist' },

  // ── Daily check-in observations → daily_checkin ───────────────────────────
  // UNIQUE (user_id, date, universe) — upsert merges into today's row
  activity_level:        { table: 'daily_checkin', key: 'movement_level' },
  weight_kg:             { table: 'daily_checkin', key: 'weight_kg' },
  waist_cm:              { table: 'daily_checkin', key: 'waist_cm' },
  stress_1_5:            { table: 'daily_checkin', key: 'stress' },
  sleep_hours:           { table: 'daily_checkin', key: 'sleep_hours' },

  // ── Lab measurements → user_health_profile.labs JSONB ────────────────────
  lab_ldl:               { table: 'labs', key: 'ldl' },
  lab_hdl:               { table: 'labs', key: 'hdl' },
  lab_triglycerides:     { table: 'labs', key: 'triglycerides' },
  lab_glucose_fasting:   { table: 'labs', key: 'fasting_glucose' },
  lab_hba1c:             { table: 'labs', key: 'hba1c' },
  lab_alt:               { table: 'labs', key: 'alt' },
  lab_ast:               { table: 'labs', key: 'ast' },
  lab_uric_acid:         { table: 'labs', key: 'uric_acid' },
  lab_crp:               { table: 'labs', key: 'crp' },
  lab_apob:              { table: 'labs', key: 'apob' },
  lab_testosterone:      { table: 'labs', key: 'testosterone' },
  lab_hrv:               { table: 'labs', key: 'hrv' },

  // ── Functional tests with availability tracking ───────────────────────────
  // tracks_availability: true → "Nemám" writes evidence_availability only,
  // never aliased as a clinical negative result in physical[key].
  // Engine reads availability via clinicalHistory.evidence_availability.
  // evidence_kind determines whether actual value is also persisted (RAW_VALUE)
  // or only the availability marker (AVAILABILITY_ONLY / DERIVED).
  // See api/engine/evidenceResolution.js for the engine read contract.
  validated_strength_assessment: { table: 'physical', key: 'validated_strength_assessment', tracks_availability: true, evidence_kind: 'RAW_VALUE' },

  // ── Wearable / temporal — AVAILABILITY_ONLY & DERIVED ────────────────────
  // "Nemám" → evidence_availability[type] = NOT_AVAILABLE only.
  // No single raw value to capture via dialog for these types.
  // Actual wearable data integration is out of scope for dialog flow (v0.4+).
  steps_day:               { table: 'physical', key: null, tracks_availability: true, evidence_kind: 'AVAILABILITY_ONLY' },
  temporal_activity_trend: { table: 'physical', key: null, tracks_availability: true, evidence_kind: 'DERIVED' },
};

// ── Body region normalization ─────────────────────────────────────────────────
// Mirrors CONSTRAINT_KEYWORDS in nextBestAction.js — keep in sync.
const BODY_REGION_KEYWORDS = {
  knee:       ['koleno', 'kolena', 'kolenní', 'knee'],
  hip:        ['kyčel', 'kycle', 'hip', 'bok'],
  lower_back: ['záda', 'zada', 'bedra', 'bederní', 'beder', 'lumbar', 'lower back'],
  shoulder:   ['rameno', 'ramena', 'ramenní', 'shoulder'],
  elbow:      ['loket', 'lokty', 'elbow'],
  ankle_foot: ['kotník', 'kotnik', 'chodidlo', 'pata', 'ankle', 'foot'],
  wrist:      ['zápěstí', 'zapesti', 'wrist'],
};

function normalizeBodyPart(bodyPart) {
  if (!bodyPart) return null;
  const s = bodyPart.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [region, kws] of Object.entries(BODY_REGION_KEYWORDS)) {
    if (kws.some(kw => s.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, '')))) return region;
  }
  return null;
}

// ── Evidence availability semantics ───────────────────────────────────────────
// General mechanism for evidence types where "I don't have the result" is a valid
// epistemic answer (functional tests, lab panels). Prevents immediate NBE re-ask
// without aliasing "not available" as a clinical value.
//
// Storage: user_health_profile.physical.evidence_availability = { [evidenceType]: status }
// Status values: 'NOT_AVAILABLE' | 'AVAILABLE'
//
// Engine reads: clinicalHistory.evidence_availability (added in adapter.js).
// Inference/projections: treat evidence need as resolved if actual_result exists
// OR availability != null.
//
// To extend to additional evidence types (grip_strength, tug_test, etc.), add
// tracks_availability: true to their EVIDENCE_STORAGE_REGISTRY entry.

const DIACRITIC_RE = /[̀-ͯ]/g;
function _stripDiacritics(s) { return s.normalize('NFD').replace(DIACRITIC_RE, ''); }

const NOT_AVAILABLE_TOKENS = new Set([
  'ne', 'no', 'nemam', 'nemam vysledek', 'nemam vysledek testu',
  'not available', 'not_available', 'n/a', 'nevim', 'zadny vysledek',
  'nemam zadny', 'nemam zadny vysledek', 'nemas', 'nic nemam',
]);

// Returns 'NOT_AVAILABLE' | 'AVAILABLE' | null (null = empty value, nothing to record)
export function classifyAvailability(value) {
  if (value == null || value === '') return null;
  const v = _stripDiacritics(String(value).trim().toLowerCase());
  if (NOT_AVAILABLE_TOKENS.has(v) || v.startsWith('nemam') || v === 'ne' || v === 'no') {
    return 'NOT_AVAILABLE';
  }
  return 'AVAILABLE';
}

// ── Persistence helpers ───────────────────────────────────────────────────────

// JSONB read-merge-write: user_health_profile.physical
// Acceptable for v0.1 — adapter is sole writer for functional assessment keys.
async function upsertPhysical(supabase, userId, key, value) {
  const { data: row, error: readErr } = await supabase
    .from('user_health_profile')
    .select('physical')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) throw new Error(`upsertPhysical read: ${readErr.message}`);

  const merged = { ...(row?.physical || {}), [key]: value };
  const { error } = await supabase
    .from('user_health_profile')
    .upsert({ user_id: userId, physical: merged }, { onConflict: 'user_id' });

  if (error) throw new Error(`upsertPhysical write: ${error.message}`);
  return null;
}

// JSONB read-merge-write: physical.evidence_availability sub-object
async function upsertEvidenceAvailability(supabase, userId, evidenceType, status) {
  const { data: row, error: readErr } = await supabase
    .from('user_health_profile')
    .select('physical')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) throw new Error(`upsertEvidenceAvailability read: ${readErr.message}`);

  const existing = row?.physical || {};
  const merged = {
    ...existing,
    evidence_availability: {
      ...(existing.evidence_availability || {}),
      [evidenceType]: status,
    },
  };

  const { error } = await supabase
    .from('user_health_profile')
    .upsert({ user_id: userId, physical: merged }, { onConflict: 'user_id' });

  if (error) throw new Error(`upsertEvidenceAvailability write: ${error.message}`);
  return null;
}

// JSONB read-merge-write: user_health_profile.labs
async function upsertLab(supabase, userId, key, value) {
  const { data: row, error: readErr } = await supabase
    .from('user_health_profile')
    .select('labs')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) throw new Error(`upsertLab read: ${readErr.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const merged = { ...(row?.labs || {}), [key]: value, date: today };
  const { error } = await supabase
    .from('user_health_profile')
    .upsert({ user_id: userId, labs: merged }, { onConflict: 'user_id' });

  if (error) throw new Error(`upsertLab write: ${error.message}`);
  return null;
}

// UPSERT into daily_checkin today's row (UNIQUE: user_id, date, universe)
async function upsertDailyCheckin(supabase, userId, col, value) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('daily_checkin')
    .upsert(
      { user_id: userId, date: today, universe: 'longevity', [col]: value },
      { onConflict: 'user_id,date,universe' }
    );
  if (error) throw new Error(`upsertDailyCheckin [${col}]: ${error.message}`);
  return null;
}

// UPSERT into user_constraints (UNIQUE: user_id, constraint_key)
// severity=null is valid — Safety Gate rule 4 fires on null severity + region load
async function upsertConstraint(supabase, userId, constraintKey, severity, constraintType = 'injury') {
  const { error } = await supabase
    .from('user_constraints')
    .upsert(
      {
        user_id:          userId,
        constraint_type:  constraintType,
        constraint_key:   constraintKey,
        constraint_value: JSON.stringify({ location: constraintKey }),
        severity:         severity ?? null,
      },
      { onConflict: 'user_id,constraint_key' }
    );
  if (error) throw new Error(`upsertConstraint [${constraintKey}]: ${error.message}`);
  return null;
}

// INSERT into action_assignments
async function persistActionAssignment(supabase, userId, payload, status) {
  if (!payload.action_id)        throw new Error('ACTION event: missing action_id');
  if (!payload.intervention_id)  throw new Error('ACTION event: missing intervention_id');

  const { error } = await supabase
    .from('action_assignments')
    .insert({
      user_id:                userId,
      action_id:              payload.action_id,
      intervention_id:        payload.intervention_id,
      selected_leverage_node: payload.selected_leverage_node || 'UNKNOWN',
      engine_version:         payload.engine_version          || '1.0.0',
      status,
      completed_at:           status === 'COMPLETED' ? new Date().toISOString() : null,
      actual_duration_seconds: payload.actual_duration_seconds ?? null,
      actual_reps:             payload.actual_reps             ?? null,
      assigned_date:           new Date().toISOString().slice(0, 10),
    });
  if (error) throw new Error(`persistActionAssignment: ${error.message}`);
  return null;
}

// ── Event routing ─────────────────────────────────────────────────────────────

async function routeAnswer(supabase, userId, payload) {
  const { evidence_type, value } = payload || {};
  if (!evidence_type) return 'ANSWER: missing evidence_type';

  const entry = EVIDENCE_STORAGE_REGISTRY[evidence_type];
  if (!entry) return `ANSWER: unknown evidence_type '${evidence_type}' — not persisted`;

  switch (entry.table) {
    case 'physical': {
      if (entry.tracks_availability) {
        const avail = classifyAvailability(value);
        if (!avail) return `ANSWER: no usable value for evidence_type '${evidence_type}'`;
        if (avail === 'NOT_AVAILABLE') {
          return upsertEvidenceAvailability(supabase, userId, evidence_type, 'NOT_AVAILABLE');
        }
        // RAW_VALUE only: persist actual value alongside the AVAILABLE marker.
        // AVAILABILITY_ONLY / DERIVED: availability marker is sufficient — no raw value storage.
        if (entry.evidence_kind === 'RAW_VALUE' && entry.key) {
          await upsertPhysical(supabase, userId, entry.key, value);
        }
        return upsertEvidenceAvailability(supabase, userId, evidence_type, 'AVAILABLE');
      }
      return upsertPhysical(supabase, userId, entry.key, value);
    }
    case 'constraints': return upsertConstraint(supabase, userId, entry.key, value, 'injury');
    case 'daily_checkin': return upsertDailyCheckin(supabase, userId, entry.key, value);
    case 'labs':        return upsertLab(supabase, userId, entry.key, value);
    default:            return `ANSWER: no persist handler for table '${entry.table}'`;
  }
}

async function routeMeasurement(supabase, userId, payload) {
  const { obs_type, value } = payload || {};
  if (!obs_type) return 'NEW_MEASUREMENT: missing obs_type';

  const entry = EVIDENCE_STORAGE_REGISTRY[obs_type];
  if (!entry) return `NEW_MEASUREMENT: unknown obs_type '${obs_type}' — no storage target`;

  switch (entry.table) {
    case 'daily_checkin': return upsertDailyCheckin(supabase, userId, entry.key, value);
    case 'labs':          return upsertLab(supabase, userId, entry.key, value);
    default:
      return `NEW_MEASUREMENT: obs_type '${obs_type}' → table '${entry.table}' is not a time-series target`;
  }
}

async function routeNewSymptom(supabase, userId, payload) {
  const { body_part, severity, symptom_raw } = payload || {};

  if (body_part) {
    const region = normalizeBodyPart(body_part);
    if (region) {
      // Known constraint region → upsert with null severity; Safety Gate decides ASK
      await upsertConstraint(supabase, userId, region, severity ?? null, 'injury');
      // If symptom_raw carries the full user sentence (compound input like "bolí mě koleno
      // a mám vysoký tlak"), also store it for DIAG_KEYWORDS matching in adapter.js.
      const extra = symptom_raw && symptom_raw !== body_part ? symptom_raw : null;
      if (extra) {
        const { data: row } = await supabase
          .from('user_health_profile').select('symptoms').eq('user_id', userId).maybeSingle();
        const current = Array.isArray(row?.symptoms) ? row.symptoms : [];
        await supabase.from('user_health_profile')
          .upsert({ user_id: userId, symptoms: [...current, extra] }, { onConflict: 'user_id' });
      }
      return null;
    }
  }

  // No mappable body_part → store raw text as symptom for DIAG_KEYWORDS matching.
  // Uses upsert so new users without an existing user_health_profile row are handled correctly.
  const raw = symptom_raw || body_part;
  if (raw) {
    const { data: row } = await supabase
      .from('user_health_profile')
      .select('symptoms')
      .eq('user_id', userId)
      .maybeSingle();
    const current = Array.isArray(row?.symptoms) ? row.symptoms : [];
    await supabase
      .from('user_health_profile')
      .upsert({ user_id: userId, symptoms: [...current, raw] }, { onConflict: 'user_id' });
  }

  return body_part
    ? `NEW_SYMPTOM: '${body_part}' not mapped to constraint region — stored as text`
    : 'NEW_SYMPTOM: no body_part provided — stored as raw text if symptom_raw present';
}

// ── DOMAIN_RESPONSE builder ───────────────────────────────────────────────────

function buildDomainResponse(engineResult) {
  const daily_decision = computeDailyDecision(engineResult);
  return {
    domain:          'health',
    engine_version:  engineResult.engine_version,
    evaluated_at:    engineResult.evaluated_at,
    daily_decision,
    explanation_context: {
      system_constraint: engineResult.system_constraint?.selected ?? null,
      system_leverage:   engineResult.system_leverage?.selected   ?? null,
      action_context:    engineResult.next_best_action            ?? null,
      evidence_context:  (engineResult.information_needs ?? []).slice(0, 3),
    },
  };
}

function makeResult(persistence_status, engine_called, domain_response, warnings = [], error = null) {
  return { persistence_status, engine_called, domain_response: domain_response ?? null, warnings, error };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function applyHealthEvent(userId, event) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { event_type, payload } = event;
  const warnings = [];

  try {
    // ── Events that skip or bypass persistence ─────────────────────────────
    if (event_type === 'USER_PREFERENCE') {
      // v0.1: no canonical store; engine output unchanged
      return makeResult('partial', false, null, ['USER_PREFERENCE: no canonical store in v0.1 — not persisted']);
    }

    if (event_type === 'DOMAIN_REQUEST') {
      // Pure read — no persistence; always runs engine
      const engineResult = await runEngine(userId);
      return makeResult('noop', true, buildDomainResponse(engineResult));
    }

    // ── Persist ────────────────────────────────────────────────────────────
    let warning;
    switch (event_type) {
      case 'ACTION_COMPLETED':
        await persistActionAssignment(supabase, userId, payload || {}, 'COMPLETED');
        break;

      case 'ACTION_SKIPPED':
        await persistActionAssignment(supabase, userId, payload || {}, 'SKIPPED');
        break;

      case 'ANSWER_TO_EVIDENCE_QUESTION':
        warning = await routeAnswer(supabase, userId, payload);
        if (warning) warnings.push(warning);
        break;

      case 'NEW_SYMPTOM':
        warning = await routeNewSymptom(supabase, userId, payload);
        if (warning) warnings.push(warning);
        break;

      case 'NEW_MEASUREMENT':
        warning = await routeMeasurement(supabase, userId, payload);
        if (warning) warnings.push(warning);
        break;

      case 'NEW_CONSTRAINT': {
        const region = normalizeBodyPart(payload?.affected_area);
        if (!region) {
          warnings.push(`NEW_CONSTRAINT: '${payload?.affected_area}' not mapped to known region — skipped`);
          break;
        }
        await upsertConstraint(
          supabase, userId, region,
          payload.severity ?? null,
          payload.source_type === 'medical_restriction' ? 'medical_restriction' : 'injury'
        );
        break;
      }

      case 'GENERAL_HEALTH_REQUEST': {
        // Routing only — no clinical reasoning.
        // Store the full text as a symptom so DIAG_KEYWORDS in adapter.js can extract diagnoses
        // on the next engine run. Also detect body-part constraints embedded in the text.
        const text = payload?.text || '';
        if (text) {
          const { data: row } = await supabase
            .from('user_health_profile')
            .select('symptoms')
            .eq('user_id', userId)
            .maybeSingle();
          const current = Array.isArray(row?.symptoms) ? row.symptoms : [];
          await supabase
            .from('user_health_profile')
            .upsert({ user_id: userId, symptoms: [...current, text] }, { onConflict: 'user_id' });
          const region = normalizeBodyPart(text);
          if (region) {
            await upsertConstraint(supabase, userId, region, null, 'injury');
          }
        }
        break;
      }

      default:
        return makeResult('error', false, null, [], `Unknown event_type: ${event_type}`);
    }

    // ── Run engine after every persistent event ────────────────────────────
    const engineResult   = await runEngine(userId);
    const domainResponse = buildDomainResponse(engineResult);
    return makeResult('ok', true, domainResponse, warnings);

  } catch (err) {
    return makeResult('error', false, null, warnings, err.message);
  }
}
