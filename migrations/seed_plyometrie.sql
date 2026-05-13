-- seed_plyometrie.sql
-- Vloží počáteční user_metrics pro 'plyometrie' u všech uživatelů,
-- kteří mají longevity metriky ale plyometrie ještě nemají.
-- Proxy: stabilita score (stejný fyzický základ), fallback 50.

INSERT INTO user_metrics (user_id, node_id, universe, current_index, state)
SELECT
  base.user_id,
  'plyometrie',
  'longevity',
  COALESCE(
    (SELECT s.current_index FROM user_metrics s
     WHERE s.user_id = base.user_id
       AND s.node_id = 'stabilita'
       AND s.universe = 'longevity'
       AND s.current_index > 0
     LIMIT 1),
    50
  ),
  CASE
    WHEN COALESCE(
      (SELECT s.current_index FROM user_metrics s
       WHERE s.user_id = base.user_id
         AND s.node_id = 'stabilita'
         AND s.universe = 'longevity'
         AND s.current_index > 0
       LIMIT 1),
      50
    ) <= 40 THEN 'RED'
    WHEN COALESCE(
      (SELECT s.current_index FROM user_metrics s
       WHERE s.user_id = base.user_id
         AND s.node_id = 'stabilita'
         AND s.universe = 'longevity'
         AND s.current_index > 0
       LIMIT 1),
      50
    ) <= 70 THEN 'YELLOW'
    ELSE 'GREEN'
  END
FROM (
  SELECT DISTINCT user_id FROM user_metrics WHERE universe = 'longevity'
) base
WHERE NOT EXISTS (
  SELECT 1 FROM user_metrics x
  WHERE x.user_id = base.user_id
    AND x.node_id = 'plyometrie'
    AND x.universe = 'longevity'
);
