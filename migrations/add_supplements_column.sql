-- Přidá sloupec supplements do user_health_profile
-- Bezpečné: additivní změna, existující řádky dostanou prázdné pole
ALTER TABLE user_health_profile
  ADD COLUMN IF NOT EXISTS supplements jsonb NOT NULL DEFAULT '[]';
