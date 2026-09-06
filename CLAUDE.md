# CLAUDE.md — CHJ Coding Agent Contract

> Operační pravidla pro Claude Code. Detailní architektura → canonical dokumenty níže.

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

## 1. Canonical Sources

| Otázka | Kde najdeš odpověď |
|--------|--------------------|
| Product behavior, role vrstev, filozofie, vize | `docs/CHJ-PRODUCT-ARCHITECTURE.md` |
| Engine contracts, pipeline, evidence, actions, DAILY_DECISION | `docs/CHJ-ENGINE-ARCHITECTURE.md` |
| Coding-agent operating rules | `CLAUDE.md` (tento soubor) |

Nekopíruj obsah canonical dokumentů do kódu ani jiných souborů.

---

## 2. Environment

| Branch | URL | Účel |
|--------|-----|------|
| `main` | dev.iting.cz | Vývoj — každý push deployuje |
| `test` | test.iting.cz | Testování před produkcí |
| `production` | app.iting.cz | Zákazníci |
| `demo` | demo.iting.cz | Demo |

**Stack (aktuální):**
- Frontend: Vanilla JS + HTML/CSS (bez frameworku)
- Backend: Vercel serverless (Node.js, ESM)
- AI: `claude-haiku-4-5` (orchestrator, TTS context) · `claude-sonnet-5` (med klasifikace)
- DB: Supabase (PostgreSQL) · Auth: Firebase · TTS: ElevenLabs (`eleven_multilingual_v2`)

**Lokální dev:** `NODE_TLS_REJECT_UNAUTHORIZED=0 npx vercel dev` → localhost:3001  
Appka vyžaduje Supabase + Firebase — nelze testovat bez backendu. Vždy ověřit na `dev.iting.cz` po push.

---

## 3. Change Discipline

- **Jeden commit = jedna logická změna**
- Před změnou core/engine: nejdřív reprodukovat problém
- Prokázaný bug → nejmenší oprava na správné vrstvě
- Neřešit symptom prezentačním hackem, pokud chyba leží v datovém nebo decision contractu
- Po změně spustit relevantní regression suite (`scripts/test-*.mjs`)
- Syntax/runtime error způsobený změnou opravit před další prací

---

## 4. Engine Protection

Health Engine je **feature-frozen** — ne absolutně locked:

```
nový mechanismus bez důkazu z MVP    → NE
reprodukovaný contract/logic bug     → ANO — nejmenší oprava
```

Před změnou rozhodovacího core přečíst `docs/CHJ-ENGINE-ARCHITECTURE.md`.

**Hard boundaries (nikdy neporušovat):**
- Safety Gate se neobchází
- NBA vybírá action — DAILY_DECISION alternativu z `all_candidates` nevybírá
- Orchestrator nevyrábí vlastní zdravotní rozhodnutí
- Presentation layer nemění význam structured decision (action, dávku, safety condition, evidence, decision mode)
- Session state není health source of truth — persistentní zdravotní fakta jsou v DB

### Chráněné core soubory

| Soubor | Status |
|--------|--------|
| `api/engine/engine.js` | 🔒 LOCKED |
| `api/engine/dailyDecision.js` | 🔒 LOCKED |
| `api/engine/healthEventAdapter.js` | 🔒 LOCKED — 28/28 pass |
| `api/engine/orchestrator.js` | 🔒 LOCKED — 31/31 unit/contract pass; broader suite 240/255, 15 known N/O baseline |
| `app/js/universe/universe-init.js` | ⚠️ JÁDRO Vesmír |
| `app/js/universe/universe-core.js` | ⚠️ JÁDRO Vesmír |
| `api/hud-data-bulk.js` | ⚠️ JÁDRO Vesmír |

---

## 5. AI Boundary

```
AI:     natural language ↔ structured interpretation / presentation
Engine: decision
```

AI nesmí svévolně změnit action, dávku, safety condition, evidence ani decision mode.

---

## 6. Data & Code Rules

- **ESM** (`"type": "module"`) — žádné CommonJS
- `dotenv.config({ path: '.env.local' })` na začátku každé serverless funkce
- Supabase anon key pouze v `app/js/universe/supabaseClient.js` (read-only)
- Všechny DB zápisy přes serverless API endpointy — service_role klíč zůstává na serveru
- Žádné inline duplikování dat, která existují v JSON souborech nebo DB
- Migrace: SQL skripty v `/migrations/` — spouštět ručně v Supabase SQL Editoru; před spuštěním přečíst komentář

---

## 7. Tester Safety

`TESTER_UIDS` v `api/tester-reset.js` smí obsahovat pouze skutečné disposable tester účty.

**Permanentně chráněné — nikdy nepřidat do `TESTER_UIDS`:**
- Josef: `vPrm5PNzLWWWhi9sSwYVbkb9FaD3`
- Kovářová: viz Supabase (není disposable tester)

Nikdy nezaměnit produkční nebo protected účet za disposable Tester účet.

---

## 8. CHJ Language Rules

Platí pro CHJ AI výstupy (`api/chat.js`, orchestrator text responses):

- Primární Launcher odpovědi (ACT, ASK, HOLD): jedna věta, max 15 slov — stručnost je princip, ne trest; EXPLAIN nebo SAFETY může použít více vět, pokud je to nutné pro srozumitelnost nebo bezpečnost
- Čeština, tykání, žádné diagnózy v uživatelské formulaci
- Žádné akční kroky v textu — akce patří do structured ACTION výstupu
- **Zakázaná slova:** musíš, okamžitě, je důležité, měl bys, hrozí, ohrožuje, samostatnost, závislý, pomoc druhých, špatně, trpí

---

## 9. Security Model

### Auth Chain

```
Firebase Auth
→ requireAuth (api/*.js)
→ authoritative auth.uid (Firebase identity — klient nemůže podstrčit jiný userId)
→ serverless API (Vercel)
→ Supabase service_role (DB reads/writes)
→ private browser Supabase access = 0
```

**Principy:**
- Firebase identity je autorita pro private API — `auth.uid` z ověřeného Firebase JWT, ne klientský `userId`
- Client-supplied `userId` není autoritativní — `api/user.js` řádky 14–20 přepisují `userId` hodnotou z Firebase tokenu
- `SUPABASE_SERVICE_ROLE_KEY` pouze server-side — nikdy frontend
- Private user tables nejsou přímo přístupné browseru — veškerý přístup přes serverless API
- Public content (`longevity_nodes`, `universe_nodes` atd.) může mít browser SELECT v souladu s RLS policies
- `auth.uid()` v Supabase PostgreSQL = NULL pro Firebase JWT — není CHJ private identity model

### P0–P2 Security Program Status

**P0–P2: CLOSED. Product development: GO.**

Dokončeno:
- P0: Browser-direct private Supabase access odstraněn (0 private browser Supabase calls)
- P1B: Private browser read/write cesty migrovány na authorized serverless API
- P2: 20/20 primárních privátních tabulek zamčeno (RLS ON + REVOKE anon/authenticated)

Zbývající položky (pre-production/hygiene, **ne blocker product developmentu**):
- `crt-generate.js` mock unauthenticated AI cost path
- `tester-reset.js` authentication hardening
- Extra-private ACL + demo-policy hygiene (6 tabulek)
- RPC EXECUTE grant hygiene
- MAINTAIN + public grant hygiene
- Restore test databázové zálohy

Nepouštět se do jejich implementace bez explicitního product rozhodnutí.
