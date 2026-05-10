-- TOC demo data — seeds metric values for all existing users
-- Bezpečné: DELETE + INSERT, lze spustit opakovaně
--
-- Výroba (DBR):  RED  — termíny 35, kapacity 65 YELLOW, materiál 82 GREEN
-- Finance (TA):  YELLOW — průtok 68, zásoby 55, náklady 72 GREEN, cashflow 45
-- Projekty:      YELLOW — 60
-- Strategie:     GREEN  — 75
-- Marketing:     YELLOW — 58
-- Kvalita/Opravy: GRAY (no row) — záměrně bez dat

-- 1. Vymaž staré TOC záznamy pro všechny uživatele
DELETE FROM user_metrics WHERE universe = 'toc';

-- 2. Vlož čerstvá data
INSERT INTO user_metrics (user_id, node_id, current_index, state, universe)
SELECT u.user_id, v.node_id, v.idx,
  CASE WHEN v.idx <= 40 THEN 'RED' WHEN v.idx <= 70 THEN 'YELLOW' ELSE 'GREEN' END,
  'toc'
FROM (SELECT DISTINCT user_id FROM user_metrics) u
CROSS JOIN (VALUES
  -- ── Výroba a sub-uzly ──────────────────────────────
  ('kapacity_toc',  65),   -- YELLOW: přetížené, ale zvládáme
  ('material_toc',  82),   -- GREEN:  zásobování funguje
  ('terminy_toc',   35),   -- RED:    termíny hoří
  ('vyroba_toc',    35),   -- RED cascade: nejhorší dítě = termíny
  -- kvalita_toc — GRAY (bez dat)
  -- opravy_toc  — GRAY (bez dat)

  -- ── Finance a sub-uzly ─────────────────────────────
  ('prutok_toc',    68),   -- YELLOW: marže klesá
  ('zasoby_toc',    55),   -- YELLOW: WIP nad normou
  ('naklady_toc',   72),   -- GREEN:  náklady pod kontrolou
  ('cashflow_toc',  45),   -- YELLOW: platby se zpožďují
  ('finance_toc',   45),   -- YELLOW cascade: nejhorší dítě = cashflow

  -- ── Ostatní hlavní uzly ────────────────────────────
  ('ccpm',          60),   -- YELLOW: projekty se zpožďují
  ('strategie_toc', 75),   -- GREEN:  strategie nastavena
  ('marketing_toc', 58),   -- YELLOW: pipeline slabá

  -- ── Hlavní uzel — worst child ─────────────────────
  ('toc',           35)    -- RED: nejhorší = výroba (termíny 35)
) v(node_id, idx);
