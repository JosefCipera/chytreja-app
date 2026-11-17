# CHJ BACKLOG — otevřené položky

> Jedno místo pro odložené/otevřené rozhodnutí a nápady, místo rozházení po
> jednorázových checkpoint souborech. Udržuje Claude průběžně; upozorní, když
> najde nesrovnalost mezi tímhle seznamem a realitou kódu.
> Založeno: 2026-11-17

---

## Produktová rozhodnutí čekající na zadání

- **Lifestyle flagy bez enginové logiky** — `smoker`, `alcohol`, `stress_job` se
  v UI (Vstupní data → Profil) ukládají, ale engine je nikdy nečte
  (`api/engine/adapter.js` má `smoking_history`/`alcohol_history` natvrdo
  `'unknown'`; `stress_job` se nenačítá vůbec). Vědomě odloženo — UI text už
  to flaguje ("Ostatní zatím jen evidujeme pro budoucí rozšíření"). Až budeme
  řešit: nejdřív produktové rozhodnutí co každý flag má v enginu znamenat,
  pak implementace — ne obráceně.

- **Laik/expert terminologie sjednocení** — `DIAGNOSIS_LABEL_CS` v
  `app/js/universe/user-data-panel.js` (české názvy diagnóz pro zobrazení) a
  `data/io-map/io-map.json`'s `label_expert`/`label_layman` páry (CRT
  goal-tree nody) jsou dvě oddělené, nepropojené tabulky se stejným duchem
  ale bez sdíleného zdroje pravdy. Možná zajímavé před vícejazyčnou verzí.
  Queued jako task (viz spawn_task "Unify diagnosis labels with io-map
  laik/expert glossary").

- **Chybějící/nevyužité lab fieldy** — kyselina močová není v `LAB_FIELDS`
  (ale `HYPERURICEMIA` v `DIAG_KEYWORDS` existuje); PSA a fasting_insulin
  jsou v `LAB_FIELDS`, ale bez enginového využití. Vědomě ponecháno beze
  změny ("to neni system").

- **"Desetiboj dlouhověkosti" (Attia Centenarian Decathlon) — IP riziko** —
  posouzeno jako nízké (obecná myšlenka + standardní klinické funkční testy,
  ne doslovný překlad), ale není to právní rada. Před komerčním spuštěním
  stojí za to nechat ověřit od IP advokáta.

- **Variabilita formulací odpovědí** — hypotetický nápad (ne zadání): více
  frazeologických variant stejné odpovědi, deterministicky rotovaných, aby
  odpovědi CHJ nepůsobily "robotičtěji" při opakovaném použití. Nezapočato.

- **Širší audit kvality AI textů napříč celou appkou** — na začátku dnešní
  session zmíněno jako "bod 1", pak odloženo ve prospěch systematického
  textového auditu 4 oblastí (nadváha/pohyb/síla/rovnováha), který proběhl.
  Zbytek appky (mimo těchto 4 oblastí) zatím neauditován.

## Bezpečnostní scénáře k dalšímu prozkoumání

`scripts/test-safety-scenarios.mjs` — rostoucí sada, začátá 2026-11-17.
Další kandidáti na přidání (ne zatím otestováno):
- Drogy / jiné léky s bezpečnostním významem (ne jen "léky na ředění krve",
  co nikam nezapadá) — až se objeví konkrétní testovací případ.
- Kombinace více současně aktivních constraintů (CV + funkční + metabolický)
  a jejich vzájemná priorita.

## Rozhodnuto, ponecháno beze změny (pro referenci, ne akce)

- Height/weight NEpřidávat do bootstrap-needs.json jako vysokou prioritu —
  čistý "ptej se jen, když je potřeba" přístup zůstává.
- Sex/gender JE v bootstrap-needs.json (přidáno 2026-11-16) — jediná
  výjimka, protože engine ho reálně používá (CV riziko ≥65 let) a dřív se
  nikdy neptal.
