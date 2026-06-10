-- Přidá server-side CRT cache do user_health_profile
-- Všechna zařízení sdílí jeden strom (ne per-device localStorage)
ALTER TABLE user_health_profile
  ADD COLUMN IF NOT EXISTS crt_cache    jsonb,
  ADD COLUMN IF NOT EXISTS crt_cache_at timestamptz;
