-- =============================================================
-- Wave 3F: Core private data RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-09-01
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 3 tables — core private user data.
--
--   user_profiles     —  6 rows — many API callers (service_role)
--                                  2 dormant policies — 1× demo-row exposure risk
--   user_metrics      — 126 rows — many API callers (service_role)
--                                  1 trigger: trg_sync_state → sync_user_metrics_state()
--                                             (SECURITY INVOKER, in-memory only, zero table access)
--                                  2 dependent views: user_bottlenecks, v_vitality_dashboard
--                                  3 dormant policies — 1× demo-row exposure risk
--   user_node_weights —  80 rows — no direct API callers; accessed via DB functions + v_vitality_dashboard
--                                  1 dormant policy — demo-row exposure + ALL write risk
--
-- Pre-flight verified (2026-09-01):
--   - RLS OFF 3/3, FORCE RLS OFF 3/3
--   - 6 dormant policies confirmed LIVE (details below)
--   - Raw ACL: anon/authenticated have full arwdDxtm grants on all 3
--   - Zero FK on all 3 tables
--   - Triggers: user_metrics has trg_sync_state (BEFORE INSERT/UPDATE → sync_user_metrics_state())
--     sync_user_metrics_state() = SECURITY INVOKER, owner=postgres — in-memory only, no table access
--     After lockdown: fires in service_role context → BYPASSRLS → zero regression
--   - Dependent views (user_bottlenecks, v_vitality_dashboard): ACL = {postgres, service_role} only
--     (anon/auth already REVOKE'd in Wave 3 Prelude) — service_role BYPASSRLS unaffected
--   - PRIVATE browser-direct access = 0 for all 3 tables
--   - All active API callers use service_role + Firebase requireAuth
--   - 19/19 DB functions are SECURITY INVOKER — zero SECURITY DEFINER in public schema
--   - anon EXECUTE + INVOKER → table access denied post-lockdown → ERROR 42501 (no bypass path)
--
-- Dormant policies being dropped (6 total):
--
--   user_profiles:
--     "Users can view own profile"
--       SELECT USING (auth.uid()::text = user_id OR user_id = 'demo-user-123')
--       RISK: demo-row exposure (auth.uid() = NULL for Firebase; demo-user-123 exception passes)
--     "Users can update own profile"
--       UPDATE USING (auth.uid()::text = user_id)
--       Risk: low (no demo exception); DROP for hygiene / zero-policy consistency
--
--   user_metrics:
--     "Users can view own metrics"
--       SELECT USING (auth.uid()::text = user_id OR user_id = 'demo-user-123')
--       RISK: demo-row exposure
--     "Users can insert own metrics"
--       INSERT WITH CHECK (auth.uid()::text = user_id)
--       Risk: low; DROP for hygiene
--     "Users can update own metrics"
--       UPDATE USING (auth.uid()::text = user_id)
--       Risk: low; DROP for hygiene
--
--   user_node_weights:
--     "Users can view own weights"
--       ALL USING (auth.uid()::text = user_id OR user_id = 'demo-user-123')
--       RISK: demo-row exposure + ALL cmd = write exposure on demo data
--
-- What this migration does:
--   1. DROP IF EXISTS all 6 dormant policies (atomically before ENABLE RLS)
--   2. REVOKE ALL PRIVILEGES from anon, authenticated on all 3 tables
--   3. ENABLE ROW LEVEL SECURITY on all 3 tables
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
--   - trg_sync_state trigger unchanged
--   - user_bottlenecks / v_vitality_dashboard view definitions unchanged
--
-- ROLLBACK:
--   Emergency functional rollback (SECURITY-REGRESSIVE — reopens private data):
--     ALTER TABLE public.user_profiles     DISABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.user_metrics      DISABLE ROW LEVEL SECURITY;
--     ALTER TABLE public.user_node_weights DISABLE ROW LEVEL SECURITY;
--     GRANT ALL PRIVILEGES ON TABLE public.user_profiles     TO anon, authenticated;
--     GRANT ALL PRIVILEGES ON TABLE public.user_metrics      TO anon, authenticated;
--     GRANT ALL PRIVILEGES ON TABLE public.user_node_weights TO anon, authenticated;
--
-- IDEMPOTENT: DROP POLICY IF EXISTS + REVOKE safe to re-run.
-- =============================================================

BEGIN;

-- user_profiles
DROP POLICY IF EXISTS "Users can view own profile"   ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- user_metrics
DROP POLICY IF EXISTS "Users can view own metrics"   ON public.user_metrics;
DROP POLICY IF EXISTS "Users can insert own metrics" ON public.user_metrics;
DROP POLICY IF EXISTS "Users can update own metrics" ON public.user_metrics;

-- user_node_weights
DROP POLICY IF EXISTS "Users can view own weights"   ON public.user_node_weights;

-- Remove browser DB privileges
REVOKE ALL PRIVILEGES
  ON TABLE public.user_profiles
  FROM anon, authenticated;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_metrics
  FROM anon, authenticated;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_node_weights
  FROM anon, authenticated;

-- Enable deny-all RLS
ALTER TABLE public.user_profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_metrics
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_node_weights
  ENABLE ROW LEVEL SECURITY;

COMMIT;
