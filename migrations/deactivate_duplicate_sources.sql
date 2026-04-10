-- deactivate_duplicate_sources.sql
-- Targeted deactivation based on diagnostic SELECT output.
-- For each duplicate group: keep the NEWEST row (highest created_at),
-- deactivate the rest.
--
-- metabolicke / rovnovaha: different titles → keep the row that received
--   markdown script_cz (newer Decathlon insert: ee47c97e, c03b63bb)
-- sila groups: identical titles → keep newest of the three
--
-- Run in Supabase SQL Editor

UPDATE longevity_sources
SET active = false
WHERE id::text LIKE ANY (ARRAY[
  -- metabolicke: metabolicky-syndrom (keep ee47c97e)
  '8ee1ae2a%',

  -- rovnovaha: propriocepce (keep c03b63bb)
  '5a78baf7%',

  -- sila: hustota-kosti (keep dde2d2d8)
  '8a9afea6%',
  'c8fde822%',

  -- sila: mekky-dopad (keep 69a2690b)
  '32f50ab9%',
  '296dc5ec%',

  -- sila: mobilita-ramen (keep 7acc5ab3)
  '796cb2d9%',
  'e7d9782c%',

  -- sila: rotatorova-manzeta (keep 37bbe7e0)
  '849d0fcc%',
  '962ff4d5%',

  -- sila: skoc-dopadni (keep 15d4c4eb)
  '11a42b7f%',
  '0a9131a6%',

  -- sila: zvedni-kufr (keep 57a240de)
  '0146ef72%',
  'fbe246f9%'
]);

-- VERIFY: should return 0 rows for the fixed groups
-- SELECT node_id, url, COUNT(*) as cnt
-- FROM longevity_sources
-- WHERE active = true
--   AND url LIKE '/app/content/longevity/%'
-- GROUP BY node_id, url
-- HAVING COUNT(*) > 1;
