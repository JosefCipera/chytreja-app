-- ═══════════════════════════════════════════════════════════════════════════════
-- migrations/20260828_orphan_cleanup.sql
-- Orphan UID cleanup — AUTH DELETED + seed/pilot + script fake UIDs
--
-- Live audit: 2026-08-28 15:22 UTC
-- Grand total to delete: 3 914 řádků, 20 UID, 19 user-scoped tabulek
--
-- ── PROTECTED UIDs (nikdy nesmazat) ──────────────────────────────────────────
--   qE09cLyXXGRBRxOBCGNZqTM2XRW2  Josef (current)
--   hC3B5cuxX9PZ80R4K3GSwqt2wuE3  Čiperová
--   7MeCzqiyVWh9NOR0cRJOTMMWaJj1  Kovářová
--   u58iRWcMr9bbakFMJYGFGARpi9h1  Tester 0
--   e0ZYA3auBYUh9TOOtqQPqbkIcrJ2  Kutej / Tester 1
--   QYYOtVI0kNQ7Aael9Z43NmbdvyT2  Vydra
--   YeJ2rRinKKMlyk0bmYXjyEaxfjk1  M. Jansová
--
-- ── DELETE CANDIDATE SET (20 UIDs) ───────────────────────────────────────────
-- Auth deleted:
--   vPrm5PNzLWWWhi9sSwYVbkb9FaD3  Josef old / AUTH DELETED        247 rows
-- Migration/seed orphans:
--   mfiTHj2yHtaw99QqHZg0y3eCSSm1  TOC seed / migration orphan     432 rows
--   23hbfocZN3N1hsdOEcO6Pxr7eBP2  orphan/seed identity audit     2120 rows
--   I1mSm5kI1gPN9KlaCzIjyflH46d2  orphan/seed identity audit      207 rows
--   A9XnaPRlzHgweL83HPnFqPQfwIE3  orphan/seed identity audit      317 rows
--   9QZzYeTY25aDHZN2uDl8UH0naYU2  orphan/seed identity audit      109 rows
--   eqrWXiNkuYg7uxE0RPDoraWDPbp1  orphan/seed identity audit      250 rows
--   Oi7InrMGAbNvm2X5WxquMQMbfnj1  orphan/seed identity audit       76 rows
--   sDZOLQUhBxQDqCiJMp4eXJHGqlm1  orphan/seed identity audit      145 rows
--   EyG7D1bULOYKvZamnpJ14lgpcgx1  orphan/seed identity audit        1 row
--   u0XeE5VD5kQie468ttUIVNMHk3N2  orphan/seed identity audit        1 row
-- Script fake UIDs (8 SAFE SCRIPT):
--   ping                           SCRIPT FAKE                       1 row
--   repro-zero-data-1787761378130  SCRIPT FAKE                       1 row
--   test-zdf-probe-1787761954166   SCRIPT FAKE (leaked ephemeral)    1 row
--   test_kardio_auto               SCRIPT FAKE                       1 row
--   test_kardio_contra             SCRIPT FAKE                       1 row
--   test_kardio_full               SCRIPT FAKE                       1 row
--   test_kardio_mech               SCRIPT FAKE                       1 row
--   test_kardio_min                SCRIPT FAKE                       1 row
-- Previously discovered:
--   test-audit-old-1787928440876   leaked ephemeral                  1 row
--
-- ── USER-SCOPED TABLES (19 skenovány, 11 s daty) ────────────────────────────
--   S daty:      user_health_profile, user_metrics, node_state_history,
--                daily_checkin, user_aspirations, action_assignments,
--                mission_log, user_constraints, user_profiles,
--                agent_log, toc_hlavni_plan
--   Bez dat:     handoff_sessions, user_meals, user_daily_log,
--                user_notification_schedule, toc_zakazky, toc_parametry,
--                toc_pracoviste, node_inputs
--   Vyloučeny (shared model, bez user_id):
--                aspiration_requirements, longevity_nodes, longevity_actions,
--                longevity_sources, node_riders, drug_inn_cache
--
-- ── INSTRUKCE ────────────────────────────────────────────────────────────────
--   1. Spusť PRE-AUDIT blok (před BEGIN) — ověř, že počty sedí s auditem výše.
--   2. Blok DO $$ (HARD SAFETY GUARD) zastaví s chybou při průniku PROTECTED ×
--      DELETE set — musí proběhnout bez chyby.
--   3. Spusť BEGIN...COMMIT blok — atomický, DELETE + POST-VERIFY uvnitř.
--   4. Zkontroluj, že POST-VERIFY SELECT vrátil 0 řádků.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  KROK 1: PRE-AUDIT SELECT — spusť samostatně, ověř čísla               │
-- └──────────────────────────────────────────────────────────────────────────┘

SELECT
  tbl,
  user_id,
  cnt AS rows_found
FROM (
  SELECT 'user_health_profile' AS tbl, user_id, COUNT(*) AS cnt
  FROM user_health_profile WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'user_metrics', user_id, COUNT(*)
  FROM user_metrics WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'node_state_history', user_id, COUNT(*)
  FROM node_state_history WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'daily_checkin', user_id, COUNT(*)
  FROM daily_checkin WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'user_aspirations', user_id, COUNT(*)
  FROM user_aspirations WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'action_assignments', user_id, COUNT(*)
  FROM action_assignments WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'mission_log', user_id, COUNT(*)
  FROM mission_log WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'user_constraints', user_id, COUNT(*)
  FROM user_constraints WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'user_profiles', user_id, COUNT(*)
  FROM user_profiles WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'handoff_sessions', user_id, COUNT(*)
  FROM handoff_sessions WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'agent_log', user_id, COUNT(*)
  FROM agent_log WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'user_meals', user_id, COUNT(*)
  FROM user_meals WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'user_daily_log', user_id, COUNT(*)
  FROM user_daily_log WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'user_notification_schedule', user_id, COUNT(*)
  FROM user_notification_schedule WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'toc_hlavni_plan', user_id, COUNT(*)
  FROM toc_hlavni_plan WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'toc_zakazky', user_id, COUNT(*)
  FROM toc_zakazky WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'toc_parametry', user_id, COUNT(*)
  FROM toc_parametry WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'toc_pracoviste', user_id, COUNT(*)
  FROM toc_pracoviste WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0

  UNION ALL SELECT 'node_inputs', user_id, COUNT(*)
  FROM node_inputs WHERE user_id = ANY(ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
    'test_kardio_auto','test_kardio_contra','test_kardio_full',
    'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
  ]) GROUP BY user_id HAVING COUNT(*) > 0
) sub
ORDER BY tbl, user_id;

-- Očekávané PRE-AUDIT výsledky (2026-08-28 15:22 UTC baseline):
-- agent_log         | mfiTHj2yHtaw99QqHZg0y3eCSSm1     | 22
-- agent_log         | vPrm5PNzLWWWhi9sSwYVbkb9FaD3      | 1
-- agent_log         | 23hbfocZN3N1hsdOEcO6Pxr7eBP2      | 1
-- agent_log         | I1mSm5kI1gPN9KlaCzIjyflH46d2      | 11
-- agent_log         | A9XnaPRlzHgweL83HPnFqPQfwIE3      | 3
-- agent_log         | 9QZzYeTY25aDHZN2uDl8UH0naYU2      | 1
-- action_assignments| vPrm5PNzLWWWhi9sSwYVbkb9FaD3      | 149
-- daily_checkin     | mfiTHj2yHtaw99QqHZg0y3eCSSm1      | 1
-- daily_checkin     | 23hbfocZN3N1hsdOEcO6Pxr7eBP2      | 2
-- daily_checkin     | I1mSm5kI1gPN9KlaCzIjyflH46d2      | 14
-- daily_checkin     | A9XnaPRlzHgweL83HPnFqPQfwIE3      | 1
-- mission_log       | mfiTHj2yHtaw99QqHZg0y3eCSSm1      | 17
-- mission_log       | 23hbfocZN3N1hsdOEcO6Pxr7eBP2      | 58
-- mission_log       | I1mSm5kI1gPN9KlaCzIjyflH46d2      | 17
-- mission_log       | A9XnaPRlzHgweL83HPnFqPQfwIE3      | 10
-- mission_log       | 9QZzYeTY25aDHZN2uDl8UH0naYU2      | 6
-- mission_log       | eqrWXiNkuYg7uxE0RPDoraWDPbp1      | 8
-- node_state_history| vPrm5PNzLWWWhi9sSwYVbkb9FaD3      | 39
-- node_state_history| mfiTHj2yHtaw99QqHZg0y3eCSSm1      | 309
-- node_state_history| 23hbfocZN3N1hsdOEcO6Pxr7eBP2      | 1988
-- ... (full expected output matches live audit above)
-- toc_hlavni_plan   | mfiTHj2yHtaw99QqHZg0y3eCSSm1      | 15
-- user_health_profile| vPrm5PNzLWWWhi9sSwYVbkb9FaD3     | 1
-- user_health_profile| u0XeE5VD5kQie468ttUIVNMHk3N2     | 1
-- user_health_profile| ping                              | 1
-- user_health_profile| repro-zero-data-1787761378130     | 1
-- ... (all 9 SCRIPT FAKE UIDs have exactly 1 row in user_health_profile)


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  KROK 2: HARD SAFETY GUARD — RAISE EXCEPTION při průniku PROTECTED×DEL  │
-- │  Spusť samostatně před BEGIN. Musí proběhnout bez chyby.                │
-- └──────────────────────────────────────────────────────────────────────────┘

DO $$
DECLARE
  -- Průnik chráněných a mazaných UID na úrovni řetězců (nezávisle na DB stavu).
  -- DELETE příkazy níže používají EXACTLY tento seznam — nikdo jiný nesmí být zasažen.
  v_protected TEXT[] := ARRAY[
    'qE09cLyXXGRBRxOBCGNZqTM2XRW2',  -- Josef (current)
    'hC3B5cuxX9PZ80R4K3GSwqt2wuE3',  -- Čiperová
    '7MeCzqiyVWh9NOR0cRJOTMMWaJj1',  -- Kovářová
    'u58iRWcMr9bbakFMJYGFGARpi9h1',  -- Tester 0
    'e0ZYA3auBYUh9TOOtqQPqbkIcrJ2',  -- Kutej / Tester 1
    'QYYOtVI0kNQ7Aael9Z43NmbdvyT2',  -- Vydra
    'YeJ2rRinKKMlyk0bmYXjyEaxfjk1'   -- M. Jansová
  ];
  v_delete_set TEXT[] := ARRAY[
    'vPrm5PNzLWWWhi9sSwYVbkb9FaD3',
    'mfiTHj2yHtaw99QqHZg0y3eCSSm1',
    '23hbfocZN3N1hsdOEcO6Pxr7eBP2',
    'I1mSm5kI1gPN9KlaCzIjyflH46d2',
    'A9XnaPRlzHgweL83HPnFqPQfwIE3',
    '9QZzYeTY25aDHZN2uDl8UH0naYU2',
    'eqrWXiNkuYg7uxE0RPDoraWDPbp1',
    'Oi7InrMGAbNvm2X5WxquMQMbfnj1',
    'sDZOLQUhBxQDqCiJMp4eXJHGqlm1',
    'EyG7D1bULOYKvZamnpJ14lgpcgx1',
    'u0XeE5VD5kQie468ttUIVNMHk3N2',
    'ping',
    'repro-zero-data-1787761378130',
    'test-zdf-probe-1787761954166',
    'test_kardio_auto',
    'test_kardio_contra',
    'test_kardio_full',
    'test_kardio_mech',
    'test_kardio_min',
    'test-audit-old-1787928440876'
  ];
  v_overlap TEXT[];
  v_uid TEXT;
BEGIN
  -- Najdi průnik na úrovni řetězců
  v_overlap := ARRAY(
    SELECT unnest(v_protected)
    INTERSECT
    SELECT unnest(v_delete_set)
  );

  IF array_length(v_overlap, 1) > 0 THEN
    RAISE EXCEPTION
      'HARD SAFETY ABORT: protected UID(s) found in delete set: [%] — DELETE CANCELLED',
      array_to_string(v_overlap, ', ');
  END IF;

  -- Navíc ověř DB stav: žádný protected UID nesmí mít řádky v tabulkách
  -- zároveň překrývající delete_set (redundantní, ale defensivní):
  DECLARE v_db_count INTEGER := 0; BEGIN
    SELECT COUNT(*) INTO v_db_count
    FROM user_health_profile
    WHERE user_id = ANY(v_protected) AND user_id = ANY(v_delete_set);
    IF v_db_count > 0 THEN
      RAISE EXCEPTION
        'HARD SAFETY ABORT: DB-level overlap found in user_health_profile — DELETE CANCELLED';
    END IF;
  END;

  RAISE NOTICE 'SAFETY OK — delete set is disjoint from protected set (% UIDs)', array_length(v_delete_set, 1);
END $$;


-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  KROK 3: DELETE TRANSACTION (atomická)                                  │
-- │  Spusť až po úspěšném PRE-AUDIT a SAFETY GUARD.                        │
-- └──────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- Pomocná konstanta pro čitelnost (PostgreSQL neumí DECLARE mimo funkce,
-- proto seznam UID inlinujeme v každém DELETE — viz níže).

-- user_health_profile (expected: vPrm5×1 + u0XeE5×1 + ping×1 + repro×1 +
--   test-zdf×1 + test_kardio_*×5 + test-audit-old×1 = 11 rows)
DELETE FROM user_health_profile WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 11

-- user_metrics (vPrm5×55 + mfiTH×65 + 23hbf×67 + I1mSm×65 + A9Xn×65 +
--   9QZz×60 + eqrW×60 + Oi7I×60 = 497)
DELETE FROM user_metrics WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 497

-- node_state_history (vPrm5×39 + mfiTH×309 + 23hbf×1988 + I1mSm×97 +
--   A9Xn×235 + 9QZz×39 + eqrW×179 + Oi7I×14 + sDZO×145 = 3045)
DELETE FROM node_state_history WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 3045

-- daily_checkin (mfiTH×1 + 23hbf×2 + I1mSm×14 + A9Xn×1 = 18)
DELETE FROM daily_checkin WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 18

-- user_aspirations (vPrm5×1 + mfiTH×1 + 23hbf×1 + I1mSm×1 + A9Xn×1 +
--   9QZz×1 + eqrW×1 = 7)
DELETE FROM user_aspirations WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 7

-- action_assignments (vPrm5×149)
DELETE FROM action_assignments WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 149

-- mission_log (mfiTH×17 + 23hbf×58 + I1mSm×17 + A9Xn×10 + 9QZz×6 + eqrW×8 = 116)
DELETE FROM mission_log WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 116

-- user_constraints (mfiTH×1 + 23hbf×2 + I1mSm×1 + A9Xn×1 + 9QZz×1 + eqrW×1 + Oi7I×1 = 8)
DELETE FROM user_constraints WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 8

-- user_profiles (vPrm5×1 + mfiTH×1 + 23hbf×1 + I1mSm×1 + A9Xn×1 +
--   9QZz×1 + eqrW×1 + Oi7I×1 + EyG7×1 = 9)
DELETE FROM user_profiles WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 9

-- handoff_sessions (0 rows expected — included for completeness)
DELETE FROM handoff_sessions WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- agent_log (vPrm5×1 + mfiTH×22 + 23hbf×1 + I1mSm×11 + A9Xn×3 + 9QZz×1 = 39)
DELETE FROM agent_log WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 39

-- user_meals (0 rows expected)
DELETE FROM user_meals WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- user_daily_log (0 rows expected)
DELETE FROM user_daily_log WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- user_notification_schedule (0 rows expected)
DELETE FROM user_notification_schedule WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- toc_hlavni_plan (mfiTH×15)
DELETE FROM toc_hlavni_plan WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 15

-- toc_zakazky (0 rows expected — seed migration may not have been run)
DELETE FROM toc_zakazky WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- toc_parametry (0 rows expected)
DELETE FROM toc_parametry WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- toc_pracoviste (0 rows expected)
DELETE FROM toc_pracoviste WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- node_inputs (0 rows expected — write debt was cleaned)
DELETE FROM node_inputs WHERE user_id = ANY(ARRAY[
  'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
  '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
  'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
  'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
  'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
  'u0XeE5VD5kQie468ttUIVNMHk3N2',
  'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
  'test_kardio_auto','test_kardio_contra','test_kardio_full',
  'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
]);
-- expected: 0

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  POST-VERIFY (uvnitř transakce — spustí se automaticky)                 │
-- │  Výsledek musí být prázdný. Neprázdný výsledek → automatický ROLLBACK.  │
-- └──────────────────────────────────────────────────────────────────────────┘

DO $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining FROM (
    SELECT user_id FROM user_health_profile
    WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
    UNION ALL SELECT user_id FROM user_metrics WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
    UNION ALL SELECT user_id FROM node_state_history WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
    UNION ALL SELECT user_id FROM action_assignments WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
    UNION ALL SELECT user_id FROM mission_log WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
    UNION ALL SELECT user_id FROM agent_log WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
    UNION ALL SELECT user_id FROM toc_hlavni_plan WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
    UNION ALL SELECT user_id FROM user_profiles WHERE user_id = ANY(ARRAY[
      'vPrm5PNzLWWWhi9sSwYVbkb9FaD3','mfiTHj2yHtaw99QqHZg0y3eCSSm1',
      '23hbfocZN3N1hsdOEcO6Pxr7eBP2','I1mSm5kI1gPN9KlaCzIjyflH46d2',
      'A9XnaPRlzHgweL83HPnFqPQfwIE3','9QZzYeTY25aDHZN2uDl8UH0naYU2',
      'eqrWXiNkuYg7uxE0RPDoraWDPbp1','Oi7InrMGAbNvm2X5WxquMQMbfnj1',
      'sDZOLQUhBxQDqCiJMp4eXJHGqlm1','EyG7D1bULOYKvZamnpJ14lgpcgx1',
      'u0XeE5VD5kQie468ttUIVNMHk3N2',
      'ping','repro-zero-data-1787761378130','test-zdf-probe-1787761954166',
      'test_kardio_auto','test_kardio_contra','test_kardio_full',
      'test_kardio_mech','test_kardio_min','test-audit-old-1787928440876'
    ])
  ) remaining_rows;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION
      'POST-VERIFY FAILED: % orphan row(s) still present after DELETE — ROLLING BACK',
      v_remaining;
  ELSE
    RAISE NOTICE 'POST-VERIFY OK — 0 orphan rows remain';
  END IF;
END $$;

COMMIT;
-- Pokud COMMIT selže (POST-VERIFY exception) — transakce je automaticky odvolána.
-- Výsledek v Supabase SQL Editoru musí být: "NOTICE: POST-VERIFY OK — 0 orphan rows remain"
