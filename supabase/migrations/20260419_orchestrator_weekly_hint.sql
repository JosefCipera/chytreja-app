-- =====================================================
-- Add missing weekly_hint column to orchestrator_log
-- Update pillar_weights in user_decathlon to use new discipline IDs
-- Date: 2026-04-19
-- =====================================================

BEGIN;

-- 1. Add weekly_hint to orchestrator_log
ALTER TABLE orchestrator_log
  ADD COLUMN IF NOT EXISTS weekly_hint text;

COMMENT ON COLUMN orchestrator_log.weekly_hint IS
  'Volitelný hint co přijde zítra nebo tento týden — zobrazí se pod MISSION_COMPLETE.';

-- 2. Update user_decathlon pillar_weights to use new discipline IDs
--    Old keys: zone2, sila, vo2max, stabilita
--    New keys: kardio, sila, stabilita (matches DISCIPLINE_PROTOCOLS in hud-data.js)
UPDATE user_decathlon
SET pillar_weights = (
  SELECT jsonb_object_agg(
    CASE key
      WHEN 'zone2'   THEN 'kardio'
      WHEN 'vo2max'  THEN 'kardio'
      ELSE key
    END,
    value
  )
  FROM jsonb_each(pillar_weights)
)
WHERE pillar_weights ?| ARRAY['zone2', 'vo2max'];

COMMIT;
