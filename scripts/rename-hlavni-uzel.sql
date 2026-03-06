-- Přejmenování hlavního uzlu: "Stoletý desetibojař" → "Hra o život"
-- Spustit v Supabase SQL editoru

UPDATE longevity_nodes
SET label = 'Hra o život'
WHERE id = 'dlouhovekost';

-- Ověření
SELECT id, label FROM longevity_nodes WHERE id = 'dlouhovekost';
