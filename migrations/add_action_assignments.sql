-- Feedback Loop v0.1 — ACTION_EXECUTION layer
-- Creates action_assignments table for Engine v1 execution tracking.
--
-- Separate from mission_log (Vesmír game loop):
--   mission_log.node_id   → FK longevity_nodes (Vesmír IDs: 'rovnovaha', 'sila')
--   action_assignments    → Engine v1 IDs (intervention_id, selected_leverage_node from master.json)
--
-- Safe to run multiple times: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- Does not touch mission_log, user_metrics, or any existing table.
--
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS action_assignments (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL,
  action_id               text        NOT NULL REFERENCES longevity_actions(id),
  intervention_id         text        NOT NULL,
  selected_leverage_node  text        NOT NULL,
  engine_version          text        NOT NULL,
  status                  text        NOT NULL
                            CHECK (status IN ('ASSIGNED', 'COMPLETED', 'SKIPPED')),
  assigned_at             timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz,
  actual_duration_seconds int,
  actual_reps             int,
  assigned_date           date        NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS action_assignments_user_date
  ON action_assignments (user_id, assigned_date DESC);

CREATE INDEX IF NOT EXISTS action_assignments_user_intervention
  ON action_assignments (user_id, intervention_id, status);

-- Verify:
-- SELECT id, intervention_id, status, assigned_date
-- FROM action_assignments
-- LIMIT 5;
