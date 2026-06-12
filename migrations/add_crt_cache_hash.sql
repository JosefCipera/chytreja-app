-- Přidá crt_cache_hash do user_health_profile
-- Hash vstupních dat (diagnózy + labs + metrics) — cache platná dokud se hash nemění
-- Bezpečné: přidává pouze nový sloupec s defaultem NULL

ALTER TABLE user_health_profile
  ADD COLUMN IF NOT EXISTS crt_cache_hash text;
