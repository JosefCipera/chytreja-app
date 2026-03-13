-- =====================================================
-- Migration: user_fitness_tests + user_biometrics
-- Run manually in Supabase SQL editor
-- =====================================================

-- Záznamy aktivit z hlasového vstupu ("cvičil jsem 55 vteřin dýchání")
CREATE TABLE IF NOT EXISTS user_fitness_tests (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text        NOT NULL,
  test_type   text        NOT NULL,  -- swimming|running|cycling|strength|walking|yoga|breathing|other
  value       numeric,
  unit        text,                  -- s|min|m|km|reps|sets|steps
  node_id     text REFERENCES longevity_nodes(id) ON DELETE SET NULL,
  source      text DEFAULT 'voice',  -- voice|manual
  notes       text,                  -- původní text uživatele
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fitness_user ON user_fitness_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_node ON user_fitness_tests(node_id);

-- Biometrická data z hlasového vstupu ("vážím 82 kg", "mám pas 95")
CREATE TABLE IF NOT EXISTS user_biometrics (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text        NOT NULL,
  weight_kg   numeric,
  waist_cm    numeric,
  body_fat_pct numeric,
  source      text DEFAULT 'voice',
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biometrics_user ON user_biometrics(user_id);
