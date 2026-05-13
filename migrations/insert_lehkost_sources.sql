-- Lehkost universe — zdroje pro HUD SOURCE_VALIDATION sekci
-- Spustit v Supabase SQL Editoru

INSERT INTO longevity_sources (node_id, type, title, url, summary, journal, year, med_id, tags, active, script_cz) VALUES

-- ── LH_POHYB — Pohyb a NEAT ─────────────────────────────────────────────────

('lh_pohyb', 'article', 'NEAT: Pohyb mimo sport jako klíč ke štíhlosti',
 'https://pubmed.ncbi.nlm.nih.gov/15387473/',
 'Každodenní pohyb mimo sport — chůze, stání, domácí práce — může spálit až 2000 kcal denně navíc. Rozdíl mezi lidmi se sedavým stylem života a aktivními je obrovský, přičemž sport samotný tvoří jen malou část.',
 'Best Practice & Research Clinical Endocrinology & Metabolism', 2004, 101,
 ARRAY['lh_pohyb', 'neat', 'pohyb', 'kaloricky_vydej', 'lehkost'], true,
 E'## NEAT: Pohyb mimo sport\n\n**Non-exercise activity thermogenesis (NEAT)** je energie spotřebovaná vším kromě spánku, jídla a záměrného sportu — chůze do práce, stání, úklid, gestikulace.\n\n### Proč na NEAT záleží víc než na sportu\n\nVysokého NEAT jedinci spalují až **2000 kcal/den navíc** oproti sedavým lidem stejné hmotnosti. Hodina v posilovně přidá 300–500 kcal. NEAT přidává 300–2000 kcal každý den.\n\n### Praktické dopady\n\n- Stání místo sezení = +100–200 kcal/den\n- 10 000 kroků = +400 kcal/den\n- Aktivní práce doma = +300 kcal/den\n\nNEAT je největší proměnná v energetické bilanci, kterou máš pod kontrolou bez jediné návštěvy posilovny.\n\n**Zdroj:** Levine JA, Best Pract Res Clin Endocrinol Metab, 2004'
),

('lh_pohyb', 'article', 'Chůze a obezita: NEAT v každodenním životě',
 'https://pubmed.ncbi.nlm.nih.gov/25841254/',
 'Nízká úroveň každodenního pohybu (NEAT) je silným prediktorem obezity. Obézní lidé sedí průměrně o 2,5 hodiny denně déle než štíhlí — a tento rozdíl tvoří 350 kcal/den bez jediného cvičení.',
 'Mayo Clinic Proceedings', 2015, 102,
 ARRAY['lh_pohyb', 'neat', 'chůze', 'obezita', 'lehkost'], true,
 E'## Proč sedíš a přibíráš\n\n### Klíčové číslo\n\nObézní jedinci sedí průměrně **o 2,5 hodiny denně déle** než štíhlí. Tento jediný rozdíl představuje přibližně **350 kcal/den** — bez jakéhokoli cvičení.\n\n### Co z toho plyne\n\nNení to o disciplíně v posilovně. Je to o tom, co děláš celý zbytek dne. Stůl, auto, gauč — tři nepřátelé NEAT.\n\n### Jak to změnit\n\n1. **Stůl na stání** nebo přestávky každých 30 minut\n2. **Chůze při telefonování** místo sezení\n3. **Schody místo výtahu** — vždy\n4. **Dopolední procházka** — 10 minut před první schůzkou\n\n**Zdroj:** Villablanca PA et al., Mayo Clin Proc, 2015'
),

-- ── LH_VYZIVA — Časování jídla ───────────────────────────────────────────────

('lh_vyziva', 'article', 'Večerní jídlo zvyšuje hlad a tlumí spalování',
 'https://www.cell.com/cell-metabolism/fulltext/S1550-4131(22)00397-7',
 'Randomizovaná crossover studie ukázala, že stejné jídlo snědené večer místo dopoledne zvyšuje hlad, snižuje výdej energie a mění expresi genů v tukové tkáni ve prospěch ukládání tuku — vše bez změny kalorií.',
 'Cell Metabolism', 2022, 103,
 ARRAY['lh_vyziva', 'casovani_jidla', 'vecerni_jedeni', 'hlad', 'lehkost'], true,
 E'## Záleží kdy jíš, ne jen co jíš\n\n### Studie\n\nHarvardský tým porovnal identická jídla sněžená dopoledne vs. večer u stejných lidí (crossover design). Kalorie, složení — vše stejné. Jen čas se lišil.\n\n### Výsledky\n\n- **Hlad** byl večer o 18 % vyšší\n- **Výdej energie** byl o 4 % nižší\n- **Geny tukové tkáně** se přepnuly do režimu ukládání tuku\n- **Leptin** (hormon sytosti) klesl o 16 %\n\n### Závěr\n\nStejné kalorie snědené večer vedou k většímu ukládání tuku než stejné kalorie snědené ráno. Tělo není kalorická kalkulačka — cirkadiánní rytmus rozhoduje.\n\n**Zdroj:** Vujović N et al., Cell Metabolism, 2022'
),

('lh_vyziva', 'article', 'Čas jídla a BMI: populační studie 2024',
 'https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2825747',
 'Metaanalýza studií o časování jídla a tělesné hmotnosti potvrzuje: pozdější příjem kalorií je konzistentně spojen s vyšším BMI, přibýváním na váze a horší metabolickou odpovědí — nezávisle na celkovém kalorickém příjmu.',
 'JAMA Network Open', 2024, 104,
 ARRAY['lh_vyziva', 'casovani_jidla', 'bmi', 'chrononutrice', 'lehkost'], true,
 E'## Chrononutrice: věda o tom, kdy jíst\n\n### Co je chrononutrice\n\nVědní obor zkoumající, jak čas příjmu jídla ovlivňuje metabolismus, hormony a tělesnou hmotnost — nezávisle na tom *co* a *kolik* jíme.\n\n### Klíčová zjištění metaanalýzy (JAMA 2024)\n\n- Pozdní příjem kalorií = **vyšší BMI** napříč populacemi\n- Efekt je nezávislý na celkovém kalorickém příjmu\n- Největší dopad má přesun hlavního jídla z večera na dopoledne\n\n### Praktické pravidlo\n\n**80 % kalorií do 15:00.** Večeře jako nejlehčí jídlo dne.\n\n**Zdroj:** Litwin R et al., JAMA Network Open, 2024'
),

-- ── LH_MYSL — Stres a jídlo ─────────────────────────────────────────────────

('lh_mysl', 'article', 'Kortizol a přejídání: jak stres způsobuje obezitu',
 'https://pubmed.ncbi.nlm.nih.gov/27345309/',
 'Chronický stres zvyšuje kortizol, který přímo stimuluje chuť k jídlu, preferenci kaloricky bohatých potravin a ukládání viscerálního tuku. Lidé s vyšší kortizolovou reaktivitou na stres mají statisticky vyšší BMI.',
 'Obesity Reviews', 2016, 105,
 ARRAY['lh_mysl', 'kortizol', 'stres', 'stresove_jedeni', 'lehkost'], true,
 E'## Stres tě tloustí — doslova\n\n### Mechanismus\n\nKortizol (stresový hormon) při chronickém stresu:\n\n1. **Zvyšuje hlad** — aktivuje receptory v hypotalamu\n2. **Preferuje sladké a tučné** — jako rychlý zdroj energie\n3. **Ukládá tuk na břiše** — viscerální tuk má více kortizolových receptorů\n4. **Brzdí spalování** — tělo šetří energii pro "nebezpečí"\n\n### Čísla\n\nLidé s vysokou kortizolovou reaktivitou snědí při stresu průměrně o **22 % více kalorií** než lidé s nízkou reaktivitou.\n\n### Co pomáhá\n\n- 5 minut klidného dýchání před jídlem sníží kortizol o 15 %\n- Pravidelný spánek stabilizuje kortizol přes den\n- Krátká procházka po jídle snižuje kortizolový spike\n\n**Zdroj:** Razzoli M, Bartolomucci A. Obesity Reviews, 2016'
),

('lh_mysl', 'article', 'Emoční přejídání: 49denní longitudinální studie',
 'https://pubmed.ncbi.nlm.nih.gov/37650340/',
 'Studie sledovala ženy 49 dní a prokázala přímou kauzální vazbu: ve dnech s vyšším stresem ženy konzumovaly více — a efekt byl silnější u těch, které trpěly chronickým stresem. Emoce a jídlo jsou propojeny těsněji, než se čekalo.',
 'Psychological Medicine', 2023, 106,
 ARRAY['lh_mysl', 'emocni_jedeni', 'stres', 'longitudinalni', 'lehkost'], true,
 E'## Proč jíš víc ve stresových dnech\n\n### Studie\n\n49 dní, deník nálad a jídla každý den. Výsledek: **stresové dny = více kalorií**, konzistentně, u většiny žen.\n\n### Dva typy stresu\n\n**Chronický stres** (vždy napjatý) → jíš trvale více\n**Akutní stres** (nárazový) → jíš více jen v ten den\n\nNejhorší kombinace: chronicky stresovaný člověk v akutně stresový den.\n\n### Jak přerušit smyčku\n\n1. **Identifikuj spouštěč** — uvědomit si "jsem teď ve stresu" je první krok\n2. **Odlož jídlo o 10 minut** — stresový impulz k jídlu obvykle odezní\n3. **Fyzická aktivita** — 10 minut chůze sníží kortizol rychleji než jídlo\n\n**Zdroj:** Reichenberger J et al., Psychological Medicine, 2023'
),

-- ── LH_REGENERACE — Spánek ──────────────────────────────────────────────────

('lh_regenerace', 'article', 'Nedostatek spánku zvyšuje ghrelin a snižuje leptin',
 'https://pubmed.ncbi.nlm.nih.gov/15602591/',
 'Průkopnická studie: zkrácení spánku pod 8 hodin statisticky snižuje leptin (hormon sytosti) a zvyšuje ghrelin (hormon hladu) — a to přímo úměrně délce spánkového deficitu. Spánkový deficit je hormonální porucha chuti k jídlu.',
 'PLOS Medicine', 2004, 107,
 ARRAY['lh_regenerace', 'spanek', 'ghrelin', 'leptin', 'hlad', 'lehkost'], true,
 E'## Spíš méně → jíš více\n\n### Hormony hladu a sytosti\n\n- **Leptin** = hormon sytosti (říká mozku "dost")\n- **Ghrelin** = hormon hladu (říká mozku "ještě")\n\n### Co se stane po krátké noci\n\nPo 6 hodinách spánku vs. 8 hodin:\n- Leptin klesá o **18 %**\n- Ghrelin stoupá o **28 %**\n- Hlad roste o **24 %**\n- Chuť na sladké a slané stoupá o **33 %**\n\n### Vicious cycle\n\nKrátký spánek → více hladu → více jídla → přírůstek hmotnosti → horší spánek\n\n### Praktické číslo\n\nKaždá hodina spánkového deficitu za týden = přibližně +200 kcal/den navíc bez pocitu sytosti.\n\n**Zdroj:** Taheri S et al., PLOS Medicine, 2004'
),

('lh_regenerace', 'article', 'Spánek a obezita: přehled v Nature Reviews 2022',
 'https://www.nature.com/articles/s41574-022-00747-7',
 'Komplexní přehled mechanismů propojujících nedostatečný spánek a cirkadiánní desynchronizaci s obezitou. Zahrnuje dopady na energetický výdej, příjem potravy, pohybovou aktivitu i hormonální regulaci tělesné hmotnosti.',
 'Nature Reviews Endocrinology', 2022, 108,
 ARRAY['lh_regenerace', 'spanek', 'obezita', 'cirkadianní', 'metabolismus', 'lehkost'], true,
 E'## Spánek jako metabolický regulátor\n\n### Proč spánek ovlivňuje váhu víc, než si myslíš\n\nNature Reviews shrnuje čtyři kanály, kterými nedostatečný spánek vede k obezitě:\n\n1. **Hormonální** — ghrelin ↑, leptin ↓, inzulin ↑\n2. **Behaviorální** — více času bdění = více příležitostí k jídlu\n3. **Energetický výdej** — unavené tělo se méně hýbe (NEAT klesá)\n4. **Cirkadiánní desynchronizace** — jíš ve špatnou dobu biologických hodin\n\n### Klíčové zjištění\n\nLidé spící méně než 7 hodin mají o **55 % vyšší riziko obezity** oproti těm, kteří spí 7–9 hodin.\n\n### Doporučení\n\nSpánek 7–9 hodin není luxus — je to metabolická nutnost.\n\n**Zdroj:** Cedernaes J et al., Nature Reviews Endocrinology, 2022'
),

-- ── LH_MAIN — Celkový přehled ───────────────────────────────────────────────

('lh_main', 'article', 'Proč kalorický deficit nestačí: systémový pohled na váhu',
 'https://pubmed.ncbi.nlm.nih.gov/36280789/',
 'Přehled ukazuje, že tělesná hmotnost není jen otázka kalorií — spánek, stres, pohyb a časování jídla tvoří provázaný systém, kde každý faktor ovlivňuje ostatní. Intervence zaměřená na jeden prvek bez ostatních má omezený efekt.',
 'Nature Reviews Endocrinology', 2022, 109,
 ARRAY['lh_main', 'body_flow', 'system', 'spanek', 'stres', 'pohyb', 'lehkost'], true,
 E'## Váha není kalkulačka\n\n### Čtyři pilíře body flow\n\nVěda jasně ukazuje, že tělesná hmotnost je výsledkem čtyř provázaných systémů:\n\n| Pilíř | Vliv na váhu |\n|-------|-------------|\n| **Pohyb** (NEAT) | 300–2000 kcal/den |\n| **Spánek** | hormony hladu ±30 % |\n| **Stres** | kortizol → ukládání tuku |\n| **Výživa** | načasování mění metabolismus |\n\n### Proč je systémový přístup nutný\n\nSamotná dieta bez spánku → kortizol roste, hlad roste, efekt klesá.\nSamotný pohyb bez spánku → tělo kompenzuje menší NEAT zbytek dne.\nVše dohromady → synergický efekt.\n\n### Body flow jako měřítko\n\nBody flow skóre reflektuje všechny čtyři pilíře najednou — ne jen číslo na váze.\n\n**Zdroj:** Cedernaes J et al., Nature Reviews Endocrinology, 2022'
),

('lh_main', 'article', 'Behaviorální intervence při hubnutí: co funguje dlouhodobě',
 'https://pubmed.ncbi.nlm.nih.gov/38082033/',
 'Populační studie potvrzuje, že úspěšné dlouhodobé hubnutí závisí na konzistenci malých každodenních rozhodnutí — nikoliv na intenzivních krátkodobých dietách. Klíčové je sledování a reflexe vlastního chování.',
 'PubMed / Nutrients', 2023, 110,
 ARRAY['lh_main', 'hubnutí', 'konzistence', 'body_flow', 'lehkost'], true,
 E'## Hubnutí není sprint\n\n### Co funguje dlouhodobě\n\nData z tisíců lidí, kteří zhubli a váhu udrželi, ukazují společné vzorce:\n\n1. **Každodenní sebesledování** — váha, pohyb, jídlo (ne perfekcionismus, ale vědomost)\n2. **Malé konzistentní kroky** > dramatické změny\n3. **Ranní rutina** jako kotva dne\n4. **Spánek jako priorita** — ne jako luxus\n\n### Proč check-in funguje\n\nSamotné uvědomění si svého chování mění chování. Lidé, kteří sledují svůj příjem, zhubnou průměrně **dvakrát více** než ti, kteří nesledují — i při stejné dietě.\n\n### Body flow skóre\n\nNení to číslo na váze. Je to reflexe toho, jak žiješ.\n\n**Zdroj:** Nutrients, 2023'
);
