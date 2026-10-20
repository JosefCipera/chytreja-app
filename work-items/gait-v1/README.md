# Pilot agenta: nejistota při chůzi

**Závazné zadání:** [contract.json](contract.json), verze 1. Schválený záměr Josefa z 18. 10. 2026: jedna oblast od zadání po připravený výsledek; Josef ji přebírá vlastními údaji a slovy. Žádné další operativní zadávání jednotlivých kliknutí.

## Kdo co dělá

- Codex vede práci, provádí ohraničené opravy, kontroluje důkazy a připravuje kandidáta. Nepřepisuje kvůli tomuto pilotu landing ani jiné oblasti.
- Existující tester automaticky prochází kód, data, scénáře a renderer. Není sám autorem podmínek převzetí.
- Claude přes **existující Anthropic API**, model `claude-haiku-4-5`, provede samostatnou obsahovou oponenturu konkrétního balíčku důkazů. Nejde o vzdálené ovládání Josefova předplaceného Claude chatu ani o klinický posudek. API je oddělené účtování; jeden nový review request na běh, bez SDK retries, max. 3072 výstupních tokenů, limit vstupu 120 000 znaků. Dosavadní live klasifikační sady už používají stejné API a zůstávají v existujícím CI.
- Josef přebírá kandidáta nebo dostane jediný souhrn rozhodnutí, které nelze zodpovědět kódem. Nehraje posla mezi jednotlivými opravami.

## Jak se práce předává

Větev `agent/gait-v1-pilot`, jeden draft PR, oddělené výsledky v CI artefaktu `crt-voice-reports/pilot-gait`. Zdrojem pravdy jsou kontrakt a výsledky vázané na commit, zdrojový otisk a katalog. Zpráva v chatu nesmí sama změnit scope.

1. Lead zjistí výchozí stav a reprodukuje překážky.
2. Provede opravy v povoleném rozsahu, zachová regrese. Nejvýše tři opravná kola před souhrnnou eskalací.
3. CI spustí stávající skutečné klasifikační a izolované engine sady. Pilot znovu prověří jednotkové kontrakty a přečte čerstvé výsledky stejného CI jobu.
4. Claude dostane pouze explicitní syntetické přepisy, vymezené zdroje a zadání. Vrátí ACCEPT / RETURN / BLOCKED s vazbou na podmínku a důkaz. Nemá nástroj pro změnu kódu, databáze, nasazení ani podmínek.
5. Lead opraví konkrétní programové rozpory, případně předá přesně formulované produktové/odborné rozhodnutí. Žádný automatický merge/deploy. Josef dostane jednu verzi či doloženou překážku.

**Tento pilot není hotový samostatně běžící univerzální coding agent.** Realizační práci zatím vykonává Codex v pracovním prostředí; automatizované jsou kontroly, sběr důkazů a předání nezávislému reviewerovi. Automatické spouštění a programové opravy dalších oblastí jsou další schopnost, ne tvrzení o tomto prototypu.

## Reprodukování

Bez klíče a bez sítě, s vlastním veřejným snapshotem:

```
node scripts/work-agent/test-pilot.mjs
node scripts/work-agent/run-gait-pilot.mjs --catalog=/cesta/catalog-snapshot.json --out=/tmp/chj-gait-pilot
```

Lokální injektovaná klasifikace správně skončí `BLOCKED_EVIDENCE`, i když programové kontroly projdou. Nejde o důkaz jazykového porozumění. Návratový kód 2 to odlišuje od chyby 1.

CI větev pilota automaticky používá čerstvé live reporty ze stejného GitHub jobu a přidává review. Import historických reportů nesmí vytvořit nový live PASS. Kontroly běží nad fiktivními profily v paměti, bez privátních účtů a bez klinického ověření.

## Co znamená konec

- `NEEDS_REPAIR`: konkrétní chyba programu nebo důkazů; opravuje realizátor.
- `BLOCKED_EVIDENCE`: neproběhlo požadované ověření; není to PASS.
- `AWAITING_INDEPENDENT_REVIEW`: technický balíček čeká na oponenturu.
- `NEEDS_DECISION`: přiložené přesné produktové/odborné rozhodnutí; agent ho nesmí vymyslet.
- `CANDIDATE_FOR_JOSEF`: přezkoumaný kandidát, nikoli Josefovo schválení nebo potvrzení klinické bezpečnosti.

D01 — vhodnost a dávka cviku — zůstává otevřená z existující dokumentace. D02 — srozumitelnost jiné priority při zadání nejisté chůze — dostane obsahovou kontrolu. Ani jedno se neztratí za zelenými testy. Nové nemoci nejsou součástí tohoto balíčku.
