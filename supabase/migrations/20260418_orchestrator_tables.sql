-- =====================================================
-- CHJ Orchestrator — nové tabulky
-- Datum: 2026-04-18
--
-- Nové tabulky:
--   user_readiness    — denní signály připravenosti (HRV, spánek...)
--   user_medications  — léky ovlivňující trénink a metriky
--   user_supplements  — suplementy (kontext pro agenty)
--   user_decathlon    — desetiboj: cíle uživatele v 85 letech
--   orchestrator_log  — co orchestrátor rozhodl (kontinuita + debug)
--
-- Napojení na existující:
--   user_profiles     — profil (věk, pohlaví, výška, váha)
--   user_constraints  — omezení (koleno, záda...)
--   user_metrics      — current_index per node
--   mission_log       — splněné kroky
-- =====================================================

BEGIN;

-- =====================================================
-- 1. USER_READINESS
-- Denní signály připravenosti — z hodinek, prstýnku nebo ručně.
-- Orchestrátor čte nejnovější záznam pro dnešní rozhodnutí.
-- =====================================================

CREATE TABLE IF NOT EXISTS user_readiness (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text        NOT NULL,
  date            date        NOT NULL DEFAULT CURRENT_DATE,

  -- Z wearables (Apple Watch, Oura Ring)
  hrv_ms          integer,                        -- HRV v ms (RMSSD)
  hrv_baseline_ms integer,                        -- baseline pro tohoto uživatele
  resting_hr      integer,                        -- klidový tep ráno
  sleep_hours     numeric(4,1),                   -- délka spánku
  sleep_quality   smallint CHECK (sleep_quality BETWEEN 1 AND 5),
  steps_yesterday integer,                        -- kroky předchozí den

  -- Subjektivní (volitelné, uživatel zadá)
  energy_level    smallint CHECK (energy_level BETWEEN 1 AND 5),

  -- Zdroj dat
  source          text NOT NULL DEFAULT 'manual', -- 'apple_watch' | 'oura' | 'manual'

  created_at      timestamptz DEFAULT now(),

  UNIQUE (user_id, date)
);

COMMENT ON TABLE user_readiness IS
  'Denní signály připravenosti. Orchestrátor čte nejnovější záznam před každým rozhodnutím.';
COMMENT ON COLUMN user_readiness.hrv_baseline_ms IS
  'Osobní baseline HRV — delta oproti baseline je klíčový signál (ne absolutní číslo).';

CREATE INDEX IF NOT EXISTS idx_readiness_user_date
  ON user_readiness (user_id, date DESC);


-- =====================================================
-- 2. USER_MEDICATIONS
-- Léky relevantní pro trénink a interpretaci metrik.
-- Orchestrátor upraví rozhodnutí (např. beta-blokátory → HR nespolehlivý).
-- =====================================================

CREATE TABLE IF NOT EXISTS user_medications (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text        NOT NULL,
  name            text        NOT NULL,

  -- Jak lék ovlivňuje tréninkové rozhodnutí
  -- Hodnoty: 'hr_unreliable' | 'fatigue' | 'hydration' | 'glucose_masked'
  --          'bone_density'  | 'muscle_loss' | 'bp_lowered'
  affects         text[]      NOT NULL DEFAULT '{}',

  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE user_medications IS
  'Léky uživatele. Pole affects[] říká orchestrátoru jak upravit rozhodnutí.';
COMMENT ON COLUMN user_medications.affects IS
  'hr_unreliable: beta-blokátory → použij RPE místo tepu.
   glucose_masked: inzulín/metformin → glykémie neodráží reálný stav.
   fatigue: léky způsobující únavu → snižuj intenzitu.';

CREATE INDEX IF NOT EXISTS idx_medications_user
  ON user_medications (user_id) WHERE active = true;


-- =====================================================
-- 3. USER_SUPPLEMENTS
-- Suplementy — kontext pro Zdraví agenta a Výživa agenta.
-- Orchestrátor nerozhoduje podle suplementů sám, předá je agentovi.
-- =====================================================

CREATE TABLE IF NOT EXISTS user_supplements (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text        NOT NULL,
  name            text        NOT NULL,           -- 'Omega-3' | 'Kreatin' | 'Magnesium'
  dose_mg         integer,                        -- dávka v mg
  timing          text,                           -- 'ráno' | 'večer' | 'před tréninkem'

  -- Pro který pilíř/jezdce je supl relevantní
  -- Hodnoty: 'kardio' | 'sval' | 'zanet' | 'spanek' | 'mozek' | 'kosti'
  goal            text[]      NOT NULL DEFAULT '{}',

  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE user_supplements IS
  'Suplementy uživatele. Předávají se Zdraví a Výživa agentovi jako kontext.';

CREATE INDEX IF NOT EXISTS idx_supplements_user
  ON user_supplements (user_id) WHERE active = true;


-- =====================================================
-- 4. USER_DECATHLON
-- Desetiboj — co chce uživatel zvládat v 85 letech.
-- Základ personalizace: bottleneck se váží podle důležitosti cílů.
-- =====================================================

CREATE TABLE IF NOT EXISTS user_decathlon (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text        NOT NULL,

  -- Standardizovaný klíč cíle
  -- Hodnoty: 'bezky' | 'kolo_2h' | 'hora' | 'vstat_ze_zeme' | 'nosit_15kg'
  --          'tenis' | 'plavani' | 'vnoucata' | 'chodi_5km' | 'vlastni_vaha'
  goal_key        text        NOT NULL,

  label           text        NOT NULL,           -- "Projet na běžkách 5 km"
  target_age      smallint    NOT NULL DEFAULT 85,
  priority        smallint    NOT NULL DEFAULT 3  -- 1 (nízká) – 5 (vysoká)
    CHECK (priority BETWEEN 1 AND 5),

  -- Které pilíře tento cíl vyžaduje (váha 0–1)
  -- {"zone2": 0.4, "sila": 0.3, "stabilita": 0.2, "vo2max": 0.1}
  pillar_weights  jsonb       NOT NULL DEFAULT '{}',

  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),

  UNIQUE (user_id, goal_key)
);

COMMENT ON TABLE user_decathlon IS
  'Desetiboj uživatele — cíle pro věk 85. Orchestrátor váží bottleneck podle pillar_weights.';
COMMENT ON COLUMN user_decathlon.pillar_weights IS
  'Kolik každý pilíř přispívá k tomuto cíli. Suma nemusí být 1.
   Příklad běžky: {"zone2": 0.4, "sila": 0.3, "stabilita": 0.2, "vo2max": 0.1}';

CREATE INDEX IF NOT EXISTS idx_decathlon_user
  ON user_decathlon (user_id) WHERE active = true;


-- =====================================================
-- 5. ORCHESTRATOR_LOG
-- Co orchestrátor rozhodl — kontinuita mezi sezeními.
-- Orchestrátor čte posledních N záznamů před novým rozhodnutím.
-- =====================================================

CREATE TABLE IF NOT EXISTS orchestrator_log (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         text        NOT NULL,
  node_id         text        REFERENCES longevity_nodes(id) ON DELETE SET NULL,
  date            date        NOT NULL DEFAULT CURRENT_DATE,

  pillar          text,                           -- 'ZONE2' | 'SILA' | 'VO2MAX' | 'STABILITA' | 'REGENERACE'
  action_id       text,                           -- ID akce z longevity_actions
  tier            smallint,

  verdict         text,                           -- verdikt zobrazený uživateli
  completion_feedback text,                       -- feedback po splnění

  -- Proč orchestrátor rozhodl takto (debug + kontinuita)
  reasoning       text,

  -- Signály v době rozhodnutí (snapshot)
  signals         jsonb       NOT NULL DEFAULT '{}',
  -- {"hrv_ms": 38, "hrv_delta_pct": -27, "sleep_hours": 5.8,
  --  "bottleneck": "kardio", "bottleneck_index": 22, "streak": 1}

  completed       boolean     NOT NULL DEFAULT false,
  completed_at    timestamptz,

  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE orchestrator_log IS
  'Log rozhodnutí orchestrátoru. Čte se před každým novým rozhodnutím pro kontinuitu.
   Orchestrátor vidí: co bylo minulý týden, jak reagoval uživatel, jaký byl trend.';
COMMENT ON COLUMN orchestrator_log.signals IS
  'Snapshot vstupních signálů v době rozhodnutí — pro zpětnou analýzu a ladění.';

CREATE INDEX IF NOT EXISTS idx_orch_log_user_date
  ON orchestrator_log (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_orch_log_node
  ON orchestrator_log (user_id, node_id, date DESC);


-- =====================================================
-- 6. ROZŠÍŘENÍ STÁVAJÍCÍCH TABULEK
-- =====================================================

-- user_constraints: přidej affects_pillars (teď má jen affects_nodes)
ALTER TABLE user_constraints
  ADD COLUMN IF NOT EXISTS affects_pillars text[] DEFAULT '{}';

COMMENT ON COLUMN user_constraints.affects_pillars IS
  'Které pilíře toto omezení ovlivňuje: zone2 | sila | vo2max | stabilita';

COMMIT;
