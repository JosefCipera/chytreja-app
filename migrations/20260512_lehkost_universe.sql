-- ─────────────────────────────────────────────────────────────────
-- MIGRACE: Hra o Lehkost — nový vesmír
-- Uzly, akce, daily_checkin tabulka
-- Spustit ručně v Supabase SQL Editoru
-- ─────────────────────────────────────────────────────────────────

-- ── 1. UZLY ──────────────────────────────────────────────────────
-- Středový uzel + 4 okolní. Prefix lh_ aby nekolidovaly s Longevity.

INSERT INTO longevity_nodes (id, label, parent, default_priority) VALUES
  ('lh_main',       'Hra o lehkost', NULL,      1),
  ('lh_vyziva',     'Výživa',        'lh_main', 1),
  ('lh_pohyb',      'Pohyb',         'lh_main', 2),
  ('lh_mysl',       'Mysl',          'lh_main', 3),
  ('lh_regenerace', 'Regenerace',    'lh_main', 4)
ON CONFLICT (id) DO NOTHING;


-- ── 2. AKCE ──────────────────────────────────────────────────────
-- 3 akce na uzel (tier 1 = základní, tier 2 = posílení)

INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags) VALUES

  -- VÝŽIVA
  ('lh_protein_vecer',   'lh_vyziva', 'Proteinová večeře',            'NUTRITION_PROTOKOL', '🥩', 'bool', NULL, NULL, 1, '{"protein","vecer"}'),
  ('lh_bez_sladkeho',    'lh_vyziva', 'Žádné sladké doma večer',      'NUTRITION_PROTOKOL', '🚫', 'bool', NULL, NULL, 1, '{"prostredí","vecer"}'),
  ('lh_bez_tekutin',     'lh_vyziva', 'Žádné slazené nápoje dnes',    'NUTRITION_PROTOKOL', '💧', 'bool', NULL, NULL, 1, '{"kaloríe"}'),
  ('lh_protein_obed',    'lh_vyziva', 'Protein jako první u oběda',   'NUTRITION_PROTOKOL', '🍗', 'bool', NULL, NULL, 2, '{"protein","obed"}'),

  -- POHYB
  ('lh_walk_10',         'lh_pohyb',  '10 minut chůze teď',           'MOVEMENT_PROTOKOL',  '🚶', 'timed', 600, NULL, 1, '{"neat","chůze"}'),
  ('lh_kroky_8k',        'lh_pohyb',  '8 000 kroků dnes',             'MOVEMENT_PROTOKOL',  '👟', 'bool',  NULL, NULL, 1, '{"neat","kroky"}'),
  ('lh_walk_20',         'lh_pohyb',  '20 minut chůze venku',         'MOVEMENT_PROTOKOL',  '🌳', 'timed', 1200, NULL, 2, '{"neat","chůze"}'),
  ('lh_sit_break',       'lh_pohyb',  'Vstávej každou hodinu',        'MOVEMENT_PROTOKOL',  '⏱️', 'bool',  NULL, NULL, 1, '{"neat","sezení"}'),

  -- MYSL
  ('lh_pause_snack',     'lh_mysl',   'Pauza 5 minut před snackem',   'RESET_PROTOKOL',     '⏸️', 'timed', 300, NULL, 1, '{"impulz","chuť"}'),
  ('lh_urge_surfing',    'lh_mysl',   'Pozoruj chuť, nepodlehni',     'RESET_PROTOKOL',     '🌊', 'bool',  NULL, NULL, 1, '{"impulz","mindful"}'),
  ('lh_stress_check',    'lh_mysl',   'Co cítíš teď? Nejez ze stresu','RESET_PROTOKOL',     '🧠', 'bool',  NULL, NULL, 2, '{"stres","emoce"}'),

  -- REGENERACE
  ('lh_sleep_shutdown',  'lh_regenerace', 'Obrazovky pryč v 22:30',   'SLEEP_PROTOKOL',     '📵', 'bool',  NULL, NULL, 1, '{"spanek","shutdown"}'),
  ('lh_sleep_7h',        'lh_regenerace', 'Spát 7+ hodin',            'SLEEP_PROTOKOL',     '😴', 'bool',  NULL, NULL, 1, '{"spanek"}'),
  ('lh_rano_bez_stresu', 'lh_regenerace', 'Ráno bez telefonu 20 min', 'RESET_PROTOKOL',     '🌅', 'timed', 1200, NULL, 2, '{"rano","kortizol"}')

ON CONFLICT (id) DO NOTHING;


-- ── 3. DAILY CHECK-IN TABLE ───────────────────────────────────────
-- Ranní vstup uživatele (6 hodnot, ~15 sekund)

CREATE TABLE IF NOT EXISTS daily_checkin (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  universe        TEXT        NOT NULL DEFAULT 'lehkost',

  -- Volitelné vstupy (NULL = neposkytl)
  weight_kg       NUMERIC(5,2),              -- váha v kg (volitelné)
  energy          SMALLINT CHECK (energy BETWEEN 1 AND 5),
  sleep_hours     NUMERIC(3,1),              -- 4.5 / 7.0 / 8.5
  binge           BOOLEAN,                   -- přejedl ses včera?
  movement_level  TEXT CHECK (movement_level IN ('low','medium','high')),
  stress          SMALLINT CHECK (stress BETWEEN 1 AND 5),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, date, universe)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_date
  ON daily_checkin (user_id, date DESC);

COMMENT ON TABLE daily_checkin IS
  'Hra o Lehkost: ranní check-in (váha, energie, spánek, přejedení, pohyb, stres)';


-- ── 4. INITIAL METRICS SEED (volitelné, pro testování) ────────────
-- user_metrics pro lh_main se vytvoří automaticky při prvním check-inu
-- Tady jen info komentář:
-- INSERT INTO user_metrics (user_id, node_id, universe, current_index, state)
-- VALUES (:user_id, 'lh_main', 'lehkost', 50, 'YELLOW') ON CONFLICT DO UPDATE ...
