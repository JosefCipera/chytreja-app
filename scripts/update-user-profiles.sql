-- =====================================================
-- Přidání sloupců height a weight do user_profiles
-- Run in Supabase SQL editor
-- =====================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS height integer,  -- cm
  ADD COLUMN IF NOT EXISTS weight integer;  -- kg
