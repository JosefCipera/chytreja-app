# CHJ – Roadmapa produktu

> Stav: 2026-03-01 | Verze: 0.4

---

## Kde jsme teď

CHJ (Chytré Já) je PWA mobilní AI kouč pro dlouhověkost. Uživatel vidí „vesmír uzlů" se semafory, AI briefing, akce a mediáteku. Stack: Vanilla JS + Vercel + Supabase + OpenAI GPT-4o-mini.

**Hotovo:**
- ✅ Semafor systém (GREEN / YELLOW / RED) s agregací parent uzlů
- ✅ Onboarding (11 otázek)
- ✅ Sparkline trendy (30 dní)
- ✅ CHJ prompt v2 (šablony, zakázaná slova)
- ✅ Panel s chat inputem (vždy viditelný)
- ✅ PWA – manifest, service worker, offline, installable
- ✅ Mediáteka – viewer pro video (YouTube embed) a audio (Huberman Lab)
- ✅ Obsah uzlů – 5 českých vzdělávacích článků + 8 audio + 8 YouTube videí pro hlavní uzly

---

## Fáze 1 – Stabilizace (Q1 2026, aktuální)

Cíl: Funkční produkt s kompletní logikou pro demo uživatele.

| Úkol | Stav | Poznámka |
|------|------|----------|
| Barva parent uzlu = nejhorší dítě (DB funkce) | ⬜ | PostgreSQL trigger nebo Edge Function |
| Černí jezdci – vazba uzel → jezdec v DB | ⬜ | Nová tabulka `node_riders` |
| Bottleneck plně v CHJ kontextu | ⬜ | Propojit view `user_bottlenecks` → API chat |
| Sen (aspirace) v onboardingu | ⬜ | Výběr aspirace, napojení na `user_aspirations` |
| Tabulka `user_constraints` | ⬜ | Fyzická / zdravotní / demografická omezení |
| Akce zohledňující omezení | ⬜ | Koleno → ne běh, ale plavání |
| Demo mode (fake data bez auth) | ⬜ | Pro testování bez Supabase účtu |
| Obsah pro uzly nižší úrovně | ⬜ | Kardio, VO2max, Síla, Stabilita, Spánek, Stres… |
| Timestampy v YouTube videích | ⬜ | Odkaz na minutu relevantní pro uzel |
| Přechod AI: GPT-4o-mini → Claude Haiku/Sonnet | ⬜ | Lepší dodržení striktních instrukcí |

---

## Fáze 2 – Mobile first (Q2 2026)

Cíl: Aplikace fungující jako nativní na iOS a Android.

| Úkol | Stav |
|------|------|
| Touch gesta (swipe panel, haptics) | ⬜ |
| ElevenLabs TTS (české hlasy) | ⬜ |
| Push notifikace (Web Push API) | ⬜ |
| Offline cache strategie (Service Worker v2) | ⬜ |
| Responsive design revize (320–430px) | ⬜ |
| Dark mode | ⬜ |

---

## Fáze 3 – Orchestrátor + multi-agent (Q3 2026)

Cíl: CHJ jako master agent s delegováním na specializované agenty.

| Úkol | Stav |
|------|------|
| Přechod na Anthropic Claude (Sonnet pro agenty, Haiku pro routing) | ⬜ |
| MCP protokol – agenti jako nástroje | ⬜ |
| CHJ Master Agent → Tělo Agent, Mysl Agent, Výživa Agent… | ⬜ |
| Prediktivní semafor (projekce trendů, ne jen aktuální stav) | ⬜ |
| Proaktivní briefing ráno (push + hlas) | ⬜ |
| Hlasové ovládání (Speech-to-Text) | ⬜ |

---

## Fáze 4 – Wearables & data (Q4 2026)

Cíl: CHJ čte data přímo ze zařízení, ne jen z onboardingu.

| Integrace | Zdroj dat | Poznámka |
|-----------|-----------|----------|
| **Oura Ring** | HRV, spánek, kroky | REST API, OAuth |
| **Apple Health** | Vše z HealthKit | HealthKit → Web bridge (nutná nativní app?) |
| **Google Fit / Health Connect** | Android | REST API |
| **Garmin Connect** | VO2max, trénink | REST API |
| **Continuous Glucose Monitor** | Glykémie, HRV | Dexcom / Libre API |

Riziko: Apple Health vyžaduje nativní app (Swift). Zvážit React Native nebo Flutter wrapper.

---

## Fáze 5 – SaaS launch (Q1 2027)

| Úkol | Stav |
|------|------|
| Platební brána (Stripe) | ⬜ |
| Tier: Free (3 uzly) / Pro (vše + AI) / Premium (wearables) | ⬜ |
| Landing page | ⬜ |
| Onboarding funnel (A/B) | ⬜ |
| GDPR / ochrana dat (EU) | ⬜ |

---

## Expanzní modely (nové „vesmíry")

CHJ může přesáhnout longevity a stát se platformou pro různé zdravotní a životní oblasti. Každý model = nový vesmír uzlů s vlastní logikou.

---

### Model A – Obezita & tělesná kompozice

> Framework: Peter Attia (DEXA, body fat %), Layne Norton (kalorie a protein), Valter Longo (fasting)

**Proč:** Obezita je vstupní brána do všech čtyř černých jezdců. Je to průsečík výživy, metabolismu a pohybu.

**Uzly vesmíru:**
```
Tělesná kompozice (hlavní)
├── Energetická bilance
│   ├── Kalorický příjem
│   └── Kalorický výdej (NEAT + trénink)
├── Složení těla
│   ├── Procento tělesného tuku
│   ├── Svalová hmota (FFM)
│   └── Viscerální tuk (obvod pasu)
└── Metabolismus
    ├── Inzulínová rezistence (HOMA-IR)
    ├── Bazální metabolismus
    └── Metabolická flexibilita
```

**Specifika:**
- Vstupy: váha, obvod pasu, DEXA (volitelné), CGM data
- Výstup: BMI (informativní), ale primárně tukové procento a svalová hmota
- Akce: kalorický deficit, silový trénink, protein target
- Časová osa: změna složení těla viditelná za 8–12 týdnů

---

### Model B – Pohyb & sport coaching

> Framework: Galpin (silový trénink), Attia (zóna 2 + VO2max), Huberman (nervová soustava, regenerace)

**Proč:** Pohyb má největší ROI ze všech intervencí pro dlouhověkost. Ale „jdi cvičit" nestačí – potřebuje se dozovat správně.

**Uzly vesmíru:**
```
Pohyb (hlavní)
├── Aerobní zdatnost
│   ├── VO2max
│   ├── Zóna 2 (mírná aerobní kapacita)
│   └── Laktátový práh
├── Síla & hypertrofie
│   ├── Maximální síla (1RM)
│   ├── Svalová hmota
│   └── Výbušnost
├── Pohyblivost & stabilita
│   ├── Flexibilita (ROM)
│   ├── Stabilita trupu
│   └── Rovnováha
└── Regenerace
    ├── HRV (srdeční variabilita)
    ├── Spánková kvalita
    └── Subjektivní únava
```

**Specifika:**
- Personalizace podle omezení (koleno, záda) a cíle (maratón vs. silová síň)
- Tréninkové plány generované AI (ne statické)
- Timestampy: odkaz na Galpin vysvětlující zónu 2 v minutě 14:32
- Propojení s wearables (kroky, HRV, tepová frekvence)

---

### Model C – Výživa & stravování

> Framework: Attia (protein first), van Tulleken (UPF), Longo (fasting + IGF-1), Norton (kalorie in vs. out)

**Uzly vesmíru:**
```
Výživa (hlavní)
├── Makronutrienty
│   ├── Protein (g/kg/den)
│   ├── Sacharidy (kvalita, GI)
│   └── Tuky (nasycené vs. nenasycené)
├── Kvalita stravy
│   ├── Ultrazpracované potraviny (UPF skóre)
│   ├── Zelenina a vláknina
│   └── Mikronutrienty (deficit check)
└── Stravovací vzorce
    ├── Časově omezené stravování (TRE)
    ├── Kalorická bilance
    └── Alkohol & stimulanty
```

**Specifika:**
- Foto jídla → AI analýza (GPT-4o vision)
- Denní protein target na základě tělesné hmotnosti
- Upozornění při opakovaném příjmu UPF
- Propojení s Oura (spánek po těžkém jídle) a CGM (glykémie po jídle)

---

### Model D – Symptomy & triage

> Framework: diferenciální diagnostika pro laiky, ne lékaře

**⚠️ Právní upozornění:** Tento model NESMÍ být diagnostický. Je to orientační triage – "co dělat dál", ne "co máš". Každý výstup musí obsahovat doporučení navštívit lékaře.

**Uzly vesmíru:**
```
Symptomy (hlavní)
├── Kardiovaskulární
│   ├── Únava při zátěži
│   ├── Dušnost
│   └── Palpitace
├── Metabolické
│   ├── Zvýšená žízeň / časté močení
│   ├── Nevysvětlitelné přírůstky hmotnosti
│   └── Nízká energie ráno
├── Neurologické / kognitivní
│   ├── Zapomnětlivost
│   ├── Mlha v hlavě (brain fog)
│   └── Poruchy spánku
└── Muskuloskeletální
    ├── Bolest kloubů
    ├── Svalová slabost
    └── Rovnováhové problémy
```

**Specifika:**
- CHJ NEZNÁ diagnózu → říká "toto naznačuje, obrať se na lékaře"
- Propojení na krevní markery (ApoB, hsCRP, HOMA-IR) z uzlu Zdraví
- Červené příznaky (chest pain, severe dyspnea) → okamžitá instrukce: ZAVOLEJTE 112
- Semafor: YELLOW = sleduj + lékař do 2 týdnů, RED = lékař ihned

---

### Model E – Léky & suplementy

> Framework: Attia (suplementy s důkazy), Huberman (dopaminové protokoly), Examine.com data

**⚠️ Právní upozornění:** Žádná doporučení ke změně předepsané medikace. Pouze informace o interakcích a evidence.

**Uzly vesmíru:**
```
Suplementy & léky (hlavní)
├── Základní suplementy
│   ├── Vitamin D3 + K2
│   ├── Omega-3 (EPA/DHA)
│   ├── Hořčík (formy a dávkování)
│   └── Kreatin
├── Pokročilé suplementy
│   ├── NMN / NR (NAD+ prekurzory)
│   ├── Berberine
│   └── Ashwagandha (kortizol)
└── Interakce & rizika
    ├── Interakce s běžnou medikací
    ├── Kontraindikace (těhotenství, ledviny…)
    └── Kvalita / certifikace doplňků
```

**Specifika:**
- Evidence rating: A (RCT meta-analýzy) → D (jen anekdoty)
- Upozornění: "Toto nekombinuj s Metforminem"
- Zdroj dat: Examine.com API (komerční) nebo vlastní databáze

---

### Model F – Spánek & regenerace (rozšíření uzlu Mysl)

> Framework: Matthew Walker (Why We Sleep), Huberman (cirkadiánní rytmus), Oura data

**Uzly vesmíru:**
```
Spánek (hlavní)
├── Kvantita
│   ├── Celková délka spánku
│   └── Konzistence (± 30 min každý den?)
├── Kvalita
│   ├── Hluboký spánek (% z celkového)
│   ├── REM spánek
│   └── Probuzení v noci (wake-ups)
└── Cirkadiánní rytmus
    ├── Čas uložení vs. chronotyp
    ├── Ranní světlo (první hodina)
    └── Modrá světla večer
```

---

### Model G – TOC (Teorie omezení) pro produkt

> Interní nástroj: ne pro uživatele, ale pro tým CHJ při prioritizaci

**Koncept:** Theory of Constraints (Goldratt) aplikovaná na CHJ product development.

```
Bottleneck CHJ produktu (TOC):
1. Identifikace omezení: Co brzdí uživatele nejvíc?
   → Aktuálně: chybí personalizace akcí (omezení)
2. Exploatace omezení: Jak max využít stávající kapacitu?
   → Lepší CHJ prompt, přesnější šablony, bottleneck z DB
3. Subordinace: Ostatní procesy podřídíme omezení.
   → Nejdřív omezení, pak nové funkce
4. Elevace omezení: Jak omezení odstranit?
   → user_constraints tabulka + AI akce
5. Opakování: Najdi nové omezení.
   → Po omezení: chybí data z wearables
```

**Aktuální bottleneck produktu:** Personalizace akcí bez dat z wearables. Uživatel dostane generické akce, ne akce pro sebe.

**BMC (Business Model Canvas) – klíčové bloky:**
- Value proposition: AI kouč, který ví co TY potřebuješ, ne co potřebuje průměrný člověk
- Customer segment: "Health optimizer" 30–55 let, střední/vyšší příjem, zájem o longevity
- Revenue stream: Freemium (3 uzly free) → Pro (vše) → Premium (wearables + agenti)
- Key resource: AI orchestrátor + obsah uzlů + community
- Channel: App Store (PWA), Product Hunt, longevity komunity (Reddit, Discord)

---

## Obsah – roadmapa

| Priorita | Typ obsahu | Stav |
|----------|-----------|------|
| 🔴 | Uzly nižší úrovně – česky (Kardio, VO2max, Síla, Stabilita, Spánek, Stres) | ⬜ |
| 🔴 | Timestampy v YouTube videích (minuty relevantní pro uzel) | ⬜ |
| 🟡 | TTS shrnutí – kratší české verze článků pro přehrání | ⬜ |
| 🟡 | Propojení článků s Norbecovem (segmenty cvičení, ne celý film) | ⬜ |
| 🟢 | Anglický obsah pro mezinárodní expanzi | ⬜ |
| 🟢 | Video shortlist pro každý uzel nižší úrovně | ⬜ |

---

## Technický dluh

| Problém | Závažnost | Řešení |
|---------|-----------|--------|
| GPT-4o-mini špatně dodržuje instrukce | 🔴 Vysoká | Přechod na Claude Haiku |
| Bottleneck je string z frontendu, ne z DB | 🟡 Střední | Napojit `user_bottlenecks` view |
| `aspiration_weight` je null v DB | 🟡 Střední | Onboarding napojit na `user_aspirations` |
| Supabase klient na top level v některých funkcích | 🟢 Nízká | Přesunout do handler funkce |
| Bez `user_constraints` – akce jsou generické | 🔴 Vysoká | Vytvořit tabulku + napojit na prompt |

---

## Principy prioritizace

1. **Nejdřív omezení (TOC):** Vyřeš co nejvíc brzdí uživatele, ne co je nejjednodušší.
2. **Data before features:** Bez dat z wearables jsou akce méně relevantní.
3. **Jeden uzel pořádně > deset uzlů povrchně:** Kvalita obsahu > pokrytí.
4. **Mobile first:** Každá nová funkce se testuje na 375px iPhone před desktopem.
5. **Claude > GPT pro instrukce:** Striktní pravidla CHJ promptu fungují lépe s Claudem.

---

*Aktualizováno: 2026-03-01 | Autor: CHJ tým*
