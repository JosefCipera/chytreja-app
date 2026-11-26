# CHYTRÉ JÁ --- MASTER LOCK

## Health MVP & Landing v0.1

**Datum:** 23. 8. 2026

> **Nejdřív člověka poznat. Potom propojit, co o něm víme. A teprve
> potom rozhodnout, co mu právě teď může nejvíc pomoct.**

## Status značky

-   **LOCK** --- schváleno; neměnit bez explicitního produktového
    rozhodnutí.
-   **DIRECTION** --- preferovaný směr; lze dále ověřovat a ladit.
-   **OPEN** --- zatím není rozhodnuto.
-   **NOT NOW** --- není součást Health MVP; nyní neimplementovat.

## 1. Co stavíme --- LOCK

Chytré já není zdravotní chatbot. Dlouhodobě člověka postupně poznává,
propojuje relevantní souvislosti a pomáhá mu lépe se rozhodovat. První
skutečně budovaný specializovaný systém je **Health MVP**.

> **Čím víc relevantního se CHJ o člověku dozví, tím lépe dokáže zvolit
> jeho další krok.**

## 2. Positioning --- LOCK

# Chytré já

## Pro život, jaký chceš žít.

> Postupně tě poznává, propojuje souvislosti a pomáhá ti dělat lepší
> rozhodnutí na cestě k tomu, co je důležité právě pro tebe.

Nezačínáme dlouhověkostí. Zdraví je první vstup, ale CHJ je dlouhodobě
širší.

## 3. První obrazovka --- LOCK

> **Začněme tím nejdůležitějším.**
>
> **Zdraví si přejeme všichni. Co pro něj děláš ty?**

`Řekni mi…` + mikrofon

Žádný povinný výběr kategorií. **Uživatel přinese situaci. CHJ ho
nasměruje.**

## 4. Vizuální identita --- LOCK

-   malé původní kurzorové logo CHJ vlevo nahoře;
-   uprostřed světelné vesmírné jádro;
-   jádro = vizuální přítomnost CHJ, nikoli logo nebo lidský avatar;
-   výchozí CHJ nemá humanoidní avatar;
-   tmavě modrá + bílá + jemná modrofialová;
-   minimum dalších barev, hodně prostoru, žádný „cirkus".

## 5. Landing → CHJ --- LOCK

> **V okamžiku první odpovědi uživatele se web stává Chytrým já.**

Žádný restart ani opakované zadávání. P0 je funkční změna stavu na
stejné ploše; jemné animace jsou P1.

## 6. Pre-login rozhovor --- LOCK

CHJ může položit **0--3 relevantní otázky**. Tři jsou maximum, ne cíl.
Každá otázka musí mít potenciál změnit další směr; jinak STOP.

## 7. První AHA --- LOCK

Nejpozději po třetí otázce: \> **Už vidím první souvislost...**

nebo: \> **Ještě o tobě nevím dost, ale už vím, co potřebuji zjistit
dál.**

**AHA = první důkaz, že CHJ člověku začíná rozumět. Není to diagnóza ani
zdravotní doporučení.** Pro MVP jde o krátké slovní propojení, bez
dynamických diagramů.

## 8. Registrace --- LOCK

> **Chceš, abych si tě pamatoval?**
>
> To, co spolu postupně zjistíme, použiju při dalších návrzích.

Po technické registraci: **Tak pokračujeme.** Rozhovor se nerestartuje a
pre-login informace musí být možné převést do standardní
evidence/persistence vrstvy.

## 9. Post-login poznávání --- LOCK

Jedno poznávací kolo má maximálně **5 otázek**, ale může skončit dříve.

> **CHJ člověka nevyslýchá. Poznává ho postupně.**

## 10. Engine-first --- LOCK

Nechceme `krásný AI rozhovor → generická rada`. Nová relevantní
informace musí být schopna projít skutečným Health modelem a změnit
další rozhodnutí. Maximálně využít existující Health Engine a kontrakty.

## 11. Dva typy dalšího kroku --- LOCK

### Akce

> **Z toho, co o tobě zatím vím, navrhuji...**
> `Proč? · Hotovo · Přeskočit`

### Potřeba evidence

> **Než budu pokračovat, potřeboval bych ověřit/doplnit...**
> `Proč? · Ověřím/Doplním · Teď ne`

Přesný wording tlačítek je OPEN; významový rozdíl je LOCK.

## 12. Feedback loop --- LOCK

`poznávám → evidence → propojuji/vyhodnocuji → ptám se nebo navrhuji → člověk reaguje → nová evidence → fresh decision`

`Proč?` pouze vysvětluje existující rozhodnutí.

## 13. Acceptance scénáře --- LOCK

-   **A --- Funkční síla:** relevantní funkční omezení může změnit model
    a vést ke konkrétní akci; nevymýšlet příčinu bez důkazu.
-   **B --- Silent Risk / Prediabetes:** rozlišovat
    neznámé/podezření/potvrzené; podezření není diagnóza; Next Best
    Evidence může mít přednost před lifestyle akcí.
-   **C --- Medication changes direction:** nová významná informace o
    léku může změnit prioritu; nejdřív ověřit, svévolně neměnit ani
    nevysazovat medikaci.
-   **D --- Stability:** stejný stav bez nové relevantní evidence nemá
    produkovat náhodně jinou prioritu. **Novost není hodnota.**

## 14. Human acceptance test --- DIRECTION

Začít přibližně s 5 novými uživateli. Sledovat: zda začnou přirozeně
mluvit, zda reakce působí osobně, zda otázky nejsou výslech, zda přijde
AHA, zda chtějí pokračovat a zda sami sdělí něco, na co se CHJ
explicitně nezeptalo.

## 15. Jak to funguje --- DIRECTION, téměř LOCK

1.  **Řekneš mi, co se děje.**
2.  **Postupně tě poznávám a propojuju souvislosti.**
3.  **Pomůžu ti zvolit další krok.**

Vizuál: struktura druhého mockupu, ale bez barevné pestrosti, bez
lidského avatara, bez falešného skóre 74 %, bez tří současných
doporučení. Použít světelné jádro, jednu modrofialovou akcentní barvu,
jeden další krok a více prostoru.

## 16. Monetizace --- DIRECTION, NENÍ LOCK

> **Landing neprodává CHJ. Nechá tě ho poznat.**\
> **Free ukáže hodnotu.**\
> **PRO nabídne pokračování.**\
> **Founder nabídne místo u začátku.**

Ceník je normálně dostupný z navigace, cenu neschováváme, ale nechceme
klasickou SaaS tabulku tarifů.

Pracovní úvod: \> **Kolik stojí lepší rozhodnutí?** \> \> Nechceme, abys
platil za seznam funkcí, které možná nikdy nepoužiješ.

`Nejdřív mě vyzkoušej → Zdarma`\
`Když budeš chtít, abych s tebou zůstalo → PRO`

Cena PRO a správný okamžik paywallu jsou OPEN. Registrace „Chceš, abych
si tě pamatoval?" nesmí být skrytý paywall.

## 17. Founder --- DIRECTION

Founder není třetí tarif; je to účast u začátku CHJ. - **#001--#200** -
200 jemných světelných bodů/hvězd - pracovní cena **9 900 Kč jednou** -
přesné vymezení „PRO navždy" musí vzniknout před prodejem - Founder je
samostatná vizuální kapitola.

## 18. Ceník --- vizuální DIRECTION

Vertikální, vzdušná cesta Free → PRO → Founder. Více vertikálního
prostoru, jednotná typografie a tlačítka, minimum barev; Founder nejvíce
oddělit.

## 19. O nás --- LOCK směru

Začínáme problémy lidí, ne technologií. Stejné tři oblasti na desktopu i
mobilu:

### Léky

Bereš jich několik. Víš, jak se navzájem ovlivňují?

### Skrytá rizika

Některé problémy se vyvíjejí dlouho, než si jich všimneš.

### Každodenní život

Pohyb, spánek, jídlo, stres a další každodenní věci dávají největší
smysl v souvislostech.

> **Chytré já vzniká proto, aby tyto informace postupně spojovalo do
> souvislostí, poznávalo, co je důležité právě pro tebe, a pomáhalo ti
> dělat lepší rozhodnutí.**

Žádný carousel.

## 20. Člověk za CHJ --- LOCK směru

Jedna skutečná fotografie.

**Josef Čipera --- zakladatel Chytrého já**

Krátký příběh o práci s rozhodováním, komplexními systémy a Theory of
Constraints a o přenesení této zkušenosti k člověku jako komplexnímu
systému. Ne dlouhý životopis. ITING s.r.o. jako firma/provozovatel v
příslušných údajích.

> **Chytré já nemá rozhodovat za tebe.**\
> **Má ti pomáhat rozhodovat se lépe.**

## 21. Navigace --- DIRECTION

`Jak to funguje · Ceník · Zakladatelé · O nás · Přihlásit`

Malé kurzorové logo vlevo = návrat na začátek. Mobilní provedení
zjednodušit.

## 22. Voice --- DIRECTION / NOT BLOCKER

Cíl: přirozená, velmi dobrá mluvená čeština, nikoli robotické TTS. Voice
není blocker Health MVP. Claude má pouze auditovat současnou voice/TTS
pipeline a budoucí možnost A/B testu; nyní nic nepřepisovat.

## 23. NOT NOW --- LOCK

Nyní nestavíme: - obecný life coach; - práci, vztahy a finance; -
kompletní psychologický model; - dynamické AHA diagramy; - galerii
avatarů; - složité animace a voice vizualizace; - kompletní wearable
integraci; - nový paralelní Health Engine; - rozsáhlou predikční
medicínu; - kompletní cross-domain systém.

Architektura pouze nesmí budoucí rozšíření zbytečně znemožnit.

## 24. OPEN --- vědomě nerozhodnuto

-   konkrétní měsíční cena PRO;
-   přesný rozsah Free;
-   přesný okamžik nabídky PRO/paywallu;
-   finální wording některých CTA;
-   finální vizuální provedení „Jak to funguje";
-   přesné podmínky Founder „PRO navždy";
-   budoucí voice provider/model.

## 25. Další postup

1.  Spustit Claude audit pomocí připraveného audit promptu.
2.  Audit je **READ-ONLY**: nic neimplementovat, neměnit soubory,
    databázi, commit ani push.
3.  Výstup: `EXISTUJE / ČÁSTEČNĚ / CHYBÍ`, acceptance scénáře A--D a
    plán P0/P1/P2.
4.  Audit společně vyhodnotit.
5.  Teprve poté schválit první minimální implementační balíček.
6.  Preferovat malé změny, reuse a existující kontrakty před přepisem
    systému.

## STATUS --- rychlá orientace

**LOCK:** Health MVP scope; positioning; první vstup přes zdraví; 0--3
pre-login otázky; AHA; registrace bez restartu; max. 5 post-login
otázek; engine-first; akce vs. evidence; feedback/fresh decision;
acceptance A--D; základní vizuální identita; NOT NOW.

**DIRECTION:** Human test; Jak to funguje; Free → PRO → Founder; vizuál
ceníku; Founder koncept; navigace; voice; O nás.

**OPEN:** Cena PRO; rozsah Free; paywall; některé CTA; finální Jak to
funguje; Founder podmínky; voice provider/model.

**NOT NOW:** položky ze sekce 23 nesmějí rozšiřovat P0 Health MVP bez
nového explicitního rozhodnutí.
