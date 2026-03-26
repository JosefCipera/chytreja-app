-- =====================================================
-- Migration: longevity_actions table
-- Central action definitions with protocol_type, duration, tier
-- Run manually in Supabase SQL editor
-- =====================================================

CREATE TABLE IF NOT EXISTS longevity_actions (
  id              text PRIMARY KEY,                    -- 'plank_60s'
  node_id         text REFERENCES longevity_nodes(id), -- 'telo'
  label           text NOT NULL,                       -- 'Drž plank 60 sekund'
  protocol_type   text NOT NULL DEFAULT 'TRAINING_PROTOKOL',
  icon            text,                                -- emoji
  type            text NOT NULL DEFAULT 'timed',       -- 'timed' | 'reps' | 'bool' | 'counter'
  duration        integer,                             -- seconds (timed only, NULL = no timer)
  reps            integer,                             -- target reps (reps only)
  tier            integer NOT NULL DEFAULT 1,          -- 1=basic, 2=intermediate, 3=advanced
  tags            text[] DEFAULT '{}',                 -- ['kardio', 'sila'] – constraint filtering
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Index for fast node lookup
CREATE INDEX IF NOT EXISTS idx_longevity_actions_node ON longevity_actions(node_id, tier, active);

-- =====================================================
-- SEED: TĚLO (telo)
-- =====================================================
INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags) VALUES
  ('chůze_30min',   'telo', 'Jdi 30 minut svižně pěšky',  'TRAINING_PROTOKOL',  '🚶', 'timed', 1800, NULL, 1, ARRAY['kardio']),
  ('plank_30s',     'telo', 'Drž plank 30 sekund',         'TRAINING_PROTOKOL',  '🏋️', 'timed',   30, NULL, 1, ARRAY['sila', 'core']),
  ('drepy_20',      'telo', 'Udělej 20 dřepů',             'TRAINING_PROTOKOL',  '🏋️', 'reps',  NULL,   20, 1, ARRAY['sila', 'nohy']),
  ('kliky_10',      'telo', 'Udělej 10 kliků',             'TRAINING_PROTOKOL',  '💪', 'reps',  NULL,   10, 1, ARRAY['sila', 'horni']),
  ('protazeni_5min','telo', 'Protáhni se 5 minut',         'MOBILITY_PROTOKOL',  '🧘', 'timed',  300, NULL, 1, ARRAY['mobilita']),

  ('plank_60s',     'telo', 'Drž plank 60 sekund',         'TRAINING_PROTOKOL',  '🏋️', 'timed',   60, NULL, 2, ARRAY['sila', 'core']),
  ('drepy_50',      'telo', 'Udělej 50 dřepů',             'TRAINING_PROTOKOL',  '🏋️', 'reps',  NULL,   50, 2, ARRAY['sila', 'nohy']),
  ('kliky_20',      'telo', 'Udělej 20 kliků',             'TRAINING_PROTOKOL',  '💪', 'reps',  NULL,   20, 2, ARRAY['sila', 'horni']),
  ('beh_20min',     'telo', 'Běž 20 minut klidným tempem', 'TRAINING_PROTOKOL',  '🏃', 'timed', 1200, NULL, 2, ARRAY['kardio']),

  ('plank_90s',     'telo', 'Drž plank 90 sekund',         'TRAINING_PROTOKOL',  '🏋️', 'timed',   90, NULL, 3, ARRAY['sila', 'core']),
  ('burpees_10',    'telo', 'Udělej 10 burpees',           'TRAINING_PROTOKOL',  '🔥', 'reps',  NULL,   10, 3, ARRAY['sila', 'kardio']),
  ('beh_40min',     'telo', 'Běž 40 minut',                'TRAINING_PROTOKOL',  '🏃', 'timed', 2400, NULL, 3, ARRAY['kardio'])

ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED: MYSL (mysl)
-- =====================================================
INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags) VALUES
  ('dech_4min',       'mysl', 'Dýchej vědomě 4 minuty',    'MEDITATION_PROTOKOL', '🌬️', 'timed',  240, NULL, 1, ARRAY['stres', 'dech']),
  ('meditace_5min',   'mysl', 'Medituj 5 minut v klidu',   'MEDITATION_PROTOKOL', '🧘', 'timed',  300, NULL, 1, ARRAY['mysl', 'stres']),
  ('bez_obrazovky',   'mysl', 'Hodinu před spaním bez obrazovky', 'SLEEP_PROTOKOL', '🌙', 'bool',  NULL, NULL, 1, ARRAY['spanek']),

  ('meditace_10min',  'mysl', 'Medituj 10 minut',          'MEDITATION_PROTOKOL', '🧘', 'timed',  600, NULL, 2, ARRAY['mysl', 'stres']),
  ('box_breathing',   'mysl', 'Box breathing 5 minut',     'MEDITATION_PROTOKOL', '🌬️', 'timed',  300, NULL, 2, ARRAY['stres', 'dech']),
  ('spanek_rutina',   'mysl', 'Dodržuj spánkovou rutinu',  'SLEEP_PROTOKOL',      '🌙', 'bool',  NULL, NULL, 2, ARRAY['spanek']),

  ('meditace_20min',  'mysl', 'Medituj 20 minut',          'MEDITATION_PROTOKOL', '🧘', 'timed', 1200, NULL, 3, ARRAY['mysl', 'stres']),
  ('spanek_730',      'mysl', 'Spi alespoň 7,5 hodiny',    'SLEEP_PROTOKOL',      '🌙', 'bool',  NULL, NULL, 3, ARRAY['spanek'])

ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED: VÝŽIVA (vyziva)
-- =====================================================
INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags) VALUES
  ('protein_porce',   'vyziva', 'Sněz porci bílkoviny (30g+)',   'NUTRITION_PROTOKOL', '🥩', 'bool',  NULL, NULL, 1, ARRAY['protein']),
  ('voda_2l',         'vyziva', 'Vypij dnes 2 litry vody',       'NUTRITION_PROTOKOL', '💧', 'bool',  NULL, NULL, 1, ARRAY['hydratace']),
  ('zelenina',        'vyziva', 'Sněz 2 porce zeleniny',         'NUTRITION_PROTOKOL', '🥦', 'bool',  NULL, NULL, 1, ARRAY['zelenina']),

  ('protein_3x',      'vyziva', 'Protein 3× dnes (90g+)',        'NUTRITION_PROTOKOL', '🥩', 'bool',  NULL, NULL, 2, ARRAY['protein']),
  ('bez_cukru',       'vyziva', 'Dnes bez přidaného cukru',      'NUTRITION_PROTOKOL', '🚫', 'bool',  NULL, NULL, 2, ARRAY['cukr', 'metabolismus']),

  ('meal_prep',       'vyziva', 'Připrav jídla na zítra',        'NUTRITION_PROTOKOL', '🍱', 'bool',  NULL, NULL, 3, ARRAY['protein', 'planovani'])

ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED: ZDRAVÍ (zdravi)
-- =====================================================
INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags) VALUES
  ('vitamin_d',       'zdravi', 'Vezmi vitamin D',               'PREVENTION_PROTOKOL', '💊', 'bool', NULL, NULL, 1, ARRAY['suplementy']),
  ('krok_7000',       'zdravi', 'Udělej 7 000 kroků dnes',       'PREVENTION_PROTOKOL', '👟', 'bool', NULL, NULL, 1, ARRAY['pohyb', 'kardio']),

  ('suplementy',      'zdravi', 'Vezmi všechny suplementy',      'PREVENTION_PROTOKOL', '💊', 'bool', NULL, NULL, 2, ARRAY['suplementy']),
  ('krok_10000',      'zdravi', 'Udělej 10 000 kroků',           'PREVENTION_PROTOKOL', '👟', 'bool', NULL, NULL, 2, ARRAY['pohyb', 'kardio']),

  ('sauna_15min',     'zdravi', 'Sauna 15 minut',                'RECOVERY_PROTOKOL',   '🧖', 'timed', 900, NULL, 3, ARRAY['regenerace', 'kardio']),
  ('studena_sprcha',  'zdravi', 'Studená sprcha 2 minuty',       'RECOVERY_PROTOKOL',   '🚿', 'timed', 120, NULL, 3, ARRAY['regenerace', 'odolnost'])

ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SEED: METABOLISMUS (metabolicke)
-- =====================================================
INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags) VALUES
  ('snidane_skip',    'metabolicke', 'Počkej 2h po probuzení s jídlem',  'METABOL_PROTOKOL', '⏳', 'bool', NULL, NULL, 1, ARRAY['pust', 'glukoza']),
  ('chůze_po_jidle',  'metabolicke', 'Projdi se 10 minut po jídle',      'METABOL_PROTOKOL', '🚶', 'timed', 600, NULL, 1, ARRAY['glukoza', 'pohyb']),

  ('post_16h',        'metabolicke', 'Drž 16h půst',                     'METABOL_PROTOKOL', '⏳', 'bool', NULL, NULL, 2, ARRAY['pust']),
  ('glukoza_check',   'metabolicke', 'Změř glukózu po jídle',            'METABOL_PROTOKOL', '📊', 'bool', NULL, NULL, 2, ARRAY['glukoza', 'mereni']),

  ('post_18h',        'metabolicke', 'Drž 18h půst',                     'METABOL_PROTOKOL', '⏳', 'bool', NULL, NULL, 3, ARRAY['pust']),
  ('cgm_log',         'metabolicke', 'Zaznamenej glukózu po každém jídle', 'METABOL_PROTOKOL', '📊', 'bool', NULL, NULL, 3, ARRAY['glukoza', 'cgm'])

ON CONFLICT (id) DO NOTHING;
