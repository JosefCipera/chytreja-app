-- ─────────────────────────────────────────────────────────────
-- TOC: Seed zakázek + pracoviště + parametry
-- user_id: qE09cLyXXGRBRxOBCGNZqTM2XRW2
-- Termíny posunuty +16 měsíců od původních Tabidoo dat
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  uid  TEXT     := 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
  offs INTERVAL := INTERVAL '16 months';
BEGIN

-- ── Parametry ─────────────────────────────────────────────────
INSERT INTO toc_parametry (user_id, id_parametru, parametr, hodnota)
VALUES
  (uid, 'LV',   'Limit vytížení kapacity pracoviště v %',            90),
  (uid, 'KP',   'Počet dnů pro kapacitní plán',                      60),
  (uid, 'GD',   'Zobrazení Gantta do dneška ve dnech',              -30),
  (uid, 'GO',   'Zobrazení Gantta ode dneška ve dnech',              90),
  (uid, 'LZ',   'Limit záznamů pro mazání nebo zápis do tabulek', 1000),
  (uid, 'TEST', 'pro povely z AI',                                   20)
ON CONFLICT (user_id, id_parametru) DO UPDATE
  SET hodnota = EXCLUDED.hodnota, updated_at = now();

-- ── Pracoviště ────────────────────────────────────────────────
INSERT INTO toc_pracoviste
  (user_id, id_pracoviste, nazev_pracoviste, smena_hod, pocet_smen, pocet_zdroju, vytizeni_ikony, ikona_nazev, poradi, aktivni)
VALUES
  (uid, '25U',  'Brusky',    10, 1, 1,  94, 'grinder.png', 1, true),
  (uid, '37A',  'Soustruhy', 10, 1, 1, NULL, NULL,          2, true),
  (uid, '568Z', 'Ohyb',      10, 1, 1, NULL, NULL,          3, true),
  (uid, '69L',  'Laser',     10, 1, 1, 100,  NULL,          4, true),
  (uid, '7vn3', 'Svařování', 10, 1, 1, NULL, NULL,          5, true)
ON CONFLICT (user_id, id_pracoviste) DO UPDATE
  SET nazev_pracoviste = EXCLUDED.nazev_pracoviste,
      smena_hod        = EXCLUDED.smena_hod,
      pocet_smen       = EXCLUDED.pocet_smen,
      pocet_zdroju     = EXCLUDED.pocet_zdroju,
      vytizeni_ikony   = EXCLUDED.vytizeni_ikony,
      ikona_nazev      = EXCLUDED.ikona_nazev,
      poradi           = EXCLUDED.poradi,
      aktivni          = EXCLUDED.aktivni,
      updated_at       = now();

-- ── Zakázky ───────────────────────────────────────────────────
INSERT INTO toc_zakazky
  (user_id, id_zakazky, nazev_zakazky, typ_zakazky,
   vyrobit_ks, odvedeno_ks, termin_dodani,
   prubeznа_doba, planovane_zahajeni, planovane_ukonceni,
   stav, cas_pracoviste, casove_plneni_pct, zpozdeni_dny, kontrola_dat)
VALUES
(uid,'22OP000100000208/00001_x','22OP000100000208/00001','zakázka',2,0,DATE '2025-05-08'+offs,2,DATE '2024-10-17'+offs,DATE '2024-10-20'+offs,'plánovaná','{"1":1}',NULL,NULL,'ok'),
(uid,'22OP000100000191/00001_x','22OP000100000191/00001','zakázka',565,0,DATE '2025-04-30'+offs,17,DATE '2024-09-19'+offs,DATE '2024-10-12'+offs,'plánovaná','{}',48,8,'ok'),
(uid,'22OP000100000176/00001_x','22OP000100000176/00001','zakázka',1,0,DATE '2025-04-25'+offs,17,DATE '2024-09-12'+offs,DATE '2024-10-07'+offs,'plánovaná','{}',77,13,'ok'),
(uid,'22OP000100000149/00001_x','22OP000100000149/00001','zakázka',1,0,DATE '2025-04-17'+offs,1,DATE '2024-09-27'+offs,DATE '2024-09-29'+offs,'plánovaná','{"1":18,"2":30,"3":70,"5":110}',2100,21,'ok'),
(uid,'22OP000100000144/00003_x','22OP000100000144/00003','zakázka',1,0,DATE '2025-04-15'+offs,2,DATE '2024-09-25'+offs,DATE '2024-09-27'+offs,'plánovaná','{"2":21,"3":42,"5":25}',1150,23,'ok'),
(uid,'22OP000100000104/00001_x','22OP000100000104/00001','zakázka',1,0,DATE '2025-05-14'+offs,5,DATE '2024-10-21'+offs,DATE '2024-10-26'+offs,'plánovaná','{"1":22}',NULL,NULL,'ok'),
(uid,'22OP000100000095/00001_x','22OP000100000095/00001','zakázka',1,0,DATE '2025-04-20'+offs,5,DATE '2024-09-25'+offs,DATE '2024-10-02'+offs,'plánovaná','{}',360,18,'ok'),
(uid,'22OP000100000078/00001_x','22OP000100000078/00001','zakázka',1,0,DATE '2025-05-03'+offs,2,DATE '2024-10-11'+offs,DATE '2024-10-15'+offs,'plánovaná','{}',250,5,'ok'),
(uid,'22OP000100000066/00001_x','22OP000100000066/00001','zakázka',1,0,DATE '2025-06-29'+offs,13,DATE '2024-11-22'+offs,DATE '2024-12-11'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22OP000100000043/00001_x','22OP000100000043/00001','zakázka',1,0,DATE '2025-07-25'+offs,5,DATE '2024-12-27'+offs,DATE '2025-01-06'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22OP000100000029/00001_x','22OP000100000029/00001','zakázka',1,0,DATE '2025-06-14'+offs,22,DATE '2024-10-24'+offs,DATE '2024-11-26'+offs,'plánovaná','{"1":2}',NULL,NULL,'ok'),
(uid,'22OP000100000020/00001_x','22OP000100000020/00001','zakázka',1,0,DATE '2025-05-25'+offs,16,DATE '2024-10-14'+offs,DATE '2024-11-06'+offs,'plánovaná','{"2":9,"3":18}',NULL,NULL,'ok'),
(uid,'22OP000100000019/00002_x','22OP000100000019/00002','zakázka',122,0,DATE '2025-06-22'+offs,10,DATE '2024-11-20'+offs,DATE '2024-12-04'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22OP000100000011/00001_x','22OP000100000011/00001','zakázka',1,0,DATE '2025-05-17'+offs,15,DATE '2024-10-07'+offs,DATE '2024-10-29'+offs,'plánovaná','{"1":7}',NULL,NULL,'ok'),
(uid,'22OP000100000005/00001_x','22OP000100000005/00001','zakázka',1,0,DATE '2025-06-27'+offs,12,DATE '2024-11-21'+offs,DATE '2024-12-09'+offs,'plánovaná','{"5":75}',NULL,NULL,'ok'),
(uid,'22800397600_x','22800397600','zakázka',1,0,DATE '2025-06-01'+offs,33,DATE '2024-09-26'+offs,DATE '2024-11-13'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22800396500_x','22800396500','zakázka',1,0,DATE '2025-07-23'+offs,19,DATE '2024-12-04'+offs,DATE '2025-01-04'+offs,'plánovaná','{"2":6,"3":18,"4":450}',NULL,NULL,'ok'),
(uid,'22800384900_x','22800384900','zakázka',1,0,DATE '2025-05-09'+offs,23,DATE '2024-09-18'+offs,DATE '2024-10-21'+offs,'plánovaná','{"1":1}',NULL,NULL,'ok'),
(uid,'22800372000_x','22800372000','zakázka',1,0,DATE '2025-06-08'+offs,23,DATE '2024-10-17'+offs,DATE '2024-11-20'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22800340100_x','22800340100','zakázka',1,0,DATE '2025-09-01'+offs,2,DATE '2025-02-11'+offs,DATE '2025-02-13'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22800247100_x','22800247100','zakázka',560,0,DATE '2025-05-06'+offs,18,DATE '2024-09-24'+offs,DATE '2024-10-18'+offs,'plánovaná','{"1":22540}',12,2,'ok'),
(uid,'22800233100_x','22800233100','zakázka',1,0,DATE '2025-06-03'+offs,14,DATE '2024-10-25'+offs,DATE '2024-11-15'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22600007202_x','22600007202','zakázka',1,0,DATE '2025-07-09'+offs,4,DATE '2024-12-17'+offs,DATE '2024-12-21'+offs,'plánovaná','{"1":1}',NULL,NULL,'ok'),
(uid,'22500060200_x','22500060200','zakázka',1,0,DATE '2025-09-06'+offs,24,DATE '2025-01-15'+offs,DATE '2025-02-18'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22500029400_x','22500029400','zakázka',1,0,DATE '2025-06-13'+offs,10,DATE '2024-11-11'+offs,DATE '2024-11-25'+offs,'plánovaná','{"3":20}',NULL,NULL,'ok'),
(uid,'22300855900_x','22300855900','zakázka',1,0,DATE '2025-05-09'+offs,28,DATE '2024-09-11'+offs,DATE '2024-10-21'+offs,'plánovaná','{"1":1,"2":7,"3":19}',NULL,NULL,'ok'),
(uid,'22300789000_x','22300789000','zakázka',1,0,DATE '2025-06-16'+offs,16,DATE '2024-11-06'+offs,DATE '2024-11-28'+offs,'plánovaná','{"1":5}',NULL,NULL,'ok'),
(uid,'22300756800_x','22300756800','zakázka',1,0,DATE '2025-07-15'+offs,37,DATE '2024-11-01'+offs,DATE '2024-12-27'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22300722800_x','22300722800','zakázka',1,0,DATE '2025-06-16'+offs,36,DATE '2024-10-08'+offs,DATE '2024-11-28'+offs,'plánovaná','{"1":1,"2":55,"5":105}',NULL,NULL,'ok'),
(uid,'22300641900_x','22300641900','zakázka',130,0,DATE '2025-08-07'+offs,40,DATE '2024-11-19'+offs,DATE '2025-01-19'+offs,'plánovaná','{"1":468,"2":1040}',NULL,NULL,'ok'),
(uid,'22300515800_x','22300515800','zakázka',1,0,DATE '2025-09-14'+offs,37,DATE '2025-01-06'+offs,DATE '2025-02-26'+offs,'plánovaná','{"1":3}',NULL,NULL,'ok'),
(uid,'22300347700_x','22300347700','zakázka',1,0,DATE '2025-09-30'+offs,57,DATE '2024-12-19'+offs,DATE '2025-03-14'+offs,'plánovaná','{"1":4,"5":7}',NULL,NULL,'ok'),
(uid,'22200052400_x','22200052400','zakázka',1,0,DATE '2025-10-28'+offs,31,DATE '2025-02-25'+offs,DATE '2025-04-11'+offs,'plánovaná','{"1":1,"2":102,"3":305,"4":450}',NULL,NULL,'ok'),
(uid,'22101732400_x','22101732400','zakázka',1,0,DATE '2025-06-16'+offs,9,DATE '2024-11-15'+offs,DATE '2024-11-28'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22101731900_x','22101731900','zakázka',220,11,DATE '2025-07-08'+offs,25,DATE '2024-11-15'+offs,DATE '2024-12-20'+offs,'plánovaná','{"1":63}',NULL,NULL,'ok'),
(uid,'22101709600_x','22101709600','zakázka',1,0,DATE '2025-05-17'+offs,36,DATE '2024-09-06'+offs,DATE '2024-10-29'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22101682300_x','22101682300','zakázka',1,0,DATE '2025-01-17'+offs,10,DATE '2024-06-17'+offs,DATE '2024-07-01'+offs,'plánovaná','{}',1110,111,'ok'),
(uid,'22101681500_x','22101681500','zakázka',1,0,DATE '2025-07-17'+offs,9,DATE '2024-12-12'+offs,DATE '2024-12-29'+offs,'plánovaná','{"2":22}',NULL,NULL,'ok'),
(uid,'22101674100_x','22101674100','zakázka',1,0,DATE '2025-04-12'+offs,12,DATE '2024-09-06'+offs,DATE '2024-09-24'+offs,'plánovaná','{"1":55}',217,26,'ok'),
(uid,'22101641300_x','22101641300','zakázka',1,0,DATE '2025-05-27'+offs,18,DATE '2024-10-14'+offs,DATE '2024-11-08'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22101638800_x','22101638800','zakázka',550,0,DATE '2025-08-17'+offs,10,DATE '2025-01-15'+offs,DATE '2025-01-29'+offs,'plánovaná','{"1":12100,"2":18150,"3":27500,"4":55000,"5":250800}',NULL,NULL,'ok'),
(uid,'22101596900_x','22101596900','zakázka',1,0,DATE '2025-09-02'+offs,32,DATE '2024-12-31'+offs,DATE '2025-02-14'+offs,'plánovaná','{"1":8}',NULL,NULL,'ok'),
(uid,'22101414300_x','22101414300','zakázka',1,0,DATE '2025-09-01'+offs,24,DATE '2025-01-10'+offs,DATE '2025-02-13'+offs,'plánovaná','{"4":55}',NULL,NULL,'ok'),
(uid,'22101387200_x','22101387200','zakázka',100,5,DATE '2025-06-10'+offs,37,DATE '2024-10-01'+offs,DATE '2024-11-22'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22101216000_x','22101216000','zakázka',1,0,DATE '2025-07-09'+offs,18,DATE '2024-11-27'+offs,DATE '2024-12-21'+offs,'plánovaná','{"5":8}',NULL,NULL,'ok'),
(uid,'22100895800_x','22100895800','zakázka',1,0,DATE '2025-09-30'+offs,10,DATE '2025-02-28'+offs,DATE '2025-03-14'+offs,'plánovaná','{"2":11}',NULL,NULL,'ok'),
(uid,'22100521400_x','22100521400','zakázka',1,0,DATE '2025-04-30'+offs,19,DATE '2024-09-17'+offs,DATE '2024-10-12'+offs,'plánovaná','{}',43,8,'ok'),
(uid,'22100452302_x','22100452302','zakázka',1,0,DATE '2025-04-15'+offs,6,DATE '2024-09-19'+offs,DATE '2024-09-27'+offs,'plánovaná','{"1":12,"5":9}',384,23,'ok'),
(uid,'22100278802_x','22100278802','zakázka',1,0,DATE '2025-05-16'+offs,6,DATE '2024-10-18'+offs,DATE '2024-10-28'+offs,'plánovaná','{}',NULL,NULL,'ok'),
(uid,'22100278801_x','22100278801','zakázka',1,0,DATE '2025-04-15'+offs,7,DATE '2024-09-18'+offs,DATE '2024-09-27'+offs,'plánovaná','{"3":23}',329,23,'ok')
ON CONFLICT (user_id, id_zakazky) DO NOTHING;

RAISE NOTICE 'Seed OK — 50 zakázek + 5 pracovišť + 6 parametrů pro user_id=%', uid;
END $$;
