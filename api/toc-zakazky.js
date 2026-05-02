// GET /api/toc-zakazky?userId=xxx
// Returns zakázky + pracoviště mapping for TOC Výroba plan

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Content-Type', 'application/json');

  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const [zakazkyRes, pracovistRes] = await Promise.all([
      sb.from('toc_zakazky')
        .select('*')
        .eq('user_id', userId)
        .order('termin_dodani', { ascending: true }),
      sb.from('toc_pracoviste')
        .select('id_pracoviste, nazev_pracoviste, poradi, kapacita_hod, vytizeni_ikony')
        .eq('user_id', userId)
        .eq('aktivni', true)
        .order('poradi'),
    ]);

    // Map poradi → nazev for cas_pracoviste display
    const poradiMap = {};
    for (const p of pracovistRes.data || []) {
      if (p.poradi) poradiMap[String(p.poradi)] = p.nazev_pracoviste;
    }

    const today = new Date().toISOString().slice(0, 10);

    const zakazky = (zakazkyRes.data || []).map(z => {
      const zbyva = z.vyrobit_ks - z.odvedeno_ks;
      const termin = z.termin_dodani;
      const zpozdeni = termin < today ? Math.round((new Date(today) - new Date(termin)) / 86400000) : 0;
      // Format cas_pracoviste as "Brusky: 22 min, Laser: 450 min"
      const cas = Object.entries(z.cas_pracoviste || {})
        .map(([k, v]) => `${poradiMap[k] || 'P' + k}: ${v} min`)
        .join(', ');
      return {
        id_zakazky:         z.id_zakazky,
        nazev_zakazky:      z.nazev_zakazky,
        typ_zakazky:        z.typ_zakazky,
        vyrobit_ks:         z.vyrobit_ks,
        odvedeno_ks:        z.odvedeno_ks,
        zbyvа_ks:           zbyva,
        termin_dodani:      z.termin_dodani,
        planovane_zahajeni: z.planovane_zahajeni,
        planovane_ukonceni: z.planovane_ukonceni,
        prubeznа_doba:      z.prubeznа_doba,
        stav:               z.stav,
        zpozdeni_dny:       zpozdeni,
        cas_pracoviste_txt: cas,
        kontrola_dat:       z.kontrola_dat,
      };
    });

    return res.json({ zakazky, pracoviste: pracovistRes.data || [] });

  } catch (err) {
    console.error('[toc-zakazky]', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
