# Realizátor oprav — první izolovaný experiment

Navazuje na draft PR #110. Ten umí kontroly a oponenturu; implementaci dělal Codex ručně. Tento balíček přidává skutečný nástrojový cyklus: AI čte zdroje, sama navrhne a zapíše opravu, spustí zapečetěné kontroly, předá patch oddělenému reviewerovi a může zpracovat jeho připomínky.

## Co ověřujeme

Známá historická chyba: „Co mám dělat zítra?“ po denním ukončení končilo jako nerozpoznaný vstup. V dočasné kopii se vrátí historická regrese. Worker dostane popis chování a první chybový výstup, nikoli opravný diff nebo čistý soubor. Základní kontroly musí nejdřív projít na čisté verzi a potom selhat na poškozené. Bez tohoto důkazu se model vůbec nespustí.

AI má povolené nástroje `inspect`, `replace`, `edit_lines`, `check`, `submit`. Soubor ke změně: `api/engine/orchestrator.js`; automatická konečná kontrola navíc přijme pouze změnu regulárního výrazu pro navigaci. Ostatní kód musí zůstat bitově stejný. Jde o úzce vymezený programový pokus, ne univerzální oprávnění měnit engine.

Při odevzdání běží nezávisle na tvrzení workera:

- osm kladných, pět záporných a šest skutečných `processInput` sond;
- stávající kontrakty copy, zdravotního hlášení, denního přeskočení/vyčerpání a ovládání;
- izolovaná engine matice chůze, změn konverzace a výpadků klasifikátoru;
- nový Claude API reviewer bez historie uvažování realizátora: zadání, skutečný diff a zapečetěné výsledky. Není to jiná předplacená chatová aplikace; jde o samostatný request se stejným modelem `claude-haiku-4-5`.

Jazyková klasifikace v těchto regresích je **injektovaná**, nikoli nový live test porozumění. Zde se měří samostatná programová oprava. Live jazykové důkazy jsou v předchozím pilotu, nelze je přejmenovat na nový běh.

## Hranice a náklady

Model může udělat nejvýše 12 pracovních a 3 review requesty, 3 odevzdání, 6 úprav a 8 spuštění kontrol včetně výchozích. Každý request má nejvýše 2048 výstupních tokenů, celkem nejvýše 600 000 znaků historie na vstupech; maxRetries 0. Spotřeba tokenů se ukládá. GitHub job má limit 15 minut. Jde o samostatnou spotřebu Anthropic API, ne paušálu Claude.

Kandidátní kód běží pouze v Dockeru bez sítě, bez hostitelských proměnných/klíčů, s read-only diskem, omezenými procesy/pamětí a bez capabilities. Hostitelský řadič a zadání nejsou připojeny do kontejneru. Model nemá shell, přístup k `.git`, klíčům ani možnost změnit testy. Celý checkout je na exportovaných aplikačních/testovacích souborech, ne na skutečných účtech. Veřejný katalog se získá před předáním API klíče ze stejného existujícího read-only zdroje jako ostatní testy.

Chybějící klíč, Docker, katalog, neplatné review, vyčerpaný rozpočet nebo neúspěšný baseline vede na BLOCKED, ne na schválení. Úspěch je pouze `REPAIR_CANDIDATE`, dosud ne Josefovo přijetí. Klinické otázky D01/D02 předchozího pilotu zůstávají otevřené.

## Spuštění a předání

Automaticky v PR z větve `agent/gait-repair-worker`, workflow `Isolated gait repair worker`. Používá existující GitHub secret; klíč se nikam nekopíruje. Kód ani diff se automaticky necommituje, nemerguje a nenasazuje.

Artefakt `gait-repair-experiment` uchovává 14 dní: report, kroky nástrojů, oddělená review, spotřebu, jednotlivé výsledky, otisky, skutečný `candidate.patch` a výsledný zdroj. Trvalé shrnutí ověřeného běhu doplní lead do tohoto adresáře. Původní `main` i dev zůstávají stejné. Historická chyba je už v main opravená; tento patch je důkaz schopnosti realizátora, ne nový důvod znovu přepisovat aplikaci.

## První běh a oprava řadiče

Běh 39151687747 (commit 9c5c82bf) skončil BLOCKED po 12 pracovních API voláních, 0 edits a 0 review. Čistý baseline PASS; historická regrese správně zachycena. Worker četl příliš mnoho zdrojů a jeho poslední exact-text edit byl odmítnut. Žádná oprava aplikace nevznikla. Spotřeba: 156 201 vstupních a 1 575 výstupních tokenů.

Lead následně opravil nástrojový protokol: zdroj se vrací jako doslovný text místo další JSON escapované vrstvy, odmítnuté edity se ukládají, čtení poskytuje otisk souboru a přibyl edit řádků podmíněný shodou otisku. Worker dostává zbývající rozpočet a pokyn k cílenému hledání. Zadání aplikace, mutace, zapečetěné testy i limity zůstaly stejné. Opravný regex realizátorovi nedodáváme. Další běh je nový explicitně zaznamenaný pokus, ne skrytý retry API.
