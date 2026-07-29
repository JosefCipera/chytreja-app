-- drug_inn_cache: self-learning cache for brand name → INN + RxNorm RXCUI
-- Populated automatically by api/rxnorm.js when a brand name is not in drugs.json
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS drug_inn_cache (
  name    TEXT PRIMARY KEY,              -- brand name lowercase (e.g. "betaloc")
  inn     TEXT NOT NULL,                 -- INN / active substance (e.g. "metoprolol")
  rxcui   TEXT,                          -- RxNorm RXCUI, cached after first lookup
  source  TEXT DEFAULT 'haiku',          -- 'haiku' | 'manual'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: only service_role can write, anon cannot read (health data)
ALTER TABLE drug_inn_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON drug_inn_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
