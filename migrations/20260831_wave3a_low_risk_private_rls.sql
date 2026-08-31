-- =============================================================
-- Wave 3A: Low-risk private data RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-08-31
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 3 tables — low-risk private user data with zero active runtime callers.
--
--   user_supplements   — 6 rows, no active callers in HEAD
--   user_fitness_tests — 8 rows, no active callers in HEAD
--   user_integrations  — 4 rows, no active callers in HEAD
--
-- Pre-flight verified (2026-08-31):
--   - RLS OFF, zero policies, zero dormant policies on all 3
--   - Raw ACL: anon/authenticated have full arwdDxtm grants
--   - Zero FK, zero triggers, zero DB function/view dependencies on all 3
--   - Zero active callers in api/, app/, scripts/ (fresh HEAD scan)
--   - PRIVATE browser-direct access = 0
--   - HTTP smoke test = NOT APPLICABLE (no active callers)
--   - user_id column type: text on all 3 (live DB)
--
-- What this migration does:
--   For each of the 3 tables:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated
--     2. ENABLE ROW LEVEL SECURITY
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
--   ALTER TABLE public.user_supplements DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_supplements TO anon, authenticated;
--   ALTER TABLE public.user_fitness_tests DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_fitness_tests TO anon, authenticated;
--   ALTER TABLE public.user_integrations DISABLE ROW LEVEL SECURITY;
--   GRANT ALL PRIVILEGES ON TABLE public.user_integrations TO anon, authenticated;
--
-- IDEMPOTENT: REVOKE is safe to re-run (WARNING only if privilege absent).
-- =============================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_supplements
  FROM anon, authenticated;

ALTER TABLE public.user_supplements
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_fitness_tests
  FROM anon, authenticated;

ALTER TABLE public.user_fitness_tests
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_integrations
  FROM anon, authenticated;

ALTER TABLE public.user_integrations
  ENABLE ROW LEVEL SECURITY;

COMMIT;
