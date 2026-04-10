-- update_script_cz_to_markdown.sql
-- Rewrites script_cz from plain sentences to proper markdown
-- Run in Supabase SQL Editor

-- ── ROVNOVÁHA ─────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Proč na tom záleží
Výzkum z roku 2022 sledoval přes 1700 lidí ve věku 51–75 let. Ti, kdo nedokázali stát 10 sekund na jedné noze, měli o **84 % vyšší riziko úmrtí** v následujících 10 letech.

## Co to testuje
Nejde jen o rovnováhu — jde o sílu, propriocepci a schopnost těla koordinovat pohyb najednou.

## Jak trénovat
- Stoj na jedné noze při čištění zubů
- Postupně zavírej oči (vyšší náročnost)
- Cíl: 10 sekund se zavřenýma očima na každé noze'
WHERE title = 'Stoj na jedné noze: test dlouhověkosti';

UPDATE longevity_sources SET script_cz =
'## Co je propriocepce
Propriocepce je schopnost cítit polohu vlastního těla **bez zraku**. Po 40 letech přirozeně slábne — svaly a klouby vysílají méně přesné signály do mozku.

## Proč trénovat
Pravidelný proprioceptivní trénink snižuje riziko pádu o **40 %** u starších dospělých.

## Jak na to
- Cviky na nestabilní ploše: bosu, čtvercová podložka
- Stoj se zavřenýma očima
- Stačí 10 minut denně'
WHERE title = 'Propriocepce: tichý smysl, který vás drží na nohou';

UPDATE longevity_sources SET script_cz =
'## Trojúhelník stability
Rovnováhu řídí tři systémy společně: **vnitřní ucho + propriocepce + zrak**. Po 40 letech počet vlásečnicových buněk ve vestibulárním aparátu klesá o 20–40 %.

## Jak trénovat vestibulární systém
- Rombergův test se zavřenýma očima
- Tai chi nebo pomalé pohyby hlavy v různých rovinách
- Variabilita povrchů — trénuj na různých površích

> Klíč je variabilita, ne opakování stejného cviku.'
WHERE title = 'Vestibulární systém a rovnováha ve středním věku';

-- ── SPÁNEK ────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Co se děje během spánku
Mozek prochází **glymfatickým systémem** — splachuje toxiny včetně beta-amyloidu. Non-REM spánek buduje a opravuje svaly, REM zpracovává emoce a ukládá paměť.

## Dopady nedostatku
Méně než 7 hodin chronicky:
- zvyšuje kortizol
- snižuje inzulinovou citlivost
- oslabuje imunitu

> 8 hodin není doporučení — je to biologická potřeba.'
WHERE title = 'Proč spíme: věda za Walkerovými 8 hodinami';

UPDATE longevity_sources SET script_cz =
'## Co se děje po 17 hodinách bez spánku
Kognitivní výkon odpovídá hladině **0,05 promile alkoholu** v krvi.

## Systémové dopady
- Kortizol stoupá
- Inzulinová citlivost klesá o **25 %**
- Imunitní aktivita se snižuje

## Důležité
Chronická deprivace (pod 6 hodin) mění genovou expresi — aktivuje geny zánětu, deaktivuje geny opravy DNA. Jediná dobrá noc dluh nedožene.'
WHERE title = 'Spánková deprivace: co se děje po 24 hodinách bez spánku';

UPDATE longevity_sources SET script_cz =
'## Jak světlo řídí spánek
Ranní sluneční světlo v prvních **30 minutách po probuzení** spouští hodinový mechanismus, který večer přirozeně uvolní melatonin.

## Praktická pravidla
- Ráno: ven nebo k oknu bez brýlí
- Od 21 h: ztlumit obrazovky nebo filtr teplého světla
- Ložnice: co nejchladnější (**18–19 °C**)

> Teplota je druhý nejsilnější cirkadiánní signál po světle.'
WHERE title = 'Cirkadiánní rytmus: jak světlo řídí váš spánek';

-- ── STRES ─────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Co je allostatic load
Allostatic load je celková zátěž, kterou chronický stres kumuluje v těle. Měří se přes biomarkery: kortizol, CRP, krevní tlak, obvod pasu, glykémie.

## Dopady
Vysoké allostatické zatížení:
- urychluje stárnutí srdce
- snižuje imunitní odpověď
- zhoršuje kognitivní funkce

> Klíčové není eliminovat stres — ale zkrátit dobu aktivace. Regenerační okna jsou stejně důležitá jako stresové epizody.'
WHERE title = 'Allostatic load: co dělá chronický stres s tělem';

UPDATE longevity_sources SET script_cz =
'## Co je HRV
HRV (Heart Rate Variability) odráží rovnováhu mezi sympatickým a parasympatickým nervovým systémem. **Vysoké HRV = tělo umí přepínat mezi aktivací a klidem.**

## Jak ho používat
Sleduj HRV každé ráno před vstáváním. Za 2–3 týdny uvidíš vzor — kdy odpočívat, kdy přidat.

## Nástroje
- Whoop, Garmin, Apple Watch
- Polar H10 + aplikace (nejpřesnější)'
WHERE title = 'HRV jako měřítko stresu: co čísla říkají';

UPDATE longevity_sources SET script_cz =
'## Kortizol jako přítel
Ranní kortizolový peak je přirozeně nejvyšší **30 minut po probuzení** — aktivuje imunitu, mobilizuje energii, nastavuje bdělost.

## Kortizol jako nepřítel
Chronicky zvýšený kortizol:
- zkracuje telomery
- snižuje hustotu kostí
- blokuje opravné procesy buněk

## Jak ho udržet v rovnováze
- Nespi méně než 7 hodin
- Vyhni se chronickému kalorickému deficitu
- Nezařazuj těžký trénink po 20 h'
WHERE title = 'Kortizol a dlouhověkost: kdy je přítel, kdy nepřítel';

-- ── NERVOVÝ SYSTÉM ────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Mozek se mění celý život
Fyzická aktivita, učení nových dovedností, sociální kontakt a spánek jsou hlavní stimuly neuroplasticity. Aerobní cvičení zvyšuje objem hippokampu — oblasti klíčové pro paměť — **i v 70 letech**.

## Klíčový protein: BDNF
BDNF je mozkem produkovaný růstový faktor, jehož hladinu lze natrénovat.

> Jeden 20minutový běh zvyšuje BDNF o 200–300 %.'
WHERE title = 'Neuroplasticita: mozek se mění až do stáří';

UPDATE longevity_sources SET script_cz =
'## Co je BDNF
BDNF (Brain-Derived Neurotrophic Factor) chrání neurony, podporuje jejich růst a zlepšuje přenos signálů v mozku.

## Jak ho zvýšit
| Aktivita | Efekt |
|---|---|
| Aerobní cvičení (běh, chůze) | Nejvyšší stimul |
| Silový trénink | Střední stimul |
| Kombinace obou | Optimální |

**Dávka:** minimálně 150 minut týdně mírné aerobní aktivity.'
WHERE title = 'BDNF: jak pohyb chrání váš mozek';

UPDATE longevity_sources SET script_cz =
'## Dvě větve nervového systému
- **Sympatikus** — aktivace, stres, výkon
- **Parasympatikus** — klid, regenerace, trávení

Většina lidí tráví příliš mnoho času v sympatiku.

## Jak aktivovat parasympatikus
- Prodloužený výdech: 4 s nádech → 8 s výdech
- Chladná sprcha
- 5 minut klidného sezení v přírodě

> Denní parasympatická okna jsou základ regenerace.'
WHERE title = 'Autonomní nervový systém: parasympatikus jako regenerační nástroj';

-- ── IMUNITNÍ SYSTÉM ───────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Co je inflammaging
Chronický nízkostupňový zánět — společný jmenovatel stárnutí. Markery: **CRP, IL-6, TNF-α**.

## Co zánět zvyšuje
- Chronický stres a špatný spánek
- Průmyslově zpracovaná jídla
- Sedavý způsob života, nadváha kolem pasu

## Co ho snižuje
- Omega-3, pohyb, proteinová strava
- Zelená zelenina, dostatek spánku

> Cílová hodnota hs-CRP: **pod 1 mg/L**'
WHERE title = 'Inflammaging: zánět jako motor stárnutí';

UPDATE longevity_sources SET script_cz =
'## Co je hs-CRP
High-sensitivity CRP je nejcitlivější marker zánětu — zobrazí i nízký chronický zánět neviditelný standardním CRP testem.

## Jak ho snížit
- Pohyb 5× týdně snižuje hs-CRP průměrně o **35 %**
- Omega-3 (EPA+DHA 2–3 g denně) — srovnatelný efekt
- Kombinace: aerobní pohyb + protizánětlivá strava + spánek

**Hodnoty nad 3 mg/L** signalizují zvýšené riziko (při opakovaném měření).'
WHERE title = 'CRP a hs-CRP: co říkají zánětlivé markery';

UPDATE longevity_sources SET script_cz =
'## Pohyb a imunita
Mírná pravidelná aktivita snižuje riziko infekcí horních dýchacích cest o **40–50 %**.

## Jak to funguje
Pohyb zvyšuje cirkulaci NK buněk a T-lymfocytů, které detekují a ničí patogeny.

## Pozor na přetížení
Extrémní trénink dočasně imunitu oslabuje — tzv. **otevřené okno**.

**Optimum:** 30–60 minut mírné intenzity, 5× týdně. Více neznamená lépe.'
WHERE title = 'Pohyb a imunita: proč cvičení snižuje riziko infekcí';

-- ── METABOLISMUS ──────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Proč záleží na výkyvech
CGM ukazuje, že průměrná glykémie může být normální, ale výkyvy po jídle poškozují endotel cév. Spike nad **140 mg/dL** zvyšuje oxidační stres.

## Strategie pro stabilní křivku
1. Nejprve zelenina a bílkoviny, pak sacharidy
2. Krátká chůze 10 minut po jídle
3. Vyhni se sladkým nápojům nalačno

> Pořadí jídla má větší vliv na glukózovou křivku než samotné množství sacharidů.'
WHERE title = 'Glukózová variabilita: proč záleží na výkyvech, ne jen průměru';

UPDATE longevity_sources SET script_cz =
'## Co je inzulinová senzitivita
Říká, jak dobře buňky reagují na inzulin a přijímají glukózu. Nízká senzitivita předchází metabolickým problémům o **10–15 let**.

## Nejsilnější intervence
- **Silový trénink** — svaly jsou hlavní spotřebič glukózy
- Snížení viscerálního tuku
- Dostatek spánku

## Jak měřit
- HOMA-IR pod **1,5**
- Poměr triglyceridů k HDL pod **2,0**'
WHERE title = 'Inzulinová senzitivita: základ metabolického zdraví';

UPDATE longevity_sources SET script_cz =
'## Pět čísel metabolického zdraví
| Marker | Cílová hodnota |
|---|---|
| Obvod pasu | < 94 cm (muži), < 80 cm (ženy) |
| Triglyceridy | < 1,7 mmol/L |
| HDL | > 1,0 (muži), > 1,3 (ženy) |
| Krevní tlak | < 130/85 |
| Glykémie nalačno | < 5,6 mmol/L |

Tři a více mimo normu = výrazně zvýšené riziko. Viscerální tuk reaguje na intervenci jako první.'
WHERE title = 'Metabolický syndrom: pět čísel, která určují váš věk';

-- ── MOBILITA ──────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Co je FRC
Functional Range Conditioning trénuje **aktivní rozsah pohybu** — to, co tělo skutečně umí použít. Na rozdíl od pasivního strečinku.

## Princip
Pohyb do krajní polohy + aktivace svalů po dobu 30–60 s (PAILs a RAILs).

## Výsledek
Skutečně použitelná pohyblivost, ne jen pasivní flexibilita.

> **Dávka:** 10–15 minut denně. Viditelná změna za 4–6 týdnů.'
WHERE title = 'FRC protokol: jak cvičit pohyblivost vědecky';

UPDATE longevity_sources SET script_cz =
'## Dva hlavní límce pohyblivosti
- **Zkrácený hip flexor (iliopsoas)** — přetěžuje bederní páteř, zkracuje krok
- **Tuhá hrudní páteř** — blokuje rotaci, kompenzovanou bedrami a rameny

## Řešení
- **Hip flexor:** Couch stretch, 2 minuty na stranu
- **Hrudní páteř:** rotace v polo-sedě, foam roller

> Stačí 5 minut denně na každou oblast. Konzistentnost bije intenzitu.'
WHERE title = 'Hip flexor a hrudní páteř: dva klíče pohyblivosti';

UPDATE longevity_sources SET script_cz =
'## Attia: pohyblivost bez stability je nestabilita
Uvolnit kyčel k 90° rotaci nemá smysl, pokud svaly nejsou schopné v tom rozsahu stabilizovat kloub.

## FRC přístup
1. Nejprve uvolni (mobilizace)
2. Pak posiluj v novém rozsahu (aktivace)

## Test
Dokážeš udržet krajní polohu **3 sekundy** bez kompenzace jinde v těle? Pak je rozsah skutečně tvůj.'
WHERE title = 'Pohyblivost vs. stabilita: proč potřebuješ oboje';

UPDATE longevity_sources SET script_cz =
'## Proč ranní rutina funguje
Kloubní chrupavka nemá cévy — živí se pohybem přes synoviální tekutinu. Ranní rutina ji aktivuje.

## Pořadí
Kotníky → kolena → kyčle → páteř → ramena → krk. Každý kloub 5–10 pomalých kruhů v obou směrech.

## Cíl
Ne protažení, ale **mazání** — připravit tělo na den bez tuhosti.

> Nejlepší výsledky při každodenní praxi, ideálně před snídaní.'
WHERE title = 'Ranní kloubní rutina: 10 minut pro celé tělo';

-- ── STABILITA ─────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## McGill Big 3
Tři cviky od biomechanika Stuarta McGilla jako základ páteřní stabilizace:

1. **Bird Dog** — koordinace a rovnováha
2. **Boční plank** — laterální stabilizace
3. **Modifikovaný Curl-Up** — flexe bez tlaku na ploténky

## Proč fungují
Maximálně aktivují hluboký stabilizační systém při **minimálním tlaku** na meziobratlové ploténky.

> Technika a kontrola před zátěží — vždy.'
WHERE title = 'McGill Big 3: základ zdravých zad';

UPDATE longevity_sources SET script_cz =
'## Co je DNS
Dynamic Neuromuscular Stabilization — systém vyvinutý v Praze rehabilitačním lékařem **Pavlem Kolářem**. Vychází z pohybového vývoje miminka.

## Proč to funguje
DNS obnovuje intraabdominální tlak a souhru bránice, pánevního dna a hlubokých zad — narušenou sedavým životem a stresem.

## Výchozí cviky
- Dead Bug
- Bear Crawl
- Breathing Squat'
WHERE title = 'DNS: jak trénovat stabilitu jako miminko';

UPDATE longevity_sources SET script_cz =
'## Attia: jeden z nejdůležitějších testů
Stoj na jedné noze měří sílu, propriocepci, vestibulární funkci a pozornost **najednou**.

## Standard pro longevity
10 sekund se zavřenýma očima na každé noze.

## Jak trénovat
- Začni: stoj při čištění zubů, čekání na výtah
- Postupuj: zavírej oči
- Pokročilý: balanční podložka + pohyb rukou nebo rotace hlavy'
WHERE title = 'Stoj na jedné noze: test i trénink v jednom';

UPDATE longevity_sources SET script_cz =
'## Core není břicho
Core systém tvoří:
- **Bránice** (nahoře)
- **Pánevní dno** (dole)
- **Transverzální břišní sval** (hloubka)
- **Multifidi zad**

Ne povrchové rectus abdominis (tzv. sixpack).

## Správná aktivace
- Nádech expanzí do stran (ne do břicha)
- Výdech se zapnutím pánevního dna a lehkým vtažením pupku

> Planky trénují výdrž, ale koordinace s dechem je základ.'
WHERE title = 'Core není břicho: jak funguje skutečná stabilizace';

-- ── KARDIO ────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Co je HRV
HRV měří variabilitu intervalu mezi tepy. **Paradox: větší variabilita = zdravější srdce.**

## Hodnoty podle věku
- 20 let: 60–90 ms
- 50 let: 30–50 ms

## Jak používat
Pokud je tvé ranní HRV o více než 20 % pod průměrem → lehčí den nebo odpočinek.

> HRV je nejrychlejší biofeedback, který máš k dispozici — zdarma.'
WHERE title = 'HRV: okno do tvého srdce a nervového systému';

UPDATE longevity_sources SET script_cz =
'## Dva pilíře tréninku srdce
| Typ | Podíl | Efekt |
|---|---|---|
| **Zone 2** | 80 % objemu | Mitochondrie, metabolická efektivita |
| **Zone 5 (HIIT)** | 20 % objemu | Maximální VO2max |

## Zone 2
Mírná intenzita — ještě pohodlně mluvíš celou větu.

## Zone 5
4 minuty naplno, 3 minuty klus, 4× opakovat.

> **Minimum pro longevity:** 150 min Zone 2 + 1× HIIT týdně.'
WHERE title = 'Jak trénovat srdce pro dlouhověkost: 4 zóny';

UPDATE longevity_sources SET script_cz =
'## ApoB vs. LDL-C
**ApoB** počítá počet aterogenních částic (přesnější). LDL-C měří jen koncentraci cholesterolu.

## Cílové hodnoty (Attia)
- Nízké riziko: ApoB **pod 60–70 mg/dL**
- Přijatelné: pod 80 mg/dL

## Jak snížit ApoB
1. Snížit viscerální tuk
2. Omezit saturované tuky
3. Zvýšit pohyb
4. Pokud nestačí: statiny nebo ezetimib jsou efektivní a bezpečné'
WHERE title = 'ApoB a LDL: co říká krev o zdraví srdce';

-- ── SÍLA ──────────────────────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Proč farmer''s carry
Attia ho označuje za nejdůležitější funkční cvik — trénuje grip, core, posturu, ramena a nohy **najednou**.

## Standard pro longevity
Unést vlastní váhu (každá ruka = polovina tělesné hmotnosti) na **30–50 metrů**.

## Jak začít
- Start: 40 % vlastní váhy
- Postupně zvyšuj každé 2 týdny
- Praktická příprava: nákupy, zavazadla, vnoučata'
WHERE title = 'Farmer''s carry: jeden cvik pro celé tělo';

UPDATE longevity_sources SET script_cz =
'## Grip síla jako prediktor
Výzkumy ukazují, že síla stisku ruky předpovídá celkovou mortalitu **lépe než krevní tlak**.

## Standard pro longevity
- Muži: **60 sekund** dead hang
- Ženy: **40 sekund** dead hang

## Jak trénovat od nuly
1. Aktivní visení (trochu nohama na zemi)
2. Postupně ubírej oporu
3. Vedlejší benefity: dekomprese páteře, síla ramen, prevence karpálního tunelu'
WHERE title = 'Dead hang: grip síla jako prediktor dlouhověkosti';

UPDATE longevity_sources SET script_cz =
'## Proč RDL
Rumunský mrtvý tah posiluje zadní řetězec — hamstringy, hýžďové svaly a vzpřimovače páteře — bez nadměrného tlaku na bederní páteř.

## Klíčová technika
- Páteř **neutrální** po celou dobu
- Pohyb iniciován pánví (hip hinge), ne ohnutím zad
- Pocit tahu v hamstrinzích = správná poloha

## Start
Lehčí váha, pomalé tempo, plná kontrola pohybu.'
WHERE title = 'RDL: rumunský mrtvý tah pro zdravá záda a silné nohy';

-- ── VYTRVALOST / VO2MAX ───────────────────────────────────────

UPDATE longevity_sources SET script_cz =
'## Norský 4×4 protokol
Vědecky nejlépe podložený způsob jak zvýšit VO2max.

**Struktura:**
- 4 minuty na **85–95 % max. tepové frekvence**
- 3 minuty klusu
- 4× opakovat

## Výsledky
Průměrný nárůst VO2max o **10 % za 8 týdnů** při tréninku 3× týdně.

## Proč záleží
Každý 1 MET nárůst VO2max snižuje mortalitu o **13–17 %**.'
WHERE title = 'Norský 4×4: nejefektivnější VO2max protokol';

UPDATE longevity_sources SET script_cz =
'## VO2max a délka života
VO2max předpovídá délku i kvalitu života lépe než téměř jakýkoliv jiný marker.

## 12týdenní plán (Attia + San Millán)
| Složka | Frekvence | Délka |
|---|---|---|
| Zone 2 | 3–4× týdně | 45–60 min |
| Interval (4×4) | 1× týdně | 35 min |

## Výsledek
Nárůst VO2max o **10–15 %** za 12 týdnů realistický pro netrénované jedince.'
WHERE title = 'Jak zvýšit VO2max: praktický plán na 12 týdnů';

UPDATE longevity_sources SET script_cz =
'## Jak poznat Zone 2
**Talk test:** mluvíš celou větu, ale ne snadno. Nezpíváš.

## Přesněji
- Tepová frekvence: **60–70 % maxima**
- Laktát v krvi: 1,7–2,0 mmol/L

## Bez měřičů
Jdi do mírného kopce tempem, kde cítíš dýchání, ale nepřetěžuješ se.

## Proč Zone 2
Trénuje mitochondrie svalu — buduje kapacitu spalovat tuky a odolávat metabolické únavě.

> **Minimum:** 150 minut týdně.'
WHERE title = 'Zone 2 v praxi: jak poznat správnou intenzitu';
