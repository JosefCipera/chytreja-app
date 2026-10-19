# Skutečná oprava G04 / D02: co vysvětluje Proč?

Zdroje zadání: otevřená položka D02 a podmínka G04 z `work-items/gait-v1/contract.json` na draft #110; `docs/TESTER1-READINESS-2026-10-13.md` a `docs/ENTRY-ACTIONS-AUDIT-ACCEPTANCE-2026-10-14.md` žádají srozumitelnost skutečné priority bez dalších náhodných registrací.

## Reprodukce na nezměněném aktuálním kódu

Main `699135aa`, profil **syntetický** `tester137-profile` v existujícím driveru. Veřejný katalog 152 řádků, SHA256 `2f7effafdfb682138862e27d97f1a6a9a901d0ba641c0404228c545f3d157384`.

- Zadání: „Jsem nejistý při chůzi.“
- Engine vybral EXCESS_ADIPOSITY a režim ASK: „Cítíš se při běžné chůzi stabilně?“
- Proč?: „Uvádíš nejistotu při chůzi. Vycházím ze zadané výšky a hmotnosti. Proto se dnes zaměřujeme na množství tělesného tuku. Cílem je podpořit tvůj aktuální zdravotní stav.“

Chybí výslovné rozlišení: tato volba modelu není zjištěním příčiny nejistoty při chůzi ani jejím vyřešením. Nejde o oprávnění měnit pořadí enginu nebo předepsat jiný cvik. Přesné výsledné znění předložíme jako kandidáta Josefu; tím se automaticky neuzavírá celá D02 ani klinická D01.

Dvě nové nezávislé sondy na nezměněném zdroji **FAIL**: skutečný export `buildWhyResponse` s různými doklady a celý stávající orchestrator/engine journey `tester137-profile`. Všech 25 původních gait scénářů přitom PASS: dosavadní sady tuto obsahovou mezeru nehlídaly. Nevytváříme další úmyslnou chybu.

## Realizátor a rozsah

Samostatná větev `agent/gait-why-context`, draft PR. Navazuje na ověřený řadič z #111, stejné `phases.mjs`/`core.mjs`, stejné modely a rozpočty: nejvýše 12 pracovních requestů, 3 review a 3 odevzdání. Nový hostitelský runner je specifický pro tento skutečný úkol; historický navigační pokus zůstává reprodukovatelný.

Agent může měnit pouze tělo `buildWhyResponse` v `api/engine/orchestrator.js`. Bitová rovnost veškerého okolního kódu se ověří před vykonáním kontrol. Kopie běží v Dockeru bez sítě, credentials a zapisovatelného aplikačního disku. Testy, kontrakt a runner jsou pro agenta neměnné.

Nejprve musí PASS původních deset regresních sad a FAIL nových sond. Potom agent sám diagnostikuje a opravuje. Přijetí vyžaduje všech dvanáct sad PASS, rozsah změny a samostatné review: copy/negace/proxy/Hotovo/readonly; skutečný gait journey; původní navigace a copy; zdravotní hlášení; skip/vyčerpání; launcher; gait/weight/conversation/outage matice. Klasifikace regresních matic je injektovaná, všechny profily a zápisy syntetické. Mikrofon, skutečný účet ani klinická dávka se tím neověřují.

Textový test je pouze sémantický filtr. Neurčuje jedinou povinnou větu a nenahrazuje samostatnou obsahovou kontrolu ani Josefovo převzetí. Žádný opravný text či implementační diff agentovi nepředepisujeme.

## Výstup

Skutečný patch, původní zdroj, otisky, pracovní kroky, původní/nové přepisy, nezávislé review a spotřeba. Při úspěchu lead ověří a uloží přesnou agentovu změnu jako reviewovatelný kandidát. Bez merge/deploy a bez dalších ručních kroků či účtů pro Josefa. D01 (vhodnost a dávka cviku) zůstává mimo tento programový balíček.


## První skutečný běh

39236188244 / 5268beb0 skončil NEEDS_REPAIR po 10 pracovních requestech a 4 editech, review se nespustilo. První a druhý kandidát opravily reprodukovaný celý gait journey, ale neřešily přímou zápornou odpověď o stabilitě; třetí kandidát ji přidal a současně poškodil syntaxi při dalším editu posunutých řádků. Hostitel ho odmítl. Žádná změna aplikace nebyla přijata.

Rozhraní nyní vrací aktuální **číslované** řádky a hash nejen na začátku fáze, ale po každém editu a po zamítnutí. Jednotkové testy ověřují posun čísel po vložení a skutečný tool_result dalšího kroku téhož řadiče. Akceptační testy, skutečný úkol a limity se nemění. Všechny neúspěšné výstupy zůstávají dohledatelné v artefaktu.


Druhý běh 39236761526 / c6a6a730 skončil BLOCKED po 10 pracovních requestech. Odhalil chybu sémantického filtru: legitimní první osoba „neposuzuji“ nebyla uznána, zatímco „neposuzuje“ ano. Filtr nyní přijímá obě osoby; nový samostatný test dál odmítá původní chybějící hranici a tvrzení, že tuk je příčinou nejistoty. Ostatní regrese oprávněně zachytily změny mimo požadovanou interpretaci a zůstávají stejné. Nástroj editace přijímá také doslovný víceřádkový text, který pouze rozdělí na řádky; nekoriguje ani nedoplňuje kód. Hash, povolený soubor, počty řádků, velikost i celkový počet editů se dál kontrolují. Neúspěšný patch není přijat a agentovi se žádná ruční oprava nevkládá.
