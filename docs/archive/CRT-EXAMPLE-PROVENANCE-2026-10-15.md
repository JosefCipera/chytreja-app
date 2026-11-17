# Původní CRT Kovářové — původ veřejného příkladu

Veřejný odkaz zůstává `/crt.html?vzor=kovarova`. Používá stávající Cytoscape renderer, pill overlays a interakční panel v `app/crt.html`.

## Nález v dokumentaci a historii

- `HANDBOOK.md`, oddíl „Dvě paralelní CRT generování“, popisuje lékové mapy a pill rendering; údaje o výchozí generovací cestě jsou stav z 30. 6., nikoli aktuální konfigurace.
- Commit `58e472bcc5b3b7fc63433cf8fc11cf8169304150` obsahuje plný uložený výsledek Kovářové: `data/crt/cache-backup/7MeCzqiyVWh9NOR0cRJOTMMWaJj1.json`.
- Tento výsledek má 19 uzlů, 22 hran a 16 záznamů v `medications_map`.
- Následující úpravy této zálohy (např. `0b607868e27e58b8c02443dfc4f364ca599c4ba7`) nahradily graf a vyprázdnily lékovou mapu. Proto nestačí vzít současnou zálohu nebo smoke snapshot.
- Dosavadní veřejný příklad z PR #84 používal smoke snapshot 14/14 bez léků. Tento export jej nahrazuje úplným historickým výsledkem.

## Rozsah exportu

`app/assets/examples/crt-kovarova.json` přebírá existující uzly, hrany, popisy a lékovou mapu. Neobsahuje UID, původní surový AI výstup, hash účtu ani profil z DB. Číselné souřadnice a osobní skóre nejsou potřebné pro aktuální renderer a nejsou exportovány. Topologie ani cíle léků nebyly přepsány.

Dva záznamy (Euthyrox a Dulopren) mají v tomto historickém výsledku cíle mimo uložené uzly. Zobrazení je otevřeně uvede pod grafem jako „Bez vazby v uloženém grafu“; nevymýšlí náhradní vazby.

## Interakce

Šest párů s existujícími texty se získává beze změny algoritmem `detectManualInteractions` z `api/rxnorm.js` nad současným `data/drugs.json` a jmény z archivované lékové mapy. Použity jsou pouze páry s existujícím `pair_notes` textem. Žádná AI, externí klinický API dotaz nebo nové doporučení.

Na grafu jsou léky a doplňky zapnuté od otevření. Pilulka se známou interakcí má značku ⚠, detail na hover a klávesnicí/kliknutím otevře stávající panel Interakce. Panel příkladu ukazuje všech šest známých párů; osobní režim zachovává dosavadní limit.

Jde o historický modelový příklad, nikoli současnou kontrolu léčby člověka. Nezapisuje do DB, nepoužívá účet návštěvníka a nemění pozastavený privacy audit PR #81.
