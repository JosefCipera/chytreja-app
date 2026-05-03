-- ─────────────────────────────────────────────────────────────
-- TEST: Simulace chybějících dat pro kontrolu dat
-- 2 zakázky bez vyrobit_ks, 3 zakázky bez termin_dodani
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  uid TEXT := 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
BEGIN

-- 2 zakázky s vyrobit_ks = 0 (chybí kusovník)
UPDATE toc_zakazky SET vyrobit_ks = 0
WHERE user_id = uid AND id_zakazky IN (
  '22OP000100000208/00001_x',
  '22800384900_x'
);

-- 3 zakázky s nulovou průběžnou dobou (NOT NULL na termin_dodani neumožní NULL)
UPDATE toc_zakazky SET prubeznа_doba = 0
WHERE user_id = uid AND id_zakazky IN (
  '22OP000100000176/00001_x',
  '22800372000_x',
  '22300789000_x'
);

RAISE NOTICE 'Test chyby nastaveny — spusť Kontrola dat v sestavě';
END $$;
