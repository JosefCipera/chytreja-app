// api/lib/personModel/personModel.js
// Person Model #1 — Persistent Learning Model (in-memory)
//
// Responsibility:
//   Maintain a queryable, lifecycle-annotated index over accumulated
//   Structured Facts so a later layer can ask "what does CHJ currently
//   know about this person and their world?" while preserving full
//   epistemic properties of every fact.
//
// Architecture:
//   IMMUTABLE STRUCTURED FACT HISTORY  (append-only, never mutated)
//   + LIGHTWEIGHT LIFECYCLE INDEX       (fact_id → lifecycle entry)
//
// Lifecycle states:
//   ACTIVE    — currently relevant, not superseded or corrected
//   HISTORICAL — superseded by a newer SELF_REPORTED_MEASUREMENT of same
//                subject+entity, OR a past-scoped measurement on arrival
//   CORRECTED — explicitly marked as erroneous via correction_of signal
//
// Contract:
//   - Structured Facts are NEVER mutated
//   - No derived facts
//   - No diagnosis, causal inference, or truth resolution
//   - Supersession applies ONLY to SELF_REPORTED_MEASUREMENT
//   - Supersession requires determinably-later applicability time
//   - WHEN UNCERTAIN, SUPERSEDE LESS
//   - Explicit corrections require an intake signal — never inferred from value diff

import { CLAIM_TYPES, TEMPORAL_SCOPES } from '../bridge/structuredFactBridge.js';

// ── Lifecycle constants ────────────────────────────────────────────────────────

export const LIFECYCLE = {
  ACTIVE:    'ACTIVE',
  HISTORICAL: 'HISTORICAL',
  CORRECTED: 'CORRECTED',
};

// ── Applicability helpers ──────────────────────────────────────────────────────
// Derives "what real-world time does this measurement apply to?"
// from temporal fields already in the locked Structured Fact schema.
//
// Returns:
//   { kind: 'timestamp', value: Date }  — concrete point in time
//   { kind: 'past' }                    — explicitly refers to a past event
//   { kind: 'indeterminate' }           — cannot establish safely

// POINT references that are unambiguously about the past
const PAST_POINT_REFERENCES = new Set([
  'yesterday', 'last week', 'last month',
  'včera', 'minulý týden', 'minulý měsíc',
  'dříve', 'dřív',
]);

// Derives what real-world time a measurement applies to.
//
// Returns one of:
//   { kind: 'current', value: Date }  — applies at a concrete recent/present time
//   { kind: 'past' }                  — explicitly describes a past event
//   { kind: 'indeterminate' }         — cannot be established safely
//
// Design rule: WHEN UNCERTAIN → return indeterminate, not past.
// Only return 'past' when the reference is unambiguously a past period.
// Only return 'current' when the scope is CURRENT or POINT/today.

function deriveApplicabilityTime(fact) {
  const { scope, explicit, reference } = fact.temporal ?? {};
  const extractedAt = fact.extracted_at ? new Date(fact.extracted_at) : null;

  if (scope === TEMPORAL_SCOPES.HISTORICAL) {
    return { kind: 'past' };
  }

  if (scope === TEMPORAL_SCOPES.CURRENT) {
    if (!extractedAt) return { kind: 'indeterminate' };
    return { kind: 'current', value: extractedAt };
  }

  if (scope === TEMPORAL_SCOPES.POINT) {
    if (!explicit || !reference) return { kind: 'indeterminate' };
    const ref = reference.toLowerCase().trim();

    if (ref === 'today') {
      if (!extractedAt) return { kind: 'indeterminate' };
      const d = new Date(extractedAt);
      d.setHours(0, 0, 0, 0);
      return { kind: 'current', value: d };
    }

    // All other recognised POINT references are explicitly past
    if (PAST_POINT_REFERENCES.has(ref)) {
      return { kind: 'past' };
    }

    // Unrecognised reference — cannot safely classify
    return { kind: 'indeterminate' };
  }

  // RECURRING, FUTURE, UNSPECIFIED — not orderable as a scalar applicability point
  return { kind: 'indeterminate' };
}

// Returns true only when at is determinably strictly later than before.
// Also allows 'current' to supersede 'indeterminate' (a concrete current reading
// replaces an unqualified one for the same subject+entity).
function isApplicabilityLater(at, before) {
  // current vs current: compare timestamps
  if (at.kind === 'current' && before.kind === 'current') {
    return at.value > before.value;
  }
  // current supersedes indeterminate: a concrete "now" reading replaces an unqualified one
  if (at.kind === 'current' && before.kind === 'indeterminate') {
    return true;
  }
  // All other combinations: cannot safely establish ordering
  return false;
}

// ── PersonModel class ──────────────────────────────────────────────────────────

export class PersonModel {
  constructor() {
    // Append-only fact store: fact_id → StructuredFact (frozen object)
    this._facts = new Map();

    // Lifecycle index: fact_id → { status, corrected_by? }
    this._lifecycle = new Map();
  }

  // ── ingest(fact, options?) ─────────────────────────────────────────────────
  // Accepts a Structured Fact and optional Person Model intake metadata.
  //
  // options.correction_of — fact_id this fact explicitly corrects.
  //   NOT a Structured Fact field. NOT added to the fact.
  //   When present: referenced fact → CORRECTED; this fact → ACTIVE.
  //   When absent:  supersession rule applies for measurements; other types → ACTIVE.

  ingest(fact, options = {}) {
    if (!fact || typeof fact !== 'object' || !fact.fact_id) {
      throw new Error('PersonModel.ingest: fact must be a Structured Fact with fact_id');
    }

    // Store immutable copy — freeze to enforce no mutation
    const frozen = Object.freeze({ ...fact });
    this._facts.set(fact.fact_id, frozen);

    const { correction_of } = options;

    // ── Explicit correction ────────────────────────────────────────────────────
    if (correction_of != null) {
      if (this._lifecycle.has(correction_of)) {
        this._lifecycle.set(correction_of, {
          status:       LIFECYCLE.CORRECTED,
          corrected_by: fact.fact_id,
        });
      }
      // New fact is always ACTIVE when it is a correction
      this._lifecycle.set(fact.fact_id, { status: LIFECYCLE.ACTIVE });
      return;
    }

    // ── Measurement-only: initial status from temporal scope ───────────────────
    if (fact.claim_type === CLAIM_TYPES.SELF_REPORTED_MEASUREMENT) {
      const appTime = deriveApplicabilityTime(fact);

      if (appTime.kind === 'past') {
        // Past-scoped measurement: historical on arrival, never supersedes anything
        this._lifecycle.set(fact.fact_id, { status: LIFECYCLE.HISTORICAL });
        return;
      }

      // Not past — new fact starts ACTIVE; then check whether it supersedes existing
      this._lifecycle.set(fact.fact_id, { status: LIFECYCLE.ACTIVE });
      this._applyMeasurementSupersession(fact, appTime);
      return;
    }

    // ── All other claim types: always ACTIVE, never auto-superseded ────────────
    this._lifecycle.set(fact.fact_id, { status: LIFECYCLE.ACTIVE });
  }

  // ── _applyMeasurementSupersession ─────────────────────────────────────────
  // Checks whether the new measurement should supersede an existing ACTIVE one.
  // WHEN UNCERTAIN, SUPERSEDE LESS.

  _applyMeasurementSupersession(newFact, newAppTime) {
    const key = {
      claim_type: newFact.claim_type,
      subject:    newFact.subject,
      entity_ref: newFact.entity?.ref,
    };

    for (const [existingId, entry] of this._lifecycle) {
      if (entry.status !== LIFECYCLE.ACTIVE) continue;
      if (existingId === newFact.fact_id) continue;

      const existing = this._facts.get(existingId);
      if (!existing) continue;

      // Must be same claim type, subject, and entity ref
      if (
        existing.claim_type !== key.claim_type ||
        existing.subject    !== key.subject    ||
        existing.entity?.ref !== key.entity_ref
      ) continue;

      // Must also be a measurement (guard)
      if (existing.claim_type !== CLAIM_TYPES.SELF_REPORTED_MEASUREMENT) continue;

      const existingAppTime = deriveApplicabilityTime(existing);

      // Supersede only when new is determinably later — otherwise leave both ACTIVE
      if (isApplicabilityLater(newAppTime, existingAppTime)) {
        this._lifecycle.set(existingId, { status: LIFECYCLE.HISTORICAL });
      }
      // If uncertain: both remain ACTIVE — do nothing
    }
  }

  // ── query(filters) ────────────────────────────────────────────────────────
  // Returns Structured Facts matching all provided filters,
  // each annotated with lifecycle metadata.
  //
  // filters:
  //   entity_ref       — exact match on fact.entity.ref
  //   entity_type      — exact match on fact.entity.type
  //   claim_type       — exact match on fact.claim_type
  //   subject          — exact match on fact.subject
  //   lifecycle_status — exact match on lifecycle status (ACTIVE/HISTORICAL/CORRECTED)
  //
  // Returns: Array of { fact: StructuredFact, lifecycle: { status, corrected_by? } }
  // Fact objects are the frozen originals — never mutated.

  query(filters = {}) {
    const {
      entity_ref,
      entity_type,
      claim_type,
      subject,
      lifecycle_status,
    } = filters;

    const results = [];

    for (const [factId, fact] of this._facts) {
      const entry = this._lifecycle.get(factId) ?? { status: LIFECYCLE.ACTIVE };

      if (lifecycle_status !== undefined && entry.status !== lifecycle_status) continue;
      if (entity_ref  !== undefined && fact.entity?.ref  !== entity_ref)  continue;
      if (entity_type !== undefined && fact.entity?.type !== entity_type) continue;
      if (claim_type  !== undefined && fact.claim_type   !== claim_type)  continue;
      if (subject     !== undefined && fact.subject       !== subject)     continue;

      results.push({ fact, lifecycle: { ...entry } });
    }

    return results;
  }

  // ── Convenience getters ───────────────────────────────────────────────────

  // All ACTIVE facts
  getActive() {
    return this.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  }

  // Fact count in history (regardless of status)
  get size() {
    return this._facts.size;
  }
}
