-- Fix action types in longevity_actions table
-- Actions that are one-time tasks (no timer needed) should be type='habit'

-- Krevní odběr: planning a blood test doesn't need a countdown timer
UPDATE longevity_actions
SET type = 'habit', duration = NULL
WHERE label ILIKE '%krevní odběr%'
   OR label ILIKE '%krevni odber%'
   OR label ILIKE '%naplánuj%odběr%'
   OR label ILIKE '%naplánuj%odber%';

-- General rule: any action with "naplánuj" (schedule/plan) is a habit
UPDATE longevity_actions
SET type = 'habit', duration = NULL
WHERE label ILIKE 'naplánuj%'
  AND type = 'timed';
