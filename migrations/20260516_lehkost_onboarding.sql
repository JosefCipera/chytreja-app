-- Lehkost onboarding fields in user_profiles
-- Safe: only adds new nullable columns, no existing data touched

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS lh_identity    text,   -- 'energie' | 'lehci_telo' | 'kontrola' | 'stabilita' | 'znovu_zacit'
  ADD COLUMN IF NOT EXISTS lh_blocker     text,   -- 'vecery' | 'sladke' | 'vikendy' | 'pohyb' | 'unava' | 'chaos'
  ADD COLUMN IF NOT EXISTS lh_target_kg   numeric, -- target weight (optional, null = qualitative goal)
  ADD COLUMN IF NOT EXISTS lh_target_note text,   -- e.g. 'cítit se lehčeji každý den'
  ADD COLUMN IF NOT EXISTS lh_started_at  timestamptz; -- when Lehkost onboarding was completed
