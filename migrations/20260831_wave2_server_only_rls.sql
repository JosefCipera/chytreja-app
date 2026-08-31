-- =============================================================
-- Wave 2: Server-Only / Deprecated Tables — RLS + Grant Lockdown
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-08-31
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 7 tables with no legitimate anon/authenticated access path.
--
-- GROUP A — newly locked (5 tables):
--   toc_zakazky, toc_pracoviste, toc_parametry  — server-only (api/toc.js, service_role)
--   knowledge_nodes, nodes                       — deprecated legacy, no active callers
--
--   Per table:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated  (incl. SELECT)
--     2. ENABLE ROW LEVEL SECURITY
--     3. Zero policies — no anon/authenticated SELECT or any other policy created
--
-- GROUP B — already RLS-protected, grant cleanup only (2 tables):
--   drug_inn_cache   — RLS ON + service_role_all policy (unchanged)
--   toc_hlavni_plan  — RLS ON + zero public policies (unchanged)
--
--   Per table:
--     1. REVOKE ALL PRIVILEGES from anon, authenticated  (incl. SELECT)
--     (RLS state and existing policies are NOT touched)
--
-- Target state anon + authenticated (all 7 tables):
--   SELECT NO  INSERT NO  UPDATE NO  DELETE NO
--   TRUNCATE NO  REFERENCES NO  TRIGGER NO
--
-- What this migration does NOT touch:
--   - service_role grants and privileges
--   - drug_inn_cache service_role_all policy
--   - Wave 1 public-content tables
--   - private user tables (Wave 3)
--   - functions, views, sequences, RPC
--   - data in any table
--
-- IDEMPOTENT: REVOKE is safe to re-run (no error if privilege absent).
--   ENABLE RLS on an already-enabled table is a no-op.
-- =============================================================

BEGIN;

-- =============================================================
-- GROUP A: Newly locked — REVOKE ALL + ENABLE RLS (no policies)
-- =============================================================

-- -------------------------------------------------------------
-- 1. toc_zakazky  (server-only: api/toc.js via service_role)
-- -------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.toc_zakazky FROM anon, authenticated;
ALTER TABLE public.toc_zakazky ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 2. toc_pracoviste  (server-only: api/toc.js via service_role)
-- -------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.toc_pracoviste FROM anon, authenticated;
ALTER TABLE public.toc_pracoviste ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 3. toc_parametry  (server-only: api/toc.js via service_role)
-- -------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.toc_parametry FROM anon, authenticated;
ALTER TABLE public.toc_parametry ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 4. knowledge_nodes  (deprecated legacy — no active callers)
-- -------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.knowledge_nodes FROM anon, authenticated;
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 5. nodes  (deprecated legacy — no active callers)
-- -------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.nodes FROM anon, authenticated;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- GROUP B: Already RLS-protected — grant cleanup only
--          (RLS state and existing policies are NOT changed)
-- =============================================================

-- -------------------------------------------------------------
-- 6. drug_inn_cache  (RLS ON + service_role_all policy — preserved)
-- -------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.drug_inn_cache FROM anon, authenticated;

-- -------------------------------------------------------------
-- 7. toc_hlavni_plan  (RLS ON + zero public policies — preserved)
-- -------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE public.toc_hlavni_plan FROM anon, authenticated;

-- =============================================================
-- POST-MIGRATION VERIFICATION QUERIES (run after applying)
-- =============================================================
--
-- A) Grants — must return zero rows for anon/authenticated on all 7 tables:
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'toc_zakazky','toc_pracoviste','toc_parametry',
--     'knowledge_nodes','nodes','drug_inn_cache','toc_hlavni_plan'
--   )
--   AND grantee IN ('anon','authenticated')
-- ORDER BY table_name, grantee, privilege_type;
-- → Expect: 0 rows
--
-- B) RLS status — 5 new tables must be true; drug_inn_cache and toc_hlavni_plan already true:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'toc_zakazky','toc_pracoviste','toc_parametry',
--     'knowledge_nodes','nodes','drug_inn_cache','toc_hlavni_plan'
--   )
-- ORDER BY tablename;
-- → Expect: all 7 rowsecurity = true
--
-- C) Policies — drug_inn_cache must still have service_role_all; all others unchanged:
--
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'toc_zakazky','toc_pracoviste','toc_parametry',
--     'knowledge_nodes','nodes','drug_inn_cache','toc_hlavni_plan'
--   )
-- ORDER BY tablename;
-- → Expect: only 'service_role_all' on drug_inn_cache; zero rows for all others
--
-- D) service_role reads — all 7 must still return data:
--
-- SELECT 'drug_inn_cache'  AS tbl, COUNT(*) FROM drug_inn_cache  UNION ALL
-- SELECT 'toc_zakazky',    COUNT(*) FROM toc_zakazky             UNION ALL
-- SELECT 'toc_pracoviste', COUNT(*) FROM toc_pracoviste          UNION ALL
-- SELECT 'toc_parametry',  COUNT(*) FROM toc_parametry           UNION ALL
-- SELECT 'toc_hlavni_plan',COUNT(*) FROM toc_hlavni_plan         UNION ALL
-- SELECT 'knowledge_nodes',COUNT(*) FROM knowledge_nodes         UNION ALL
-- SELECT 'nodes',          COUNT(*) FROM nodes;
-- → Expect: same counts as pre-migration (service_role bypasses RLS)
-- =============================================================

COMMIT;
