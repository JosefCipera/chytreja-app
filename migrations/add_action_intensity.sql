-- Migration: add intensity column to longevity_actions
-- Intensity is first-class metadata for the Safety Gate in CHJ Engine v1 NBA.
-- Enum: LIGHT | MODERATE | VIGOROUS | HIGH_INTENSITY_INTERVAL
--
-- Baseline: all rows → MODERATE.
-- Then override specific cases by label/tag/tier patterns derived from manual audit.
-- New rows must set intensity explicitly; DEFAULT 'MODERATE' prevents nulls.
--
-- Safe to run multiple times (IF NOT EXISTS + idempotent UPDATEs via condition checks).

ALTER TABLE longevity_actions
  ADD COLUMN IF NOT EXISTS intensity text DEFAULT 'MODERATE'
  CHECK (intensity IN ('LIGHT', 'MODERATE', 'VIGOROUS', 'HIGH_INTENSITY_INTERVAL'));

-- ── Baseline ──────────────────────────────────────────────────────────────────
UPDATE longevity_actions SET intensity = 'MODERATE' WHERE intensity IS NULL;

-- ── HIGH_INTENSITY_INTERVAL ───────────────────────────────────────────────────
-- Interval, sprint, and plyometric explosive actions.
UPDATE longevity_actions SET intensity = 'HIGH_INTENSITY_INTERVAL'
WHERE
  (tags && ARRAY['interval', 'intervaly', 'norsky', 'sprint'])
  OR label ILIKE '%interval%'
  OR label ILIKE '%sprint%'
  OR label ILIKE '%naplno%'
  OR label ILIKE '%4×4%'
  OR label ILIKE '%4x4%'
  OR (protocol_type = 'SILOVY_PROTOKOL' AND tags && ARRAY['plyometrie', 'dopad'] AND tier >= 2);
-- Note: 'Kontrolovaný sestup z bedny' (tier 1 eccentric, not explosive) stays MODERATE.

-- ── VIGOROUS ──────────────────────────────────────────────────────────────────
-- Uphill, loaded hiking, and heavy compound strength (tier 3, non-HIIT).
UPDATE longevity_actions SET intensity = 'VIGOROUS'
WHERE intensity = 'MODERATE' AND (
  label ILIKE '%kopce%'
  OR label ILIKE '%kopec%'
  OR (label ILIKE '%turistika%' AND label ILIKE '%batohem%')
  OR (protocol_type = 'SILOVY_PROTOKOL' AND tier >= 3)
);

-- ── LIGHT ─────────────────────────────────────────────────────────────────────
-- Habit/bool actions (no defined dose = no physical intensity load).
-- Non-exercise protocols (nutrition, sleep, meditation, prevention, etc.).
-- SILOVY tier 1 explicitly light (label 'lehk').
-- Casual walks and post-meal strolls in TRAINING_PROTOKOL.
UPDATE longevity_actions SET intensity = 'LIGHT'
WHERE intensity = 'MODERATE' AND (
  type IN ('habit', 'bool')
  OR protocol_type IN (
    'MOBILITY_PROTOKOL', 'SLEEP_PROTOKOL', 'MEDITATION_PROTOKOL',
    'NUTRITION_PROTOKOL', 'STRESS_PROTOKOL', 'METABOL_PROTOKOL',
    'RESET_PROTOKOL', 'NEURO_PROTOKOL', 'PREVENTION_PROTOKOL',
    'MOVEMENT_PROTOKOL', 'BALANCE_PROTOKOL', 'STABILITY_PROTOKOL'
  )
  OR (protocol_type = 'TRAINING_PROTOKOL' AND (label ILIKE '%procházk%' OR label ILIKE '%procházka%'))
  OR (protocol_type = 'SILOVY_PROTOKOL' AND tier = 1 AND label ILIKE '%lehk%')
);

-- ── Verification query (run manually to check, do not execute as migration) ────
-- SELECT protocol_type, tier, type, intensity, label
-- FROM longevity_actions
-- WHERE protocol_type IN ('KARDIO_PROTOKOL','VYTRVALOST_PROTOKOL','SILOVY_PROTOKOL','TRAINING_PROTOKOL')
-- ORDER BY protocol_type, tier, intensity;
