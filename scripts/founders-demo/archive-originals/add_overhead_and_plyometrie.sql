-- add_overhead_and_plyometrie.sql
-- Doplnění chybějících disciplín Dekatlonu:
--   1. Overhead press / ramena (Dát kufr do police)
--   2. Plyometrie + hustota kostí (Skočit a dopadnout)
-- Run in Supabase SQL Editor

-- ── OVERHEAD PRESS / RAMENA ───────────────────────────────────

INSERT INTO longevity_sources (node_id, type, title, url, summary, tags, script_cz, active) VALUES

('sila', 'md',
 'Zvedni kufr nad hlavu — bez bolesti, v každém věku',
 '#',
 'Overhead press jako test a trénink ramenní mobility a síly. Proč hrudní páteř rozhoduje o pohybu nad hlavou a jak bezpečně progresovat od nuly.',
 ARRAY['sila','ramena','overhead_press','hrudni_patere','dekatlon'],
 'Zvednout 10 kg nad hlavu je test, který mnoho lidí nad 50 let selže — ne kvůli síle, ale kvůli ztuhlé hrudní páteři. Overhead press trénuje deltové svaly, trapéz a stabilizaci lopatek, přičemž nutí hrudní páteř do extenze. Každý pohyb nad hlavou je zároveň mechanický stimul pro kostní denzitu páteře a ramen. Cíl pro longevity: zvednout 50 % vlastní váhy nad hlavu × 5 opakování. Začni s tyčí nebo 2–5 kg, 3 série × 8 opakování, 2× týdně.',
 true),

('sila', 'md',
 'Rotátorová manžeta: jak udržet ramena zdravá dekády',
 '#',
 'Čtyři malé svaly, které drží rameno pohromadě. Proč atrofují, jak je posilovat a proč preventivní trénink je snazší než rehabilitace.',
 ARRAY['sila','ramena','rotator','prevence','dekatlon'],
 'Rotátorová manžeta — čtyři svaly obklopující ramenní kloub — je nejčastěji zraněná oblast u lidí nad 40. Atrofuje sedavým životem a jednostrannou zátěží. Cviky jako face pull, external rotation s gumou a band pull-apart jsou základ prevence. 10 minut 2× týdně chrání ramena lépe než měsíce rehabilitace. Zdravá ramena jsou podmínka pro overhead press, ale také pro nošení, objímání a každodenní pohyb.',
 true),

('sila', 'md',
 'Mobilita ramen: hrudní páteř jako základ pohybu nad hlavou',
 '#',
 'Proč zkrácená hrudní páteř blokuje zdvih nad hlavu a jak ji uvolnit. Foam roller, rotace a wall slide jako denní rutina.',
 ARRAY['sila','ramena','mobilita','hrudni_patere','overhead_press'],
 'Hrudní páteř (T-spine) potřebuje být pohyblivá, aby šly paže plně nad hlavu bez kompenzace v bedrech nebo impingementu v rameni. Test: stůj u zdi zády, zvedni rovné paže nad hlavu — pokud se odlepí záda nebo prohneš v bedrech, mobilita hrudní páteře ti chybí. Řešení: foam roller pod hrudní páteří 2 minuty denně, rotace v sedu, wall slide. Tato rutina za 4 týdny výrazně zlepší rozsah a sníží tlak na ramena.',
 true)

ON CONFLICT DO NOTHING;

-- ── PLYOMETRIE + HUSTOTA KOSTÍ ────────────────────────────────

INSERT INTO longevity_sources (node_id, type, title, url, summary, tags, script_cz, active) VALUES

('sila', 'md',
 'Skoč, dopadni, zůstaň silný — plyometrie pro kosti i reakci',
 '#',
 'Kosti reagují na mechanický stres — bez dopadu postupně řídnou. Jak plyometrie buduje hustotu kostí a reakční sílu pro bezpečný pohyb v každém věku.',
 ARRAY['sila','plyometrie','kosti','dopad','dekatlon'],
 'Hustota kostí kulminuje kolem 30. roku a po 40 přirozeně klesá — průměrně 1 % ročně. Kardio ani plavání nestačí: kost potřebuje náraz, ne plynulý pohyb. Studie ukazují, že 10–20 skoků denně zvyšuje denzitu kyčle o 1–3 % za rok — srovnatelně s medikací, bez vedlejších účinků. Plyometrie zároveň trénuje reakční sílu — schopnost zachytit se při zakopnutí a zabránit pádu. Začni step-downem z 20 cm bedny, postupuj k jump squatu a box jumpu.',
 true),

('sila', 'md',
 'Hustota kostí: jak ji budovat a zachovat každý den',
 '#',
 'Osteogeneze a mechanický stimul — proč silový trénink s dopadem chrání kosti lépe než vápník. Praktické strategie pro každý věk.',
 ARRAY['sila','kosti','hustota','osteoporoza_prev','dekatlon'],
 'Kost je živá tkáň, která reaguje na mechanický tlak — osteoblasty budují novou kostní hmotu tam, kde cítí zatížení. Bez zátěže (ležení, plavání, sezení) kost ztrácí hustotu bez ohledu na příjem vápníku. Nejefektivnější stimuly: silový trénink, plyometrie a chůze do kopce. Vitamin D3 (2000–4000 IU denně) a vápník ze stravy jsou základ, ale bez pohybu nestačí. Klíčové oblasti: kyčel, páteř, zápěstí — právě tam dochází k pádovým zlomeninám.',
 true),

('sila', 'md',
 'Měkký dopad: jak trénovat bezpečně výbušnou sílu',
 '#',
 'Technika bezpečného dopadu je základ plyometrie. Deceleration training — jak tělo naučit absorbovat náraz a chránit kolena a kotníky.',
 ARRAY['sila','plyometrie','dopad','technika','dekatlon'],
 'Bezpečná plyometrie začíná měkkým dopadem — koleno nad špičkou, mírné pokrčení, váha na celém chodidle. Chyba začátečníků: dopad na natažené nohy nebo na prsty, což přetěžuje kolena a kotníky. Deceleration training — záměrné zpomalení po dopadu — je první krok. Postup: step-down z nízké bedny → jump squat na místě → box jump → skok stranou. Každá úroveň vyžaduje kontrolu dopadu dřív, než přidáš výšku nebo rychlost.',
 true)

ON CONFLICT DO NOTHING;

-- ── AKCE PRO OVERHEAD PRESS ───────────────────────────────────

INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags, active) VALUES

('shoulder_press_light', 'sila',
 'Tlak nad hlavu — lehký (5 kg)',
 'SILOVY_PROTOKOL', '🏋️', 'reps', NULL, 10, 1,
 ARRAY['sila','ramena','overhead_press','dekatlon'], true),

('shoulder_press_med', 'sila',
 'Tlak nad hlavu — střední (10 kg)',
 'SILOVY_PROTOKOL', '🏋️', 'reps', NULL, 8, 2,
 ARRAY['sila','ramena','overhead_press','dekatlon'], true),

('shoulder_press_heavy', 'sila',
 'Overhead press — silový (15+ kg)',
 'SILOVY_PROTOKOL', '🏋️', 'reps', NULL, 5, 3,
 ARRAY['sila','ramena','overhead_press','dekatlon'], true)

ON CONFLICT DO NOTHING;

-- ── AKCE PRO PLYOMETRII ───────────────────────────────────────

INSERT INTO longevity_actions (id, node_id, label, protocol_type, icon, type, duration, reps, tier, tags, active) VALUES

('step_down', 'sila',
 'Step-down: řízený dopad z bedny',
 'SILOVY_PROTOKOL', '🦵', 'reps', NULL, 10, 1,
 ARRAY['sila','plyometrie','kosti','dopad','dekatlon'], true),

('jump_squat', 'sila',
 'Jump squat: dřep s výskokem',
 'SILOVY_PROTOKOL', '⚡', 'reps', NULL, 8, 2,
 ARRAY['sila','plyometrie','kosti','dopad','dekatlon'], true),

('box_jump', 'sila',
 'Box jump: výskok na bednu (40 cm)',
 'SILOVY_PROTOKOL', '🚀', 'reps', NULL, 5, 3,
 ARRAY['sila','plyometrie','kosti','dopad','dekatlon'], true)

ON CONFLICT DO NOTHING;
