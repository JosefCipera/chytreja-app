-- ─────────────────────────────────────────────────────────
-- TOC: Parametry + Číselník pracovišť
-- Každý záznam patří uživateli (user_id) — multi-tenant.
-- Default hodnoty vycházejí z exportu Tabidoo.
-- ─────────────────────────────────────────────────────────

-- ── toc_parametry ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS toc_parametry (
    id            BIGSERIAL PRIMARY KEY,
    user_id       TEXT        NOT NULL,
    id_parametru  TEXT        NOT NULL,          -- LV, KP, GD, GO, LZ, ...
    parametr      TEXT        NOT NULL,          -- popis parametru
    hodnota       NUMERIC     NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, id_parametru)
);

COMMENT ON TABLE toc_parametry IS 'TOC: Systémové parametry (limit vytížení, délka plánu, Gantt okno…)';

-- Seed: výchozí hodnoty z Tabidoo (vložit pro každého nového uživatele)
-- INSERT INTO toc_parametry (user_id, id_parametru, parametr, hodnota) VALUES
--   (:user_id, 'LV',   'Limit vytížení kapacity pracoviště v %',           90),
--   (:user_id, 'KP',   'Počet dnů pro kapacitní plán',                     60),
--   (:user_id, 'GD',   'Zobrazení Gantta do dneška ve dnech',              -30),
--   (:user_id, 'GO',   'Zobrazení Gantta ode dneška ve dnech',              90),
--   (:user_id, 'LZ',   'Limit záznamů pro mazání nebo zápis do tabulek', 1000);


-- ── toc_pracoviste ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS toc_pracoviste (
    id               BIGSERIAL PRIMARY KEY,
    user_id          TEXT        NOT NULL,
    id_pracoviste    TEXT        NOT NULL,        -- 25U, 37A, 568Z, 69L, 7vn3
    nazev_pracoviste TEXT        NOT NULL,
    smena_hod        NUMERIC     NOT NULL DEFAULT 8,   -- délka směny v hod.
    pocet_smen       INTEGER     NOT NULL DEFAULT 1,   -- počet směn za den
    pocet_zdroju     INTEGER     NOT NULL DEFAULT 1,   -- počet strojů/linek
    kapacita_hod     NUMERIC     GENERATED ALWAYS AS   -- denní kapacita = smena * smeny * zdroje
                       (smena_hod * pocet_smen * pocet_zdroju) STORED,
    vytizeni_ikony   INTEGER     DEFAULT NULL,    -- % vytížení pro zobrazení ikony (NULL = nezobrazovat)
    ikona_nazev      TEXT        DEFAULT NULL,    -- název souboru ikony (grinder.png…)
    aktivni          BOOLEAN     NOT NULL DEFAULT true,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, id_pracoviste)
);

COMMENT ON TABLE toc_pracoviste IS 'TOC: Číselník pracovišť (stroje, linky) s kapacitami pro kapacitní plán.';
COMMENT ON COLUMN toc_pracoviste.kapacita_hod     IS 'Denní kapacita = smena_hod × pocet_smen × pocet_zdroju (generated)';
COMMENT ON COLUMN toc_pracoviste.vytizeni_ikony   IS 'Práh vytížení v % pro zobrazení výstražné ikony (NULL = skrýt)';

-- Seed: data z Tabidoo
-- INSERT INTO toc_pracoviste (user_id, id_pracoviste, nazev_pracoviste, smena_hod, pocet_smen, pocet_zdroju, vytizeni_ikony, ikona_nazev) VALUES
--   (:user_id, '25U',  'Brusky',     10, 1, 1, 94,   'grinder.png'),
--   (:user_id, '37A',  'Soustruhy',  10, 1, 1, NULL, NULL),
--   (:user_id, '568Z', 'Ohyb',       10, 1, 1, NULL, NULL),
--   (:user_id, '69L',  'Laser',      10, 1, 1, 100,  NULL),
--   (:user_id, '7vn3', 'Svařování',  10, 1, 1, NULL, NULL);


-- ── Indexy ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_toc_parametry_user    ON toc_parametry (user_id);
CREATE INDEX IF NOT EXISTS idx_toc_pracoviste_user   ON toc_pracoviste (user_id);
CREATE INDEX IF NOT EXISTS idx_toc_pracoviste_aktivni ON toc_pracoviste (user_id, aktivni);


-- ── RLS (až po spuštění 20260429_enable_rls.sql) ─────────
-- ALTER TABLE toc_parametry  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE toc_pracoviste ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY toc_parametry_own  ON toc_parametry  USING (user_id = auth.uid()::text);
-- CREATE POLICY toc_pracoviste_own ON toc_pracoviste USING (user_id = auth.uid()::text);
