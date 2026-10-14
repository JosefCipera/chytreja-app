# CHJ — právní a datová inventura, 14. 10. 2026

Stav zdrojů: main `0f2cac105eab44fcc8a67dd33e4483d8978593ae`. Kontrola kódu a veřejné dokumentace, nikoli přihlášení do provozních konzolí, kontrola smluv, audit všech databázových tabulek nebo právní schválení. Žádný soukromý profil, token, klíč ani skutečná zpráva nebyly čteny. Nic v DB nebylo změněno. Návrhy stránek zůstávají v draft PR.

## Rozsah a jistota

Ověřeno: homepage → Firebase login/registrace → Launcher a onboarding; související user API, klasifikace a ukládání zdravotních událostí; vybrané další endpointy CRT, chat, rozbor dokumentu, TTS, notifikace a handoff. Přítomnost endpointu neprokazuje, že jej někdo dnes používá ani že je zapnutý odpovídající placený účet. Smluvní regiony a skutečné uchování nejsou určitelné z URL projektu ani z dokumentace tarifu.

Identita ITING ověřena read-only 14. 10. 2026 veřejným ARES REST GET pro IČO 25970631: ITING s.r.o., Vančurova 2710, 544 01 Dvůr Králové nad Labem. Ověřená identita sama nedokládá právní soulad CHJ.

## Záznam zpracování — technická fakta

| Tok | Údaje / účel | Kód / úložiště / příjemce | Stav lhůty a výmazu |
|---|---|---|---|
| Přihlášení e-mailem nebo Google | E-mail, Firebase UID, přihlašovací údaje, případně jméno či obrázek od identity; autentizace | app/login.html; Firebase Auth; API ověřuje token přes api/lib/requireAuth.js a firebaseAdmin.js | Firebase účet nemá v kontrolované UI uživatelské tlačítko úplného výmazu. Odhlášení není výmaz. |
| Základní profil | Věk/rok narození, pohlaví, výška, hmotnost, pas, fyzická kapacita | onboarding-wizard.js → api/user.js wizard-step a wizard-complete → user_profiles, user_health_profile | Nenalezen automatický retenční proces v kontrolované cestě. |
| Zdravotní profil | Diagnózy, léky, výsledky, symptomy, cíl, schopnosti, omezení; individualizace a bezpečnostní kontext | api/user.js full-profile, health-profile, save-zdravi/kondice; user_health_profile, user_medications, user_constraints aj. | Editace jednotlivého pole ani neaktivní medication nejsou úplným výmazem všech kopií. |
| Běžný rozhovor | Text/přepis; pending question a label aktuální akce pro klasifikaci | api/orchestrate.js → api/engine/orchestrator.js classifyIntent → Anthropic claude-haiku-4-5 | Ne všechny zprávy jsou databázovým přepisem chatu; odpovědi a významné události se ukládají různě. Žádné tvrzení „nic se nikde neukládá“. |
| Zdravotní události a akce | Extrahované odpovědi, měření a preference; doporučení, status, dokončení/přeskočení | healthEventAdapter.js a adapter.js; zejména user_health_profile, user_profiles, daily_checkin, user_constraints, action_assignments | Ukládání závisí na typu události. Tester reset odstraňuje jen vybrané řádky; není výmazem účtu ani všech osobních údajů. |
| Stav v zařízení | Celá poslední odpověď, zadaný text/přepis, session a rozpracované konverzační položky pod UID | Launcher localStorage chj_session_v1:UID a chj_last_response_v1:UID, sessionStorage chj_qbudget; Firebase vlastní persistence | Bez pevné expirace v kontrolovaném kódu. Logout odstraňuje aplikační klíče právě odhlašovaného UID, ne všechny historické účty, serverové záznamy a všechny prohlížeče. |
| Řeč → text | Zvuk z mikrofonu → přepis; přepis dále stejně jako psaný vstup | Web Speech API prohlížeče v Launcheru | CHJ v této cestě neukládá vlastní audio; z toho neplyne offline zpracování ani nulová retence poskytovatele prohlížeče. |
| Hosting / logy | Síťová data, chyby, metadata požadavků; navíc UID a první 50 znaků vstupu v IN trace | Vercel; api/orchestrate.js console.log před zpracováním. Další api/chat.js loguje raw AI text; api/tts.js generovaný briefing | Skutečný tarif, log drains a lhůty neověřeny. Nutná minimalizace obsahu, redakce chyb a inventura ostatních logů. |
| Zdravotní dokument — další funkce | PDF/obrázek v base64, filename a datum → analýza; strukturované výtažky | api/tools/parse.js handleHealthDoc → Anthropic; node_inputs summary/markers/constraints/flags, user_lab_results a navazující profil/medikace | Kód této větve neukazuje uložení originálního souboru do vlastního Storage; není to důkaz nulové retence API/logů ani všech jiných upload cest. |
| CRT — další funkce | Profil, diagnózy, výsledky, model a kontext | api/crt-generate.js: deterministic/Anthropic cesty; explicitní model=gpt4o volí OpenAI; cache v user_health_profile | Volitelný poskytovatel existuje v kódu; nebylo ověřeno jeho zapnutí, skutečné použití, retention ani sdílení vstupů v konkrétním účtu. |
| Mluvený výstup — další funkce | Text do 500 znaků, někdy připravený z profilu přes Anthropic, → audio | api/tts.js → api.elevenlabs.io; jiné cesty než Web Speech vstup Launcheru | Vyžaduje ElevenLabs konfiguraci; použití a privacy opt-out / ZRM neověřeny. Komentář o OpenAI v úvodu tts.js neodpovídá aktuálním generátorům (ty volají Anthropic). |
| Předvstupní rozhovor / handoff | Předregistrací zadané zdravotní údaje, dočasný kontext, následné přiřazení účtu | api/pre-intake.js, api/session-handoff.js a handoff_sessions; starý /landing je samostatně dostupný | Není hlavní homepage cesta, ale nesmí obejít budoucí souhlas a výmaz. |
| Kontakt | Name, email, message, page URL, _subject; síťová metadata | home-v2.html + contact.js → Formspree xaqanpyv → podle Josefova potvrzení obchod@iting.cz | 8s potvrzení je stav UI, nikoli retence zprávy. Free archiv byl uváděn 30 dnů; není to lhůta notifikačního e-mailu ani všech poskytovatelských logů. |
| Zakladatelský zájem | E-mail zaslaný uživatelem na info@iting.cz | zakladatele.html mailto | Nezávazný zájem, nikoli objednávka. E-mailový poskytovatel, lhůta a přístupy neověřeny. |
| Písma a jiné síťové požadavky | IP a technické údaje při načtení fontů | Google Fonts import v landing style.css, linky v login/Launcher | Veřejné nové právní stránky používají systémová písma a nepotřebují externí fonty. |

Průběžné hledání názvů souborů consent/privacy/terms/delete/purge/retention v tree nenašlo samostatný souhlasový či retenční modul. To není důkaz, že žádná smlouva nebo ruční postup neexistuje mimo repozitář.

## Konkrétní nesoulady k uzavření

1. **Zdravotní souhlas:** termsCheck v login je pouze obchodní souhlas; kontrola na klientovi není serverově doložený a vynucený zdravotní souhlas. Google přihlášení do již existujícího účtu a starší cesty nesmějí bránu obejít. Souhlas potřebuje účel, rozsah, informování o příjemcích/předání, verzi, doložitelný čas a snadné odvolání. Přijetí podmínek evidovat samostatně. Viz HEALTH-DATA-CONSENT-SPEC-2026-10-14.md.
2. **Logy:** odstranit obsah zprávy a přímo identifikující UID ze standardního IN trace; ponechat request id, délku, stav a diagnostiku bez zdravotního obsahu. Prověřit ostatní endpointy, error body a log drains. Tento draft PR kód enginu ani loggerů nepřepisuje.
3. **Výmaz:** neexistuje prokázaný úplný postup Firebase + relevantní Supabase tabulky + cache + logy + lokální kopie + e-mail/Formspree. Připravit dry-run soupis podle UID a schválený postup; žádné hromadné DELETE ani reset testera nevydávat za splnění žádosti. U záloh dokumentovat doběh a zabránění opětovnému zavedení vymazaných dat při obnově.
4. **Příjemci a země:** zjistit skutečnou konfiguraci účtů, DPA, další zpracovatele a mechanismy předávání. Firebase oficiálně uvádí Auth v USA; Formspree také zpracování mimo EU. Výrok „pouze EU“ se nehodí.
5. **Formspree:** služba v privacy policy uvádí, že nesmí být použita ke sběru citlivých údajů. Přidat viditelné upozornění před zprávu a neslibovat zdravotní podporu tímto formulářem. Upozornění samo nevyloučí, že uživatel vloží citlivý text; určit postup při nevyžádaném přijetí a posoudit službu pro obecný kontakt.
6. **AI účely:** žádné automatické použití zdravotních profilů k vývoji/testování/trénování modelů. Oddělit syntetické QA fixtures od skutečných lidí. Před tvrzením „nepoužívá se k trénování“ ověřit zejména ElevenLabs data-use nastavení a všechny aktivní poskytovatele.
7. **Produkt a právní posouzení:** posoudit skutečný zamýšlený účel, profilování a dopady výstupů; potřebu DPIA a případně pověřence určit podle skutečného rozsahu. Samotná věta „nenahrazuje lékaře“ nerozhoduje o zařazení produktu podle předpisů pro zdravotnické prostředky. Odborná validace CRT a cviků je samostatně nedokončená.
8. **Staré podmínky:** Sokrates, GoPay, storna seminářů a data 2018/2020 nepatří do nové aplikační verze. Nezavádět novou garanci, předplatné, výluku spotřebitelských práv ani zánik zakoupeného přístupu jednostranně.

## Návrh provozních pravidel k rozhodnutí (NEJSOU zavedena)

- Testování: zatím bezplatné, jen 18+, placené používání až po samostatném přijetí konkrétní nabídky; věkový režim odpovídajícím způsobem zavést.
- Profil a historie: po dobu využívání účtu. Neaktivitu navrhuji vyhodnotit po 24 měsících, upozornit a dát 30 dní na reakci, poté účet uzavřít. Potvrdit s ohledem na dlouhodobý smysl CHJ.
- Ukončení účtu / odvolání zdravotního souhlasu: ihned zastavit další nepřípustné zpracování; provozní kopie vymazat bez zbytečného odkladu, cílově do 30 dnů. Nezaměňovat se zákonnou lhůtou na odpověď na žádost. Skutečný doběh záloh nejprve ověřit a konkrétně uvést.
- Provozní logy: navrhuji nejvýše 7 dnů, bez textu zpráv, diagnóz a dokumentů. Musí odpovídat zvolenému tarifu/log drains; delší cílené bezpečnostní uchování jen s doloženým důvodem a podmínkami pro citlivý obsah.
- Obecné dotazy: navrhuji smazat do 12 měsíců od vyřízení, pokud nepokračuje konkrétní smluvní jednání nebo není doložen jiný nutný důvod.
- Nezávazný zájem o Zakladatele: nejvýše 12 měsíců od poslední komunikace, nebo dříve na žádost. Nepřidávat ho automaticky do newsletteru.
- Důkaz souhlasu a řešení právních nároků: minimalizované údaje a právně odůvodněná konkrétní lhůta; nevytvářet bez posouzení neomezený zdravotní archiv „pro jistotu“.

Schválení pravidel neznamená, že již fungují. Poté je nutné je zavést, ověřit a teprve přepsat příslušné poznámky ve veřejném textu na faktické informace.

## Přesné zadání pro read-only ověření konzolí (lze předat Claudeovi)

Bez soukromých řádků a bez výpisu klíčů potvrdit:
- Supabase: identifikaci projektu, region, tarif, délku a místo záloh, seznam relevantních tabulek/FK pro účet pouze ze schématu, přijaté DPA.
- Vercel: projekt/prostředí/funkční regiony, log retention a drains, členy s přístupem podle rolí (bez osobních detailů), DPA.
- Firebase: aktivní Auth poskytovatele, přijaté podmínky a možnosti úplného výmazu; neexportovat uživatele.
- Anthropic, OpenAI, ElevenLabs: zda služba skutečně slouží CHJ, smluvní subjekt/DPA, region/routing, data use/training opt-in, retence a případné ZDR; přítomnost klíče jen ano/ne, nikdy hodnota.
- Formspree: DPA a dostupná pravidla mazání, archiv, notifikační workflow, poskytovatel schránky obchod@iting.cz, případné další kopie. Neotvírat obsah zpráv.

Výstup po jednotlivých bodech „ověřeno + datum + kde“, nebo „neověřeno“. Nepovažovat obecnou dokumentaci za nastavení konkrétního účtu. Žádné změny nastavení, objednávky tarifů, odesílání zpráv ani mazání.

## Veřejné primární podklady ověřené 14. 10. 2026

- ARES: https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/25970631
- EDPB, právní základy a citlivé údaje: https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en
- EDPB, souhlas: https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en
- EDPB, práva: https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en
- ÚOOÚ: https://uoou.gov.cz/verejnost/zakladni-prirucka-k-ochrane-udaju
- ČOI, digitální služba: https://coi.gov.cz/faq/4-prava-z-vad-digitalniho-obsahu-ci-sluzby/
- ČOI, ADR: https://coi.gov.cz/pro-podnikatele/informace-pro-prodejce-zbozi-a-sluzeb/mimosoudni-reseni-spotrebitelskych-sporu-adr/
- Firebase: https://firebase.google.com/support/privacy
- Supabase: https://supabase.com/docs/guides/platform/regions ; https://supabase.com/docs/guides/platform/backups ; https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- Vercel: https://vercel.com/docs/logs/runtime
- Anthropic API: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- OpenAI API: https://developers.openai.com/api/docs/guides/your-data
- ElevenLabs: https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode ; https://elevenlabs.io/docs/help-center/legal/is-my-data-used-to-improve-eleven-labs-ai-models
- Web Speech: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- Formspree: https://formspree.io/legal/privacy-policy/

Dokumentaci Anthropic nelze převzít jako důkaz nastavení organizace. Veřejné stránky obsahují různé režimy a výjimky; bez potvrzení smlouvy a konfigurace se neuvádí ZDR ani pevná 30denní lhůta jako vlastnost CHJ.
