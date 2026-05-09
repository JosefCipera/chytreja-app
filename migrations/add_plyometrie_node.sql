-- add_plyometrie_node.sql
-- Přidá uzel 'plyometrie' do longevity_nodes jako 10. disciplínu Dekatlonu.
-- (Skočit a dopadnout → Plyometrie / Hustota kostí)
-- Run in Supabase SQL Editor

INSERT INTO longevity_nodes (id, label, parent, default_priority)
VALUES ('plyometrie', 'Plyometrie', 'telo', 10)
ON CONFLICT (id) DO NOTHING;

-- Přesun akcí a zdrojů z 'sila' na 'plyometrie' (disciplína-specifický obsah)
UPDATE longevity_actions
SET node_id = 'plyometrie'
WHERE id IN ('step_down', 'jump_squat', 'box_jump');

UPDATE longevity_sources
SET node_id = 'plyometrie'
WHERE node_id = 'sila'
  AND tags && ARRAY['plyometrie'];
