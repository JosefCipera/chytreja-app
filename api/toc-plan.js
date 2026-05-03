// POST /api/toc-plan
// Body: { action: 'kontrola', userId: '...' }
//
// action=kontrola:
//   Projde všechny zakázky uživatele, pro každou zkontroluje
//   povinná pole a zapíše výsledek do kontrola_dat:
//   - "ok"                     … vše v pořádku
//   - "průběžná doba, stav"    … seznam chybějících/neplatných polí

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

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

    // ── ACTION: kontrola ──────────────────────────────────────────────────────
    if (action === 'kontrola') {
      // 1) Načti všechny zakázky
      const { data: zakazky, error: fetchErr } = await sb
        .from('toc_zakazky')
        .select('id_zakazky, nazev_zakazky, prubeznа_doba, stav, termin_dodani, vyrobit_ks')
        .eq('user_id', userId);

      if (fetchErr) throw fetchErr;
      if (!zakazky?.length) return res.json({ ok: true, checked: 0, errors: 0, message: 'Žádné zakázky.' });

      // 2) Zkontroluj každou zakázku — sbírej VŠECHNA chybějící pole
      const updates = zakazky.map(z => {
        const chyby = [];

        if (!z.id_zakazky || z.id_zakazky === 'null')
          chyby.push('ID zakázky');

        if (!z.prubeznа_doba || z.prubeznа_doba <= 0)
          chyby.push('průběžná doba');

        if (!z.stav || z.stav === 'null')
          chyby.push('stav zakázky');

        if (!z.termin_dodani || z.termin_dodani === 'null')
          chyby.push('termín dodání');

        if (!z.vyrobit_ks || z.vyrobit_ks <= 0)
          chyby.push('vyrobit kusů');

        return {
          id_zakazky:   z.id_zakazky,
          nazev:        z.nazev_zakazky,
          kontrola_dat: chyby.length ? chyby.join(', ') : 'ok',
        };
      });

      // 3) Zapiš výsledky zpět do DB (po jednom update přes id_zakazky + user_id)
      //    Supabase neumí bulk upsert přes composite PK bez upsert — uděláme
      //    jednotlivé updates v Promise.all (rychlé, paralelní)
      const writeResults = await Promise.all(
        updates.map(u =>
          sb.from('toc_zakazky')
            .update({ kontrola_dat: u.kontrola_dat, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('id_zakazky', u.id_zakazky)
        )
      );

      const writeErrors = writeResults.filter(r => r.error).map(r => r.error.message);

      const okCount  = updates.filter(u => u.kontrola_dat === 'ok').length;
      const errCount = updates.filter(u => u.kontrola_dat !== 'ok').length;

      return res.json({
        ok:        writeErrors.length === 0,
        checked:   updates.length,
        ok_count:  okCount,
        err_count: errCount,
        errors:    errCount === 0 ? [] : updates.filter(u => u.kontrola_dat !== 'ok').map(u => ({
          id:     u.id_zakazky,
          nazev:  u.nazev,
          chyby:  u.kontrola_dat,
        })),
        write_errors: writeErrors.length ? writeErrors : undefined,
      });
    }

    // ── Neznámá akce ──────────────────────────────────────────────────────────
    return res.status(400).json({ error: `Neznámá akce: ${action}` });

  } catch (err) {
    console.error('[toc-plan]', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
