-- =====================================================
-- Migration: TOC Universe nodes
-- 1. Add `universe` column to longevity_nodes
-- 2. Insert 6 TOC nodes (Hra o průtok + 5 sub-nodes)
-- Run manually in Supabase SQL editor
-- =====================================================

-- 1. Add universe column (default: 'longevity' so existing rows stay untouched)
ALTER TABLE longevity_nodes
  ADD COLUMN IF NOT EXISTS universe text NOT NULL DEFAULT 'longevity';

-- 2. Make sure existing longevity rows are tagged correctly
UPDATE longevity_nodes SET universe = 'longevity' WHERE universe IS NULL OR universe = '';

-- 3. Insert TOC nodes
-- Main node: "Hra o průtok" (renamed from "Teorie omezení (TOC)")
INSERT INTO longevity_nodes (id, label, parent, universe, default_priority)
VALUES
  ('toc',           'Hra o průtok',    NULL,  'toc', 1),
  ('finance_toc',   'Finance (TA)',     'toc', 'toc', 2),
  ('vyroba_toc',    'Výroba (DBR)',     'toc', 'toc', 2),
  ('ccpm',          'Projekty (CCPM)', 'toc', 'toc', 3),
  ('strategie_toc', 'Strategie (SFS)', 'toc', 'toc', 4),
  ('marketing_toc', 'Marketing (MA)',  'toc', 'toc', 5)
ON CONFLICT (id) DO UPDATE SET
  label    = EXCLUDED.label,
  parent   = EXCLUDED.parent,
  universe = EXCLUDED.universe;

-- 4. Verify
SELECT id, label, parent, universe, default_priority
FROM longevity_nodes
WHERE universe = 'toc'
ORDER BY default_priority;
