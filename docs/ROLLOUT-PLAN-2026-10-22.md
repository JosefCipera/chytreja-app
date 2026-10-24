# Fáze zpřístupnění Chytrého já (návrh, 22. 10. 2026)

Stav: **návrh k potvrzení.** Vychází z domluvy s Josefem: začít Diskutérem, co nejdřív dát Testeru 1, pak věrným přátelům zdarma, poté Zakladatelům a nakonec zákazníkům. Každé kolo musí přinést viditelný posun, ne další rozšiřování modelu. Navazuje na `docs/TESTER1-READINESS-2026-10-13.md`, `docs/CHECKPOINT-2026-10-18-APP-TESTING.md` a `docs/CHJ-ARCHITECTURE-DRAFT-2026-10-22.md`. Právní body jsou upozornění, ne právní rada.

## Skupiny a co dostanou
| Fáze | Skupina | Co dostanou | Co **nedostanou / neslibujeme** |
|---|---|---|---|
| 0 | **Tester 1** | omezený test srozumitelnosti Diskutéra (zadání z 18. 10.) | samostatné používání zdravotních doporučení, provádění cviků na smyšleném profilu |
| 1 | **Přátelé CHJ** (zdarma, pozvaní) | Diskutér v dnešním rozsahu: pohyb, nadváha, síla, rovnováha; mimo rozsah slušné odmítnutí | cukrovka, ED, srdce a jiné oblasti; CRT a Vesmír; status Zakladatele |
| 2 | **Zakladatelé** | podle nabídky (návrh: jednorázová cena, přístup po dobu provozu služby, TOC a BMC po zpřístupnění); stav bude určen až před touto fází | cokoli, co v nabídce nebude výslovně napsáno |
| 3 | **Zákazníci** | veřejná nabídka | |

Pojem „Zakladatel zdarma" se nepoužívá, dokud není napsáno, co znamená po skončení bezplatného období. Přátelé CHJ jsou **jiná skupina** než placení Zakladatelé.

## Podmínky vstupu do další fáze
**Do fáze 0 (Tester 1):**
- skutečný návrat další den po „Hotovo" (jeden cílený krok, ne nový účet),
- jedna diktovaná věta na telefonu (hlas se do té doby neslibuje jako ověřený),
- zadání se předává jako test rozhraní.

**Do fáze 1 (přátelé):**
1. Odborník (fyzioterapeut) uzavřel dávky a podmínky zastavení čtyř vstupních akcí; do té doby jen test srozumitelnosti bez provádění cviků, nebo jen akce s uzavřenými dávkami. Seznam otázek: `docs/domain-packs/STABILITY.md`, `docs/FOUR-ENTRY-ACTIONS-CLINICAL-REVIEW-2026-10-14.md`.
2. Souhlas se zpracováním údajů o zdraví, zásady ochrany údajů (stránka existuje) a přehled zpracovatelů (databáze, přihlášení, AI, hlas). Právní kontrola je na Josefovi.
3. Rozsah je zmrazen a v pozvánce stojí otevřeně, co aplikace zatím řeší a co ne.
4. Přátelé jsou skutečné účty: **nikdy do `TESTER_UIDS`** a nikdy se na nich nepoužívá reset.
5. Je určen způsob sběru zpětné vazby a kdo ji vyhodnocuje.
6. Pozvánka neslibuje nic o CRT, Vesmíru ani Zakladatelské nabídce.
7. Odborník prošel i **kauzální řezy**, které aplikace říká v „Proč?" a „Kam směřuješ?" (stabilita, kardiometabolický řetěz): hrana, zdroj, souhlasím / nesouhlasím / doplnit. Model psal jazykový model pod Josefovým vedením a nezávislou kontrolu zatím nikdo neprovedl.

**Do fáze 2 (Zakladatelé):** výsledky fáze 1; napsaná nabídka a podmínky, včetně toho, co se stane po bezplatném období; stav TOC a BMC; rozhodnutí o Vesmíru.

**Do fáze 3 (zákazníci):** platební a obchodní podmínky, podpora, a zbývající body z bezpečnostního programu z `CLAUDE.md` (mock cesta v `crt-generate.js`, zpřísnění `tester-reset.js`, úklid oprávnění, test obnovy zálohy databáze).

## Kontrolní seznam: „slušně použitelné" (fáze 1)
Slušně použitelné znamená **důvěryhodné, srozumitelné a bezpečné v tom, co aplikace říká**, ne že umí všechno. Další řetězce (cukrovka, štítná žláza, srdce) k tomu nepatří.

| # | Co | Kdo | Závisí na |
|---|---|---|---|
| 1 | Posouzení dávek a podmínek zastavení čtyř vstupních akcí | fyzioterapeut | externí osoba; **nejdelší článek** |
| 2 | Skutečný návrat další den po „Hotovo" | Josef | jeden cílený krok na stávajícím tester účtu |
| 3 | Jedna diktovaná věta na telefonu (přepis, odpověď, návrat) | Josef | podporované zařízení |
| 4 | Srozumitelnost „Proč?": „nadváha" místo „množství tělesného tuku" a věta, že téma zůstává důležité | Claude navrhne, Josef schválí | změna textu v zamčeném `orchestrator.js` a testech |
| 5 | Srozumitelnost „Kam směřuješ?" u nestability (dnes končí „může se ti zvyšovat riziko, že upadneš") | Josef, pak Claude | rozhodnutí o hraně `FALL_RISK` → ztráta soběstačnosti a zdrojích |
| 6 | Souhlas, zásady ochrany údajů, přehled zpracovatelů | Josef (právní kontrola) | |
| 7 | Pozvánka s výslovným rozsahem („zatím pohyb, nadváha, síla a rovnováha") | Josef | |
| 8 | Odborná kontrola kauzálních řezů, které aplikace říká | lékař, fyzioterapeut | viz podmínka 7 výše |
| 9 | Počítadlo **odmítnutých témat**: ukládat jen kategorii, ne text ani osobní údaje | Claude navrhne, Josef schválí | zásady ochrany údajů; slouží k výběru dalšího řetězce |

**Volitelně před skupinou s tlakem a cholesterolem:** dvě mezery v enginu. Dyslipidémie a inzulinová rezistence jsou uzly modelu, ale engine u nich z diagnózy stav nezaloží (viz prototyp v PR #119). Jde o změnu v zamčeném enginu; rozhodnutí je samostatné.

**Další řetězec se vybírá podle toho, na co se lidé v prvním kole skutečně ptali a bylo odmítnuto**, ne podle domněnky.

## Pravidlo pro přidávání věcí mezi fázemi
- Jedno kolo přináší **jednu viditelnou věc** (například srozumitelnější „Proč?" s nadváhou místo „tělesný tuk", cesta „pád → soběstačnost", další balíček).
- Otázka nebo uzel se přidá jen tehdy, když změní rozhodnutí o constraintu (principy 1–5 z `CLAUDE.md`).
- Nic nového se nepřidává do modelu bez důkazu, že chybí významná cesta.
- Co je mimo rozsah, Diskutér slušně odmítne; pozvánka to říká předem.

## Otevřená rozhodnutí (Josef)
1. Co znamená přístup přátel po testu: omezené období, trvalý zdarma, nebo přechod na nabídku Zakladatelů (podmínky).
2. Kdo je první skupina přátel a kolik lidí (návrh: malá skupina, aby šlo reagovat na zpětnou vazbu).
3. Termín konzultace s fyzioterapeutem (podmínka 1 do fáze 1).
4. Kdy a v jaké podobě zpřístupnit Vesmír a CRT (zatím odloženo).
