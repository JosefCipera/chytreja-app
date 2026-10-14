# Landing a kontakt — stav a další právní práce, 14. 10. 2026

## Dokončeno

- PR #67: root / používá app/home-v2.html.
- PR #68: kontaktní formulář, odesílání přes Formspree xaqanpyv.
- PR #70: potvrzení zmizí po 8 sekundách, vrátí se prázdný formulář; nečitelná nebo negativní odpověď nezobrazí úspěch.
- PR #69: pět schválených rozbalovacích FAQ, původní barvy/typografie/mezery zápatí podle iting.cz, česká vlajka a 🌍 SmartSelf, viditelný info@iting.cz. Merge f400a15acf567bc0fcfc05901b8c7f51fa0b737e; develop hlásí dokončené nasazení.
- Živé GET kontroly /, FAQ CSS/JS, contact.js a obou právních odkazů vracejí 200. Root obsahuje pět FAQ a kontakt před zápatím. Oprava s 8 sekundami zůstala po merge zachovaná.
- Josef 14. 10. ve 12:43 pražského času potvrdil, že nová zpráva dorazila a potvrzení zmizelo po 8 sekundách. Jde o jeho ověření; schránku jsme samostatně nečetli.
- Podle Josefova nastavení je adresát notifikace obchod@iting.cz (ověřená adresa). Účet Formspree zůstává spojený s jeho Gmailem. Tato změna se provádí ve Formspree, nikoli v HTML endpointu.
- Dřívější dvě testovací zprávy byly ve Formspree Spam; Josef označil zprávu z devu Not Spam. Je potřeba sledovat chybné zařazení i dalšího kontaktu. Samotná 2xx odpověď není doklad doručení e-mailu.

Formspree zatím free: 50 submissions/měsíc, 30denní archiv; před ostrým provozem posoudit tarif podle objemu a požadovaných funkcí. Změna na placený tarif nebyla provedena.

## Výsledek čtení právních stránek

Přečteny app/obchodni-podminky.html a app/ochrana-osobnich-udaju.html z main f851ae088179de58e6c2e03f3cd9ce68d0c07565. Jsou to původní obecné dokumenty ITING, nikoli podmínky Chytrého já.

| Konkrétní nález | Další práce |
|---|---|
| Oba title obsahují Sokrates; návratový popisek iting.cz; ochrana údajů odkazuje na /#contact místo #kontakt | Při nové verzi opravit názvy a navigaci. |
| Podmínky popisují kurzy, semináře, webináře, e-booky a konzultace | Oddělit případné podmínky těchto služeb od použití CHJ. |
| Podmínky uvádějí objednávky, faktury, GoPay a garance živých akcí; účinnost 1. 1. 2020 | Nepřenést automaticky do CHJ. Popsat skutečnou aktuální zkušební fázi; placenou nabídku Zakladatelů řešit samostatně podle schváleného rozsahu. |
| Privacy text se soustředí na zákazníky akcí, mailing, marketing a fotografie; účinnost 25. 5. 2018 | Doplnit skutečné účely a datové toky CHJ a kontaktu, nepřevzít neověřené tvrzení o používání nebo zemích zpracování. |
| Kontaktní formulář říká Odesláním souhlasíš se zpracováním osobních údajů | Právně posoudit skutečný účel/právní základ a odpovídající informování, nevytvořit automaticky marketingový souhlas. |
| Chybí konkrétní popis zdravotních údajů, hlasového vstupu, AI zpracování a stavu mazání/uchování | Vypracovat technickou inventuru před finálním textem. Nefixovat lhůty, které nejsou zavedené nebo schválené. |

## Ohraničené zadání pro další etapu

1. Inventura podle aktuálního kódu a konfigurací: registrace/přihlášení, profil a zdravotní odpovědi, konverzace a doporučení, hlas, lokální úložiště, logy, kontakt přes Formspree a notifikační schránka. Bez čtení soukromých profilů a bez výpisu klíčů.
2. U každého toku zaznamenat účel, položky, skutečného poskytovatele/příjemce, region známý z konfigurace, smluvní podklad, dobu uchování a způsob výmazu. Neznámé údaje označit k ověření. Rozlišit to, co aplikace nedělá, od toho, co poskytovatel může dělat podle nastavení a smlouvy.
3. Připravit návrhy dokumentů k právní kontrole; nepovažovat stávající obecné zásady za schválení zpracování zdravotních údajů. GDPR čl. 9 se týká zvláštních kategorií včetně údajů o zdraví; čl. 13 řeší informování při získávání údajů. Volbu konkrétního právního základu musí podpořit skutečný provoz a právní posouzení.
4. Obchodní podmínky CHJ: aktuální testovací rozsah, účet, zamýšlené použití a jeho hranice, dostupnost, podpora a ukončení. Platební a zakladatelské podmínky nepovažovat za hotové; nepřidat vlastní výluku zákonných práv nebo garanci.
5. Po faktickém/právním uzavření upravit veřejné stránky, přidat správná data účinnosti/verze a ověřit odkazy i z registrace a kontaktu.

Tento dokument je pracovní záznam a zadání, ne právní schválení. Veřejné právní texty nebyly v této etapě obsahově přepsány.

## Podklady

- https://formspree.io/plans/ — ověřeno 14. 10. 2026.
- https://help.formspree.io/articles/form-and-project-settings/over-limit-submissions
- https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679 — GDPR, zejména čl. 9 a 13.
- Odborné posouzení CRT a čtyř vstupních doporučení zůstává samostatné: [podklad](FOUR-ENTRY-ACTIONS-CLINICAL-REVIEW-2026-10-14.md). Před testerem1 celý průchod nejprve zkusí Josef.
