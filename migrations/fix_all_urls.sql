-- fix_all_urls.sql
-- Comprehensive URL fix for longevity_sources
-- Three categories:
--   1. Missing /app/ prefix (batch fix)
--   2. PubMed URLs → local .md files
--   3. Supabase storage URLs → local .md files
-- Run in Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════════
-- 1. BATCH PREFIX FIX
--    Articles with /content/longevity/ path — missing /app/ prefix
-- ══════════════════════════════════════════════════════════════════

UPDATE longevity_sources
SET url = '/app' || url,
    type = 'md'
WHERE url LIKE '/content/longevity/%';


-- ══════════════════════════════════════════════════════════════════
-- 2. PUBMED URLS → LOCAL MD FILES
--    Articles inserted by fix_sources_and_action_tags.sql
--    (rovnovaha, spanek, stres, nervovy_system, imunitni, metabolicke)
-- ══════════════════════════════════════════════════════════════════

-- ── ROVNOVÁHA ─────────────────────────────────────────────────

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/rovnovaha/stoj-na-jedne-noze-test-i-trenink.md', type = 'md'
WHERE title = 'Stoj na jedné noze: test dlouhověkosti';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/rovnovaha/propriocepce-smysl-ktery-zachranuje-zivot.md', type = 'md'
WHERE title = 'Propriocepce: tichý smysl, který vás drží na nohou';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/rovnovaha/vestibularni-system-a-rovnovaha.md', type = 'md'
WHERE title = 'Vestibulární systém a rovnováha ve středním věku';

-- ── SPÁNEK ────────────────────────────────────────────────────

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/spanek/proc-spime-walkerova-veda.md', type = 'md'
WHERE title = 'Proč spíme: věda za Walkerovými 8 hodinami';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/spanek/spanek-deprivace-co-se-deje.md', type = 'md'
WHERE title = 'Spánková deprivace: co se děje po 24 hodinách bez spánku';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/spanek/cirkadiani-rytmus-svetlo-spanek.md', type = 'md'
WHERE title = 'Cirkadiánní rytmus: jak světlo řídí váš spánek';

-- ── STRES ─────────────────────────────────────────────────────

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/stres/allostatic-load-chronicky-stres.md', type = 'md'
WHERE title = 'Allostatic load: co dělá chronický stres s tělem';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/stres/hrv-meritko-stresu.md', type = 'md'
WHERE title = 'HRV jako měřítko stresu: co čísla říkají';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/stres/kortizol-a-dlouhovekost.md', type = 'md'
WHERE title = 'Kortizol a dlouhověkost: kdy je přítel, kdy nepřítel';

-- ── NERVOVÝ SYSTÉM ────────────────────────────────────────────

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/nervovy_system/neuroplasticita-mozek-se-meni.md', type = 'md'
WHERE title = 'Neuroplasticita: mozek se mění až do stáří';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/nervovy_system/bdnf-jak-pohyb-chrani-mozek.md', type = 'md'
WHERE title = 'BDNF: jak pohyb chrání váš mozek';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/nervovy_system/parasympatikus-regeneracni-nastroj.md', type = 'md'
WHERE title = 'Autonomní nervový systém: parasympatikus jako regenerační nástroj';

-- ── IMUNITNÍ SYSTÉM ───────────────────────────────────────────

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/imunitni/inflammaging-zanet-motor-starnuti.md', type = 'md'
WHERE title = 'Inflammaging: zánět jako motor stárnutí';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/imunitni/crp-zanetlive-markery.md', type = 'md'
WHERE title = 'CRP a hs-CRP: co říkají zánětlivé markery';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/imunitni/pohyb-a-imunita.md', type = 'md'
WHERE title = 'Pohyb a imunita: proč cvičení snižuje riziko infekcí';

-- ── METABOLISMUS ──────────────────────────────────────────────

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/metabolicke/glukozova-variabilita.md', type = 'md'
WHERE title = 'Glukózová variabilita: proč záleží na výkyvech, ne jen průměru';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/metabolicke/inzulinova-senzitivita.md', type = 'md'
WHERE title = 'Inzulinová senzitivita: základ metabolického zdraví';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/metabolicke/metabolicky-syndrom-pet-signalu.md', type = 'md'
WHERE title = 'Metabolický syndrom: pět čísel, která určují váš věk';


-- ══════════════════════════════════════════════════════════════════
-- 3. SUPABASE STORAGE URLS → LOCAL MD FILES
--    Articles pointing to Supabase storage (CORS or missing files)
-- ══════════════════════════════════════════════════════════════════

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/metabolicke/metabolicka-flexibilita.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%metabolick%flexibilita%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/sila/sila-jako-pojistka-dlouhovekosti.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%s%la%pojistka%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/sila/sarkopenie-tichy-zlodej.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%sarkopenie%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/telo/svaly-organ-dlouhovekosti.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%svaly%org%n%dlouhov%k%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/telo/sila-a-svaly-jako-pojistka.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%s%la%svaly%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/kardio/srdce-jako-sval-ktery-trenujes.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%srdce%sval%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/kardio/apob-a-ateroskleroze-co-opravdu-skodi-cevam.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%apob%aterosklero%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/metabolicke/insulinova-rezistence-koren-problemu.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%inzulinov%rezistence%ko%en%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/spanek/spanek-a-mozek-glymfatika-a-alzheimer.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND (title ILIKE '%sp%nek%mozek%' OR title ILIKE '%glymfatik%');

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/mysl/mozek-na-dlouhou-trat.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%mozek%dlouh%tr%t%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/nervovy_system/autonomni-nervovy-system-jak-ho-treovat.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%autonomn%nervo%syst%m%';

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/rovnovaha/rovnovaha-a-pad-nejvetsi-riziko-stari.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND (title ILIKE '%rovnov%ha%p%d%' OR title ILIKE '%p%d%riziko%st%r%');

UPDATE longevity_sources
SET url = '/app/content/longevity/clanky/mobilita/mobilita-neznamena-jen-strecink.md', type = 'md'
WHERE url LIKE '%supabase.co/storage/%'
  AND title ILIKE '%mobilita%neznamena%';


-- ══════════════════════════════════════════════════════════════════
-- VERIFY — run after applying to check remaining broken URLs
-- ══════════════════════════════════════════════════════════════════

-- SELECT id, node_id, type, title, LEFT(url, 60) as url_preview
-- FROM longevity_sources
-- WHERE active = true
--   AND (
--     url LIKE 'https://pubmed%'
--     OR url LIKE '%supabase.co/storage/%'
--     OR url = '#'
--   )
-- ORDER BY node_id, title;
