-- migration: add AI instruction columns to longevity_media
-- Run in Supabase SQL Editor (or via psql)

ALTER TABLE longevity_media
  ADD COLUMN IF NOT EXISTS script_cz    TEXT,
  ADD COLUMN IF NOT EXISTS instrukce_ai JSONB;

COMMENT ON COLUMN longevity_media.script_cz IS
  'Koučovací instrukce k cviku v češtině (zobrazí se jako CZ overlay na videu)';

COMMENT ON COLUMN longevity_media.instrukce_ai IS
  'Parametry pro AI detekci pohybu: target, motion, keypoints, min/max angle, feedback texty';
