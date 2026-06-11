-- Přidá constraint_node_id + constraint_label do daily_checkin
-- Dialog zjistí dnešní constraint a uloží ho sem.
-- hud-data-bulk ho pak použije jako zdroj akce místo worst leaf.
ALTER TABLE daily_checkin
  ADD COLUMN IF NOT EXISTS constraint_node_id  text,
  ADD COLUMN IF NOT EXISTS constraint_label    text;
