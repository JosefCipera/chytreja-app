-- seed_rovnovaha_dychani.sql
-- Doplní počáteční index pro rovnovaha a dychani u uživatelů,
-- kteří prošli onboardingem před přidáním těchto otázek (index=0).
-- rovnovaha ← proxy ze stabilita, dychani ← proxy z vo2max.
-- Bezpečné: dotýká se jen řádků s current_index = 0.

-- 1. rovnovaha ← stabilita score (nebo 50 jako fallback)
UPDATE user_metrics r
SET
  current_index = COALESCE(
    (SELECT s.current_index FROM user_metrics s
     WHERE s.user_id = r.user_id
       AND s.node_id = 'stabilita'
       AND s.universe = 'longevity'
       AND s.current_index > 0
     LIMIT 1),
    50
  ),
  state = CASE
    WHEN COALESCE(
      (SELECT s.current_index FROM user_metrics s
       WHERE s.user_id = r.user_id
         AND s.node_id = 'stabilita'
         AND s.universe = 'longevity'
         AND s.current_index > 0
       LIMIT 1),
      50
    ) <= 40 THEN 'RED'
    WHEN COALESCE(
      (SELECT s.current_index FROM user_metrics s
       WHERE s.user_id = r.user_id
         AND s.node_id = 'stabilita'
         AND s.universe = 'longevity'
         AND s.current_index > 0
       LIMIT 1),
      50
    ) <= 70 THEN 'YELLOW'
    ELSE 'GREEN'
  END
WHERE r.node_id = 'rovnovaha'
  AND r.universe = 'longevity'
  AND r.current_index = 0;

-- 2. dychani ← vo2max score (nebo 50 jako fallback)
UPDATE user_metrics r
SET
  current_index = COALESCE(
    (SELECT s.current_index FROM user_metrics s
     WHERE s.user_id = r.user_id
       AND s.node_id = 'vo2max'
       AND s.universe = 'longevity'
       AND s.current_index > 0
     LIMIT 1),
    50
  ),
  state = CASE
    WHEN COALESCE(
      (SELECT s.current_index FROM user_metrics s
       WHERE s.user_id = r.user_id
         AND s.node_id = 'vo2max'
         AND s.universe = 'longevity'
         AND s.current_index > 0
       LIMIT 1),
      50
    ) <= 40 THEN 'RED'
    WHEN COALESCE(
      (SELECT s.current_index FROM user_metrics s
       WHERE s.user_id = r.user_id
         AND s.node_id = 'vo2max'
         AND s.universe = 'longevity'
         AND s.current_index > 0
       LIMIT 1),
      50
    ) <= 70 THEN 'YELLOW'
    ELSE 'GREEN'
  END
WHERE r.node_id = 'dychani'
  AND r.universe = 'longevity'
  AND r.current_index = 0;
