-- update_article_urls.sql
-- Update longevity_sources URLs to local .md files for all Decathlon articles
-- Run in Supabase SQL Editor

-- ── MOBILITA ──────────────────────────────────────────────────

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/mobilita/frc-protokol-pohyblivost.md', type = 'md'
WHERE title = 'FRC protokol: jak cvičit pohyblivost vědecky';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/mobilita/hip-flexor-a-hrudni-patere.md', type = 'md'
WHERE title = 'Hip flexor a hrudní páteř: dva klíče pohyblivosti';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/mobilita/pohyblivost-vs-stabilita.md', type = 'md'
WHERE title = 'Pohyblivost vs. stabilita: proč potřebuješ oboje';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/mobilita/ranni-kloubni-rutina.md', type = 'md'
WHERE title = 'Ranní kloubní rutina: 10 minut pro celé tělo';

-- ── STABILITA ─────────────────────────────────────────────────

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/stabilita/mcgill-big-3-zaklad-zdravych-zad.md', type = 'md'
WHERE title = 'McGill Big 3: základ zdravých zad';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/stabilita/dns-stabilita-jak-miminko.md', type = 'md'
WHERE title = 'DNS: jak trénovat stabilitu jako miminko';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/stabilita/stoj-na-jedne-noze-test-i-trenink.md', type = 'md'
WHERE title = 'Stoj na jedné noze: test i trénink v jednom';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/stabilita/core-neni-bricho.md', type = 'md'
WHERE title = 'Core není břicho: jak funguje skutečná stabilizace';

-- ── KARDIO ────────────────────────────────────────────────────

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/kardio/hrv-okno-do-srdce.md', type = 'md'
WHERE title = 'HRV: okno do tvého srdce a nervového systému';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/kardio/jak-trenovat-srdce-4-zony.md', type = 'md'
WHERE title = 'Jak trénovat srdce pro dlouhověkost: 4 zóny';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/kardio/apob-a-ldl-zdravi-srdce.md', type = 'md'
WHERE title = 'ApoB a LDL: co říká krev o zdraví srdce';

-- ── SÍLA ──────────────────────────────────────────────────────

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/farmers-carry-jeden-cvik-pro-telo.md', type = 'md'
WHERE title = 'Farmer''s carry: jeden cvik pro celé tělo';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/dead-hang-grip-sila.md', type = 'md'
WHERE title = 'Dead hang: grip síla jako prediktor dlouhověkosti';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/rdl-rumunsky-mrtvy-tah.md', type = 'md'
WHERE title = 'RDL: rumunský mrtvý tah pro zdravá záda a silné nohy';

-- ── SÍLA: OVERHEAD PRESS ──────────────────────────────────────

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/zvedni-kufr-nad-hlavu.md', type = 'md'
WHERE title = 'Zvedni kufr nad hlavu — bez bolesti, v každém věku';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/rotatorova-manzeta-zdrava-ramena.md', type = 'md'
WHERE title = 'Rotátorová manžeta: jak udržet ramena zdravá dekády';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/mobilita-ramen-hrudni-patere.md', type = 'md'
WHERE title = 'Mobilita ramen: hrudní páteř jako základ pohybu nad hlavou';

-- ── SÍLA: PLYOMETRIE ──────────────────────────────────────────

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/skoc-dopadni-plyometrie.md', type = 'md'
WHERE title = 'Skoč, dopadni, zůstaň silný — plyometrie pro kosti i reakci';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/hustota-kosti-budovat-a-zachovat.md', type = 'md'
WHERE title = 'Hustota kostí: jak ji budovat a zachovat každý den';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/sila/mekky-dopad-plyometrie-technika.md', type = 'md'
WHERE title = 'Měkký dopad: jak trénovat bezpečně výbušnou sílu';

-- ── VYTRVALOST ────────────────────────────────────────────────

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/vytrvalost/norsky-4x4-vo2max-protokol.md', type = 'md'
WHERE title = 'Norský 4×4: nejefektivnější VO2max protokol';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/vytrvalost/jak-zvysit-vo2max-plan.md', type = 'md'
WHERE title = 'Jak zvýšit VO2max: praktický plán na 12 týdnů';

UPDATE longevity_sources SET url = '/app/content/longevity/clanky/vytrvalost/zone2-v-praxi-intenzita.md', type = 'md'
WHERE title = 'Zone 2 v praxi: jak poznat správnou intenzitu';
