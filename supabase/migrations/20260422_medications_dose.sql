-- =====================================================
-- Migration: add dose column + unique index to user_medications
-- Allows health-parse to upsert medications extracted from documents
-- =====================================================

ALTER TABLE user_medications
  ADD COLUMN IF NOT EXISTS dose text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_medications_user_name
  ON user_medications (user_id, name);
