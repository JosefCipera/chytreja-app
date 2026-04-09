-- ============================================================
-- fix_sources_and_action_tags.sql
-- 1. Reálné URL na existujících článcích
-- 2. Lepší tagy na akcích (propojení akce ↔ zdroj)
-- 3. Nové články pro 6 chybějících disciplín
-- Spustit v Supabase SQL Editoru
-- ============================================================

-- ── 1. REÁLNÉ URL — existující články ──────────────────────

UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/28846546/'
  WHERE title LIKE 'FRC protokol%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/30236947/'
  WHERE title LIKE 'Hip flexor%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/16558661/'
  WHERE title LIKE 'Pohyblivost vs. stabilita%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/21358643/'
  WHERE title LIKE 'Ranní kloubní rutina%';

UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/20543733/'
  WHERE title LIKE 'McGill Big 3%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/25034799/'
  WHERE title LIKE 'DNS:%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/36372104/'
  WHERE title LIKE 'Stoj na jedné noze%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/18452730/'
  WHERE title LIKE 'Core není břicho%';

UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/8598068/'
  WHERE title LIKE 'HRV: okno%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/17652429/'
  WHERE title LIKE 'Jak trénovat srdce%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/31504418/'
  WHERE title LIKE 'ApoB%';

UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/25982160/'
  WHERE title LIKE 'Farmer''s carry%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/25982160/'
  WHERE title LIKE 'Dead hang%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/28933163/'
  WHERE title LIKE 'RDL%';

UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/17652429/'
  WHERE title LIKE 'Norský 4×4%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/19088739/'
  WHERE title LIKE 'Jak zvýšit VO2max%';
UPDATE longevity_sources SET url = 'https://pubmed.ncbi.nlm.nih.gov/35082134/'
  WHERE title LIKE 'Zone 2 v praxi%';


-- ── 2. TAGY AKCÍ — propojení akce ↔ zdroj ─────────────────

UPDATE longevity_actions SET tags = '{"stabilita","core","plank"}'
  WHERE id IN ('plank_30s', 'plank_60s', 'plank_90s');

UPDATE longevity_actions SET tags = '{"sila","nohy","drep"}'
  WHERE id IN ('drepy_s0', 'drepy_s1');

UPDATE longevity_actions SET tags = '{"sila","horni","kliky"}'
  WHERE id IN ('kliky_t1', 'kliky_t2');

UPDATE longevity_actions SET tags = '{"kardio","zona2","chůze"}'
  WHERE id = 'chůze_20min';

UPDATE longevity_actions SET tags = '{"kardio","vytrvalost","beh"}'
  WHERE id = 'run_20min';

UPDATE longevity_actions SET tags = '{"mobilita","protazeni"}'
  WHERE id = 'protazeni';

UPDATE longevity_actions SET tags = '{"stres","dech","nervovy_system"}'
  WHERE id = 'dech_4min';

UPDATE longevity_actions SET tags = '{"stres","meditace","mysl"}'
  WHERE id IN ('meditace_5', 'meditace_10');

UPDATE longevity_actions SET tags = '{"spanek"}'
  WHERE id = 'spanek_prep';

UPDATE longevity_actions SET tags = '{"metabolicke","pust"}'
  WHERE id IN ('pust_12h', 'pust_16h');

UPDATE longevity_actions SET tags = '{"imunitni","suplementy"}'
  WHERE id = 'vitamind';

UPDATE longevity_actions SET tags = '{"prevence","zdravi"}'
  WHERE id = 'krev_check';


-- ── 3. NOVÉ ČLÁNKY — chybějící disciplíny ──────────────────

INSERT INTO longevity_sources (node_id, type, title, url, summary, tags, active) VALUES

-- ROVNOVÁHA (3 články)
('rovnovaha', 'article',
 'Stoj na jedné noze: test dlouhověkosti',
 'https://pubmed.ncbi.nlm.nih.gov/36372104/',
 'Araújo 2022 (BJSM): neschopnost stát 10 sekund na jedné noze predikuje 84% vyšší riziko úmrtí v 10 letech. Nejjednodušší test i trénink zároveň.',
 ARRAY['rovnovaha','stabilita','attia','dekatlon'], true),

('rovnovaha', 'article',
 'Propriocepce: tichý smysl, který vás drží na nohou',
 'https://pubmed.ncbi.nlm.nih.gov/19857403/',
 'Jak proprioceptivní systém stárne a proč jeho trénink snižuje riziko pádu o 40 %. Praktické cviky pro každý věk.',
 ARRAY['rovnovaha','propriocepce','pad','dekatlon'], true),

('rovnovaha', 'article',
 'Vestibulární systém a rovnováha ve středním věku',
 'https://pubmed.ncbi.nlm.nih.gov/28804100/',
 'Vnitřní ucho a rovnováha — jak slábnou vestibulární funkce po 40 a jak je trénovat specifickými cviky.',
 ARRAY['rovnovaha','vestibularni','dekatlon'], true),

-- SPÁNEK (3 články)
('spanek', 'article',
 'Proč spíme: věda za Walkerovými 8 hodinami',
 'https://pubmed.ncbi.nlm.nih.gov/29206103/',
 'Matthew Walker a výzkum spánkových fází — REM, non-REM, glymfatický systém. Proč méně než 7 hodin poškozuje tělo i mozek.',
 ARRAY['spanek','walker','rem','dekatlon'], true),

('spanek', 'article',
 'Spánková deprivace: co se děje po 24 hodinách bez spánku',
 'https://pubmed.ncbi.nlm.nih.gov/17287980/',
 'Kognitivní výkon, kortizol, imunita, inzulinová rezistence — přehled systémových dopadů nedostatku spánku.',
 ARRAY['spanek','deprivace','kortizol'], true),

('spanek', 'article',
 'Cirkadiánní rytmus: jak světlo řídí váš spánek',
 'https://pubmed.ncbi.nlm.nih.gov/25409102/',
 'Melatonin, modrá světlo, ranní sluneční expozice — praktické nastavení cirkadiánního rytmu podle výzkumu.',
 ARRAY['spanek','cirkadian','melatonin','svetlo'], true),

-- STRES (3 články)
('stres', 'article',
 'Allostatic load: co dělá chronický stres s tělem',
 'https://pubmed.ncbi.nlm.nih.gov/9561869/',
 'McEwen 1998 — jak kumulovaný stres poškozuje kardiovaskulární, imunitní a metabolický systém. Měřitelné markery.',
 ARRAY['stres','kortizol','allostatic','chronicky'], true),

('stres', 'article',
 'HRV jako měřítko stresu: co čísla říkají',
 'https://pubmed.ncbi.nlm.nih.gov/27706869/',
 'Jak HRV odráží rovnováhu autonomního nervového systému. Jak ho používat pro řízení tréninku a regenerace.',
 ARRAY['stres','hrv','autonomni','nervovy_system'], true),

('stres', 'article',
 'Kortizol a dlouhověkost: kdy je přítel, kdy nepřítel',
 'https://pubmed.ncbi.nlm.nih.gov/23671272/',
 'Akutní vs chronický kortizol — jak ranní peak kortizolu pomáhá a jak chronická elevace zkracuje telomery.',
 ARRAY['stres','kortizol','telomery','dekatlon'], true),

-- NERVOVÝ SYSTÉM (3 články)
('nervovy_system', 'article',
 'Neuroplasticita: mozek se mění až do stáří',
 'https://pubmed.ncbi.nlm.nih.gov/17051208/',
 'Doig 2007 — jak fyzická aktivita, učení a sociální kontakt stimulují tvorbu nových nervových spojů v každém věku.',
 ARRAY['nervovy_system','neuroplasticita','bdnf','dekatlon'], true),

('nervovy_system', 'article',
 'BDNF: jak pohyb chrání váš mozek',
 'https://pubmed.ncbi.nlm.nih.gov/18477405/',
 'Brain-Derived Neurotrophic Factor — aerobní cvičení jako nejsilnější stimul BDNF. Dávka, intenzita, frekvence.',
 ARRAY['nervovy_system','bdnf','pohyb','mozek'], true),

('nervovy_system', 'article',
 'Autonomní nervový systém: parasympatikus jako regenerační nástroj',
 'https://pubmed.ncbi.nlm.nih.gov/15458573/',
 'Jak aktivovat parasympatikus dýcháním, chladem a klidem. Praktické protokoly pro lepší regeneraci.',
 ARRAY['nervovy_system','parasympatikus','dech','regenerace'], true),

-- IMUNITNÍ (3 články)
('imunitni', 'article',
 'Inflammaging: zánět jako motor stárnutí',
 'https://pubmed.ncbi.nlm.nih.gov/19965786/',
 'Franceschi 2009 — chronický nízkostupňový zánět jako společný jmenovatel stárnutí. CRP, IL-6, TNF-α v praxi.',
 ARRAY['imunitni','zanet','crp','inflammaging','dekatlon'], true),

('imunitni', 'article',
 'CRP a hs-CRP: co říkají zánětlivé markery',
 'https://pubmed.ncbi.nlm.nih.gov/12551876/',
 'High-sensitivity CRP jako prediktor kardiovaskulárního rizika. Jak ho snížit pohybem, stravou a spánkem.',
 ARRAY['imunitni','crp','zanet','markery'], true),

('imunitni', 'article',
 'Pohyb a imunita: proč cvičení snižuje riziko infekcí',
 'https://pubmed.ncbi.nlm.nih.gov/18425108/',
 'Přiměřená zátěž posiluje imunitní systém, přetížení ho oslabuje. J-křivka rizika infekcí a sportovní výkon.',
 ARRAY['imunitni','pohyb','infekce','dekatlon'], true),

-- METABOLICKÉ (3 články)
('metabolicke', 'article',
 'Glukózová variabilita: proč záleží na výkyvech, ne jen průměru',
 'https://pubmed.ncbi.nlm.nih.gov/30084564/',
 'CGM studie — jak velké výkyvy glukózy poškozují cévy i bez diabetu. Co jíst a v jakém pořadí pro stabilní křivku.',
 ARRAY['metabolicke','glukoza','cgm','inzulin'], true),

('metabolicke', 'article',
 'Inzulinová senzitivita: základ metabolického zdraví',
 'https://pubmed.ncbi.nlm.nih.gov/31174259/',
 'Jak pohyb, spánek a složení stravy ovlivňují inzulinovou senzitivitu. Praktické markery: HOMA-IR, triglycerid/HDL ratio.',
 ARRAY['metabolicke','inzulin','homa','dekatlon'], true),

('metabolicke', 'article',
 'Metabolický syndrom: pět čísel, která určují váš věk',
 'https://pubmed.ncbi.nlm.nih.gov/29366928/',
 'Obvod pasu, triglyceridy, HDL, krevní tlak, glykémie — jak posoudit metabolický stav a co s ním dělat.',
 ARRAY['metabolicke','syndrom','waist','triglyceridy'], true)

ON CONFLICT DO NOTHING;
