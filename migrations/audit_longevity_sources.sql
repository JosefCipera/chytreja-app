-- Audit longevity_sources — přehled co máme
SELECT
  node_id,
  type,
  COUNT(*) as pocet,
  array_agg(title ORDER BY title) as tituly
FROM longevity_sources
GROUP BY node_id, type
ORDER BY node_id, type;
