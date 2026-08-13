# CHJ Engine v1 — Architecture Document

> **Technický detail Health Engine v1.** Canonical (system-level) architektura → `docs/CHJ-ARCHITECTURE-V2.md`  
> Stav k: 2026-08-11 · Engine version: `1.0.0`  
> Referenční commit: `7bcf9ee`

---

## Filozofie

Engine v1 není diagnostický systém ani health tracker.  
Je to **rozhodovací vrstva** — pro každého člověka v každém okamžiku odpovídá na dvě otázky:

1. **Co víme?** — aktivní stavy uzlů + projekce rizika
2. **Co dělat dál?** — gate: máme dost dat pro rozhodnutí, nebo potřebujeme víc?

### Dvě základní zásady

**Heuristika nikdy nepřepíše fakt.**  
Inference a projekce pracují jen s tím, co není přímo potvrzeno. Jakmile existuje přímé měření nebo diagnóza (CONFIRMED / MEASURED), engine ji respektuje a nikdy ji nepřepisuje prediktivním výstupem. Fakta mají absolutní prioritu.

**Nesbíráme data, pokud pravděpodobně nezmění rozhodnutí.**  
INFORMATION_NEED se generuje pouze tehdy, když chybějící evidence má `decision_impact ≥ medium`. NEXT_BEST_EVIDENCE se generuje jen pro kontexty s `NEED_MORE_EVIDENCE`. Sběr dat pro sběr dat je anti-pattern.

---

## Health Data Model v1

Tři oddělené vrstvy vstupu. Žádná vrstva není přepsána jinou.

### PERSON
```
person_id    string
sex          'M' | 'F' | null
birth_year   number | null       ← canonical source: user_profiles.birth_year
height_cm    number | null
```

### CLINICAL HISTORY
```
diagnoses[]          { id, raw_label, status }
medications[]        { substance, dose, status }
supplements[]        { substance, dose, status }
lifestyle            { sedentary_work, smoking_history, alcohol_history }
capacity             {}              ← z health profile (volná struktura)
onboarding_inputs    { question_id → value }   ← flat mapa odpovědí z node_inputs
```

### OBSERVATIONS
```
obs_type      string           ← kanonický typ (weight_kg, bp_systolic, lab_ldl …)
value         number | string
unit          string | null
measured_at   ISO date | null
source        'daily_checkin' | 'health_profile' | 'lab_report' | 'onboarding' | …
confidence    'confirmed' | 'estimated'
```

---

## Master Slice (data/engine/master.json)

Engine v1 pracuje na **vybraném podgrafu** celého longevity modelu — tzv. Master slice. Definuje uzly a hrany, které engine aktuálně rozumí a vyhodnocuje.

### MASTER_NODE
```json
{
  "id":          "HYPERTENSION",
  "label":       "Hypertenze",
  "domain":      "cv",
  "layer":       2,
  "type":        "condition"
}
```

### MASTER_EDGE
```json
{
  "from": "HYPERTENSION",
  "to":   "ENDOTHELIAL_DYSFUNCTION",
  "type": "causal"
}
```

Aktuální Master slice (Josef longevity + fyzická dekondice):

| Node | Domain | Layer | Typ |
|------|--------|-------|-----|
| PHYSICAL_INACTIVITY | functional | 0 | root_cause |
| EXCESS_ADIPOSITY | metabolic | 1 | condition |
| INSULIN_RESISTANCE | metabolic | 2 | condition |
| HYPERTENSION | cv | 2 | condition |
| DYSLIPIDEMIA | cv | 2 | condition |
| ENDOTHELIAL_DYSFUNCTION | cv | 3 | condition |
| ERECTILE_DYSFUNCTION | cv | 4 | ude |
| PHYSICAL_DECONDITIONING | functional | 1 | condition |
| LOW_MUSCLE_STRENGTH | functional | 2 | condition |
| REDUCED_FUNCTIONAL_RESERVE | functional | 3 | condition |
| LOSS_OF_FLOOR_RISE_ABILITY | functional | 4 | ude |

---

## Pipeline

```
fetchHealthData(userId)
  → { person, clinicalHistory, observations }

activation(person, clinicalHistory, observations)
  → PERSON_NODE_STATE[]   (CONFIRMED + MEASURED)

inference(activated, person, clinicalHistory, observations)
  → + PERSON_NODE_STATE[] (PREDICTED_CURRENT + UNKNOWN)

computeProjections(allStates, person, clinicalHistory)
  → PERSON_PROJECTION[]   (oddělená entita, M:N na node_states)

buildInformationNeeds(node_states, projections)
  → INFORMATION_NEED[]

evaluateDecisionGate(node_states, projections, information_needs, engineVersion)
  → DECISION_GATE {
      context_gates[],         ← per decision_context
      any_context_action_ready,
      contexts_needing_evidence
    }
```

---

## PERSON_NODE_STATE

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
missing_evidence[]       ← co chybí pro zpřesnění nebo potvrzení stavu
evaluated_at     ISO
engine_version   string
```

### Čtyři stavy — pravidla

| Stav | Kdy | Zdroj |
|------|-----|-------|
| **CONFIRMED** | Diagnóza od lékaře nebo lab potvrzuje existenci stavu | `clinicalHistory.diagnoses` keyword match |
| **MEASURED** | Přímé měření; hodnota existuje, ale stav je odvozený (např. BMI z váhy) | `observations` + výpočet |
| **PREDICTED_CURRENT** | Inferenční kaskáda — uzel pravděpodobně aktivní na základě jiných aktivních uzlů | `inference()` pravidla |
| **UNKNOWN** | Uzel je na aktivní inference cestě, jeho stav nelze určit, a absence dat materiálně ovlivňuje výstup | `RELEVANT_UNKNOWN` pravidlo |

#### RELEVANT_UNKNOWN pravidlo

UNKNOWN se vytvoří pouze tehdy, když platí VŠECHNY tři podmínky:
1. Uzel je součástí aktivní inference / projekce cesty
2. Jeho stav nelze určit z dostupných dat
3. Absence stavu materiálně mění inference nebo projekci

`REDUCED_FUNCTIONAL_RESERVE` **není** UNKNOWN pro Josefa — nemění výstup nezávisle na `LOW_MUSCLE_STRENGTH`.

---

## PERSON_PROJECTION

**Oddělená entita** — ne pole na `PERSON_NODE_STATE`.  
Reprezentuje budoucí riziko, může referovat více uzlů současně (M:N).

```
person_id        string
target_node_id   string          ← cíl projekce (např. CARDIOVASCULAR_DISEASE)
risk             'elevated' | 'moderate' | 'low' | 'unknown'
confidence       'high' | 'medium' | 'low' | 'unknown'
calibrated       boolean         ← false = nekalibrovaná kvalitativní projekce
risk_basis       string          ← kauzální odůvodnění
missing_evidence[]               ← co by zpřesnilo projekci
evaluated_at     ISO
engine_version   string
```

### risk_level × projection_confidence — dva oddělené osy

| Osa | Co vyjadřuje | Kdy se mění |
|-----|-------------|-------------|
| `risk` | **Směr a velikost rizika** (elevated / moderate / low / unknown) | Při změně vstupní hodnoty (nové TK, nový lab) |
| `confidence` | **Spolehlivost samotné projekce** — jak věříme pravidlu/modelu | Při kompletní sadě evidence A kalibraci pravidla |

**Příznivá hodnota nezvyšuje `confidence` automaticky.** `calibrated=false` zůstává dokud není pravidlo kalibrováno na populaci. Jedno měření mění `risk`, ne `confidence`.

---

## Information Value v0.1

### INFORMATION_NEED

Deduplikovaný kandidát chybějící evidence. Jeden záznam na kanonický `evidence_type` (i když ho potřebuje více uzlů → `needed_for[]` má více položek).

```
id                   'NEED_BP_SYSTOLIC'
evidence_type        'bp_systolic'           ← canonical key (synonyma mergována)
needed_for[]         [{ entity_type, entity_id }]
decision_impact      'high' | 'medium' | 'low'
uncertainty_reduction 'high' | 'medium' | 'low'
acquisition_cost     'very_low' | 'low' | 'medium' | 'high'
urgency              'high' | 'medium' | 'low'
acquisition_method   'question' | 'home_measurement' | 'functional_test' | 'wearable' | 'laboratory' | 'clinician'
explanation          string
```

#### Urgency pravidla

| Urgency | Kdy |
|---------|-----|
| **high** | Evidence chybí pro CONFIRMED CV uzel (stav je potvrzen, kontrolní hodnota chybí) |
| **medium** | CV projekce nebo PREDICTED_CURRENT / metabolický nebo funkční uzel |
| **low** | Behaviorální nebo ostatní |

CV projekce a PREDICTED_CURRENT stavy jsou **risk-refinement**, ne urgentně actionable → `medium`.

### NEXT_BEST_EVIDENCE

0 nebo 1 výsledek. Generuje se **pouze** pro kontext s `NEED_MORE_EVIDENCE`.

```
evidence_type
acquisition_method
reason                  ← proč vybráno (lexikografické pořadí)
expected_effect[]       ← co se změní per entity (risk_level / confidence odděleně)
decision_impact
uncertainty_reduction
acquisition_cost
urgency
selected_at
engine_version
```

#### Lexikografická selekce (A→B→C→D)

| Krok | Kritérium | Pořadí |
|------|-----------|--------|
| A | urgency | high > medium > low |
| B | decision_impact | high > medium > low |
| C | uncertainty_reduction | high > medium > low |
| D | acquisition_cost | very_low < low < medium < high |

**STOP RULE:** pokud žádný kandidát nemá `decision_impact ≥ medium`, vrátí `null`.  
Žádné pseudo-scoring, žádné váhy — čistě lexikografické pořadí.

---

## Decision Gate v1 — per decision_context

### Architektura

Gate se vyhodnocuje **per kontext** — ne globálně. EVIDENCE_SUFFICIENT v jednom kontextu neblokuje NEXT_BEST_EVIDENCE v jiném kontextu s NEED_MORE_EVIDENCE.

### CONTEXT_DECISION_GATE

```
decision_context {
  id, label,
  active_nodes[],
  active_projections[]
}
status               'EVIDENCE_SUFFICIENT' | 'NEED_MORE_EVIDENCE'
blocking_uncertainties[]   ← jen materiální blokery (deduplikováno per entity_id)
actionable_findings[]      ← všechny uzly/projekce v tomto kontextu s jejich actionability
next_best_evidence?        ← null pokud EVIDENCE_SUFFICIENT
reason                     string
```

### Globální agregát

```
context_gates[]              ← per-context výsledky
any_context_action_ready     boolean
contexts_needing_evidence[]  string[]  ← ID kontextů s NEED_MORE_EVIDENCE
```

### Actionability — pět úrovní

| Úroveň | Kdy | Příklady |
|--------|-----|---------|
| **SAFETY_CRITICAL** | Konkrétní aktuální krizová hodnota / explicitní bezpečnostní pravidlo. **Nikoli** jen potvrzená diagnóza. | BP > 180 potvrzené, aktivní nebezpečná arytmie — zatím netriggerováno |
| **RISK_RELEVANT** | Potvrzená klinicky významná diagnóza — jasný směr managementu | HYPERTENSION(CONFIRMED), ERECTILE_DYSFUNCTION(CONFIRMED), DYSLIPIDEMIA(CONFIRMED) |
| **ACTIONABLE** | Jasný akční směr z přímé evidence nebo predikce behaviorálního uzlu | PHYSICAL_INACTIVITY(PREDICTED), EXCESS_ADIPOSITY(MEASURED), CV projekce(elevated) |
| **MONITOR** | Predikovaný mechanismus — sledovat, potvrdit přímou evidencí | INSULIN_RESISTANCE(PREDICTED), ENDOTHELIAL_DYSFUNCTION(PREDICTED) |
| **NOT_YET_ACTIONABLE** | Stav neznámý — evidence potřeba před akcí | LOW_MUSCLE_STRENGTH(UNKNOWN), LOSS_OF_FLOOR_RISE_ABILITY(UNKNOWN) |

### Status pravidlo per kontext

```
has SAFETY_CRITICAL              → EVIDENCE_SUFFICIENT  (safety override)
has RISK_RELEVANT nebo ACTIONABLE → EVIDENCE_SUFFICIENT  (směr je jasný)
žádný direction-level finding    → NEED_MORE_EVIDENCE
```

**Blocking uncertainty** vzniká pouze tehdy, když kontext nemá žádný direction-level finding A existuje UNKNOWN stav nebo projekce s risk=unknown.  
Pokud doména má RISK_RELEVANT/ACTIONABLE finding → UNKNOWN uzly neblokují (zpřesňují detail, nemění větev).

---

## Josef — referenční testovací profil

Muž, nar. 1957 (69 let), Supabase user_id = Firebase UID (ne string 'josef').  
Diagnózy: Fibrilace síní (FaP), Hypertenze, Erektilní dysfunkce, Dyslipidémie.  
Léky: Pradaxa (antikoagulans), Betaloc/Concor (betablokátor).  
BMI ~26.1 (výška 173 cm, váha ~78 kg). Sedavé zaměstnání. Onboarding: nevyplněn (vynest_nakup, zvednout_vnouce, vstat_ze_zeme = null).

### Josef — aktuální PERSON_NODE_STATE[]

| node_id | current_state | confidence | Klíčová evidence |
|---------|--------------|------------|-----------------|
| HYPERTENSION | CONFIRMED | high | diagnóza "hypertenze" |
| ERECTILE_DYSFUNCTION | CONFIRMED | high | diagnóza "erektilní dysfunkce" |
| DYSLIPIDEMIA | CONFIRMED | high | diagnóza "dyslipidémie" |
| PHYSICAL_INACTIVITY | PREDICTED_CURRENT | low | sedentary_work=true |
| EXCESS_ADIPOSITY | MEASURED | low | BMI=26.1 z weight+height |
| INSULIN_RESISTANCE | PREDICTED_CURRENT | medium | inference z EXCESS_ADIPOSITY + PHYSICAL_INACTIVITY |
| ENDOTHELIAL_DYSFUNCTION | PREDICTED_CURRENT | medium | inference z HYPERTENSION + ERECTILE_DYSFUNCTION |
| PHYSICAL_DECONDITIONING | PREDICTED_CURRENT | low | inference z PHYSICAL_INACTIVITY |
| LOW_MUSCLE_STRENGTH | **UNKNOWN** | unknown | onboarding nevyplněn, žádný validovaný test |
| LOSS_OF_FLOOR_RISE_ABILITY | **UNKNOWN** | unknown | vstat_ze_zeme = null |

### Josef — aktuální PERSON_PROJECTION[]

| target_node_id | risk | confidence | calibrated | Základ |
|----------------|------|------------|------------|--------|
| CARDIOVASCULAR_DISEASE | elevated | low | false | HYPERTENSION + ED + DYSLIPIDEMIA — kauzální kaskáda bez přímých numerických dat |
| LOSS_OF_FLOOR_RISE_ABILITY | unknown | unknown | false | LOW_MUSCLE_STRENGTH=UNKNOWN — nelze určit směr |

### Josef — tři CONTEXT_DECISION_GATE

#### CURRENT_CV_STATE — `EVIDENCE_SUFFICIENT`
```
[RISK_RELEVANT]  HYPERTENSION             — CONFIRMED / high
[RISK_RELEVANT]  ERECTILE_DYSFUNCTION     — CONFIRMED / high
[RISK_RELEVANT]  DYSLIPIDEMIA             — CONFIRMED / high
[MONITOR]        ENDOTHELIAL_DYSFUNCTION  — PREDICTED_CURRENT / medium
[ACTIONABLE]     CARDIOVASCULAR_DISEASE   — elevated (projekce) / low
```
blocking_uncertainties: 0 · next_best_evidence: null  
reason: HYPERTENSION, ED, DYSLIPIDEMIA, CV projekce — směr jasný.

#### METABOLIC_STATE — `EVIDENCE_SUFFICIENT`
```
[ACTIONABLE]  EXCESS_ADIPOSITY  — MEASURED / low
[MONITOR]     INSULIN_RESISTANCE — PREDICTED_CURRENT / medium
```
blocking_uncertainties: 0 · next_best_evidence: null  
reason: EXCESS_ADIPOSITY(MEASURED) — směr jasný.

#### LONGEVITY_FUNCTION — `EVIDENCE_SUFFICIENT`
```
[ACTIONABLE]         PHYSICAL_INACTIVITY     — PREDICTED_CURRENT / low
[ACTIONABLE]         PHYSICAL_DECONDITIONING — PREDICTED_CURRENT / low
[NOT_YET_ACTIONABLE] LOW_MUSCLE_STRENGTH     — UNKNOWN / unknown
[NOT_YET_ACTIONABLE] LOSS_OF_FLOOR_RISE_ABILITY — UNKNOWN (node + projekce)
```
blocking_uncertainties: 0 · next_best_evidence: null  
reason: PHYSICAL_INACTIVITY + PHYSICAL_DECONDITIONING jsou ACTIONABLE — doména má směr. LOW_MUSCLE_STRENGTH(UNKNOWN) zpřesňuje, nemění větev.

**Globální agregát:**  
`any_context_action_ready: true · contexts_needing_evidence: []`

---

## Tech debt a co zatím NENÍ implementováno

### Chybí v Engine v1

| Oblast | Popis |
|--------|-------|
| **SCORE2 / ApoB / CAC kalibrace** | CV projekce je nekalibrovaná (calibrated=false). Numerické vstupy (ApoB, LP(a), CAC score) nejsou zapojeny do risk kvantifikace. |
| **Atrial Fibrillation kaskáda** | FaP je v Josefově profilu diagnostikována, ale engine ji aktuálně netransformuje na aktivní uzel (chybí v Master slice). |
| **Věkové / pohlavní auto_if pravidla** | Age ≥ 60 + sex-specific risk factors (viz CRT State Dictionary `auto_if`) nejsou v Engine v1 implementovány. |
| **Onboarding→UDE pipeline** | Odpovědi z onboardingu (vynest_nakup, zvednout_vnouce, vstat_ze_zeme) aktivují UNKNOWN uzly, ale neumí aktivovat CONFIRMED/MEASURED ze správně odpovězených otázek. |
| **VO2max / kardiorespirační kondice** | LOW_VO2MAX chybí v Master slice. |
| **Wearable integrace** | temporal_activity_trend, steps_day — evidence_type definován v informationNeeds.js, ale žádný wearable zdroj v adapteru. |
| **Decision Engine (ranking akcí)** | Vrstva pod Decision Gate — která z action-ready větví je systémově první? Není implementováno. |
| **Persistence node_states do DB** | Engine běží stateless — výsledky se neukládají do `user_metrics` ani nové tabulky. |
| **Per-user cache** | Výsledky enginu se nekešují — každý request znovu počítá. |

### Záměrně vynecháno (v0.4+)

- CSF 5: Onkologické riziko
- CSF 6: Neurokognitivní zachování
- Interakce suplementů a lékových forem

---

## Soubory Engine v1

```
api/
├── engine-v1.js                ← POST endpoint { userId } → runEngine()
└── engine/
    ├── engine.js               ← hlavní pipeline, ENGINE_VERSION = '1.0.0'
    ├── adapter.js              ← fetchHealthData — Supabase → Health Data Model v1
    ├── activation.js           ← CONFIRMED + MEASURED stavy
    ├── inference.js            ← PREDICTED_CURRENT + UNKNOWN (RELEVANT_UNKNOWN pravidlo)
    ├── projections.js          ← PERSON_PROJECTION[] (oddělená entita)
    ├── informationNeeds.js     ← buildInformationNeeds() — dedup + anotace
    ├── nextBestEvidence.js     ← selectNextBestEvidence() — lexikografická selekce
    └── decisionGate.js         ← evaluateDecisionGate() — per-context gate

data/engine/
└── master.json                 ← definice Master slice (MASTER_NODE[], MASTER_EDGE[])
```

---

## NEXT STEP: TOC Decision Engine v0.1

**První otázka pro příští session:**

> Která z Josefových action-ready větví — `CURRENT_CV_STATE`, `METABOLIC_STATE`, `LONGEVITY_FUNCTION` — je systémově první?

Zatím neimplementovat ranking akcí. Nejprve určit principy:

- Goldratt: bottleneck je kořen ovlivňující nejvíce CSF současně
- Attia: fyzická kapacita (VO2max, svalová síla) je leverage pro CV i metabolické zdraví
- Urgency: RISK_RELEVANT stav s chybějící kontrolní hodnotou (bp_systolic) vs. ACTIONABLE behaviorální uzel
- Reverzibilita: co se zhoršuje nejrychleji bez intervence?

Decision Engine dostane na vstup `context_gates[]` s `actionable_findings[]` — jeho výstupem bude seřazený seznam kontextů + první doporučená akce. Nenahrazuje lékaře.
