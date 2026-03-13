-- =====================================================
-- Seed node_state_history z user_metrics
-- Spusť v Supabase SQL editoru
-- Nahraď 'TVOJE_FIREBASE_UID' svým skutečným UID
-- =====================================================

-- 0) Ověření – co je v user_metrics pro tebe
SELECT user_id, node_id, state, current_index
FROM public.user_metrics
WHERE user_id = '23hbfocZN3N1hsdOEcO6Pxr7eBP2'
  AND universe = 'longevity'
ORDER BY node_id;

-- 1) Seed – zkopíruj aktuální stavy do node_state_history jako dnešní datum
-- Tím vzniknou data pro sparkline trend (zatím jen 1 bod = dnešek)
INSERT INTO public.node_state_history (user_id, node_id, date, state)
SELECT
  user_id,
  node_id,
  CURRENT_DATE,
  state
FROM public.user_metrics
WHERE user_id = '23hbfocZN3N1hsdOEcO6Pxr7eBP2'
  AND universe = 'longevity'
  AND state IN ('GREEN', 'YELLOW', 'RED');   -- přeskočíme GRAY

-- 2) Pro hezčí sparkline přidej i historické body (simulace posledních 2 týdnů)
-- Odkomentuj pokud chceš vidět trend ihned (jinak stačí 1 bod výše)
/*
INSERT INTO public.node_state_history (user_id, node_id, date, state)
SELECT
  m.user_id,
  m.node_id,
  CURRENT_DATE - n.offset,
  m.state
FROM public.user_metrics m
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14)) AS n(offset)
WHERE m.user_id = '23hbfocZN3N1hsdOEcO6Pxr7eBP2'
  AND m.universe = 'longevity'
  AND m.state IN ('GREEN', 'YELLOW', 'RED')
ON CONFLICT DO NOTHING;
*/

-- 3) Ověření výsledku
SELECT user_id, node_id, date, state
FROM public.node_state_history
WHERE user_id = '23hbfocZN3N1hsdOEcO6Pxr7eBP2'
ORDER BY date DESC, node_id
LIMIT 20;
