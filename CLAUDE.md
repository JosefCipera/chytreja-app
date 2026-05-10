# CLAUDE.md – CHJ (Chytré Já) v0.2.1

> Instrukce pro Claude Code. Detailní dokumentace pro vývojáře → `HANDBOOK.md`.

---

## Co je CHJ

PWA (SaaS) — mobilní AI kouč pro dlouhověkost (Medicine 3.0, Peter Attia "Outlive").
Telefon vede uživatele. Uživatel nemusí hledat ani přemýšlet — appka říká co dělat a proč.

**Název:** Chytré Já (CHJ) · **Jazyk:** UI labels anglicky, obsah česky, tykání
**Tón:** lidský kouč + sci-fi HUD terminál

---

## Stack (aktuální)

| Vrstva | Technologie | Poznámka |
|--------|-------------|----------|
| **Frontend** | Vanilla JS + HTML/CSS | Žádný framework |
| **Canvas** | vis.js network | Uzly jako planety |
| **Backend** | Vercel serverless (Node.js, ESM) | |
| **AI** | OpenAI GPT-4o-mini | Chat + verdikt |
| **AI (parser)** | Claude Sonnet | Health Document Parser |
| **DB** | Supabase (PostgreSQL) | |
| **Auth** | Firebase | |
| **TTS** | Web Speech API | Plán: ElevenLabs |

---

## Adresářová struktura

```
app/
├── index.html
├── js/universe/
│   ├── universe-init.js    ← JÁDRO: načítání modelu, access, kaskáda stavů
│   ├── universe-core.js    ← JÁDRO: canvas rendering, barvy, lock ikony
│   ├── universe-panel.js   ← HUD panel (detail uzlu)
│   ├── onboarding.js       ← onboardingové otázky + uložení
│   ├── hud.js              ← HUD inicializace
│   └── supabaseClient.js   ← anon key (pouze read)
├── css/
└── hud.html

api/
├── hud-data-bulk.js        ← JÁDRO: výpočet baterie, worstLeaf
├── chat.js                 ← CHJ AI verdikt
├── mission-complete.js     ← game loop
├── mission-log.js          ← záznam kroků
├── onboarding-save.js      ← uložení onboardingu (service_role)
├── disciplines.js          ← disciplíny podle node
└── tools/
    └── parse.js            ← Health Document Parser (Claude Vision)

data/
├── index.json              ← seznam vesmírů
└── universes/
    ├── longevity/
    │   ├── models/longevity.json
    │   └── access/
    │       ├── access-dekatlon.json   ← role access map
    │       └── access-demo.json
    └── toc/
        └── models/toc.json

migrations/                 ← SQL migrační skripty (spouštět ručně v Supabase)
.githooks/
└── pre-push               ← syntax check jádra před pushem
```

---

## JÁDRO vs OBSAH

### ⚠️ JÁDRO — každá změna může shodit appku

| Soubor | Co dělá |
|--------|---------|
| `app/js/universe/universe-init.js` | Načítání modelu, access model, kaskáda stavů |
| `app/js/universe/universe-core.js` | Canvas rendering, barvy uzlů, lock ikony |
| `api/hud-data-bulk.js` | Výpočet baterie, worstLeaf kaskáda |

**Pravidlo:** před změnou jádra — napiš repro scénář. Po změně — ověř na `dev.iting.cz`.
**Pre-push hook** automaticky kontroluje syntax těchto souborů.

### ✅ OBSAH — bezpečná zóna

| Soubor/složka | Co dělá |
|---------------|---------|
| `data/universes/*/access/*.json` | Kdo vidí co (role access maps) |
| `app/js/universe/onboarding.js` | Onboardingové otázky |
| `data/universes/*/models/*.json` | Struktura vesmíru |
| `migrations/*.sql` | DB změny |

---

## Prostředí

| Branch | URL | Účel |
|--------|-----|------|
| `main` | dev.iting.cz | Vývoj |
| `test` | test.iting.cz | Testování |
| `production` | app.iting.cz | Produkce |
| `demo` | demo.iting.cz | Demo |

**Lokální vývoj:** appka vyžaduje Supabase + Firebase — nelze testovat bez backendu.
Vždy testovat na `dev.iting.cz` po pushnutí.

---

## Datový model

### Tabulky

| Tabulka | Popis |
|---------|-------|
| `longevity_nodes` | Uzly vesmíru (id, label, parent, default_priority) |
| `user_metrics` | Aktuální stav (user_id, node_id, current_index, state, universe) |
| `node_state_history` | 30denní sparkline historie |
| `mission_log` | Splněné kroky (user_id, node_id, date, action_type) |
| `user_aspirations` | Uživatelův sen |
| `aspiration_requirements` | Sen → required_level, importance_weight |
| `user_constraints` | Zdravotní omezení |
| `node_inputs` | Odpovědi z onboardingu (audit) |

### Stav uzlu — single source of truth

```
current_index ≤ 40  → RED
current_index ≤ 70  → YELLOW
current_index > 70  → GREEN
current_index = 0   → GRAY (žádná data)
access = 'locked'   → GRAY + 🔒 (záměrně uzamčeno)
```

**GRAY ≠ LOCKED.** GRAY = bez dat. LOCKED = explicitně uzamčeno rolí.
Lock ikona se kreslí pouze na `access === 'locked'`, ne na všechny GRAY uzly.

### Parent kaskáda

Parent uzel dostane barvu nejhoršího potomka (worstLeaf — kaskáda až na listy).

---

## Access model

Každý vesmír má složku `access/` s JSON soubory per role.
Soubor definuje které uzly jsou `full` / `locked` / `hidden`.

```json
[
  { "id": "dlouhovekost", "access": "full", "label": "Vlastní label" },
  { "id": "telo",         "access": "full" },
  { "id": "mysl",         "access": "locked" }
]
```

**Pravidla:**
- Uzly **neuvedené** v souboru dostávají `defaultAccess` podle role
- `dekatlon`, `demo`, `free` → `defaultAccess = 'locked'`
- `longevity` → `defaultAccess = 'visible'`
- Soubory jsou servírovány s `no-cache` hlavičkami (vercel.json)
- Fetch probíhá s `cache: 'no-store'` — žádné inline duplikáty

---

## Role

| Role | Vesmír | Přístup |
|------|--------|---------|
| `longevity` | Dlouhověkost | Plný přístup |
| `dekatlon` | Dlouhověkost | Jen Tělo + 10 disciplín |
| `demo` | Libovolný | Omezený náhled |
| `free` | Libovolný | Základní přístup |

### Dekaton — 10 disciplín (pod uzlem `telo`)

| Uzel | Disciplína | Onboarding otázka |
|------|-----------|-------------------|
| `sila` | Síla | vynest_nakup, zvednout_vnouce, otevrit_zavarovacku |
| `stabilita` | Stabilita | vstat_ze_zeme, balanc_jedna_noha |
| `vo2max` | VO2max | vyjit_4_patra |
| `kardio` | Kardio | (bez otázky — data z vo2max/vytrvalost) |
| `mobilita` | Mobilita | kufr_do_police |
| `vytrvalost` | Vytrvalost | rychla_chuze |
| `rovnovaha` | Rovnováha | rovnovaha_zavrene_oci |
| `plyometrie` | Plyometrie | skocit_dopadnout |
| `dychani` | Dýchání | zadrzeni_dechu |

---

## Game Loop

- **1 krok/den** = stabilizace (index beze změny)
- **2 kroky/den** = zlepšení (+5 index)
- **0 kroků/den** = pokles (−3 index další den)
- Max 2 kroky/den na uzel, rolling 7denní okno

### Druhá akce

| Stav | Trend | Nabídka |
|------|-------|---------|
| RED | DOWN | Vždy |
| YELLOW | STABLE | 50/50 |
| GREEN | UP | "Dnes stačí." |
| streak ≥ 3 | — | Boost offer |

---

## Killers (Černí jezdci)

| Killer | HUD label | Oblast |
|--------|-----------|--------|
| Kardiovaskulární | SRDCE | srdce, pohyb |
| Rakovina | IMUNITA | imunita |
| Neurodegenerace | MOZEK | myšlení |
| Metabolický syndrom | METABOLISMUS | rovnováha těla |

**Nikdy nepoužívat názvy nemocí.** `KILLER: SRDCE`, ne `KILLER: INFARKT`.

---

## CHJ AI — pravidla

- JEDNA VĚTA, max 15 slov
- Čeština, tykání, žádné diagnózy
- Žádné akční kroky v textu (akce patří do ACTION sekce)
- **Zakázaná slova:** musíš, okamžitě, je důležité, měl bys, hrozí, ohrožuje, samostatnost, závislý, pomoc druhých, špatně, trpí

---

## API Endpointy

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/api/chat` | POST | CHJ AI verdikt |
| `/api/hud-data-bulk` | POST | HUD data (baterie, killer, akce) |
| `/api/mission-log` | POST | Uložit splněný krok |
| `/api/mission-complete` | POST | Game loop výpočet |
| `/api/disciplines` | GET | Disciplíny podle node |
| `/api/onboarding-save` | POST | Uložit onboarding (service_role) |
| `/api/tools/parse` | POST | Health Document Parser |

---

## Migrace

SQL skripty v `/migrations/`. Spouštět **ručně v Supabase SQL Editoru**.
Každý soubor má komentář co dělá a proč je bezpečný.

Před spuštěním: přečti komentář, ověř že se dotýká jen správných řádků.

---

## Konvence kódu

- ESM moduly (`"type": "module"`)
- Frontend v `/app/`, API v `/api/`, data v `/data/`
- Supabase anon key pouze v `app/js/universe/supabaseClient.js` (read-only)
- Všechny DB zápisy přes API endpointy (service_role zůstává na serveru)
- `dotenv.config({ path: '.env.local' })` na začátku každé serverless funkce
- Kód a komentáře: angličtina · UI labels: angličtina · Obsah: čeština

---

## Závazky pro Claude

1. **Jádro se nemění bez repro scénáře** — popsat co se testuje před změnou
2. **Jedna změna = jeden commit** — ne pět oprav najednou
3. **Po změně jádra — update HANDBOOK.md** ve stejném commitu
4. **Nikdy nevytvářet inline duplikát** toho co existuje v JSON/DB
5. **Syntax error v core = opravit, commitnout, pushovat ihned** — nezanechat broken stav

---

## Verzování

| Verze | Obsah | Status |
|-------|-------|--------|
| v0.1.0 | Semafor, kroky, baterie, onboarding (vanilla JS) | ✅ |
| v0.2.0 | HUD panel, vícero vesmírů, Dekaton | ✅ |
| v0.2.1 | Dekaton 10 disciplín, access model cleanup | ✅ `git tag v0.2.1-dekatlon-working` |
| v0.3.0 | Claude Haiku pro výběr kroků | 📋 |
| v0.4.0 | Foto jídel + Health Document Parser | 📋 |
| v0.5.0 | CHJ Master Agent + MCP | 📋 |
| v1.0.0 | SaaS launch | 📋 |
