-- =====================================================
-- 20260429_enable_rls.sql
-- Enable Row Level Security on all tables
--
-- Phase 1 (this file):
--   • Block ALL writes from anon role
--   • Allow reads (filtered by user_id in app code)
--   • Service role key (API) bypasses RLS automatically
--
-- Phase 2 (later — requires Firebase JWT in Supabase):
--   • Replace USING (true) with USING (user_id = auth.uid())
--   • Configure: Supabase → Auth → Third-party providers → Firebase
-- =====================================================

-- ─── USER DATA TABLES ────────────────────────────────────────────────────────
-- Writes go through API (service_role bypasses RLS)
-- Reads open for now — Phase 2 will add per-user filtering

ALTER TABLE public.user_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_state_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_constraints     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestrator_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_inputs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_aspirations     ENABLE ROW LEVEL SECURITY;

-- SELECT only — no INSERT/UPDATE/DELETE for anon
CREATE POLICY "phase1_read_user_metrics"
  ON public.user_metrics FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_node_state_history"
  ON public.node_state_history FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_user_constraints"
  ON public.user_constraints FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_user_profiles"
  ON public.user_profiles FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_mission_log"
  ON public.mission_log FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_agent_log"
  ON public.agent_log FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_orchestrator_log"
  ON public.orchestrator_log FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_node_inputs"
  ON public.node_inputs FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "phase1_read_user_aspirations"
  ON public.user_aspirations FOR SELECT TO anon, authenticated USING (true);


-- ─── PUBLIC REFERENCE TABLES ─────────────────────────────────────────────────
-- Truly public — anyone can read, nobody can write via anon

ALTER TABLE public.longevity_nodes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.longevity_actions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.longevity_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.longevity_articles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.longevity_media          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.longevity_docs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_nodes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspiration_requirements  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_longevity_nodes"
  ON public.longevity_nodes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_longevity_actions"
  ON public.longevity_actions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_longevity_sources"
  ON public.longevity_sources FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_longevity_articles"
  ON public.longevity_articles FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_longevity_media"
  ON public.longevity_media FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_longevity_docs"
  ON public.longevity_docs FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_universe_nodes"
  ON public.universe_nodes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_aspiration_requirements"
  ON public.aspiration_requirements FOR SELECT TO anon, authenticated USING (true);


-- ─── PHASE 2 TEMPLATE (run after Firebase JWT configured in Supabase) ─────────
-- DROP POLICY "phase1_read_user_metrics" ON public.user_metrics;
-- CREATE POLICY "user_metrics_own" ON public.user_metrics
--   FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- (repeat for all user data tables)
