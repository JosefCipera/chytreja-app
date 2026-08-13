# CHJ Architecture v2 — Engine-First Orchestration

> **Canonical architecture document.** Stav k: 2026-08-13  
> Supersedes: původní multi-agent koncept z `docs/roadmap.md` Fáze 3 (2026-03)  
> Navazuje na: `docs/CHJ-ARCHITECTURE-V1.md` (Health Engine v1 detail)

---

## Stručně

CHJ není multi-agent chatbot. Je to **systém specializovaných enginů a agentů** s deterministickým jádrem, nad nímž stojí AI Orchestrator jako konverzační a routing vrstva.

V doménách, kde existuje deterministický engine (Health & Longevity), AI sám nerozhoduje — engine rozhoduje. AI komunikuje a drží kontext.

### Vrstvový slovník — přesné role komponent

| Komponenta | Role | Co NENÍ |
|------------|------|---------|
| **ENGINE** | Domain reasoning — aktivace, inference, projekce, safety gate, ranking | Nevrací přirozenou řeč |
| **DAILY_DECISION** | Domain orchestration output — jeden strukturovaný výstup z engine pipeline | Nová klinická inference |
| **AI ORCHESTRATOR** | Conversation / orchestration layer — routing, formulace otázky, komunikace | Decision-maker kde existuje engine |
| **VESMÍR** | State map / navigation visualization — zobrazuje stav uzlů, ne rozhoduje | Decision engine |
| **CRT** | Causal explanation layer — zobrazuje kauzální řetěz, ne generuje akce | Primary action selector |

**Vesmír a CRT jsou vizualizační / explanační vrstvy. Akci vybírá engine → DAILY_DECISION → AI Orchestrator.**

---

## 1. Čtyři vrstvy

```
┌─────────────────────────────────────────────────────────┐
│  UI / VOICE                                              │
│  Prezentace — hlas, text, launcher, CRT, vesmír         │
└────────────────────────┬────────────────────────────────┘
                         │ lidský vstup (hlas / tap / text)
┌────────────────────────▼────────────────────────────────┐
│  AI ORCHESTRATOR                                         │
│  Konverzace, routing, jedná otázka/akce, žádné vlastní  │
│  klinické závěry mimo engine                            │
└──────┬─────────────────┬──────────────────┬─────────────┘
       │                 │                  │
┌──────▼──────┐  ┌───────▼───────┐  ┌──────▼──────┐
│  HEALTH     │  │  TOC /        │  │  PROJECTS / │
│  ENGINE v1  │  │  BUSINESS     │  │  MARKETING  │
│  determin.  │  │  hybrid       │  │  AI agent   │
└──────┬──────┘  └───────┬───────┘  └──────┬──────┘
       │                 │                  │
       └─────────────────┴──────────────────┘
                         │ strukturovaný výstup
┌────────────────────────▼────────────────────────────────┐
│  DOMAIN_DECISION / DAILY_DECISION                        │
│  Orchestrační kontrakt: mode + primary_item + reason     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Superseded koncept

**❌ Původní představa (Fáze 3 roadmap, 2026-03) — zamítnuto:**

```
AI SUPERAGENT
→ Tělo Agent, Mysl Agent, Výživa Agent, TOC Agent...
```

**Problém:** V doménách s deterministickými pravidly (klinická data, biomechanika, bezpečnostní gate, rankingy akcí) by AI agent tvořil vlastní klinické inference, nemohl by být auditovatelný a porušoval by epistémické zásady projektu (kauzalita ≠ asociace, Safety Gate nesmí být obejit).

**✅ Nová architektura (canonical od 2026-08):**

AI Orchestrator = konverzační a routing vrstva.  
Doménová inteligence = ve specializovaném enginu nebo agentovi.  
Orchestrátor nepřepisuje výstupy enginu — prezentuje je.

---

## 3. Princip: specialized system selection

```
HARD / SAFETY / DATA-DRIVEN DOMAIN
  → deterministický specialized engine

OPEN / CREATIVE / LANGUAGE-HEAVY DOMAIN
  → specialized AI agent

HYBRID DOMAIN
  → engine + AI agent
```

### Mapování domén (aktuální + plánované)

| Doména | Typ | Stav |
|--------|-----|------|
| Health & Longevity | deterministický engine | ✅ v1.0.0 implementován |
| TOC / Business | hybrid (engine + agent) | 📋 plánováno |
| Projects | hybrid | 📋 plánováno |
| Marketing | převážně AI agent | 📋 plánováno |

---

## 4. AI Orchestrator — přesná role

### Co SMÍME

- Rozpoznat intent a kontext uživatele
- Převést hlas / text na strukturovaný vstup (evidence do enginu)
- Vybrat správný specialized engine / agent
- Zavolat ho a přijmout strukturovaný výstup
- Formulovat otázku lidským jazykem (z `primary_item`)
- Vysvětlit `why` — proč engine rozhodl takto
- Potvrdit dokončení akce
- Přepnout mezi doménami / universes
- Spojit více domain outputs do jednoho dialogu

### Co NESMÍME

- Měnit `PERSON_NODE_STATE`
- Vytvářet nové klinické inference mimo engine
- Přepisovat `SYSTEM_CONSTRAINT` ani `SYSTEM_LEVERAGE`
- Přepisovat `NEXT_BEST_EVIDENCE` ranking
- Přepisovat `NEXT_BEST_ACTION` ranking
- Obcházet Safety Gate
- Tvrdit kauzalitu tam, kde engine vrací pouze asociaci / response consistency (`CONSISTENT_WITH_EXPECTED_RESPONSE` ≠ kauzální důkaz)

---

## 5. Health Engine v1 — první specialized engine

Detailní popis: `docs/CHJ-ARCHITECTURE-V1.md`

### Pipeline

```
HEALTH DATA (person + clinicalHistory + observations)
  ↓
activation()           → PERSON_NODE_STATE[] (CONFIRMED + MEASURED)
  ↓
inference()            → + PERSON_NODE_STATE[] (PREDICTED_CURRENT + UNKNOWN)
  ↓
computeProjections()   → PERSON_PROJECTION[]
  ↓
buildInformationNeeds()→ INFORMATION_NEED[]
  ↓
evaluateDecisionGate() → DECISION_GATE (per-context)
  ↓
computeSystemLeverage()→ SYSTEM_LEVERAGE (bottleneck node)
  ↓
computeSystemConstraint()
  ↓
computeNextBestAction()→ NEXT_BEST_ACTION (safety-filtered, ranked)
  ↓
──── Feedback Loop v0.1 ────────────────────────────────────
fetchActionAssignments()
  ↓
computeInterventionExposure()  → INTERVENTION_EXPOSURE
  ↓
evaluateResponseEvaluations()  → RESPONSE_EVALUATION
  ↓
buildResponseInformationNeeds()→ merge do INFORMATION_NEED[]
──────────────────────────────────────────────────────────
  ↓
DAILY_DECISION
```

### Epistémické zásady (neměnné)

1. **Heuristika nikdy nepřepíše fakt.** CONFIRMED / MEASURED mají absolutní prioritu.
2. **Nesbíráme data, pokud pravděpodobně nezmění rozhodnutí.** INFORMATION_NEED vzniká jen pro `decision_impact ≥ medium`.
3. **RESPONSE_EVALUATION nikdy netvrdí kauzalitu.** `CONSISTENT_WITH_EXPECTED_RESPONSE` = korelace, ne příčinná vazba.
4. **INSUFFICIENT_EXPOSURE blokuje negativní závěr.** `NO_RESPONSE_OBSERVED` je přípustné pouze při splněné `minimum_exposure_rule`.
5. **Node states mění pouze activation a inference.** Adherence, RESPONSE_EVALUATION ani orchestrátor je nesmí měnit.

---

## 6. DAILY_DECISION — orchestrační kontrakt

> **v0.1 = PASS** · `git tag feat/engine-v1` · test: `scripts/test-daily-decision.mjs` 5/5  
> Prioritní řetěz je **zamčen** — změna pořadí vyžaduje nový test-pass + nový tag.

`DAILY_DECISION` je interface mezi Health Enginem a AI Orchestratorem.  
Engine nevrací celý interní reasoning jako primární UX kontrakt — vrací strukturované rozhodnutí.

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

### Priorita módů

```
SAFETY_CRITICAL  [mode=SAFETY]  — stav osoby, přebíjí celý loop       ✅ LOCKED v0.1
  > SAFETY_BLOCKED   [mode=SAFETY]  — žádná viable akce kvůli Safety Gate  ✅ LOCKED v0.1
  > ASK_BLOCKING     [mode=ASK]     — NBA nemůže vybrat; evidence by odblokovala ✅ LOCKED v0.1
  > HOLD             [mode=HOLD]    — aktivní intervence, TOO_EARLY nebo INSUF_EXPOSURE ✅ LOCKED v0.1
  > ACT              [mode=ACT]     — NBA selected a viable action              ✅ LOCKED v0.1
```

### reason_code values

| reason_code | mode | Kdy |
|-------------|------|-----|
| `SAFETY_CRITICAL` | SAFETY | SAFETY_CRITICAL actionability v decision_gate (budoucí extension) |
| `SAFETY_BLOCKED` | SAFETY | Všichni kandidáti CONTRAINDICATED nebo NEEDS_CLINICAL_CLEARANCE |
| `ASK_BLOCKING` | ASK | NBA.status ∈ {NEED_MORE_EVIDENCE, NO_CANDIDATES, NOT_COMPUTED} |
| `HOLD_TOO_EARLY` | HOLD | Horizon_min_days neuplynul od první dokončené session |
| `HOLD_INSUF_EXPOSURE` | HOLD | Horizon uplynul, ale minimum_exposure_rule nesplněna |
| `ACT_READY` | ACT | NBA vybral viable akci |

### SAFETY_CRITICAL ≠ SAFETY_BLOCKED

| | SAFETY_CRITICAL | SAFETY_BLOCKED |
|--|----------------|----------------|
| **Co signalizuje** | Aktuální stav osoby vyžaduje eskalaci (krizová hodnota) | V aktuálním rozhodnutí není žádná viable akce |
| **Je to emergency?** | Ano — přebíjí celý loop | Ne — situační blocker konkrétního rozhodnutí |
| **Zdroj** | DECISION_GATE.actionable_findings SAFETY_CRITICAL | NBA.all_candidates (všichni CONTRAINDICATED / NEEDS_CLINICAL_CLEARANCE) |
| **Trigger v v1.0.0** | Future extension (žádná code path zatím netriggeruje) | Aktivní (severe constraint + CV risk) |

---

## 7. Feedback Loop v0.1

Tři oddělené vrstvy — žádná netvrdí kauzalitu:

```
ACTION_EXECUTION       — co bylo přiřazeno a provedeno (action_assignments tabulka)
  ↓
INTERVENTION_EXPOSURE  — behaviorální agregát (sessions, dny, trvání)
  ↓
RESPONSE_EVALUATION    — porovnání expected_response vs. actual HEALTH_OBSERVATION
  (TOO_EARLY | INSUFFICIENT_EXPOSURE | INSUFFICIENT_OBSERVATION |
   CONSISTENT_WITH_EXPECTED_RESPONSE | NO_RESPONSE_OBSERVED)
```

`CONSISTENT_WITH_EXPECTED_RESPONSE` = korelace v pozorovaném směru. AI Orchestrator nesmí toto přeformulovat jako „intervence způsobila změnu".

---

## 8. Jak nová doména vstoupí do architektury

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

### Příklad: TOC/Business domain (plánovaný hybrid)

```
Constraint identification  → deterministický TOC engine (kauzální graf, průtok)
Strategy generation        → AI agent (otevřená kreativní vrstva)
DOMAIN_DECISION            → engine zvolí bottleneck, agent navrhne řešení
AI Orchestrator            → prezentuje jedno doporučení v dialogu
```

---

## 9. Soubory — aktuální stav

### Health Engine v1

```
api/
├── engine-v1.js              ← POST endpoint → runEngine()
└── engine/
    ├── engine.js             ← hlavní pipeline, ENGINE_VERSION='1.0.0'
    ├── adapter.js            ← fetchHealthData, fetchActionAssignments
    ├── activation.js         ← CONFIRMED + MEASURED
    ├── inference.js          ← PREDICTED_CURRENT + UNKNOWN
    ├── projections.js        ← PERSON_PROJECTION[]
    ├── informationNeeds.js   ← buildInformationNeeds, mergeResponseNeeds
    ├── nextBestEvidence.js   ← selectNextBestEvidence (lexikografická selekce)
    ├── decisionGate.js       ← evaluateDecisionGate (per-context)
    ├── systemLeverage.js     ← computeSystemLeverage (bottleneck node)
    ├── systemConstraint.js   ← computeSystemConstraint
    ├── nextBestAction.js     ← computeNextBestAction (safety-filtered, ranked)
    ├── adherence.js          ← Feedback Loop v0.1
    └── dailyDecision.js      ← computeDailyDecision → DAILY_DECISION

data/engine/
├── master.json               ← Master slice (MASTER_NODE[], MASTER_EDGE[])
└── intervention-map.json     ← interventions + expected_responses + minimum_exposure_rule

migrations/
└── add_action_assignments.sql ← ACTION_EXECUTION tabulka

scripts/
├── test-nba.mjs              ← NEXT_BEST_ACTION end-to-end test
├── test-feedback-josef.mjs   ← Feedback Loop v0.1 test
└── test-daily-decision.mjs   ← DAILY_DECISION truth table (5/5 pass)
```

### AI Orchestrator — zatím

```
api/
├── chat.js      ← CHJ AI verdikt (Claude Haiku, přes GPT-4o-mini legacy)
└── tts.js       ← ElevenLabs TTS (Mode A: text→audio, Mode B: context→Haiku→audio)

app/js/universe/
└── launcher.js  ← CHJ shell, voice routing, ElevenLabs
```

AI Orchestrator v1 je aktuálně single-turn chat (chat.js). Napojení na DAILY_DECISION je plánováno pro v0.3.0.

---

## 10. Referenční dokumenty

| Dokument | Obsah | Stav |
|----------|-------|------|
| `docs/CHJ-ARCHITECTURE-V2.md` | Toto — canonical architektura | ✅ aktuální |
| `docs/CHJ-ARCHITECTURE-V1.md` | Health Engine v1 detail (Health Data Model, pipeline, PERSON_NODE_STATE, PERSON_PROJECTION, Decision Gate, Josef referenční profil) | ✅ aktuální (technický detail) |
| `docs/roadmap.md` | Produktová roadmapa | ⚠️ Fáze 3 superseded — viz pozn. |
| `docs/checkpoints/2026-08-12-engine-v1.md` | Engine v1 checkpoint | ✅ historický záznam |
| `CLAUDE.md` | Instrukce pro Claude Code + HANDBOOK | ✅ aktuální |

---

## 11. Vesmír a CRT — legacy produktová logika

### worstLeaf / recalcParents (Vesmír)

`worstLeaf` a `recalcParents` v `api/hud-data-bulk.js` a `app/js/universe/universe-core.js` jsou **aktuální produktová logika** Vesmíru — správně zobrazují agregovaný stav uzlů a barvu parent uzlů.

**Pro budoucí decision-making jsou superseded.**  
Decision-making (co uživatel udělá dál) patří do engine pipeline → DAILY_DECISION, ne do Vesmír canvas logiky. Vesmír je state map / vizualizace, ne decision engine.

```
worstLeaf / recalcParents:
  ✅ Platné pro: vizualizaci stavu v canvas (barva uzlů, parent agregace)
  ❌ Superseded pro: výběr next action, ranking intervencí, constraint propagaci
```

### reevaluate_after — tech debt (parsing z reason stringu)

`computeReevaluateAfter` v `api/engine/dailyDecision.js:189` parsuje `horizon_min_days` z textového reason stringu:

```javascript
// Tech debt: horizon_min_days by mělo být strukturované pole v response_evaluation,
// ne parsováno regexem z human-readable reason textu.
const match = holdEval?.reason?.match(/of (\d+) minimum days/);
```

**Proč tech debt:** Pokud se změní formát reason stringu (překlad, refaktoring), parsing tiše selže. `horizon_min_days` by mělo být exportováno přímo z `evaluateSingleResponse` jako strukturované pole `holdEval.horizon_min_days`.

**Kdy opravit:** Před v0.4.0 (health data pipeline) — HOLD logika se stane kritičtější až budou reálnější data.

---

## 12. Co ještě není implementováno

| Oblast | Priorita | Poznámka |
|--------|----------|----------|
| AI Orchestrator napojení na DAILY_DECISION | 🔴 Vysoká | chat.js aktuálně neví o DAILY_DECISION |
| Persistence DAILY_DECISION do DB | 🟡 Střední | Pro session continuity |
| TOC/Business domain | 🟡 Střední | Hybrid engine+agent, plánováno po validaci Health |
| SAFETY_CRITICAL trigger v engine | 🟡 Střední | future extension v decisionGate.js |
| Voice check-in → strukturovaný vstup do enginu | 🔴 Vysoká | Launcher STAV 2 čte check-in, ale nevolá engine |
| DAILY_DECISION → ElevenLabs briefing | 🔴 Vysoká | Launcher mluví, ale ne na základě engine výstupu |

---

*Datum: 2026-08-13 · Verze architektury: v2.0 · Engine: 1.0.0*
