# Posouzení dodaného Claude auditu — 2026-10-13

Podklad: soubor předaný Josefem „Vložený markdown(20261013-172405).md“. Níže je vlastní omezená kontrola vybraných tvrzení, nikoli potvrzení auditu celého katalogu ani schválení dávek. V této práci nebyly měněny cviky, dávky, bezpečnostní brány ani živá uživatelská data.

## Co bylo ověřeno

- Odkazy na NICE NG147 v lokálním engine zdroji skutečně existují v activation, inference, nextBestAction a intervention-map. Oficiální NG147 se týká divertikulární nemoci: https://www.nice.org.uk/guidance/ng147 . Tuto citaci nelze používat jako podklad pro prevenci pádů.
- Oficiální NG194 je péče po porodu: https://www.nice.org.uk/guidance/ng194 . Nejde o podklad pro dávku funkčního silového cvičení.
- NG249 se týká pádů: https://www.nice.org.uk/guidance/ng249/chapter/Recommendations . Oprava čísla citace sama nepotvrzuje dosavadní tvrzení o triáži, TUG nebo předepisování pomůcek; každé tvrzení musí odpovídat konkrétnímu doporučení. Nepřepisovat NG147 na NG249 hromadně bez této kontroly.
- NG16 se skutečně zabývá prevencí demence, disability a frailty ve středním věku a obsahuje doporučení k pohybové aktivitě: https://www.nice.org.uk/guidance/ng16/chapter/Recommendations . Jeho omezený rozsah se nesmí zaměnit za nesouvisející směrnici; ani samotné obecné doporučení pohybu ovšem nedokládá konkrétní dávku vstávání ze židle.
- V aktuálním `data/engine/action-instructions.json` má vstávání ze židle upravený výsledný pokyn o pěti pomalých opakováních, pevné neklouzavé židli, pomoci o područky a zastavení při obtížích. Audit uvádí starší katalogové znění „u zdi“. Jeho komentáře proto ještě nejsou důkazem ověření výsledného textu aktuální verze.

## Co nepovažovat za schválené

- Kategorie „ponechat“ v dodaném auditu není klinické schválení. Zvlášť údajně nízké riziko grip cvičení a obecně srozumitelná chůze nenahrazují posouzení konkrétní dávky a uživatelských podmínek.
- Návrh začít jednonožný stoj na 10 s a pokračovat na 30/60 s nemá v dodaném auditu doložený zdroj pro právě takový tréninkový postup. Prognostický/testový práh není automaticky tréninková dávka. Nic z těchto čísel zde nebylo zavedeno do aplikace.
- Počty 71+3 pohybových položek ani úplnost katalogu nebyly v tomto posouzení nezávisle ověřeny. Chybí ID řádků, datum a hash veřejného snapshotu, přesná pravidla zařazení a vazba na dosažitelné větve enginu. Duplicitní název může být více protokolů; neposuzovat duplicitu pouze podle labelu.
- Bibliografické opravy Whelton/Ross/Willis/Rikli/Hunter a všechny přepisy abstraktů zatím nebyly v této dílčí kontrole jednotlivě ověřeny. Nezaměňovat Claudeovo hledání abstraktů za vlastní ověření plných textů či tabulek.

## Další zadání pro Clauda

Nejdřív dodat tabulku čtyř vstupních akcí: procházka 20 min, svižná chůze/kolo 20 min, vstávání ze židle 5×, stoj na jedné noze 30 s. Sloupce: ID akce, verze/snapshot, skutečný výsledný ACT včetně přepisu a bezpečnostních podmínek, vstupní předpoklady, původ a rozsah důkazu pro protokol, samostatný podklad pro dávku, návrh změny, neuzavřená otázka pro odborníka. Označit výslovně „zdroj dávku nestanovuje“ místo nahrazení jiným číslem podle vlastního odhadu.

Pro citace dodat oddělenou tabulku: umístění a tvrzení v kódu, současný odkaz, přesný relevantní bod navrhovaného zdroje, zda bod tvrzení podporuje, a navržená oprava. Kde zdroj tvrzení nepodporuje, navrhnout opravu tvrzení nebo označit chybějící důkaz; nestačí nový odkaz.

Zatím nic neupravovat ani nenasazovat. Audit je užitečný podklad, ale podmínka vhodnosti cviků a dávek v [připravenosti tester1](TESTER1-READINESS-2026-10-13.md) zůstává otevřená. Prioritou jsou čtyři dosažitelné vstupní akce, nikoli rozsáhlé přepisování celého katalogu bez uzavřených pravidel.
