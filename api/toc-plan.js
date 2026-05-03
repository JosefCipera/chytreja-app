// POST /api/toc-plan
// Body: { action: 'kontrola' | 'vytvor', userId: '...' }
//
// action=kontrola:
//   Zkontroluje povinná pole každé zakázky, zapíše kontrola_dat: 'ok' nebo
//   seznam chybějících polí oddělených čárkami.
//
// action=vytvor:
//   Pro zakázky s kontrola_dat='ok' a stavem plánovaná/rozpracovaná:
//   - spočítá planovane_zahajeni couváním od planovane_ukonceni přes prac. dny
//   - spočítá zpozdeni_dny a casove_plneni_pct
//   - spočítá pracovní zátěž na pracoviště (zbývající ks × min/ks)
//   - uloží do toc_zakazky
//   - vrátí seřazeno sestupně podle planovane_zahajeni

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// ── Kalendář ──────────────────────────────────────────────────────────────────

// Velikonoční neděle (Gaussův algoritmus)
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// Vrátí true pokud je den nepracovní (víkend nebo český státní svátek)
function isNonWorkingDay(date) {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return true; // neděle, sobota

  const m  = date.getMonth() + 1;
  const dd = date.getDate();
  const y  = date.getFullYear();

  // Pevné svátky
  if (m === 1  && dd === 1)  return true; // Nový rok
  if (m === 5  && dd === 1)  return true; // Svátek práce
  if (m === 5  && dd === 8)  return true; // Den vítězství
  if (m === 7  && dd === 5)  return true; // Cyril a Metoděj
  if (m === 7  && dd === 6)  return true; // Jan Hus
  if (m === 9  && dd === 28) return true; // Den české státnosti
  if (m === 10 && dd === 28) return true; // Den vzniku Československa
  if (m === 11 && dd === 17) return true; // Den boje za svobodu
  if (m === 12 && dd === 24) return true; // Štědrý den
  if (m === 12 && dd === 25) return true; // 1. svátek vánoční
  if (m === 12 && dd === 26) return true; // 2. svátek vánoční

  // Pohyblivé svátky (Velký pátek, Velikonoční pondělí)
  const easter  = easterSunday(y);
  const gf = new Date(easter); gf.setDate(easter.getDate() - 2); // Velký pátek
  const em = new Date(easter); em.setDate(easter.getDate() + 1); // Velikonoční pondělí
  const ds = `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
  if (ds === gf.toISOString().slice(0,10)) return true;
  if (ds === em.toISOString().slice(0,10)) return true;

  return false;
}

// Posune datum dozadu o N pracovních dní (přeskakuje nepracovní dny)
function subtractWorkingDays(fromDate, workingDays) {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  let remaining = workingDays;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    if (!isNonWorkingDay(d)) remaining--;
  }
  return d;
}

// Počet kalendářních dní mezi dvěma daty (včetně)
function calendarDays(from, to) {
  const ms = new Date(to).setHours(0,0,0,0) - new Date(from).setHours(0,0,0,0);
  return Math.round(ms / 86400000) + 1;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Content-Type', 'application/json');

  try {
    const { action, userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!action)  return res.status(400).json({ error: 'action required' });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ── ACTION: kontrola ────────────────────────────────────────────────────
    if (action === 'kontrola') {
      const { data: zakazky, error: fetchErr } = await sb
        .from('toc_zakazky')
        .select('id_zakazky, nazev_zakazky, prubeznа_doba, stav, termin_dodani, vyrobit_ks')
        .eq('user_id', userId);

      if (fetchErr) throw fetchErr;
      if (!zakazky?.length) return res.json({ ok: true, checked: 0, err_count: 0, message: 'Žádné zakázky.' });

      const updates = zakazky.map(z => {
        const chyby = [];
        if (!z.id_zakazky || z.id_zakazky === 'null')   chyby.push('ID zakázky');
        if (!z.prubeznа_doba || z.prubeznа_doba <= 0)   chyby.push('průběžná doba');
        if (!z.stav || z.stav === 'null')                chyby.push('stav zakázky');
        if (!z.termin_dodani || z.termin_dodani === 'null') chyby.push('termín dodání');
        if (!z.vyrobit_ks || z.vyrobit_ks <= 0)         chyby.push('vyrobit kusů');
        return { id_zakazky: z.id_zakazky, nazev: z.nazev_zakazky, kontrola_dat: chyby.length ? chyby.join(', ') : 'ok' };
      });

      await Promise.all(updates.map(u =>
        sb.from('toc_zakazky')
          .update({ kontrola_dat: u.kontrola_dat, updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('id_zakazky', u.id_zakazky)
      ));

      const okCount  = updates.filter(u => u.kontrola_dat === 'ok').length;
      const errCount = updates.length - okCount;
      return res.json({
        ok: true, checked: updates.length, ok_count: okCount, err_count: errCount,
        errors: updates.filter(u => u.kontrola_dat !== 'ok').map(u => ({ id: u.id_zakazky, nazev: u.nazev, chyby: u.kontrola_dat })),
      });
    }

    // ── ACTION: vytvor ──────────────────────────────────────────────────────
    if (action === 'vytvor') {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      // 1) Načti zakázky které prošly kontrolou a jsou aktivní
      const { data: zakazky, error: zErr } = await sb
        .from('toc_zakazky')
        .select('*')
        .eq('user_id', userId)
        .eq('kontrola_dat', 'ok')
        .in('stav', ['plánovaná', 'rozpracovaná']);

      if (zErr) throw zErr;
      if (!zakazky?.length) return res.json({ ok: true, planned: 0, message: 'Žádné zakázky ke zplánování.' });

      // 2) Načti pracoviště (pro mapování poradi → nazev)
      const { data: pracoviste } = await sb
        .from('toc_pracoviste')
        .select('id_pracoviste, nazev_pracoviste, poradi')
        .eq('user_id', userId)
        .eq('aktivni', true)
        .order('poradi');

      const poradiMap = {};
      for (const p of pracoviste || []) {
        if (p.poradi != null) poradiMap[String(p.poradi)] = p.nazev_pracoviste;
      }

      // 3) Výpočet plánu pro každou zakázku
      const results = zakazky.map(z => {
        const zbyva_ks = Math.max(0, (z.vyrobit_ks || 0) - (z.odvedeno_ks || 0));

        // Plánované ukončení = termin_dodani pokud není vyplněno
        const ukonceni = z.planovane_ukonceni || z.termin_dodani;

        // Plánované zahájení — couvej od ukončení o prubeznа_doba pracovních dní
        // Pokud vychází v minulosti, zahaj od dneška (zakázka je zpožděná)
        const zahajeniIdeal = subtractWorkingDays(ukonceni, z.prubeznа_doba);
        const zahajeni = zahajeniIdeal < today ? new Date(today) : zahajeniIdeal;

        // Zpoždění oproti dnešku (podle termínu dodání, ne zahájení)
        const endDate = new Date(ukonceni); endDate.setHours(0,0,0,0);
        const zpozdeniMs   = today.getTime() - endDate.getTime();
        const zpozdeni_dny = zpozdeniMs > 0 ? Math.ceil(zpozdeniMs / 86400000) : null;
        const casove_plneni_pct = zpozdeni_dny && z.prubeznа_doba > 0
          ? Math.round(zpozdeni_dny / z.prubeznа_doba * 100)
          : null;

        // Průběžná doba — konstanta ze zakázky, nezměníme ji
        // (pro zobrazení přepočteme na kal. dny z ideálního zahájení, ne z clampnutého)
        const prubeznа_doba_kal = calendarDays(zahajeniIdeal, ukonceni);

        // Pracovní zátěž na pracoviště: zbývající ks × min/ks
        const cas = z.cas_pracoviste || {};
        const cas_plan = {};
        for (const [poradi, minKs] of Object.entries(cas)) {
          cas_plan[poradi] = Math.round((minKs || 0) * zbyva_ks);
        }
        const cas_plan_txt = Object.entries(cas_plan)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${poradiMap[k] || 'P' + k}: ${v} min`)
          .join(', ');

        return {
          id_zakazky:           z.id_zakazky,
          // uložit do DB
          planovane_zahajeni:   zahajeni.toISOString().slice(0,10),
          planovane_ukonceni:   ukonceni,
          zpozdeni_dny:         zpozdeni_dny,
          casove_plneni_pct:    casove_plneni_pct,
          updated_at:           new Date().toISOString(),
          // jen pro odpověď (ne DB)
          _prubeznа_doba_kal:   prubeznа_doba_kal,
          _cas_plan_txt:        cas_plan_txt,
          _zbyva_ks:            zbyva_ks,
        };
      });

      // 4) Ulož výsledky do DB (paralelně)
      await Promise.all(results.map(r =>
        sb.from('toc_zakazky').update({
          planovane_zahajeni:  r.planovane_zahajeni,
          planovane_ukonceni:  r.planovane_ukonceni,
          zpozdeni_dny:        r.zpozdeni_dny,
          casove_plneni_pct:   r.casove_plneni_pct,
          updated_at:          r.updated_at,
        }).eq('user_id', userId).eq('id_zakazky', r.id_zakazky)
      ));

      // 5) Sestav a vrať výsledný plán seřazený sestupně podle planovane_zahajeni
      const plan = results
        .sort((a, b) => b.planovane_zahajeni.localeCompare(a.planovane_zahajeni))
        .map(r => {
          const z = zakazky.find(x => x.id_zakazky === r.id_zakazky);
          return {
            id_zakazky:           z.id_zakazky,
            nazev_zakazky:        z.nazev_zakazky,
            typ_zakazky:          z.typ_zakazky,
            vyrobit_ks:           z.vyrobit_ks,
            odvedeno_ks:          z.odvedeno_ks,
            zbyvа_ks:             r._zbyva_ks,
            planovane_zahajeni:   r.planovane_zahajeni,
            planovane_ukonceni:   r.planovane_ukonceni,
            termin_dodani:        z.termin_dodani,
            prubeznа_doba:        r._prubeznа_doba_kal,   // kalendářní dny
            zpozdeni_dny:         r.zpozdeni_dny ?? 0,
            stav:                 z.stav,
            cas_pracoviste_txt:   r._cas_plan_txt,
            kontrola_dat:         z.kontrola_dat,
          };
        });

      return res.json({ ok: true, planned: plan.length, plan });
    }

    return res.status(400).json({ error: `Neznámá akce: ${action}` });

  } catch (err) {
    console.error('[toc-plan]', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
