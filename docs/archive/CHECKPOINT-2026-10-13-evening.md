# Chytré já — checkpoint 2026-10-13, 19:05 Europe/Prague

## Uložený stav

Repozitář: JosefCipera/chytreja-app. Ověřený main před zápisem tohoto checkpointu: `ef84e0c4b0136af3ae0bb31adaa6cdea57fc3d8c`. PR #62, #63 a #64 jsou sloučené. CI pro poslední merge: https://github.com/JosefCipera/chytreja-app/actions/runs/38429933137 — completed/success. Develop deployment pro tento merge: https://vercel.com/josef-ciperas-projects/chytreja-app-develop/CoCgXpZLqc9BqJ3gHavpssG2Xxbx — success; veřejná homepage vrací 200 a nepovolený GET na POST endpoint /api/orchestrate vrací 405. To potvrzuje dostupnost, nikoli přihlášení či mikrofon.

- #62: výpadek klasifikátoru/spojení zachová původní text a kontext pro opakování; neobnoví starou akci a nepředstírá neporozumění uživateli. Retry je v místním stavu prohlížeče, nikoli serverová fronta napříč zařízeními.
- #63: kratší pokyny pro mobil při zachování bezpečnostních podmínek; WHY rozlišuje nepřímé údaje o síle a rovnováze od skutečně hlášené nejistoty. Dávka ani pravidla výběru nebyly změněny.
- #64: výslovné sdělení o stabilní aktuální chůzi opraví i starší zápornou odpověď v gait_stability. Samotná kladná odpověď na doplňující otázku nemaže nezávislé hlášení občasného vrávorání; ostatní nálezy, pády a omezení se zachovají. WHY dává přednost skutečnému hlášení chůze před úkolem se zavřenýma očima.

Izolované kontroly zahrnují 768 kombinací, 25 scénářů hubnutí, šest rozhovorů, scénáře výpadků a kontroly ovládání/textů; úspěšné CI zahrnuje skutečnou klasifikaci AI nad syntetickými profily. Testy nepotvrzují klinickou vhodnost ani délku cviku pro konkrétního člověka.

## Uživatelský průchod — výstupy dodané Josefem v této konverzaci

Stejný testovací účet, bez vytvoření dalšího účtu. Identita účtu zde není určena; žádná soukromá data nebyla kvůli tomuto checkpointu čtena.

Po opětovném upřesnění stabilní chůze uživatel dodal:

> Chceš zhubnout. Svižná chůze nebo kolo — 20 minut (dá se mluvit).

WHY:

> Chceš zhubnout. Vycházím ze zadané výšky a hmotnosti. Proto se dnes zaměřujeme na množství tělesného tuku. Cílem je podpořit tvoje zdraví a tvoji soběstačnost.

První Přeskočit:

> Chceš zhubnout. Jdi na procházku 20 minut.

Druhé Přeskočit:

> Dnešní dostupné akce jsi přeskočil. Zítra je vyhodnotím znovu.

Co dál? zopakovalo stejné uzavření a nevrátilo přeskočenou akci. Toto je pozorovaný výstup aplikace podle uživatelova přepisu; není to nezávislá kontrola DB zápisů ani dokončený test registrace, ASR či konkrétního zařízení.

## Odkud pokračovat

Na stejném testovacím účtu následující den napsat „Chci zhubnout.“ a ověřit nové denní vyhodnocení, bez resetu či nové registrace. Engine používá dosavadní UTC hranici dne; tento checkpoint ji nemění. Zapsat skutečný výstup, nevynucovat předem konkrétní akci. Širší problémy dál reprodukovat v izolovaných automatických scénářích.

Claudeovy úpravy home-v2/steps-v2 ani routing homepage nebyly v těchto opravách měněny. Produkční/testovací větve se nemergovaly. Kód, testy a tento checkpoint jsou uložené v GitHubu; tento krok nevytváří zálohu Supabase/Firebase dat, tajných klíčů ani obsahu prohlížeče.
