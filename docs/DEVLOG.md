# CHJ DEVLOG — Aktuální stav vývoje

> Handoff dokument pro nové Claude session. Stručný přehled: co funguje, co bylo opraveno, co zůstává otevřené.
> Aktualizováno: 2026-08-27 · Canonical docs → `CHJ-ENGINE-ARCHITECTURE.md`, `CHJ-PRODUCT-ARCHITECTURE.md`, `CLAUDE.md`

---

## Current status (2026-08-27)

Produkt je na `dev.iting.cz` (branch `main`). Engine stack je **feature-frozen a locked**.

| Komponenta | Stav |
|-----------|------|
| Health Engine v1 (`api/engine/engine.js`) | 🔒 LOCKED |
| DAILY_DECISION (`api/engine/dailyDecision.js`) | 🔒 LOCKED |
| Health Event Adapter (`api/engine/healthEventAdapter.js`) | 🔒 LOCKED — 28/28 pass |
| AI Orchestrator (`api/engine/orchestrator.js`) | 🔒 LOCKED — 31/31 pass (240/255 E2E, 15 known N/O baseline) |
| Launcher UI (`app/launcher.html`) | ✅ aktivní, busy guard + renderIdle fix |
| Tester Reset (`api/tester-reset.js`) | ✅ funkční, `TESTER_UIDS` obsahuje Tester 0 + Tester 1 |

**Ověřený E2E průchod (2026-08-27) — PASS:**
`ASK → 3 evidence otázky → BUDGET_EXHAUSTED summary → spontánní sedentary_hours → ACT (Jdi na procházku 20 minut) → WHY → Hotovo → HOLD`

---

## Práce z 26.–27. 8. 2026

### 1. BUDGET_EXHAUSTED dead-end

**Problém:** Pokud uživatel vyčerpal počet otázek (`qbudget=0`) před tím, než engine dostal dostatek dat, Launcher zasekl — input se zavřel, uživatel nemohl pokračovat.

**Oprava:** Non-acute BUDGET_EXHAUSTED otevře input a zobrazí shrnutí aktivních uzlů (node label summary), aby uživatel mohl dodat zbývající informaci. Acute BUDGET_EXHAUSTED zůstává terminální.

**Commit:** `f86fcec` · Soubor: `app/js/universe/launcher.js`

---

### 2. ZERO_DATA_FOLLOWUP + runtime bug `warnings is not defined`

**Problém A:** Po obdržení odpovědi bez žádných zdravotních dat (prázdný ASK follow-up) engine zavolal DAILY_DECISION, ale bez dat → nekonečná ASK smyčka.

**Oprava A:** `ZERO_DATA_FOLLOWUP` guard — pokud uživatelův vstup neobsahuje žádná zdravotní data, orchestrátor vrátí soft ASK místo volání engine. Commit: `fc2df62` · Soubor: `api/engine/orchestrator.js`

**Problém B:** Runtime chyba `warnings is not defined` při ZERO_DATA_FOLLOWUP větvi — proměnná `warnings` nebyla deklarována v tomto kódu path.

**Oprava B:** Inicializace `warnings` před použitím. Commit: `c582469` · Soubor: `api/engine/orchestrator.js`

---

### 3. P3 NBA policy — tier → time_to_feedback → friction

**Rozhodnutí:** NBA ranking přidává prioritizaci: nejdřív `starter` tier, pak `time_to_feedback` (rychlejší feedback = výše), pak `friction` (nižší = výše). Cíl: nový uživatel dostane co nejdřív pozitivní smyčku.

**Výsledek:** Pro `PHYSICAL_INACTIVITY` constraint engine vybírá `Jdi na procházku 20 minut` (starter, nízká friction, rychlý feedback) před agresivnějšími alternativami.

**Commit:** `c0e1304` · Soubor: `api/engine/engine.js` (🔒 LOCKED — tato oprava byla poslední)

---

### 4. ACTION_COMPLETED → HOLD + potvrzovací text

**Problém:** Po kliknutí `Hotovo` (ACTION_COMPLETED event) se orchestrátor dostal do HOLD stavu, ale text HOLD byl generický — nepotvrzoval dokončení akce, jen říkal "výsledky dozrávají".

**Oprava:** Nová větev v `buildHoldResponse()`: pokud `event_type === 'ACTION_COMPLETED'`, vrátí explicitní potvrzení `Hotovo. Pro dnešek stačí. Výsledek budeme hodnotit až po několika opakováních.`

**Commit:** `67565a4` · Soubor: `api/engine/orchestrator.js` (🔒 LOCKED)

---

### 5. Tester Full Reset — busy guard + renderIdle terminal-state restore

**Přístup k Full Reset:** Tester panel (Session reset + Full reset ⚠) je viditelný pouze při `?tester=1` v URL — tedy `/launcher?tester=1`. Toto je záměrný interní vstup. `Ctrl+Shift+R` (hard reload prohlížeče) Full reset **není** — pouze obnoví stránku bez dotyku DB. Whitelist `TESTER_UIDS` v `api/tester-reset.js` je autoritou — newhitelistovaný UID dostane `403`.

**Problém A — race condition:** Uživatel kliknul Full Reset během in-flight `orchestrate('Hotovo')`. Server-side INSERT do `action_assignments` přišel po reset DELETE → orphan COMPLETED row → HOLD_TOO_EARLY při každém dalším engine volání.

**Oprava A:** `busy` guard na Full Reset button — pokud je v letu request, zobrazí varování a neprovede reset.

**Problém B — terminalState:** HOLD response nastaví `_terminalState = true` (input disabled). `renderIdle()` ho neresetoval → po resetu z HOLD stavu zůstal input nepoužitelný bez reload stránky.

**Oprava B:** `renderIdle()` explicitně resetuje `_terminalState = false` a znovu zapíná `$input`, `$sendBtn`, `$micBtn`.

**Commit:** `350e8ab` · Soubor: `app/launcher.html`

**Regression testy:** `scripts/test-launcher-static.mjs` — 10/10 pass (LCH-1–10).

---

### 6. Nový tester UID v TESTER_UIDS

**Problém:** Nový tester account `e0ZYA3auBYUh9TOOtqQPqbkIcrJ2` (Tester 1) nebyl v `TESTER_UIDS` whitelist → Full Reset vracel `403` → orphan COMPLETED row přežil všechny UI resety → HOLD_TOO_EARLY při každém spuštění.

**Oprava:** Přidán do `TESTER_UIDS` jako Tester 1.

**Commit:** `00f0ce1` · Soubor: `api/tester-reset.js`

**Chráněné UID (nikdy nepřidat):** Josef `vPrm5PNzLWWWhi9sSwYVbkb9FaD3`, Kovářová (viz Supabase).

---

### 7. Subjective fatigue clarification — `fatigue_context` persistence

**Problém (P1):** `Jsem unavený.` → engine vrátil ASK s otázkou `Cítíš se při běžné chůzi stabilně?` (gait_stability), která nesouvisí se vstupem. Příčina strukturální: "unavený" se ukládá jako raw text do `symptoms[]` bez signálu do enginu, zatímco MOBILITY_NODES (GAIT_INSTABILITY atd.) mají nejvyšší urgency prioritu a dominují v NBE výběru.

**Řešení (TESTER 0.1):** Minimální clarification flow s normalizovaným `fatigue_context` polem:

1. `api/engine/healthEventAdapter.js` — přidán záznam `fatigue_context: { table: 'physical', key: 'fatigue_context' }` do `EVIDENCE_STORAGE_REGISTRY`. Umožňuje `routeAnswer('fatigue_context')` → `upsertPhysical(userId, 'fatigue_context', ...)` bez jakékoli logické změny.
2. `api/orchestrate.js` — rozšířen SELECT o `physical`, `fatigue_context` injektován do session state server-side (nikoli z klientského session).
3. `api/engine/orchestrator.js` — dvě přidání (bez mazání):
   - **Normalization guard** (před `applyHealthEvent`): normalizuje volný text odpovědi na `NEW_OR_UNUSUAL | ROUTINE | UNKNOWN` při `evidence_type === 'fatigue_context'`.
   - **Post-presentation fatigue clarification guard** (po ZERO_DATA_FOLLOWUP, před P0 budget gate): pokud `GENERAL_HEALTH_REQUEST` + fatigue text + `presentation.mode === 'ASK'` + `fatigue_context` ještě nenastaveno (cross-session) + žádná pending_question v session → vrátí clarification ASK jako **early return, který obchází budget gate** (clarification nestojí žádný budget slot).

**Výsledné chování:**
- `Jsem unavený.` → `Je ta únava něco nového nebo nezvyklého, nebo je to spíš běžná únava po náročném dni?`
- Odpověď → normalizace → `physical.fatigue_context = NEW_OR_UNUSUAL | ROUTINE | UNKNOWN` → standardní engine flow
- Příští session: `fatigue_context` již v DB → guard se nespustí → standardní NBE bez opakování otázky

**Safety Gate poznámka:** `NEW_OR_UNUSUAL` v TESTER 0.1 **nespouští Safety Gate ani medicínskou eskalaci**. Aktuální Safety Gate reaguje výhradně na `pending_clarifications[].type === 'new_symptom' && temporal_context === 'acute'`. `fatigue_context` je pure label v `physical` JSONB — engine neobsahuje activation rule pro tento klíč. Eskalační logika by vyžadovala samostatné engineering rozhodnutí mimo scope TESTER 0.1.

**Testy:**
- `scripts/test-health-event-adapter.mjs` → S10 přidán → **83/83 pass**
- `scripts/test-orchestrator.mjs` → scenarioSC (SC-1–SC-6) přidán → **256/271** (15 known N/O baseline beze změny)

---

### 8. Pre-classifier fatigue guard — deterministická klasifikace standalone fatigue

**Root cause:** Haiku classifier (`classifyIntent`) porušoval vlastní pravidlo 5 pro standalone fatigue vstupy (`"Jsem unavený."`) — místo `GENERAL_HEALTH_REQUEST` vracel `NEW_SYMPTOM` v ~50 % volání. Post-presentation fatigue clarification guard (§7) závisel na `event_type === 'GENERAL_HEALTH_REQUEST'` → nefiroval při NEW_SYMPTOM → uživatel dostával gait_stability otázku místo fatigue clarification.

**Řešení:** Exportovaný `FATIGUE_STANDALONE_RE` (`^...$` anchored regex) sdílený dvěma guard body:

1. **Pre-classifier guard** (vložen před `classifyIntent` v `processInput`) — short-circuits Haiku pro standalone fatigue formulace; vrací deterministicky `GENERAL_HEALTH_REQUEST`. Podmínky: `!pending_question && !current_action_assignment && FATIGUE_STANDALONE_RE.test(userText.trim())`.
2. **Post-presentation guard** (§7) — nahrazen inline `SUBJECTIVE_FATIGUE_RE` sdíleným `FATIGUE_STANDALONE_RE`; pokrytí rozšířeno o `"Cítím únavu."` a `"Nemám energii."` (starý regex tyto tvary neznal).

**Compound zdravotní výroky zachovány:** `^...$` anchor zajišťuje, že `"Jsem unavený a bolí mě na hrudi."` neodpovídá → projde přes Haiku a standardní safety/symptom flow beze změny.

**Dotčené soubory:** `api/engine/orchestrator.js` (export + pre-classifier guard + post-presentation update) · `scripts/test-orchestrator.mjs` (import + scenarioSC update + scenarioSCR + scenarioSCE2E + scenarioSCStability)

**Nedotčeno:** `engine.js`, `dailyDecision.js`, Safety Gate, `healthEventAdapter.js`, `orchestrate.js`, launcher.

**Testy:**
- `scripts/test-health-event-adapter.mjs` → **83/83 pass** (beze změny)
- `scripts/test-orchestrator.mjs` → **306/321** (15 known N/O baseline beze změny; +50 nových SC assertions)
- **Fatigue stability: 10/10** — 10 po sobě jdoucích `processInput("Jsem unavený.")` → vždy `SUBJECTIVE_FATIGUE_CLARIFICATION`; Haiku se pro tyto vstupy nevolá

---

### 9. Phantom `floorRiseProjection` — budget-burning NBE bez možnosti ACT

**Root cause:** `floorRiseProjection()` v `api/engine/projections.js` vracela projekci vždy, i když žádné upstream node_states (PHYSICAL_DECONDITIONING, LOW_MUSCLE_STRENGTH, REDUCED_FUNCTIONAL_RESERVE) nebyly přítomné. Tím vznikal phantom `LONGEVITY_FUNCTION` kontext s `NEED_MORE_EVIDENCE` statusem, který generoval 3 NBE otázky (`validated_strength_assessment`, `temporal_activity_trend`, `vstat_ze_zeme`) a spotřeboval celý question budget — bez jakékoli možnosti dosáhnout NBA a ACT (projekce s `risk='unknown'` bez upstream uzlů nemůže vybrat leverage node).

**Symptom:** Nový uživatel s fatigue vstupem: `"Jsem unavený."` → fatigue clarification → 3 funkční testy → `BUDGET_EXHAUSTED "Zatím o tobě nevím dost"`. Přitom jedinou otázkou, která by odblokovala ACT, je `sedentary_hours_day`.

**Řešení:** Minimální guard konzistentní s `cvDiseaseProjection` (která tento guard měla od začátku):

```javascript
// api/engine/projections.js — floorRiseProjection()
if (evidence.length === 0) return null;
```

Bez upstream evidence → funkce vrátí `null` → `computeProjections` ji nevloží → žádný phantom kontext → engine přejde do `ASK_BLOCKING null` path → `ZERO_DATA_FOLLOWUP` guard se spustí po 2 turnech → `"Přibližně kolik hodin za běžný den prosedíš?"` → `sedentary_hours_day = 8` → `PHYSICAL_INACTIVITY PREDICTED_CURRENT` → leverage → NBA SELECTED → **ACT**.

S upstream evidence (PHYSICAL_DECONDITIONING aktivní): `evidence.length > 0` → guard se nespustí → projekce vznikne beze změny.

**Dotčené soubory:** `api/engine/projections.js` · `scripts/test-floor-projection-fix.mjs` (nový, 15/15 pass)

**Nedotčeno:** `engine.js`, `dailyDecision.js`, `healthEventAdapter.js`, `orchestrator.js`, Safety Gate, NBA selection.

**Testy po fixu:**
- `scripts/test-health-event-adapter.mjs` → **83/83 pass** (beze změny)
- `scripts/test-nba-policy.mjs` → **10/10 pass** (beze změny)
- `scripts/test-orchestrator.mjs` → **306/321** (15 known N/O baseline beze změny)
- `scripts/test-floor-projection-fix.mjs` → **15/15 pass** (nový)

---

## Architektura dokumentace (po 2026-08-27)

| Soubor | Role |
|--------|------|
| `CLAUDE.md` | Instrukce pro Claude, pravidla, tester safety, stack |
| `docs/CHJ-ENGINE-ARCHITECTURE.md` | Canonical engine contract — LOCKED |
| `docs/CHJ-PRODUCT-ARCHITECTURE.md` | Canonical produktová ústava — LOCKED |
| `docs/DEVLOG.md` | Tento soubor — aktuální handoff |
| `docs/archive/CHJ-ARCHITECTURE-V1.md` | Archiv — původní engine spec (2026-08-11) |
| `docs/archive/CHJ-ARCHITECTURE-V2.md` | Archiv — system-level bridge dokument (2026-08-13) |
| `docs/archive/roadmap.md` | Archiv — produktová roadmapa Fáze 1–5 (2026-03-01) |

> Poznámka: `CHJ-ENGINE-ARCHITECTURE.md` a `CHJ-PRODUCT-ARCHITECTURE.md` obsahují v hlavičkách a tabulkách reference na staré cesty (`docs/CHJ-ARCHITECTURE-V1.md`, `docs/roadmap.md`). Tyto reference jsou informační/historické — soubory existují v `docs/archive/`.

---

## Open issues / Next

| Priorita | Issue | Poznámka |
|----------|-------|----------|
| P1 UX | Tester tools v avatar menu bez `?tester=1` | Whitelistovaný tester by měl vidět Full reset automaticky po auth; potřeba `GET /api/tester-check` nebo inline UID check po Firebase auth |
| P1 QA | Orchestrator 15 known baseline failures (240/255) | Prověřit: jsou to skutečné N/O edge cases nebo latentní bugy? Zdokumentovat konkrétní scénáře. |
| Tech debt | `README.md` zastaralý | Popisuje GPT-4o-mini + vis-network epoch (Q1 2026); určen k pozdější aktualizaci — neodráží současný stack |
| Tech debt | TRACE log v `api/engine/adapter.js` | `fetchActionAssignments` loguje diagnostic trace (`[ORCHESTRATE] loaded_action_assignments=...`) — bylo záměrné pro root-cause analýzu, může být odstraněno |
| Budoucí | Orchestrator `USER_PREFERENCE` persistence | Zachyceno, ale session neukládá (záměr v0.1); v0.2 by mělo persistovat do DB |
| Budoucí | Wearables integrace (Fáze 4) | Oura, Apple Health, Garmin — viz `docs/archive/roadmap.md` |
