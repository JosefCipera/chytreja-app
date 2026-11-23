-- Grip Strength Training v0.1
-- Adds one grip-specific action for LOW_MUSCLE_STRENGTH, offered only when the
-- confirmed functional deficit is grip-only (otevrit_zavarovacku = "Ne") with
-- no leg/floor-rise evidence (vstat_ze_zeme / vynest_nakup / zvednout_vnouce
-- all absent or "Ano") — see hasUpperBodyOnlyStrengthEvidence() in
-- api/engine/nextBestAction.js and the GRIP_STRENGTH_TRAINING intervention in
-- data/engine/intervention-map.json. When any leg/floor-rise evidence is also
-- present, sit_to_stand_supported remains the selected action, unchanged.
--
-- Follows the same pattern as sit_to_stand_supported
-- (migrations/20260929_functional_strength_training.sql): support-based,
-- low rep count, LIGHT intensity, tier 1, safety instruction folded into the
-- label (buildActResponse renders only action.label).
--
-- protocol_type = 'GRIP_SILOVY_PROTOKOL', its own value distinct from
-- FUNKCNI_SILOVY_PROTOKOL (not reused): assignIntervention() in nextBestAction.js
-- matches non-TRAINING protocol_types 1:1 to a single intervention by exact
-- protocol_type value. Reusing FUNKCNI_SILOVY_PROTOKOL here would make that
-- match ambiguous between FUNCTIONAL_STRENGTH_TRAINING and
-- GRIP_STRENGTH_TRAINING (both map to LOW_MUSCLE_STRENGTH) and the tag_filter
-- distinction (sit_to_stand vs grip) is only applied after that point — so a
-- shared protocol_type would make this action silently fall under the wrong
-- intervention instead of being correctly gated. SILOVY_PROTOKOL_FAMILY in
-- nextBestAction.js includes GRIP_SILOVY_PROTOKOL so Safety Gate / CV-risk
-- modification treat it identically to any other strength protocol.
--
-- Safe to run multiple times: ON CONFLICT DO NOTHING. Does not modify any existing rows.
-- Run in Supabase SQL Editor.

INSERT INTO longevity_actions
  (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags,
   constraint_exclude, intensity, active)
VALUES
  ('grip_squeeze_supported',
   'sila',
   '10× v každé ruce pevně sevři pěst na 3 sekundy a povol; při bolesti skonči',
   'GRIP_SILOVY_PROTOKOL', '✊', 'reps', null, 10, 1,
   ARRAY['grip'],
   ARRAY[]::text[],
   'LIGHT',
   true)
ON CONFLICT (id) DO NOTHING;

-- Verify:
-- SELECT id, label, protocol_type, tags, intensity, tier, reps, constraint_exclude, active
-- FROM longevity_actions WHERE id = 'grip_squeeze_supported';
