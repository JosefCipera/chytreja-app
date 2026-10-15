# Klikací ukázka pro Zakladatele

Samostatná statická cesta `/ukazka/`, otevřená ze stránky Zakladatelů. Používá schválený vzhled odděleného soukromého archivu (základ `ad44b0f7ef712ae01b3c2eeda336a623d3fb2e6b`), nikoli dnešní aplikační renderer. Zdroje v `archive-originals/` jsou přiložené pro opakovatelné sestavení.

## Sestavení a kontrola

Z kořene repozitáře:

```sh
python scripts/founders-demo/build-archive.py
node --experimental-vm-modules scripts/founders-demo/check-archive.cjs
```

Výstup je v `app/ukazka/`. Není potřeba databáze, klíč, účet, instalace závislostí ani volání AI. Nespouští se SQL; z historických migračních souborů se čtou jen doslovné texty katalogu.

## Zdroj dat a hranice

- CRT Kovářové: renderer `v0.2-crt-gold-kovarova`, commit `f9a82e228581afa2db781b90141cbc0602fd6038`.
- CRT Josefa a Vesmír/HUD: `v0.3-crt-gold-josef`, commit `e616bcd8a4ee87608aac7c284368f60bf2e2e58e`.
- Uložené sanitizované CRT: revize `58e472bcc5b3b7fc63433cf8fc11cf8169304150`, 19/14 uzlů a 16/8 položek léků. Nejde o DB snapshot ze stejného data jako renderer ani o potvrzení posledního klinického stavu.
- Vesmír: všech 40 popisů je z původního modelu. 70 akcí v 29 oblastech je doslovně převzatých z původního katalogu v migracích a seed skriptu. Jde o příklady katalogu, nikoli o výstup výběrového enginu, bezpečnostní posouzení ani osobní doporučení. U dalších uzlů je dostupný popis a informace o chybějící ukázkové akci. Akce se nespouštějí a nelze je označit Hotovo.
- Osobní baterie a trendy nejsou doložené, proto je ukázka nezobrazuje. Počáteční společný testovací plank a dvě neověřené citace nejsou napojené do zobrazovaných dat. Zobrazené lékové vazby CRT se nově klinicky neověřují ani nepřepočítávají.
- HUD používá původní komponenty; v samostatné kopii distribučního JS se mění jen zdroj dat a označení oblasti/režimu. Původní soubory jsou zachované. Doplňkové CSS upravuje šířku, zalamování a skrývá osobní metriky i provádění katalogových akcí. Barvy Vesmíru rozlišují kategorie a nejsou osobním semaforem rizika.
- CSP blokuje všechna API volání (`connect-src 'none'`). Přihlášení, ukládání, Firebase, Supabase, AI, servisní worker ani přístup k datům přihlášeného účtu se při startu nepoužívají. Trasy současné aplikace, engine a onboarding se nemění.

## Ověření

VM kontrola spouští skutečnou inicializaci rendererů se zachytávacím DOM/canvas/vis adaptérem pro šířky 1280/390. Kontroluje léky, barvy, kliknutí na panel, otevření podsítě, návrat, per-node obsah, provenienci všech 70 akcí a odmítá síťové nebo účetní úložiště. To není screenshot test skutečného prohlížeče. Interakce léků a čitelnost na skutečném zařízení musí být dále vizuálně ověřovány.

`PROVENANCE.json` ve výstupu obsahuje revize rendererů, `content-provenance.json` původ konkrétních akcí. Uživatel se vrací na `/zakladatele/#pod-povrch`. Žádné platby ani zprávy se neodesílají.

## Rozšíření katalogu a otočení obrazovky

Ukázka nyní nabízí 70 původních akcí v 29 oblastech a 73 původních článků v 16 oblastech. Další akce jsou v rozbalovacím katalogu u příslušného uzlu; články lze otevřít z původních karet HUD do čtečky s návratem. Původní seed skript se nespouští, pouze se z něj čtou doslovné labely. Přesun step_down/jump_squat/box_jump k plyometrii respektuje původní migraci `add_plyometrie_node.sql`. Texty se reprodukují jako archivní obsah CHJ, ne jako odborně ověřené nebo osobně vybrané doporučení.

CRT při startu naplní data pro přepočet po otočení. Resize/orientation události jsou sloučené krátkou prodlevou. Vesmír přepočítá rozložení aktuální podsítě, historii ani otevřenou oblast nezahazuje. Na nízkém displeji naležato je horní rozcestník kompaktnější. VM kontrola vyvolává obě události a ověřuje novou síť bez sítě/úložiště účtu. Skutečné otočení fyzického telefonu se nedá z tohoto prostředí ověřit.
