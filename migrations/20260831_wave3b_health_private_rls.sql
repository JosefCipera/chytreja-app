-- =============================================================
-- Wave 3B: Health private data RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-08-31
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 4 tables — health private user data.
--
--   user_health_profile — 11 rows — many API callers (service_role)
--   user_medications    — 47 rows — many API callers (service_role)
--   user_constraints    — 10 rows — many API callers (service_role)
--   user_lab_results   — 291 rows — single caller api/tools/parse.js (service_role)
--
-- Pre-flight verified (2026-08-31):
--   - RLS OFF 4/4, zero policies, zero dormant policies
--   - Raw ACL: anon/authenticated have full arwdDxtm grants
--   - Zero FK, zero views, zero DB function dependencies
--   - user_health_profile has trigger trg_uhp_updated (BEFORE UPDATE,
--     SECURITY INVOKER, owner=postgres) — safe after migration:
--     anon/auth blocked at grant layer, service_role BYPASSRLS + owns grants
--   - All active callers use service_role + Firebase requireAuth
--   - PRIVATE browser-direct access = 0
--
-- What this migration does:
--   For each of the 4 tables:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated
--     2. ENABLE ROW LEVEL SECURITY
--
-- What this migration does NOT touch:
--   - No CREATE POLICY / DROP POLICY
--   - No FORCE RLS
--   - No DML / data changes
--   - No GRANT
--   - No functions, views, RPC, triggers
--   - No other tables
--   - service_role grants preserved (BYPASSRLS)
--   - trg_uhp_updated untouched
--
-- ROLLBACK:
--   ALTER TABLE public.user_health_profile DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_health_profile TO anon, authenticated;
--   ALTER TABLE public.user_medications DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_medications TO anon, authenticated;
--   ALTER TABLE public.user_constraints DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_constraints TO anon, authenticated;
--   ALTER TABLE public.user_lab_results DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_lab_results TO anon, authenticated;
--
-- IDEMPOTENT: REVOKE is safe to re-run (WARNING only if privilege absent).
-- =============================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_health_profile
  FROM anon, authenticated;

ALTER TABLE public.user_health_profile
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_medications
  FROM anon, authenticated;

ALTER TABLE public.user_medications
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_constraints
  FROM anon, authenticated;

ALTER TABLE public.user_constraints
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_lab_results
  FROM anon, authenticated;

ALTER TABLE public.user_lab_results
  ENABLE ROW LEVEL SECURITY;

COMMIT;
