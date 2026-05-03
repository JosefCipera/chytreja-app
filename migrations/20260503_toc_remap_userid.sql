-- ─────────────────────────────────────────────────────────────
-- TOC: Přemapování user_id ze seed hodnoty na skutečné user_id
-- Spusť pokud data existují pod starým seed ID
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  old_uid TEXT := 'mfiTHj2yHtaw99QqHZg0y3eCSSm1';
  new_uid TEXT := 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
  n_zak   INT;
  n_prac  INT;
  n_param INT;
BEGIN

UPDATE toc_zakazky   SET user_id = new_uid WHERE user_id = old_uid;
GET DIAGNOSTICS n_zak = ROW_COUNT;

UPDATE toc_pracoviste SET user_id = new_uid WHERE user_id = old_uid;
GET DIAGNOSTICS n_prac = ROW_COUNT;

UPDATE toc_parametry  SET user_id = new_uid WHERE user_id = old_uid;
GET DIAGNOSTICS n_param = ROW_COUNT;

RAISE NOTICE 'Remap OK — zakazky: %, pracoviste: %, parametry: %', n_zak, n_prac, n_param;
END $$;
