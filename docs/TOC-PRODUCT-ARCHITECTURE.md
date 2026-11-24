# TOC Product Architecture — zakládací dokument

> **Status: DRAFT v0.1 — první verze, na kterou navazujeme.** Není zamčená ústava jako `CHJ-PRODUCT-ARCHITECTURE.md` — je to první tvar, který se bude upřesňovat tak, jak postupně posoudíme, co TOC vesmír skutečně potřebuje.
>
> Vychází z rozhovoru 2026-11-24: TOC a Longevity mají hodně společného — oba řeší "co teď udělat, aby to mělo největší páku na cíl", oba mají Vesmír jako knihovnu k studiu, oba potřebují CRT a nakonec konverzační vrstvu, která vede člověka (mistr/plánovač ≈ pacient).

---

## ★ TOC — PRACOVNÍ PRINCIPY (návrh, k ověření)

> Zatím ne "neměnné" jako u CHJ — ale psané stejným stylem, aby šly později zpřísnit nebo opravit, až uvidíme, kde neplatí.

**1. CÍL JE VYDĚLÁVAT PENÍZE TEĎ I V BUDOUCNU.**
TOC neřeší "efektivitu" ani "pořádek ve výrobě" samo o sobě. Řeší, co nejvíc brání firmě vydělávat peníze nyní a udržitelně i dál (Goldrattův "Goal" — ne nákladová, ale průtoková optika: T/I/OE).

**2. DATA JSOU TO, CO FIRMA UŽ MÁ Z PROVOZU.**
Zakázky, pracoviště, parametry pro plánování, hlavní plán, Throughput Accounting. Ne nová anamnéza — existující provozní evidence, kterou firma sbírá (dnes: `toc_zakazky`, `toc_pracoviste`, `toc_parametry`, `toc_hlavni_plan`).

**3. VESMÍR JE STRUKTURA + VELKÁ KNIHOVNA K STUDIU.**
Na rozdíl od longevity, kde je knihovna spíš podpůrná, u TOC je samotné studium (finance/TA, výroba, CCPM, strategie, marketing) podstatnou částí hodnoty — "pro TOC je toho mraky". Vesmír orientuje v tom, co se dá nastudovat a proč to souvisí s cílem č. 1.

**4. CRT JE ALGORITMUS CÍLENÝ NA SORTIMENT PODLE TA A PLÁNOVÁNÍ VÝROBY.**
Osobní/firemní CRT se neskládá jen z obecných kauzálních cest — jde o konkrétní rozhodovací algoritmus: který sortiment podle Throughput Accounting táhnout, jak podle toho plánovat výrobu (DBR, kapacity pracovišť, termíny). Později možná CRM/"mafia offer" (nabídka, kterou nejde odmítnout — Goldrattovo rozšíření TOC do prodeje).

**5. NEJTĚŽŠÍ ČÁST JE KONVERZACE — VEDENÍ ČLOVĚKA.**
Stejně jako u longevity není hlavní problém mít správná data nebo správný model, ale vést konkrétního člověka (mistra, plánovače) k tomu, co má teď udělat, a proč. Konverzační/orchestrační vrstva z Launcheru je považována za nejtěžší a nejdůležitější kus práce — ne čísla, ne Gantt.

---

## 1. Srovnání s Longevity (co se přebírá, co ne)

| Vrstva | Longevity | TOC (návrh) | Stav |
|--------|-----------|-------------|------|
| **Launcher / Conversation** | "Co mám teď dělat?" | "Co má mistr/plánovač teď udělat?" | ❌ neexistuje — **nejtěžší kus, priorita** |
| **Engine (rozhodování)** | Health Engine: activation→inference→leverage→NBA→DAILY_DECISION | TOC engine: evidence o zakázkách/pracovištích → constraint (sortiment/kapacita) → DBR/plán → DOMAIN_DECISION | ❌ neexistuje — dnes je `api/toc.js` jen výpočet/prezentace, ne decision loop |
| **AI Orchestrator** | Překládá structured decision do přirozeného jazyka, nikdy nerozhoduje | Totéž, pro TOC doménu | ❌ neexistuje |
| **Vesmír** | Orientační mapa + menší knihovna | Orientační mapa + **velká knihovna** (finance_toc, vyroba_toc, ccpm, strategie_toc, marketing_toc) | ✅ existuje, bohatší než longevity v content/docs |
| **CRT** | Vzorové kauzální cesty nejvýznamnějších longevity problémů | Algoritmus: sortiment podle TA → výrobní plán | ❌ neexistuje (`crt-template.json` chybí v `data/universes/toc/`) |

**Závěr:** TOC vesmír (prezentační/studijní vrstva) je dnes paradoxně napřed před Longevity. Ale chybí přesně to, co u Longevity dělá CHJ použitelným denně — rozhodovací engine a konverzační vrstva nad ním.

---

## 2. Data — co už existuje (provozní evidence, ne nový sběr)

```
toc_parametry     — systémové parametry (LV = limit vytížení %, KP = délka plánu, GD/GO = Gantt okno, LZ = limit záznamů)
toc_pracoviste    — číselník pracovišť (kapacita_hod = smena_hod × pocet_smen × pocet_zdroju, poradi pro mapování)
toc_zakazky       — zakázky/forecasty (vyrobit_ks, odvedeno_ks, termin_dodani, cas_pracoviste JSONB {"poradi": minuty}, stav)
toc_hlavni_plan   — denní výrobní plán (plan_ks, uvolnene_ks, predvydane_ks)
```

Princip 2 říká: **nerozšiřovat tato data, dokud nechybí významná kauzální cesta k cíli "vydělávat peníze teď i v budoucnu"** — stejná logika jako u Longevity ("nová data nejsou důvodem rozšiřovat model").

---

## 3. Vesmír — dnešní obsah (`data/universes/toc/`)

```
models/toc.json          — uzly: toc → finance_toc / vyroba_toc / ccpm / strategie_toc / marketing_toc
                            finance_toc → prutok_toc (T) / zasoby_toc (I) / naklady_toc (OE)
models/medioteka.json, texts.json
content/toc/{toc,vyroba,finance,marketing,strategie,ccpm}/*.md
assistants/assistant-toc.json
access/{access-pro,access-free,access-demo}.json
```

Chybí oproti Longevity:
- `crt-template.json` (princip 4 — sortiment/TA algoritmus jako CRT)
- Napojení na engine (žádný `activation.js`/`inference.js` ekvivalent pro TOC domain)
- `data/engine/intervention-map.json`-like kontrakt — co konkrétně TOC "doporučí udělat"

---

## 4. CRT jako algoritmus (princip 4, k rozpracování)

Pracovní formulace, zatím koncept — **neimplementovat bez dalšího rozpracování**:

```
Vstup:   toc_zakazky (sortiment, termíny, časy na pracovištích)
         toc_pracoviste (kapacity)
         toc_parametry (limity)
  ↓
TA klasifikace sortimentu: T/I/OE per produkt/zakázka
  ↓
Identifikace constraint pracoviště (bottleneck kapacity)
  ↓
Prioritizace sortimentu podle T/čas-na-bottlenecku (Goldrattův poměr)
  ↓
DBR plán: Drum (bottleneck) → Buffer → Rope (uvolňování zakázek)
  ↓
DOMAIN_DECISION pro TOC: co uvolnit/co pozdržet/kam přesunout kapacitu
```

Toto je analogie k Health Engine pipeline, ale **není to totéž** — u TOC jde o alokaci kapacity/sortimentu, ne o safety-gated akci pro člověka. Než se začne implementovat, potřebuje vlastní review (stejně jako Health Engine má `CHJ-ENGINE-ARCHITECTURE.md`).

CRM/"mafia offer" (princip 4, druhá věta) — odloženo, žádné rozpracování zatím.

---

## 5. Konverzace — proč je to nejtěžší (princip 5)

U Longevity řeší konverzační vrstvu `app/launcher.html` + `api/engine/orchestrator.js`: strukturované rozhodnutí enginu → přirozený jazyk, nikdy naopak.

Pro TOC to znamená totéž, ale cílová osoba je jiná — mistr nebo plánovač, ne pacient. Bude víc rolí (majitel, plánovač, mistr dílny — liší se slovník i rozhodovací pravomoc), ale **začínáme jednou: plánovač výroby**, protože na tu roli už existuje reálný funkční základ (viz bod 5b).

Zbývající otevřené otázky:
- Jaké jsou typické otázky/situace, na které má TOC Launcher plánovači reagovat (analogie k Desetiboji u Longevity)?
- Jak vypadá "DOMAIN_DECISION" pro TOC v jazyce ACT/ASK/HOLD/SAFETY, nebo potřebuje vlastní sadu módů?

### 5b. Existující základ pro roli plánovače výroby — odtud se začíná

Nejde o prázdné místo. Už dnes existuje reálný (ne jen prezentační) výpočet:

```
app/toc-vyroba.html          — UI, JS funkce runKapacita() (anglický název, česká UI)
  ↓ POST /api/toc?action=kapacita
api/toc.js (action==='kapacita')
  — vstup:  toc_zakazky (termín, průběžná doba, cas_pracoviste), toc_pracoviste (kapacita_hod)
  — výstup: zatizeni[] — % vytížení každého pracoviště po dnech (Gantt-like řada)
```

Vesmír uzel "Výroba (DBR)" (viz `src/lib/toc-config.js` → `vyroba_toc`) má tlačítko **"Plán výroby"** s reálným `href: '/app/toc-vyroba.html'` — jediné tlačítko v celém TOC HUD configu, které vede na funkční nástroj, ne na `href: null` placeholder. "Hlavní plán" a "Plán kooperací" jsou zatím stuby.

**Z toho plyne pořadí práce:** než se vymýšlí nový CRT algoritmus (bod 4) od nuly, nejdřív prozkoumat, co `action==='kapacita'` dělá, a navrhnout konverzační vrstvu nad *tímto* výstupem (vytížení pracovišť → kde je bottleneck → co plánovač má udělat) — ne nad hypotetickým modelem.

---

## 6. Co z tohoto dokumentu plyne pro další práci

Toto je **výchozí bod k navazování**, ne specifikace k implementaci. Než se cokoliv kóduje:

1. Ujasnit okruh uživatele konverzace (bod 5) — to určuje slovník i scope.
2. Rozpracovat CRT-jako-algoritmus (bod 4) do podoby, která jde ověřit na reálných datech (podobně jako Josef/Kovářová referenční případy u Longevity).
3. Teprve pak navrhnout engine pipeline a DOMAIN_DECISION kontrakt analogický `CHJ-ENGINE-ARCHITECTURE.md`.

Vesmír (bod 3) už z velké části existuje a nemusí se nejdřív stavět — knihovna je napřed před rozhodovací vrstvou, ne naopak.

---

*Datum: 2026-11-24 · Verze: 0.1 (draft) · Navazuje na: `docs/CHJ-PRODUCT-ARCHITECTURE.md`, `docs/DEVLOG.md:1234`*
