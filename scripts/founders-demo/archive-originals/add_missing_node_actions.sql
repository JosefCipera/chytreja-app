-- add_missing_node_actions.sql
-- Habit actions for 5 nodes that had no longevity_actions entries:
--   rovnovaha, spanek, stres, nervovy_system, vytrvalost
-- Type: 'habit' — single HOTOVO button, no timer, no reps
-- Run in Supabase SQL Editor

INSERT INTO longevity_actions
  (id, node_id, label, protocol_type, icon, type, tier, tags, active)
VALUES

-- ── ROVNOVÁHA ─────────────────────────────────────────────────
('rovnovaha_stoj_1', 'rovnovaha',
 'Stůj 30 sekund na jedné noze',
 'BALANCE_PROTOKOL', '🦵', 'timed', 1,
 ARRAY['rovnovaha','stabilita','dekatlon'], true),

('rovnovaha_stoj_2', 'rovnovaha',
 'Stůj 30 s na jedné noze — se zavřenýma očima',
 'BALANCE_PROTOKOL', '🦵', 'timed', 2,
 ARRAY['rovnovaha','stabilita','dekatlon'], true),

('rovnovaha_habit', 'rovnovaha',
 'Proveď dnes rovnovážné cvičení',
 'BALANCE_PROTOKOL', '⚖️', 'habit', 1,
 ARRAY['rovnovaha','propriocepce'], true),

-- ── SPÁNEK ────────────────────────────────────────────────────
('spanek_bez_obrazovky', 'spanek',
 'Vypni obrazovky hodinu před spánkem',
 'SLEEP_PROTOKOL', '🌙', 'habit', 1,
 ARRAY['spanek','cirkadian','melatonin'], true),

('spanek_cas', 'spanek',
 'Lehni si dnes ve stejný čas jako včera',
 'SLEEP_PROTOKOL', '🌙', 'habit', 1,
 ARRAY['spanek','cirkadian'], true),

('spanek_teplota', 'spanek',
 'Větrání — vychlaď ložnici před spánkem',
 'SLEEP_PROTOKOL', '❄️', 'habit', 2,
 ARRAY['spanek','cirkadian'], true),

-- ── STRES ─────────────────────────────────────────────────────
('stres_dech', 'stres',
 'Dechové cvičení: 4 s nádech, 8 s výdech — 5×',
 'STRESS_PROTOKOL', '🌬️', 'timed', 1,
 ARRAY['stres','dech','parasympatikus','nervovy_system'], true),

('stres_pauza', 'stres',
 'Udělej si 5minutovou pauzu bez telefonu',
 'STRESS_PROTOKOL', '🧘', 'timed', 1,
 ARRAY['stres','klid','parasympatikus'], true),

('stres_priroda', 'stres',
 'Vyjdi ven — alespoň 10 minut v přírodě nebo na čerstvém vzduchu',
 'STRESS_PROTOKOL', '🌿', 'habit', 2,
 ARRAY['stres','klid','kortizol'], true),

-- ── NERVOVÝ SYSTÉM ────────────────────────────────────────────
('ns_dech_box', 'nervovy_system',
 'Box breathing: 4-4-4-4 — 5 kol',
 'NEURO_PROTOKOL', '🧠', 'timed', 1,
 ARRAY['nervovy_system','dech','parasympatikus','autonomni'], true),

('ns_studena_sprcha', 'nervovy_system',
 'Konec sprchy studenou vodou — alespoň 30 sekund',
 'NEURO_PROTOKOL', '🚿', 'habit', 2,
 ARRAY['nervovy_system','parasympatikus','hrv'], true),

('ns_pohyb', 'nervovy_system',
 'Dnes alespoň 20 minut aerobního pohybu',
 'NEURO_PROTOKOL', '🏃', 'habit', 1,
 ARRAY['nervovy_system','bdnf','pohyb','mozek'], true),

-- ── VYTRVALOST ────────────────────────────────────────────────
('vytr_zona2_30', 'vytrvalost',
 'Zone 2: 30 minut v mírném tempu (mluvíš, ale ne snadno)',
 'VYTRVALOST_PROTOKOL', '🫀', 'timed', 1,
 ARRAY['vytrvalost','zona2','kardio','attia'], true),

('vytr_zona2_45', 'vytrvalost',
 'Zone 2: 45 minut v mírném tempu',
 'VYTRVALOST_PROTOKOL', '🫀', 'timed', 2,
 ARRAY['vytrvalost','zona2','kardio','attia'], true),

('vytr_4x4', 'vytrvalost',
 'Norský 4×4: 4 minuty naplno, 3 minuty klus — 4×',
 'VYTRVALOST_PROTOKOL', '⚡', 'timed', 3,
 ARRAY['vytrvalost','vo2max','interval','norsky','attia'], true)

ON CONFLICT (id) DO NOTHING;

-- Fix durations (seconds) for timed actions
UPDATE longevity_actions SET duration = 30  WHERE id = 'rovnovaha_stoj_1';
UPDATE longevity_actions SET duration = 30  WHERE id = 'rovnovaha_stoj_2';
UPDATE longevity_actions SET duration = 300 WHERE id = 'stres_dech';
UPDATE longevity_actions SET duration = 300 WHERE id = 'stres_pauza';
UPDATE longevity_actions SET duration = 300 WHERE id = 'ns_dech_box';
UPDATE longevity_actions SET duration = 1800 WHERE id = 'vytr_zona2_30';
UPDATE longevity_actions SET duration = 2700 WHERE id = 'vytr_zona2_45';
UPDATE longevity_actions SET duration = 2100 WHERE id = 'vytr_4x4';
-- box breathing: 4+4+4+4 = 16s × 5 kol = 80s
UPDATE longevity_actions SET duration = 80  WHERE id = 'ns_dech_box';
