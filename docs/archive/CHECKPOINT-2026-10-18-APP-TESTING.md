# Chytré já — checkpoint testování 18. 10. 2026

Časová zóna: Europe/Prague. Běhový stav po PR #108: `ad04d8f3a5bf544823c780bfa6f7eafec144ab71`. Vývojové nasazení Vercel develop bylo potvrzené jako success. Tento checkpoint zaznamenává práci; nové testy účtů ani DB dotazy při jeho přípravě neprobíhaly.

## Rozhodnutí pro pokračování

- Zakladatele dnes dále neupravovat.
- **K tlačítku „Vyzkoušej na sobě“ nic nepřidávat.** Návrhy textu z rozhovoru nebyly schválené k nasazení; zůstává stávající web.
- Připravené [zadání pro testera 1](TESTER1-ZADANI-2026-10-18.md) je omezený test ovládání a srozumitelnosti na smyšleném profilu, bez provádění cviků. Není oznámením hotové aplikace ani schválením zdravotních doporučení.
- Aktuální rozsah: pohybové nabídky pro málo pohybu, nadváhu, sílu a rovnováhu. Samostatný komplexní plán hubnutí, výživa, kardio, TOC, BMC a jazyky nejsou součástí tohoto testu.
- Testera nikdo nekontaktoval a zadání nikomu neodeslal. Uživatel si vybere, komu ho předá.

## Skutečné pozorování Josefa

Následující závěry vycházejí z jeho přepisů a snímku, nikoli z přímého čtení soukromých tabulek. Účty zde označujeme A/B, protože v dnešním rozhovoru nebyly sděleny jejich jednoznačné identifikátory. Číselná data celých skutečných profilů nejsou doložená.

| Průchod | Pozorování | Mez důkazu |
|---|---|---|
| A: hubnutí, stabilní chůze | „Chceš zhubnout. Svižná chůze nebo kolo — 20 minut (dá se mluvit).“ Tři vysvětlení navázala na oblast; žádné slepení názvu cviku s větou o přínosu. | Srozumitelnost a chování rozhraní, nikoli správnost výpočtu nebo osobní vhodnost dávky. |
| A: Hotovo | Potvrzení dokončení. Po F5 se ukázal úvod „Co chceš řešit?“ a zůstal poslední vstup „Ano“. Nový cíl dostal denní HOLD; totéž po odhlášení/přihlášení. | Ruční průchod potvrzuje pozorované chování po návratu; nebyl proveden samostatný audit řádku v DB. |
| A: jiný dotaz / zítřek | Angličtina odmítnuta jako nepodporovaná. Odpověď na zítřek původně neurčitá; aktualizován text a následně přímé směrování této otázky. | Obecná AI jazyková spolehlivost tím není plně ověřená. |
| B: nejistá chůze, sílové odpovědi Ano | Otázka na běžnou stabilitu → Ne → podporovaný stoj na jedné noze s otevřenýma očima. Trajektorie zmiňuje riziko pádu; mechanismus srozumitelný. | Bez odborného schválení dávky nebo provedení. |
| B: Přeskočit | „Dnešní dostupné akce jsi přeskočil. Zítra je vyhodnotím znovu.“ Stejné po F5 a opakovaném vstupu. | Skutečný návrat další den zatím neproběhl. |
| B: otázka na zítřek | Původně „Zatím nerozumím…“. Po PR #106 už zachovala stav přeskočení. | Ověřeno Josefem na devu v aktuálním dni. |
| B: synkopa | Nové hlášení vedlo k odmítnutí zátěže; přání zhubnout a F5 ho zachovaly. Po odhlášení se původně ztratilo. | Nalezená chyba, nikoli dřívější PASS pro plnou relaci. |
| B: po opravě ukládání | PR #107 ukládá hlášení a načítá je serverově. Josef po zopakování hlášení potvrdil odmítnutí; z kontextu jde o požadovaný návrat po přihlášení, nebylo znovu upřesněno provedení každého kroku. | Doložený přepis odmítnutí + izolované testy nové relace; žádné vlastní čtení jeho DB řádku. |
| B: po opravě pokračování rozhovoru | Po PR #108 a F5 Josef poslal správnou nápovědu na „Co Chytré já umí?“ namísto opakovaného odmítnutí. | Prokazuje otevřenou nápovědu, ne užitečnou zdravotní službu pro člověka se synkopou. |

Jednalo se o vedené průchody s opravami mezi jednotlivými kroky, ne o jediný nezávislý test bez nápovědy.

## Opravy uložené a nasazené

| PR | Změna |
|---|---|
| [#105](https://github.com/JosefCipera/chytreja-app/pull/105) | WHY bez opakování cíle; náhradní krok jmenuje původní oblast; jasnější dokončení a návrat zítra. |
| [#106](https://github.com/JosefCipera/chytreja-app/pull/106) | Otázky na zítřek s/bez diakritiky obcházejí klasifikátor; přibyl test, který zakáže jeho zavolání v tomto případě. Předchozí injektovaná klasifikace chybějící guard maskovala. |
| [#107](https://github.com/JosefCipera/chytreja-app/pull/107) | Původní hlášení zdravotní potíže se ukládá do existujícího symptoms a obnovuje pod autentizovaným UID. Chyba čtení/zápisu nepokračuje do doporučení. Starší neuložená hlášení nelze zpětně obnovit. |
| [#108](https://github.com/JosefCipera/chytreja-app/pull/108) | Odmítnuté téma odděleno od nahlášeného zdravotního omezení. Otázka o nemoci sama nevytváří osobní zdravotní fakt; explicitní hlášení zůstává. Nápověda, důvod omezení a jiné dotazy mohou pokračovat. Ovladače ke cviku se nezobrazují u vysvětlení rozsahu. |

## Poslední automatické ověření

Běhy před PR #108, stejné finální zdroje; izolovaná data a skutečný kód endpointu/enginu/rendereru. Veřejný katalogový snapshot z lokálního QA pracovního prostoru; žádné živé účty nebo zápisy do sdílené DB, placená AI volání ani test mikrofonu.

- 25/25 průchodů hubnutí.
- 10/10 průchodů změn v rozhovoru včetně návratu od nepodporovaného tématu, otázky o nemoci bez osobního hlášení, zachování skutečného hlášení a nové relace.
- 6/6 scénářů výpadků klasifikátoru a opakování.
- Testy textů včetně 160 kontrol trajektorie/mechanismu; testy pozitivních hlášení vs. otázky, hypotézy a třetí osoby.
- Testy autentizovaného UID, neúspěšného čtení/zápisu, zachování jiných údajů, deduplikace a skutečné vykreslovací funkce tlačítek.

Tyto sady neověřují klinickou vhodnost, dávky, všechny jazykové formulace, živou autentizaci ani hlasový přepis. Dva starší pomocné runnery zůstaly nepoužité kvůli zastaralému mocku / chybějícímu esmock; nebyly vydávané za prošlé. Pro ověřené chování byly použité aktuální izolované endpoint sady.

## Nejbližší kontroly — 19. 10. 2026 nebo při příštím skutečném návratu

1. **A po Hotovo:** použít stejný účet, bez resetu či změny hodin. Znovu otevřít aplikaci a zadat původní cíl. Očekávat nové vyhodnocení podle aktuálních údajů, ne trvale včerejší HOLD. Nevyžadovat předem určitý cvik.
2. **Přeskočení další den:** B už obsahuje synkopu, proto na něm není správné očekávat nový cvik. Použít pouze již existující, jednoznačně identifikovaný čistý testovací účet s předchozím přeskočením. Pokud takový není určený, skutečný průchod zůstává otevřený; izolovaná simulace ho nenahrazuje. Neodstraňovat zdravotní hlášení jen kvůli tomuto testu.
3. **B po synkopě:** zachovat hlášení. Nápověda a vysvětlení fungují, ale požadavek na pohybovou aktivitu nesmí zátěž znovu zpřístupnit. Tím se neřeší nabídka skutečně užitečné ne-cvičební pomoci pro tento profil.

U účtů si Josef před návratem ověří jejich názvy; v dokumentaci nepřiřazovat dnešní průchody ke starým testerům 134/140/143 odhadem. Nesbírat znovu celou sadu registrací.

## Stav přípravy tester1

Hotové je [zadání k omezenému testu rozhraní](TESTER1-ZADANI-2026-10-18.md). Klinické otázky ve [čtyřech vstupních doporučeních](FOUR-ENTRY-ACTIONS-CLINICAL-REVIEW-2026-10-14.md) tento den neuzavíral; tester cviky neprovádí a nehodnotí jejich vhodnost. [Starší připravenost](TESTER1-READINESS-2026-10-13.md) zůstává historickým podkladem, nikoli důvodem znovu opakovat všechny technické testy.

Doporučený další krok: skutečný návrat po Hotovo a výběr účtu pro čisté přeskočení; poté nezávislý krátký test srozumitelnosti. Zadání se předává jako test rozhraní, nikoli jako osobní zdravotní služba. Nové produktové téma je pomoc člověku, pro kterého dnes nelze zvolit pohybovou akci; samotná nápověda tuto hodnotu nenahrazuje.
