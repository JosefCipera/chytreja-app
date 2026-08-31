-- =============================================================
-- Wave 1: Public Content RLS
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-08-31
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 12 public content tables (catalog / longevity knowledge base).
--   These tables contain NO user-private data and are intentionally
--   readable by browser clients via the publishable anon key.
--
-- What this migration does (per table, idempotent):
--   1. REVOKE INSERT / UPDATE / DELETE / TRUNCATE / TRIGGER / REFERENCES
--        from anon, authenticated  (excess DML retained from Supabase defaults)
--   2. GRANT SELECT to anon, authenticated  (explicit, survives future REVOKE ALL)
--   3. ENABLE ROW LEVEL SECURITY
--   4. DROP POLICY IF EXISTS then CREATE read-only SELECT policy USING (true)
--
-- What this migration does NOT touch:
--   - private user tables (user_*, daily_checkin, node_state_history, ...)
--   - longevity_sources  (already correctly protected — RLS ON + public SELECT policy)
--   - knowledge_nodes, nodes  (deprecated legacy — handled in Wave 2)
--   - functions / RPC
--   - views
--   - sequences
--   - service_role grants  (service_role bypasses RLS; unaffected)
--
-- SUPERSEDES: migrations/20260429_enable_rls.sql  → DO NOT RUN that file.
--
-- HOW TO RUN: paste entire file into Supabase SQL Editor → Run.
--   Safe to run multiple times (idempotent).
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- 1. longevity_nodes
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.longevity_nodes FROM anon, authenticated;
GRANT SELECT ON public.longevity_nodes TO anon, authenticated;
ALTER TABLE public.longevity_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_longevity_nodes" ON public.longevity_nodes;
CREATE POLICY "public_read_longevity_nodes"
  ON public.longevity_nodes FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 2. longevity_articles
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.longevity_articles FROM anon, authenticated;
GRANT SELECT ON public.longevity_articles TO anon, authenticated;
ALTER TABLE public.longevity_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_longevity_articles" ON public.longevity_articles;
CREATE POLICY "public_read_longevity_articles"
  ON public.longevity_articles FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 3. longevity_media
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.longevity_media FROM anon, authenticated;
GRANT SELECT ON public.longevity_media TO anon, authenticated;
ALTER TABLE public.longevity_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_longevity_media" ON public.longevity_media;
CREATE POLICY "public_read_longevity_media"
  ON public.longevity_media FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 4. longevity_actions
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.longevity_actions FROM anon, authenticated;
GRANT SELECT ON public.longevity_actions TO anon, authenticated;
ALTER TABLE public.longevity_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_longevity_actions" ON public.longevity_actions;
CREATE POLICY "public_read_longevity_actions"
  ON public.longevity_actions FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 5. universe_nodes
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.universe_nodes FROM anon, authenticated;
GRANT SELECT ON public.universe_nodes TO anon, authenticated;
ALTER TABLE public.universe_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_universe_nodes" ON public.universe_nodes;
CREATE POLICY "public_read_universe_nodes"
  ON public.universe_nodes FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 6. aspiration_requirements
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.aspiration_requirements FROM anon, authenticated;
GRANT SELECT ON public.aspiration_requirements TO anon, authenticated;
ALTER TABLE public.aspiration_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_aspiration_requirements" ON public.aspiration_requirements;
CREATE POLICY "public_read_aspiration_requirements"
  ON public.aspiration_requirements FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 7. node_riders
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.node_riders FROM anon, authenticated;
GRANT SELECT ON public.node_riders TO anon, authenticated;
ALTER TABLE public.node_riders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_node_riders" ON public.node_riders;
CREATE POLICY "public_read_node_riders"
  ON public.node_riders FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 8. node_articles
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.node_articles FROM anon, authenticated;
GRANT SELECT ON public.node_articles TO anon, authenticated;
ALTER TABLE public.node_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_node_articles" ON public.node_articles;
CREATE POLICY "public_read_node_articles"
  ON public.node_articles FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 9. node_media
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.node_media FROM anon, authenticated;
GRANT SELECT ON public.node_media TO anon, authenticated;
ALTER TABLE public.node_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_node_media" ON public.node_media;
CREATE POLICY "public_read_node_media"
  ON public.node_media FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 10. node_docs
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.node_docs FROM anon, authenticated;
GRANT SELECT ON public.node_docs TO anon, authenticated;
ALTER TABLE public.node_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_node_docs" ON public.node_docs;
CREATE POLICY "public_read_node_docs"
  ON public.node_docs FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 11. onboarding_questions
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.onboarding_questions FROM anon, authenticated;
GRANT SELECT ON public.onboarding_questions TO anon, authenticated;
ALTER TABLE public.onboarding_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_onboarding_questions" ON public.onboarding_questions;
CREATE POLICY "public_read_onboarding_questions"
  ON public.onboarding_questions FOR SELECT
  TO anon, authenticated
  USING (true);

-- -------------------------------------------------------------
-- 12. universes
-- -------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.universes FROM anon, authenticated;
GRANT SELECT ON public.universes TO anon, authenticated;
ALTER TABLE public.universes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_universes" ON public.universes;
CREATE POLICY "public_read_universes"
  ON public.universes FOR SELECT
  TO anon, authenticated
  USING (true);

-- =============================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- Run these immediately after applying the migration.
-- All 12 tables should appear in the results with:
--   rowsecurity = true
--   exactly one policy named "public_read_<table>"
-- =============================================================
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'longevity_nodes','longevity_articles','longevity_media','longevity_actions',
--     'universe_nodes','aspiration_requirements','node_riders',
--     'node_articles','node_media','node_docs','onboarding_questions','universes'
--   )
-- ORDER BY tablename;
--
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'longevity_nodes','longevity_articles','longevity_media','longevity_actions',
--     'universe_nodes','aspiration_requirements','node_riders',
--     'node_articles','node_media','node_docs','onboarding_questions','universes'
--   )
-- ORDER BY tablename;
-- =============================================================

COMMIT;
