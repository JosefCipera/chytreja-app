# Decathlon: soupis zdrojů, disciplín a ukazatelů ↔ uzly modelu

Stav: **podklad k rozhodnutí, bez změny kódu.** Sestaveno 20. 10. 2026 z dokumentů v repu. Účel: ukázat, co už máme a co chybí, než se rozhodne, zda Decathlon bude úvodní (volná) vrstva před balíčky srdce, cukrovky a ED.

## 1 Nález: pevný seznam 10 disciplín v repu neexistuje
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

**Závěr:** „10" je název rámce, ne seznam. Než půjde Decathlon do produktu, musí se seznam disciplín určit (viz otevřená rozhodnutí).

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
1. Pevný seznam disciplín a ukazatelů (tento dokument jen soupisuje, co v repu je).
2. Zda je Decathlon samostatný produkt zdarma, nebo úvodní fáze plného CHJ.
3. Zda se přidá uzel aerobní kapacity a z jakého zdroje dat (hodinky, test).
4. Zda se sbírané, ale nepoužité testy mají napojit na model, nebo přestat sbírat.
