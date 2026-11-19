# CHJ BACKLOG — otevřené položky

> Jedno místo pro odložené/otevřené rozhodnutí a nápady, místo rozházení po
> jednorázových checkpoint souborech. Udržuje Claude průběžně; upozorní, když
> najde nesrovnalost mezi tímhle seznamem a realitou kódu.
> Založeno: 2026-11-17

---

## Produktová rozhodnutí čekající na zadání

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
