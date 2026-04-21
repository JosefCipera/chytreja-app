-- Migration: Health Document Parser
-- Spust v Supabase SQL Editor
-- node_inputs je nova prazdna tabulka, DROP je bezpecny

DROP TABLE IF EXISTS node_inputs;

CREATE TABLE node_inputs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    text NOT NULL,
  node_id    text NOT NULL,
  input_type text NOT NULL DEFAULT 'health_doc',
  source     text,
  doc_date   date NOT NULL DEFAULT current_date,
  data       jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX node_inputs_user_date
  ON node_inputs (user_id, doc_date DESC);

ALTER TABLE user_metrics
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
