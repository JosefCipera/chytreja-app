# Fázový realizátor — ověřený výsledek 19. 10. 2026

**REPAIR_CANDIDATE: první doložený úspěch omezeného realizačního cyklu.** Agent sám našel příčinu, napsal opravu, zpracoval FAIL, sám ji opravil a předal úspěšnou druhou verzi samostatnému reviewerovi. Nejde o dokončenou oblast nejisté chůze, obecného agenta pro všechny nemoci ani klinické schválení.

Draft PR #111, větev `agent/gait-repair-worker`. Main/dev, onboarding, skutečné účty, databáze, zdravotní pravidla, landing i Zakladatelé zůstaly beze změny. Tento patch opravuje úmyslně vrácenou historickou závadu **jen v dočasné kopii**. Nepoužít ho přímo na produkční main; tam už je tato historická chyba opravená jiným dřívějším commitem.

## Co se změnilo proti 18. říjnu

Celkový limit se nezvýšil: 12 pracovních requestů, 3 review, 6 editů, 8 kontrolních sad. Rozpočty byly rozděleny na diagnózu (max. 4), implementaci (max. 3) a dvě případné opravy po zpětné vazbě (po max. 2). Čtení nemůže spotřebovat implementační část. Diagnóza musí odkazovat na skutečně čtené řádky. Kontroly spouští řadič, nikoli model jako podmínku vlastního schválení. Každá další fáze dostává aktuální kód, hash a diff. Model dostává požadované chování; opravný regex si navrhl sám.

Zadání, původní mutace i zapečetěné akceptační/regresní testy zůstaly stejné. Upřesnil se pouze popis již testovaného rozsahu: plná/krátká navigace, diakritika a zákaz pohlcení složených zdravotních vstupů. Modely stejné jako poslední běh v1: Sonnet 4.6 implementuje, Haiku 4.5 kontroluje v novém odděleném kontextu.

## Doložený poslední běh

- Commit: `602e96a756e87c63b6ea0148dc1528d582a46256`.
- Actions: https://github.com/JosefCipera/chytreja-app/actions/runs/39221651882, artifact `12172236577` (`gait-repair-experiment`).
- Čistá verze: všech devět sad PASS. Historická mutace: prokazatelný FAIL.
- Diagnóza: 4 API requesty, 6 inspekcí, odkazy na čtený zdroj.
- Implementace: 2 requesty, vlastní edit. **První kandidát FAIL**; review se správně nespustilo.
- Feedback: 2 requesty, vlastní druhý edit. **Druhý kandidát PASS**, rozsah změny PASS.
- Samostatné review: 1 API request, **ACCEPT**.
- Celkem: **8 pracovních requestů, 1 review, 2 skutečné edity**. Spotřeba všech rolí tohoto běhu: 58 412 vstupních a 3 238 výstupních tokenů. Nejde o dolarovou cenu.

Druhá verze prošla navigační sondou (8 kladných, 5 záporných a 6 processInput kontrol), pěti dalšími smluvními sadami pro copy, zdravotní hlášení, přeskočení/vyčerpání a launcher a třemi engine maticemi: **chůze 25/25, změny konverzace 10/10, výpadky 6/6**. Klasifikace těchto matic je injektovaná; nejsou novým live důkazem porozumění řeči nebo klinické bezpečnosti. Skutečné API běželo pro diagnózu, implementaci a review.

## Vlastní ověření leadem

Z archivu jsem ověřil SHA-256 kandidáta a diffu proti reportu a bitovou rovnost celého souboru mimo navigační deklaraci. Čtyři další formulace navigace a čtyři složené zdravotní/nepodporované vstupy prošly doplňkovou kontrolou. Na hostiteli se neimportoval kandidátní modul: jen se jako data zpracoval staticky vytažený regulární výraz. Celé aplikační testy běžely v kontejneru bez sítě a credentials.

Review ACCEPT není automaticky pravdivé v každém zdůvodnění. V raw review jsou dvě věcné nepřesnosti: záporných sond je **5, nikoli 6**, a vstup odmítnutý přesnou navigační zkratkou zůstává normálnímu zpracování (review chybně píše, že nebude předán klasifikátoru). Tyto výroky nepřebíráme; skutečný kód a testy potvrzují správnou hranici. Nevyžadují změnu opravy ani zdravotních pravidel. Raw odpověď zůstává zachovaná v independent-review.json.

## Dva předchozí dnešní běhy jsou také uložené

| Běh | Výsledek | Doložená překážka | Oprava řadiče |
| --- | --- | --- | --- |
| 39220825558 / 17e0e717 | BLOCKED po 4 requestech | Platná diagnóza citovala skutečně čtené rozsahy, validátor požadoval jen jednotlivé řádky | Uznat rozsah jen pokud byl čten každý jeho řádek; nepustit mezery či cizí zdroje |
| 39221153579 / 84b0e7f1 | BLOCKED po 9 requestech | První vlastní edit a FAIL, ale feedback dostal starý zdroj/hash | Předat aktuální stav každému kolu a zkoušet to ve stejném řadiči |

Tyto překážky byly moje chyby protokolu, nebyly zakryty jako úspěch AI. Jejich trace a spotřeba jsou v audit.json. Poslední běh doložil, že opravený přenos stavu i rezervovaný feedback skutečně fungují.

## Co je hotové a co ještě ne

Hotový je první ověřený **omezený mechanismus opravy**, včetně návratu po selhání. Dávky/vhodnost cviku D01 a produktové vysvětlení jiné priority D02 z #110 tím nejsou vyřešeny. Také ještě není doložená obecná použitelnost pro další programové závady nebo paralelní oblasti. Další balíček má být skutečná otevřená programová chyba nejisté chůze s jasnými podmínkami, stejnou izolací a nezávislým převzetím. Josefovi se k této technické překážce nepřidává ruční proklikávání.

## Trvalá záloha

`candidate.patch`, `audit.json`, `independent-review.json`, `lead-verification.json` a tento souhrn jsou v gitu. Úplné archivy tří běhů v CI platí do 2. 11. 2026. Dokumentační commit používá `[skip ci]`, aby samotné uložení výsledku nespustilo další placený běh. Nic se automaticky nemerguje ani nenasazuje.
