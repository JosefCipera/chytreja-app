-- Functional Mobility Slice v0.1
-- Adds modality metadata columns to longevity_actions for ASSISTIVE_PROTOKOL evaluation.
-- Inserts new ASSISTIVE_PROTOKOL actions (assistive device walking variants) and
-- BALANCE_PROTOKOL/STABILITY_PROTOKOL actions for GAIT_INSTABILITY intervention.
--
-- Safe to run multiple times: uses IF NOT EXISTS / INSERT ... ON CONFLICT DO NOTHING.
-- Does not modify any existing rows — only adds new columns (nullable) and new rows.
--
-- Run in Supabase SQL Editor.

-- ── Step 1: Add modality metadata columns ─────────────────────────────────────

ALTER TABLE longevity_actions
  ADD COLUMN IF NOT EXISTS modality         text,   -- UNAIDED | ONE_CRUTCH | TWO_POLES | WALKER | null
  ADD COLUMN IF NOT EXISTS support_sides    text,   -- none | unilateral | bilateral | null
  ADD COLUMN IF NOT EXISTS stability_support text,  -- low | medium | high | very_high | null
  ADD COLUMN IF NOT EXISTS upper_body_demand text,  -- none | low | medium | high | null
  ADD COLUMN IF NOT EXISTS load_distribution text;  -- symmetric | asymmetric | mixed | null

-- ── Step 2: Insert ASSISTIVE_PROTOKOL actions ─────────────────────────────────
-- One_Crutch: unilateral support, medium stability, medium upper body demand
-- Two_Poles:  bilateral support, high stability, medium upper body demand
-- Walker:     bilateral support, very_high stability, low upper body demand
-- Unaided:    no support (baseline for comparison — will get NEEDS_MORE_EVIDENCE with gait instability)

INSERT INTO longevity_actions
  (id, node_id, label, protocol_type, type, duration, reps, tier, tags, constraint_exclude,
   intensity, modality, support_sides, stability_support, upper_body_demand, load_distribution, active)
VALUES
  -- UNAIDED (baseline — NEEDS_MORE_EVIDENCE when gait instability present)
  (gen_random_uuid(),
   'rovnovaha',
   'Chůze bez pomůcky — 20 minut',
   'ASSISTIVE_PROTOKOL', 'timed', 1200, null, 1,
   ARRAY['chůze', 'mobilita', 'pohyb'],
   ARRAY[]::text[],
   'LIGHT', 'UNAIDED', 'none', 'low', 'none', 'symmetric',
   true),

  -- ONE_CRUTCH (unilateral support — POOR fit for bilateral proprioceptive deficit)
  (gen_random_uuid(),
   'rovnovaha',
   'Chůze s jednou berlou — 20 minut',
   'ASSISTIVE_PROTOKOL', 'timed', 1200, null, 1,
   ARRAY['chůze', 'mobilita', 'berla', 'pomůcka'],
   ARRAY[]::text[],
   'LIGHT', 'ONE_CRUTCH', 'unilateral', 'medium', 'medium', 'asymmetric',
   true),

  -- TWO_POLES (bilateral support — GOOD fit for bilateral proprioceptive deficit)
  (gen_random_uuid(),
   'rovnovaha',
   'Chůze s dvěma holemi — 20 minut',
   'ASSISTIVE_PROTOKOL', 'timed', 1200, null, 1,
   ARRAY['chůze', 'mobilita', 'hole', 'pomůcka'],
   ARRAY[]::text[],
   'LIGHT', 'TWO_POLES', 'bilateral', 'high', 'medium', 'symmetric',
   true),

  -- WALKER (bilateral, very high stability — GOOD for severe instability)
  (gen_random_uuid(),
   'rovnovaha',
   'Chůze s chodítkem — 20 minut',
   'ASSISTIVE_PROTOKOL', 'timed', 1200, null, 2,
   ARRAY['chůze', 'mobilita', 'chodítko', 'pomůcka'],
   ARRAY[]::text[],
   'LIGHT', 'WALKER', 'bilateral', 'very_high', 'low', 'symmetric',
   true)

ON CONFLICT DO NOTHING;

-- ── Step 3: Verify ────────────────────────────────────────────────────────────
-- Run these selects to confirm:
--
-- SELECT id, label, protocol_type, modality, support_sides, stability_support, upper_body_demand
-- FROM longevity_actions
-- WHERE protocol_type = 'ASSISTIVE_PROTOKOL';
--
-- SELECT id, label, protocol_type, tags
-- FROM longevity_actions
-- WHERE protocol_type IN ('BALANCE_PROTOKOL', 'STABILITY_PROTOKOL')
-- AND active = true;
