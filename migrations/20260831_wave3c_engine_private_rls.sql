-- =============================================================
-- Wave 3C: Engine private data RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-08-31
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 4 tables — engine/check-in private user data.
--
--   daily_checkin      —   2 rows — many API callers (service_role)
--   node_state_history — 548 rows — many API callers (service_role)
--   node_inputs        —  20 rows — single caller api/tools/parse.js (service_role)
--   user_readiness     —  65 rows — many API callers (service_role)
--
-- Pre-flight verified (2026-08-31):
--   - RLS OFF 4/4, zero dormant policies on daily_checkin/node_inputs/user_readiness
--   - node_state_history has ONE dormant policy:
--       "Allow read by user_id" PERMISSIVE SELECT TO public USING(true)
--       → would expose ALL 548 rows cross-user after ENABLE RLS
--       → MUST BE DROPPED before ENABLE RLS (done atomically below)
--   - Raw ACL: anon/authenticated have full arwdDxtm grants on all 4
--   - Zero triggers, zero views, zero FK except:
--       node_state_history.node_id → longevity_nodes.id ON DELETE CASCADE (preserved)
--   - All active callers use service_role + Firebase requireAuth
--   - PRIVATE browser-direct access = 0
--
-- What this migration does:
--   daily_checkin:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated
--     2. ENABLE ROW LEVEL SECURITY
--   node_state_history:
--     1. DROP POLICY "Allow read by user_id" (dormant USING(true) — dangerous)
--     2. REVOKE ALL PRIVILEGES from anon, authenticated
--     3. ENABLE ROW LEVEL SECURITY
--   node_inputs:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated
--     2. ENABLE ROW LEVEL SECURITY
--   user_readiness:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated
--     2. ENABLE ROW LEVEL SECURITY
--
-- What this migration does NOT touch:
--   - No CREATE POLICY
--   - No FORCE RLS
--   - No DML / data changes
--   - No GRANT
--   - No functions, views, RPC, triggers
--   - No EXECUTE grants
--   - No other tables
--   - service_role grants preserved (BYPASSRLS)
--
-- ROLLBACK:
--   A) Emergency functional rollback (SECURITY-REGRESSIVE — reopens private data):
--      ALTER TABLE public.daily_checkin DISABLE ROW LEVEL SECURITY;
--      GRANT ALL PRIVILEGES ON TABLE public.daily_checkin TO anon, authenticated;
--      ALTER TABLE public.node_state_history DISABLE ROW LEVEL SECURITY;
--      GRANT ALL PRIVILEGES ON TABLE public.node_state_history TO anon, authenticated;
--      ALTER TABLE public.node_inputs DISABLE ROW LEVEL SECURITY;
--      GRANT ALL PRIVILEGES ON TABLE public.node_inputs TO anon, authenticated;
--      ALTER TABLE public.user_readiness DISABLE ROW LEVEL SECURITY;
--      GRANT ALL PRIVILEGES ON TABLE public.user_readiness TO anon, authenticated;
--
--   B) Exact historical rollback (CRITICALLY SECURITY-UNSAFE — NEPROVÁDĚT):
--      Same as A, plus:
--      CREATE POLICY "Allow read by user_id"
--        ON public.node_state_history FOR SELECT TO public USING (true);
--      This policy exposed all rows cross-user; do NOT recreate.
--
-- IDEMPOTENT: REVOKE is safe to re-run (WARNING only if privilege absent).
-- =============================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.daily_checkin
  FROM anon, authenticated;

ALTER TABLE public.daily_checkin
  ENABLE ROW LEVEL SECURITY;


-- CRITICAL:
-- dormant permissive policy USING(true) MUST be removed
-- before RLS is enabled.

DROP POLICY "Allow read by user_id"
  ON public.node_state_history;

REVOKE ALL PRIVILEGES
  ON TABLE public.node_state_history
  FROM anon, authenticated;

ALTER TABLE public.node_state_history
  ENABLE ROW LEVEL SECURITY;


REVOKE ALL PRIVILEGES
  ON TABLE public.node_inputs
  FROM anon, authenticated;

ALTER TABLE public.node_inputs
  ENABLE ROW LEVEL SECURITY;


REVOKE ALL PRIVILEGES
  ON TABLE public.user_readiness
  FROM anon, authenticated;

ALTER TABLE public.user_readiness
  ENABLE ROW LEVEL SECURITY;

COMMIT;
