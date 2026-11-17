# Chytré já (CHJ)

Mobilní longevity kouč postavený na principech Medicine 3.0 (Peter Attia,
*Outlive*). Appka sleduje stav uživatele a říká mu, na co se má dnes zaměřit
a proč — bez nutnosti sám hledat nebo vybírat.

## Kde začít

| Potřebuješ | Jdi do |
|---|---|
| Produktová filozofie, role vrstev, vize | `docs/CHJ-PRODUCT-ARCHITECTURE.md` |
| Engine kontrakty, pipeline, DAILY_DECISION | `docs/CHJ-ENGINE-ARCHITECTURE.md` |
| Pravidla pro Claude Code (coding agent) | `CLAUDE.md` |
| Co se nedávno změnilo, co je otevřené | `docs/DEVLOG.md`, `docs/BACKLOG.md` |

## Stack

- **Frontend:** Vanilla JS + HTML/CSS (bez frameworku)
- **Backend:** Vercel serverless funkce (Node.js, ESM)
- **AI:** `claude-haiku-4-5` (orchestrator, TTS kontext) · `claude-sonnet-5` (klasifikace)
- **DB:** Supabase (PostgreSQL) · **Auth:** Firebase · **TTS:** ElevenLabs

## Prostředí

| Branch | URL | Účel |
|---|---|---|
| `main` | dev.iting.cz | Vývoj — každý push deployuje |
| `test` | test.iting.cz | Testování před produkcí |
| `production` | app.iting.cz | Zákazníci |
| `demo` | demo.iting.cz | Demo |

Hlavní uživatelský vstup je `/launcher` (`app/launcher.html` +
`api/orchestrate.js` + `api/engine/orchestrator.js`) — deterministický
enginový tok. `/app` (`api/orchestrator.js`, bez "e") je starší systém s
volným AI textem přes Claude Haiku; drží se pro srovnání vizuálního vzhledu,
ne jako primární vývojový cíl.

## Lokální vývoj

```
NODE_TLS_REJECT_UNAUTHORIZED=0 npx vercel dev
```

→ `localhost:3001`. Appka vyžaduje Supabase + Firebase — nejde testovat bez
připojeného backendu. Po každé změně ověřit na `dev.iting.cz`.

## Testy

Regresní sady v `scripts/test-*.mjs`, spouští se přímo přes `node` (většina
izolovaně od DB/AI, viz hlavička každého souboru):

```
node --experimental-vm-modules scripts/test-action-copy.mjs
node --experimental-vm-modules scripts/test-audit-e2e-scenarios.mjs
node scripts/test-safety-scenarios.mjs
```
