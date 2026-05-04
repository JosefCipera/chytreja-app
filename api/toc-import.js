// POST /api/toc-import
// Body: { type: 'zakazky'|'pracoviste'|'parametry', userId, csv: '...' }
//
// Parsuje CSV z ERP a upsertuje do příslušné DB tabulky.
// prubeznа_doba musí přijít z ERP — nikdy se nepočítá.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// ── CSV parser ────────────────────────────────────────────────────────────────
// Jednoduchý parser pro RFC 4180 CSV (bez vnořených uvozovek přes více řádků)
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim() !== '');
  if (nonEmpty.length < 2) return [];

  // Auto-detect delimiter: středník (;) nebo čárka (,)
  const firstLine = nonEmpty[0];
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

  const headers = splitCsvRow(firstLine, delim).map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_')  // "nazev pracoviste" → "nazev_pracoviste"
  );
  const rows = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const vals = splitCsvRow(nonEmpty[i], delim);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCsvRow(line, delim = ',') {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === delim && !inQ) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function num(v, def = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}
function int(v, def = 0) {
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  // GET → export dat jako CSV
  if (req.method === 'GET') {
    const { type, userId } = req.query || {};
    if (!userId || !type) return res.status(400).json({ error: 'userId a type required' });

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (type === 'zakazky') {
      const { data: prac } = await sb.from('toc_pracoviste')
        .select('poradi, nazev_pracoviste').eq('user_id', userId).eq('aktivni', true).order('poradi');
      const { data: rows } = await sb.from('toc_zakazky')
        .select('*').eq('user_id', userId)
        .not('id_zakazky', 'like', 'TEST-%')
        .order('termin_dodani');

      const pracoviste = (prac || []);
      const hlavicka = ['id_zakazky','nazev_zakazky','termin_dodani','prubeznа_doba',
        'vyrobit_ks','odvedeno_ks','stav','typ_zakazky',
        ...pracoviste.map(p => p.nazev_pracoviste.toLowerCase())].join(',');

      const radky = (rows || []).map(z => {
        const cas = z.cas_pracoviste || {};
        const prac_vals = pracoviste.map(p => cas[String(p.poradi)] || 0);
        return [z.id_zakazky, `"${z.nazev_zakazky}"`, z.termin_dodani?.slice(0,10),
          z.prubeznа_doba, z.vyrobit_ks, z.odvedeno_ks, z.stav, z.typ_zakazky || 'výroba',
          ...prac_vals].join(',');
      });

      const csv = [hlavicka, ...radky].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="zakazky.csv"');
      return res.send('﻿' + csv); // BOM pro Excel
    }

    return res.status(400).json({ error: `Export pro typ '${type}' není podporován.` });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, userId, csv } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!type)   return res.status(400).json({ error: 'type required (zakazky|pracoviste|parametry)' });
    if (!csv)    return res.status(400).json({ error: 'csv required' });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const rows = parseCsv(csv);
    if (!rows.length) return res.status(400).json({ error: 'CSV je prázdné nebo má jen hlavičku.' });

    // ── ZAKÁZKY ──────────────────────────────────────────────────────────────
    if (type === 'zakazky') {
      // Načti pracoviště pro dynamické mapování názvu → poradi
      const { data: pracoviste } = await sb
        .from('toc_pracoviste')
        .select('poradi, nazev_pracoviste')
        .eq('user_id', userId)
        .eq('aktivni', true);

      // mapa: "brusky" → 1, "soustruhy" → 2, atd.
      const nazevMap = {};
      for (const p of pracoviste || []) {
        nazevMap[p.nazev_pracoviste.toLowerCase()] = String(p.poradi);
      }

      const inserted = [], errors = [];

      for (const row of rows) {
        const id = row['id_zakazky'] || row['id'];
        if (!id) { errors.push({ row, reason: 'chybí id_zakazky' }); continue; }

        // prubeznа_doba je konstanta z ERP — musí být v souboru
        const pd = int(row['prubeznа_doba'] || row['prubezna_doba'] || row['pd'], 0);
        if (pd <= 0) { errors.push({ id, reason: 'chybí nebo nulová prubeznа_doba' }); continue; }

        const termin = row['termin_dodani'] || row['termin'];
        if (!termin) { errors.push({ id, reason: 'chybí termin_dodani' }); continue; }

        const vyrobit = int(row['vyrobit_ks'] || row['vyrobit'], 0);
        if (vyrobit <= 0) { errors.push({ id, reason: 'chybí nebo nulové vyrobit_ks' }); continue; }

        // Sestav cas_pracoviste z pojmenovaných sloupců
        const cas = {};
        for (const [col, poradi] of Object.entries(nazevMap)) {
          const v = row[col];
          if (v && parseFloat(v) > 0) cas[poradi] = parseFloat(v);
        }

        inserted.push({
          user_id:         userId,
          id_zakazky:      id,
          nazev_zakazky:   row['nazev_zakazky'] || row['nazev'] || id,
          termin_dodani:   termin,
          prubeznа_doba:   pd,          // konstanta z ERP
          vyrobit_ks:      vyrobit,
          odvedeno_ks:     int(row['odvedeno_ks'] || row['odvedeno'], 0),
          stav:            row['stav'] || 'plánovaná',
          typ_zakazky:     row['typ_zakazky'] || row['typ'] || 'výroba',
          cas_pracoviste:  Object.keys(cas).length ? cas : {},
          kontrola_dat:    null,        // resetovat — bude znovu zkontrolováno
          updated_at:      new Date().toISOString(),
        });
      }

      if (!inserted.length) {
        return res.status(400).json({ error: 'Žádné platné řádky — stará data zachována.' });
      }

      // Vymaž stará data, vlož nová
      const { error: delErr } = await sb.from('toc_zakazky').delete().eq('user_id', userId);
      if (delErr) { const e = new Error(`DELETE failed: ${delErr.message}`); e.code = delErr.code; throw e; }

      // Vkládej po dávkách (Supabase má limit ~1000, ale pro jistotu po 100)
      const BATCH = 100;
      for (let i = 0; i < inserted.length; i += BATCH) {
        const batch = inserted.slice(i, i + BATCH);
        const { error: insErr } = await sb.from('toc_zakazky').insert(batch);
        if (insErr) { const e = new Error(`INSERT batch ${i}–${i+batch.length} failed: ${insErr.message} | ${insErr.details}`); e.code = insErr.code; throw e; }
      }

      return res.json({
        ok: true, type,
        imported: inserted.length,
        errors:   errors.length,
        error_list: errors,
        message: `Import zakázek: ${inserted.length} vloženo, ${errors.length} chyb.`,
      });
    }

    // ── PRACOVIŠTĚ ───────────────────────────────────────────────────────────
    if (type === 'pracoviste') {
      const inserted = [], errors = [];

      for (const row of rows) {
        const poradi = int(row['poradi'] || row['pořadí'] || row['poradi_'], 0);
        const nazev  = row['nazev'] || row['nazev_pracoviste'] || row['název_pracoviště'] || row['nazev_pracoviste_'];
        if (!poradi || !nazev) { errors.push({ row, reason: 'chybí poradi nebo nazev' }); continue; }

        const id_prac = row['id_pracoviste'] || String(poradi);

        inserted.push({
          user_id:          userId,
          id_pracoviste:    id_prac,
          poradi:           poradi,
          nazev_pracoviste: nazev,
          smena_hod:        num(row['smena_hod'] || row['směna_hod.'] || row['smena_hod.'] || row['smena'], 8),
          pocet_smen:       int(row['pocet_smen'] || row['počet_směn'] || row['pocet_smen_'] || row['smeny'], 1),
          pocet_zdroju:     int(row['pocet_zdroju'] || row['počet_zdrojů'] || row['pocet_zdroju_'] || row['zdroje'] || row['stroje'], 1),
          updated_at:       new Date().toISOString(),
        });
      }

      if (!inserted.length) {
        return res.status(400).json({ error: 'Žádné platné řádky — stará data zachována.' });
      }

      // Vymaž stará data, vlož nová
      const { error: delErr } = await sb.from('toc_pracoviste').delete().eq('user_id', userId);
      if (delErr) throw delErr;
      const { error: insErr } = await sb.from('toc_pracoviste').insert(inserted);
      if (insErr) throw insErr;

      return res.json({
        ok: true, type,
        imported: inserted.length,
        errors:   errors.length,
        error_list: errors,
        message: `Import pracovišť: ${inserted.length} vloženo, ${errors.length} chyb.`,
      });
    }

    // ── PARAMETRY ────────────────────────────────────────────────────────────
    if (type === 'parametry') {
      const inserted = [], errors = [];

      for (const row of rows) {
        const klic = row['klic'] || row['key'] || row['parametr'];
        if (!klic) { errors.push({ row, reason: 'chybí klic' }); continue; }
        inserted.push({
          user_id:      userId,
          id_parametru: klic,
          parametr:     row['popis'] || row['parametr'] || row['description'] || klic,
          hodnota:      row['hodnota'] || row['value'] || '',
          updated_at:   new Date().toISOString(),
        });
      }

      if (!inserted.length) {
        return res.status(400).json({ error: 'Žádné platné řádky — stará data zachována.' });
      }

      // Vymaž stará data, vlož nová
      const { error: delErr } = await sb.from('toc_parametry').delete().eq('user_id', userId);
      if (delErr) throw delErr;
      const { error: insErr } = await sb.from('toc_parametry').insert(inserted);
      if (insErr) throw insErr;

      return res.json({
        ok: true, type,
        imported: inserted.length,
        errors:   errors.length,
        error_list: errors,
        message: `Import parametrů: ${inserted.length} vloženo/aktualizováno, ${errors.length} chyb.`,
      });
    }

    return res.status(400).json({ error: `Neznámý typ: ${type}` });

  } catch (err) {
    console.error('[toc-import]', err);
    // Supabase errors have .message, .code, .details, .hint
    const detail = err.message || err.details || err.hint || JSON.stringify(err);
    return res.status(500).json({ error: 'Internal error', message: detail, code: err.code, hint: err.hint });
  }
}
