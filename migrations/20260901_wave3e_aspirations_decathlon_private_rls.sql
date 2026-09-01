-- =============================================================
-- Wave 3E: Aspirations / Decathlon private data RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-09-01
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 2 tables — aspiration + decathlon private user data.
--
--   user_aspirations —  2 rows — SELECT only callers (service_role)
--                                 1 view dependency: user_bottlenecks
--                                 (view ACL already locked: anon/auth REVOKE'd in Wave 3 Prelude)
--   user_decathlon   — 17 rows — SELECT + UPDATE/INSERT callers (service_role)
--                                 zero view dependencies
--
-- Pre-flight verified (2026-09-01):
--   - RLS OFF 2/2, FORCE RLS OFF 2/2
--   - ZERO policies on both tables
--   - Raw ACL: anon/authenticated have full arwdDxtm grants on both
--   - Zero FK on both tables
--   - Zero triggers on both tables
--   - Zero DB functions touching either table directly
--   - All active callers use service_role + Firebase requireAuth
--   - api/user.js main handler injects auth.uid into req.body/req.query.userId
--     before any sub-handler executes (lines 14-20) — client cannot inject userId
--   - PRIVATE browser-direct access = 0
--   - user_bottlenecks view: ACL = {postgres, service_role} only (Prelude REVOKE applied);
--     anon/auth already denied on view; service_role BYPASSRLS unaffected by user_aspirations lockdown
--
-- What this migration does:
--   For each of the 2 tables:
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
--   - user_bottlenecks view definition/ACL unchanged
--
-- ROLLBACK:
--   Emergency functional rollback (SECURITY-REGRESSIVE — reopens private data):
--     ALTER TABLE public.user_aspirations DISABLE ROW LEVEL SECURITY;
--     GRANT ALL PRIVILEGES ON TABLE public.user_aspirations TO anon, authenticated;
--     ALTER TABLE public.user_decathlon DISABLE ROW LEVEL SECURITY;
--     GRANT ALL PRIVILEGES ON TABLE public.user_decathlon TO anon, authenticated;
--
-- IDEMPOTENT: REVOKE is safe to re-run (WARNING only if privilege absent).
-- =============================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_aspirations
  FROM anon, authenticated;

ALTER TABLE public.user_aspirations
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_decathlon
  FROM anon, authenticated;

ALTER TABLE public.user_decathlon
  ENABLE ROW LEVEL SECURITY;

COMMIT;
