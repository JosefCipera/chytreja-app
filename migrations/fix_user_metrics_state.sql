-- Migration: fix_user_metrics_state.sql
-- Opraví stav (state) v user_metrics aby odpovídal current_index.
--
-- Pravidla (current_index je 0–100 škála):
--   = 0        → GRAY  (žádná data)
--   <= 40      → RED
--   <= 70      → YELLOW
--   > 70       → GREEN
--
-- Bezpečné: UPDATE pouze state, nedotýká se current_index ani jiných sloupců.
-- Přidá trigger pro automatickou synchronizaci do budoucna.

-- 1. Jednorázový UPDATE — opraví existující data
UPDATE user_metrics
SET state = CASE
  WHEN current_index = 0  THEN 'GRAY'
  WHEN current_index <= 40 THEN 'RED'
  WHEN current_index <= 70 THEN 'YELLOW'
  ELSE 'GREEN'
END
WHERE state != CASE
  WHEN current_index = 0  THEN 'GRAY'
  WHEN current_index <= 40 THEN 'RED'
  WHEN current_index <= 70 THEN 'YELLOW'
  ELSE 'GREEN'
END;

-- 2. Trigger funkce — automaticky přepočítá state při INSERT nebo UPDATE current_index
CREATE OR REPLACE FUNCTION sync_user_metrics_state()
RETURNS TRIGGER AS $$
BEGIN
  NEW.state := CASE
    WHEN NEW.current_index = 0  THEN 'GRAY'
    WHEN NEW.current_index <= 40 THEN 'RED'
    WHEN NEW.current_index <= 70 THEN 'YELLOW'
    ELSE 'GREEN'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger na tabulku (DROP IF EXISTS pro idempotentnost)
DROP TRIGGER IF EXISTS trg_sync_state ON user_metrics;
CREATE TRIGGER trg_sync_state
  BEFORE INSERT OR UPDATE OF current_index
  ON user_metrics
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_metrics_state();
