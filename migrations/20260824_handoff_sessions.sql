-- =====================================================
-- 20260824_handoff_sessions.sql
--
-- Nová tabulka pro tracking pre-login → auth handoff.
-- Účel: completed-detector (row present = session completed)
--       a audit záznam.
--
-- NENÍ health-domain data. Žádné facts_done ani claim mechanismus.
-- Přístup: pouze přes service_role (serverless API).
--
-- Bezpečné spustit opakovaně: CREATE TABLE IF NOT EXISTS.
-- Spustit manuálně v Supabase SQL Editoru.
-- =====================================================

CREATE TABLE IF NOT EXISTS handoff_sessions (
  session_id     UUID        PRIMARY KEY,
  user_id        TEXT        NOT NULL,
  -- row present = session completed; absent = not yet completed or crashed
  facts_applied  SMALLINT    NOT NULL DEFAULT 0,   -- počet factů odeslaných přes applyHealthEvent
  facts_deferred SMALLINT    NOT NULL DEFAULT 0,   -- počet factů uložených do pending_clarifications
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS handoff_sessions_user_created
  ON handoff_sessions (user_id, created_at DESC);

-- RLS: pouze service_role (API) smí číst a psát.
-- Přímý přístup z client-side (anon/authenticated) je zablokován.
-- Phase 2: přidat policy USING (user_id = auth.uid()::text) po konfiguraci
--          Firebase JWT v Supabase Auth → Third-party providers.
ALTER TABLE handoff_sessions ENABLE ROW LEVEL SECURITY;

-- Verify:
-- SELECT session_id, user_id, facts_applied, facts_deferred, created_at
-- FROM handoff_sessions ORDER BY created_at DESC LIMIT 5;
