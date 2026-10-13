# Připravenost Chytrého já pro tester1 — 2026-10-13

Stav podkladů: main `366b8c5a48e514e28f757888df8c63b3dba51351`; běhový kód po PR #64 `ef84e0c4b0136af3ae0bb31adaa6cdea57fc3d8c`. Rozhodnutí pro tuto chvíli: **ještě nepředávat tester1 k samostatnému používání zdravotních doporučení**. Dokončit omezený vstupní průchod, bez přidávání dalších modulů. Tento dokument popisuje důkazy a otevřené podmínky; sám je neuzavírá.

## Co je a není doložené

| Podmínka | Stav a důkaz | Co zbývá / kdo |
|---|---|---|
| Zadání cíle a oprava údaje | Doložené pro sledovaný případ: po upřesnění stabilní chůze se nabídka změnila na aktivitu pro hubnutí. Izolovaný test výslovné opravy hlídá obě pole, jiné nálezy a chybu zápisu. | Codex: další skutečné rozpory přidat jako regrese; nevytvářet kvůli každému další účet. |
| Přeskočit a konec dne | Josef dnes doložil svižná chůze/kolo → procházka → uzavření; Co dál? nabídku neobnovilo. | Tento průchod neopakovat. Přepis je důkaz UI výstupu, ne samostatná kontrola DB. |
| Hotovo a návrat další den | Izolované scénáře kontrolují dokončení, znovu načtený stav a simulovaný další den. | Skutečný návrat stejného testovacího účtu 14. 10. ještě chybí. Jeden cílený krok Josefa, žádný reset/nový účet. |
| Technické chování větví | 768 kombinací, endpoint scénáře, šest rozhovorů a výpadky v automatických sadách. CI posledního běhového merge prošlo. | Výsledky nedokládají správnost zdravotního modelu, dávky ani osobní vhodnosti akce. |
| Význam doporučení a WHY | Texty jsou stručnější a používají aktuální zdroje; dnešní opravený průchod má srozumitelné WHY. | Codex: projít přesné přepisy tří větví (hubnutí, síla, rovnováha), ověřit rozdíl cíl/priorita/odhad, žádné tvrzení bez podkladu. Josef posoudí krátký přehled, ne desítky variant. |
| Pokyny, vstupní náročnost a dávka cviků | Bezpečnostní podmínky jsou zachovány; zavírání očí v základním pokynu odstraněno. Dávka 30 s tím nebyla schválena. | Claude: zdrojový audit dosažitelných akcí. Neuzavřené otázky pro kvalifikovaného odborníka; AI audit není klinické schválení. |
| Vstup web → přihlášení → onboarding → první odpověď | Dílčí dřívější uživatelské zkoušky a izolovaný wizard existují. Veřejné HTTP kontroly potvrzují dostupnost. | Chybí jeden souvislý průchod aktuální verzí bez nápovědy, s obrazem stavu po obnovení stránky. Codex připraví krátký protokol; skutečné přihlášení ověří obsluha zařízení. |
| Hlas, mobil a obnovení relace | Simulované UI kontroluje otevřené ovládání; není to test mikrofonu, ASR ani rozložení na telefonu. | Na podporovaném zařízení ověřit jednu diktovanou větu, správný přepis, odpověď a návrat. Bez tohoto důkazu hlas neslibovat jako ověřený průchod. |
| Hranice podpory a výpadek AI | Kód uvádí pohyb, nadváhu, sílu a rovnováhu; scénáře hlídají lékařskou blokaci a zachování zprávy při výpadku. | Codex: doložit konkrétní nepodporovaný a nejasný vstup v připravovaném přehledu. Upozornění musí být viditelné a umožnit srozumitelný další krok; seznam témat není záruka bezpečnosti všech vstupů. |

Podrobnosti dnešního skutečného přepisu jsou v [checkpointu](CHECKPOINT-2026-10-13-evening.md). Technický rozsah a limity sad jsou v [README testeru](../scripts/ai-tester/README.md). CI: https://github.com/JosefCipera/chytreja-app/actions/runs/38429933137.

## Pořadí uzavření

1. **Claude dodá podklady k akcím.** Nejdřív procházka 20 minut, svižná chůze/kolo 20 minut, vstávání ze židle 5× a stoj na jedné noze 30 s; pak další dosažitelné akce. Vycházet ze skutečného katalogu a výsledného vykreslení, nikoli pouze jednoho JSON souboru. Otevřené otázky nezahladit přepsáním textu.
2. **Codex připraví krátký důkaz srozumitelnosti tří větví** ze skutečných automatických přepisů. U každé: zadání, podklady, doporučení, WHY, hranice podpory. Josef vybere/odsouhlasí formulaci. Nové chyby reprodukovat automaticky, ne sběrem náhodných registrací.
3. **Dokončit jeden souvislý průchod a skutečný návrat další den.** Technické kontroly udělá Codex, skutečnou obsluhu telefonu a přihlášení ověří Josef. Není to nový dlouhý seznam variant: jeden vstupní průchod a jeden návrat. Zjištění označit jako skutečné nebo simulované.
4. **Rozhodnout o předání podle důkazů.** Pokud vhodnost či dávka dosažitelného zdravotního doporučení zůstane neuzavřená, nejde o připravený test samostatného používání. Případný test pouhé srozumitelnosti na syntetických údajích, bez provádění cviků, musí být výslovně oddělený; tento dokument nezavádí takový režim do aplikace.

## Konkrétní zadání pro Clauda k předání Josefem

Pracuj nad aktuálním `JosefCipera/chytreja-app/main`. Úkol je **audit návrhu pohybových akcí**, nikoli oprava aplikace. Nic neměň, nemerguj, nenasazuj, nespouštěj aplikaci proti živým účtům. Nečti soukromé profily, nepoužívej service-role klíč. Pokud potřebuješ katalog, použij pouze veřejné aktivní akce a uveď datum/verzi snapshotu.

Projdi `data/engine/action-instructions.json`, `data/engine/intervention-map.json`, `api/engine/nextBestAction.js`, překlady bezpečnostních pokynů a ACT v `api/engine/orchestrator.js` a související položky veřejného katalogu. Rozlišuj katalogový název, přepsaný pokyn a bezpečnostní úpravy; ukaž výsledný text, který uživatel dostává. `action-instructions.json` obsahuje jen lokální úpravu vstávání ze židle, není celý katalog.

Nejdřív posuď výše uvedené čtyři akce. U každé vrať řádek: ID a zdroj, výsledný pokyn, cílové vstupní údaje/omezení, dávka, předpoklady provedení, opora a podmínky zastavení, primární zdroj pro protokol a dávku, otevřené otázky. Zvlášť prověř podklad pro **30 sekund na jedné noze**; neodvozuj vhodnost dávky z obecného důkazu přínosu rovnovážného cvičení. Ověř, zda zdroj skutečně odpovídá populaci a provedení v aplikaci.

Výsledek označ jako „text bez navržené změny“, „návrh změny textu“, nebo „vyžaduje odborné posouzení protokolu/dávky“. Chybějící podklad uveď otevřeně. Používej primární odborné zdroje a odkazy; neoznačuj klinickou bezpečnost jednotlivého uživatele za schválenou. Vrať stručnou tabulku a prioritní otázky pro kvalifikovaného odborníka. Kód nech Codexu, návrhy zatím neaplikuj. Výsledek dej Josefovi k přeposlání do tohoto vlákna.

## Zadání tester1 až po uzavření podmínek

„Projdi Chytré já bez našich rad. Řekni, co chceš řešit, a zkus zjistit, proč ti aplikace nabídla právě tento krok. Napiš, kde přestáváš rozumět nebo věřit, a co bys čekal dál.“

Neposílat předem předepsané klikání a odpovědi. Cílem je rozpoznání problému a srozumitelnost, ne potvrzení připraveného scénáře. Tester není zdravotní posuzovatel. Před předáním určit povolený rozsah podle dokončeného auditu; nevytvářet dojem podpory dalších modulů, diagnóz či zdravotního dozoru, které nebyly ověřeny.
