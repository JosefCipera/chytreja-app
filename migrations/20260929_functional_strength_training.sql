-- Functional Strength Training v0.1
-- Adds one supported sit-to-stand action for LOW_MUSCLE_STRENGTH (confirmed functional
-- weakness, e.g. cannot rise from the floor unaided — vstat_ze_zeme = "Ne").
--
-- Free bodyweight squats (drepy_s0/s1, telo_drepy) were reviewed and rejected as a first
-- action for this population (C3 analysis, 2026-09-29): unsupported, no chair/wall contact.
-- This row is support-based by design: chair + wall, low rep count, LIGHT intensity, tier 1.
-- The safety instruction (stable chair, hand support, stop condition) is folded directly
-- into the label — no other field for a longer per-action instruction exists in this table
-- or anywhere else in the codebase (verified 2026-09-29: no action_instructions /
-- exercise_library / action_details table; buildActResponse renders only action.label
-- unconditionally). The label is one sentence, 15 words; buildActResponse appends the
-- final period itself (`${action.label}.`), which is why the label carries no trailing
-- period of its own — CLAUDE.md §8's one-sentence/15-word rule is met as written.
--
-- The Safety Gate's decision logic (evaluateSafetyGate in nextBestAction.js) is unchanged:
-- constraint_exclude is intentionally empty, so protection comes from the existing 'nohy'
-- tag mapping to {knee, hip, ankle_foot} in TAG_BODY_LOAD, same as any other action carrying
-- that tag. FUNKCNI_SILOVY_PROTOKOL is registered into the same PROTOCOL_BODY_LOAD entry
-- (null -> derive from tags) and the same CV-risk modification family (SILOVY_PROTOKOL_FAMILY)
-- as SILOVY_PROTOKOL, so this row is evaluated identically — no new Safety Gate mechanism.
--
-- protocol_type = 'FUNKCNI_SILOVY_PROTOKOL', NOT 'SILOVY_PROTOKOL' (C3 fix, 2026-09-29):
-- PHYSICAL_INACTIVITY's and EXCESS_ADIPOSITY's own RESISTANCE_TRAINING mapping entries declare
-- protocol_types: ["SILOVY_PROTOKOL"] with no tag_filter — any SILOVY_PROTOKOL row is
-- automatically a candidate under those leverage nodes too. A distinct protocol_type keeps this
-- action reachable only from the leverage node it was built for (LOW_MUSCLE_STRENGTH ->
-- FUNCTIONAL_STRENGTH_TRAINING). The joint Safety Gate and CV-risk modification still apply
-- identically — see api/engine/nextBestAction.js's SILOVY_PROTOKOL_FAMILY.
--
-- Safe to run multiple times: ON CONFLICT DO NOTHING. Does not modify any existing rows.
-- Run in Supabase SQL Editor.

INSERT INTO longevity_actions
  (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags,
   constraint_exclude, intensity, active)
VALUES
  ('sit_to_stand_supported',
   'sila',
   'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči',
   'FUNKCNI_SILOVY_PROTOKOL', '🪑', 'reps', null, 5, 1,
   ARRAY['sila', 'nohy', 'sit_to_stand'],
   ARRAY[]::text[],
   'LIGHT',
   true)
ON CONFLICT (id) DO NOTHING;

-- Verify:
-- SELECT id, label, protocol_type, tags, intensity, tier, reps, constraint_exclude, active
-- FROM longevity_actions WHERE id = 'sit_to_stand_supported';
