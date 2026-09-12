// evidenceResolution.js — Evidence Resolution Contract (Engine read layer)
//
// Defines HOW each evidence type is considered "resolved" by the engine.
// Pure engine module — no imports from persistence or write adapters.
//
// evidence_kind:
//   RAW_VALUE         — user provides a measurable value (numeric or categorical).
//                       Canonical copy lives in value_source[value_key].
//   AVAILABILITY_ONLY — only tracks whether data exists; no single value to capture via dialog.
//                       Example: steps_day (continuous wearable stream).
//   DERIVED           — computed from multi-point time series; dialog can only capture NOT_AVAILABLE.
//                       Example: temporal_activity_trend (requires 30+ observations).
//
// resolved = canonical value exists in the specified value_source
//            OR evidence_availability[evidence_type] is set (AVAILABLE or NOT_AVAILABLE)
//
// NOT_AVAILABLE stops ASK repetition only. It is never used as a clinical result.
// The distinction between AVAILABLE and NOT_AVAILABLE is intentionally not exposed to inference —
// both mean "we asked and got an answer; stop asking."

export const EVIDENCE_RESOLUTION_REGISTRY = {
  // ── Wearable ─────────────────────────────────────────────────────────────────
  steps_day: {
    evidence_kind:       'AVAILABILITY_ONLY',
    value_source:        null,
    value_key:           null,
    tracks_availability: true,
    acquisition_method:  'wearable',
  },
  temporal_activity_trend: {
    evidence_kind:       'DERIVED',
    value_source:        null,
    value_key:           null,
    tracks_availability: true,
    acquisition_method:  'wearable',
  },

  // ── Functional tests ─────────────────────────────────────────────────────────
  tug_test: {
    evidence_kind:       'RAW_VALUE',
    value_source:        'physical',
    value_key:           'tug_test',
    tracks_availability: true,
    acquisition_method:  'self_report',
  },
  chair_stand_30s: {
    evidence_kind:       'RAW_VALUE',
    value_source:        'physical',
    value_key:           'chair_stand_30s',
    tracks_availability: true,
    acquisition_method:  'self_report',
  },
  grip_strength: {
    evidence_kind:       'RAW_VALUE',
    value_source:        'physical',
    value_key:           'grip_strength',
    tracks_availability: true,
    acquisition_method:  'self_report',
  },

  // ── Gait / balance self-report ───────────────────────────────────────────────
  // "Cítíš se při běžné chůzi stabilně?" — yes/no, written to physical.gait_stability.
  // Resolved when ANY value is present (including 'Ne.' / 'Ano.') — the question has
  // been answered; we stop asking regardless of the polarity.
  // tracks_availability: false — physical[key] is the canonical source, no
  // separate availability marker needed (unlike functional tests where "I don't have
  // the result" is a distinct NOT_AVAILABLE state).
  //
  // MODEL GAP (separate from STOP #8 loop fix): physical.gait_stability = 'Ne.'
  // is not yet read as a +1 signal in inference.js GAIT_INSTABILITY strength counter.
  // Tracked as data-contract debt — do not fix here.
  gait_stability: {
    evidence_kind:       'RAW_VALUE',
    value_source:        'physical',
    value_key:           'gait_stability',
    tracks_availability: false,
    acquisition_method:  'question',
  },
};

/**
 * Returns true when the engine should NOT include obs_type in missing_evidence.
 *
 * Resolved when:
 *   - AVAILABILITY_ONLY / DERIVED: evidence_availability[obs_type] is set
 *   - RAW_VALUE (physical): canonical value exists in onboarding_inputs[value_key]
 *   - RAW_VALUE (observations): at least one observation with matching obs_type
 *   - Any kind: evidence_availability[obs_type] is set (fallback — covers NOT_AVAILABLE)
 *
 * Returns false for unknown obs_types (not in registry) — engine behaviour unchanged.
 */
export function isEvidenceResolved(obs_type, clinicalHistory) {
  const reg = EVIDENCE_RESOLUTION_REGISTRY[obs_type];
  if (!reg) return false;

  const ea = clinicalHistory.evidence_availability || {};

  if (reg.evidence_kind === 'AVAILABILITY_ONLY' || reg.evidence_kind === 'DERIVED') {
    return ea[obs_type] != null;
  }

  // RAW_VALUE: check canonical source first
  if (reg.value_source === 'physical') {
    const oi = clinicalHistory.onboarding_inputs || {};
    if (reg.value_key && oi[reg.value_key] != null) return true;
  } else if (reg.value_source === 'observations') {
    const obs = clinicalHistory.observations || [];
    if (obs.some(o => o.obs_type === obs_type)) return true;
  }

  return ea[obs_type] != null;
}
