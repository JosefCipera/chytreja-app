-- add_script_cz_content.sql
-- Czech coaching excerpts for Centenarian Decathlon articles
-- Run in Supabase SQL Editor

-- ── ROVNOVÁHA ─────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Výzkum z roku 2022 sledoval přes 1700 lidí ve věku 51–75 let. Ti, kdo nedokázali stát 10 sekund na jedné noze, měli o 84 % vyšší riziko, že za 10 let zemřou. Nejde jen o rovnováhu — jde o sílu, propriocepci a schopnost těla koordinovat pohyb. Trénink je jednoduchý: stoj na jedné noze při čištění zubů, zavři oči pro vyšší náročnost. Začni 10 sekundami, postupně přidávej.'
WHERE title = 'Stoj na jedné noze: test dlouhověkosti';

UPDATE longevity_sources SET script_cz =
'Propriocepce je schopnost cítit polohu vlastního těla bez zraku. Po 40 letech tato schopnost přirozeně slábne — svaly a klouby vysílají méně přesné signály do mozku. Cviky na nestabilní ploše (bosu, čtvercená podložka, zavřené oči) tuto komunikaci obnovují. Studie ukazují, že pravidelný proprioceptivní trénink snižuje riziko pádu o 40 % u starších dospělých. Stačí 10 minut denně.'
WHERE title = 'Propriocepce: tichý smysl, který vás drží na nohou';

UPDATE longevity_sources SET script_cz =
'Vnitřní ucho řídí polovinu naší rovnováhy — spolu s propriocepcí a zrakem tvoří trojúhelník stability. Po 40 letech klesá počet vlásečnicových buněk ve vestibulárním aparátu o 20–40 %. Cviky jako Rombergův test se zavřenýma očima, tai chi nebo pohyby hlavy v různých rovinách tuto funkci udržují. Klíč je variabilita — trénuj rovnováhu na různých površích a v různých polohách.'
WHERE title = 'Vestibulární systém a rovnováha ve středním věku';

-- ── SPÁNEK ────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Během spánku mozek prochází glymfatickým systémem — splachuje toxiny včetně beta-amyloidu, který se spojuje s neurodegenerativními změnami. Non-REM spánek buduje a opravuje svaly, REM zpracovává emoce a ukládá paměť. Walker ukazuje, že méně než 7 hodin chronicky zvyšuje kortizol, snižuje inzulinovou citlivost a oslabuje imunitu. 8 hodin není doporučení — je to biologická potřeba, ne luxus.'
WHERE title = 'Proč spíme: věda za Walkerovými 8 hodinami';

UPDATE longevity_sources SET script_cz =
'Už po 17 hodinách bez spánku kognitivní výkon odpovídá hladině 0,05 promile alkoholu v krvi. Kortizol stoupá, inzulinová citlivost klesá o 25 %, imunitní aktivita se snižuje. Chronická deprivace pod 6 hodin mění genovou expresi — aktivuje geny spojené se zánětem a deaktivuje geny opravy DNA. Jediná dobrá noc nestačí k dohnání dluhu — tělo potřebuje několik dní plného spánku.'
WHERE title = 'Spánková deprivace: co se děje po 24 hodinách bez spánku';

UPDATE longevity_sources SET script_cz =
'Ranní sluneční světlo v prvních 30 minutách po probuzení spouští hodinový mechanismus, který ve večerních hodinách přirozeně uvolní melatonin. Modrá světla z obrazovek večer tento signál blokují — přimějí mozek, že je stále den. Praktická pravidla: ráno ven nebo alespoň k oknu bez brýlí, od 21 h ztlumit obrazovky nebo filtr teplého světla, ložnice co nejchladnější (18–19 °C). Teplota je druhý nejsilnější cirkadiánní signál po světle.'
WHERE title = 'Cirkadiánní rytmus: jak světlo řídí váš spánek';

-- ── STRES ─────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Allostatic load je celková zátěž, kterou chronický stres kumuluje v těle. Měří se přes biomarkery: kortizol, epinefrin, CRP, krevní tlak, obvod pasu, glykémie. McEwen ukázal, že vysoké allostatické zatížení urychluje stárnutí srdce, snižuje imunitní odpověď a zhoršuje kognitivní funkce. Klíčové není eliminovat stres — ale zkrátit dobu, po kterou tělo zůstává v aktivaci. Regenerační okna jsou stejně důležitá jako stresové epizody.'
WHERE title = 'Allostatic load: co dělá chronický stres s tělem';

UPDATE longevity_sources SET script_cz =
'HRV — variabilita srdečního rytmu — odráží rovnováhu mezi sympatickým a parasympatickým nervovým systémem. Vysoké HRV znamená, že tělo umí přepínat mezi aktivací a klidem. Chronický stres, špatný spánek nebo přetrénování HRV snižují. Sledování HRV každé ráno před vstáváním dá za 2–3 týdny jasný vzor — kdy si dát volno a kdy přidat. Nejlepší nástroje: Whoop, Garmin, Apple Watch nebo Polar H10 s aplikací.'
WHERE title = 'HRV jako měřítko stresu: co čísla říkají';

UPDATE longevity_sources SET script_cz =
'Ranní kortizolový peak je přirozeně nejvyšší 30 minut po probuzení — pomáhá aktivovat imunitu, mobilizovat energii a nastavit bdělost na celý den. Chronicky zvýšený kortizol naopak zkracuje telomery, snižuje hustotu kostí a blokuje opravné procesy buněk. Prakticky: vyhni se chronickému kalorickému deficitu, nespi méně než 7 hodin a nezařazuj těžký trénink po 20 h. Kortizol je hormon přežití — v malých dávkách tě posiluje, v chronické expozici tě vyčerpává.'
WHERE title = 'Kortizol a dlouhověkost: kdy je přítel, kdy nepřítel';

-- ── NERVOVÝ SYSTÉM ────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Mozek není pevná struktura — celý život vytváří nová nervová spojení v reakci na podněty. Fyzická aktivita, učení nových dovedností, sociální kontakt a spánek jsou hlavní stimuly neuroplasticity. Aerobní cvičení zvyšuje objem hippokampu — oblasti klíčové pro paměť — i v 70 letech. Klíčový protein je BDNF: mozkem produkovaný růstový faktor, jehož hladinu lze doslova natrénovat. Jeden 20minutový běh zvyšuje BDNF o 200–300 %.'
WHERE title = 'Neuroplasticita: mozek se mění až do stáří';

UPDATE longevity_sources SET script_cz =
'BDNF (Brain-Derived Neurotrophic Factor) je protein, který chrání neurony, podporuje jejich růst a zlepšuje přenos signálů v mozku. Nejsilnější přirozený stimul BDNF je aerobní cvičení — zejména běh a chůze do mírného kopce. Dávka: minimálně 150 minut týdně mírné aerobní aktivity, nebo 3× 20 minut intenzivnějšího pohybu. Silový trénink BDNF také zvyšuje, ale méně než vytrvalostní. Kombinace obou je optimální strategií pro ochranu mozku.'
WHERE title = 'BDNF: jak pohyb chrání váš mozek';

UPDATE longevity_sources SET script_cz =
'Autonomní nervový systém má dvě větve: sympatikus (aktivace, stres, výkon) a parasympatikus (klid, regenerace, trávení). Většina lidí tráví příliš mnoho času v sympatiku — bez vědomé aktivace parasympatiku se tělo nestačí opravovat. Nejrychlejší způsob jak přepnout: prodloužený výdech (4 sekundy nádech, 8 sekund výdech). Chladná sprcha, meditace nebo pouhé 5 minut klidného sezení v přírodě fungují podobně. Denní parasympatická okna jsou základ regenerace.'
WHERE title = 'Autonomní nervový systém: parasympatikus jako regenerační nástroj';

-- ── IMUNITNÍ SYSTÉM ───────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Inflammaging — chronický nízkostupňový zánět — je společný jmenovatel stárnutí a téměř všech nemocí středního a vyššího věku. CRP, IL-6 a TNF-α jsou zánětu markery, které lze změřit z krve. Co zánět zvyšuje: chronický stres, špatný spánek, průmyslově zpracovaná jídla, sedavý způsob života, nadváha kolem pasu. Co ho snižuje: omega-3, pohyb, proteinová strava, zelená zelenina, spánek. Cílová hodnota hs-CRP: pod 1 mg/L.'
WHERE title = 'Inflammaging: zánět jako motor stárnutí';

UPDATE longevity_sources SET script_cz =
'hs-CRP (high-sensitivity C-reactive protein) je nejcitlivější marker zánětu, který zobrazí i nízký chronický zánět neviditelný standardním CRP testem. Hodnoty nad 3 mg/L signalizují zvýšené kardiovaskulární riziko — ne z důvodu jednoho nálezu, ale při opakovaném měření. Pohyb 5× týdně snižuje hs-CRP průměrně o 35 %. Omega-3 (EPA+DHA 2–3 g denně) mají srovnatelný efekt. Nejefektivnější kombinace: aerobní pohyb + protizánětlivá strava + dostatek spánku.'
WHERE title = 'CRP a hs-CRP: co říkají zánětlivé markery';

UPDATE longevity_sources SET script_cz =
'Mírná pravidelná aktivita snižuje riziko infekcí horních dýchacích cest o 40–50 %. Mechanismus: pohyb zvyšuje cirkulaci NK buněk (natural killers) a T-lymfocytů, které detekují a ničí patogeny. Klíčové slovo je přiměřená — extrémní trénink dočasně imunitu oslabuje, tzv. otevřené okno. Optimum je 30–60 minut mírné až střední intenzity 5× týdně. Více neznamená lépe — regenerace je součást imunitní strategie.'
WHERE title = 'Pohyb a imunita: proč cvičení snižuje riziko infekcí';

-- ── METABOLISMUS ──────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'CGM (continuous glucose monitor) odhaluje, že průměrná glykémie může být normální, ale výkyvy po jídle mohou poškozovat endotel cév. Spike nad 140 mg/dL po každém jídle zvyšuje oxidační stres. Praktické strategie pro stabilní křivku: nejprve zelenina a bílkoviny, pak sacharidy; krátká chůze 10 minut po jídle; vyhni se sladkým nápojům nalačno. Pořadí jídla má větší vliv na glukózovou křivku než samotné množství sacharidů.'
WHERE title = 'Glukózová variabilita: proč záleží na výkyvech, ne jen průměru';

UPDATE longevity_sources SET script_cz =
'Inzulinová senzitivita říká, jak dobře buňky reagují na inzulin a přijímají glukózu. Nízká senzitivita (inzulinová rezistence) je tichý stav, který předchází metabolickým problémům o 10–15 let. Nejsilnější intervence: silový trénink (svaly jsou hlavní spotřebič glukózy), snížení viscerálního tuku, dostatek spánku, omezení průmyslově zpracovaných jídel. Jednoduché markery: HOMA-IR pod 1,5 a poměr triglyceridů k HDL pod 2,0 — oba dostupné ze standardního krevního obrazu.'
WHERE title = 'Inzulinová senzitivita: základ metabolického zdraví';

UPDATE longevity_sources SET script_cz =
'Pět čísel definuje metabolické zdraví: obvod pasu (pod 94 cm muži, pod 80 cm ženy), triglyceridy pod 1,7 mmol/L, HDL nad 1,0 (muži) nebo 1,3 (ženy), krevní tlak pod 130/85, glykémie nalačno pod 5,6 mmol/L. Tři a více mimo normu znamenají výrazně zvýšené riziko. Dobrá zpráva: metabolický stav je plně reverzibilní — pohybem, stravou a spánkem. Viscerální tuk (kolem orgánů) je metabolicky nejaktivnější a jako první reaguje na intervenci.'
WHERE title = 'Metabolický syndrom: pět čísel, která určují váš věk';

-- ── MOBILITA ──────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Functional Range Conditioning (FRC) od Dr. Andrewa Pastora je přístup, který Attia označuje za základ pohybové longevity. Na rozdíl od pasivního strečinku FRC trénuje aktivní rozsah pohybu — tedy to, co tělo skutečně umí použít. Princip: pohybovat se do krajní polohy a tam aktivovat svaly po dobu 30–60 sekund (PAILs a RAILs). Výsledek: skutečně použitelná pohyblivost, ne jen pasivní flexibilita. Denní praxe 10–15 minut stačí k viditelné změně za 4–6 týdnů.'
WHERE title = 'FRC protokol: jak cvičit pohyblivost vědecky';

UPDATE longevity_sources SET script_cz =
'Zkrácený hip flexor (iliopsoas) způsobuje přetížení bederní páteře a omezuje délku kroku — klasický projev sedavého způsobu života. Tuhá hrudní páteř blokuje rotaci, kompenzovanou bedrami a rameny. Obě struktury jsou hlavními límci pohyblivosti ve středním věku. Couch stretch pro hip flexor a rotace v polo-sedě pro hrudní páteř jsou klíčové cviky. Stačí 5 minut denně na každou oblast — konzistentnost bije intenzitu.'
WHERE title = 'Hip flexor a hrudní páteř: dva klíče pohyblivosti';

UPDATE longevity_sources SET script_cz =
'Attia často cituje princip: pohyblivost bez stability je nestabilita — a nestabilita je riziko. Uvolnit kyčel k 90° rotaci nemá smysl, pokud svaly nejsou schopné v tom rozsahu stabilizovat kloub. FRC protokol proto kombinuje mobilizaci s aktivací — nejprve uvolni, pak posiluj v novém rozsahu. Bezpečná pohyblivost je taková, kterou tělo umí kontrolovat. Test: dokážeš udržet polohu 3 sekundy bez kompenzace jinde v těle?'
WHERE title = 'Pohyblivost vs. stabilita: proč potřebuješ oboje';

UPDATE longevity_sources SET script_cz =
'Ranní kloubní rutina aktivuje synoviální tekutinu, která vyživuje chrupavku kloubů — kloubní chrupavka nemá cévy, živí se pohybem. Pořadí: kotníky, kolena, kyčle, páteř, ramena, krk. Každý kloub 5–10 pomalých kruhů v obou směrech. Cíl není protažení, ale mazání — připravit tělo na den bez tuhosti. Nejlepší výsledky jsou při každodenní praxi, ideálně před snídaní nebo hned po probuzení.'
WHERE title = 'Ranní kloubní rutina: 10 minut pro celé tělo';

-- ── STABILITA ─────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Stuart McGill, biomechanik páteře, vyvinul tři cviky jako základ bezpečné páteřní stabilizace: Bird Dog, boční plank a modifikovaný Curl-Up. Na rozdíl od klasických sed-lehů maximálně aktivují hluboký stabilizační systém při minimálním tlaku na meziobratlové ploténky. Attiův přístup: tyto tři cviky jsou výchozí bod pro každého, kdo chce přidat silový trénink bez rizika poranění páteře. Technika a kontrola před zátěží — vždy.'
WHERE title = 'McGill Big 3: základ zdravých zad';

UPDATE longevity_sources SET script_cz =
'Dynamic Neuromuscular Stabilization (DNS) je systém vyvinutý v Praze rehabilitačním lékařem Pavlem Kolářem. Vychází z pozorování, jak miminko přirozeně stabilizuje tělo při vývoji pohybu — bez vědomého učení. V dospělosti tyto vzorce narušuje sed, stres a asymetrie. DNS cviky obnovují intraabdominální tlak a souhru bránice, pánevního dna a hlubokých zad. Prakticky: Dead Bug, Bear Crawl a Breathing Squat jsou výchozí DNS cviky dostupné pro každého.'
WHERE title = 'DNS: jak trénovat stabilitu jako miminko';

UPDATE longevity_sources SET script_cz =
'Stoj na jedné noze je Attiem označován jako jeden z nejdůležitějších testů longevity — měří sílu, propriocepci, vestibulární funkci a pozornost najednou. Standard: 10 sekund se zavřenýma očima na každé noze. Pokud nedokážeš, trénink je jednoduchý: stoj na jedné noze při čemkoliv (čištění zubů, čekání na výtah), postupně zavírej oči. Pokročilý trénink: stoj na balanční podložce, přidej pohyb rukou nebo rotaci hlavy.'
WHERE title = 'Stoj na jedné noze: test i trénink v jednom';

UPDATE longevity_sources SET script_cz =
'Core systém tvoří bránice (nahoře), pánevní dno (dole), hluboký transverzální břišní sval a multifidi zad — ne povrchové rectus abdominis. Funkce core není vypadat dobře, ale vytvářet intraabdominální tlak, který chrání páteř při každém pohybu. Planky trénují výdrž, ale samy nestačí — klíčová je koordinace s dechem. Nádech expanzí do stran (ne do břicha), výdech se zapnutím pánevního dna a lehkým vtažením pupku. Toto je základ správného core tréninku.'
WHERE title = 'Core není břicho: jak funguje skutečná stabilizace';

-- ── KARDIO ────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'HRV (Heart Rate Variability) měří, jak moc se interval mezi tepy liší — paradoxně, větší variabilita znamená zdravější srdce a nervový systém. Průměrné HRV klesá s věkem: 20leté osoby mívají HRV 60–90 ms, 50leté 30–50 ms. Trénink, spánek a snížení stresu HRV zvyšují. Klíčové pravidlo: pokud je tvé HRV ráno výrazně pod tvým průměrem (o více než 20 %), je to signál k lehčímu dni nebo odpočinku. HRV je nejrychlejší biofeedback, který máš k dispozici zdarma.'
WHERE title = 'HRV: okno do tvého srdce a nervového systému';

UPDATE longevity_sources SET script_cz =
'Attia a Andy Galpin doporučují strukturu tréninku srdce ve dvou pilířích: Zone 2 (80 % objemu) a Zone 5 (20 % objemu). Zone 2 je mírná intenzita, kdy ještě pohodlně mluvíš — buduje mitochondriální kapacitu a metabolickou efektivitu. Zone 5 jsou krátké intervaly naplno (4 minuty práce, 3 minuty klus, 4× opakovat) — maximálně zvyšují VO2max. Minimální dávka pro longevity benefit: 150 min Zone 2 týdně + 1× interval trénink.'
WHERE title = 'Jak trénovat srdce pro dlouhověkost: 4 zóny';

UPDATE longevity_sources SET script_cz =
'ApoB (Apolipoprotein B) je molekula nesená na každé aterogenní částici — LDL, VLDL, IDL. Na rozdíl od LDL-C (koncentrace cholesterolu) ApoB počítá počet aterogenních částic, což je přesnější prediktor rizika. Attia sleduje ApoB jako primární marker: cíl pod 60–70 mg/dL pro nízké riziko, pod 80 mg/dL jako přijatelné. Snížit ApoB: snížit viscerální tuk, omezit saturované tuky a zvýšit pohyb. Pokud nestačí, statiny nebo ezetimib jsou efektivní a bezpečné.'
WHERE title = 'ApoB a LDL: co říká krev o zdraví srdce';

-- ── SÍLA ──────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Farmer''s carry (chůze s těžkými kettlebelly nebo činkama v každé ruce) je Attiovo oblíbené funkční cvičení. Trénuje grip, core stabilizaci, posturu, ramena a nohy simultánně — přesně to, co potřebuješ pro funkční sílu v 80 letech. Standard pro longevity: unést vlastní váhu (každá ruka polovina tělesné hmotnosti) na vzdálenost 30–50 metrů. Začni 40 % vlastní váhy a postupně zvyšuj. Nejlepší příprava na každodenní situace — nošení nákupů, zavazadel, vnoučat.'
WHERE title = 'Farmer''s carry: jeden cvik pro celé tělo';

UPDATE longevity_sources SET script_cz =
'Výzkumy z prestižních lékařských časopisů ukazují, že síla stisku ruky předpovídá celkovou mortalitu lépe než krevní tlak. Dead hang (visení na hrazdě) je nejjednodušší test i trénink grip síly. Standard pro longevity: muži 60 sekund, ženy 40 sekund. Pokud nedosáhneš, začni aktivním visením (trochu nohama na zemi) a postupně ubírej oporu. Vedlejší benefity: dekomprese páteře, posílení ramen a skapulárních stabilizátorů, prevence syndromu karpálního tunelu.'
WHERE title = 'Dead hang: grip síla jako prediktor dlouhověkosti';

UPDATE longevity_sources SET script_cz =
'Rumunský mrtvý tah (RDL) je jeden z nejbezpečnějších způsobů jak posilovat zadní řetězec — hamstringy, hýžďové svaly a vzpřimovače páteře — bez nadměrného namáhání bederní páteře. Na rozdíl od konvenčního mrtvého tahu nedochází ke kontaktu s podlahou, takže lze kontrolovat pohyb v rozsahu, kde jsou záda v bezpečí. Klíčová technika: páteř neutrální po celou dobu, pohyb iniciován pánví (hip hinge), ne ohnutím zad. Začni s lehčí váhou a dbej na pocit tahu v hamstrinzích.'
WHERE title = 'RDL: rumunský mrtvý tah pro zdravá záda a silné nohy';

-- ── VYTRVALOST / VO2MAX ───────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'Norský 4×4 protokol je vědecky nejlépe podložený způsob jak zvýšit VO2max v krátkém čase. 4 minuty na 85–95 % maximální tepové frekvence, 3 minuty klusu, 4× opakovat. Výzkumy z Norska ukázaly průměrný nárůst VO2max o 10 % za 8 týdnů tréninku 3× týdně. VO2max je nejsilnější prediktor délky života — každý 1 MET nárůst snižuje mortalitu o 13–17 %. Tento protokol lze provádět na kole, běžeckém pásu, veslařském stroji nebo venku.'
WHERE title = 'Norský 4×4: nejefektivnější VO2max protokol';

UPDATE longevity_sources SET script_cz =
'VO2max — maximální spotřeba kyslíku — je číslo, které předpovídá délku i kvalitu života lépe než téměř jakýkoliv jiný marker. Attia a Inigo San Millán doporučují kombinaci: 3–4× Zone 2 (45–60 min mírná intenzita) + 1× interval trénink (Norský 4×4) týdně. Za 12 týdnů je nárůst VO2max o 10–15 % realistický pro netrénované jedince. Klíč: Zone 2 buduje aerobní základ, intervaly ho maximalizují. Bez Zone 2 základny je interval trénink méně efektivní.'
WHERE title = 'Jak zvýšit VO2max: praktický plán na 12 týdnů';

UPDATE longevity_sources SET script_cz =
'Zone 2 je intenzita, při které ještě pohodlně vedeš celou větu — ale ne snadno. Talk test: mluvíš, ale nezpíváš. Přesněji: tepová frekvence 60–70 % maxima, nebo laktát v krvi 1,7–2,0 mmol/L. Nejjednodušší nástroj bez měřičů: jdi do mírného kopce tempem, kde cítíš dýchání, ale nepřetěžuješ se. Zone 2 trénuje mitochondrie svalu — buduje kapacitu spalovat tuky a odolávat metabolické únavě. Minimálně 150 minut týdně pro longevity benefit.'
WHERE title = 'Zone 2 v praxi: jak poznat správnou intenzitu';
