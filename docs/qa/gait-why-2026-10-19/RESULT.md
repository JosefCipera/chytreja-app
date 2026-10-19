# Skutečná oprava vysvětlení nejisté chůze — 19. 10. 2026

**REPAIR_CANDIDATE.** První skutečná oprava po historickém cvičném pokusu z #111. Agent sám změnil produkční funkci `buildWhyResponse` v izolované kopii; nevytvářela se umělá chyba. Přesný ověřený výstup se ukládá do pracovní větve jako návrh aplikace, bez merge/deploy. Na devu se zatím nezobrazí.

## Doložený problém G04 / D02

Syntetický scénář `tester137-profile`: „Jsem nejistý při chůzi.“ Engine z existujících dat vybral EXCESS_ADIPOSITY a ASK „Cítíš se při běžné chůzi stabilně?“. Původní Proč? hovořilo o tělesném tuku, ale neodlišilo tento fokus od zjištění příčiny nejisté chůze. Původní gait matice 25/25 PASS tuto obsahovou mezeru nehlídala. Nová přímá sonda a nový celý orchestrator/engine journey ji reprodukovaly FAIL. Zdrojová dokumentace a kontrakt: work-items/gait-why/README.md a task.json.

## Skutečné výsledné znění

> Uvádíš nejistotu při chůzi. Vycházím ze zadané výšky a hmotnosti. Proto se dnes zaměřujeme na množství tělesného tuku. Cílem je podpořit tvůj aktuální zdravotní stav. Příčinu nejisté chůze tím neposuzuji.

204 znaků. Nová hranice se podmiňuje pouze fokusem EXCESS_ADIPOSITY a skutečně přítomným dokladem o chůzi (`gait_instability_reported=true` nebo přímé `gait_stability=false/ne`). Samotná odpověď o zavřených očích nestačí. Neprohlašujeme tím celé produktové D02 ani klinické D01 za uzavřené: relativní přínos/ranking modelu a dávky cviků nejsou tímto copy patchem schválené. Přesné znění předkládáme Josefu k převzetí.

## Výsledek realizátora

Běh https://github.com/JosefCipera/chytreja-app/actions/runs/39237344788, commit zadání `783dd7407e9be80c37359167dac83484cc61f6b8`, artifact `12179257718`.

- Původní regrese PASS; reálná nová sonda FAIL.
- Diagnóza: 4 requesty, 5 inspekcí. První vlastní edit FAIL.
- Vyhrazená zpětná vazba: agent sám napsal druhý edit. Druhý kandidát všech **12 sad PASS**.
- Samostatný reviewer Haiku: **ACCEPT**. Implementátor Sonnet, nový oddělený review kontext.
- Celkem **8 pracovních requestů, 1 review, 2 edity**; spotřeba posledního běhu 73 317 vstupních a 3 636 výstupních tokenů (nikoli dolarová cena).

Úspěšné matice: chůze 25/25, hubnutí 25/25, změny konverzace 10/10, výpadky 6/6. Dále skutečný celý journey, přímé doklady/proxy a nezměněné kontroly, navigace, copy, zdravotní hlášení, přeskočení/vyčerpání a Launcher. Jazyková klasifikace regresních matic je injektovaná; skutečné API bylo použito pro realizátora a review. Neověřoval se mikrofon, privátní účet nebo klinická účinnost/dávka.

Lead z archivu ověřil SHA-256 přesného kandidáta i diffu, bitovou rovnost celého zdroje mimo buildWhyResponse a omezení podmínky na skutečné hlášení + EXCESS_ADIPOSITY. Skutečný journey stále má ASK, stejnou páku a žádnou novou akci/přiřazení; ovládání je otevřené. Kandidátní modul se na hostiteli nespouštěl; celé app sondy běžely v Dockeru bez sítě a credentials.

## Dřívější neúspěšné pokusy nezmizely

| Běh | Stav | Proč nebyl přijat |
| --- | --- | --- |
| 39236188244 / 5268beb0 | NEEDS_REPAIR | Opravil se původní journey, ne všechny přímé doklady. Následný edit posunutých řádků poškodil syntaxi. |
| 39236761526 / c6a6a730 | BLOCKED | Filtr chybně odmítal české „neposuzuji“; nástroj odmítl doslovné víceřádkové argumenty. Ostatní regrese zároveň oprávněně zachytily nežádoucí změny původních vysvětlení. |

Lead upravil předávání aktuálního číslovaného zdroje po každém editu i zamítnutí, transparentní pravidla argumentů a sémantický filtr pro první/třetí osobu. Nové samostatné testy dál odmítají původní absenci hranice a nepodložené tvrzení, že tuk je příčinou nejistoty. Produkční kód agentovi lead ručně neopravoval ani nepředepsal výslednou větu. Celé trace, spotřeba a stavy všech tří pokusů jsou v audit.json. Původní regresní testy se nezměnily.

## Převzetí a uložení

Draft PR #112 navazuje na #111 (stacked base). Přesná agentova změna je součástí větve pro kontrolu. Žádný merge/deploy ani zápis do osobních účtů; main/dev, engine, zdravotní pravidla a web zůstávají beze změny. Před případným nasazením se má převzít pouze schválená aplikační oprava proti aktuálnímu main a provést příslušné CI; není nutné nasazovat celou experimentální infrastrukturu.

Trvale v gitu: agent.patch, audit.json, before.json, after.json, independent-review.json, lead-verification.json. Úplné CI archivy do 2. 11. 2026. Zálohovací commit má [skip ci], aby samotné převzetí přesného výsledku nespustilo další placený experiment. Žádné další testovací účty ani ruční průchody pro Josefa.
