# CRT: kombinace a celé rozhovory — 12. 10. 2026

## Rozsah a očekávání

Základ aplikace: main `72d5bc94cf80e361a84ba426c38b437ced69f296`. Veškeré profily a zápisy jsou syntetické. Žádný skutečný účet se nečetl, neměnil ani neresetoval.

Pět současných otázek onboardingu dává 32 binárních kombinací. Test přidává dva profily (muž, rok 1959, 178 cm; 72 kg / pas 84 cm nebo 88 kg / pas 99 cm), dva požadavky, tři možné odpovědi na případnou otázku stability a dvě větve dokončení/přeskočení. Celkem 768 průchodů nad 64 profily; některé větve se shodují, pokud otázka nebo akce nenastane. Změna věku, pohlaví, dalších diagnóz a omezení zde není kombinatoricky pokryta.

| Požadavek na správnost | Co automat hlídá |
|---|---|
| Zachovat vstup | Pět původních odpovědí a skutečný požadavek, bez vymyšlených diagnóz či měření |
| Doložit závěr | Svalová větev uvádí příslušné záporné odpovědi; nejistota chůze je self-report; přání hubnout není měření tuku |
| Navázat na CRT | Páka má evidenci, všechny vystavené kauzální hrany a dosažené cíle existují v modelu; intervence patří k dané páce |
| Vysvětlit | Proč neobrací kladné odpovědi na záporné; budoucnost popisuje možnost a zvolenou větev; vysvětlení nepřidává zápisy ani nový výpočet |
| Dokončit | Jedno Hotovo, žádný dvojitý zápis, ukončená nabídka při návratu |
| Přeskočit | Bez opakování známého ekvivalentu a bez zvýšení tieru či porovnatelné dávky/intenzity v téže intervenci; ohraničený průchod |
| Zachovat bezpečnost a ovládání | Blokace není obejita; psaní, odeslání a mikrofon zůstávají dostupné po nekrizových odpovědích |

Relevantní modelové cesty: `LOW_MUSCLE_STRENGTH → REDUCED_FUNCTIONAL_RESERVE → LOSS_OF_FLOOR_RISE_ABILITY`; `GAIT_INSTABILITY → FALL_RISK`; metabolická větev `EXCESS_ADIPOSITY → INSULIN_RESISTANCE → … → CARDIOVASCULAR_DISEASE`. Test ověřuje návaznost podle současného grafu, nikoli medicínskou pravdivost každé hrany.

## Co automat skutečně zachytil a co se opravilo

První úplný průchod: 706 PASS, 62 FAIL, žádný BLOCKED. Všech 62 selhání bylo stejného druhu: nabídka „Svižná chůze nebo kolo“ a vysvětlení přínosu začínající „Rychlá chůze“. Předmět věty je nyní „Tato aktivita“, aby odpovídal oběma možnostem.

Po opravě: lokální snapshot 768 PASS, 0 FAIL, 0 BLOCKED. Katalog 152 aktivních akcí, SHA-256 `2f7effafdfb682138862e27d97f1a6a9a901d0ba641c0404228c545f3d157384`. CI dále ověřuje aktuální veřejný katalog a uchovává přesnou kopii i přehled výsledků. Následná kontrola zdrojové evidence doplnila soulad poznámek s aktuálními otázkami: nákup 5 kg do druhého patra a malé dítě, bez domyšlených 10+ kg. Nemění to aktivaci, výběr páky, bezpečnost ani dávku.

## Produktové otázky, které PASS nerozhoduje

| Syntetický příklad | Současný výsledek | Co je třeba posoudit |
|---|---|---|
| Tři silové odpovědi Ano, pády Ne, oči Ne; 72 kg; „Jsem nejistý při chůzi“ | Priorita chůze; podpořený stoj na jedné noze 30 s; funkční vysvětlení a dokončení | Vhodnost konkrétního protokolu a dávky není touto softwarovou sadou schválena |
| Stejné funkční odpovědi, ale 88 kg / pas 99 cm; stejný požadavek | Priorita tuku → otázka na stabilitu → po Ne blokace aktivit založených na chůzi | Model vybírá systémovou prioritu podle svého grafu; uživatel však žádal řešit chůzi. Potřebujeme výslovné rozhodnutí o politice priorit a další pomoci při blokaci |
| 72 kg, silové odpovědi Ano, žádná aktivní páka; „Chci zhubnout“ | Otázka na klinický kontext | Nenutíme doporučení bez podkladů. Tyto dosud nesimulované odpovědi jsou k doplnění další sadou, nikoli hotový uzavřený rozhovor |

V lokální sadě požadavek na chůzi vybral tuk u všech 32 profilů s vyšší hmotností. Celkem 54 kombinací profil × požadavek dospělo k assessment blokaci; tři zůstaly u nesimulovaného klinického kontextu. Počty jsou z této omezené syntetické sady, nikoli odhad chování všech uživatelů.

Návrh dalšího rozhodnutí: zachovat systémovou prioritu transparentní a odlišit ji od aktuálního požadavku. Pokud její akce není přípustná, určit v modelu, zda smí engine hledat další vhodnou intervenční větev. Alternativu musí projít stejná bezpečnostní a evidenční pravidla; AI nesmí jen vymyslet náhradní cvik ani potvrdit klinickou vhodnost. Toto pravidlo zatím nebylo přidáno do aplikace.

## Hranice

Kombinatorická sada používá injektované záměry, bez nákladů na 768 AI volání. Oddělené live sady zachovávají ověřování skutečné AI. Onboarding, endpoint a renderer jsou reálný zdrojový kód v izolovaném API/DOM modelu, nikoli skutečná registrace v prohlížeči. Neověřuje hlasový přepis, layout, reálnou autentizaci, klinickou účinnost, vhodnost všech protokolů ani všechny domény. Bez vyřešení produktových a protokolových otázek není PASS prohlášením připravenosti pro tester1.

