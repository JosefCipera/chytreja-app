// api/lib/domainEvidenceAdapter/domainEvidenceAdapter.js
// Domain Evidence Adapter #1 — LOCKED DESIGN
//
// Responsibility:
//   Translate ACTIVE Structured Facts from the Person Model into existing
//   Health Engine observation and onboarding_inputs vocabulary.
//
// Contract:
//   - Emits ONLY ACTIVE lifecycle facts (HISTORICAL and CORRECTED: not emitted)
//   - Output uses only existing Engine confidence vocabulary: 'estimated'
//   - source: 'conversation' on all emitted observations
//   - measured_at: null unless temporal.explicit=true AND reference resolves to today
//   - Does NOT produce PERSON_NODE_STATE, diagnosis, constraint, or action
//   - Does NOT modify the Engine, fetchHealthData, activation, or inference
//   - Does NOT mutate the original Structured Fact or the PersonModel
//
// Allowed mappings (locked):
//   SELF_REPORTED_MEASUREMENT  weight_kg, waist_cm       → observations_supplement
//   SELF_REPORTED_BEHAVIOR     sedentary_hours            → observations_supplement
//   FUNCTIONAL_ABILITY         vynest_nakup, zvednout_vnouce, vstat_ze_zeme → onboarding_inputs_supplement
//   SUBJECTIVE_SYMPTOM         exertional_dyspnea, gait_stability → onboarding_inputs_supplement
//
// All other claim types and entity refs: not emitted.

import { CLAIM_TYPES, TEMPORAL_SCOPES } from '../bridge/structuredFactBridge.js';
import { LIFECYCLE } from '../personModel/personModel.js';

// ── Measurement obs_type map ──────────────────────────────────────────────────
// Only entity refs with EXACT or PARTIAL equivalence to existing Engine obs_types.

const MEASUREMENT_OBS_MAP = {
  weight_kg: 'weight_kg',
  waist_cm:  'waist_cm',
};

const BEHAVIOR_OBS_MAP = {
  sedentary_hours: 'sedentary_hours_day',
};

// ── Functional ability and symptom onboarding keys ───────────────────────────

const FUNCTIONAL_ABILITY_KEYS = new Set([
  'vynest_nakup',
  'zvednout_vnouce',
  'vstat_ze_zeme',
]);

const SYMPTOM_ONBOARDING_KEYS = new Set([
  'exertional_dyspnea',
  'gait_stability',
]);

// ── Today-resolving references (explicit measurement event today) ─────────────
// Only these references allow measured_at = extracted_at date.
// All others → null.

const TODAY_REFERENCES = new Set([
  'today',
  'dnes',
  'dnes ráno',
  'dnes odpoledne',
  'dnes večer',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveMeasuredAt(fact) {
  const { scope, explicit, reference } = fact.temporal ?? {};
  if (!explicit) return null;
  if (scope !== TEMPORAL_SCOPES.CURRENT && scope !== TEMPORAL_SCOPES.POINT) return null;
  const ref = typeof reference === 'string' ? reference.toLowerCase().trim() : '';
  if (!TODAY_REFERENCES.has(ref)) return null;
  // extracted_at is the processing timestamp; take the date portion only.
  if (!fact.extracted_at) return null;
  return fact.extracted_at.slice(0, 10);
}

function isNegative(value) {
  return value === false || value === 0 || value === 'no' || value === 'false' || value === '0' || value === 'ne';
}

function provenance(fact) {
  return {
    pm_fact_id:           fact.fact_id,
    pm_claim_type:        fact.claim_type,
    pm_lifecycle:         LIFECYCLE.ACTIVE,
    pm_precision:         fact.precision ?? null,
    pm_speaker_certainty: fact.speaker_certainty ?? null,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * adaptPersonModelToEngineInputs
 *
 * Translates ACTIVE Person Model facts into Engine input supplements.
 * HISTORICAL and CORRECTED facts are not emitted.
 *
 * @param {PersonModel} personModel
 * @returns {{
 *   observations_supplement: object[],
 *   onboarding_inputs_supplement: Record<string, string|boolean>
 * }}
 */
export function adaptPersonModelToEngineInputs(personModel) {
  const observations_supplement = [];
  const onboarding_inputs_supplement = {};

  const activeFacts = personModel.getActive();

  for (const { fact } of activeFacts) {
    const { claim_type, entity } = fact;
    const entityRef = entity?.ref ?? null;

    // ── SELF_REPORTED_MEASUREMENT: weight_kg, waist_cm ───────────────────────
    if (claim_type === CLAIM_TYPES.SELF_REPORTED_MEASUREMENT) {
      const obsType = MEASUREMENT_OBS_MAP[entityRef];
      if (obsType && fact.value != null) {
        observations_supplement.push({
          obs_type:    obsType,
          value:       fact.value,
          unit:        fact.unit ?? null,
          measured_at: deriveMeasuredAt(fact),
          source:      'conversation',
          confidence:  'estimated',
          ...provenance(fact),
        });
      }
      continue;
    }

    // ── SELF_REPORTED_BEHAVIOR: sedentary_hours ───────────────────────────────
    if (claim_type === CLAIM_TYPES.SELF_REPORTED_BEHAVIOR) {
      const obsType = BEHAVIOR_OBS_MAP[entityRef];
      if (obsType && fact.value != null) {
        observations_supplement.push({
          obs_type:    obsType,
          value:       fact.value,
          unit:        fact.unit ?? null,
          measured_at: null,
          source:      'conversation',
          confidence:  'estimated',
          ...provenance(fact),
        });
      }
      continue;
    }

    // ── FUNCTIONAL_ABILITY: binary onboarding keys ────────────────────────────
    if (claim_type === CLAIM_TYPES.FUNCTIONAL_ABILITY) {
      if (FUNCTIONAL_ABILITY_KEYS.has(entityRef) && fact.value != null) {
        onboarding_inputs_supplement[entityRef] = isNegative(fact.value) ? 'no' : 'yes';
      }
      continue;
    }

    // ── SUBJECTIVE_SYMPTOM: PATH evidence onboarding keys ────────────────────
    if (claim_type === CLAIM_TYPES.SUBJECTIVE_SYMPTOM) {
      if (SYMPTOM_ONBOARDING_KEYS.has(entityRef) && fact.value != null) {
        onboarding_inputs_supplement[entityRef] = isNegative(fact.value) ? 'no' : 'yes';
      }
      continue;
    }

    // All other claim types (USER_INTENTION, PREFERENCE, SELF_REPORTED_STATE,
    // and unmapped entity refs): not emitted.
  }

  return { observations_supplement, onboarding_inputs_supplement };
}
