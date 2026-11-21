-- Tag reps-type actions that require continuous hand/body support (chair, wall,
-- floor transfer) with 'bez_pocitani' — the frontend must show a single
-- "Hotovo" after the whole set instead of a tap-per-rep "+1" counter, since
-- the user's hands are occupied with support throughout and tapping a phone
-- mid-rep breaks form/pacing or means letting go of support.
-- Affected: sit_to_stand_supported, 5db16b41-daf7-4606-bc67-e13b0303cfa5 (floor_get_up)
-- All other type='reps' actions (dřepy, kliky, shoulder press, step_down,
-- jump_squat, box_jump, kettlebell swings) are unaffected — hands are free
-- between reps there, same as a normal gym set.
UPDATE longevity_actions
SET tags = array_append(tags, 'bez_pocitani')
WHERE id IN ('sit_to_stand_supported', '5db16b41-daf7-4606-bc67-e13b0303cfa5')
  AND NOT ('bez_pocitani' = ANY(tags));
