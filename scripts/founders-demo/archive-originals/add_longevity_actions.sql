-- longevity_actions: action definitions with protocol_type, duration, tier
CREATE TABLE IF NOT EXISTS longevity_actions (
  id             text PRIMARY KEY,
  node_id        text REFERENCES longevity_nodes(id),
  label          text NOT NULL,
  protocol_type  text NOT NULL DEFAULT 'TRAINING_PROTOKOL',
  icon           text,
  type           text NOT NULL DEFAULT 'timed',
  duration       integer,
  reps           integer,
  tier           integer NOT NULL DEFAULT 1,
  tags           text[] DEFAULT '{}',
  active         boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags) VALUES
  ('plank_30s',     'telo', 'Drž plank 30 sekund',          'TRAINING_PROTOKOL',    '🏋️', 'timed', 30,   NULL, 1, '{"sila","core"}'),
  ('plank_60s',     'telo', 'Drž plank 60 sekund',          'TRAINING_PROTOKOL',    '🏋️', 'timed', 60,   NULL, 2, '{"sila","core"}'),
  ('plank_90s',     'telo', 'Drž plank 90 sekund',          'TRAINING_PROTOKOL',    '🏋️', 'timed', 90,   NULL, 3, '{"sila","core"}'),
  ('drepy_s0',      'telo', 'Udělej dřepy',                 'TRAINING_PROTOKOL',    '🦵', 'reps',  NULL, 15,  1, '{"nohy","sila"}'),
  ('drepy_s1',      'telo', 'Udělej dřepy',                 'TRAINING_PROTOKOL',    '🦵', 'reps',  NULL, 20,  2, '{"nohy","sila"}'),
  ('kliky_t1',      'telo', 'Udělej kliky',                 'TRAINING_PROTOKOL',    '💪', 'reps',  NULL, 10,  1, '{"horni","sila"}'),
  ('kliky_t2',      'telo', 'Udělej kliky',                 'TRAINING_PROTOKOL',    '💪', 'reps',  NULL, 20,  2, '{"horni","sila"}'),
  ('chůze_20min',   'telo', 'Jdi na procházku 20 minut',    'TRAINING_PROTOKOL',    '🚶', 'timed', 1200, NULL, 1, '{"kardio"}'),
  ('run_20min',     'telo', 'Běž 20 minut',                 'TRAINING_PROTOKOL',    '🏃', 'timed', 1200, NULL, 2, '{"kardio"}'),
  ('protazeni',     'telo', 'Protáhni se 10 minut',         'MOBILITY_PROTOKOL',    '🧘', 'timed', 600,  NULL, 1, '{"mobilita"}'),
  ('dech_4min',     'mysl', 'Dechové cvičení 4 minuty',     'MEDITATION_PROTOKOL',  '🫁', 'timed', 240,  NULL, 1, '{"dech","klid"}'),
  ('meditace_5',    'mysl', 'Medituj 5 minut',              'MEDITATION_PROTOKOL',  '🧘', 'timed', 300,  NULL, 1, '{"meditace"}'),
  ('meditace_10',   'mysl', 'Medituj 10 minut',             'MEDITATION_PROTOKOL',  '🧘', 'timed', 600,  NULL, 2, '{"meditace"}'),
  ('spanek_prep',   'mysl', 'Příprava na spánek',           'SLEEP_PROTOKOL',       '😴', 'bool',  NULL, NULL, 1, '{"spanek"}'),
  ('protein_check', 'vyziva','Zkontroluj příjem proteinu',  'NUTRITION_PROTOKOL',   '🥩', 'bool',  NULL, NULL, 1, '{"protein"}'),
  ('zelenina',      'vyziva','Přidej zeleninu k jídlu',     'NUTRITION_PROTOKOL',   '🥦', 'bool',  NULL, NULL, 1, '{"zelenina"}'),
  ('pust_12h',      'metabolicke','Drž půst 12 hodin',      'METABOL_PROTOKOL',     '⏱️', 'bool',  NULL, NULL, 1, '{"pust"}'),
  ('pust_16h',      'metabolicke','Drž půst 16 hodin',      'METABOL_PROTOKOL',     '⏱️', 'bool',  NULL, NULL, 2, '{"pust"}'),
  ('vitamind',      'zdravi','Vezmi vitamín D',              'PREVENTION_PROTOKOL',  '💊', 'bool',  NULL, NULL, 1, '{"suplementy"}'),
  ('krev_check',    'zdravi','Naplánuj krevní odběr',        'PREVENTION_PROTOKOL',  '🩸', 'bool',  NULL, NULL, 1, '{"prevence"}')
ON CONFLICT (id) DO NOTHING;
