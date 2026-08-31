-- =============================================================
-- Wave 3 Prelude: Emergency revoke on private views
-- Project : CHJ / pionxzqtxcughvfbgadi
-- Created : 2026-08-31
-- Author  : Josef Čipera
-- =============================================================
--
-- Scope: 2 views that expose underlying private user data to anon.
--
--   user_bottlenecks     — joins user_aspirations × user_metrics
--   v_vitality_dashboard — joins user_metrics × user_node_weights
--
-- Empirically verified (2026-08-31):
--   anon SELECT on v_vitality_dashboard → 126 rows (all user_metrics)
--   anon SELECT on user_bottlenecks     → 0 rows (data-dependent, not blocked)
--
-- Root cause:
--   Views are SECURITY INVOKER (default). Grant-level check on underlying
--   tables uses view owner (postgres) privileges → anon SELECT on view bypasses
--   table-level grant REVOKE. Only RLS on underlying tables would block view
--   access at policy layer. Emergency fix: REVOKE view grants now.
--
-- What this migration does:
--   REVOKE ALL PRIVILEGES on both views from anon, authenticated.
--
-- What this migration does NOT touch:
--   - View definitions (no ALTER VIEW, no DROP VIEW)
--   - security_invoker setting (unchanged)
--   - Underlying private tables (user_metrics, user_node_weights, user_aspirations)
--   - RLS on any table
--   - Policies on any table
--   - Functions / RPC
--   - Wave 1 / Wave 2 tables
--   - service_role grants (preserved — postgres=arwdDxtm remains)
--
-- ROLLBACK:
--   GRANT ALL PRIVILEGES ON TABLE public.user_bottlenecks TO anon, authenticated;
--   GRANT ALL PRIVILEGES ON TABLE public.v_vitality_dashboard TO anon, authenticated;
--
-- NOTE: PostgreSQL treats views as table-class objects — ON TABLE syntax is correct.
-- IDEMPOTENT: REVOKE is safe to re-run (WARNING only if privilege absent).
-- =============================================================

BEGIN;

REVOKE ALL PRIVILEGES
  ON TABLE public.user_bottlenecks
  FROM anon, authenticated;

REVOKE ALL PRIVILEGES
  ON TABLE public.v_vitality_dashboard
  FROM anon, authenticated;

COMMIT;
