-- v04_health_profile_extend.sql
-- Adds lifestyle, capacity, labs JSONB columns to user_health_profile.
-- Safe: additive only, no existing data touched.
-- Run manually in Supabase SQL Editor.

ALTER TABLE user_health_profile
  ADD COLUMN IF NOT EXISTS lifestyle JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capacity  JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS labs      JSONB DEFAULT '{}';

-- lifestyle keys: sedentary (bool), smoker (bool), alcohol (bool), stress_job (bool)
-- capacity keys: climb_4_floors (bool), lift_20kg (bool), breath_20s (bool),
--                stand_one_leg (bool), rise_from_floor (bool), fast_walk_2km (bool)
-- labs keys: hba1c (number), fasting_glucose (number), ldl (number), hdl (number),
--            triglycerides (number), crp (number), testosterone (number)

COMMENT ON COLUMN user_health_profile.lifestyle IS 'Lifestyle flags: sedentary, smoker, alcohol, stress_job';
COMMENT ON COLUMN user_health_profile.capacity  IS 'Physical capacity from onboarding test (Dekatlon)';
COMMENT ON COLUMN user_health_profile.labs      IS 'Key lab markers entered manually';
