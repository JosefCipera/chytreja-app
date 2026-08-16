# CHJ Engine Architecture — Health Engine v1

> **Canonical technical contract.** Stav k: 2026-08-16 · Engine version: `1.0.0`  
> Produktová ústava: `docs/CHJ-PRODUCT-ARCHITECTURE.md`  
> Vychází z: `docs/CHJ-ARCHITECTURE-V1.md` (2026-08-11)

---

## Filozofie

Health Engine v1 není diagnostický systém ani health tracker.  
Je to **rozhodovací vrstva** — pro každého člověka v každém okamžiku odpovídá na dvě otázky:

1. **Co víme?** — aktivní stavy uzlů + projekce rizika
2. **Co dělat dál?** — máme dost dat pro rozhodnutí, nebo potřebujeme víc?

### Dvě základní zásady

**Heuristika nikdy nepřepíše fakt.**  
Inference a projekce pracují jen s tím, co není přímo potvrzeno. Jakmile existuje diagnóza nebo měření (CONFIRMED / MEASURED), engine ji respektuje a nikdy nepřepisuje prediktivním výstupem.

**Nesbíráme data, pokud pravděpodobně nezmění rozhodnutí.**  
INFORMATION_NEED vzniká pouze pro `decision_impact ≥ medium`. NEXT_BEST_EVIDENCE se generuje jen pro kontexty s `NEED_MORE_EVIDENCE`. Sběr dat pro sběr dat je anti-pattern.

---

## Decision Boundaries — přesné role komponent

| Komponenta | Zodpovídá za | Co NESMÍ |
|------------|-------------|---------|
| **Engine** | Stav uzlů + reasoning (activation, inference, projekce, gate, leverage, constraint) | Vracet přirozenou řeč |
| **NBA** | Vybírat konkrétní action z kandidátního poolu | Přepisovat Safety Gate |
| **DAILY_DECISION** | Orchestrovat výsledek do ACT / ASK / HOLD / SAFETY | Zobrazovat `all_candidates`; provádět novou klinickou inferenci |
| **Orchestrator** | Interpretovat přirozený jazyk; prezentovat rozhodnutí lidsky | Vytvářet vlastní zdravotní rozhodnutí; přepisovat NBA.selected, safety conditions, evidence claims |

---

## 1. Health Data Model v1

Tři oddělené vrstvy vstupu. Žádná vrstva není přepsána jinou.

### PERSON
```
person_id    string
sex          'M' | 'F' | null
birth_year   number | null       ← canonical source: user_profiles.birth_year
height_cm    number | null
```

> Canonical `birth_year` pochází výhradně z `user_profiles.birth_year`.  
> `user_health_profile.birth_year` se nečte — historicky obsahoval chybné hodnoty.

### CLINICAL HISTORY
```
diagnoses[]          { id, raw_label, status }   ← mapDiagnosis() → kanonické ID
medications[]        { substance, dose, status }
supplements[]        { substance, dose, status }
lifestyle            { sedentary_work, smoking_history, alcohol_history }
capacity             {}              ← volná struktura z health profile
onboarding_inputs    { question_id → value }     ← hp.physical (flat mapa)
evidence_availability { [evidence_type]: 'NOT_AVAILABLE' | 'AVAILABLE' }
clinical_history_documented  boolean  ← proxy: existuje user_health_profile řádek?
```

> `evidence_availability` je oddělen od `onboarding_inputs`. Mechanismus viz Evidence Contract.

### OBSERVATIONS
```
obs_type      string           ← kanonický typ (weight_kg, bp_systolic, lab_ldl…)
value         number | string
unit          string | null
measured_at   ISO date | null
source        'daily_checkin' | 'health_profile' | 'lab_report' | 'onboarding' | 'physical'
confidence    'confirmed' | 'estimated'
```

---

## 2. Evidence Contract

Čtyři epistémické stavy nejsou zaměnitelné:

| Stav | Co znamená | Kde vzniká |
|------|-----------|-----------|
| **UNKNOWN** | Uzel je na aktivní inference cestě, stav nelze určit, absence dat materiálně mění výstup | `inference()` — RELEVANT_UNKNOWN pravidlo |
| **NOT_AVAILABLE** | Uživatel byl dotázán a odpověděl „nemám / nevím" | `classifyAvailability()` v healthEventAdapter.js |
| **actual value** | Existuje konkrétní naměřená nebo zadaná hodnota | `observations[]`, `onboarding_inputs` |
| **inferred state** | PREDICTED_CURRENT z kaskády aktivních uzlů | `inference()` pravidla |

### NOT_AVAILABLE — přesná sémantika

`NOT_AVAILABLE` zastaví opakované ASK pro daný `evidence_type`. Je to epistémická odpověď „víme, že nevíme."  
**Není** klinická hodnota. Nikdy se nepropaguje do inference ani projekce jako negativní výsledek.

Uložení: `user_health_profile.physical.evidence_availability[evidenceType] = 'NOT_AVAILABLE'`  
Čtení: `clinicalHistory.evidence_availability` v adapteru.

Engine považuje evidence za „vyřešenou" (nepotřebuje znovu ptát), pokud:
- existuje `evidence_availability[type]` (AVAILABLE nebo NOT_AVAILABLE), NEBO
- existuje `onboarding_inputs[value_key]` (RAW_VALUE typy)

---

## 3. Master Slice (data/engine/master.json)

Engine v1 pracuje na **vybraném podgrafu** — tzv. Master slice. Definuje uzly a hrany, které engine aktuálně rozumí a vyhodnocuje.

### MASTER_NODE
```json
{
  "id":       "HYPERTENSION",
  "label":    "Hypertenze",
  "label_cs": "Hypertenze",
  "domain":   "cv",
  "layer":    2,
  "type":     "condition"
}
```

### MASTER_EDGE
```json
{ "from": "HYPERTENSION", "to": "ENDOTHELIAL_DYSFUNCTION", "type": "causal" }
```

---

## 4. Pipeline — kompletní flow

```
INPUT DATA (person, clinicalHistory, observations)
  │
  ▼ adapter.js
fetchHealthData(userId)
  → { person, clinicalHistory, observations }
fetchActionAssignments(userId, 30d)
  → action_assignments[]

  ▼ activation.js
activation(person, clinicalHistory, observations)
  → PERSON_NODE_STATE[]   (current_state: CONFIRMED | MEASURED)

  ▼ inference.js
inference(activated, person, clinicalHistory, observations)
  → + PERSON_NODE_STATE[] (current_state: PREDICTED_CURRENT | UNKNOWN)

  ▼ projections.js
computeProjections(allStates, person, clinicalHistory)
  → PERSON_PROJECTION[]   (oddělená entita, M:N na node_states)

  ▼ informationNeeds.js
buildInformationNeeds(node_states, projections)
  → INFORMATION_NEED[]    (deduplikované, decision_impact-anotované)

  ▼ decisionGate.js
evaluateDecisionGate(node_states, projections, information_needs, ENGINE_VERSION)
  → DECISION_GATE {
      context_gates[],          ← per decision_context
      any_context_action_ready,
      contexts_needing_evidence
    }

  ▼ systemLeverage.js
computeSystemLeverage(node_states, projections, decision_gate, ENGINE_VERSION)
  → SYSTEM_LEVERAGE { selected: { node_id, score, ... } }

  ▼ systemConstraint.js
computeSystemConstraint(node_states, projections, decision_gate, ENGINE_VERSION)
  → SYSTEM_CONSTRAINT { bottleneck_node_id, ... }

  ▼ ── Feedback Loop ──────────────────────────────────────────────────────────
computeInterventionExposure(actionAssignments)
  → INTERVENTION_EXPOSURE[]

skippedTodayActionIds = Set of action_ids with status=SKIPPED on assigned_date=today

evaluateResponseEvaluations(exposure, INTERVENTION_MAP, observations, assignments)
  → RESPONSE_EVALUATION[]

buildResponseInformationNeeds(response_evaluations)
  → merge do INFORMATION_NEED[]
  ── ─────────────────────────────────────────────────────────────────────────

  ▼ nextBestAction.js
computeNextBestAction({ leverageNodeId, interventions, actionPool, personConstraints,
                        clinicalHistory, decisionGate, node_states, engineVersion,
                        responseHistory, skippedTodayActionIds })
  → NEXT_BEST_ACTION { status, selected, all_candidates, ... }

  ▼ dailyDecision.js
computeDailyDecision(engineOutput)
  → DAILY_DECISION { mode, primary_item, reason_code, source, reevaluate_after, evaluated_at }
```

---

## 5. PERSON_NODE_STATE

Stav uzlu pro konkrétního člověka. **Bez pole `future_projection`** — projekce jsou samostatná entita.

```
person_id        string
node_id          string
current_state    'CONFIRMED' | 'MEASURED' | 'PREDICTED_CURRENT' | 'UNKNOWN'
confidence       'high' | 'medium' | 'low' | 'unknown'
evidence {
  direct[]               ← přímé potvrzení (diagnóza, lab, měření)
  supporting[]           ← podpůrná evidence
  inferred_from_nodes[]  ← uzly, ze kterých je inference odvozena
}
missing_evidence[]       ← co chybí pro zpřesnění nebo potvrzení
evaluated_at     ISO
engine_version   string
```

### Čtyři stavy

| Stav | Kdy | Zdroj |
|------|-----|-------|
| **CONFIRMED** | Diagnóza od lékaře nebo lab potvrzuje existenci stavu | `clinicalHistory.diagnoses` keyword match |
| **MEASURED** | Přímé měření; hodnota existuje, stav odvozený (např. BMI) | `observations` + výpočet |
| **PREDICTED_CURRENT** | Inferenční kaskáda — uzel pravděpodobně aktivní | `inference()` pravidla |
| **UNKNOWN** | Uzel na aktivní cestě, stav nelze určit, absence materiálně mění výstup | RELEVANT_UNKNOWN pravidlo |

**RELEVANT_UNKNOWN** vznikne pouze tehdy, když platí VŠECHNY tři podmínky:
1. Uzel je součástí aktivní inference / projekce cesty
2. Jeho stav nelze určit z dostupných dat
3. Absence stavu materiálně mění inference nebo projekci

---

## 6. PERSON_PROJECTION

Oddělená entita. Reprezentuje budoucí riziko, může referovat více uzlů (M:N).

```
person_id        string
target_node_id   string          ← cíl projekce
risk             'elevated' | 'moderate' | 'low' | 'unknown'
confidence       'high' | 'medium' | 'low' | 'unknown'
calibrated       boolean         ← false = nekalibrovaná kvalitativní projekce
risk_basis       string
missing_evidence[]
evaluated_at     ISO
engine_version   string
```

`risk` (směr rizika) a `confidence` (spolehlivost projekce) jsou dvě oddělené osy.  
Příznivá hodnota `risk` nezvyšuje `confidence` automaticky. `calibrated=false` zůstává dokud není pravidlo kalibrováno na populaci.

---

## 7. INFORMATION_NEED a NEXT_BEST_EVIDENCE

### INFORMATION_NEED

Deduplikovaný kandidát chybějící evidence — jeden záznam na kanonický `evidence_type`.

```
id                   'NEED_BP_SYSTOLIC'
evidence_type        'bp_systolic'
needed_for[]         [{ entity_type, entity_id }]
decision_impact      'high' | 'medium' | 'low'
uncertainty_reduction 'high' | 'medium' | 'low'
acquisition_cost     'very_low' | 'low' | 'medium' | 'high'
urgency              'high' | 'medium' | 'low'
acquisition_method   'question' | 'home_measurement' | 'functional_test' | 'wearable' | 'laboratory' | 'clinician'
explanation          string
```

### NEXT_BEST_EVIDENCE

0 nebo 1 výsledek. Generuje se **pouze** pro kontext s `NEED_MORE_EVIDENCE`.  
Lexikografická selekce: urgency → decision_impact → uncertainty_reduction → acquisition_cost (ascending).  
**STOP RULE:** pokud žádný kandidát nemá `decision_impact ≥ medium`, vrátí `null`.

---

## 8. Decision Gate — per decision_context

Gate se vyhodnocuje **per kontext** — ne globálně. EVIDENCE_SUFFICIENT v jednom kontextu neblokuje NEXT_BEST_EVIDENCE v jiném.

### Actionability — pět úrovní

| Úroveň | Kdy |
|--------|-----|
| **SAFETY_CRITICAL** | Konkrétní krizová hodnota / bezpečnostní pravidlo — v1 zatím netriggerováno |
| **RISK_RELEVANT** | Potvrzená klinicky významná diagnóza — HYPERTENSION, ED, DYSLIPIDEMIA (CONFIRMED) |
| **ACTIONABLE** | Jasný akční směr z přímé evidence nebo predikce behaviorálního uzlu |
| **MONITOR** | Predikovaný mechanismus — sledovat, potvrdit přímou evidencí |
| **NOT_YET_ACTIONABLE** | Stav neznámý — evidence potřeba před akcí |

### Status pravidlo per kontext

```
has SAFETY_CRITICAL              → EVIDENCE_SUFFICIENT (safety override)
has RISK_RELEVANT nebo ACTIONABLE → EVIDENCE_SUFFICIENT (směr je jasný)
žádný direction-level finding    → NEED_MORE_EVIDENCE
```

UNKNOWN uzly neblokují kontext, který má RISK_RELEVANT/ACTIONABLE finding — zpřesňují detail, nemění větev.

---

## 9. Action Contract

### action_assignments — DB tabulka

Každý výsledek akce (uživatel splnil / přeskočil) se ukládá jako nový INSERT. Neexistuje UPDATE existujícího řádku.

```
id                      uuid
user_id                 string
action_id               string
intervention_id         string
selected_leverage_node  string
engine_version          string
status                  'COMPLETED' | 'SKIPPED'
assigned_date           date        ← CURRENT_DATE (UTC)
assigned_at             timestamptz
completed_at            timestamptz | null
actual_duration_seconds integer | null
actual_reps             integer | null
```

### COMPLETED

- Počítá se jako `sessions_completed` v INTERVENTION_EXPOSURE
- Anchor pro Response Evaluation (`first_completed_at`)
- Neaktivuje `HOLD` samotné — HOLD vyžaduje splněnou `minimum_exposure_rule`

### SKIPPED

- Nepočítá se jako `sessions_completed` — nepostupuje exposure
- Počítá se jako `sessions_skipped` (informační)
- **Exact `action_id` je pro zbytek aktuálního dne ineligible** (filtr v `buildCandidates` přes `skippedTodayActionIds`)
- Sibling akce ve stejné intervention mohou zůstat eligible
- Zítra může být stejná akce znovu nabídnuta
- **SKIPPED SAMO O SOBĚ NETRIGGERUJE HOLD** — `checkHold` vyžaduje `sessions_completed > 0`

---

## 10. Feedback Loop v0.1

Tři oddělené vrstvy — žádná netvrdí kauzalitu:

```
ACTION_EXECUTION       — co bylo přiřazeno a provedeno (action_assignments)
  ↓
INTERVENTION_EXPOSURE  — behaviorální agregát per intervention_id
  { sessions_completed, sessions_skipped, sessions_assigned,
    calendar_days_in_period, total_actual_duration_s, first_completed_at }
  ↓
RESPONSE_EVALUATION    — porovnání expected_response vs. actual HEALTH_OBSERVATION
  TOO_EARLY             — žádná completed session (first_completed_at = null)
                          nebo horizon_min_days neuplynul
  INSUFFICIENT_EXPOSURE — horizon uplynul, minimum_exposure_rule nesplněna
  INSUFFICIENT_OBSERVATION — exposure OK, ale chybí pozorování daného obs_type
  CONSISTENT_WITH_EXPECTED_RESPONSE — korelace v očekávaném směru (ne kauzalita)
  NO_RESPONSE_OBSERVED  — exposure OK, pozorování existuje, ale nesměřuje očekávaně
```

`CONSISTENT_WITH_EXPECTED_RESPONSE` ovlivňuje NBA ranking pouze jako tiebreaker v rámci aktuálního leverage node.  
AI Orchestrator nesmí přeformulovat toto jako „intervence způsobila změnu."

### HOLD_TOO_EARLY — přesná sémantika

`HOLD_TOO_EARLY` znamená, že **aktuální intervention** čeká na dostatek času nebo dat.  
**Není** globální zákaz jiné činnosti. Pokud existuje jiná eligible akce pro jiný leverage node nebo jiný kontext, engine ji může vybrat.

---

## 11. DAILY_DECISION Contract

`computeDailyDecision()` je čistá orchestrační funkce — čte výstup `runEngine()`, vrací jedno rozhodnutí. Žádná nová klinická inference.

```
DAILY_DECISION {
  mode:             'SAFETY' | 'ASK' | 'ACT' | 'HOLD'
  primary_item:     object (závisí na mode — viz níže)
  reason_code:      string
  source:           string
  reevaluate_after: ISO date | null
  evaluated_at:     ISO timestamp
}
```

### Prioritní řetěz (zamčen)

```
SAFETY_CRITICAL   [mode=SAFETY]  — person-state signal, přebíjí celý loop    ✅ v0.1
  > SAFETY_BLOCKED  [mode=SAFETY]  — všichni kandidáti CONTRAINDICATED/CLINICAL_CLEARANCE
  > ASK_BLOCKING    [mode=ASK]     — NBA.status ∈ {NEED_MORE_EVIDENCE, NO_CANDIDATES, NOT_COMPUTED}
  > HOLD            [mode=HOLD]    — HOLD_TOO_EARLY nebo HOLD_INSUF_EXPOSURE
  > ACT             [mode=ACT]     — NBA selected viable action
```

### reason_code hodnoty

| reason_code | mode | Kdy |
|-------------|------|-----|
| `SAFETY_CRITICAL` | SAFETY | SAFETY_CRITICAL actionability v decision_gate — v1 zatím netriggerováno |
| `SAFETY_BLOCKED` | SAFETY | Všichni kandidáti CONTRAINDICATED nebo NEEDS_CLINICAL_CLEARANCE |
| `ASK_BLOCKING` | ASK | NBA.status ∈ {NEED_MORE_EVIDENCE, NO_CANDIDATES, NOT_COMPUTED} |
| `HOLD_TOO_EARLY` | HOLD | horizon_min_days neuplynul od první completed session |
| `HOLD_INSUF_EXPOSURE` | HOLD | Horizon uplynul, minimum_exposure_rule nesplněna |
| `ACT_READY` | ACT | NBA selected viable action |

**DAILY_DECISION prezentuje pouze `NBA.selected` — nikdy `all_candidates`.**

---

## 12. Health Event Adapter v0.1

Boundary: AI Orchestrator → NORMALIZED_DOMAIN_EVENT → `applyHealthEvent()` → persistence → `runEngine()` → DOMAIN_RESPONSE

### NORMALIZED_DOMAIN_EVENT
```
event_type:  'ACTION_COMPLETED' | 'ACTION_SKIPPED' | 'ANSWER_TO_EVIDENCE_QUESTION'
           | 'NEW_SYMPTOM' | 'NEW_MEASUREMENT' | 'NEW_CONSTRAINT'
           | 'USER_PREFERENCE' | 'DOMAIN_REQUEST' | 'GENERAL_HEALTH_REQUEST'
event_id:   UUID
source:     'voice' | 'text' | 'ui' | 'wearable' | 'api'
timestamp:  ISO 8601
payload:    object (event-specific, null fields jsou validní)
```

### DOMAIN_RESPONSE
```
domain:              'health'
engine_version:      string
evaluated_at:        string
daily_decision:      DAILY_DECISION
explanation_context: { system_constraint, system_leverage, action_context, evidence_context }
```

### Klíčová pravidla adapteru

- Žádná klinická logika — pouze normalizace, persistence, volání runEngine()
- Žádný zápis do `node_inputs` (tabulka je deprecated pro nové vstupy)
- Null payload fields jsou validní — nikdy neblokovat emisi eventu
- Engine rozhoduje přes DAILY_DECISION, pokud chybějící pole vyžaduje ASK

### ANSWER_TO_EVIDENCE_QUESTION

Odpověď na konkrétní pending NBE otázku. `evidence_type` pochází ze session `pending_question` (canonical source) — Haiku classifier ji může vynechat, session ji doplní.

Tok: answer → `EVIDENCE_STORAGE_REGISTRY[evidence_type]` → cílová tabulka/klíč.  
Pokud value je NOT_AVAILABLE token → `upsertEvidenceAvailability(evidenceType, 'NOT_AVAILABLE')`.

### GENERAL_HEALTH_REQUEST

Volný text s diagnózami, věkem, léky nebo kombinací zdravotních faktů.

Adapter zpracuje:
1. **Age extraction**: regex `\b(\d{2,3})\s*(?:let|roků|roku)\b` → `user_profiles.birth_year` (jen pokud ještě není nastaven)
2. **Diagnózy strukturálně**: text se rozdělí do segmentů, každý projde `mapDiagnosis()` → kanonické ID → persist do `user_health_profile.diagnoses[]` jako `{ name: ID, status: 'confirmed', source: 'general_health_request', raw_text: segment }`
3. **Raw text jako audit trail**: celý text se přidá do `user_health_profile.symptoms[]`
4. **Body-part constraints**: pokud text obsahuje anatomickou oblast → `upsertConstraint()`

CHJ nesmí z vágního textu odhadovat numerická měření (krevní tlak, váhu atd.) — pouze strukturální extraction.

---

## 13. AI Orchestrator v0.1

Tenká orchestrační vrstva nad zamčenými kontrakty. Žádný přímý přístup do Supabase pro zdravotní data.

### Intent Classifier

Claude Haiku (`claude-haiku-4-5`) — tool-based classifier (`classify_intent` tool, `tool_choice: forced`).  
Vstup: uživatelský text + session context (pending_question, current_action).  
Výstup: `{ event_type, payload }`.  
Fallback při chybě: `GENERAL_HEALTH_REQUEST`.

### Session State (stateless endpoint)

Orchestrator endpoint je **stateless** — session state žije u volajícího (Launcher).  
Caller musí po každém volání mergovat `session_updates` do svého session store.

Klíčová session pole:
```
last_daily_decision        DAILY_DECISION z předchozího kola
pending_question           { evidence_type, text } — aktuálně čekající NBE otázka
current_action_assignment  { action_id, intervention_id, label } — přiřazená akce
```

### Hard boundaries orchestratoru

- Nesmí měnit `PERSON_NODE_STATE`
- Nesmí vytvářet klinické inference mimo engine
- Nesmí přepisovat `NBA.selected`, `SYSTEM_CONSTRAINT`, `SYSTEM_LEVERAGE`
- Nesmí obcházet Safety Gate
- WHY flow čte pouze `explanation_context` — žádná nová inference

---

## 14. Evidence Resolution

`evidenceResolution.js` — definuje, kdy engine považuje evidence type za „vyřešený" (nepotřebuje znovu ASK).

```
evidence_kind:
  RAW_VALUE         — uživatel zadá konkrétní hodnotu (číslo, kategorie)
  AVAILABILITY_ONLY — pouze sleduje, zda data existují; žádná single hodnota (steps_day)
  DERIVED           — computed z time series; dialog může zachytit pouze NOT_AVAILABLE
```

Resolved = existuje `evidence_availability[type]` (AVAILABLE nebo NOT_AVAILABLE)  
         NEBO existuje canonical value v `onboarding_inputs[value_key]` (RAW_VALUE)

Difference `AVAILABLE` vs `NOT_AVAILABLE` se **záměrně nepropaguje** do inference — obě znamenají „ptali jsme se, dostali jsme odpověď; neptejme se znovu."

---

## 15. Soubory — kompletní přehled

### Engine Core (zamčeno — bug s repro → opravit; nový mechanismus bez MVP důkazu → ne)

```
api/engine/
├── engine.js             ← hlavní pipeline, ENGINE_VERSION='1.0.0'        🔒 LOCKED
├── dailyDecision.js      ← computeDailyDecision()                          🔒 LOCKED
├── healthEventAdapter.js ← applyHealthEvent(), EVIDENCE_STORAGE_REGISTRY  🔒 LOCKED (28/28 pass)
├── orchestrator.js       ← processInput(), classifyIntent(), buildEvent()  🔒 LOCKED (31/31 pass)
├── adapter.js            ← fetchHealthData, fetchActionAssignments, mapDiagnosis
├── activation.js         ← CONFIRMED + MEASURED stavy
├── inference.js          ← PREDICTED_CURRENT + UNKNOWN (RELEVANT_UNKNOWN pravidlo)
├── projections.js        ← PERSON_PROJECTION[] (oddělená entita)
├── informationNeeds.js   ← buildInformationNeeds(), mergeResponseNeeds()
├── nextBestEvidence.js   ← selectNextBestEvidence() — lexikografická selekce
├── decisionGate.js       ← evaluateDecisionGate() — per-context gate
├── systemLeverage.js     ← computeSystemLeverage()
├── systemConstraint.js   ← computeSystemConstraint()
├── nextBestAction.js     ← computeNextBestAction(), buildCandidates(), Safety Gate
├── adherence.js          ← Feedback Loop v0.1: exposure, response evaluations
└── evidenceResolution.js ← isEvidenceResolved(), EVIDENCE_RESOLUTION_REGISTRY
```

### Engine Data

```
data/engine/
├── master.json           ← MASTER_NODE[], MASTER_EDGE[] — Master slice
└── intervention-map.json ← interventions, expected_responses, minimum_exposure_rule
```

### API Endpoints

```
api/
├── orchestrate.js        ← POST /api/orchestrate { userId, text, session }
│                            → ORCHESTRATOR_RESPONSE { mode, text, buttons, session_updates }
└── engine-v1.js          ← POST /api/engine-v1 { userId } → runEngine() výstup
                             (debug/test endpoint — není primární flow)
```

### Presentation / Integration Layer (mimo Engine Core)

```
app/js/universe/launcher.js   ← shell, ElevenLabs TTS, session state, volá /api/orchestrate
api/chat.js                   ← legacy CHJ AI verdikt (starý flow, mimo engine pipeline)
api/tts.js                    ← ElevenLabs TTS (Mode A: text→audio, Mode B: context→Haiku→audio)
api/hud-data-bulk.js          ← Vitality Score pro Vesmír / Launcher laser — mimo engine
app/crt.html                  ← CRT vizualizace (presentation layer)
app/index.html (universe)     ← Vesmír canvas (frozen)
```

---

## 16. Hlavní DB tabulky

| Tabulka | Popis | Primární writer |
|---------|-------|----------------|
| `user_profiles` | `birth_year`, `gender`, `height`, `weight` | healthEventAdapter (birth_year z GENERAL_HEALTH_REQUEST) |
| `user_health_profile` | `diagnoses`, `symptoms`, `medications`, `supplements`, `labs`, `lifestyle`, `physical`, `doctor_notes` | healthEventAdapter, CRT onboarding |
| `user_constraints` | Fyzická / pohybová omezení (`constraint_type`, `constraint_key`, `severity`) | healthEventAdapter (NEW_SYMPTOM, NEW_CONSTRAINT, ANSWER) |
| `daily_checkin` | Denní check-in (váha, pohyb, stres, spánek) | healthEventAdapter (ANSWER_TO_EVIDENCE_QUESTION) |
| `action_assignments` | Výsledky akcí — COMPLETED / SKIPPED | healthEventAdapter (ACTION_COMPLETED, ACTION_SKIPPED) |
| `longevity_actions` | Pool akcí s protocol_type, safety tags, constraint_exclude | statická data — ručně migrovat |

---

## 17. Josef — referenční testovací profil

Muž, nar. 1957 (69 let). Canonical `birth_year` v `user_profiles`.  
Diagnózy: Fibrilace síní (FaP), Hypertenze, Erektilní dysfunkce, Dyslipidémie.  
Léky: Pradaxa (antikoagulans), Betaloc/Concor (betablokátor). BMI ~26.1.

| node_id | current_state | confidence |
|---------|--------------|------------|
| HYPERTENSION | CONFIRMED | high |
| ERECTILE_DYSFUNCTION | CONFIRMED | high |
| DYSLIPIDEMIA | CONFIRMED | high |
| PHYSICAL_INACTIVITY | PREDICTED_CURRENT | low |
| EXCESS_ADIPOSITY | MEASURED | low |
| INSULIN_RESISTANCE | PREDICTED_CURRENT | medium |
| ENDOTHELIAL_DYSFUNCTION | PREDICTED_CURRENT | medium |
| PHYSICAL_DECONDITIONING | PREDICTED_CURRENT | low |
| LOW_MUSCLE_STRENGTH | UNKNOWN | unknown |
| LOSS_OF_FLOOR_RISE_ABILITY | UNKNOWN | unknown |

Josefovy tři CONTEXT_DECISION_GATE jsou všechny `EVIDENCE_SUFFICIENT` — viz původní `CHJ-ARCHITECTURE-V1.md` pro detail.

---

## 18. Feature Freeze

Health Engine je **feature-frozen**:

- **Nový mechanismus bez MVP důkazu → NE**
- **Prokázaný bug s reprodukcí → ANO — opravit**

---

## 19. Known Tech Debt

| Oblast | Popis | Kdy opravit |
|--------|-------|-------------|
| **`computeReevaluateAfter`** | Parsuje `horizon_min_days` regexem z reason stringu; pokud se změní formát stringu, parsing tiše selže. Správně by mělo být strukturované pole z `evaluateSingleResponse`. | Před v0.4.0 |
| **ATRIAL_FIBRILLATION** | FaP je v Josefově profilu diagnostikována, ale aktuálně netransformuje na aktivní uzel — chybí v Master slice | v0.3.x |
| **CV projekce kalibrace** | `calibrated=false` — numerické vstupy (ApoB, LP(a), CAC) nejsou zapojeny do risk kvantifikace | v0.4.0 |
| **Věkové / pohlavní auto_if** | Age ≥ 60 + sex-specific risk factors nejsou v Engine v1 implementovány | v0.4.0 |
| **TRACE log** v `fetchActionAssignments` | `console.log` pro diagnostiku — odebrat po stabilizaci | v0.3.x |

---

*Datum: 2026-08-16 · Engine version: 1.0.0*
