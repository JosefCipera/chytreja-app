-- v03_personal_data_layer.sql
-- Rozšíření osobní datové vrstvy pro CHJ v0.3
-- BEZPEČNÉ: pouze ALTER TABLE ADD COLUMN + nové tabulky
-- Nic se nemaže, nic se nemění
-- Spustit v Supabase SQL Editoru

-- ═══════════════════════════════════════════════════
-- 1. SUPLEMENTY — přidat chybějící sloupce
-- ═══════════════════════════════════════════════════

ALTER TABLE user_supplements
  ADD COLUMN IF NOT EXISTS form         text,        -- 'tablet' | 'capsule' | 'powder' | 'liquid'
  ADD COLUMN IF NOT EXISTS frequency    text,        -- 'daily' | 'weekly' | 'as_needed'
  ADD COLUMN IF NOT EXISTS reason       text,        -- proč beru (volný text nebo 'low_mg', 'sleep')
  ADD COLUMN IF NOT EXISTS lab_marker   text,        -- FK marker z user_lab_results (např. 'Mg')
  ADD COLUMN IF NOT EXISTS notes        text,        -- osobní poznámky
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

-- ═══════════════════════════════════════════════════
-- 2. LÉKY — přidat chybějící sloupce
-- ═══════════════════════════════════════════════════

ALTER TABLE user_medications
  ADD COLUMN IF NOT EXISTS timing       text,        -- 'morning' | 'evening' | 'with_meal' | 'as_needed'
  ADD COLUMN IF NOT EXISTS frequency    text,        -- 'daily' | 'weekly' | 'as_needed'
  ADD COLUMN IF NOT EXISTS condition    text,        -- na co (hypertenze, diabetes...)
  ADD COLUMN IF NOT EXISTS start_date   date,
  ADD COLUMN IF NOT EXISTS end_date     date,        -- null = chronický
  ADD COLUMN IF NOT EXISTS prescribed   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

-- ═══════════════════════════════════════════════════
-- 3. LAB VÝSLEDKY — přidat status + doc reference
-- ═══════════════════════════════════════════════════

ALTER TABLE user_lab_results
  ADD COLUMN IF NOT EXISTS status       text         -- 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
    GENERATED ALWAYS AS (
      CASE
        WHEN value IS NULL OR reference_min IS NULL OR reference_max IS NULL THEN 'UNKNOWN'
        WHEN value < reference_min THEN 'LOW'
        WHEN value > reference_max THEN 'HIGH'
        ELSE 'NORMAL'
      END
    ) STORED,
  ADD COLUMN IF NOT EXISTS lab_name     text,        -- název laboratoře
  ADD COLUMN IF NOT EXISTS doc_ref      text,        -- odkaz na zdrojový dokument
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

-- ═══════════════════════════════════════════════════
-- 4. BIOMETRIE — přidat rozšířené metriky
-- ═══════════════════════════════════════════════════

ALTER TABLE user_biometrics
  ADD COLUMN IF NOT EXISTS muscle_mass_kg  numeric,  -- ze DEXA nebo odhad
  ADD COLUMN IF NOT EXISTS bone_density    numeric,  -- T-score ze DEXA
  ADD COLUMN IF NOT EXISTS hrv_ms          numeric,  -- HRV v ms (z Oura/Apple Health)
  ADD COLUMN IF NOT EXISTS resting_hr      integer,  -- klidový tep
  ADD COLUMN IF NOT EXISTS vo2max          numeric,  -- VO2max ml/kg/min
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

-- ═══════════════════════════════════════════════════
-- 5. JÍDLA — nová tabulka pro tracking stravy
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_meals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  logged_at     timestamptz NOT NULL DEFAULT now(),
  meal_type     text,                    -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description   text,                   -- "ovesné vločky s mlékem a ovocem"
  photo_url     text,                   -- URL fotky (Food Camera)
  kcal          integer,
  protein_g     numeric,
  carbs_g       numeric,
  fat_g         numeric,
  source        text DEFAULT 'manual',  -- 'manual' | 'photo' | 'barcode'
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- 6. DENNÍ LOG — souhrn dne
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_daily_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  log_date        date NOT NULL DEFAULT current_date,
  total_kcal      integer,
  total_protein_g numeric,
  steps           integer,
  sleep_hours     numeric,
  sleep_quality   integer,              -- 1–10 (z Oura nebo ručně)
  hrv_morning     numeric,             -- ranní HRV
  weight_kg       numeric,             -- ranní váha
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- ═══════════════════════════════════════════════════
-- 7. NOTIFIKACE — proaktivní plán upozornění
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_notification_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  trigger_type  text NOT NULL,         -- 'supplement' | 'meal' | 'activity' | 'check_in'
  trigger_ref   uuid,                  -- FK na supplement/medication (optional)
  time_of_day   time NOT NULL,         -- 07:30, 22:00...
  days_of_week  integer[],             -- {1,2,3,4,5,6,7} = každý den
  message       text,                  -- "Mg glycinát 2 tablety — dobrý spánek"
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════
-- Indexy pro výkon
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_user_meals_user_date
  ON user_meals (user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_daily_log_user_date
  ON user_daily_log (user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_notif_user_active
  ON user_notification_schedule (user_id, active);

CREATE INDEX IF NOT EXISTS idx_user_lab_user_marker
  ON user_lab_results (user_id, marker, tested_at DESC);
