-- ─────────────────────────────────────────────────────────────
-- TOC: Posun datumů zakázek o -4 měsíce (z +16 na +12 od originálu)
-- Výsledek:
--   planovane_zahajeni : 2025-06 až 2026-02  (část před 2026-05-02 = probíhají)
--   termin_dodani      : 2026-01 až 2026-10  (vše v roce 2026)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  uid TEXT := 'mfiTHj2yHtaw99QqHZg0y3eCSSm1';  -- << user_id
BEGIN

UPDATE toc_zakazky
SET
  termin_dodani       = termin_dodani       - INTERVAL '4 months',
  planovane_zahajeni  = planovane_zahajeni  - INTERVAL '4 months',
  planovane_ukonceni  = planovane_ukonceni  - INTERVAL '4 months',
  updated_at          = now()
WHERE user_id = uid;

RAISE NOTICE 'Redate OK — % zakázek aktualizováno', (SELECT count(*) FROM toc_zakazky WHERE user_id = uid);
END $$;
