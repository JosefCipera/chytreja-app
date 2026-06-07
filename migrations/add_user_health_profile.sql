-- =====================================================
-- MIGRACE: user_health_profile
-- Sjednocení statických zdravotních dat uživatele.
-- Nahrazuje roztříštěná data z: user_constraints,
-- user_aspirations (cíl), node_inputs (fyzické limity).
-- Time-series tabulky (daily_checkin, user_readiness) zůstávají.
-- =====================================================

CREATE TABLE IF NOT EXISTS user_health_profile (
  user_id       text PRIMARY KEY,

  -- Osobní data
  birth_year    int,               -- pro výpočet věku
  height_cm     numeric(5,1),
  sex           text,              -- 'male' / 'female' / null

  -- Diagnózy a léky (z Mudr. zpráv / ručně)
  diagnoses     jsonb DEFAULT '[]',
  -- [ "Fibrilace síní (FaP)", "Chronický stres", "Hypertenze" ]

  medications   jsonb DEFAULT '[]',
  -- [ { "name": "Torvacard", "dose": "20mg" },
  --   { "name": "Pradaxa",   "dose": "110mg 2x" },
  --   { "name": "Kalnormin", "dose": "600mg" } ]

  -- Laboratorní výsledky (poslední odběr)
  labs          jsonb DEFAULT '{}',
  -- { "LDL": 3.8, "HDL": 1.2, "CRP": 1.1, "HbA1c": 5.4,
  --   "triglycerides": 1.6, "glucose": 5.2,
  --   "date": "2025-11-15" }

  -- Fyzické limity z onboardingu (dekatlon)
  physical      jsonb DEFAULT '{}',
  -- { "vynest_nakup": true, "zvednout_vnouce": false,
  --   "vyjit_4_patra": true, "zadrzeni_dechu": 28 }

  -- Cíl (z user_aspirations)
  goal_type     text,              -- 'bezky_v_85' / 'zhubnout' / 'mit_energii'
  goal_text     text,              -- volný popis cíle

  -- Poznámky z dokumentů (z PDF parseru)
  doctor_notes  text,             -- shrnutí zpráv od lékaře (plain text)

  -- Metadata
  updated_at    timestamptz DEFAULT now()
);

-- Index pro rychlé načtení
CREATE INDEX IF NOT EXISTS idx_uhp_user ON user_health_profile(user_id);

-- Trigger: automaticky updatuje updated_at
CREATE OR REPLACE FUNCTION update_uhp_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_uhp_updated
  BEFORE UPDATE ON user_health_profile
  FOR EACH ROW EXECUTE FUNCTION update_uhp_timestamp();

-- =====================================================
-- Seed: Josef Cipera (pro demo/MVP)
-- Spustit ručně po vytvoření tabulky.
-- user_id = Firebase UID ze Supabase auth.
-- =====================================================
/*
INSERT INTO user_health_profile (
  user_id, birth_year, height_cm, sex,
  diagnoses, medications, labs, goal_type, goal_text
) VALUES (
  'DOPLNIT_FIREBASE_UID',
  1971, 182, 'male',
  '["Fibrilace síní (FaP)", "Chronický stres", "Hypertenze"]'::jsonb,
  '[
    {"name": "Torvacard",  "dose": "20mg"},
    {"name": "Pradaxa",    "dose": "110mg 2x denně"},
    {"name": "Kalnormin",  "dose": "600mg"}
  ]'::jsonb,
  '{
    "LDL": 3.8,
    "HDL": 1.3,
    "CRP": 1.1,
    "HbA1c": 5.4,
    "triglycerides": 1.8,
    "date": "2025-11-15"
  }'::jsonb,
  'dlouhovekost',
  'Být fit a aktivní ve vysokém věku, zvládnout běžky v 85.'
)
ON CONFLICT (user_id) DO UPDATE SET
  diagnoses    = EXCLUDED.diagnoses,
  medications  = EXCLUDED.medications,
  labs         = EXCLUDED.labs,
  goal_type    = EXCLUDED.goal_type,
  goal_text    = EXCLUDED.goal_text,
  updated_at   = now();
*/
