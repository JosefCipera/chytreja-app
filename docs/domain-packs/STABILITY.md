# Balíček: Stabilita (nestabilní chůze, svalová síla, riziko pádu)

Stav: **rozpracováno; technicky funkční, klinická vhodnost dávek a podmínek zastavení neuzavřená.** Vyplněno podle [šablony](../DOMAIN-PACK-TEMPLATE.md) z `main` `699135aa`. Věci označené `NEVÍME` mají uvedené, co chybí.

## Přehled stavu

| # | Krok | Stav | Poznámka |
|---|---|---|---|
| 1 | Rozsah | ČÁSTEČNĚ | Schválen Josefem (dlouhověkost podle CRT, starší lidé, tykání). Chybí věková hranice a potvrzení odborníka. |
| 2 | Větev z master CRT | HOTOVO | Vazby ověřeny v `master.json`. |
| 3 | Vstupy a aktivace | ČÁSTEČNĚ | Aktivace popsána; zdroj pro TUG a práh síly 2 chybí (`NEVÍME`). |
| 4 | Mapa intervencí | ČÁSTEČNĚ | 3 intervence; citace v `intervention-map.json` mají chyby (viz audit citací). |
| 5 | Akce a bezpečnost | VYŽADUJE ODBORNÍKA | Brány existují; **zdroj dávku nestanovuje** u 30 s stoje, 5 vstání ani chůze. |
| 6 | Slovník vysvětlení | ČÁSTEČNĚ | Tabulky pro uzly existují; přepsaný pokyn má jen židle. |
| 7 | Automatické testy | ČÁSTEČNĚ | Matice (768/768) a testy existují; pořadí kolize určuje model, zůstává otázka počtu uzlů. |
| 8 | Ruční ověření | OTEVŘENO | Čeká na odborné posouzení čtyř vstupních akcí a na Josefa. |

## 1 Rozsah (schváleno Josefem 20. 10. 2026, doplnit odborník)
**Řeší:** nejistotu při chůzi, slabost nohou (vstávání ze židle a ze země) a riziko pádu jako důsledek, vždy v rámci dlouhověkosti podle modelu CRT. Podporované cvičení a pomůcky jako zdroj opory.
**Neřeší:** příčinu nejistoty (neurologické, ortostatické, zrakové, lékové), akutní stavy (závrať, ztráta vědomí, pád se zraněním), léčbu neuropatie, předepisování pomůcek.
**Hranice:** při pádu, bolesti, závrati, zraněném pádu nebo neschopnosti vstát doporučí odborné posouzení; nediagnostikuje. Dotazy mimo tento rámec Chytré já **slušně odmítne** (že to neřeší).
**Cílová populace:** starší lidé, referenční model Kovářová; oslovení tykáním. Přesná věková hranice a vstupní kritéria: `NEVÍME` (nejsou definována v kódu ani v rozhodnutí).

## 2 Větev z master CRT (ověřeno v `data/engine/master.json`)
- `PERIPHERAL_NEUROPATHY` → `GAIT_INSTABILITY`
- `PHYSICAL_DECONDITIONING` → `LOW_MUSCLE_STRENGTH` → `GAIT_INSTABILITY`
- `LOW_MUSCLE_STRENGTH` → `REDUCED_FUNCTIONAL_RESERVE`
- `GAIT_INSTABILITY` → `FALL_RISK`
- Goal Gateway `LOSS_OF_FLOOR_RISE_ABILITY` (větev FUNCTIONAL_INDEPENDENCE): dosažitelný ze svalové slabosti.
Pádové a funkční uzly nemají žádné nové vazby navíc.

## 3 Vstupy a aktivace (`api/engine/inference.js`, `activation.js`)
`GAIT_INSTABILITY` vzniká jako `PREDICTED_CURRENT` při síle signálů ≥ 2:
- hlášená aktuální nejistota při chůzi (`gait_instability_reported`) +2
- záporná odpověď na „stabilní chůze" (`gait_stability`) +2
- potvrzená `PERIPHERAL_NEUROPATHY`, signály ze `LOW_MUSCLE_STRENGTH`, selhání jednonožného stoje, podpůrný signál zavřených očí
- `recent_falls` je jen podpůrný signál (+1) a přímý důkaz pro `FALL_RISK` (interní pravidlo: pád za 12 měsíců = `FALL_RISK` CONFIRMED, není definice NICE)
`CONFIRMED` stav nestability vyžaduje přímé hodnocení chůze/rovnováhy; kód ho z dotazníku nenastaví. Doplňující vstupy: `tug_test`, `current_assistive_device`, `instability_laterality`, `chair_stand_30s`, `grip_strength`, `floor_rise_test`, `vstat_ze_zeme` (patří k větvi svalové síly).
**Otevřeno:** zdroj prahu síly 2 a pro TUG jako „klinicky validovaný marker" (`NEVÍME`; nepoužívat NICE NG147, která se týká jiné oblasti).

## 4 Mapa intervencí (`data/engine/intervention-map.json`)
| Vedoucí uzel | Intervence | Protokoly | Cíle (mechanismy) |
|---|---|---|---|
| `LOW_MUSCLE_STRENGTH` | `FUNCTIONAL_STRENGTH_TRAINING` | `FUNKCNI_SILOVY_PROTOKOL` (tag `sit_to_stand`) | svalová síla, funkční rezerva |
| `GAIT_INSTABILITY` | `BALANCE_TRAINING` | `BALANCE_PROTOKOL`, `STABILITY_PROTOKOL` | nestabilita, riziko pádu, svalová síla |
| `GAIT_INSTABILITY` | `SAFE_SUPPORTED_MOBILITY` | `ASSISTIVE_PROTOKOL` | nestabilita, riziko pádu |
Katalog: 1 funkční silová akce, 3 balanční, 7 stabilizačních, 4 asistivní.
**Otevřeno:** citace v mapě mají chyby (NG147, NG194, Phys Ther 2005, Rikli & Jones J Aging Phys Act); každé tvrzení se musí opravit podle jeho skutečného zdroje, ne jen přečíslovat.

## 5 Akce a bezpečnost
**Brány (`api/engine/nextBestAction.js`):**
- predikovaná nestabilita + chůze bez pomůcky → `NEEDS_MORE_EVIDENCE` (ptá se na stabilitu chůze; bez zodpovězení nic nenabídne)
- balance/stabilita při nestabilitě → `SAFE_WITH_MODIFICATION`: opora u zdi nebo židle, oči otevřené, zastavit při bolesti, závrati nebo ztrátě rovnováhy, první cvičení s doprovodem
- zavřené oči nebo nestabilní podložka při nestabilitě → `NEEDS_CLINICAL_CLEARANCE`
- jednonohý sestup z bedny při nestabilitě → `NEEDS_CLINICAL_CLEARANCE`
- pomůcky (`ASSISTIVE_PROTOKOL`) → hodnocení `DEVICE_FIT` (shoda s typem a stranností nestability)
- potvrzené CV riziko + silové cvičení → úpravy (měřit tlak, nezadržovat dech, zastavit při bolesti na hrudi)
**Stav akcí:** čtyři vstupní akce jsou v [klinickém podkladu](../FOUR-ENTRY-ACTIONS-CLINICAL-REVIEW-2026-10-14.md). Z toho do tohoto balíčku patří vstávání ze židle a stoj na jedné noze 30 s.
**Zdroj dávku nestanovuje:** 5 vstání ze židle (5× sit-to-stand je test, ne tréninková dávka), 30 s stoj na jedné noze (10 s u osob 51–75 let a 5 s u osob 60+ jsou prognostické testové prahy, ne tréninková dávka), chůze 20 min pro nestabilní.
**Vyžaduje odborníka:** dávka, podmínky zastavení, vhodnost bez dohledu u uživatele s nestabilitou, oddělení testu od tréninku.

## 6 Slovník vysvětlení (`api/engine/orchestrator.js`, `action-instructions.json`)
- Tabulky pro uzly stability a svalové síly existují (subjekt „Proč?", krok „Kam to směřuje?", mechanismus „Co tím změním?").
- Přepsaný pokyn má jen `sit_to_stand_supported`; ostatní akce používají katalogový název.
- **Otevřeno:** pokyny pro balanční akce (opora, oči, zastavení) jsou dnes vázané na příznak nestability v bráně, ne na samotnou akci.

## 7 Testy
- `scripts/test-gait-stability-resolution.mjs` (řešení odpovědí o stabilitě)
- `scripts/ai-tester/run-gait.mjs`, `run-gait-matrix.mjs` (syntetické profily a kombinace)
- `scripts/test-functional-strength-training.mjs` + `test-functional-strength-training-e2e.mjs`
- `scripts/test-nba-kovarova.mjs` (referenční případ Kovářová)
- `scripts/ai-tester/floor-rise.json`, `run-floor-rise.mjs`
**Kolize „nadváha + nejistá chůze":** pořadí určuje model (`systemLeverage.js`: vliv napříč oblastmi → dosah v kauzálním řetězci → změnitelnost), ne ruční rozhodnutí. Kód ji jen označuje `GAIT_REQUEST_ADIPOSITY_PRIORITY` ke kontrole. Ve všech 192 syntetických průbězích s nadváhou a nejistotou při chůzi text „Proč?" nejistotu při chůzi zmiňuje. Selhání `priority-explanation` v `run-gait --probe` vzniká tím, že probe režim údaj o chůzi neuloží, a nepovažuje se za chybu produktu.
**Otevřeno:** pořadí je dnes dáno počtem uzlů (nadváha 6 navazujících uzlů, nestabilita 1) a nezohledňuje závažnost; to je otázka modelu, ne tohoto balíčku. Chybí test, že balanční pokyn obsahuje oporu i mimo příznak nestability.

## 8 Ruční ověření
Josef projde jeden souvislý scénář: „nejistá chůze" → otázka na stabilitu → podporovaný krok → „Proč?" → „Kam směřuješ?" → „Co tím změníš?". Posoudí srozumitelnost a důvěru, ne klinickou správnost.

## Otevřená rozhodnutí (Josef)
1. Doplnit věkovou hranici a vstupní kritéria cílové populace (rozsah a tykání starším jsou schváleny).
2. ~~Pravidlo pro kolizi „nadváha vs. nestabilita"~~ — rozhoduje model (viz krok 7), ne Josef. Otevřená zůstává jen otázka, zda pořadí podle počtu uzlů odpovídá cíli „4 killers → priorita".
3. Zda se u balančních akcí mají opora a oči otevřené stát součástí pokynu vždy.

## Otázky pro odborníka (fyzioterapeut)
1. Doba držení, série a frekvence stoje na jedné noze pro vstupního uživatele s nestabilitou; přijatelnost bez dohledu.
2. Počet a tempo vstávání ze židle, frekvence a progrese.
3. Co je nutné zjistit, než se nabídne cvičení; kdy se posílá na posouzení.
4. Hranice mezi „podporované cvičení" a „vyžaduje posouzení".
