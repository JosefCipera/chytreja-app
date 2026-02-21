# CLAUDE.md – CHJ (Chytré Já) Project Context

## Co je CHJ

PWA (SaaS) aplikace – mobilní AI kouč pro dlouhověkost založený na Medicine 3.0 (Peter Attia, "Outlive"). Telefon je partner, který vede uživatele. Uživatel nemusí hledat, přemýšlet ani se ptát – appka mu říká co dělat a proč.

Název: **Chytré Já** (CHJ)
Jazyk UI: čeština, tykání

---

## Architektura

### Tři vrstvy

1. **Klient (PWA, mobile first)** – vesmír uzlů, panel, hlas, notifikace
2. **Orchestrátor (backend)** – CHJ Master Agent, rozhoduje co říct a koho zavolat
3. **Agenti + nástroje** – specializovaní agenti (Tělo, Mysl, Výživa, Zdraví, Spánek), DB, mediáteka, TTS

### Aktuální stack

- **Frontend:** Vanilla JS, HTML/CSS, Live Server (localhost:5500) nebo Vercel dev (localhost:3000)
- **Backend:** Vercel serverless functions (Node.js, ESM)
- **AI:** OpenAI GPT-4o-mini (plán: přechod na Anthropic Claude Sonnet)
- **DB:** Supabase (PostgreSQL)
- **Auth:** Firebase
- **TTS:** Browser Web Speech API (plán: ElevenLabs)

### Prostředí

| Branch | URL | Účel |
|--------|-----|------|
| `production` | app.iting.cz | Produkce |
| `test` | test.iting.cz | Testování |
| `main` | dev.iting.cz | Vývoj |
| `demo` | demo.iting.cz | Demo |

### Env proměnné

- `OPENAI_API_KEY` – OpenAI klíč
- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key
- `AI_ENABLED` – true/false feature flag pro AI

Lokálně: `.env.local` + `dotenv` package (nutný pro vercel dev na Windows).

---

## Datový model (Supabase)

### Tabulky

- `longevity_nodes` – uzly vesmíru (id, label, parent, default_priority)
- `user_metrics` – aktuální stav uzlu (user_id, node_id, current_index, state: GREEN/YELLOW/RED)
- `node_state_history` – historie stavů pro sparkline trendy (30 dní)
- `node_inputs` – odpovědi z onboardingu
- `aspiration_requirements` – sen → required_level, importance_weight
- `user_aspirations` – user → aspiration_type (TODO: napojit)
- `discipline_node_map` – disciplíny → uzly
- `decathlon_disciplines` – seznam disciplín
- `longevity_articles`, `longevity_media`, `longevity_docs` – zdroje pro uzly

### Views

- `v_discipline_states` – agregovaný stav disciplín z uzlů (+ node_id pro filtering)
- `user_bottlenecks` – bottleneck_score ranking: gap × aspiration_weight × longevity_priority

### Hlavní uzly

| ID | Label | Popis |
|----|-------|-------|
| `dlouhovekost` | Stoletý desetibojař | Hlavní uzel (parent: null), celkový přehled |
| `telo` | Tělo | Síla, svalová hmota, pohyblivost |
| `mysl` | Mysl | Pozornost, paměť, emoční zdraví |
| `vyziva` | Výživa | Strava, protein, energetická bilance |
| `zdravi` | Zdraví | Prevence, odolnost, krevní markery |
| `metabolicke` | Metabolismus | Metabolismus, inzulín, tělesná kompozice |

---

## Semafor systém

Každý uzel má stav: 🟢 GREEN / 🟡 YELLOW / 🔴 RED

- Stav se počítá z `user_metrics.current_index`
- Agregace: podřízené uzly ovlivňují nadřazené
- Sparkline trendy: 30 dní historie s barvami podle stavu
- Disciplíny ovlivňují uzly (objektivní nutnost podle Attii)

---

## Filozofie – Tři vrstvy hodnocení

### 1. Disciplínový tlak (objektivní) – co musíš

Vychází z Medicine 3.0 (Attia). Čtyři černí jezdci (hrozby):
- Kardiovaskulární onemocnění
- Rakovina
- Neurodegenerace (demence, Alzheimer)
- Metabolický syndrom (cukrovka)

Disciplíny jsou obrana proti jezdcům. Tady není volba.

### 2. Aspirační tlak (subjektivní) – co chceš (TODO)

Uživatelův sen (běžky v 85, hrát si s vnouky, Ironman...) určuje osobní váhy uzlů.

### 3. Omezení / constraints (TODO)

- Zdravotní: koleno, záda, zranění
- Tělesné: obvod pasu, BMI, kompozice
- Demografické: věk, pohlaví

---

## CHJ AI – Pravidla promptu

### Dva režimy

**HLAVNÍ UZEL (Stoletý desetibojař):** Celkový přehled baterie, směruj na bottleneck.

**PODŘÍZENÝ UZEL (Tělo, Mysl, Výživa, Zdraví):** Konkrétní stav uzlu a důsledky.

### Šablony odpovědí

Hlavní uzel:
- Špatný stav: "Nejvíc tě brzdí [slabý článek], bez změny to půjde dolů."
- Střední stav: "Celkově ok, ale [slabý článek] zaostává."
- Dobrý stav: "Jsi v dobré kondici, drž to takhle."

Podřízený uzel:
- Špatný stav: "Tvoje [oblast] nestačí — [co to znamená pro tělo]."
- Střední stav: "Tvoje [oblast] není špatná, ale [co konkrétně slábne]."
- Dobrý stav: "Tvoje [oblast] je v pořádku."

### Striktní pravidla

- PŘESNĚ JEDNA VĚTA. Nic víc.
- Max 15 slov na větu, max 30 slov celkem
- Žádné číslovky – psát slovně (třikrát, pětaosmdesát)
- Žádné názvy nemocí (ne cukrovka, infarkt – psát srdce, mozek, pohyb)
- Žádné akční kroky v textu (akce jsou v sekci Akce pod tím)
- Jazyk: čeština, tykání, přímočaré

### Zakázaná slova

"musíš", "okamžitě", "je důležité", "měl bys", "hrozí", "ohrožuje", "samostatnost", "závislý", "pomoc druhých", "špatně", "trpí", "Dobrá zpráva je"

---

## Panel UI – Struktura

```
┌─────────────────────────┐
│ 🍎 [Název uzlu]      ✕  │
│ TREND (30 DNÍ)          │
│ [sparkline]              │
│ ☑ Zlepšení      X dní   │
├─────────────────────────┤
│ 🔴 Chytré já říká:      │
│ [briefing – jedna věta] │
│ [🔊 Přehrát]            │
├─────────────────────────┤
│ ⚡ Akce                  │
│ • [konkrétní kroky]     │
├─────────────────────────┤
│ 📚 Hodnoty / Zdroje     │
│ → [odkazy na mediáteku] │
├─────────────────────────┤
│ [tlačítka: Proč? | Co změnit? | Trend]  │
│ [Zeptej se na cokoliv____] 📤           │
└─────────────────────────┘
```

- CHJ briefing se generuje při otevření panelu (proaktivní, ne na dotaz)
- Akce jsou oddělené od CHJ textu
- Tlačítka = předpřipravené prompty (kontextové podle uzlu a stavu)
- Volný chat input jako fallback

---

## Helper funkce v kódu

```javascript
// Mapování uzlů na ohrožení (pro hlavní uzel bottleneck)
function getRiderRisk(nodeLabel) {
  const risks = {
    'kardio': 'srdce',
    'vo2max': 'kondice a srdce',
    'síla': 'pohyb a síla',
    'stabilita': 'rovnováha a pohyb',
    'metabolicke': 'energii a tělo',
    'nervovy_system': 'mozek a hlava'
  };
  return risks[nodeLabel.toLowerCase()] || 'tělo';
}

// Mapování uzlů na oblasti (pro podřízený uzel kontext)
function getNodeContext(nodeId) {
  const contexts = {
    'telo': 'síla a svaly',
    'mysl': 'pozornost a paměť',
    'vyziva': 'strava a energie',
    'zdravi': 'prevence a odolnost',
    'metabolicke': 'metabolismus a rovnováha těla'
  };
  return contexts[nodeId] || '';
}

// Mapování ID na české labely (pro přirozený jazyk v promptu)
function getNodeLabel(nodeId) {
  const labels = {
    'telo': 'tělo',
    'mysl': 'hlava',
    'vyziva': 'strava',
    'zdravi': 'zdraví',
    'metabolicke': 'metabolismus'
  };
  return labels[nodeId] || nodeId;
}
```

---

## API Endpointy

- `POST /api/chat` – CHJ AI (system prompt + user prompt → OpenAI → verdict)
- `GET /api/disciplines` – disciplíny podle node

---

## Plánovaný vývoj (roadmap)

### Fáze 1 – Stabilizace (aktuální)
- ✅ Semafor systém s agregací
- ✅ Onboarding (11 otázek)
- ✅ Sparkline trendy
- ✅ CHJ prompt v2 (šablony)
- ⬜ Bottleneck v CHJ kontextu (propojit user_bottlenecks do promptu)
- ⬜ Sen v onboardingu (výběr aspirace)
- ⬜ Demo mode (fake data bez auth)
- ⬜ Typewriter blikání fix (při `<br>` tagech)

### Fáze 2 – Mobile first
- PWA setup (manifest, service worker, responsive)
- Touch UI
- ElevenLabs TTS

### Fáze 3 – Orchestrátor + multi-agent
- Přechod na Anthropic Claude (Sonnet pro agenty, Haiku pro routing)
- MCP protokol
- CHJ jako master agent + specializovaní agenti
- Prediktivní semafor (projekce trendů)

### Fáze 4 – Plný produkt
- Hlasové ovládání (speech-to-text)
- Proaktivní push notifikace
- Constraints systém (zdravotní omezení)
- Aspirační vrstva (sen ovlivňuje bottleneck)

### Fáze 5 – SaaS launch
- Platební brána
- Landing page
- Multi-agent plně funkční

---

## Konvence kódu

- ESM moduly (`"type": "module"` v package.json)
- Vercel serverless functions v `/api/`
- Frontend v `/app/`
- Supabase klient vytvářet UVNITŘ handler funkce (ne na top level – env proměnné nejsou dostupné při importu)
- Čeština v UI, angličtina v kódu a komentářích
- Git workflow: develop na `main`, test na `test`, produkce na `production`

---

## Důležité poznámky

- `dotenv` je nutný pro lokální vývoj (`vercel dev` na Windows nenačítá .env.local správně)
- GPT-4o-mini špatně dodržuje striktní instrukce – proto používáme šablony místo zákazů
- Disciplíny jsou v UI zakomentované, ale datový model existuje – vrátí se
- `user_bottlenecks` view funguje, ale `aspiration_weight` je zatím null (sen není napojený)
- Bottleneck se posílá jako string z frontendu (`context.bottleneck`), ne jako objekt z DB
