-- Mission log: stores completed daily missions
-- Streak is computed from consecutive days with at least 1 completed mission

CREATE TABLE IF NOT EXISTS mission_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      text NOT NULL,
  node_id      text NOT NULL,
  mission_id   text NOT NULL,        -- e.g. 'telo_r1', 'met_r2'
  action_type  text NOT NULL,        -- 'timed', 'count', 'habit', 'photo'
  completed_at timestamptz DEFAULT now(),
  date         date DEFAULT CURRENT_DATE  -- for easy streak grouping
);

-- Fast lookups: user's missions per day, streak calculation
CREATE INDEX IF NOT EXISTS idx_mission_log_user_date
  ON mission_log (user_id, date DESC);

-- Prevent duplicate completions of same mission on same day
CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_log_unique_daily
  ON mission_log (user_id, mission_id, date);
