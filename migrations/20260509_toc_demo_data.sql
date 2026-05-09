-- TOC demo data — seeds metric values for all existing users
-- Kapacity: YELLOW (65), Materiál: GREEN (82), Termíny: RED (35)
-- Kvalita + Opravy: no row → GRAY on canvas

INSERT INTO user_metrics (user_id, node_id, current_index, state, universe)
SELECT u.user_id, v.node_id, v.idx,
  CASE WHEN v.idx <= 40 THEN 'RED' WHEN v.idx <= 70 THEN 'YELLOW' ELSE 'GREEN' END,
  'toc'
FROM (SELECT DISTINCT user_id FROM user_metrics) u
CROSS JOIN (VALUES
  ('kapacity_toc', 65),
  ('material_toc', 82),
  ('terminy_toc',  35),
  ('vyroba_toc',   35),   -- cascade: worst child = terminy (35 = RED)
  ('finance_toc',  72),
  ('toc',          35)    -- main node = worst child
) v(node_id, idx)
ON CONFLICT (user_id, node_id) DO UPDATE
  SET current_index = EXCLUDED.current_index,
      state         = EXCLUDED.state,
      universe      = EXCLUDED.universe;
