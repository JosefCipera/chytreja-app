# Čtyři vstupní doporučení CHJ — podklad k odbornému rozhodnutí

Datum: 14. 10. 2026. Stav: podklad připraven, klinické schválení otevřené.

## Rozhodnutí a pořadí

Nejdřív uzavřít čtyři níže uvedená doporučení, zapracovat schválené změny a ověřit je izolovaně. Potom celý průchod zkusí Josef, teprve následně tester1. Nezadávat znovu audit celého katalogu ani další náhodné registrace. Tento dokument není pokyn k osobnímu provádění cviků.

Technické fungování a klinická vhodnost jsou oddělené. Výsledek SAFE nebo SAFE_WITH_MODIFICATION je výstup interních pravidel CHJ, nikoli lékařské schválení. Odpověď na otázku v onboardingu není diagnóza. Prázdná diagnóza v profilu neprokazuje nepřítomnost onemocnění.

## Přesnost podkladů

Kód bezpečnostní brány byl přečten z main `8bcb8ec8fa41ec3e6cb3d45dde7805ab9615f8cd`: api/engine/nextBestAction.js. Následující dávky a katalogová ID pocházejí z lokálního veřejného fixture scripts/ai-tester/catalog-active.json (SHA256 f2bbdf89ecdcf93235e29298abbbdcf25533a1b54bc94e22b2680ea05db07dfd); nejde o nové čtení živé databáze. Před případnou změnou katalogu ověřit aktuální řádky včetně duplicit.

Přepis židle je v data/engine/action-instructions.json; příklady vykreslených doporučení jsou v [třech syntetických průchodech](THREE-ENTRY-JOURNEYS-2026-10-14.md). Žádný soukromý účet, katalogový řádek, dávka ani runtime pravidlo nebyly při přípravě tohoto podkladu změněny.

## Čtyři karty pro posouzení

| Doporučení dnes | Proč ho CHJ nabízí / co z toho neplyne | Doložený podklad | Co odborně rozhodnout |
|---|---|---|---|
| Procházka 20 minut; LIGHT; chuze_20min, chůze_20min, telo_chůze | Pohybová nabídka v hubnutí/pohybové větvi. Není samostatným plánem hubnutí. Chůze při zjištěné nestabilitě není automaticky povolená. | WHO podporuje pravidelný pohyb a chůzi; neurčuje právě tuto individuální úvodní dávku 20 minut. | Pro jakou výchozí kapacitu je 20 minut vhodný začátek? Kdy kratší/rozdělená varianta nebo posouzení? Frekvence, pravidla navyšování a omezení. |
| Svižná chůze nebo kolo 20 minut, dá se mluvit; MODERATE; 380bb59c-6c0c-40e4-973d-20c5447ef4b2 | Aerobní krok ve větvi nadměrného tuku. Výška/hmotnost nejsou měření tuku ani samy neposuzují toleranci zátěže. | WHO: obecný týdenní rámec pro aerobní aktivitu. Nelze z něj odvodit, že každý nový uživatel zvládne 20 minut. | Požadavky na kapacitu a zdravotní podklady; vhodnost intenzity a komunikačního vodítka; rozdíl chůze, venkovního kola a rotopedu; frekvence/progrese. |
| 5 pomalých vstání ze židle, podle potřeby pomoc o područky; LIGHT; sit_to_stand_supported | Negativní kapacitní odpověď může vést k prioritě svalové síly. Neschopnost vstát ze země sama není potvrzená diagnóza svalové slabosti ani důkaz vhodnosti cviku. | NHS Strength exercises obsahuje 5 pomalých opakování sit-to-stand. Jeho provedení při vstávání používá nohy bez paží a doporučuje jinou židli; není identické s podporovanou variantou CHJ. CDC 30-second Chair Stand je hodnoticí test, nikoli tréninková dávka. | Vhodnost podporované varianty pro danou kapacitu, židle/područky, dávka a odpočinek, frekvence a kritéria pro postup nebo jiné cvičení. |
| Stoj na jedné noze 30 sekund, opora, oči otevřené; LIGHT; rovnovaha_stoj_1 a b3f9b408-47a5-4529-bfbb-906a2324813b | Interní model nestability může zpřístupnit základní podporovaný balanční úkol. Selhání se zavřenýma očima samo neprokazuje nejistou běžnou chůzi. | NHS Balance exercises popisuje podporovaný stoj 5–10 sekund, 3× na každé straně. NICE požaduje individualizovaný program. Ani jeden z těchto podkladů neschvaluje výchozích 30 sekund pro každou hlášenou nejistotu. | Je vhodný tento cvik jako vstup při nejistotě, nebo nejprve posouzení/jiná varianta? Délka výdrže, strany/opakování, míra opory/dohledu, frekvence/progrese. |

Číselné dávky výše zůstávají popisem dnešního systému. NHS 5–10 sekund není automaticky návrh přepsat CHJ; srovnání nevytváří nový postup 10→30→60 sekund.

## Co dnes software blokuje nebo upravuje

Jde o popis kódu, nikoli doporučení pro pacienta nebo úplný seznam klinických kontraindikací.

| Podmínka | Dnešní chování / mez |
|---|---|
| Shoda uloženého constraintu s action.constraint_exclude | CONTRAINDICATED bez ohledu na závažnost. Fixture procházky mají ankle_foot; ostatní tři karty mají prázdný seznam. Prázdný seznam neznamená absenci dalších rizik. |
| Relevantní kloubní omezení neznámé závažnosti | NEEDS_MORE_EVIDENCE; žádost o doplnění. |
| Závažné omezení zatěžované oblasti | NEEDS_CLINICAL_CLEARANCE. U mírných/středních omezení se vrací specifické úpravy nebo požadavek na konzultaci podle intenzity. |
| Aktivní nestabilita a chůze bez explicitní podpory | Nejprve doplnění stability. Pokud je otázka zodpovězená, ale nestabilita trvá, individuální posouzení. Kombinovaný label chůze/kolo bez modality software blokuje jako celý kandidát; tím klinicky nerozlišuje rotoped od venkovního kola. |
| Aktivní nestabilita a základní balance/stability | SAFE_WITH_MODIFICATION: pevná opora, otevřené oči, stop při bolesti/závrati/ztrátě rovnováhy, zpočátku dohled nebo blízká opora. Tato interní vstupní politika zůstává hlavní otázkou odborného posouzení. |
| Aktivní nestabilita a zavřené oči/nestabilní podložka nebo step_down | Individuální posouzení; obecná rada o opoře takovou variantu nezpřístupní. |
| VIGOROUS/HIIT | Potvrzené kardiovaskulární riziko vyžaduje clearance; chybějící zdravotní základ doplnění. Tyto čtyři karty jsou LIGHT/MODERATE, takže tento konkrétní high-intensity filtr sám jejich vhodnost neověřuje. |
| Kardiovaskulární riziko a ne-vysokointenzivní silový protokol | Úpravy tlaku/dýchání a stop podmínky; přísnější kloubní výsledek má přednost. Ani to není univerzální povolení po synkopě, při arytmii nebo s implantátem. |

Mimo tento soubor jsou samostatné orchestrátorové blokace nepodporovaných zdravotních požadavků. Bezpečnostní brána není celý engine; samotný průchod branou nedokazuje, že systém danou akci vybere.

## Podklady ověřené 14. 10. 2026

- WHO, Physical activity: https://www.who.int/europe/news-room/fact-sheets/item/physical-activity — obecný rámec pohybu a vícekomponentního cvičení pro starší dospělé; nikoli individuální dávka CHJ.
- NHS, Strength exercises, část Sit-to-stand: https://www.nhs.uk/live-well/exercise/strength-exercises/ — praktický příklad 5 pomalých opakování, s rozdíly provedení oproti CHJ.
- NHS, Balance exercises, část One-leg stand: https://www.nhs.uk/live-well/exercise/balance-exercises/ — praktický příklad s oporou, 5–10 sekund a 3 opakování na stranu.
- CDC STEADI, 30-second Chair Stand: https://www.cdc.gov/steadi/media/pdfs/STEADI-Assessment-30Sec-508.pdf — hodnocení síly/vytrvalosti; odlišný testovací protokol.
- NICE NG249: https://www.nice.org.uk/guidance/ng249/chapter/Recommendations — aktuální vyhledaný obsah k 1.3.9–1.3.10 uvádí individualizaci a progresi. Přímé načtení stránky/PDF v této kontrole vrací 403; závěr o přesné dávce z něj neděláme. Dřívější ověření je zaznamenáno v [zdrojové opravě](QA-ACTION-ADVICE-EVIDENCE-2026-10-14.md).

## Uzavření odborné kontroly — jedna odpověď na každou kartu

Pro každou ze čtyř karet vyplnit:
1. **Verdikt:** ponechat / upravit / před nabídkou posoudit / nepoužívat pro tento profil.
2. **Cílový profil a podklady:** co musí být známo; kdy nedostatek údajů brání nabídce.
3. **Přesná dávka:** trvání/opakování, strany, série/odpočinek, frekvence.
4. **Progrese/regrese:** podle jaké pozorované schopnosti nebo reakce, nikoli pouze počtu kliknutí Hotovo.
5. **Omezení a stop podmínky:** klinické i praktické, požadavky na podporu/dohled.
6. **Zdroj a rozsah platnosti:** co je převzaté a co je odborný úsudek pro cílovou skupinu; jméno/role posuzovatele a datum.

Bez zodpovězení těchto bodů neoznačit katalogovou dávku za ověřenou nebo vhodnou pro všechny uživatele. Odborník smí schválit odlišnou podporovanou variantu; nemusí pouze opsat veřejný leták.

## Josefův průchod potom — krátký a před testerem1

Po zapracování rozhodnutí a technické regresi:
- Stejný testovací účet, jasný syntetický profil; žádný reset soukromých dat.
- Registrace/onboarding, pokud prověřujeme nový vstup; jinak existující účet pro návrat.
- Hlasem zadat zvolený cíl a zkontrolovat přepis.
- Přečíst DNES → Proč? → Kam směřuješ? → Co tím změníš?: vztah cíle, doložených podkladů a dnešního kroku.
- Ověřit stav po Hotovo/Přeskočit a po opětovném otevření. Hotovo nezapisovat jako skutečné provedení do osobního zdravotního účtu jen kvůli testu.
- Zkontrolovat jeden nepodporovaný požadavek v syntetickém scénáři a možnost návratu; není třeba zkoušet všechny kombinace ručně.

Josef posuzuje srozumitelnost a průchod aplikací, nikoli klinickou validaci tím, že mu rozhraní funguje. Potom se podle uzavřeného rozsahu připraví zadání pro tester1.
