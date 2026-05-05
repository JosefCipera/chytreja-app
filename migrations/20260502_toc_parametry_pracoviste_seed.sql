-- ─────────────────────────────────────────────────────────────
-- TOC: Seed — toc_parametry + toc_pracoviste
-- Před spuštěním nahraď user_id za skutečné ID
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  uid TEXT := 'mfiTHj2yHtaw99QqHZg0y3eCSSm1';   -- << sem dej user_id
BEGIN

-- ── Parametry ─────────────────────────────────────────────
INSERT INTO toc_parametry (user_id, id_parametru, parametr, hodnota)
VALUES
  (uid, 'LV',   'Limit vytížení kapacity pracoviště v %',            90),
  (uid, 'KP',   'Počet dnů pro kapacitní plán',                      60),
  (uid, 'GD',   'Zobrazení Gantta do dneška ve dnech',              -30),
  (uid, 'GO',   'Zobrazení Gantta ode dneška ve dnech',              90),
  (uid, 'GT',   'Interval tiků v Ganttově diagramu (dny: 2/3/7/10)', 3),
  (uid, 'LZ',   'Limit záznamů pro mazání nebo zápis do tabulek', 1000),
  (uid, 'TEST', 'pro povely z AI',                                   20)
ON CONFLICT (user_id, id_parametru) DO UPDATE
  SET hodnota = EXCLUDED.hodnota, updated_at = now();

-- ── Pracoviště ────────────────────────────────────────────
INSERT INTO toc_pracoviste
  (user_id, id_pracoviste, nazev_pracoviste, smena_hod, pocet_smen, pocet_zdroju, vytizeni_ikony, ikona_nazev, poradi)
VALUES
  (uid, '25U',  'Brusky',     10, 1, 1,  94, 'grinder.png', 1),
  (uid, '37A',  'Soustruhy',  10, 1, 1, NULL, NULL,          2),
  (uid, '568Z', 'Ohyb',       10, 1, 1, NULL, NULL,          3),
  (uid, '69L',  'Laser',      10, 1, 1, 100,  NULL,          4),
  (uid, '7vn3', 'Svařování',  10, 1, 1, NULL, NULL,          5)
ON CONFLICT (user_id, id_pracoviste) DO UPDATE
  SET nazev_pracoviste = EXCLUDED.nazev_pracoviste,
      smena_hod        = EXCLUDED.smena_hod,
      pocet_smen       = EXCLUDED.pocet_smen,
      pocet_zdroju     = EXCLUDED.pocet_zdroju,
      vytizeni_ikony   = EXCLUDED.vytizeni_ikony,
      ikona_nazev      = EXCLUDED.ikona_nazev,
      poradi           = EXCLUDED.poradi,
      updated_at       = now();

RAISE NOTICE 'Seed OK — parametry + pracoviste pro user_id=%', uid;
END $$;
