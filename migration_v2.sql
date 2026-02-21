-- ============================================================
-- CHJ MIGRATION v2.0
-- Multi-vesmírná architektura: universes + universe_nodes
-- Learning by Doing: step_provocation, step_action,
--                    step_reflection, step_integration
--
-- Datum:   2026-02-21
-- Projekt: Chytré Já (CHJ)
--
-- INSTRUKCE:
--   Spusť celý skript v jedné transakci (BEGIN...COMMIT).
--   Stávající tabulky (longevity_nodes apod.) NEJSOU dotčeny.
-- ============================================================

BEGIN;

-- ============================================================
-- ČÁST 1: TABULKY
-- ============================================================

CREATE TABLE IF NOT EXISTS universes (
    id          TEXT        PRIMARY KEY,
    label       TEXT        NOT NULL,
    description TEXT,
    icon        TEXT,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE universes IS 'Registr vesmírů (Longevity, TOC, Angličtina…)';

-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS universe_nodes (
    id                    TEXT        NOT NULL,
    universe_id           TEXT        NOT NULL
        REFERENCES universes(id) ON DELETE CASCADE,

    -- Zobrazení
    label                 TEXT        NOT NULL,
    icon                  TEXT,
    definition            TEXT,
    color                 TEXT,

    -- Hierarchie
    parent_id             TEXT,
    sort_order            INTEGER     NOT NULL DEFAULT 0,
    default_priority      INTEGER     NOT NULL DEFAULT 5,

    -- Learning by Doing (4 kroky)
    step_provocation      TEXT,   -- Úderný vhled
    step_action           TEXT,   -- Mikrocvičení
    step_reflection       TEXT,   -- Otázka na prožitek
    step_integration      TEXT,   -- Návyk do života

    -- Flexibilní data
    metadata              JSONB   NOT NULL DEFAULT '{}',
    cross_universe_impact JSONB   NOT NULL DEFAULT '{}',

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id, universe_id),

    -- Self-referenční FK: rodič musí být ve stejném vesmíru.
    -- DEFERRABLE umožňuje hromadný INSERT celého stromu najednou.
    FOREIGN KEY (parent_id, universe_id)
        REFERENCES universe_nodes(id, universe_id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE  universe_nodes                       IS 'Uzly všech vesmírů – generická náhrada za longevity_nodes';
COMMENT ON COLUMN universe_nodes.step_provocation      IS 'Úderný vhled – proč na tom záleží';
COMMENT ON COLUMN universe_nodes.step_action           IS 'Mikrocvičení – konkrétní akce teď';
COMMENT ON COLUMN universe_nodes.step_reflection       IS 'Otázka na prožitek';
COMMENT ON COLUMN universe_nodes.step_integration      IS 'Návyk do života';
COMMENT ON COLUMN universe_nodes.metadata              IS 'Biomarkery, metriky, related nodes, flexibilní data';
COMMENT ON COLUMN universe_nodes.cross_universe_impact IS 'Jak tento uzel ovlivňuje jiné vesmíry';

-- Indexy
CREATE INDEX IF NOT EXISTS idx_un_universe ON universe_nodes(universe_id);
CREATE INDEX IF NOT EXISTS idx_un_parent   ON universe_nodes(parent_id, universe_id);
CREATE INDEX IF NOT EXISTS idx_un_metadata ON universe_nodes USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_un_cross    ON universe_nodes USING gin(cross_universe_impact);


-- ============================================================
-- ČÁST 2: SEED – VESMÍRY (3 záznamy)
-- ============================================================

INSERT INTO universes (id, label, description, icon, sort_order) VALUES
    ('longevity', 'Dlouhověkost', 'Medicine 3.0 (Attia) – strategie pro dlouhý a kvalitní život', '🧬', 1),
    ('english',   'Angličtina',   'Angličtina metodou Learning by Doing',                         '🇬🇧', 2),
    ('toc',       'TOC',          'Theory of Constraints – řízení přes systémové úzké místo',     '🔗', 3)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- ČÁST 3: MIGRACE LONGEVITY UZLŮ (39 uzlů)
--
-- Pořadí INSERT: úroveň 0 → 1 → 2 → 3 (rodiče před dětmi).
-- FK kontrola proběhne až při COMMIT (DEFERRABLE).
-- ============================================================

INSERT INTO universe_nodes
    (id, universe_id, label, icon, definition, color,
     parent_id, sort_order, default_priority,
     step_provocation, step_action, step_reflection, step_integration,
     metadata)
VALUES

-- ── ÚROVEŇ 0 – KOŘEN ─────────────────────────────────────────

('dlouhovekost', 'longevity',
 'Dlouhověkost', '🧬',
 'Dlouhověkost není jen o délce života, ale o jeho kvalitě. Je to strategie, jak řídit zdraví, tělo, mysl a výživu tak, abychom byli funkční, silní a duševně odolní i ve vyšším věku.',
 '#2563eb', NULL, 1, 5,
 'Průměrný člověk stráví poslední desetiletí v nemoci. Ty ses rozhodl jinak.',
 'Napiš tři věci, které chceš dělat v 85 letech. Zkontroluj, jestli na ně dnes trénuješ.',
 'Žiješ dnes tak, abys to mohl mít v 85?',
 'Každé ráno si připomeň jedno ze svých 85-letých přání.',
 '{"related":["zdravi","telo","mysl","vyziva"]}'),


-- ── ÚROVEŇ 1 ─────────────────────────────────────────────────

('zdravi', 'longevity',
 'Zdraví', '⚕️',
 'Zdraví je aktuální stav těla i mysli – to, co lze měřit a sledovat. Ukazuje, jak efektivně fungují návyky, spánek a trénink.',
 '#22c55e', 'dlouhovekost', 2, 5,
 'Čtyři nejčastější příčiny smrti jsou preventabilní. Tvůj životní styl rozhoduje.',
 'Zkontroluj si dnes klidový tep, krevní tlak nebo poslední krevní výsledky.',
 'Kdy jsi naposledy znal čísla svého zdraví?',
 'Jednou měsíčně si zapiš tři klíčové zdravotní ukazatele.',
 '{"related":["spanek","biomarkery","obnova","metabolicke","imunitni","nervovy_system"]}'),

('telo', 'longevity',
 'Tělo', '💪',
 'Tělo je motor dlouhověkosti. Posiluj sílu, výdrž a stabilitu – tři pilíře, které rozhodují o tom, jak budeš žít po padesátce i déle.',
 '#f59e0b', 'dlouhovekost', 3, 5,
 'Ve čtyřiceti přijdeš o 1 % svalové hmoty ročně. Ve šedesáti to pocítíš každý den.',
 'Udělej 10 dřepů, 5 kliků a 30s plank. Teď. Změř, jak se cítíš za 5 minut.',
 'Bylo to těžší nebo lehčí, než jsi čekal? Proč?',
 'Každý den alespoň 5 minut pohybu – i chůze po schodech se počítá.',
 '{"related":["sila","vytrvalost","mobilita","stabilita","rovnovaha","kardio","dychani"]}'),

('mysl', 'longevity',
 'Mysl', '🧘',
 'Psychická odolnost, klid a smysl jsou neoddělitelnou součástí dlouhověkosti. Bez zdravé mysli se žádný plán dlouhodobě neudrží.',
 '#a855f7', 'dlouhovekost', 4, 5,
 'Mozek bez tréninku stárne stejně jako sval bez pohybu. Rozptylování není odpočinek.',
 '10 minut bez telefonu, televize ani hudby. Jen seď a nechej mysl bloudit.',
 'Jak dlouho trvalo, než jsi sáhl po telefonu?',
 'Každý den 10 minut tiché přestávky – žádné vstupy, jen mysl sama se sebou.',
 '{"related":["stres","smysl","soustredeni","vdecnost","meditace","emoce","klid"]}'),

('vyziva', 'longevity',
 'Výživa', '🥗',
 'Jídlo není cíl, ale nástroj. Výživa dlouhověkosti stojí na bílkovinách, stabilní glukóze a chytrých půstech, které podporují metabolickou flexibilitu.',
 '#ef4444', 'dlouhovekost', 5, 5,
 'Průměrný Čech sní 70 kg cukru ročně. Tvůj metabolismus platí účet.',
 'Napiš vše, co jsi dnes snědl. Bez hodnocení, jen seznam. Prohlédni si ho.',
 'Byl jsi překvapen? Co bys příště udělal jinak?',
 'Jeden týden si zapisuj jídlo – ne kalorie, ale co a kdy. Uvědomění přichází ze záznamu.',
 '{"related":["pust","bilkoviny","glukoza_vyziva","mikronutrienty","hydratace","casovani_jidel"]}'),


-- ── ÚROVEŇ 2 pod ZDRAVÍ ──────────────────────────────────────

('metabolicke', 'longevity',
 'Metabolické zdraví', '🟩',
 'Glukóza, inzulin, lipidy – klíčové ukazatele efektivity metabolismu. Cílem je stabilita, ne extrémy.',
 '#4ade80', 'zdravi', 6, 5,
 '80 % dospělých má metabolicky suboptimální výsledky – a nevědí to.',
 'Po příštím jídle se 10 minut projdi. Sleduj, jak se cítíš.',
 'Cítíš po jídle energii nebo ospalost?',
 'Každý den 10 minut chůze po jídle – žaludek, mozek i cévy to ocení.',
 '{"related":["glukoza","hba1c","inzulin","tg","hdl"]}'),

('imunitni', 'longevity',
 'Imunitní rovnováha', '🛡️',
 'Vyvážená imunita chrání před infekcemi i chronickým zánětem. Sleduj CRP, WBC a regeneraci po zátěži.',
 '#22c55e', 'zdravi', 7, 5,
 'Chronický zánět zabíjí pomalu a tiše – a my ho živíme stresem, špatným jídlem a nedostatkem pohybu.',
 'Dnes si dej studenou sprchu na 30 sekund. Soustřeď se na dech.',
 'Jak reagovalo tvoje tělo? Cítil jsi odpor nebo zvědavost?',
 'Každé ráno 30s studená voda – trénink imunity i vůle.',
 '{}'),

('nervovy_system', 'longevity',
 'Nervový systém', '🧠',
 'Autonomní nervový systém řídí adaptaci – rovnováhu mezi stresem a regenerací. HRV ukazuje, jak efektivně to zvládá.',
 '#15803d', 'zdravi', 8, 5,
 'HRV pod 40 ms znamená, že tvůj nervový systém stále zpracovává včerejší stres.',
 'Teď 2 minuty: nádech 4s, výdech 6s. Nic jiného.',
 'Jak se po dechové pauze lišila tvoje pozornost?',
 'Každé ráno 2 minuty 4-6 dechu – před tím, než sáhneš po telefonu.',
 '{}'),

('spanek', 'longevity',
 'Spánek', '🌙',
 'Kvalitní spánek je základní pilíř regenerace. Ovlivňuje hormony, imunitu i psychiku.',
 '#16a34a', 'zdravi', 9, 5,
 'Spánek pod 7 hodin zvyšuje riziko obezity, demence i celé řady onemocnění. A přesto spíš méně.',
 'Dnes jdi do postele o 30 minut dříve než obvykle. Žádná obrazovka 45 minut před tím.',
 'Jak jsi se ráno cítil oproti běžnému dni?',
 'Nastav si alarm – ne na vstávání, ale na odkládání telefonu před spaním.',
 '{}'),

('biomarkery', 'longevity',
 'Biomarkery', '📊',
 'Krevní a močové ukazatele odhalují, jak tělo reaguje na výživu, regeneraci a zátěž.',
 '#15803d', 'zdravi', 10, 5,
 'Krev nezalže. Zatímco ty se cítíš ok, markery mohou ukazovat jinam.',
 'Najdi si výsledky posledního krevního testu. Vyber jednu hodnotu a zjisti, co znamená.',
 'Překvapila tě nějaká hodnota? Proč sis ji nevšiml dřív?',
 'Jednou za rok objednej kompletní krevní panel a projdi ho s lékařem i sám.',
 '{"related":["glukoza","bilirubin","leukocyty","erytrocyty","souhrn_biomarkery"]}'),

('obnova', 'longevity',
 'Obnova', '🔄',
 'Regenerace po zátěži je klíčová. Bez obnovy není růst ani adaptace.',
 '#10b981', 'zdravi', 11, 5,
 'Sval neroste při cvičení. Roste při odpočinku. Bez obnovy trénuješ naprázdno.',
 'Dnes zařaď 10 minut pasivního strečinku nebo foam rollingu po tréninku.',
 'Kolik vědomé obnovy zařazuješ versus kolik jen cvičení?',
 'Po každém tréninku 5 minut obnovy – není to slabost, je to strategie.',
 '{"related":["sila","vytrvalost","mobilita","dychani"]}'),


-- ── ÚROVEŇ 3 pod BIOMARKERY ──────────────────────────────────

('glukoza', 'longevity',
 'S_Glukóza', '🩸',
 'Hladina glukózy v krvi.',
 '#22c55e', 'biomarkery', 12, 5,
 'Glykemický výkyv po jídle trvá 2–4 hodiny. Kolik výkyvů máš za den?',
 'Sněz dnes jeden pokrm v pořadí: nejdřív zelenina, pak bílkoviny, cukry na konec.',
 'Byl jsi odpoledne soustředěný nebo ses cítil unavený?',
 'Vždy začni jídlo zeleninou – jeden zvyk, velký dopad na glukózu.',
 '{"value":5.3,"unit":"mmol/l","range":"3.6-5.6","status":"v norme","history":[{"date":"2025-09-20","value":5.7},{"date":"2025-09-27","value":5.4},{"date":"2025-10-10","value":5.2},{"date":"2025-10-25","value":5.3}]}'),

('bilirubin', 'longevity',
 'S_Bilirubin', '🧪',
 'Ukazatel funkce jater a rozkladu červených krvinek.',
 '#f97316', 'biomarkery', 13, 5,
 'Zvýšený bilirubin nebolí. Játra volají o pomoc tiše.',
 'Dnes bez alkoholu, smažených jídel a léků bez nutnosti. Den přestávky pro játra.',
 'Kdy jsi naposledy myslel na svá játra? Proč tak zřídka?',
 'Jeden den v týdnu bez alkoholu a tučných jídel – játra si pamatují.',
 '{"value":30.7,"unit":"umol/l","range":"3-20","status":"nad normu"}'),

('leukocyty', 'longevity',
 'B_Leukocyty', '🧬',
 'Počet bílých krvinek – marker zánětu nebo imunitní reakce.',
 '#f97316', 'biomarkery', 14, 5,
 'Zvýšené leukocyty znamenají, že tvůj imunitní systém bojuje. Otázka je: s čím?',
 'Zkontroluj si, kdy byl tvůj poslední krevní test. Pokud déle než rok, objednej se.',
 'Jak vnímáš svoji imunitu? Kdy jsi naposledy byl nemocný?',
 'Krevní test jednou ročně jako servis pro tvoje tělo – ne jen při nemoci.',
 '{"value":14.1,"unit":"10^9/l","range":"4-10","status":"nad normu"}'),

('erytrocyty', 'longevity',
 'U_Erytrocyty', '🩸',
 'Počet červených krvinek v moči – zvýšení může ukazovat na podráždění nebo zánět močových cest.',
 '#ef4444', 'biomarkery', 15, 5,
 'Erytrocyty v moči nejsou normální. Tělo ti posílá zprávu.',
 'Vypiš si dnes 2–3 litry vody rozložené přes celý den. Sleduj barvu moči.',
 'Piješ dost? Jak vypadala tvoje moč naposledy?',
 'Nastav si připomínku na vodu každé 2 hodiny – hydratace chrání ledviny.',
 '{"value":16,"unit":"pocet/ul","range":"0-10","status":"nad normu"}'),

('souhrn_biomarkery', 'longevity',
 'Souhrn biomarkerů', '📘',
 'Shrnutí výsledků laboratorních testů – kolik hodnot je v normě a kolik mimo.',
 '#0ea5e9', 'biomarkery', 16, 5,
 'Tři ze čtyř tvých hodnot jsou mimo normu. Tělo ti posílá jasný signál.',
 'Vyber jednu odchylku z tvých výsledků a najdi jeden konkrétní návyk, který ji ovlivňuje.',
 'Co stojí za tou odchylkou? Spánek, stres, nebo jídlo?',
 'Každý kvartál projdi biomarkery a vyber jeden návyk ke zlepšení.',
 '{"evaluation":{"celkem":4,"v_norme":1,"mimo_normu":3,"stav":"Zvysene odchylky – konzultuj zivotni styl a lekare."}}'),


-- ── ÚROVEŇ 2 pod TĚLO ────────────────────────────────────────

('sila', 'longevity',
 'Síla', '🏋️',
 'Základní schopnost těla překonávat odpor. Klíčová pro soběstačnost a prevenci pádů. Udržuj svalovou hmotu i po 50. roce života.',
 '#fbbf24', 'telo', 17, 5,
 'Pacienti s nejvyšší svalovou silou mají o 34 % nižší riziko předčasné smrti.',
 'Udělej dnes 3 série 8 dřepů s vlastní váhou. Soustřeď se na formu, ne rychlost.',
 'Cítil jsi stabilitu nebo nejistotu? Kde tě to brzdilo?',
 'Dvakrát týdně silový trénink – nemusí trvat déle než 30 minut.',
 '{}'),

('vytrvalost', 'longevity',
 'Výdrž', '🏃‍♂️',
 'Schopnost vykonávat fyzickou aktivitu delší dobu. Cíl: VO₂max v horní třetině věkového rozmezí.',
 '#f59e0b', 'telo', 18, 5,
 'VO₂max pod průměrem pro tvůj věk znamená kratší a nemocnější stáří. Je to číslo, které jde změnit.',
 '30 minut chůze v tempu, kde ještě pohodlně mluvíš. Zóna 2 – základ aerobní kapacity.',
 'Byl jsi 30 minut venku beze spěchu? Jak ses cítil?',
 'Třikrát týdně 45 minut v zóně 2 – základní investice do srdce a mozku.',
 '{}'),

('mobilita', 'longevity',
 'Mobilita', '🤸',
 'Rozsah pohybu a pružnost těla. Umožňuje bezpečný pohyb, regeneraci a výkon bez zranění.',
 '#fcd34d', 'telo', 19, 5,
 'Zkus se sednout na zem a vstát bez opory rukou. Každý rok to zvládá méně lidí po padesátce.',
 'Sedni si na zem a zkus vstát bez použití rukou. Kolikrát se ti to povedlo?',
 'Bylo to lehké nebo těžké? Co tě limitovalo – síla nebo pohyblivost?',
 'Každý den 5 minut mobility – podlaha není nepřítel, je to tréninkový nástroj.',
 '{}'),

('stabilita', 'longevity',
 'Stabilita', '🧍‍♂️',
 'Schopnost kontrolovat pohyb a udržet rovnováhu při zátěži. Klíčová pro koordinaci a prevenci pádů.',
 '#fbbf24', 'telo', 20, 5,
 'Většina lidí po padesátce padá kvůli špatné stabilitě, ne kvůli smůle.',
 'Zavři oči a stůj na jedné noze 20 sekund. Opakuj na druhé noze.',
 'Mával jsi rukama? Na které noze ti to šlo hůř?',
 'Čisti si zuby na jedné noze – každý den, dvakrát denně, bez výmluv.',
 '{}'),

('rovnovaha', 'longevity',
 'Rovnováha', '⚖️',
 'Zahrnuje propriocepci a koordinaci. Trénuj postoj, dech a spojení těla s myslí.',
 '#fbbf24', 'telo', 21, 5,
 'Rovnováha se neztratí najednou. Ztrácí se pomalu, rok od roku, pokud ji netrénuješ.',
 'Chůze po místnosti s paty za sebou (heel-to-toe), 10 kroků tam a zpět.',
 'Byl jsi překvapen, jak (ne)stabilní jsi byl? Co tě rozhodilo?',
 'Jednou týdně 5 minut cvičení rovnováhy – jedna noha, nestabilní podložka, zavřené oči.',
 '{}'),

('kardio', 'longevity',
 'Kardio a oběh', '❤️',
 'Zdraví srdce a cév – základ výdrže i regenerace. Sleduj tlak, tep, HRV a VO₂max.',
 '#f59e0b', 'telo', 22, 5,
 'Srdce je sval. Pokud ho netrénuješ, atrofuje jako každý jiný.',
 'Změř si dnes klidový tep ráno po probuzení. Zapiš si ho. Opakuj zítra.',
 'Víš, jaký je tvůj klidový tep? A co VO₂max?',
 'Každé ráno 10s měření pulsu – nejjednodušší biomarker, který máš zadarmo.',
 '{}'),

('dychani', 'longevity',
 'Dýchání', '🌬️',
 'Způsob, jakým dýcháš, ovlivňuje výkon, spánek i stres. Správné dýchání zlepšuje okysličení, regeneraci i parasympatickou rovnováhu.',
 '#fbbf24', 'telo', 23, 5,
 'Dýcháš 20 000× denně. Většina z toho špatně – ústy, mělce, rychle.',
 'Nastav časovač na 5 minut. Dýchej pouze nosem. Cíl: méně než 10 dechů za minutu.',
 'Bylo to přirozené nebo jsi bojoval? Co ti vadilo?',
 'Každý den 5 minut vědomého nosního dýchání – ráno, při chůzi, kdykoli.',
 '{"related":["nosni_dychani","dechova_koherence","butejko"],"metrics":[{"id":"resp_rate","label":"Respiracni frekvence","unit":"dechu/min","range":"8-14"},{"id":"co2_tolerance","label":"CO2 tolerance","unit":"s","range":"20-40"},{"id":"ei_ratio","label":"Pomer vydech/nadech","unit":"-","range":">=1.2"}]}'),


-- ── ÚROVEŇ 3 pod DÝCHÁNÍ ─────────────────────────────────────

('nosni_dychani', 'longevity',
 'Nosní dýchání', '👃',
 'Dýchej nosem – filtruje, ohřívá a zvlhčuje vzduch, zvyšuje hladinu CO₂ a podporuje produkci NO.',
 '#FDE68A', 'dychani', 24, 5,
 'Dýchání ústy snižuje okysličení tkání o 10–15 % a přispívá k chrápání i únavě.',
 'Dnes celý den vědomě dýchej nosem. Pokud tě přistihneš při dýchání ústy, bez soudu se vrať.',
 'Kdy bylo nejsnadnější? Kdy nejtěžší?',
 'Před spaním páska na ústa (mouth tape) – radikální, ale efektivní.',
 '{}'),

('dechova_koherence', 'longevity',
 'Dechová koherence', '〰️',
 'Pomalé rytmické dýchání (cca 6 dechů/min) pro synchronizaci srdeční a mozkové aktivity.',
 '#FEF3C7', 'dychani', 25, 5,
 'Šest dechů za minutu synchronizuje srdce, mozek i nervový systém. Přitom je to zadarmo.',
 'Nastav časovač na 5 minut. Nádech 5s, výdech 5s. Jen to.',
 'Kdy jsi přestal počítat a začal jen dýchat? Jak ses cítil?',
 'Pět minut koherentního dechu před spaním – lepší HRV, hlubší spánek.',
 '{}'),

('butejko', 'longevity',
 'Buteyko metoda', '🫁',
 'Technika zaměřená na snížení ventilace a zvýšení tolerance CO₂, která podporuje klid a rovnováhu nervového systému.',
 '#FEF08A', 'dychani', 26, 5,
 'Pokud po nádechu potřebuješ hned zase dýchat, tvůj CO₂ práh je příliš nízký.',
 'Udělej normální výdech, pak zadrž dech. Změř, po kolika sekundách cítíš první nucení nadechnout.',
 'Bylo to pod 20 sekund? To je hranice nízké CO₂ tolerance.',
 'Každý den 10× control pause – zvyšuješ CO₂ toleranci a klid nervové soustavy.',
 '{}'),


-- ── ÚROVEŇ 2 pod MYSL ────────────────────────────────────────

('stres', 'longevity',
 'Stres', '⚡',
 'Zvládání stresu je klíčové. Nejde o jeho odstranění, ale o schopnost adaptace a návratu do rovnováhy.',
 '#c084fc', 'mysl', 27, 5,
 'Chronický stres zmenšuje hippokampus a zvyšuje kortizol – rok od roku, nepozorovaně.',
 'Napiš na papír, co tě teď stresuje. Pak napiš, co s tím OPRAVDU můžeš dělat.',
 'Kolik věcí na seznamu je mimo tvoji kontrolu? Proč o nich přemýšlíš?',
 'Každý večer 2 minuty: co tě stresovalo a co s tím udělám. Psaní bije přemýšlení.',
 '{}'),

('smysl', 'longevity',
 'Smysl', '🎯',
 'Smysl dává životu směr. Když víš proč, zvládneš jakékoliv jak.',
 '#d8b4fe', 'mysl', 28, 5,
 'Lidé s jasným smyslem žijí průměrně o 7 let déle. Smysl není luxus – je to biologie.',
 'Napiš jednu větu: Dělám to, co dělám, protože... Nespěchej.',
 'Přišla věta snadno nebo jsi váhal? Co to říká o tvém smyslu?',
 'Každý týden si přečti svoji větu smyslu. Uprav ji, pokud se změnila.',
 '{}'),

('soustredeni', 'longevity',
 'Soustředění', '🎯',
 'Schopnost věnovat pozornost jedné věci určuje kvalitu práce i života. Trénuj pozornost jako sval.',
 '#c084fc', 'mysl', 29, 5,
 'Průměrný člověk vydrží soustředit se 47 minut denně. Telefon ukradl zbytek.',
 'Nastav 25minutový timer, zavři všechny záložky kromě jedné věci. Až zazvoní, zastav.',
 'Kolikrát jsi cítil nutkání přepnout? Přestal jsi nebo vydržel?',
 'Každý den jeden 25minutový blok bez přerušení – Pomodoro pro tvůj mozek.',
 '{}'),

('vdecnost', 'longevity',
 'Vděčnost', '💜',
 'Vděčnost mění biochemii mozku – snižuje úzkost, zlepšuje spánek a posiluje psychickou odolnost.',
 '#a855f7', 'mysl', 30, 5,
 'Mozek nastavený na hrozby vidí jen problémy. Vděčnost doslova přepisuje tuto optiku.',
 'Napiš teď tři konkrétní věci, za které jsi dnes vděčný. Buď konkrétní, ne obecný.',
 'Jak ses cítíš po napsání oproti před ním? Byl jsi překvapen, co tě napadlo?',
 'Každý večer 3 konkrétní vděčnosti – ne rodina, ale dcera mi dnes zavolala.',
 '{}'),

('meditace', 'longevity',
 'Meditace', '🧘‍♂️',
 'Trénink klidu a přítomnosti. Podporuje regeneraci mozku, snižuje kortizol a zvyšuje HRV.',
 '#a855f7', 'mysl', 31, 5,
 '8 týdnů meditace fyzicky mění strukturu mozku – zvětšuje prefrontální kortex a zmenšuje amygdalu.',
 'Zavři oči na 5 minut. Počítej výdechy od 1 do 10, pak znovu. Ztratíš-li se, začni od 1.',
 'Kolikrát jsi se ztratil v myšlenkách? Každý restart je trénink pozornosti.',
 'Pět minut meditace každý den – není to relaxace, je to trénink mozku.',
 '{}'),

('emoce', 'longevity',
 'Emoce', '💖',
 'Schopnost rozpoznat a zdravě zpracovat emoce je klíčem k mentální rovnováze. Nepotlačuj, pozoruj.',
 '#b794f4', 'mysl', 32, 5,
 'Potlačené emoce se uloží do těla – jako napětí, bolest, únava. Mozek nic nezapomíná.',
 'Když pocítíš silnou emoci dnes, pauzuj na 10s a pojmenuj ji: Cítím... Jen to.',
 'Bylo pojmenování emoce těžké nebo lehké? Změnilo to intenzitu pocitu?',
 'Každý večer pojmenuj 2 emoce, které jsi prožil. Žádné hodnocení, jen pozorování.',
 '{}'),

('klid', 'longevity',
 'Klid', '🌿',
 'Klid není pasivita. Je to aktivní stav bdělé rovnováhy, ve kterém tělo regeneruje a mysl se čistí.',
 '#a78bfa', 'mysl', 33, 5,
 'Klid není stav bez problémů. Je to schopnost být v klidu i s problémy.',
 'Dnes si zarezervuj 15 minut úplně sám – bez agendy. Venku, pokud lze.',
 'Bylo to příjemné nebo nepohodlné? Co se vynořilo?',
 'Každý den 15 minut samoty bez agendy – mozek ji potřebuje stejně jako tělo spánek.',
 '{}'),


-- ── ÚROVEŇ 2 pod VÝŽIVA ──────────────────────────────────────

('pust', 'longevity',
 'Půst', '⏳',
 'Půst zlepšuje metabolickou flexibilitu, autofagii a citlivost na inzulin. Nejde o hladovění, ale o řízený odpočinek metabolismu.',
 '#f87171', 'vyziva', 34, 5,
 'Každou noc půstuješ 8 hodin. Prodloužení na 12–16 hodin spustí autofagii – buněčné čištění.',
 'Zkus dnes jíst v okně 12 hodin: první jídlo ráno, poslední večer o 12 hodin později.',
 'Byl jsi večer skutečně hladový nebo jen zvyklý jíst?',
 'Každý den 12hodinový půst jako výchozí bod – přirozený rytmus pro metabolismus.',
 '{}'),

('bílkoviny', 'longevity',
 'Bílkoviny', '🥚',
 'Klíčový stavební materiál pro svaly, hormony i enzymy. Cíl: 1.6–2.2 g/kg/den, rozloženo do 3–4 jídel.',
 '#fca5a5', 'vyziva', 35, 5,
 'Průměrný člověk sní méně než 1 g bílkovin na kg váhy. Svaly se pak přirozeně ztrácí.',
 'Spočítej svoji dnešní spotřebu bílkovin. Cíl: 1,6 g krát tvoje váha v kg.',
 'Dosáhl jsi cíle? Co by bylo nejjednodušší přidat?',
 'Ke každému jídlu jedna porce bílkovin – vejce, tvaroh, maso nebo luštěniny.',
 '{}'),

('glukoza_vyziva', 'longevity',
 'Glukóza (výživa)', '🍬',
 'Stabilní hladina cukru = stabilní energie. Vyhýbej se výkyvům po jídle – sleduj, jak reaguješ na různé potraviny.',
 '#ef9a9a', 'vyziva', 36, 5,
 'Výkyv glukózy po jídle ovlivňuje tvůj mozek dalších 4 hodiny. Každý den, každé jídlo.',
 'Příští jídlo: nejprve zelenina, pak bílkoviny, nakonec sacharidy. Sleduj energii po jídle.',
 'Cítil jsi rozdíl oproti běžnému jídlu? Měl jsi po jídle energii nebo ospalost?',
 'Pořadí jídla: zelenina, bílkoviny, sacharidy. Vždy. Snižuje výkyvy glukózy o 40 %.',
 '{}'),

('mikronutrienty', 'longevity',
 'Mikronutrienty', '💊',
 'Vitaminy a minerály jsou klíčem k buněčné rovnováze. Nedostatek hořčíku, zinku či vitamínu D narušuje regeneraci.',
 '#fb7185', 'vyziva', 37, 5,
 'Nedostatek hořčíku postihuje 70 % lidí a způsobuje únavu, křeče i špatný spánek – tiše.',
 'Dnes sněz tmavou listovou zeleninu – špenát nebo kapustu. Nejjednodušší zdroj hořčíku.',
 'Kdy jsi naposledy vědomě jedl pro mikronutrienty, ne jen pro chuť nebo sytost?',
 'Každý den tmavá zelenina – špenát, kapusta nebo brokolice. Malé jídlo, velký dopad.',
 '{}'),

('hydratace', 'longevity',
 'Hydratace', '💧',
 'Voda je médium života. Nedostatek tekutin zhoršuje kognici, regeneraci i detoxikaci. Sleduj barvu moči, ne jen pocit žízně.',
 '#fca5a5', 'vyziva', 38, 5,
 'Při 2% dehydrataci klesá kognice o 20 %. A žízeň přichází až při 1–2% ztrátě.',
 'Vypij teď sklenici vody. Nastav si připomínky na každé 2 hodiny dnes.',
 'Jak často piješ proaktivně versus reaktivně – až když máš žízeň?',
 'Každé ráno hned po probuzení sklenice vody – doplníš 6–8 hodin bez příjmu tekutin.',
 '{}'),

('casovani_jidel', 'longevity',
 'Časování jídel', '⏰',
 'Načasování jídla ovlivňuje metabolismus, spánek i regeneraci. Jez větší jídla dříve a nech tělu klid před spaním.',
 '#f87171', 'vyziva', 39, 5,
 'Jíst pozdě večer přepisuje cirkadiánní rytmus – narušuje spánek, metabolismus i hormony.',
 'Dnes skonči jíst 3 hodiny před spaním. Pokud to nestihneš, all-in zítra.',
 'Byl jsi opravdu hladový večer nebo jen zvyklý jíst?',
 'Pevné okno pro jídlo: první ráno, poslední 3 hodiny před spaním.',
 '{}')

ON CONFLICT (id, universe_id) DO NOTHING;


-- ============================================================
-- ČÁST 4: OVĚŘENÍ
-- Spusť po COMMIT pro kontrolu výsledku.
-- ============================================================

-- Počty uzlů per vesmír (očekáváno: longevity = 39)
SELECT universe_id, COUNT(*) AS pocet_uzlu
FROM universe_nodes
GROUP BY universe_id
ORDER BY universe_id;

-- Kořenové uzly (parent_id IS NULL) – očekáváno: dlouhovekost
SELECT id, label, universe_id
FROM universe_nodes
WHERE parent_id IS NULL;

-- Uzly s kompletním 4-krokovým obsahem (očekáváno: 39)
SELECT COUNT(*) AS uzlu_se_4_kroky
FROM universe_nodes
WHERE universe_id      = 'longevity'
  AND step_provocation IS NOT NULL
  AND step_action      IS NOT NULL
  AND step_reflection  IS NOT NULL
  AND step_integration IS NOT NULL;

COMMIT;
