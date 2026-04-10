-- fix_duplicate_sources.sql
-- Deactivate duplicate articles in longevity_sources
-- Duplicates arose when:
--   1. Original longevity_articles had /content/longevity/... URLs
--   2. Decathlon inserts created same-title rows with url='#'
--   3. Both got fixed to the same /app/content/longevity/... path
-- Strategy: where same URL appears twice in same node, keep the NEWER row
-- Run in Supabase SQL Editor

-- ── DIAGNOSTIC: see what duplicates exist ─────────────────────
-- Run this first to verify before applying the fix:

-- SELECT
--   node_id,
--   url,
--   COUNT(*) as duplicates,
--   array_agg(LEFT(id::text, 8) ORDER BY created_at) as ids,
--   array_agg(title ORDER BY created_at) as titles
-- FROM longevity_sources
-- WHERE active = true
--   AND url LIKE '/app/content/longevity/%'
-- GROUP BY node_id, url
-- HAVING COUNT(*) > 1
-- ORDER BY node_id, url;


-- ── FIX: deactivate older duplicate (same url + node_id, keep newer) ──

UPDATE longevity_sources
SET active = false
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY node_id, url
        ORDER BY created_at ASC   -- oldest first → will be deactivated
      ) AS rn
    FROM longevity_sources
    WHERE active = true
      AND url LIKE '/app/content/longevity/%'
  ) ranked
  WHERE rn > 1
);


-- ── ALSO: deactivate same-title duplicates with different URLs ─
-- (e.g. if title exists twice but one has PubMed URL still)

UPDATE longevity_sources
SET active = false
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY node_id, LOWER(title)
        ORDER BY created_at ASC
      ) AS rn
    FROM longevity_sources
    WHERE active = true
  ) ranked
  WHERE rn > 1
);


-- ── VERIFY after fix ──────────────────────────────────────────

-- SELECT node_id, COUNT(*) as active_sources
-- FROM longevity_sources
-- WHERE active = true
-- GROUP BY node_id
-- ORDER BY node_id;
