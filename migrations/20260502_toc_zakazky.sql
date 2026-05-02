-- ─────────────────────────────────────────────────────────────
-- TOC: Vstupní data výroby (zakázky)
-- sourcePlan_N → cas_pracoviste JSONB {"1": min, "2": min, ...}
-- N = poradi pracoviště v toc_pracoviste
-- ─────────────────────────────────────────────────────────────

-- ── Přidej poradi do toc_pracoviste (pro mapování sourcePlan_N) ──
ALTER TABLE toc_pracoviste
    ADD COLUMN IF NOT EXISTS poradi INTEGER DEFAULT NULL;

COMMENT ON COLUMN toc_pracoviste.poradi IS
    'Pořadí pracoviště pro mapování sourcePlan_N ze vstupních dat (1–N)';

-- Seed pořadí dle exportu Tabidoo:
-- UPDATE toc_pracoviste SET poradi = 1 WHERE id_pracoviste = '25U';   -- Brusky
-- UPDATE toc_pracoviste SET poradi = 2 WHERE id_pracoviste = '37A';   -- Soustruhy
-- UPDATE toc_pracoviste SET poradi = 3 WHERE id_pracoviste = '568Z';  -- Ohyb
-- UPDATE toc_pracoviste SET poradi = 4 WHERE id_pracoviste = '69L';   -- Laser
-- UPDATE toc_pracoviste SET poradi = 5 WHERE id_pracoviste = '7vn3';  -- Svařování


-- ── toc_zakazky ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS toc_zakazky (
    id                  BIGSERIAL    PRIMARY KEY,
    user_id             TEXT         NOT NULL,
    id_zakazky          TEXT         NOT NULL,        -- 22OP000100000208/00001_x
    nazev_zakazky       TEXT         NOT NULL,        -- čitelný název (bez _x)
    typ_zakazky         TEXT         NOT NULL DEFAULT 'zakázka',  -- zakázka | forecast
    vyrobit_ks          NUMERIC      NOT NULL DEFAULT 0,
    odvedeno_ks         NUMERIC      NOT NULL DEFAULT 0,
    termin_dodani       DATE         NOT NULL,
    prubeznа_doba       INTEGER      DEFAULT NULL,    -- průběžná doba ve dnech
    planovane_zahajeni  DATE         DEFAULT NULL,
    planovane_ukonceni  DATE         DEFAULT NULL,
    stav                TEXT         NOT NULL DEFAULT 'plánovaná',
    -- Časy na pracovištích: {"1": 22, "2": 30} = minuty na pracovišti s poradi=N
    cas_pracoviste      JSONB        NOT NULL DEFAULT '{}',
    -- Výsledky z předchozího plánování (nullable — plní plánovací engine)
    casove_plneni_pct   NUMERIC      DEFAULT NULL,    -- casovePlneniV
    zpozdeni_dny        INTEGER      DEFAULT NULL,
    kontrola_dat        TEXT         DEFAULT 'ok',
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (user_id, id_zakazky)
);

COMMENT ON TABLE toc_zakazky IS
    'TOC: Vstupní data výroby — zakázky a forecasty pro kapacitní plán.';
COMMENT ON COLUMN toc_zakazky.cas_pracoviste IS
    'Minuty na pracovišti dle poradi: {"1": 22, "2": 18, "5": 110}. Klíč = toc_pracoviste.poradi.';
COMMENT ON COLUMN toc_zakazky.casove_plneni_pct IS
    'Časové plnění v % — výstup předchozího plánu, ne vstup.';

-- Indexy
CREATE INDEX IF NOT EXISTS idx_toc_zakazky_user       ON toc_zakazky (user_id);
CREATE INDEX IF NOT EXISTS idx_toc_zakazky_stav       ON toc_zakazky (user_id, stav);
CREATE INDEX IF NOT EXISTS idx_toc_zakazky_termin     ON toc_zakazky (user_id, termin_dodani);
CREATE INDEX IF NOT EXISTS idx_toc_zakazky_pracoviste ON toc_zakazky USING GIN (cas_pracoviste);


-- ── RLS ──────────────────────────────────────────────────────
-- ALTER TABLE toc_zakazky ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY toc_zakazky_own ON toc_zakazky USING (user_id = auth.uid()::text);


-- ── Seed: ukázková data z Tabidoo exportu ────────────────────
-- Spusť po vložení user_id a nastavení poradi u pracovišť.
--
-- INSERT INTO toc_zakazky
--   (user_id, id_zakazky, nazev_zakazky, typ_zakazky,
--    vyrobit_ks, odvedeno_ks, termin_dodani, prubeznа_doba,
--    planovane_zahajeni, planovane_ukonceni, stav, cas_pracoviste,
--    casove_plneni_pct, zpozdeni_dny, kontrola_dat)
-- VALUES
--   (:uid, '22OP000100000208/00001_x', '22OP000100000208/00001', 'zakázka',
--    2, 0, '2025-05-08', 2, '2024-10-17', '2024-10-20', 'plánovaná',
--    '{"1": 1}', NULL, NULL, 'ok'),
--
--   (:uid, '22OP000100000149/00001_x', '22OP000100000149/00001', 'zakázka',
--    1, 0, '2025-04-17', 1, '2024-09-27', '2024-09-29', 'plánovaná',
--    '{"1": 18, "2": 30, "3": 70, "5": 110}', 2100, 21, 'ok'),
--
--   (:uid, '22101638800_x', '22101638800', 'zakázka',
--    550, 0, '2025-08-17', 10, '2025-01-15', '2025-01-29', 'plánovaná',
--    '{"1": 12100, "2": 18150, "3": 27500, "4": 55000, "5": 250800}',
--    NULL, NULL, 'ok');
-- ... (ostatní zakázky analogicky)
