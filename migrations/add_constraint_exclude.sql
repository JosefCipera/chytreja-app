-- add_constraint_exclude.sql
-- Audit hygiene: documents the constraint_exclude column on longevity_actions.
-- This column already exists in the live DB (added directly).
-- Running this file is a no-op if the column is already present.
-- Run in Supabase SQL Editor.

ALTER TABLE longevity_actions
  ADD COLUMN IF NOT EXISTS constraint_exclude text[] DEFAULT '{}';

COMMENT ON COLUMN longevity_actions.constraint_exclude IS
  'Body-region keys that exclude this action for a person with that constraint (e.g. knee, ankle_foot, lower_back, shoulder, elbow). Matched against CONSTRAINT_KEYWORDS in nextBestAction.js.';
