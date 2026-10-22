# Decathlon: soupis zdrojů, disciplín a ukazatelů ↔ uzly modelu

Stav: **podklad k rozhodnutí, bez změny kódu.** Sestaveno 20. 10. 2026 z dokumentů v repu a z ručně psaného listu „Dekatlon lidově" (PDF od Josefa). Účel: ukázat, co už máme a co chybí, než se rozhodne, zda Decathlon bude úvodní (volná) vrstva před balíčky srdce, cukrovky a ED.

## 0 Josefův seznam: ručně psaný list „Dekatlon lidově" (hlavní zdroj)
Sken jedné strany bez textové vrstvy; přepsáno ručně. Sloupce: disciplína · proč to zákazník potřebuje · metrika v „Dlouhověkosti". U všech deseti řádků je ručně odškrtnuto. Dopsáno rukou u rychlé chůze: „+ plavat/kolo".

| # | Disciplína | Proč (jak je uvedeno) | Metrika | Uzel / vstup v modelu | Stav |
|---|---|---|---|---|---|
| 1 | Vstát ze země | postavit se bez pomoci rukou (prevence pádů a závislosti) | stabilita, síla středu těla | `LOSS_OF_FLOOR_RISE_ABILITY`; vstupy `vstat_ze_zeme`, `floor_rise_test` | MODEL (síla středu těla bez vstupu) |
| 2 | Vynést nákup | dvě tašky po 5 kg do schodů (funkční síla) | síla úchopu | onboarding `vynest_nakup`; vstup `grip_strength` | MODEL |
| 3 | Zvednout vnouče | 15 kg dítě ze země do náruče (síla zad a nohou) | mrtvý tah | onboarding `zvednout_vnouce`; mrtvý tah bez vstupu | část. MODEL, metrika CHYBÍ |
| 4 | Dát kufr do police | 10–15 kg nad hlavu (mobilita ramen) | tlak nad hlavu | žádný uzel ani vstup | CHYBÍ |
| 5 | Vyjít 4 patra | bez zastavení a zadýchání (srdeční rezerva) | VO₂max | `vo2max_test` jako důkaz kondice; test „4 patra" se sbírá a nepoužije | VSTUP, bez uzlu |
| 6 | Balanc na jedné noze | 30 s na každé noze (prevence zlomenin krčku) | stabilita (DNS), rovnováha | `GAIT_INSTABILITY`; vstupy `balanc_jedna_noha`, `rovnovaha_zavrene_oci` | MODEL |
| 7 | Rychlá chůze (+ plavat/kolo) | 1 km svižným tempem (udržení mobility) | zóna 2 | žádný uzel; akční tagy `zona2`, `vytrvalost` | CHYBÍ jako uzel |
| 8 | Otevřít zavařovačku | síla prstů a dlaní (silná korelace s délkou života) | síla úchopu (dynamometr) | vstup `grip_strength` | MODEL |
| 9 | Vstát ze židle | dřep bez pomoci rukou (síla kvadricepsů) | síla dolních končetin | `LOW_MUSCLE_STRENGTH`; vstup `chair_stand_30s` | MODEL |
| 10 | Skočit a dopadnout | seskočit z obrubníku a ustát dopad (hustota kostí a reakce) | plyometrie, hustota kostí | žádný uzel; v modelu není ani zlomenina ani kost | CHYBÍ |

U řádku 10 je ručně napsáno „2." a pod listem slovo, které se mi nepodařilo spolehlivě přečíst (možná „Jiné"). Nechávám to na Josefovi.

**Ukazatele z tohoto listu (sloupec Metrika):** síla úchopu (2×), VO₂max, stabilita/rovnováha, zóna 2, mrtvý tah, tlak nad hlavu, síla dolních končetin, plyometrie a hustota kostí, síla středu těla. To je **devět různých metrik**, ne pět. Pět z `centenarian-decathlon.md` (VO₂max, úchop, jedna noha, tlak, HRV) se s listem shoduje u tří (VO₂max, úchop, jedna noha). Krevní tlak a HRV na listu nejsou.

**Úroveň 1 („výchozí sada")** na stejném listu: 1 metabolická stabilita, 2 energie a rovnováha dne, 3 pohybová kapacita, 4 síla a svalová rezerva, 5 kardiovaskulární odolnost, 6 regenerace a spánek. Přes tento seznam vede ručně nakreslená šikmá čára; nevím, zda znamená škrt. **Potřebuju potvrdit.**

**Poznámky na pravém okraji (čtení nejisté):** „4 jezdci: cukrovka, rakovina, kardio, demence"; „user inputs – personální: koleno, keto, anamnéza, (kolo)". Slabě psané položky jsem nepřečetl.

**Rozpory v číslech, které je třeba sjednotit** (stejná schopnost, jiná hodnota):
- stoj na jedné noze: 30 s na každé noze (list), 10 s se zavřenýma očima (onboarding a panel), 10 s (`stolety-desetibojar.md`); 30 s je i v pokynu akce.
- schody: 4 patra (list), 2. patro (onboarding), 2 patra (poznámka Mezní dekády).
- nákup: 2×5 kg (list), 5 kg (onboarding), 20 kg (panel).
Práh schopnosti (cíl) a test prognostický ani tréninková dávka není totéž (pravidlo 4 šablony).

**Bezpečnost:** řádek 10 (seskok a dopad) je pro starší lidi riziková plyometrie. Jako cíl schopnosti ho lze popsat, jako akci vyžaduje odborné posouzení a bezpečnostní bránu.

## 1 Další zdroje: v repu žádný pevný seznam 10 disciplín není
Slovo „deset" se objevuje v textu průvodce, ale žádný dokument deset disciplín nevyjmenovává. Různé zdroje dávají různé seznamy:

| Zdroj | Co uvádí | Počet |
|---|---|---|
| `centenarian-decathlon.md` | Čtyři pilíře: stabilita, síla, zóna 2, VO₂max | 4 |
| `app/guides/decathlon.html` | Síla, kardio, rovnováha, flexibilita (text říká „deset disciplín") | 4 |
| `stolety-desetibojar.md` | Stát na jedné noze 10 s, vstát ze země, nést tašky, 4 patra, zdvihnout vnouče | 5 |
| `marginal-decade-attia.md` (poznámka v kořeni) | Vstát ze země, zvednout vnouče, 2 patra schodů, donést nákup | 4 |
| `user-data-panel.js` `CAPACITY_QUESTIONS` | 4 patra, 20 kg, vstát ze země, stoj na jedné noze 10 s (oči zavřené), 2 km rychle, dech 20 s | 6 |
| `user-data-panel.js` `DECATHLON_GOALS` | plavání 0,5 km, běžky 5 km, kolo 2 h, hora 800 m, tenis, vnoučata, chůze 5 km, ovládat tělo | 8 |
| `onboarding-wizard.js` | vstát ze země, zvednout vnouče, nákup 2. patro, pád za rok, stoj zavřené oči | 5 |

**Závěr:** v repu je „10" jen název rámce a zdroje se rozcházejí. Seznam deseti disciplín existuje na Josefově ručně psaném listu (oddíl 0). Do repa ani do aplikace se nepřenesl.

## 2 Ukazatele: bylo jich 5, nebo víc?
- `centenarian-decathlon.md` (část „Měřitelné cíle") jmenuje **pět**: VO₂max, síla úchopu, test jedné nohy, krevní tlak, HRV. To odpovídá tomu, jak si je Josef pamatuje.
- `longevity-indicators.json` má **14** biomarkerů v šesti skupinách (spánek, metabolismus, stres, kardio, imunita, dýchání). Jde o ukázková data se zdroji Oura, Garmin a laboratoř, ne o seznam „kritických".
- `CAPACITY_QUESTIONS` má **6** funkčních testů.
Ukazatele tedy nejsou jednotně definované; pět jich je jen v jednom dokumentu.

## 3 Mapování na model (`data/engine/master.json`, `api/engine`)
Stav: `MODEL` = má uzel v master, `VSTUP` = engine čte hodnotu jako důkaz, `SBÍRÁ SE` = uloží se, ale engine ji nepoužívá, `CHYBÍ` = nic.

| Schopnost / ukazatel | Uzel / vstup v enginu | Stav |
|---|---|---|
| Vstát ze země | `LOSS_OF_FLOOR_RISE_ABILITY` (Goal Gateway), vstupy `vstat_ze_zeme`, `floor_rise_test` | MODEL |
| Svalová síla | `LOW_MUSCLE_STRENGTH`, vstupy `grip_strength`, `chair_stand_30s` | MODEL |
| Funkční rezerva | `REDUCED_FUNCTIONAL_RESERVE` | MODEL |
| Stabilita, rovnováha | `GAIT_INSTABILITY`, vstupy `balanc_jedna_noha`, `rovnovaha_zavrene_oci`, `tug_test`, `gait_stability` | MODEL |
| Riziko pádu | `FALL_RISK` (bez odchozí hrany) | MODEL, slepý konec |
| Pohybová nečinnost, ztráta kondice | `PHYSICAL_INACTIVITY`, `PHYSICAL_DECONDITIONING` | MODEL |
| VO₂max | `inference.js` ho zná jako důkaz kondice (`vo2max_test`); samostatný uzel aerobní kapacity není | VSTUP, bez uzlu |
| HRV | uloží se jako `lab_hrv`, orchestrátor se na něj umí zeptat; žádný uzel | SBÍRÁ SE |
| Krevní tlak | uzel `HYPERTENSION` | MODEL |
| 4 patra schodů, 20 kg, 2 km rychlou chůzí, dech 20 s | ukládají se do `capacity`; klíče `climb_4_floors`, `lift_20kg`, `fast_walk_2km`, `breath_20s` jsem v enginu nenašel | SBÍRÁ SE |
| Stoj na jedné noze 10 s | panel ukládá `stand_one_leg`; engine čte jiné klíče (`balanc_jedna_noha`) | rozdílné klíče, ověřit |
| Flexibilita, mobilita | žádný uzel | CHYBÍ |
| Zóna 2, vytrvalost | akční katalog (tagy `zona2`, `vytrvalost`), uzel není | CHYBÍ jako uzel |

## 4 Co z toho plyne
- **Funkční část Decathlonu (síla, vstávání, rovnováha, pád) už v modelu je**, pod názvem balíčku Stabilita. Balíček Stabilita je tedy ve skutečnosti část balíčku Decathlon.
- **Aerobní část (VO₂max, zóna 2, HRV) je nejslabší.** Chybí uzel aerobní kapacity. Přidání uzlu je rozšíření modelu a vyžaduje důkaz, že tu chybí významná cesta (CLAUDE.md, principy 1–5).
- **Několik testů se sbírá, ale engine je nepoužívá** (schody, 20 kg, 2 km, dech). Před přidáním dalších otázek je třeba rozhodnout, zda změní nějaké rozhodnutí o constraintu (princip 5).

## 5 Dopad na vzorová CRT
Zlatá CRT Josefa a Kovářové se nemění. Decathlon se přidá jako druhý pohled (co zvládáš) vedle CRT, které vysvětluje proč. Změna úrovně uzlů (například `FALL_RISK`) by měnila zlatý standard Kovářové a musela by se ověřit na obou případech.

## Otevřená rozhodnutí (Josef)
1. Potvrdit seznam z listu (oddíl 0) jako pevný, vyřešit rozpory v číslech a rozhodnout, zda je Úroveň 1 škrtnutá.
2. Zda je Decathlon samostatný produkt zdarma, nebo úvodní fáze plného CHJ.
3. Zda se přidá uzel aerobní kapacity a z jakého zdroje dat (hodinky, test).
4. Zda se sbírané, ale nepoužité testy mají napojit na model, nebo přestat sbírat.
