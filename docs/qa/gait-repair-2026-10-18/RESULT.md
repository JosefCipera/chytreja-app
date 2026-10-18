# Realizátor oprav — ověřený výsledek 18. 10. 2026

**BLOCKED. Žádný schválený kandidát.** Tři omezené pokusy skončily vyčerpáním rozpočtu před odevzdáním. Není to dokončený samostatný coding agent ani předatelná zdravotní větev. Dev, main, osobní účty, klinická pravidla, landing a Zakladatelé se nezměnili.

## Co vzniklo

Draft PR #111: nástrojový realizátor (`inspect`, přesná změna textu, změna řádků s otiskem, zapečetěný test, odevzdání), oddělený reviewer, výpočetní a souborové hranice, rozpočet a trvalý protokol. První pokus vrací historickou chybu jen v dočasné kopii: otázka „Co mám dělat zítra?“ se nepovažuje za přesnou navigaci.

Worker nedostal čistý soubor, opravný diff ani předepsaný regex. Všechny verze nejprve ověřily čistý baseline PASS a potom prokazatelně chybu zachytily FAIL. Kandidátní kód byl spouštěn v Dockeru bez sítě, přihlašovacích údajů a možnosti měnit testy. Chybné výstupy nebyly propouštěny na dev.

## Tři pokusy

| Běh GitHub Actions | Realizátor | API volání | Zapsané úpravy | Výsledek |
| --- | --- | ---: | ---: | --- |
| 39151687747 | Haiku 4.5 | 12 | 0 | BLOCKED; čtení spotřebovalo rozpočet, poslední exact edit odmítnut |
| 39151917627 | Haiku 4.5 | 12 | 0 | BLOCKED i po opravě protokolu nástrojů |
| 39152070480 | Sonnet 4.6 | 12 | 1 | Vlastní patch vznikl, ale původní test stále FAIL; BLOCKED |

V prvním běhu byl vracený zdroj zbytečně znovu JSON escapován. Lead opravil předání doslovného textu, přidal hash-guarded edit řádků, evidenci odmítnutých změn a ukazatel zbývajícího rozpočtu. Druhý běh znovu nic neopravoval. Třetí použil silnějšího realizátora; zadání, mutace, testy i limity zůstaly stejné. U třetího běhu jsou nově zachovány celé stdout/stderr a strukturované počty scénářů.

Celkem 36 pracovních volání; review API **0**, protože žádný výsledek neprošel k odevzdání. Celkem 310 383 vstupních a 3 484 výstupních tokenů, rozdělení je v audit.json. Tyto počty nejsou dolarová cena; modely mají rozdílné sazby.

## Co přesně vytvořil Sonnet

Změnil jen `DOMAIN_REQUEST_NAV_RE`. Přidal „zítra“ před „mám“ nebo před „dělat“, ale nepokryl původní pořadí „Co mám dělat zítra?“ ani samostatné „Co zítra?“. Po své změně spustil test; ten znovu selhal na původní větě. Potom vyčerpal počet volání. Lead patch znovu sestavil ze záznamu nástroje, ověřil jeho SHA-256 a nezávisle reprodukoval stejný FAIL. Není přijat ani přepsán ruční opravou vydávanou za práci agenta.

Přesný odmítnutý patch je `rejected-worker.patch`; `audit.json` obsahuje komity, čísla běhů, otisky, počty, trace nástrojů a nezávislé ověření.

Čistý baseline třetího běhu prošel všemi devíti sadami: navigační sonda, copy, zdravotní hlášení, skip, vyčerpání, launcher a izolované matice chůze **25/25**, změn konverzace **10/10**, výpadků **6/6**. Matice používají **injektovanou klasifikaci**, nikoli nový live důkaz rozpoznávání řeči nebo zdravotní bezpečnosti. Těmito zelenými výsledky nelze zakrýt selhání nového realizátora.

## Závěr a podmínka dalšího pokračování

Záznam ukazuje opakované čtení stejných míst a až pozdní nedostatečnou opravu. Pouhá výměna modelu nestačila. Není doložená jediná technická příčina všech neúspěchů a neslibujeme, že ji vyřeší vyšší limit.

Před další skutečnou oblastí je potřeba upravit vedení realizátora: samostatná fáze diagnózy s konkrétním vysvětlením závady, vyhrazený rozpočet na implementaci a zpětnou vazbu, pak odevzdání. To je návrh dalšího experimentu, **zatím neimplementováno ani ověřeno**. Čtvrtý API pokus se v tomto balíčku nespouští.

Klinické D01/D02 z #110 zůstávají oddělené a otevřené. Josefovi se kvůli této překážce nezadává další ruční proklikávání ani zakládání testovacího účtu.

## Záloha

Vše v oddělené větvi `agent/gait-repair-worker`, draft PR https://github.com/JosefCipera/chytreja-app/pull/111. Úplné artefakty tří běhů `gait-repair-experiment` jsou uchovány do 1. 11. 2026; tento souhrn, kompaktní strojový audit a přesná odmítnutá změna zůstávají v gitu. Dokumentační commit má `[skip ci]`, aby samotné uložení výsledku nezaplatilo další modelový pokus.
