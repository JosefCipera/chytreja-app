# CHJ — samostatný zdravotní souhlas a návazné podmínky, návrh 14. 10. 2026

Stav: specifikace k rozhodnutí a implementaci, nikoli existující funkce ani finální právní stanovisko. Součást návrhu změny právních stránek; nesmí být vydána za hotové zabezpečení.

## Navrhované znění pro uživatele

Nadpis: **Než začneš zadávat údaje o zdraví**

Vysvětlení:
„Chytré já pracuje s údaji, které mu zadáš, aby ti pomohlo pochopit souvislosti a vybrat osobní další krok. Patří sem i zdravotní údaje a odvozené stavy. Zprávy a potřebný kontext zpracovává také poskytovatel AI. Přečti si [jaké údaje používáme, komu je předáváme a jak dlouho je uchováváme](/ochrana-osobnich-udaju).“

Nezaškrtnuté samostatné políčko:
„Výslovně souhlasím, aby ITING s.r.o. pro můj osobní profil, vyhodnocování souvislostí a individuální doporučení v Chytrém já zpracovávala mnou zadané zdravotní údaje a související odvozené údaje, včetně potřebného zpracování uvedenými poskytovateli.“

Doplnění:
„Souhlas je dobrovolný. Bez něj můžeš prohlížet veřejný web, ale zdravotní personalizaci nezpřístupníme. Souhlas můžeš kdykoli odvolat v nastavení účtu. Nejde o souhlas s reklamou, trénováním modelů ani použitím tvých údajů k našim testům.“

Akce: **Pokračovat** (teprve po výslovném potvrzení) / **Zpět na web**.
Podmínky používání a potvrzení jejich přijetí zůstávají oddělené. Mikrofonní oprávnění ani souhlas s podmínkami nejsou náhradou.

Toto znění musí doprovázet skutečné informace o příjemcích, zemích a lhůtách. Jedna obecná věta o „partnerech“ není dostatečným technickým podkladem pro jejich libovolné přidávání. Nový účel, například využití reálných profilů k vývoji, nelze schovat do tohoto souhlasu.

## Implementace

1. Minimalizovaný účet může vzniknout před souhlasem; žádný dotaz na zdravotní profil, načtení existujícího zdraví ani předání zdravotního obsahu AI před platným oprávněním.
2. Souhlas ověřovat na serveru podle skutečného Firebase UID. Samotný client boolean, localStorage nebo HTML required nejsou autoritou.
3. Evidovat samostatně verzi podmínek / přijetí a zdravotní souhlas: verze, účely, čas udělení/odvolání, zdroj a identifikátor účtu. Text a informace musí jít dohledat podle verze. Nepřidávat IP ani zdravotní text do dokladu bez důvodu.
4. Zohlednit všechny cesty: hlavní Launcher, onboarding, starý /landing a handoff před registrací, profily, CRT, parse, TTS, jiné čtecí i zapisovací endpointy, tlačítka i existující přihlášené účty. Nepovažovat odstranění checkboxu za uzavření přímého API.
5. Odvolání v nastavení stejně snadné jako udělení; po serverovém potvrzení zastavit další zdravotní operace, zneplatnit/odmítnout čekající požadavky i opožděné výsledky, ukončit mikrofon, odstranit příslušné lokální kopie a zahájit odpovídající výmaz.
6. Respektovat skutečné právní podmínky. Běžný oprávněný zájem na bezpečnosti sám neodstraňuje ochranu údajů o zdraví podle čl. 9. Odděleně posoudit případné nezbytné uchování k právním nárokům.
7. Existujícím účtům nepřipsat souhlas zpětně. Vyžádat jej před dalším zpracováním, vyřešit již uložené údaje a případné odvolání. Žádná tichá migrace „souhlasil registrací“.
8. Před zavedením právně posoudit svobodnost a nezbytnost požadovaných údajů, rozsah profilování, práva, DPIA a zamýšlený účel produktu.

## Přijetí / odmítnutí — testy bez živých dat

- Nový e-mail účet, nový Google účet, existující přihlášený účet: stejná brána, nezaškrtnuto.
- Bez souhlasu žádný profil/health GET, health POST, AI, TTS zdravotního textu ani zdravotní log. Web dostupný.
- Samostatné potvrzení podmínek nezpřístupní zdraví; souhlas neaktivuje newsletter nebo placený produkt.
- Přímé API, handoff a stará cesta bez souhlasu odmítnuty; podvržené UID a klientský souhlas také.
- Odmítnutí a odvolání nejsou chyba ani cyklus přesměrování. Funguje návrat na web.
- Opožděný API výsledek po odvolání se nezapíše ani nezobrazí; nejde jen o zablokování tlačítka.
- Odvolání vede k jasnému stavu a ověřitelnému postupu výmazu; původní souhlas se nezmění na aktuálně platný při dalším loginu.
- Verze souhlasu i podmínek dohledatelné, po podstatné změně nový krok před novým zpracováním.
- Mobil, klávesnice a hlasový vstup neobcházejí informační krok.
- Testovací reset nemaže doklad bez souhlasu a není vydáván za úplný výmaz účtu.

## Schválená pravidla účtu a retence

Josef 14. 10. 2026 v 19:17 Europe/Prague schválil bezplatné testování pro 18+, oddělené přijetí případné placené nabídky, uchování profilu během používání účtu, výmaz provozních dat nejpozději do 30 dnů od zrušení a upozornění po 24 měsících neaktivity s 30 dny na reakci. Schválení nezahrnuje neověřené lhůty záloh/poskytovatelů ani ostatní navrhované lhůty korespondence/logů. Nejde o existující souhlas koncových uživatelů ani doklad implementace.

## Retence a výmaz — potřebné před zveřejněním

Použít odsouhlasenou tabulku z DATA-PROCESSING-INVENTORY-2026-10-14.md; nejdříve potvrdit technické možnosti. Připravit dry-run výmazu pouze pro syntetické fixtures a zálohový postup obnovy bez návratu dříve vymazaných dat. Živý účet se nemaže v rámci tohoto úkolu.

## Podklady

- https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en
- https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en
- https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en

Při odvolání zdravotní personalizace nesmí brána zablokovat zákonnou žádost o přístup, výmaz nebo uplatnění dalších práv. Tyto operace potřebují vlastní ověřenou cestu, ne opětovné vynucení zdravotního souhlasu.
