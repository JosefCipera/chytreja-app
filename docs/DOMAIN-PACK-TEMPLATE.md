# Šablona balíčku oblasti (domain pack)

Nová oblast (stabilita, cukrovka, srdce, ...) se do Chytrého já přidává jako **balíček dat a pravidel**, ne jako nový agent. Engine, bezpečnostní brány a způsob vysvětlování zůstávají jedny. Jeden soubor `docs/domain-packs/<OBLAST>.md` vyplňuje tuto šablonu a je jediným místem, kde je vidět, v jakém stavu oblast je.

## Hranice produktu (rozhodnutí Josefa, 20. 10. 2026)
- Chytré já řeší **dlouhověkost a zdraví tak, jak je popisuje model příčin (`data/engine/master.json`)**: co člověku nejpravděpodobněji vezme roky života nebo soběstačnosti. Cukrovka, ED a další oblasti budou součástí dlouhověkosti a zdraví. Přidávají se postupně jako balíčky podle modelu příčin.
- Cílová skupina jsou **starší lidé** (referenční model Kovářová); aplikace jim **tyká**.
- Co do rámce nepatří, Chytré já **neřeší**. Pokud se někdo přesto zeptá, **slušně odpoví, že to neřeší**, bez diagnózy a bez improvizace. Chceme se vyhnout směru obecného zdravotního software.
- Každý balíček proto musí mít v kroku 1 výslovně napsáno, co **řeší** a co **ne**.

## Pravidla (platí pro každý balíček)
1. **Nevymýšlej příčinné vazby.** Vycházej z hotových cest v `data/engine/master.json`. Chybí-li významná cesta, je to samostatné rozhodnutí o rozšíření modelu s důkazem, ne součást balíčku.
2. **Otázka vzniká jen tehdy, když její odpověď může změnit výběr, pořadí nebo ověření constraintu.** Zdravotní zajímavost nestačí.
3. **Dávka a podmínky zastavení potřebují zdroj.** Pokud zdroj dávku nestanovuje, napiš „**zdroj dávku nestanovuje**" a označ krok „vyžaduje odborné posouzení". Nenahrazuj ho jiným číslem.
4. **Prognostický práh není tréninková dávka.** Test (například doba stoje na jedné noze) nelze bez dalšího převést na cvičení.
5. **Každé tvrzení v kódu má přesný zdroj** (dokument + bod, který ho podporuje) nebo je označené jako interní pravidlo. Odkaz na nerelevantní dokument je chyba.
6. **Bezpečnost je před prioritou.** Bezpečnostní brána se neobchází a prezentace nemění význam rozhodnutí.
7. **AI nerozhoduje, vysvětluje.** Texty vycházejí z tabulek; nevymýšlí diagnózu, riziko ani účinek.
8. **Žádné ruční testování nové nemoci na novém účtu.** Ověřuje se syntetickými profily a referenčními případy; lidé posuzují srozumitelnost a důvěru.

## Stavy
`HOTOVO` · `ČÁSTEČNĚ` · `OTEVŘENO` · `VYŽADUJE ODBORNÍKA` · `NEVÍME` (chybí zdroj nebo přístup; uveď co)

## Osm kroků

| # | Krok | Výstup (co musí být napsáno) | Kdo |
|---|---|---|---|
| 1 | **Rozsah** | Co oblast řeší a co ne (diagnóza, akutní stav, léčba). Cílová populace. Hranice, kdy posílá k odborníkovi. | Josef + Claude |
| 2 | **Větev z modelu příčin** | Uzly, vazby (odkazem na `master.json`), Goal Gateway, kterých se oblast dotýká. Žádné nové vazby. | Claude, kontrola Josef |
| 3 | **Vstupy a aktivace** | Které údaje oblast potřebuje, jak aktivují uzly (síla signálu, práh), které otázky mění rozhodnutí a které ne. | Claude |
| 4 | **Mapa intervencí** | Pro každý vedoucí uzel: intervence, protokoly, mechanismy (`mechanism_targets`). | Claude |
| 5 | **Akce a bezpečnost** | Pro každou akci: pokyn, vstupní náročnost, potřebná opora, podmínky zastavení, dávka a zdroj dávky. Bezpečnostní brány a jejich pravidla. | Claude navrhne, **odborník schválí** |
| 6 | **Slovník vysvětlení** | Lidské formulace pro „Proč?", „Kam to směřuje?", „Co tím změním?". Bez zakázaných slov. | Claude, schválí Josef |
| 7 | **Automatické testy** | Syntetické profily, kolize s jinými oblastmi, referenční případy (Josef, Kovářová), kontrola brány a textů. | Claude |
| 8 | **Ruční ověření** | Srozumitelnost a důvěra jedním průchodem; ne testování každé nemoci. | Josef, testeři |

## Kontrolní seznam „hotovo"
- [ ] Každá vazba odkazuje na `master.json`; nic navíc.
- [ ] Každá aktivace má popsanou sílu signálu a práh.
- [ ] Každá akce má pokyn, oporu, podmínky zastavení, dávku a zdroj dávky, nebo výslovně „zdroj dávku nestanovuje".
- [ ] Každý odkaz na zdroj je ověřený (správný dokument, správný bod).
- [ ] Bezpečnostní brána pokrývá všechny akce balíčku.
- [ ] Texty jsou v tabulkách a neobsahují zakázaná slova ani diagnózy.
- [ ] Testy: syntetická matice, kolize s ostatními oblastmi, referenční případy.
- [ ] Odborník schválil dávky a podmínky zastavení (nebo je krok označen `VYŽADUJE ODBORNÍKA`).
- [ ] Josef potvrdil rozsah a slovník.
- [ ] Je jasné, co **není** podporováno, a aplikace to říká.

## Šablona souboru oblasti
```
# Balíček: <OBLAST>
Stav: <shrnutí> · Datum · Verze main

## Přehled stavu
| Krok | Stav | Poznámka |

## 1 Rozsah
## 2 Větev z modelu příčin
## 3 Vstupy a aktivace
## 4 Mapa intervencí
## 5 Akce a bezpečnost
## 6 Slovník
## 7 Testy
## 8 Ruční ověření
## Otevřená rozhodnutí
## Otázky pro odborníka
```
