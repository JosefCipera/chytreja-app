-- Fix: change all 'bool' action types to 'habit'
-- Affected: spanek_prep, protein_check, zelenina, pust_12h, pust_16h, vitamind, krev_check
UPDATE longevity_actions
SET type = 'habit'
WHERE type = 'bool';
