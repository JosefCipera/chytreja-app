-- ─────────────────────────────────────────────────────────────
-- TOC: toc_hlavni_plan — denní výrobní plán (Plán / Uvolněné / Předvydané)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS toc_hlavni_plan (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  datum           DATE        NOT NULL,
  plan_ks         INTEGER     NOT NULL DEFAULT 0,
  uvolnene_ks     INTEGER     NOT NULL DEFAULT 0,
  predvydane_ks   INTEGER     NOT NULL DEFAULT 0,
  poznamka        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_toc_hlavni_plan_user_datum
  ON toc_hlavni_plan (user_id, datum);

-- RLS
ALTER TABLE toc_hlavni_plan ENABLE ROW LEVEL SECURITY;

-- ── Seed: testovací data 1.5–15.5.2026 ───────────────────────────────────────
DO $$
DECLARE
  uid TEXT := 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';  -- << user_id
BEGIN
INSERT INTO toc_hlavni_plan (user_id, datum, plan_ks, uvolnene_ks, predvydane_ks)
VALUES
  (uid, '2026-05-01', 780000,  550000,  0),
  (uid, '2026-05-02', 790000,  815000,  0),
  (uid, '2026-05-03', 800000,  640000,  10000),
  (uid, '2026-05-04', 820000,  820000,  80000),
  (uid, '2026-05-05', 900000,  1050000, 430000),
  (uid, '2026-05-06', 960000,  700000,  550000),
  (uid, '2026-05-07', 1000000, 1350000, 1200000),
  (uid, '2026-05-08', 1000000, 1000000, 1000000),
  (uid, '2026-05-09', 1000000, 790000,  700000),
  (uid, '2026-05-10', 1200000, 0,       0),
  (uid, '2026-05-11', 1200000, 100000,  100000),
  (uid, '2026-05-12', 1200000, 90000,   90000),
  (uid, '2026-05-13', 1200000, 0,       0),
  (uid, '2026-05-14', 1250000, 0,       0),
  (uid, '2026-05-15', 1300000, 0,       0)
ON CONFLICT (user_id, datum) DO UPDATE
  SET plan_ks       = EXCLUDED.plan_ks,
      uvolnene_ks   = EXCLUDED.uvolnene_ks,
      predvydane_ks = EXCLUDED.predvydane_ks,
      updated_at    = now();

RAISE NOTICE 'Seed OK — toc_hlavni_plan pro user_id=%', uid;
END $$;
