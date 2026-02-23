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

### Existující tabulky

- `longevity_nodes` – uzly vesmíru (id, label, parent, default_priority)
- `user_metrics` – aktuální stav uzlu (user_id, node_id, current_index, state: GREEN/YELLOW/RED)
- `node_state_history` – historie stavů pro sparkline trendy (30 dní)
- `node_inputs` – odpovědi z onboardingu
- `aspiration_requirements` – sen → required_level, importance_weight
- `user_aspirations` – user → aspiration_type (zatím nenapojené)
- `discipline_node_map` – disciplíny → uzly
- `decathlon_disciplines` – seznam disciplín
- `longevity_articles`, `longevity_media`, `longevity_docs` – zdroje pro uzly

### Existující views

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

### Barvy uzlů

Každý uzel má stav: 🟢 GREEN / 🟡 YELLOW / 🔴 RED

**Pravidlo pro parent uzly: barva = nejhorší dítě.**
- Jedno dítě RED → parent RED
- Žádné RED, jedno YELLOW → parent YELLOW
- Všechny GREEN → parent GREEN

Žádné čísla, žádný vážený průměr. Barva se spočítá jednou a uloží do DB. Frontend jen čte, nepočítá.

Tabulka `longevity_nodes.default_priority` existuje, ale plnění není jasné – možná bude potřeba revidovat.

---

## Černí jezdci (Rizika)

Čtyři smrtelné hrozby podle Peter Attii (Medicine 3.0):

1. **Kardiovaskulární** – infarkt, mrtvice
2. **Rakovina** – onkologická onemocnění
3. **Neurodegenerace** – demence, Alzheimer
4. **Metabolický syndrom** – cukrovka, obezita

Každý uzel má vztah k jednomu nebo více jezdcům. Tato vazba musí být v DB (nová tabulka nebo rozšíření existující). CHJ v promptu ví, jaký jezdec ohrožuje daný uzel – ale NEPOUŽÍVÁ názvy nemocí, místo toho mluví lidsky (srdce, mozek, pohyb, tělo).

---

## Bottleneck systém

### Co je bottleneck

Bottleneck = nejhorší uzel, který nejvíc brzdí dlouhověkost uživatele. Účel celé appky je dlouhověkost – bottleneck je kde začít, akce je jak začít.

### Výpočet

Bottleneck vzniká kombinací:
1. **Barva uzlu** – RED je horší než YELLOW
2. **Černý jezdec** – uzel napojený na smrtelnou hrozbu má vyšší váhu
3. **Aspirace (sen)** – pokud je víc RED uzlů, prioritu má ten, který nejvíc ohrožuje uživatelův sen

### Flow

```
DB: barva uzlů + jezdci + sen + omezení
  → výpočet bottlenecku
  → CHJ briefing: "Síla nestačí, pohyb se ti bude zužovat."
  → Akce: "Posiluj celé tělo obden" (ne běh, protože koleno)
  → Zdroje: odkaz na cvičení z mediátéky
```

---

## Aspirace (Sen uživatele)

### Co to je

Uživatel si vybere svůj sen – co chce v životě zvládnout (běžky v 85, hrát si s vnouky, Ironman...). Sen ovlivňuje prioritizaci bottlenecků.

### Chování podle uzlu

- **Hlavní uzel (Stoletý desetibojař):** Aspiraci IGNOROVAT. Hlavní uzel má vlastní bottleneck logiku – celkový přehled "co tě brzdí nejvíc". Nemíchat se snem.
- **Podřízené uzly (Tělo, Mysl, Výživa...):** Aspirační kontext zobrazovat. CHJ zohledňuje sen při komunikaci – "bez síly se na běžky nepostavíš".

### DB

- `user_aspirations` – tabulka existuje, ale není napojená na onboarding
- `aspiration_requirements` – tabulka existuje, mapuje sen na požadované úrovně uzlů

---

## Omezení (Constraints)

### Co to je

Fyzické, zdravotní a demografické limity uživatele. Zohledňují se při NÁVRHU AKCÍ (ne při výpočtu bottlenecku).

### Typy

- **Zdravotní:** koleno, záda, zranění → některé akce vyloučené/modifikované
- **Tělesné:** obvod pasu, BMI, kompozice → startovní pozice
- **Demografické:** věk, pohlaví → referenční hodnoty

### DB

Tabulka `user_constraints` NEEXISTUJE – je potřeba vytvořit:
- user_id
- constraint_type (injury / body / demographic)
- constraint_key (knee, waist, age, sex...)
- constraint_value
- severity (mild / moderate / severe)
- affects_nodes (které uzly to limituje)

Část dat se dá extrahovat z onboardingu (věk, pohlaví, obvod pasu).

---

## CHJ AI – Pravidla promptu

### Dva režimy

**HLAVNÍ UZEL (Stoletý desetibojař):** Celkový přehled baterie, směruj na bottleneck. BEZ aspirace.

**PODŘÍZENÝ UZEL (Tělo, Mysl, Výživa, Zdraví):** Konkrétní stav uzlu, důsledky, s odkazem na sen pokud existuje.

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
- Žádné akční kroky v textu CHJ (akce jsou v sekci Akce pod briefingem)
- Jazyk: čeština, tykání, přímočaré

### Zakázaná slova

"musíš", "okamžitě", "je důležité", "měl bys", "hrozí", "ohrožuje", "samostatnost", "závislý", "pomoc druhých", "špatně", "trpí", "Dobrá zpráva je"

### Co CHJ dostane do kontextu

Pro každý dotaz:
1. **Stav uzlu** – barva (GREEN/YELLOW/RED)
2. **Bottleneck** – nejslabší článek (jen hlavní uzel)
3. **Jezdec** – která smrtelná hrozba souvisí
4. **Sen** – co uživatel chce (jen podřízené uzly, pokud existuje)
5. **Omezení** – co uživatel nemůže (pro návrh akcí)

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
│ [konkrétní kroky –      │
│  zohledněné omezením]   │
├─────────────────────────┤
│ 📚 Hodnoty / Zdroje     │
│ → [odkazy na mediáteku] │
├─────────────────────────┤
│ [tlačítka: Proč? | Co změnit? | Trend]  │
│ [Zeptej se na cokoliv____] 📤           │
└─────────────────────────┘
```

- CHJ briefing se generuje při otevření panelu (proaktivní)
- Akce jsou oddělené od CHJ textu a zohledňují omezení uživatele
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

// Mapování ID na české labely
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
- ⬜ Barva parent uzlu = nejhorší dítě (DB funkce)
- ⬜ Černí jezdci – vazba uzel → jezdec v DB
- ⬜ Bottleneck propojení do CHJ kontextu (kompletní)
- ⬜ Sen v onboardingu (výběr aspirace + napojení)
- ⬜ Omezení – tabulka user_constraints
- ⬜ Akce zohledňující omezení
- ⬜ Demo mode (fake data bez auth)

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
- Multi-agent plně funkční

### Fáze 5 – SaaS launch
- Platební brána
- Landing page

---

## Konvence kódu

- ESM moduly (`"type": "module"` v package.json)
- Vercel serverless functions v `/api/`
- Frontend v `/app/`
- Supabase klient vytvářet UVNITŘ handler funkce (ne na top level)
- `dotenv` import na začátku serverless functions
- Čeština v UI, angličtina v kódu a komentářích
- Git workflow: develop na `main`, test na `test`, produkce na `production`

---

## Důležité poznámky

- `dotenv` je nutný pro lokální vývoj (`vercel dev` na Windows)
- GPT-4o-mini špatně dodržuje striktní instrukce – proto šablony místo zákazů
- Disciplíny jsou v UI zakomentované, ale datový model existuje
- `user_bottlenecks` view funguje, ale `aspiration_weight` je zatím null
- Bottleneck se posílá jako string z frontendu (`context.bottleneck`), ne jako objekt z DB
- Nepracujeme s čísly v UI – jen barvy, emoce, přehled
- Claude Code smí vytvářet nové tabulky a upravovat existující v Supabase