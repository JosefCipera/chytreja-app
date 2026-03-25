/**
 * Bio-Age estimation engine (CHJ v0.2.0)
 *
 * Based on: Levine phenotypic age model + Attia "Outlive" biomarker framework.
 * Produces:
 *   - bioAgeDelta:  estimated years younger/older vs. chronological age
 *   - confidence:   0.0–1.0 weighted sum of available biomarkers
 *   - label:        HUD display label (EST / REF / VRF)
 *   - tier:         1 / 2 / 3 / 4 (highest tier with data)
 *
 * ─────────────────────────────────────────────────────────────────
 * CONFIDENCE WEIGHTS (single source of truth)
 * ─────────────────────────────────────────────────────────────────
 * Tier 1 — Basic profile          max  20%  (onboarding answers)
 * Tier 2 — Wearable data          +35% → 55% (HRV, VO₂max, sleep arch.)
 * Tier 3 — Basic blood panel      +25% → 80% (glucose, CRP, lipids…)
 * Tier 4 — Advanced biomarkers    +15% → 95% (DNA methylation, telomeres)
 * ─────────────────────────────────────────────────────────────────
 */

export const BIO_AGE_INPUTS = {
  // ── Tier 1: Basic profile (onboarding questionnaire) ─────────────
  bmi:                 { weight: 0.05, tier: 1, label: 'BMI' },
  resting_hr_manual:   { weight: 0.04, tier: 1, label: 'Klidový tep' },
  sleep_hours:         { weight: 0.03, tier: 1, label: 'Hodiny spánku' },
  activity_level:      { weight: 0.04, tier: 1, label: 'Úroveň aktivity' },
  smoking:             { weight: 0.02, tier: 1, label: 'Kouření' },
  alcohol:             { weight: 0.02, tier: 1, label: 'Alkohol' },
  // Tier 1 max: 20%

  // ── Tier 2: Wearable / continuous tracking ────────────────────────
  hrv:                 { weight: 0.15, tier: 2, label: 'HRV' },          // #1 proxy, strongest signal
  vo2max:              { weight: 0.10, tier: 2, label: 'VO₂max' },       // Attia's #1 longevity predictor
  sleep_quality:       { weight: 0.05, tier: 2, label: 'Kvalita spánku' }, // deep+REM %
  steps_neat:          { weight: 0.03, tier: 2, label: 'Pohyb/kroky' },
  resting_hr_cont:     { weight: 0.02, tier: 2, label: 'Kontinuální tep' },
  // Tier 2 cumulative max: 55%

  // ── Tier 3: Basic blood panel (praktický lékař / preventivní prohlídka) ──
  glucose_hba1c:       { weight: 0.05, tier: 3, label: 'Glukóza/HbA1c' },
  crp:                 { weight: 0.05, tier: 3, label: 'CRP' },            // systemic inflammation
  triglycerides_hdl:   { weight: 0.05, tier: 3, label: 'Triglyceridy/HDL' },
  blood_pressure:      { weight: 0.03, tier: 3, label: 'Krevní tlak' },
  grip_strength:       { weight: 0.04, tier: 3, label: 'Svalová síla' },
  waist_circumference: { weight: 0.03, tier: 3, label: 'Obvod pasu' },
  // Tier 3 cumulative max: 80%

  // ── Tier 4: Advanced biomarkers ───────────────────────────────────
  testosterone_igf1:   { weight: 0.05, tier: 4, label: 'Testosteron/IGF-1' },
  dna_methylation:     { weight: 0.10, tier: 4, label: 'DNA methylace' },  // epigenetic clock (gold standard)
  // Tier 4 cumulative max: 95%
};

/**
 * Calculate confidence level from available biomarkers.
 *
 * @param {string[]} availableKeys — list of BIO_AGE_INPUTS keys the user has provided
 * @returns {{ confidence: number, tier: number, missingForNext: string[] }}
 */
export function calcConfidence(availableKeys = []) {
  const available = new Set(availableKeys);
  let confidence = 0;
  let highestTier = 0;

  for (const [key, meta] of Object.entries(BIO_AGE_INPUTS)) {
    if (available.has(key)) {
      confidence += meta.weight;
      if (meta.tier > highestTier) highestTier = meta.tier;
    }
  }

  confidence = Math.min(confidence, 0.95); // cap at 95 %

  // What's still missing to reach next confidence threshold?
  const thresholds = [0.25, 0.55, 0.80];
  const nextThreshold = thresholds.find(t => t > confidence) ?? null;
  const missingForNext = nextThreshold
    ? Object.entries(BIO_AGE_INPUTS)
        .filter(([k, m]) => !available.has(k) && m.weight + confidence <= nextThreshold + 0.01)
        .sort((a, b) => b[1].weight - a[1].weight)
        .slice(0, 3)
        .map(([_, m]) => m.label)
    : [];

  return { confidence, tier: highestTier, missingForNext };
}

/**
 * Derive HUD display label from confidence.
 *
 * @param {number} confidence  0.0–1.0
 * @returns {{ key: string, shortLabel: string, color: string }}
 */
export function confidenceLabel(confidence) {
  if (confidence >= 0.60) return { key: 'VRF_BIO_VEK',  shortLabel: 'VRF',  color: 'green'  };
  if (confidence >= 0.25) return { key: 'REF_BIO_VEK',  shortLabel: 'REF',  color: 'yellow' };
  return                         { key: 'EST_BIO_VEK',  shortLabel: 'EST',  color: 'slate'  };
}

/**
 * Reference ranges per biomarker (Attia / Levine framework).
 *
 * perUnit:  years-delta per ONE unit of deviation from optimal
 *           negative perUnit = higher value → younger (e.g. HRV)
 * maxDelta: absolute clamp for this single marker (years)
 * optimalFn(age): use instead of optimal when range is age-dependent
 */
const MARKER_REFS = {
  // ── From user's Excel + Attia priorities ──────────────────────────

  rhr: {
    // Klidová tepovka (bpm). Optimal 50–65.
    optimal: 57,
    perUnit:  1 / 5,   // +1 yr per 5 bpm above optimal; -1 yr per 5 bpm below
    maxDelta: 4,
  },

  hrv: {
    // HRV RMSSD (ms). Optimal declines with age: ~80 ms at 25, ~35 ms at 65.
    optimalFn: (age) => Math.max(35, 80 - Math.max(0, age - 25)),
    perUnit: -1 / 10,  // negative: higher HRV = biologically younger
    maxDelta: 6,       // strongest non-invasive aging proxy → highest cap
  },

  glucose: {
    // Lačná glukóza (mg/dL). Attia target: 70–85.
    optimal: 83,
    perUnit:  1 / 8,   // +1 yr per 8 mg/dL above optimal
    maxDelta: 5,
  },

  systolic: {
    // Systolický tlak (mmHg). Optimal <120.
    optimal: 115,
    perUnit:  1 / 8,   // +1 yr per 8 mmHg above optimal
    maxDelta: 4,
  },

  waist_height: {
    // Obvod pasu / výška (bezrozměrný poměr, např. 0.52). Optimal <0.50.
    optimal: 0.47,
    perUnit:  1 / 0.03, // +1 yr per 0.03 above optimal
    maxDelta: 4,
  },

  // ── Optional extras (wearables / lab) ────────────────────────────

  vo2max: {
    // VO₂max (ml/kg/min). Age-dependent optimal (Attia "Centenarian Decathlon").
    // Roughly: optimal = 55 - (age - 25) * 0.5  [men; women: -5]
    optimalFn: (age) => Math.max(30, 55 - Math.max(0, age - 25) * 0.5),
    perUnit: -1 / 3,   // negative: higher VO₂max = younger
    maxDelta: 6,
  },

  crp: {
    // Vysokosenzitivní CRP (mg/L). Optimal <1.0.
    optimal: 0.8,
    perUnit:  1 / 1,   // +1 yr per 1 mg/L above optimal
    maxDelta: 4,
  },
};

/**
 * Calculate bio-age delta from actual biomarker values.
 *
 * Each marker's deviation from its age-optimal reference is converted to
 * years delta, then averaged (weighted equally per marker provided).
 * Falls back to vitality-proxy if no markers supplied.
 *
 * @param {Object} markers    — { rhr, hrv, glucose, systolic, waist_height, vo2max, crp }
 *                              (only include keys the user has provided)
 * @param {number} chronoAge  — chronological age (years)
 * @returns {number}          — delta in years (negative = biologically younger)
 */
export function calcBioAgeDeltaFromMarkers(markers = {}, chronoAge = 40) {
  const contributions = [];

  for (const [key, value] of Object.entries(markers)) {
    const ref = MARKER_REFS[key];
    if (!ref || value == null) continue;

    const optimal = ref.optimalFn ? ref.optimalFn(chronoAge) : ref.optimal;
    const deviation = value - optimal;
    const rawDelta = deviation * ref.perUnit;
    const clamped = Math.max(-ref.maxDelta, Math.min(ref.maxDelta, rawDelta));
    contributions.push(clamped);
  }

  if (contributions.length === 0) return null; // no real data → caller uses proxy

  const sum = contributions.reduce((a, b) => a + b, 0);
  const avg = sum / contributions.length;
  return Math.max(-15, Math.min(15, Math.round(avg)));
}

/**
 * Vitality-proxy fallback (used when no real biomarker values are available).
 * 50 % vitality → 0 yrs, 100 % → −10 yrs, 0 % → +10 yrs.
 *
 * @param {number} vitalityPercent  0–100
 * @param {number} chronoAge
 * @returns {number}
 */
export function calcBioAgeDeltaProxy(vitalityPercent, chronoAge = 40) {
  const baseDelta = (50 - vitalityPercent) / 5;
  const ageFactor = chronoAge >= 60 ? 1.3 : chronoAge >= 40 ? 1.0 : 0.75;
  return Math.max(-15, Math.min(15, Math.round(baseDelta * ageFactor)));
}

/**
 * Full bio-age assessment — main entry point.
 *
 * Uses real biomarker values when available, otherwise falls back to vitality proxy.
 *
 * @param {Object} params
 * @param {number}   params.vitalityPercent   0–100 (fallback proxy)
 * @param {number}   params.chronoAge         chronological age
 * @param {string[]} params.availableKeys     keys present in biomarkers (for confidence)
 * @param {Object}   params.biomarkers        actual values { rhr, hrv, glucose, systolic, waist_height, … }
 * @returns {{ delta, confidence, tier, label, missingForNext, source }}
 */
export function assessBioAge({ vitalityPercent, chronoAge = 40, availableKeys = [], biomarkers = {} }) {
  // Try real markers first; fall back to vitality proxy
  const realDelta = calcBioAgeDeltaFromMarkers(biomarkers, chronoAge);
  const delta  = realDelta !== null ? realDelta : calcBioAgeDeltaProxy(vitalityPercent, chronoAge);
  const source = realDelta !== null ? 'markers' : 'proxy';

  const { confidence, tier, missingForNext } = calcConfidence(availableKeys);
  const label = confidenceLabel(confidence);
  return { delta, confidence, tier, label, missingForNext, source };
}
