-- =====================================================
-- Migration: Aspiration tables + Běžky v 85 seed data
-- Run this manually in Supabase SQL editor
-- =====================================================

-- Table: user_aspirations
-- Maps each user to their chosen aspiration (dream goal)
CREATE TABLE IF NOT EXISTS user_aspirations (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          text NOT NULL,
  aspiration_type  text NOT NULL,
  aspiration_label text NOT NULL,
  created_at       timestamptz DEFAULT now(),
  UNIQUE(user_id, aspiration_type)
);

-- Table: aspiration_requirements
-- Maps aspiration → node with required level and importance weight
CREATE TABLE IF NOT EXISTS aspiration_requirements (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  aspiration_type  text NOT NULL,
  aspiration_label text NOT NULL,
  node_id          text NOT NULL,
  required_level   numeric(3,2) NOT NULL CHECK (required_level BETWEEN 0 AND 1),
  importance_weight numeric(3,2) NOT NULL CHECK (importance_weight BETWEEN 0 AND 1),
  UNIQUE(aspiration_type, node_id)
);

-- Seed: Běžky v 85 requirements per node
-- required_level: 0–1 scale (same as user_metrics.current_index)
-- importance_weight: how much this node matters for this dream
INSERT INTO aspiration_requirements
  (aspiration_type, aspiration_label, node_id, required_level, importance_weight)
VALUES
  ('bezky_v_85', 'Běžky v 85', 'stabilita',   0.85, 0.90),
  ('bezky_v_85', 'Běžky v 85', 'sila',         0.75, 0.80),
  ('bezky_v_85', 'Běžky v 85', 'telo',         0.70, 0.75),
  ('bezky_v_85', 'Běžky v 85', 'kardio',       0.80, 0.85),
  ('bezky_v_85', 'Běžky v 85', 'vo2max',       0.75, 0.85),
  ('bezky_v_85', 'Běžky v 85', 'mysl',         0.70, 0.65),
  ('bezky_v_85', 'Běžky v 85', 'vyziva',       0.75, 0.70),
  ('bezky_v_85', 'Běžky v 85', 'zdravi',       0.70, 0.70),
  ('bezky_v_85', 'Běžky v 85', 'metabolicke',  0.65, 0.60)
ON CONFLICT DO NOTHING;

-- Optional: assign demo user to this aspiration for testing
-- INSERT INTO user_aspirations (user_id, aspiration_type, aspiration_label)
-- VALUES ('demo-user-123', 'bezky_v_85', 'Běžky v 85')
-- ON CONFLICT DO NOTHING;
