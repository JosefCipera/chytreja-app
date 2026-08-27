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
