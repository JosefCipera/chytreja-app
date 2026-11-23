# CHJ BACKLOG — otevřené položky

> Jedno místo pro odložené/otevřené rozhodnutí a nápady, místo rozházení po
> jednorázových checkpoint souborech. Udržuje Claude průběžně; upozorní, když
> najde nesrovnalost mezi tímhle seznamem a realitou kódu.
> Založeno: 2026-11-17

---

## Produktová rozhodnutí čekající na zadání

- **"Proč" text pro `zvednout_vnouce` lže o bolesti** — `api/engine/orchestrator.js:1128`
  (`questions` map pro "Proč" vysvětlení) má `zvednout_vnouce: 'Nezvládáš zvednout
  těžší předmět ze země bez bolesti.'` — zděděno z konverzační formulace otázky na
  řádku 667 (`'Zvládneš zvednout dítě nebo těžší předmět ze země bez bolesti?'`).
  Ale Desetiboj formulář (`app/js/universe/user-data-panel.js:306`) pokládá na
  stejný evidence klíč jinou, novější otázku bez zmínky o bolesti ("Zvedneš 15 kg
  ze země do náruče?"). Výsledek: uživatel vidí "Proč: ... bez bolesti", i když se
  ho nikdo na bolest neptal. Reprodukováno živě 2026-11-23 (Josef, reset účtu,
  vyplnění Desetiboje → "Ne" na obě otázky → NBA dřepy [správně] + tenhle
  mylný "Proč" text [bug]). Oprava: přeformulovat řádek 1128 bez "bez bolesti" —
  je to 🔒 LOCKED soubor (`orchestrator.js`), takže počkat na dávku změn
  s regresní sadou, ne jednorázová úprava.

- **`LOW_MUSCLE_STRENGTH` vysvětlení je navázané na uzel, ne na konkrétní evidenci
  — stejná rodina jako bod výše** — `api/engine/orchestrator.js:221`
  (`NEXT_STEP_CS.LOW_MUSCLE_STRENGTH.nextStep`) a `:237`
  (`GOAL_GATEWAY_PHRASE_CS.LOSS_OF_FLOOR_RISE_ABILITY`) vždy citují "vstát ze
  země bez cizí pomoci" jako příklad, bez ohledu na to, která ze tří otázek
  (`vstat_ze_zeme`, `zvednout_vnouce`, `vynest_nakup`) uzel spustila — a bez
  kontroly, jestli už existuje přímo opačná, potvrzená evidence. Reprodukováno
  živě 2026-11-23 (Josef, `vstat_ze_zeme = Ano` explicitně, `zvednout_vnouce =
  Ne` spustilo LOW_MUSCLE_STRENGTH → text přesto tvrdil, že jde o vstávání ze
  země). Oprava pravděpodobně širší než jedna věta — potřeba rozhodnout, jestli
  NEXT_STEP_CS/GOAL_GATEWAY_PHRASE_CS mají začít rozlišovat podle
  question_id, ne jen podle node_id, a jestli/jak kontrolovat protichůdnou
  evidenci před použitím generického textu. LOCKED soubor — řešit v dávce
  spolu s bodem výše.

- **Lifestyle flagy bez enginové logiky** — `smoker`, `alcohol`, `stress_job` se
  v UI (Vstupní data → Profil) ukládají, ale engine je nikdy nečte
  (`api/engine/adapter.js` má `smoking_history`/`alcohol_history` natvrdo
  `'unknown'`; `stress_job` se nenačítá vůbec). Vědomě odloženo — UI text už
  to flaguje ("Ostatní zatím jen evidujeme pro budoucí rozšíření"). Až budeme
  řešit: nejdřív produktové rozhodnutí co každý flag má v enginu znamenat,
  pak implementace — ne obráceně.

- **Laik/expert terminologie sjednocení** — `DIAGNOSIS_LABEL_CS` v
  `app/js/universe/user-data-panel.js` (české názvy diagnóz pro zobrazení) a
  `data/io-map/io-map.json`'s `label_expert`/`label_layman` páry (CRT
  goal-tree nody) jsou dvě oddělené, nepropojené tabulky se stejným duchem
  ale bez sdíleného zdroje pravdy. Možná zajímavé před vícejazyčnou verzí.
  Queued jako task (viz spawn_task "Unify diagnosis labels with io-map
  laik/expert glossary").

- **Chybějící/nevyužité lab fieldy** — kyselina močová není v `LAB_FIELDS`
  (ale `HYPERURICEMIA` v `DIAG_KEYWORDS` existuje); PSA a fasting_insulin
  jsou v `LAB_FIELDS`, ale bez enginového využití. Vědomě ponecháno beze
  změny ("to neni system").

- **"Desetiboj dlouhověkosti" (Attia Centenarian Decathlon) — IP riziko** —
  posouzeno jako nízké (obecná myšlenka + standardní klinické funkční testy,
  ne doslovný překlad), ale není to právní rada. Před komerčním spuštěním
  stojí za to nechat ověřit od IP advokáta.

- **Variabilita formulací odpovědí** — hypotetický nápad (ne zadání): více
  frazeologických variant stejné odpovědi, deterministicky rotovaných, aby
  odpovědi CHJ nepůsobily "robotičtěji" při opakovaném použití. Nezapočato.

- **Širší audit kvality AI textů napříč celou appkou** — na začátku dnešní
  session zmíněno jako "bod 1", pak odloženo ve prospěch systematického
  textového auditu 4 oblastí (nadváha/pohyb/síla/rovnováha), který proběhl.
  Zbytek appky (mimo těchto 4 oblastí) zatím neauditován.

## Otevřené architektonické rozhodnutí — cross-context bezpečnostní blokace

**Zjištěno 2026-11-17** (ne specifické pro pád — obecná vlastnost `decisionGate.js`):
`DAILY_DECISION.mode = ACT`, jakmile je ALESPOŇ JEDEN kontext `EVIDENCE_SUFFICIENT`,
bez ohledu na to, že JINÝ kontext může mít potvrzený nález s vlastní nevyřešenou
`missing_evidence`, která se nikdy nepoužije (NBE se generuje jen pro kontexty
`NEED_MORE_EVIDENCE` — jakmile je kontext `EVIDENCE_SUFFICIENT`, jeho vlastní
`missing_evidence` se ignoruje).

Konkrétní ověřený příklad: `FALL_RISK CONFIRMED` (kontext `FUNCTIONAL_MOBILITY`)
je sám o sobě vyhodnocen jako `EVIDENCE_SUFFICIENT` → jeho `missing_evidence`
(gait_stability, TUG test) se nikdy nezeptá → zároveň `LONGEVITY_FUNCTION`
kontext (`PHYSICAL_INACTIVITY`) je taky sufficient → globální `ACT`. Jediná
pojistka dnes je akčně-úrovňová bezpečnostní brána v `nextBestAction.js`,
která ale reaguje jen na `GAIT_INSTABILITY`, ne na `FALL_RISK` samotné.

**Otázka pro produktové rozhodnutí:** má potvrzený, ale ne plně prošetřený
nález v JEDNOM kontextu (CRT) brzdit/gatovat akci v JINÉM kontextu, dokud se
nedovyšetří? Dopad je široký (týká se obecně interakce mezi všemi CRT
kontexty, ne jen `FALL_RISK` × `PHYSICAL_INACTIVITY`) — nejde o jednořádkovou
opravu, potřebuje promyšlenou politiku dřív, než se implementuje.

## Baterie života (logo na úvodní obrazovce) — jak má počítat hodnotu

**Zjištěno 2026-11-17.** `api/hud-data-bulk.js` (`worstLeaf()` + `rawBatteryPercent`):
baterie pro kořenový uzel ("dlouhověkost") se počítá jako hodnota **nejslabšího
leaf uzlu** v celém stromu universe (rekurzivně přes všechny vnuky), ne jako
průměr/vážený součet. Jediná úprava je následné promítnutí CRT barvy (RED≤40,
YELLOW 41–70) přes `crtColorMap`. Doslova: jeden slabý vedlejší metrik stáhne
baterii dolů bez ohledu na to, jak dobře je na tom všechno ostatní.

Josef (2026-11-17): rozhodně ne takhle — "nejslabší uzel" odmítnuto.

**Návrh projednaný 2026-11-19 (design/research, kód NENÍ napsán — odloženo,
"jeste to nechame uzrat, pozdeji se k tomu vratime"):**

Místo "nejslabší uzel" baterie zpočátku (MVP) vychází jen z **VO2max** —
inspirace Attiiným desetibojem, kde VO2max je hlavní ukazatel. Přesnost
zatím nemusí být vysoká ("nemusi to byt super presne").

- **Vstup VO2max:** buď reálně naměřený (wearable, např. Oura prsten —
  uživatel ho zadá/importuje), nebo odhadnutý z neexercise rovnice
  (Jackson et al. 1990, BMI verze — koeficienty jen ze sekundárních zdrojů,
  needověřeno proti originálnímu článku):
  `VO2max = 56.363 + 1.921×PAR − 0.381×Age − 0.754×BMI + 10.987×Gender(muž=1,žena=0)`
  kde PAR = aktivita 0–7 (NASA/JSC škála).
  Jediný chybějící vstup oproti tomu, co už evidujeme (věk, výška, váha,
  pohlaví): **aktivita/PAR** — tu zatím nikde nesbíráme.
  Ověřeno na reálném vzorku: odhad vyšel o ~12–15 % výš než reálná hodnota
  z prstenu (46–48 vs. 41–42 ml/kg/min) — rozdíl v rámci očekávané
  nepřesnosti rovnice (R²≈0,6), ne nutně chyba výpočtu, ale koeficienty
  stojí za ověření, než se bude brát jako finální.

- **Referenční tabulka (norské populační průměry VO2max, ml/kg/min, zdroj:
  NTNU "Norwegian Fitness Numbers" — populační průměry, NE zdravotní cíle):**
  | Věk | Muž | Žena |
  |---|---|---|
  | 20–29 | 54 | 43 |
  | 30–39 | 49 | 40 |
  | 40–49 | 47 | 38 |
  | 50–59 | 42 | 34 |
  | 60–69 | 39 | 31 |
  | 70+ | 34 | 27 |

- **Baterie = rezerva mezi "dnem" a "cílem ve 100 letech", NE age-adjusted
  porovnání s vrstevníky** (schválený princip: "pak by pro dlouhovek
  stacilo muz/zeny a tecka" — bez závislosti na věku v cílové hodnotě):
  - **Strop (100 %)** = hodnota 70+ z tabulky výše (34 muž / 27 žena) —
    použita jako zástupný cíl "fit jako průměrný 70letý ve 100 letech",
    protože dál extrapolovat bez dat by byla čistá spekulace.
  - **Dno (0 %)** = 15 ml/kg/min (obě pohlaví) — geriatricky citovaná
    hranice, pod kterou běžné ADL (chůze, schody, vstávání) jsou vážně
    ohrožené; needověřeno proti primárnímu zdroji, ale konzervativní a
    rozumné jako první aproximace.
  - **Vzorec:** `baterie % = (aktuální VO2max − 15) / (cíl_pohlaví − 15) × 100`,
    ořezáno na 0–100 %.
  - **Pásma:** 🔴 0–33 % · 🟡 34–66 % · 🟢 67–100 %.

  Ověřeno na 2 příkladech:
  - Muž 30 let, 187 cm, 90 kg, aktivita 5–6, prsten 41–42 → baterie ≈100 %
    (zelená).
  - Muž 69 let, 180 cm, 97 kg, aktivita 3–4 (odhad VO2max 24–26) → baterie
    ≈48–59 % (žlutá).

- **Co chybí k implementaci:** (1) nová otázka na aktivitu/PAR (0–7, česká
  stupnice) + místo k uložení (nová kolonka `user_profiles`, obdoba
  `gender`); (2) výpočetní funkce BMI→Jackson→VO2max→baterie %; (3) náhrada
  natvrdo žluté čáry v UI skutečnou vypočtenou hodnotou/barvou — zasahuje
  `api/hud-data-bulk.js` a případně `universe-core.js`/`universe-init.js`
  (⚠️ JÁDRO Vesmír, ne LOCKED, ale chráněné — potvrdit před zásahem).

  **Status:** schváleno jako směr, implementace vědomě odložena — "jeste to
  nechame uzrat". Nezapočato.

## Denní akce — "1 hlavní + 3 volné" místo jediné akce (koncept, nezapočato)

**Projednáno 2026-11-19 (design/koncept, kód NENÍ napsán).** Vychází ze starého
"vesmíru" (demo `dev.iting.cz/ukazka` — uzly Tělo/Mysl/Zdraví/Výživa, viz
screenshot v konverzaci) a z potvrzení, že šlo o variantu, kde uživatel dostává
víc než jednu akci a sám se rozhoduje, zda udělá jen hlavní, nebo si přibere
další. Cíl: ne týdenní/jiné plány — jednoduchá denní volba.

**Rozsah pro MVP:** vychází z decathlonu — **4 užší kritické oblasti**, co už
tato session auditovala (nadváha/pohyb/svalová síla/rovnováha), NE ze
širších "vesmírných" kategorií (Tělo/Mysl/Zdraví/Výživa) — na ty se přejde
později při rozšiřování na celou "dlouhověkost". Nadváha je sama o sobě
"rozsplracovaná" (viz jiná sekce) — ponechat zatím beze změny i v tomhle
konceptu.

**Mechanismus (žádné nové nezávislé leverage běhy pro vedlejší oblasti):**
- **Hlavní akce** = beze změny — dnešní `system_constraint`/`NBA.selected`,
  jeden globální běh přes celé CRT, stejný jako dnes.
- **3 zbylé (nevybrané) oblasti** = NEhledá se pro ně nejlepší/optimální akce
  rankingem (`buildCandidates`/`selectBestCandidate`). Místo toho se vezme
  **tier-1 akce dané intervence** (stejná, jakou by engine použil jako
  startovní bod) a pustí se přes **Safety Gate** (jen bezpečnostní kontrola
  jedné konkrétní akce — ne celý ranking/candidate-building). Hard boundary
  "Safety Gate se neobchází" zůstává nedotčená.
- Modalita pomůcky (chůze bez/s berlou/holemi/chodítkem) se nevybírá nově —
  recykluje se existující `DEVICE_FIT`/`mobilityProfile` logika.
- Ověřeno v živém katalogu (`longevity_actions`): plavání v katalogu vůbec
  není; chůze a kolo jsou už dnes svázané do jedné tier-1 položky ("Svižná
  chůze nebo kolo — 20 minut") — žádný nový výběrový algoritmus mezi sporty
  tedy není potřeba, katalog to řeší sám.

**Progrese obtížnosti ve "volné" oblasti — rozhodnuto:**
Zvažovali jsme streak counter ("3× v řadě → posun"), ale zjištění:
1. Stará hodnota "streak ≥ 3" v `docs/archive/HANDBOOK-v0.3.0-2026-06-05.md`
   je z úplně jiného, dnes nepoužívaného game-loop systému (index +5/-3,
   `mission_log`) a sloužila jen k motivační hlášce, ne k posunu obtížnosti —
   nedá se recyklovat jako ověřená hodnota.
2. Web research (Otago program, ACSM) — žádný z nich nepoužívá pevný
   počet opakování/dnů pro posun obtížnosti; profesionální programy to
   posuzují podle reálného výkonu (instruktor/zpětná vazba), ne podle čísla.
   Žádné "ověřené" číslo tedy není k dispozici.

**Finální rozhodnutí (Josef, 2026-11-19):** žádné počítání/streak. Místo toho
přímý dotaz uživateli, explicitně rozdělený na dvě možnosti (aby člověka
neubíjelo "totéž, jen těžší"):
- *"Chceš těžší variantu stejného cviku?"* → zkusí se next-tier stejné
  intervence (přes Safety Gate; pokud neprojde nebo vyšší tier neexistuje,
  padá se na druhou možnost).
- *"Chceš jinou akci?"* → nabídne se tier-1 jiné intervence ze stejné oblasti.

Žádný persistentní stav navíc není potřeba (jen případně "u téhle intervence
je už dál", ne počet opakování).

**Otevřeno, nezapočato:** samotná implementace (potřebuje nejdřív potvrzení,
než se sáhne na `nextBestAction.js`/`dailyDecision.js`/`orchestrator.js` —
LOCKED core soubory). Druhá, oddělená myšlenka z téhle debaty — "odvádění"
(hlasové hlášení, co uživatel udělal) a jak to měřit pro motivaci k
udržení/zlepšení — zatím vůbec neprobráno, čeká na samostatnou diskuzi.

### Vizuální koncept hlavní+druhá akce (ověřeno živě, 2026-11-20)

**Pozor — nahrazuje dřívější chybný zápis z 2026-11-19 níže.** Ten vycházel
jen ze čtení kódu `app/js/universe/universe-panel.js` (vanilla JS HUD) a
tvrdil, že box dokončené hlavní akce po "Hotovo" **zůstává nahoře** a
nabídka druhé akce se jen přidá pod něj. To bylo ověřeno jako nesprávné.

**Skutečný historický vzor je ve DRUHÉ, oddělené implementaci:**
`src/lib/components/hud/*.svelte` (Svelte, `ActionProtocol.svelte` +
`SecondAction.svelte`, orchestrováno v `src/App.svelte`/`HudPanel.svelte`,
spouští se přes `npm run dev:hud` / `hud.html`). Vizuálně přesně odpovídá
screenshotu z `dev.iting.cz/ukazka` (cyan terminálový styl, "KILLER:"/
"ACTION:" štítky, "SYSTEM_ONLINE"/"CHJ_v0.2" patička) — to je ta verze,
kterou si Josef pamatoval.

**Ověřeno živě** (reálně spuštěný Vite+Svelte dev server, `hud.html?dev=1`,
Playwright screenshoty — ne čtení kódu nazpaměť):
1. Hlavní akce: "▶ START PROTOCOL" → běžící timer "00:59" + "⏹ STOP" →
   "[COMPLETE]" / "✓ HOTOVO".
2. **Celá karta akce (KILLER+ACTION box) se PO DOKONČENÍ NAHRADÍ** —
   nezůstává nad nabídkou. Místo ní se objeví samostatný box "SECOND_ACTION"
   / "Chceš jít dál?" / tlačítka **ANO** / **NE** (velká písmena).
3. Po "ANO" appka reálně volá `/api/agents` pro čerstvou druhou akci
   (`excludeActionId`, aby se neopakovala ta první) — tedy AI/agent vybíral
   akci, ne pevný seznam. **Tohle chování ale vědomě nereplikujeme** — je to
   z jiné, starší architektury, kde AI vybírala akci, což dnešní `CLAUDE.md`
   hard boundary zakazuje ("Orchestrator nevyrábí vlastní zdravotní
   rozhodnutí", "NBA vybírá action"). Zůstáváme u dřívější dohody:
   deterministická výchozí tier-1 akce + Safety Gate, žádný AI agent na
   výběr — to je bezpečnější i konzistentnější s dnešní architekturou než
   tenhle starý prototyp.
4. `shouldOfferSecond()` v `App.svelte` v TÉHLE verzi nabízí druhou akci
   VŽDY (`offer: true` ve všech větvích) — mění se jen text, ne
   pravděpodobnost. To je jiné než vanilla JS verze (50/50 v části případů).

**Vizuální návrh pro dnešní launcher** (ve stylu dnešního launcheru, ne
cyan terminálu — to je jiná vizuální identita) musí být přepracován na
replace-vzor (karta akce zmizí, nahradí ji nabídka; po Ano se nahradí znovu
kartou druhé akce) — artefakt (Design canvas) bude opraven ve stejném duchu.

### Ukládání a vyhodnocení dokončených akcí — není nutné nic nového navrhovat

**Zjištěno 2026-11-19.** Dnes: klik na "Hotovo" pošle text jako chat zprávu,
AI klasifikátor → `ACTION_COMPLETED` → `persistActionAssignment()` v
`api/engine/healthEventAdapter.js` zapíše řádek do Supabase `action_assignments`
(`user_id`, `action_id`, `intervention_id`, `status`, `completed_at`, datum).

**Proč to ukládat — už existuje vyhodnocovací modul:** `api/engine/adherence.js`
("Feedback Loop v0.1") z těchto záznamů počítá:
1. `computeInterventionExposure()` — behaviorální fakt (kolik sezení dokončeno/
   skipnuto, za jak dlouho) — žádné zdravotní tvrzení.
2. `evaluateResponseEvaluations()` — porovná expozici s `expected_responses`
   z `data/engine/intervention-map.json` (cílový ukazatel, očekávaný směr,
   minimální expozice/dny, než se dá cokoliv usuzovat) → výsledek `TOO_EARLY` /
   `INSUFFICIENT_EXPOSURE` / `CONSISTENT_WITH_EXPECTED_RESPONSE` /
   `NO_RESPONSE_OBSERVED`. Nikdy netvrdí příčinnost (jen korelace), nikdy
   neudělá negativní závěr bez splněného minima expozice.

Výsledek ovlivňuje `nextBestAction.js` jen jako tiebreaker (krok 10 v
řazení kandidátů) — nikdy nepřepisuje bezpečnost/páku.

**Blokující zjištění pro tenhle koncept:** `persistActionAssignment()` má
dnes tvrdý guard — **jen JEDNO `COMPLETED` za den se uloží** ("day already
completed — no additional completion persisted"). Dokončení "volné" druhé
akce by se dnes tiše zahodilo a nikdy by se nedostalo do
`INTERVENTION_EXPOSURE` pro tu intervenci → vyhodnocení by pro ni nikdy
neproběhlo. Guard je potřeba upravit na dedupe podle `action_id` (ne podle
"je dnes vůbec něco hotovo"), aby šlo uložit hlavní i volnou akci zvlášť a
pořád zabránit duplicitě téže akce.

**Rozhodnutí o pořadí implementace (Josef, 2026-11-19):** nedělat všech
4 oblasti najednou. Nejdřív ověřit celý mechanismus (guard fix + výchozí
akce + Safety Gate + Ano/Ne nabídka + progresní dotaz "těžší/jiná") na
**JEDNÉ** volné oblasti, naživo na `dev.iting.cz`. Teprve po ověření
rozšířit na zbylé 2 (hlavní + 1 ze 3 volných oblastí pro MVP, nadváha
zůstává rozpracovaná/beze změny).

### Implementační postup — stav k 2026-11-20

1. ✅ **Guard fix hotový a pushnutý** (commit `ae363ada`) — dedupe v
   `persistActionAssignment()` teď scoped podle `action_id`, ne podle "je
   dnes vůbec něco hotovo". Ověřeno izolovaným testem s mock Supabase
   klientem (esmock): retry téže akce stále zablokován, jiná akce ve
   stejný den se uloží.

2. **Rozhodnuto (Josef, 2026-11-20):** zápis dokončení "volné" akce
   NEPŮJDE přes `applyHealthEvent()` (ten po uložení vždy znovu spustí
   celý enginový pipeline — activation→inference→decisionGate→
   systemLeverage→nextBestAction→dailyDecision — jen kvůli jednomu
   zápisu do DB, a vrátil by novou ACT/HOLD odpověď o HLAVNÍ akci, kterou
   bychom museli zahazovat, s rizikem nechtěného zásahu do session stavu
   hlavní akce). Místo toho: **odlehčená cesta** — exportovat/zpřístupnit
   existující `persistActionAssignment()` z `healthEventAdapter.js` a
   volat ji přímo, bez re-run enginu. Čistě odděluje "zaznamenej
   dokončení" od "rozhodni, co dál" — přesně v duchu rozhodnutí
   needělat nový leverage běh pro volnou akci. Nezapočato.

**Očekává se ještě třetí navazující krok** (zatím nespecifikovaný,
Josef 2026-11-20) — bude upřesněn později.

## Bezpečnostní scénáře k dalšímu prozkoumání

`scripts/test-safety-scenarios.mjs` — rostoucí sada, začátá 2026-11-17.
Další kandidáti na přidání (ne zatím otestováno):
- Drogy / jiné léky s bezpečnostním významem (ne jen "léky na ředění krve",
  co nikam nezapadá) — až se objeví konkrétní testovací případ.
- Kombinace více současně aktivních constraintů (CV + funkční + metabolický)
  a jejich vzájemná priorita.

## Rozhodnuto, ponecháno beze změny (pro referenci, ne akce)

- Height/weight NEpřidávat do bootstrap-needs.json jako vysokou prioritu —
  čistý "ptej se jen, když je potřeba" přístup zůstává.
- Sex/gender JE v bootstrap-needs.json (přidáno 2026-11-16) — jediná
  výjimka, protože engine ho reálně používá (CV riziko ≥65 let) a dřív se
  nikdy neptal.
