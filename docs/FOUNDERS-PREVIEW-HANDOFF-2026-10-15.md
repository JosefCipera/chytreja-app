# Předání: ukázka pro Zakladatele — 15. 10. 2026

## Kde zítra začít

Nejdřív společně projít aktuální dev a otočení mobilu. Potom upravit nabídku Zakladatelů směrem k Mafia Offer: konkrétní přínos, přesný obsah a věrohodný důvod rozhodnout se. Mediotéku uživatel navrhl jako možný další doplněk; její integrace zatím není odsouhlasená ani provedená. Dnes končíme zálohou a dokumentací, nikoli dalšími úpravami produktu.

- Nabídka a vstupy: https://dev.iting.cz/zakladatele/#pod-povrch
- Klikací ukázka: https://dev.iting.cz/ukazka/#vesmir
- Přepínače: CRT Kovářová, CRT Josef, Vesmír Dlouhověkosti.
- Z ukázky vede návrat přímo do sekce nabídky.

## Záloha a obnovení

- Repozitář: JosefCipera/chytreja-app.
- Zálohovací větev: `backup/founders-preview-2026-10-15`.
- Přesný funkční stav kódu: `6bceb8e9604114e4ccf45d7855a330fbb48e6d47` (main po PR #87).
- PR #86: samostatná ukázka a tři vstupy ze stránky Zakladatelů.
- PR #87: změna orientace/rozměrů, rozšířený katalog a články.
- Toto předání přidává pouze dokumentaci. Zdrojová verze aplikace zůstává stejná.
- Při obnově vytvořit novou pracovní větev z uvedeného SHA, porovnat s aktuálním main a přenést potřebné změny přes PR. Nepřepisovat main ani nevracet dnešní aplikaci plošně na historický tag.
- Jde o zálohu kódu a přiložených statických vzorů. Dnes nebyla vytvořena nová záloha živé DB, účtů nebo nastavení poskytovatelů.

## Co je hotové

Ukázka je izolovaná v `app/ukazka/`. Stránka Zakladatelů odkazuje na oba plné CRT a Vesmír; původní zjednodušený výřez byl odstraněn. Přihlášení, onboarding, aktuální doporučovací engine a jeho API se v PR #86/#87 neměnily.

Grafika CRT vychází z dochovaných gold verzí: Kovářová `v0.2-crt-gold-kovarova`, Josef a Vesmír/HUD `v0.3-crt-gold-josef`. Jsou zobrazené uložené léky a původní vazby/interakce. Uživatel vzhled obou CRT schválil. Nejde o potvrzení posledního klinického stavu ani o nové posouzení interakcí.

Vesmír má 40 popisů, 70 původních katalogových akcí v 29 oblastech a 73 původních článků v 16 oblastech. HUD nabízí hlavní příklad a rozbalovací seznam dalších akcí. Karty článků otevírají místní čtečku s návratem do grafu. Obsah pochází z připnutých historických souborů; seed skripty a SQL se nespouštějí.

Akce jsou pouze příklady katalogu, nelze je provádět nebo označovat Hotovo. Nepřipojuje se účet, AI ani DB; CSP blokuje API. Nedoložené osobní baterie a trendy jsou skryté, společný testovací plank ani neověřené testovací citace se nezobrazují. Barvy uzlů jsou rozlišením kategorií, nikoli osobním vyhodnocením rizika.

HUD je přisazený vpravo, má pružnou šířku a zalamování textu. Uživatel chtěl světlejší a výraznější barvy, zejména červenou a žlutou; aktuální stav znovu vizuálně posoudit před dalšími zásahy.

## Mobil a ověření

Uživatel ukázku vyzkoušel na mobilu a označil ji za celkem v pořádku. Nahlásil potřebu reagovat na otočení o 90°.

Oprava v PR #87:
- CRT dostane při startu data, která potřebuje jeho obsluha změny rozměrů.
- Události resize/orientation jsou sloučené krátkou prodlevou.
- Vesmír přepočítá aktuální podsíť bez zahození historie či otevřené oblasti.
- Na nízkém displeji naležato je rozcestník kompaktnější.

Prošly offline VM kontroly pro šířky 1280/390, syntetické otočení na 844×390 a návrat, zachování podsítě, původ léků/akcí, rozbalení katalogu, bezpečné otevření čtečky a izolace od sítě/úložiště účtu. Živě v desktopovém prohlížeči byly ověřeny oba CRT, odlišné akce podle uzlu, rozbalovací katalog, článek Stoletý desetibojař a návrat. Vercel develop hlásil úspěšné nasazení.

Skutečné fyzické otočení telefonu po PR #87 ještě uživatel nepotvrdil. Zítra začít obnovením stránky a touto kontrolou; netvrdit, že je už hotová.

## Zdroje a další práce

- Reprodukovatelné sestavení, původní soubory a test: `scripts/founders-demo/`.
- Návod a hranice: `scripts/founders-demo/README.md`.
- Výstupní původ akcí: `app/ukazka/content-provenance.json`.
- Mediotéka existuje v aktuálním repu: `app/medioteka.html`, `app/js/universe/medioteka.js`, `app/css/medioteka.css`, `data/medioteka.json`. Zatím byly ověřené jen cesty, nikoli její aktuální funkčnost, obsah či vhodnost k nabídce. Obnovovat skutečnou existující Mediotéku, nevymýšlet její náhradu.

Zítřejší směr:
1. Projít mobil/rotaci a obsah nejdůležitějších uzlů desetibojaře.
2. Z nabídky udělat ucelenou Mafia Offer; nesklouznout k seznamu funkcí. Zachovat příběh a skutečné ukázky.
3. Posoudit Mediotéku jako doplněk a teprve pak rozhodnout o začlenění.
4. Pozdější osobní propojení: dnešní krok → CRT přes „Proč?“ → Vesmír jako širší přehled, vše nad stejnými daty a enginem. Toto úplné propojení není hotové a ukázka ho nenahrazuje.

Cena v nabídce zůstává 9 900 Kč s DPH jednorázově, bez předplatného, prvních 200 Zakladatelů; změny rozsahu/slibů ani zahájení plateb dnes nejsou provedené. Privacy audit PR #81 zůstává výslovně pozastavený.
