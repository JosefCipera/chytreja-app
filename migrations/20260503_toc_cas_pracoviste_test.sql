-- ─────────────────────────────────────────────────────────────
-- TEST: Doplnění cas_pracoviste ke 2 zakázkám bez dat
-- Poradi: 1=Brusky, 2=Soustruhy, 3=Ohyb, 4=Laser, 5=Svařování
-- Hodnoty = min/ks (minuty na jeden kus)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  uid TEXT := 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
BEGIN

-- Zakázka 22101682300 (termin 17.01.2026): Brusky + Soustruhy + Svařování
UPDATE toc_zakazky
SET cas_pracoviste = '{"1": 120, "2": 60, "5": 90}'::jsonb,
    updated_at     = now()
WHERE user_id   = uid
  AND id_zakazky = '22101682300';

-- Zakázka 22101709600 (termin 17.05.2026): Brusky + Ohyb + Laser
UPDATE toc_zakazky
SET cas_pracoviste = '{"1": 45, "3": 30, "4": 75}'::jsonb,
    updated_at     = now()
WHERE user_id   = uid
  AND id_zakazky = '22101709600';

RAISE NOTICE 'cas_pracoviste doplněno pro 2 testovací zakázky';
END $$;
