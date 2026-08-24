-- =====================================================
-- 20260824_pending_clarifications.sql
--
-- Přidá sloupec pending_clarifications do user_health_profile.
--
-- Účel: queue pro non-idempotentní nebo nepodporované handoff typy
--       (NEW_SYMPTOM, GENERAL_HEALTH_REQUEST, medication mention).
--       Každý záznam obsahuje session_id, raw_text, provenance a reason.
--       NENÍ health event — applyHealthEvent se na tyto záznamy NEVOLÁ.
--
-- Čtení: orchestrátor v P1 pro generování ASK o nevyřízené informaci.
--
-- Additive: IF NOT EXISTS + DEFAULT → bezpečné na existující data.
-- Bezpečné spustit opakovaně.
-- Spustit manuálně v Supabase SQL Editoru.
-- =====================================================

-- Ověření před spuštěním (volitelné, read-only):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_health_profile'
--   AND column_name = 'pending_clarifications';

ALTER TABLE user_health_profile
  ADD COLUMN IF NOT EXISTS pending_clarifications JSONB DEFAULT '[]';

-- Struktura každého záznamu v poli:
-- {
--   "session_id":    "uuid-A",
--   "type":          "new_symptom" | "general_health_request" | "medication_mention",
--   "event_type":    "NEW_SYMPTOM",
--   "raw_text":      "verbatim user utterance",
--   "provenance":    { "utterance_index": 2 },
--   "reason":        "non_idempotent_handoff" | "unsupported_structured_persistence",
--   "timestamp":     "2026-08-24T10:31:00Z"
-- }

-- Verify:
-- SELECT user_id, pending_clarifications
-- FROM user_health_profile
-- WHERE pending_clarifications != '[]'::jsonb
-- LIMIT 5;
