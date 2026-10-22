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

**Do fáze 2 (Zakladatelé):** výsledky fáze 1; napsaná nabídka a podmínky, včetně toho, co se stane po bezplatném období; stav TOC a BMC; rozhodnutí o Vesmíru.

**Do fáze 3 (zákazníci):** platební a obchodní podmínky, podpora, a zbývající body z bezpečnostního programu z `CLAUDE.md` (mock cesta v `crt-generate.js`, zpřísnění `tester-reset.js`, úklid oprávnění, test obnovy zálohy databáze).

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
