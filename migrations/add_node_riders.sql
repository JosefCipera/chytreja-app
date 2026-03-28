-- Migration: node_riders
-- Mapování uzlů na Attiovy 4 jezdce s prioritou (1 = největší hrozba)
-- Zdroj: Peter Attia "Outlive" — Medicine 3.0
-- Poznámka: bez FK na longevity_nodes (leaf uzly ještě nemusí existovat)

CREATE TABLE IF NOT EXISTS node_riders (
  node_id   text NOT NULL,
  rider     text NOT NULL CHECK (rider IN (
              'infarkt_a_mrtvice',
              'cukrovka',
              'demence',
              'rakovina'
            )),
  priority  int  NOT NULL DEFAULT 1,
  PRIMARY KEY (node_id, rider)
);

CREATE INDEX IF NOT EXISTS idx_node_riders_node_priority
  ON node_riders(node_id, priority);

-- ============================================================
-- SEED DATA — přiřazení dle Attii
-- Vloží jen uzly, které existují v longevity_nodes
-- ============================================================

INSERT INTO node_riders (node_id, rider, priority)
SELECT v.node_id, v.rider, v.priority::int
FROM (VALUES

  -- TELO (síla, svalová hmota, pohyblivost)
  ('telo', 'cukrovka',          '1'),
  ('telo', 'infarkt_a_mrtvice', '2'),
  ('telo', 'demence',           '3'),

  -- MYSL (pozornost, paměť, emoční zdraví)
  ('mysl', 'demence',           '1'),
  ('mysl', 'infarkt_a_mrtvice', '2'),
  ('mysl', 'cukrovka',          '3'),

  -- VYZIVA (strava, protein, energetická bilance)
  ('vyziva', 'cukrovka',          '1'),
  ('vyziva', 'infarkt_a_mrtvice', '2'),
  ('vyziva', 'rakovina',          '3'),
  ('vyziva', 'demence',           '4'),

  -- ZDRAVI (prevence, odolnost, krevní markery)
  ('zdravi', 'rakovina',          '1'),
  ('zdravi', 'infarkt_a_mrtvice', '2'),
  ('zdravi', 'cukrovka',          '3'),
  ('zdravi', 'demence',           '4'),

  -- METABOLICKE (metabolismus, inzulín, tělesná kompozice)
  ('metabolicke', 'cukrovka',          '1'),
  ('metabolicke', 'infarkt_a_mrtvice', '2'),
  ('metabolicke', 'rakovina',          '3'),
  ('metabolicke', 'demence',           '4'),

  -- SILA
  ('sila', 'infarkt_a_mrtvice', '1'),
  ('sila', 'cukrovka',          '2'),
  ('sila', 'demence',           '3'),

  -- STABILITA
  ('stabilita', 'demence',           '1'),
  ('stabilita', 'infarkt_a_mrtvice', '2'),
  ('stabilita', 'cukrovka',          '3'),

  -- KARDIO
  ('kardio', 'infarkt_a_mrtvice', '1'),
  ('kardio', 'cukrovka',          '2'),
  ('kardio', 'demence',           '3'),

  -- VO2MAX
  ('vo2max', 'infarkt_a_mrtvice', '1'),
  ('vo2max', 'cukrovka',          '2'),
  ('vo2max', 'demence',           '3'),
  ('vo2max', 'rakovina',          '4'),

  -- SPANEK
  ('spanek', 'demence',           '1'),
  ('spanek', 'infarkt_a_mrtvice', '2'),
  ('spanek', 'cukrovka',          '3'),
  ('spanek', 'rakovina',          '4'),

  -- STRES
  ('stres', 'infarkt_a_mrtvice', '1'),
  ('stres', 'cukrovka',          '2'),
  ('stres', 'demence',           '3'),

  -- PROTEIN
  ('protein', 'cukrovka',          '1'),
  ('protein', 'infarkt_a_mrtvice', '2'),
  ('protein', 'demence',           '3'),

  -- PREVENCE
  ('prevence', 'rakovina',          '1'),
  ('prevence', 'infarkt_a_mrtvice', '2'),
  ('prevence', 'cukrovka',          '3'),
  ('prevence', 'demence',           '4'),

  -- NERVOVY_SYSTEM
  ('nervovy_system', 'demence',           '1'),
  ('nervovy_system', 'infarkt_a_mrtvice', '2'),
  ('nervovy_system', 'cukrovka',          '3')

) AS v(node_id, rider, priority)
WHERE EXISTS (
  SELECT 1 FROM longevity_nodes WHERE id = v.node_id
)
ON CONFLICT (node_id, rider) DO UPDATE SET priority = EXCLUDED.priority;

-- Info: které uzly byly přeskočeny (neexistují v longevity_nodes)
SELECT v.node_id, 'CHYBÍ v longevity_nodes' AS status
FROM (VALUES
  ('telo'),('mysl'),('vyziva'),('zdravi'),('metabolicke'),
  ('sila'),('stabilita'),('kardio'),('vo2max'),('spanek'),
  ('stres'),('protein'),('prevence'),('nervovy_system')
) AS v(node_id)
WHERE NOT EXISTS (SELECT 1 FROM longevity_nodes WHERE id = v.node_id);
