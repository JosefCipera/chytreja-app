-- Dekatlon articles — placeholder URL (#), doplnit po vytvoření obsahu v Gemini
-- Spustit v Supabase SQL Editoru

INSERT INTO longevity_sources (node_id, type, title, url, summary, tags, active) VALUES

-- MOBILITA (4 články)
('mobilita', 'article', 'FRC protokol: jak cvičit pohyblivost vědecky',
 '#', 'Functional Range Conditioning podle Attii — jak systematicky rozšiřovat rozsah pohybu a proč nestačí pasivní strečink.',
 ARRAY['mobilita', 'frc', 'attia', 'dekatlon'], true),

('mobilita', 'article', 'Hip flexor a hrudní páteř: dva klíče pohyblivosti',
 '#', 'Zkrácený hip flexor a tuhá hrudní páteř jsou nejčastější brzdy pohybu ve středním věku. Jak je uvolnit.',
 ARRAY['mobilita', 'hip_flexor', 'hrudni_patere', 'dekatlon'], true),

('mobilita', 'article', 'Pohyblivost vs. stabilita: proč potřebuješ oboje',
 '#', 'Attia: mobilita bez stability je nestabilita. Jak trénovat pohyblivost tak, aby ji tělo umělo použít.',
 ARRAY['mobilita', 'stabilita', 'attia'], true),

('mobilita', 'article', 'Ranní kloubní rutina: 10 minut pro celé tělo',
 '#', 'Jednoduchý protokol pro každé ráno — kyčle, hrudník, ramena, krk. Bez vybavení, kdekoliv.',
 ARRAY['mobilita', 'rutina', 'ranni', 'dekatlon'], true),

-- STABILITA (4 články)
('stabilita', 'article', 'McGill Big 3: základ zdravých zad',
 '#', 'Tři cviky od Dr. Stuarta McGilla — bird dog, boční plank, curl-up. Základ stability páteře pro každý věk.',
 ARRAY['stabilita', 'mcgill', 'zada', 'dekatlon'], true),

('stabilita', 'article', 'DNS: jak trénovat stabilitu jako miminko',
 '#', 'Dynamic Neuromuscular Stabilization — návrat k pohybovým vzorcům, které nás učí stabilizovat tělo od základu.',
 ARRAY['stabilita', 'dns', 'dekatlon'], true),

('stabilita', 'article', 'Stoj na jedné noze: test i trénink v jednom',
 '#', 'Attia: schopnost stát 10 sekund na jedné noze předpovídá přežití. Jak ji trénovat a proč na ní záleží.',
 ARRAY['stabilita', 'rovnovaha', 'attia', 'dekatlon'], true),

('stabilita', 'article', 'Core není břicho: jak funguje skutečná stabilizace',
 '#', 'Proč planky nestačí. Intraabdominální tlak, bránice a pánevní dno jako systém — a jak ho aktivovat.',
 ARRAY['stabilita', 'core', 'bránice', 'dekatlon'], true),

-- KARDIO (3 články)
('kardio', 'article', 'HRV: okno do tvého srdce a nervového systému',
 '#', 'Heart Rate Variability jako nejdůležitější číslo pro sledování kardiovaskulálního zdraví. Co měřit a jak interpretovat.',
 ARRAY['kardio', 'hrv', 'srdce', 'attia'], true),

('kardio', 'article', 'Jak trénovat srdce pro dlouhověkost: 4 zóny',
 '#', 'Zone 2, Zone 5, VO2max tréninky — jak je rozložit v týdnu podle Attii a Andy Galpina.',
 ARRAY['kardio', 'zona2', 'vo2max', 'attia', 'galpin', 'dekatlon'], true),

('kardio', 'article', 'ApoB a LDL: co říká krev o zdraví srdce',
 '#', 'Proč ApoB je lepší marker než LDL-C. Co hledat ve výsledcích a jak výsledky interpretovat bez paniky.',
 ARRAY['kardio', 'apob', 'ldl', 'markery', 'attia'], true),

-- SILA (3 články)
('sila', 'article', 'Farmer''s carry: jeden cvik pro celé tělo',
 '#', 'Attia ho nazývá nejdůležitějším silovým cvikem. Grip, core, ramena, chůze — vše najednou. Jak začít.',
 ARRAY['sila', 'farmers_carry', 'grip', 'attia', 'dekatlon'], true),

('sila', 'article', 'Dead hang: grip síla jako prediktor dlouhověkosti',
 '#', 'Síla stisku ruky předpovídá zdraví lépe než krevní tlak. Jak trénovat dead hang od nuly.',
 ARRAY['sila', 'grip', 'dead_hang', 'attia', 'dekatlon'], true),

('sila', 'article', 'RDL: rumunský mrtvý tah pro zdravá záda a silné nohy',
 '#', 'Jeden z nejbezpečnějších a nejefektivnějších cviků pro zadní řetězec. Technika, chyby, progrese.',
 ARRAY['sila', 'rdl', 'zadni_retezec', 'dekatlon'], true),

-- VYTRVALOST (3 články)
('vytrvalost', 'article', 'Norský 4×4: nejefektivnější VO2max protokol',
 '#', 'Čtyři minuty naplno, čtyři minuty klus — čtyřikrát. Vědecky nejlépe podložený způsob jak zvýšit VO2max.',
 ARRAY['vytrvalost', 'vo2max', 'interval', 'norsky', 'dekatlon'], true),

('vytrvalost', 'article', 'Jak zvýšit VO2max: praktický plán na 12 týdnů',
 '#', 'Kombinace Zone 2 a vysoké intenzity podle Attii a San Millána. Realistický plán pro neprofesionály.',
 ARRAY['vytrvalost', 'vo2max', 'plan', 'attia', 'san_millan', 'dekatlon'], true),

('vytrvalost', 'article', 'Zone 2 v praxi: jak poznat správnou intenzitu',
 '#', 'Talk test, laktátový práh, srdeční frekvence — jak zjistit jestli jdeš správnou intenzitou bez měření laktátu.',
 ARRAY['vytrvalost', 'zona2', 'intenzita', 'attia', 'dekatlon'], true);
