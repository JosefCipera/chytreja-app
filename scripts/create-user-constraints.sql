-- =====================================================
-- user_constraints table
-- Run this in Supabase SQL editor
-- =====================================================

CREATE TABLE IF NOT EXISTS user_constraints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  constraint_type text NOT NULL,   -- 'injury' | 'body' | 'demographic'
  constraint_key text NOT NULL,    -- 'knee' | 'back' | 'shoulder' | 'hip' | 'age' | 'sex' | 'waist'
  constraint_value text NOT NULL,
  severity text,                   -- 'mild' | 'moderate' | 'severe' | null
  affects_nodes text[],
  created_at timestamptz DEFAULT now()
);

-- Unique constraint per user+key (upsert support)
ALTER TABLE user_constraints
  DROP CONSTRAINT IF EXISTS user_constraints_user_key_unique;
ALTER TABLE user_constraints
  ADD CONSTRAINT user_constraints_user_key_unique UNIQUE (user_id, constraint_key);

-- RLS: user sees only their own data
ALTER TABLE user_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_constraints_self" ON user_constraints;
CREATE POLICY "user_constraints_self"
  ON user_constraints FOR ALL
  USING (auth.uid()::text = user_id OR user_id IS NOT NULL);
