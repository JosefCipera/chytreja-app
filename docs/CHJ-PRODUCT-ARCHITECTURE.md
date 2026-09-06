# CHJ Product Architecture — Zamčená ústava

> **Canonical product architecture document.** Stav k: 2026-08-15  
> Vychází z: `docs/archive/CHJ-ARCHITECTURE-V2.md` (2026-08-13)  
> Technický detail Health Engine: `docs/archive/CHJ-ARCHITECTURE-V1.md`

---

## ★ CHJ LONGEVITY — 5 NEMĚNNÝCH PRODUKTOVÝCH PRINCIPŮ

> Tyto principy jsou nadřazené všem implementačním rozhodnutím. Každá navržená změna — nová otázka, nový node, nový datový zdroj, nové chování — musí projít tímto filtrem. Pokud navržená změna odporuje některému principu, neimplementuj ji bez explicitního product rozhodnutí.

**1. NEŘEŠÍME CELÉ ZDRAVÍ.**
CHJ řeší longevity: co člověku nejpravděpodobněji vezme roky života nebo roky soběstačnosti. Ne každá diagnóza, abnormalita nebo zdravotní údaj patří do modelu.

**2. NEVYTVÁŘÍME KAŽDÉHO ČLOVĚKA OD NULY.**
Základem jsou vzorové kauzální cesty nejvýznamnějších longevity problémů, vytvářené a ověřované mimo jiné na referenčních případech Josef a Kovářová. Tyto vzory postupně zpřesňujeme a pouze podle potřeby doplňujeme.

**3. OSOBNÍ CRT SE SKLÁDÁ ZE ZNÁMÝCH LONGEVITY KAUZÁLNÍCH CEST.**
Evidence konkrétního člověka určuje, které části vzorových cest jsou relevantní, potvrzené, pravděpodobné nebo neznámé. CRT má pomáhat vidět i kauzální cesty k problémům, které člověk ještě nemá nebo o nich neví.

**4. NEHLEDÁME VŠECHNY PROBLÉMY. HLEDÁME CONSTRAINT.**
TOC nad osobním CRT hledá místo / kauzální cestu, kde zásah může nejvíce zlepšit očekávanou longevity a dlouhodobou funkčnost člověka. Výstupem CHJ nemá být seznam všeho špatného, ale priorita a největší páka.

**5. DISCOVERY NENÍ SBĚR ZDRAVOTNÍ ANAMNÉZY. DISCOVERY JE HLEDÁNÍ CONSTRAINTU V PROSTORU ZNÁMÝCH LONGEVITY KAUZÁLNÍCH CEST.**
CHJ se ptá pouze tehdy, když odpověď může změnit výběr, pořadí nebo ověření constraintu. Více dostupných dat má znamenat méně otázek a přesnější rozhodnutí — nikoli rozšiřování CHJ na obecný zdravotní systém.

---

**NOVÁ DATA NEJSOU DŮVODEM ROZŠIŘOVAT MODEL.**
Nový model přidáváme pouze tehdy, když nám chybí významná longevity kauzální cesta.

**NOVÁ OTÁZKA NEVZNIKÁ PROTO, ŽE JE ZDRAVOTNĚ ZAJÍMAVÁ.**
Vzniká pouze tehdy, když její odpověď může změnit rozhodnutí o longevity constraintu.

**NPEZ, laboratoře, wearables, dokumentace a další zdroje chápej pouze jako zdroje evidence pro tento model, nikoli jako důvod změnit CHJ na univerzální zdravotní aplikaci.**

---

## Stručně

CHJ není dashboard ani graf. Je to **navigátor**.

```
Primární otázka každého sezení:
  Co mám teď dělat?
```

Odpověď přichází z deterministického decision enginu — ne z AI, ne z grafu, ne z kauzální mapy. Ty jsou nástroje pro pochopení, ne pro rozhodování.

---

## 1. Role vrstev

| Vrstva | Primární role | Co NENÍ |
|--------|---------------|---------|
| **Launcher / Conversation** | **ŘÍZENÍ** — primární user interface; odpovídá „Co mám teď dělat?" | Vizualizační vrstva |
| **Health Engine** | **ROZHODOVÁNÍ** — stav → evidence → constraint → leverage → NBA → DD | Nevrací přirozenou řeč |
| **AI Orchestrator** | **POROZUMĚNÍ + KOMUNIKACE** — převádí hlas/text na strukturované eventy; prezentuje rozhodnutí lidsky | Decision-maker kde existuje engine |
| **Vesmír** | **ORIENTACE** — vizuální mapa toho, co CHJ o člověku ví | Rozhodovací engine; primární navigace |
| **CRT** | **POCHOPENÍ / KAUSALITA** — odpovídá „Proč?"; může ukázat relevantní causal slice nebo celý model | Primární navigace; action selector |

**Akci vybírá Engine → DAILY_DECISION → AI Orchestrator. Vesmír a CRT toto nemohou přepsat.**

---

## 2. Core Loop

```
GOAL
  ↓
CURRENT STATE           — co víme o stavu člověka (confirmed + inferred)
  ↓
WHAT DO WE KNOW / NOT   — evidence gaps, information needs
  ↓
NEXT BEST EVIDENCE      — pokud rozhodnutí blokuje chybějící data
  ↓
SYSTEM CONSTRAINT       — největší bottleneck (kauzálně nejvýše, nejširší dopad)
  ↓
SYSTEM LEVERAGE         — uzel s nejvyšší pákou na constraint
  ↓
NEXT BEST ACTION        — safety-filtered, ranked kandidáti
  ↓
DAILY DECISION          — ACT | ASK | HOLD | SAFETY
  ↓
user response           — evidence o provedení (COMPLETED / SKIPPED / žádná)
  ↓
evidence of outcome     — observation after intervention (activity_level, weight, bp…)
  ↓
fresh decision          ← zpět na začátek
```

Loop se nevyhýbá HOLD ani ASK. CHJ nemusí vždy něco doporučit — správnou odpovědí může být „ještě nevíme" nebo „počkej."

---

## 3. Epistémické principy

Tyto principy jsou neměnné — platí pro engine, orchestrátor i AI language layer.

### Principy platné od MVP (2026-08)

1. **Heuristika nikdy nepřepíše fakt.** CONFIRMED / MEASURED mají absolutní prioritu. Inference a projekce pracují jen s tím, co není přímo potvrzeno.
2. **Nesbíráme data, pokud pravděpodobně nezmění rozhodnutí.** INFORMATION_NEED vzniká jen pro `decision_impact ≥ medium`.
3. **RESPONSE_EVALUATION nikdy netvrdí kauzalitu.** `CONSISTENT_WITH_EXPECTED_RESPONSE` = korelace, ne příčinná vazba. AI nesmí přeformulovat toto jako „intervence způsobila změnu."
4. **INSUFFICIENT_EXPOSURE blokuje negativní závěr.** `NO_RESPONSE_OBSERVED` je přípustné pouze při splněné `minimum_exposure_rule`.
5. **Node states mění pouze activation a inference.** Adherence, RESPONSE_EVALUATION ani orchestrátor je nesmí měnit.

### Epistémické axiomy objevené v MVP

- **`Nemám` je informace.** Evidence může mít stav `NOT_AVAILABLE` — to není chybějící pole, je to datový bod.
- **`Hotovo` je evidence o provedení, ne gamifikační body.** COMPLETED = behavioral fact, ne reward trigger.
- **`Přeskočit` odmítá konkrétní action_id, ne celou intervention.** Sibling akce ve stejné intervenci zůstávají eligible.
- **`UNKNOWN`, `NOT_AVAILABLE`, skutečná hodnota a inferred state nejsou totéž.** Engine musí rozlišovat — jiný epistémický stav, jiné rozhodnutí.
- **CHJ nesmí odhadovat měření z vágního textu, pokud engine potřebuje číslo.** Freetext → structured event (diagnosis, age, constraint). Nikdy → odhadnutá numerická observace.
- **Když je příliš brzo na vyhodnocení, správnou akcí je HOLD.** `HOLD_TOO_EARLY` není chyba — je to korektní výstup s omezenou evidencí.

---

## 4. AI Orchestrator — přesná role

AI Orchestrator je **konverzační a routing vrstva**, ne decision-maker.

```
natural language / voice
  ↓  AI interpretation
structured facts / events  →  engine / specialized system
  ↓  structured decision (DAILY_DECISION)
AI language / voice layer
  ↓
human
```

Engine rozhoduje **CO**. AI pomáhá pochopit člověka a rozhoduje **JAK to říct**.

AI Language Layer může měnit formulaci a osobnost odpovědi. **Nesmí měnit:**
- Výsledek `DAILY_DECISION` (mode, reason_code)
- `NEXT_BEST_ACTION` (action_id, intervention_id)
- Safety conditions a CONTRAINDICATION výstupy
- Evidence claims — nesmí z vágního textu vytvářet numerická měření

### Co orchestrátor SMÍME

- Rozpoznat intent a kontext uživatele
- Převést hlas / text na strukturované eventy (GENERAL_HEALTH_REQUEST, ACTION_COMPLETED, SKIPPED…)
- Vybrat správný specialized engine / agent a zavolat ho
- Formulovat otázku lidským jazykem (z `primary_item`)
- Vysvětlit `why` — proč engine rozhodl takto
- Potvrdit dokončení akce; přepínat mezi doménami

### Co orchestrátor NESMÍME

- Měnit `PERSON_NODE_STATE`
- Vytvářet nové klinické inference mimo engine
- Přepisovat `SYSTEM_CONSTRAINT`, `SYSTEM_LEVERAGE`, `NEXT_BEST_EVIDENCE`, `NEXT_BEST_ACTION`
- Obcházet Safety Gate
- Tvrdit kauzalitu tam, kde engine vrací pouze asociaci

---

## 5. DAILY_DECISION — orchestrační kontrakt

`DAILY_DECISION` je interface mezi Health Enginem a AI Orchestratorem. Engine nevrací celý interní reasoning — vrací strukturované rozhodnutí.

```
DAILY_DECISION {
  mode:             'SAFETY' | 'ASK' | 'ACT' | 'HOLD'
  primary_item:     object (závisí na mode)
  reason_code:      string
  source:           string
  reevaluate_after: ISO date | null
  evaluated_at:     ISO timestamp
}
```

### Priorita módů (zamčeno)

```
SAFETY_CRITICAL  [mode=SAFETY]  — stav osoby, přebíjí celý loop
  > SAFETY_BLOCKED   [mode=SAFETY]  — žádná viable akce kvůli Safety Gate
  > ASK_BLOCKING     [mode=ASK]     — NBA nemůže vybrat; evidence by odblokovala
  > HOLD             [mode=HOLD]    — aktivní intervence, TOO_EARLY nebo INSUF_EXPOSURE
  > ACT              [mode=ACT]     — NBA selected a viable action
```

AI Orchestrator prezentuje **pouze `NBA.selected`** — nikdy nezobrazuje `all_candidates` ani interní ranking.

### SAFETY_CRITICAL ≠ SAFETY_BLOCKED

| | SAFETY_CRITICAL | SAFETY_BLOCKED |
|--|----------------|----------------|
| **Co signalizuje** | Stav osoby vyžaduje eskalaci (krizová hodnota) | V aktuálním rozhodnutí není žádná viable akce |
| **Je to emergency?** | Ano — přebíjí celý loop | Ne — situační blocker konkrétního rozhodnutí |

---

## 6. Specialized System Selection

```
HARD / SAFETY / DATA-DRIVEN DOMAIN
  → deterministický specialized engine

OPEN / CREATIVE / LANGUAGE-HEAVY DOMAIN
  → specialized AI agent

HYBRID DOMAIN
  → engine + AI agent
```

Specializovaný agent nemusí být chatbot. Může to být decision system — TOC engine, projekty, finance, strategie. Nad všemi je jedno CHJ, se kterým uživatel komunikuje přirozeným jazykem.

| Doména | Typ | Stav |
|--------|-----|------|
| Health & Longevity | deterministický engine | ✅ v1.0.0 |
| TOC / Business | hybrid (engine + agent) | 📋 plánováno |
| Projects | hybrid | 📋 plánováno |

---

## 7. Feedback Loop

Tři oddělené vrstvy — žádná netvrdí kauzalitu:

```
ACTION_EXECUTION       — co bylo přiřazeno a provedeno (action_assignments)
  ↓
INTERVENTION_EXPOSURE  — behaviorální agregát (sessions, dny, trvání)
  ↓
RESPONSE_EVALUATION    — porovnání expected_response vs. actual HEALTH_OBSERVATION
  (TOO_EARLY | INSUFFICIENT_EXPOSURE | INSUFFICIENT_OBSERVATION |
   CONSISTENT_WITH_EXPECTED_RESPONSE | NO_RESPONSE_OBSERVED)
```

`CONSISTENT_WITH_EXPECTED_RESPONSE` = korelace v pozorovaném směru, nikdy příčina.

---

## 8. Competitive Principle

Potenciální konkurenční obrana CHJ není LLM, frontend, Vesmír ani CRT samotné. Je to:

> **Schopnost z dlouhodobého cíle, aktuálního stavu, kauzálního modelu a historie výsledků určit jednu nejlepší další akci a podle skutečného výsledku rozhodnout znovu.**

Tato schopnost je v deterministickém enginu, ne v AI vrstvě.

---

## 9. Microsoft / External Platforms

CHJ se nemá přepisovat do Copilot Studio ani outsourcovat svůj decision engine.

Microsoft/Copilot může být v budoucnu:
- zdroj dat a tools (integrace s M365, Outlook, Teams…)
- integrační vrstva pro B2B nasazení
- distribuční kanál (B2B2C)
- další interface k CHJ API

**Rozhodovací know-how zůstává v CHJ.** External platforms jsou konzumenti výstupu enginu, ne jeho substitut.

---

## 10. MVP Status — Health Engine v1 / ENGINE_VERSION 1.0.0 (2026-08)

Health Engine je **feature-frozen**, ne absolutně locked:

- Nové mechanismy bez důkazu z MVP → **NE**
- Prokázaný bug s reprodukcí → **ANO — opravit**

Vesmír canvas a plný CRT nejsou součástí Health MVP v0.1 — jsou zmraženy jako orientační a explanační vrstva.

---

## 11. Jak nová doména vstoupí do architektury

```
1. Klasifikuj doménu: engine | agent | hybrid

2. Pokud engine:
   - Definuj Health Data Model (vstupy)
   - Implementuj pipeline (activation → ... → DOMAIN_DECISION)
   - Definuj DOMAIN_DECISION kontrakt (mode + primary_item)
   - Napiš Safety Gate pravidla
   - Zapoj do AI Orchestrator jako volanou funkci

3. Pokud agent:
   - Definuj scope agenta (co smí/nesmí rozhodovat)
   - Definuj structured output kontrakt
   - Zapoj do AI Orchestrator jako volanou funkci

4. Pokud hybrid:
   - Engine rozhoduje v hard-boundary doméně
   - Agent rozhoduje v open-ended části
   - Jejich výstupy se mergují do DOMAIN_DECISION
```

---

## 12. Soubory — aktuální stav (2026-08-15)

### Health Engine v1

```
api/
├── engine-v1.js              ← POST endpoint → runEngine()
├── orchestrate.js            ← POST /api/orchestrate { userId, text, session }
└── engine/
    ├── engine.js             ← hlavní pipeline, ENGINE_VERSION='1.0.0' — LOCKED
    ├── adapter.js            ← fetchHealthData, fetchActionAssignments, mapDiagnosis
    ├── healthEventAdapter.js ← event routing (GENERAL_HEALTH_REQUEST…) — LOCKED (28/28 pass)
    ├── orchestrator.js       ← AI Orchestrator v0.1 — LOCKED (31/31 pass)
    ├── dailyDecision.js      ← computeDailyDecision → DAILY_DECISION — LOCKED
    ├── activation.js         ← CONFIRMED + MEASURED
    ├── inference.js          ← PREDICTED_CURRENT + UNKNOWN
    ├── projections.js        ← PERSON_PROJECTION[]
    ├── informationNeeds.js   ← buildInformationNeeds, mergeResponseNeeds
    ├── nextBestEvidence.js   ← selectNextBestEvidence
    ├── decisionGate.js       ← evaluateDecisionGate (per-context)
    ├── systemLeverage.js     ← computeSystemLeverage (bottleneck node)
    ├── systemConstraint.js   ← computeSystemConstraint
    ├── nextBestAction.js     ← computeNextBestAction (safety-filtered, ranked)
    └── adherence.js          ← Feedback Loop v0.1

app/
├── launcher.html             ← text UI launcher; canonical /api/orchestrate flow; tester panel (?tester=1)
└── js/universe/launcher.js  ← Nebula UI shell, ElevenLabs TTS, session state, volá /api/orchestrate

data/engine/
├── master.json               ← Master slice (MASTER_NODE[], MASTER_EDGE[])
└── intervention-map.json     ← interventions + expected_responses + minimum_exposure_rule
```

### Referenční dokumenty

| Dokument | Obsah | Stav |
|----------|-------|------|
| `docs/CHJ-PRODUCT-ARCHITECTURE.md` | Toto — product constitution | ✅ aktuální |
| `docs/CHJ-ENGINE-ARCHITECTURE.md` | Canonical engine contract — pipeline, contracts, DAILY_DECISION | ✅ aktuální |
| `docs/DEVLOG.md` | Aktuální handoff — stav 2026-08-27, E2E průchod, open issues | ✅ aktuální |
| `docs/archive/CHJ-ARCHITECTURE-V1.md` | Health Engine v1 technický detail | 📦 archiv |
| `docs/archive/CHJ-ARCHITECTURE-V2.md` | System-level bridge dokument | 📦 archiv |
| `docs/archive/roadmap.md` | Produktová roadmapa Fáze 1–5 | 📦 archiv |
| `docs/checkpoints/2026-08-12-engine-v1.md` | Engine v1 checkpoint | 📦 historický záznam |
| `CLAUDE.md` | Instrukce pro Claude Code | ✅ aktuální |

### Known Tech Debt

**`computeReevaluateAfter`** v `api/engine/dailyDecision.js` parsuje `horizon_min_days` regexem z textového reason stringu. Pokud se změní formát stringu, parsing tiše selže. `horizon_min_days` by mělo být exportováno jako strukturované pole z `evaluateSingleResponse`. Opravit před v0.4.0.

---

*Datum: 2026-08-15 · Verze: 1.0 · Engine: 1.0.0*
