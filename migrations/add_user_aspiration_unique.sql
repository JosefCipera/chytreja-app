-- Enforce 1 aspiration per user
-- If user already has multiple rows, keep the most recently inserted one

-- Remove duplicates first (keep latest row per user)
DELETE FROM user_aspirations
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM user_aspirations
  ORDER BY user_id, id DESC
);

-- Add unique constraint
ALTER TABLE user_aspirations
  DROP CONSTRAINT IF EXISTS user_aspirations_user_id_key;

ALTER TABLE user_aspirations
  ADD CONSTRAINT user_aspirations_user_id_key UNIQUE (user_id);
