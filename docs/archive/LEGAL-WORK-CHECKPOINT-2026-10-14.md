# Právní práce CHJ — odloženo 14. 10. 2026

Josef 14. 10. 2026 v 19:27 Europe/Prague požádal odložit zdravotní souhlas, výmaz a dokončení právních textů: „tohle si ulož a vrátíme se k tomu. teď to akutně nepotřebujeme“. Aktivní úkol nyní: sjednotit vzhled a návrat existujících dokumentů, bez zavedení nových podmínek.

## Uložený rozpracovaný stav

- Draft PR #79: https://github.com/JosefCipera/chytreja-app/pull/79
- Větev: draft/chj-legal-data-review
- Poslední uložený commit před odložením: 4e381278f13cf37235f5da46a1d71013bf3f1610.
- Kompletní návrhy podmínek a ochrany údajů, DATA-PROCESSING-INVENTORY-2026-10-14.md, HEALTH-DATA-CONSENT-SPEC-2026-10-14.md.
- Josef v 19:17 schválil bezplatné testování pro 18+, samostatné přijetí případné placené nabídky, uchování profilu při používání účtu, výmaz provozních dat nejpozději do 30 dnů od zrušení a upozornění po 24 měsících neaktivity s dalšími 30 dny na reakci.
- Neschválené/neověřené zůstávají konkrétní lhůty záloh a poskytovatelů a další navržené lhůty logů/korespondence. Schválení pravidel není souhlasem uživatelů ani důkazem, že mazání funguje.
- Chromium kontroly původního návrhu byly úspěšné; veřejné stránky z main nebyly nahrazeny návrhy.

## Kde pokračovat později

1. Načíst aktuální main a PR #79. Zachovat aktuální sjednocený toolbar a document-return.js; draft vznikl před touto úpravou a obsahuje starší vlastní šablonu.
2. Dokončit ověření skutečných regionů, smluv, retence a nastavení poskytovatelů podle inventury. Nečíst soukromé profily ani klíče.
3. Zavést a ověřit samostatný doložitelný zdravotní souhlas a snadné odvolání včetně serverových cest a starého handoffu. Obchodní podmínky nejsou náhradou souhlasu.
4. Minimalizovat zdravotní obsah v logování. Připravit úplný výmaz účtu a souvisejících kopií, nikoli reset testera.
5. Teprve potom dokončit faktické poznámky, datum účinnosti a vydání podmínek. Nezavádět placený prodej Zakladatelů nebo automatické mazání v rámci úpravy navigace.

Současná změna sjednocuje pouze prezentaci a návrat z již existujících Cookies, ochrany údajů a podmínek. Obsahové nedostatky starých právních textů tím nejsou vyřešeny.
