-- Přidá symptomy a rodinnou anamnézu do user_health_profile
-- Bezpečné: pouze nové sloupce s defaultem, žádný breaking change

ALTER TABLE user_health_profile
  ADD COLUMN IF NOT EXISTS symptoms       text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS family_history text    DEFAULT '';
