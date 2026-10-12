# Dostupná akční větev při blokaci hlavní priority — 12. 10. 2026

Schválené produktové zadání: když první priorita nemá přípustnou akci, prověřit další vhodnou větev při zachování bezpečnosti. Implementace vychází z main `24cc81376f81745191a8afd873674f6cb56e0fc9`.

## Pravidlo

Původní systémová priorita a její pořadí se nemění. Jinou akční větev hledáme pouze při Daily Decision `SAFETY_BLOCKED`: všechny kandidátní akce první větve jsou podle dosavadní Safety Gate kontraindikované nebo vyžadují klinické posouzení. Pokud engine potřebuje podklady či odpověď, nejdříve se ptá. `SAFETY_CRITICAL`, aktivní doporučení, dokončení, vyčerpání přeskočených akcí a chybějící model nejsou důvodem přeskočit do jiné větve.

Alternativy musí mít skutečný aktivní stav, kauzální dosah a existující intervenční mapování. Zkoušejí se ve stejném pořadí jako dosavadní alternativy (cross-context leverage, causal reach, changeability). Každá projde dosavadním NBA a Daily Decision se stejnými zdravotními údaji, omezeními, všemi uzly, historií a dnešními přeskočeními. Žádné pravidlo kontraindikace ani požadavek na důkaz se nemaže. Jestliže přípustná alternativa není, zachová se původní blokace.

Dokončená nebo vyčerpaná alternativní větev ukončí dnešní nabídku; hledání nepokračuje k další větvi jen proto, aby po Hotovo/Přeskočit znovu nabídlo akci.

## Oddělení priority a dnešního kroku

| Pole | Význam |
|---|---|
| `system_leverage` | Původní systémová priorita a původní pořadí |
| `action_leverage` | Větev, která skutečně podporuje aktuální akci |
| `action_fallback` | Původní blokovaná odpověď, důvod a zkoušené alternativy |
| cached `system_priority` | Původní priorita pro vysvětlení |
| cached `system_leverage` | Dosavadní prezentační klíč, nyní odpovídá skutečné akční větvi |

Proč vysvětlí blokaci původní priority a zdroj evidence nového kroku. Budoucnost, mechanismus, goal gateways a uložené `selected_leverage_node` navazují na skutečnou akční větev. Čtení vysvětlení zůstává bez nového AI/engine výpočtu a bez zápisů.

## Ověření

V izolovaném tester143-shaped profilu s nadváhou, nejistotou chůze a třemi kladnými silovými odpověďmi: otázka stability → Ne → původní blokace chůze bez opory zůstává → existující podpořená rovnovážná akce projde dosavadním Safety Gate → Proč vysvětlí přesun. Raw Ne ani self-report nejistoty se nepřepíše na klinické potvrzení bezpečnosti.

Lokální veřejný snapshot (152 akcí, SHA-256 `2f7effafdfb682138862e27d97f1a6a9a901d0ba641c0404228c545f3d157384`):

- 768 kombinačních průchodů PASS, 0 FAIL, 0 BLOCKED.
- 25 endpointových a 25 chůzových průchodů PASS.
- 322 průchodů použilo prověřenou alternativu; 54 různých dvojic profil × požadavek. 49 dvojic vedlo do svalové větve, pět do rovnováhy/chůze.
- Tři dvojice zatím čekají na nesimulovaný klinický kontext. Toto není uzavřený rozhovor ani klinické schválení.
- Samostatná regrese pokrývá krizový override, nezodpovězenou evidenci, aktivní původní akci, původní i alternativní dokončení, vyčerpání přeskočení, pořadí a všechny nepřípustné alternativy.
- Následné „Mám synkopu“ zruší nabídku; „Chci zhubnout“ tuto zdravotní stopku neobejde.
- Wizard a engine používají stejné syntetické údaje o výšce, hmotnosti, pohlaví a pasu; test nepoužívá pevné hodnoty pro všechny profily.

CI prověřuje aktuální veřejný katalog a odděleně skutečný AI klasifikátor. Žádný skutečný uživatelský účet nebyl čten, upraven ani resetován; všechny privátní tabulky a zápisy jsou pouze v paměti testeru.

## Klinická hranice

Toto je pravidlo dostupnosti v aplikaci, nikoli nová diagnóza, určení dávky nebo potvrzení vhodnosti cviku. Katalogové instrukce a Safety Gate zůstaly beze změny. Jejich samostatná odborná revize tím není nahrazena. NICE NG249, doporučení 1.3.10, požaduje u programů prevence pádů přizpůsobení potřebám a schopnostem člověka a odpovídající odborné vedení; toto doporučení nepotvrzuje náš algoritmus ani katalogový stoj 30 sekund.

Zdroj: [NICE NG249 — Recommendations](https://www.nice.org.uk/guidance/ng249/chapter/recommendations). Skutečná registrace, autentizace, hlasový přepis a layout prohlížeče zůstávají mimo tuto izolovanou sadu.

