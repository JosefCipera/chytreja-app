-- =============================================================
-- Wave 3 Pilot: user_biometrics RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-08-31
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 1 table — public.user_biometrics (private user data, biometrics)
--
-- Pre-flight verified (2026-08-31):
--   - row_count: 2
--   - RLS: OFF, zero policies, zero dormant policies
--   - Raw ACL: anon/authenticated have full arwdDxtm grants
--   - Zero FK, zero triggers, zero DB function/view dependencies
--   - Single caller: api/chat.js via service_role + Firebase auth (SELECT only)
--   - service_role BYPASSRLS — unaffected by this migration
--   - Graceful 0-rows handling verified in code (latestBio = null → no crash)
--
-- What this migration does:
--   1. REVOKE ALL PRIVILEGES on user_biometrics from anon, authenticated
--   2. ENABLE ROW LEVEL SECURITY on user_biometrics
--
-- What this migration does NOT touch:
--   - No CREATE POLICY / DROP POLICY
--   - No FORCE RLS
--   - No DML / data changes
--   - No GRANT
--   - No functions, views, RPC
--   - No other tables
--   - service_role grants preserved (BYPASSRLS — not affected by RLS)
--
-- ROLLBACK:
--   ALTER TABLE public.user_biometrics DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_biometrics TO anon, authenticated;
--
-- IDEMPOTENT: REVOKE is safe to re-run (WARNING only if privilege absent).
-- =============================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_biometrics
  FROM anon, authenticated;

ALTER TABLE public.user_biometrics
  ENABLE ROW LEVEL SECURITY;

COMMIT;
