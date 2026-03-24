# CLAUDE.md – CHJ (Chytré Já) v0.2.0

## Co je CHJ

PWA (SaaS) aplikace – mobilní AI kouč pro dlouhověkost založený na Medicine 3.0 (Peter Attia, "Outlive"). Telefon je partner, který vede uživatele. Uživatel nemusí hledat, přemýšlet ani se ptát – appka mu říká co dělat a proč.

Název: **Chytré Já** (CHJ)
Jazyk: **mix** — systémové popisky (UI labels) anglicky, věcný obsah česky, tykání
Tón: kombinace lidského kouče + systémového HUD terminálu

---

## Architektura

### Tři vrstvy

1. **Klient (PWA, mobile first)** – vesmír uzlů (canvas) + Longevity HUD panel (Svelte) + hlas + notifikace
2. **Orchestrátor (backend)** – CHJ Master Agent, rozhoduje co říct a koho zavolat
3. **Skills + Agents + Tools** – deterministická logika, AI agenti, utility funkce

### Stack

| Vrstva | Technologie | Poznámka |
|--------|-------------|----------|
| **Frontend** | Svelte 4 + Vite | Komponenty, reaktivita |
| **Styling** | Tailwind CSS 3 | Utility-first, HUD design tokens |
| **Vesmír** | Canvas (vanilla JS) | Obalený ve Svelte wrapperu `<Universe>` |
| **Backend** | Vercel serverless functions (Node.js, ESM) | |
| **AI** | OpenAI GPT-4o-mini (plán: Claude Sonnet/Haiku) | |
| **DB** | Supabase (PostgreSQL) | |
| **Auth** | Firebase | |
| **TTS** | Browser Web Speech API (plán: ElevenLabs) | |

### Svelte komponenty

```
src/
├── App.svelte                  ← hlavní layout
├── lib/
│   ├── components/
│   │   ├── Universe.svelte     ← canvas wrapper (stávající logika)
│   │   ├── HudPanel.svelte     ← hlavní HUD panel
│   │   ├── hud/
│   │   │   ├── NodeHeader.svelte    ← LONGEVITY NODE [TĚLO_v0.1] ✕
│   │   │   ├── LifeBattery.svelte   ← baterie + REPAIR_RATE + CELL_VITALITY
│   │   │   ├── KillerCard.svelte    ← KILLER: SRDCE + energy drain
│   │   │   ├── ActionProtocol.svelte ← ACTION + timer/counter + Hotovo
│   │   │   ├── SecondAction.svelte  ← Chceš jít dál? Ano/Ne + expand
│   │   │   ├── SourceCards.svelte   ← SOURCE_VALIDATION karty
│   │   │   └── TrendChart.svelte    ← sparkline s regresí
│   │   ├── Splash.svelte
│   │   └── ChatBar.svelte
│   ├── stores/
│   │   ├── universe.js         ← nodes, metrics, user data
│   │   ├── mission.js          ← aktuální mise, streak, game loop
│   │   └── user.js             ← auth, constraints, aspirace
│   ├── skills/                 ← deterministická logika (bez AI)
│   │   ├── kroky/
│   │   │   ├── cviceni.js      ← cviky pro Tělo
│   │   │   ├── metabol.js      ← metabolické akce
│   │   │   └── prevence.js     ← prevence, spánek
│   │   ├── verdikt/
│   │   │   └── game-engine.js  ← verdikty + killer texty
│   │   └── media/
│   │       └── media-picker.js ← výběr zdrojů z DB
│   ├── utils/
│   │   ├── supabase.js
│   │   ├── firebase.js
│   │   └── api.js              ← fetch wrappery
│   └── styles/
│       └── hud.css             ← scan lines, glow, animace
```

### Prostředí

| Branch | URL | Účel |
|--------|-----|------|
| `production` | app.iting.cz | Produkce |
| `test` | test.iting.cz | Testování |
| `main` | dev.iting.cz | Vývoj |
| `demo` | demo.iting.cz | Demo |

### Env proměnné

- `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_ENABLED`
- Lokálně: `.env.local` + `dotenv` (nutný pro vercel dev na Windows)

---

## UI Koncept: Longevity HUD

### Filosofie

Dva režimy pohledu:
1. **Vesmír** — mapa uzlů (planety na canvas), kliknutím otevři detail
2. **HUD Panel** — detail uzlu ve stylu sci-fi/gaming HUD (cyber-med estetika)

### HUD Panel — struktura (mobile stack)

```
┌─────────────────────────────────────┐
│ LONGEVITY NODE [TĚLO_v0.1]       ✕  │
├─────────────────────────────────────┤
│ LIFE-BATTERY                        │
│ ████████░░░░  65% │ DOWN            │
│                                     │
│ REPAIR_RATE: 0.8x  CELL_VITALITY: 65% │
├─────────────────────────────────────┤
│ KILLER: SRDCE                       │
│ ⚠ -8% ENERGY DRAIN                 │
├─────────────────────────────────────┤
│ ACTION: PLANK_60S [READY]           │
│ 🏋️ Drž plank 60 sekund              │
│ [▶ START]                           │
│                                     │
│ Chceš jít dál?  [Ano] [Ne]         │
├─────────────────────────────────────┤
│ SOURCE_VALIDATION                   │
│ ┌──────────┐ ┌──────────┐          │
│ │ MED_ID:104│ │ MED_ID:088│         │
│ │ STUDY...  │ │ REVIEW... │         │
│ │ [VERIFIED]│ │ [AUTH]    │         │
│ └──────────┘ └──────────┘          │
├─────────────────────────────────────┤
│ [Zeptej se Chytrého já ____] 📤    │
└─────────────────────────────────────┘
```

### HUD Datový model (JSON)

```json
{
  "node_id": "telo",
  "node_label": "Tělo",
  "node_version": "v0.1",
  "life_battery": {
    "percent": 65,
    "trend": "down",
    "trend_label": "DOWN",
    "repair_rate": 0.8,
    "cell_vitality": 65
  },
  "killer": {
    "id": "kardio",
    "label": "SRDCE",
    "energy_drain": -8,
    "description": "Srdce potřebuje pohyb."
  },
  "action": {
    "id": "plank_60s",
    "label": "Drž plank 60 sekund",
    "icon": "🏋️",
    "type": "timed",
    "duration": 60,
    "status": "READY",
    "tier": 1
  },
  "second_action": {
    "available": true,
    "offer_text": "Můžeš to ještě posílit.",
    "action": { "..." }
  },
  "sources": [
    {
      "med_id": 104,
      "type": "STUDY",
      "title": "Resistance Training and Cardiovascular Health",
      "journal": "Nature Medicine",
      "year": 2023,
      "status": "VERIFIED",
      "url": "https://..."
    }
  ],
  "verdict": "Tělo ztrácí sílu."
}
```

### Estetika

- **Tmavé pozadí**: #0f172a (slate-900)
- **Neonové barvy**: zelená (#22c55e), žlutá (#eab308), červená (#ef4444), cyan (#06b6d4)
- **Glassmorphism**: průhledné karty s blur + border
- **Monospace font**: pro systémové popisky (KILLER, ACTION, STABLE)
- **Sans-serif**: pro český obsah
- **Animace**: pulse na baterii, glow na aktivní akci, scan line efekt

### Tailwind HUD design tokens

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        hud: {
          bg: '#0f172a',
          panel: 'rgba(15, 23, 42, 0.85)',
          border: 'rgba(6, 182, 212, 0.2)',
          glow: '#06b6d4',
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          cyan: '#06b6d4',
          text: '#e2e8f0',
          muted: '#94a3b8',
          dim: '#64748b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        hud: '12px',
      },
      boxShadow: {
        'hud-glow': '0 0 15px rgba(6, 182, 212, 0.15)',
        'hud-neon': '0 0 20px rgba(6, 182, 212, 0.3)',
      }
    }
  }
}
```

---

## Datový model (Supabase)

### Existující tabulky

- `longevity_nodes` – uzly vesmíru (id, label, parent, default_priority)
- `user_metrics` – aktuální stav uzlu (user_id, node_id, current_index, state: GREEN/YELLOW/RED)
- `node_state_history` – historie stavů + current_index pro sparkline trendy (30 dní)
- `node_inputs` – odpovědi z onboardingu
- `mission_log` – záznam splněných kroků (user_id, node_id, mission_id, date, action_type)
- `aspiration_requirements` – sen → required_level, importance_weight
- `user_aspirations` – user → aspiration_type
- `user_constraints` – omezení uživatele (zdravotní, tělesné, demografické)
- `longevity_articles`, `longevity_media`, `longevity_docs` – zdroje pro uzly

### Views

- `v_discipline_states` – agregovaný stav disciplín
- `user_bottlenecks` – bottleneck_score ranking

### Hlavní uzly

| ID | Label | Popis |
|----|-------|-------|
| `dlouhovekost` | Hra o život | Hlavní uzel, celkový přehled |
| `telo` | Tělo | Síla, svalová hmota, pohyblivost |
| `mysl` | Mysl | Pozornost, paměť, emoční zdraví |
| `vyziva` | Výživa | Strava, protein, energetická bilance |
| `zdravi` | Zdraví | Prevence, odolnost, krevní markery |
| `metabolicke` | Metabolismus | Metabolismus, inzulín, tělesná kompozice |

---

## Semafor systém

Každý uzel má stav: 🟢 GREEN / 🟡 YELLOW / 🔴 RED

**Index → State (single source of truth):**
- ≤ 40 = RED
- ≤ 70 = YELLOW
- \> 70 = GREEN

**Parent uzly: barva = nejhorší dítě.**

---

## Černí jezdci (Killers)

Čtyři smrtelné hrozby (Medicine 3.0):

| Killer | HUD Label | Lidský popis |
|--------|-----------|-------------|
| Kardiovaskulární | SRDCE | srdce, pohyb |
| Rakovina | IMUNITA | imunita, odolnost |
| Neurodegenerace | MOZEK | myšlení, hlava |
| Metabolický syndrom | METABOLISMUS | rovnováha těla |

CHJ NIKDY nepoužívá názvy nemocí. HUD zobrazuje `KILLER: SRDCE`, ne `KILLER: INFARKT`.

---

## Game Loop (Kroky)

### Pravidla

- **1 krok/den** = stabilizace (index se nezmění)
- **2 kroky/den** = zlepšení (+5 index)
- **0 kroků/den** = pokles (-3 index po neaktivním dni)
- **Max 2 kroky/den** na uzel
- Rolling 7denní okno (ne pondělní reset)

### Druhá akce (smart offer)

| Stav uzlu | Trend | Nabídka |
|-----------|-------|---------|
| 🔴 RED | DOWN | Vždy: "Můžeš to ještě posílit." |
| 🟡 YELLOW | STABLE | 50/50 šance |
| 🟢 GREEN | UP | "Držíš to. Dnes stačí." |
| 🔥 streak ≥ 3 | — | Boost: "Jedeš dobře. Přidáš krok?" |

Druhá akce = jiná mise ze STEJNÉHO uzlu. Ne z jiného.

### Feedback (okamžitý)

- Stabilizace: "✔ Hotovo. Držíš tempo."
- Zlepšení: "📈 Posun! Jdeš nahoru."
- Level up: "🎉 Level up! Viditelné zlepšení."

---

## Skills / Agents / Tools — Architektura

### Tři typy

| Typ | Kde běží | AI? | Příklad |
|-----|----------|-----|---------|
| **Skills** | Frontend (JS) | Ne | Výběr cviku podle tier+constraints |
| **Agents** | Backend (API → Claude) | Ano | Personalizovaný verdikt, nutriční analýza |
| **Tools** | Backend (API) | Různé | Food Camera (Vision), TTS, DB lookup |

### Adresářová struktura (v0.2.0+)

```
src/
├── lib/
│   ├── skills/                 ← deterministická logika (frontend)
│   │   ├── kroky/
│   │   │   ├── cviceni.js      ← cviky pro Tělo
│   │   │   ├── metabol.js      ← metabolické akce
│   │   │   └── prevence.js     ← prevence, spánek
│   │   ├── verdikt/
│   │   │   └── game-engine.js  ← verdict + killer texty
│   │   └── media/
│   │       └── media-picker.js ← výběr zdrojů z DB
│
api/
├── agents/                     ← AI agenti (plán v0.3.0+)
│   ├── master.js               ← CHJ orchestrátor (Claude Sonnet)
│   ├── telo.js                 ← specializovaný agent Tělo
│   ├── vyziva.js               ← specializovaný agent Výživa
│   ├── mysl.js                 ← specializovaný agent Mysl
│   ├── zdravi.js               ← specializovaný agent Zdraví
│   └── metabol.js              ← specializovaný agent Metabolismus
├── tools/                      ← utility pro agenty (plán v0.4.0+)
│   ├── food-camera.js          ← foto → popis jídla (Vision API)
│   ├── calorie-calc.js         ← popis → kalorie/makra
│   ├── trend-engine.js         ← predikce (lineární regrese)
│   └── media-lookup.js         ← DB lookup zdrojů
├── chat.js                     ← CHJ AI (aktuálně GPT-4o-mini)
├── mission-complete.js         ← game loop
├── mission-log.js              ← záznam kroků
└── disciplines.js              ← disciplíny
```

### Vertikální architektura (cíl v0.5.0+)

```
┌─────────────────────────────────┐
│       CHJ Master Agent          │
│   (orchestrátor, Claude Sonnet) │
│   — rozhoduje CO říct a komu    │
│     zavolat                     │
└───────────┬─────────────────────┘
            │
  ┌─────────┼─────────────┐
  │         │             │
  ▼         ▼             ▼
┌──────┐ ┌──────┐   ┌──────────┐
│Agents│ │Tools │   │ Sensors  │
└──────┘ └──────┘   └──────────┘

AGENTS (Claude Haiku — rychlý, levný):
├── Tělo Agent      — cviky, progrese, zranění
├── Výživa Agent    — jídlo, kalorie, makra
├── Mysl Agent      — mindfulness, spánek, stres
├── Zdraví Agent    — prevence, markery, léky
└── Metabol Agent   — glukóza, půst, kompozice

TOOLS (API/funkce):
├── 📷 Food Camera  — foto jídla → popis (Vision)
├── 🔢 Calorie Calc — popis → kalorie/makra
├── 📚 Media Lookup — zdroje podle uzlu z DB
├── 🔊 TTS          — ElevenLabs hlas
├── 📊 Trend Engine — sparkline + predikce
└── 🔔 Push Engine  — proaktivní notifikace

SENSORS (vstup od uživatele):
├── Onboarding      — první data
├── Kroky (mise)    — denní akce
├── Foto jídel      — strava tracker
├── Ruční vstup     — váha, spánek, nálada
└── Wearables       — (budoucnost) Apple Health
```

### Příklad flow — focení jídla (v0.4.0+)

```
Uživatel → vyfotí oběd
  → Food Camera tool → "kuřecí prsa, rýže, salát"
  → Calorie Calc → 550 kcal, 45g protein
  → Výživa Agent → "Protein ok. Přidej zeleninu."
  → CHJ Master → uloží, updatne index výživy
  → HUD Panel → sparkline se posune
```

---

## Bottleneck systém

Bottleneck = nejhorší uzel brzdící dlouhověkost.

Výpočet: barva × jezdec × aspirace
- RED + smrtelný jezdec + ohrožuje sen = nejvyšší priorita
- View `user_bottlenecks` existuje (aspiration_weight zatím null)

---

## Aspirace (Sen)

Uživatel si vybere sen (běžky v 85, Ironman, hrát s vnouky...).
- **Hlavní uzel**: aspiraci IGNOROVAT (celkový přehled)
- **Podřízený uzel**: aspiraci ZOHLEDNIT ("bez síly se na běžky nepostavíš")

---

## CHJ AI — Pravidla

### Striktní pravidla

- JEDNA VĚTA, max 15 slov
- Žádné názvy nemocí (srdce, ne infarkt)
- Žádné akční kroky v textu (akce jsou v ACTION sekci)
- Čeština, tykání, přímočaré

### Zakázaná slova

"musíš", "okamžitě", "je důležité", "měl bys", "hrozí", "ohrožuje", "samostatnost", "závislý", "pomoc druhých", "špatně", "trpí", "Dobrá zpráva je"

---

## API Endpointy

| Endpoint | Metoda | Popis |
|----------|--------|-------|
| `/api/chat` | POST | CHJ AI verdikt |
| `/api/mission-log` | POST | Uložit splněný krok |
| `/api/mission-complete` | POST | Game loop (stabilize/improve/decline) |
| `/api/disciplines` | GET | Disciplíny podle node |

---

## Verzování

| Verze | Obsah | Status |
|-------|-------|--------|
| **v0.1.0** | Semafor, kroky, baterie, sparkline, onboarding (vanilla JS) | ✅ Hotovo |
| **v0.2.0** | Longevity HUD panel, Svelte + Tailwind, zdroje v panelu | 🔄 Aktivní |
| **v0.3.0** | Claude Haiku pro výběr kroků (místo deterministického) | 📋 |
| **v0.4.0** | Foto jídel → kalorie (Vision API) | 📋 |
| **v0.5.0** | CHJ Master Agent + MCP orchestrace | 📋 |
| **v0.6.0** | Push notifikace + ranní briefing | 📋 |
| **v1.0.0** | SaaS launch — platební brána + landing | 📋 |

---

## Konvence kódu

- ESM moduly (`"type": "module"`)
- Svelte komponenty v `src/lib/components/`
- Svelte stores v `src/lib/stores/`
- Skills (deterministická logika) v `src/lib/skills/`
- Vercel serverless v `/api/`, frontend v `/src/`
- Supabase klient UVNITŘ handler funkce (ne top level)
- `dotenv` na začátku serverless functions
- Systémové UI labels: angličtina (KILLER, ACTION, LIFE-BATTERY)
- Obsah: čeština, tykání
- Kód a komentáře: angličtina
- Git: develop na `main`, test na `test`, produkce na `production`
- Max 2 barvy v mission kartě: bílá (#e2e8f0) + modrá (#60a5fa)
- HUD komponenty: neonové barvy podle stavu (green/yellow/red/cyan)

---

## Důležité poznámky

- `dotenv` nutný pro lokální vývoj (Windows)
- GPT-4o-mini špatně dodržuje instrukce → šablony místo zákazů
- State VŽDY derivován z indexu (≤40=RED, ≤70=YELLOW, >70=GREEN)
- Bottleneck se posílá jako string z frontendu
- Nepracujeme s čísly v UI — jen barvy, HUD metriky, přehled
- Claude Code smí vytvářet nové tabulky v Supabase
- Splash screen zobrazuje verzi při startu
- v0.1.0 = vanilla JS (zachováno v git tagu), v0.2.0+ = Svelte
