-- =============================================================
-- Wave 3D: Log / History private data RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-09-01
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 3 tables — log / history private user data.
--
--   vitality_score_history —  18 rows — no direct API callers; DB functions only
--                                        (calculate_vitality_score, recompute_vitality —
--                                         both SECURITY INVOKER, not called from any API endpoint)
--   mission_log            —  13 rows — many API callers (service_role)
--   orchestrator_log       — 146 rows — many API callers (service_role)
--
-- Pre-flight verified (2026-09-01):
--   - RLS OFF 3/3, FORCE RLS OFF 3/3
--   - ZERO policies on all 3 (confirmed LIVE — no phase1_read_* dormant policies present)
--   - Raw ACL: anon/authenticated have full arwdDxtm grants on all 3
--   - Zero triggers, zero views on all 3
--   - orchestrator_log.node_id → longevity_nodes.id ON DELETE SET NULL (preserved)
--   - No FK on vitality_score_history or mission_log
--   - All active callers use service_role + Firebase requireAuth
--   - PRIVATE browser-direct access = 0
--   - DB functions touching vitality_score_history:
--       calculate_vitality_score, recompute_vitality — both SECURITY INVOKER,
--       not called from any API endpoint — zero runtime blast radius
--
-- What this migration does:
--   For each of the 3 tables:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated
--     2. ENABLE ROW LEVEL SECURITY
--
-- What this migration does NOT touch:
--   - No CREATE POLICY
--   - No DROP POLICY
--   - No FORCE RLS
--   - No DML / data changes
--   - No GRANT
--   - No functions, views, RPC, triggers
--   - No EXECUTE grants
--   - No other tables
--   - service_role grants preserved (BYPASSRLS)
--   - FK orchestrator_log.node_id → longevity_nodes.id unchanged
--
-- ROLLBACK:
--   Emergency functional rollback (SECURITY-REGRESSIVE — reopens private data):
--     ALTER TABLE public.vitality_score_history DISABLE ROW LEVEL SECURITY;
--     GRANT ALL PRIVILEGES ON TABLE public.vitality_score_history TO anon, authenticated;
--     ALTER TABLE public.mission_log DISABLE ROW LEVEL SECURITY;
--     GRANT ALL PRIVILEGES ON TABLE public.mission_log TO anon, authenticated;
--     ALTER TABLE public.orchestrator_log DISABLE ROW LEVEL SECURITY;
--     GRANT ALL PRIVILEGES ON TABLE public.orchestrator_log TO anon, authenticated;
--
-- IDEMPOTENT: REVOKE is safe to re-run (WARNING only if privilege absent).
-- =============================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.vitality_score_history
  FROM anon, authenticated;

ALTER TABLE public.vitality_score_history
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.mission_log
  FROM anon, authenticated;

ALTER TABLE public.mission_log
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.orchestrator_log
  FROM anon, authenticated;

ALTER TABLE public.orchestrator_log
  ENABLE ROW LEVEL SECURITY;

COMMIT;
