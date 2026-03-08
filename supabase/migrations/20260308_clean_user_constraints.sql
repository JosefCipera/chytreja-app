-- ============================================================
-- MIGRACE: Vyčistit user_constraints
-- Datum: 2026-03-08
-- Popis: user_constraints zůstane jen pro injury/body_limit.
--        Ostatní typy dat přesunuty do dedikovaných tabulek.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. user_profile – doplnit chybějící sloupce
-- ─────────────────────────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS height_cm    INTEGER,
  ADD COLUMN IF NOT EXISTS birth_year   INTEGER;

-- Přesunout age a sex z user_constraints → user_profile
-- (jen pokud user_profile ještě nemá novější data)
INSERT INTO user_profiles (user_id, age, gender)
SELECT
  uc_age.user_id,
  uc_age.constraint_value::INTEGER                             AS age,
  MAX(CASE WHEN uc_sex.constraint_key = 'sex'
           THEN uc_sex.constraint_value END)                   AS gender
FROM user_constraints uc_age
LEFT JOIN user_constraints uc_sex
       ON uc_sex.user_id        = uc_age.user_id
      AND uc_sex.constraint_type = 'demographic'
      AND uc_sex.constraint_key  = 'sex'
WHERE uc_age.constraint_type = 'demographic'
  AND uc_age.constraint_key  = 'age'
ON CONFLICT (user_id) DO UPDATE
  SET age    = EXCLUDED.age,
      gender = COALESCE(EXCLUDED.gender, user_profiles.gender);


-- ─────────────────────────────────────────────────────────────
-- 2. user_biometrics – nová tabulka pro dynamické tělesné míry
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_biometrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight_kg     NUMERIC(5,1),
  body_fat_pct  NUMERIC(4,1),
  waist_cm      NUMERIC(5,1),
  bmi           NUMERIC(4,1),
  source        TEXT DEFAULT 'manual',   -- manual | oura | garmin | apple_health
  notes         TEXT,
  UNIQUE (user_id, measured_at)
);
CREATE INDEX IF NOT EXISTS user_biometrics_user_date
  ON user_biometrics (user_id, measured_at DESC);

-- Přesunout waist_cm z user_constraints → user_biometrics
INSERT INTO user_biometrics (user_id, waist_cm, source)
SELECT user_id, constraint_value::NUMERIC, 'onboarding'
FROM   user_constraints
WHERE  constraint_type = 'body'
  AND  constraint_key  = 'waist_cm'
ON CONFLICT (user_id, measured_at) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- 3. user_aspirations – přidat target_age a milestone
-- ─────────────────────────────────────────────────────────────
ALTER TABLE user_aspirations
  ADD COLUMN IF NOT EXISTS target_age  INTEGER,
  ADD COLUMN IF NOT EXISTS milestone   TEXT;

-- Přesunout aspiration extras z user_constraints → user_aspirations
UPDATE user_aspirations ua
SET
  target_age = (
    SELECT constraint_value::INTEGER
    FROM   user_constraints uc
    WHERE  uc.user_id         = ua.user_id
      AND  uc.constraint_type = 'aspiration'
      AND  uc.constraint_key  = 'target_age'
    LIMIT 1
  ),
  milestone = (
    SELECT constraint_value
    FROM   user_constraints uc
    WHERE  uc.user_id         = ua.user_id
      AND  uc.constraint_type = 'aspiration'
      AND  uc.constraint_key  = 'milestone'
    LIMIT 1
  );


-- ─────────────────────────────────────────────────────────────
-- 4. user_integrations – nová tabulka pro připojená zařízení
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service       TEXT        NOT NULL,   -- oura | garmin | apple_health | dexcom | cgm
  enabled       BOOLEAN     NOT NULL DEFAULT false,
  token         TEXT,                   -- OAuth token (šifrovaný na app vrstvě)
  last_synced_at TIMESTAMPTZ,
  meta          JSONB,                  -- libovolná extra data (user_id u providera apod.)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service)
);
CREATE INDEX IF NOT EXISTS user_integrations_user
  ON user_integrations (user_id);

-- Přesunout connectivity z user_constraints → user_integrations
INSERT INTO user_integrations (user_id, service, enabled)
SELECT
  user_id,
  constraint_key                            AS service,
  (constraint_value = 'true')               AS enabled
FROM user_constraints
WHERE constraint_type = 'connectivity'
ON CONFLICT (user_id, service) DO UPDATE
  SET enabled    = EXCLUDED.enabled,
      updated_at = now();


-- ─────────────────────────────────────────────────────────────
-- 5. Opravit constraint_key 'back' → 'back_lower' (onboarding bug)
-- ─────────────────────────────────────────────────────────────
UPDATE user_constraints
SET    constraint_key = 'back_lower'
WHERE  constraint_type = 'injury'
  AND  constraint_key  = 'back';


-- ─────────────────────────────────────────────────────────────
-- 6. Smazat přesunutá data z user_constraints
-- ─────────────────────────────────────────────────────────────
DELETE FROM user_constraints
WHERE constraint_type IN ('demographic', 'body', 'aspiration', 'connectivity');

-- user_constraints nyní obsahuje POUZE: injury (a případně body_limit)
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- 7. Budoucí tabulky (prázdné schéma, data přijdou později)
-- ─────────────────────────────────────────────────────────────

-- Laboratorní výsledky
CREATE TABLE IF NOT EXISTS user_lab_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tested_at      DATE        NOT NULL,
  marker         TEXT        NOT NULL,   -- hba1c | cholesterol_total | ldl | hdl | ferritin | tsh | ...
  value          NUMERIC     NOT NULL,
  unit           TEXT,                   -- % | mmol/L | µg/L | ...
  reference_min  NUMERIC,
  reference_max  NUMERIC,
  state          TEXT GENERATED ALWAYS AS (
    CASE
      WHEN reference_min IS NULL AND reference_max IS NULL THEN 'unknown'
      WHEN value < reference_min THEN 'low'
      WHEN value > reference_max THEN 'high'
      ELSE 'ok'
    END
  ) STORED,
  source         TEXT DEFAULT 'manual',  -- manual | lab_pdf | api
  notes          TEXT
);
CREATE INDEX IF NOT EXISTS user_lab_results_user_marker
  ON user_lab_results (user_id, marker, tested_at DESC);

-- Výkonnostní testy (dřepy, kliky, rovnováha, VO2max...)
CREATE TABLE IF NOT EXISTS user_fitness_tests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  test_type   TEXT        NOT NULL,   -- squats | pushups | balance_single_leg | vo2max_estimate | ...
  value       NUMERIC     NOT NULL,
  unit        TEXT,                   -- reps | seconds | ml/kg/min | ...
  node_id     TEXT,                   -- návazný uzel (sila, vytrvalost, stabilita...)
  source      TEXT DEFAULT 'manual', -- manual | voice | wearable
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS user_fitness_tests_user_type
  ON user_fitness_tests (user_id, test_type, tested_at DESC);
