// /api/toc — všechny TOC endpointy v jednom souboru
// Route: ?route=zakazky | hlavni-plan | plan | import
//
// Dřívější soubory: toc-zakazky.js, toc-hlavni-plan.js, toc-plan.js, toc-import.js

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { requireAuth }  from './lib/requireAuth.js';

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = await requireAuth(req, res);
  if (!auth) return;

  // Inject authoritative uid so all sub-handlers use it regardless of query/body
  if (req.query) req.query.userId = auth.uid;
  if (req.body)  req.body.userId  = auth.uid;

  const route = req.query.route || (req.body && req.body.route);

  if (route === 'zakazky')     return handleZakazky(req, res);
  if (route === 'hlavni-plan') return handleHlavniPlan(req, res);
  if (route === 'plan')        return handlePlan(req, res);
  if (route === 'import')      return handleImport(req, res);

  return res.status(400).json({ error: 'route required: zakazky | hlavni-plan | plan | import' });
}


// ── GET ?route=zakazky&userId=xxx ─────────────────────────────────
async function handleZakazky(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const db = sb();
    const [zakazkyRes, pracovistRes, parametryRes] = await Promise.all([
      db.from('toc_zakazky').select('*').eq('user_id', userId).order('termin_dodani', { ascending: true }),
      db.from('toc_pracoviste').select('id_pracoviste, nazev_pracoviste, poradi, kapacita_hod, vytizeni_ikony')
        .eq('user_id', userId).eq('aktivni', true).order('poradi'),
      db.from('toc_parametry').select('id_parametru, hodnota').eq('user_id', userId),
    ]);

    const parametry = {};
    for (const p of parametryRes.data || []) parametry[p.id_parametru] = Number(p.hodnota);

    const poradiMap = {};
    for (const p of pracovistRes.data || []) {
      if (p.poradi) poradiMap[String(p.poradi)] = p.nazev_pracoviste;
    }

    const today = new Date().toISOString().slice(0, 10);
    const zakazky = (zakazkyRes.data || []).map(z => {
      const zbyva   = z.vyrobit_ks - z.odvedeno_ks;
      const zpozdeni = z.termin_dodani < today
        ? Math.round((new Date(today) - new Date(z.termin_dodani)) / 86400000) : 0;
      const cas = Object.entries(z.cas_pracoviste || {})
        .map(([k, v]) => `${poradiMap[k] || 'P' + k}: ${v} min`).join(', ');
      return {
        id_zakazky: z.id_zakazky, nazev_zakazky: z.nazev_zakazky, typ_zakazky: z.typ_zakazky,
        vyrobit_ks: z.vyrobit_ks, odvedeno_ks: z.odvedeno_ks, zbyvа_ks: zbyva,
        termin_dodani: z.termin_dodani, planovane_zahajeni: z.planovane_zahajeni,
        planovane_ukonceni: z.planovane_ukonceni, prubeznа_doba: z.prubeznа_doba,
        stav: z.stav, zpozdeni_dny: zpozdeni, cas_pracoviste_txt: cas, kontrola_dat: z.kontrola_dat,
      };
    });
    return res.json({ zakazky, pracoviste: pracovistRes.data || [], parametry });
  } catch (err) {
    console.error('[toc/zakazky]', err);
    return res.status(500).json({ error: err.message });
  }
}


// ── GET ?route=hlavni-plan&userId=xxx&from=...&to=... ─────────────
async function handleHlavniPlan(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { userId, from, to } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    let q = sb().from('toc_hlavni_plan')
      .select('datum, plan_ks, uvolnene_ks, predvydane_ks, poznamka')
      .eq('user_id', userId).order('datum', { ascending: true });
    if (from) q = q.gte('datum', from);
    if (to)   q = q.lte('datum', to);

    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data: data || [] });
  } catch (err) {
    console.error('[toc/hlavni-plan]', err);
    return res.status(500).json({ error: err.message });
  }
}


// ── POST ?route=plan — kontrola | vytvor | kapacita ───────────────
async function handlePlan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  res.setHeader('Content-Type', 'application/json');
  try {
    const { action, userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!action) return res.status(400).json({ error: 'action required' });

    const db = sb();

    if (action === 'kontrola') {
      const { data: zakazky, error: fetchErr } = await db.from('toc_zakazky')
        .select('id_zakazky, nazev_zakazky, prubeznа_doba, stav, termin_dodani, vyrobit_ks')
        .eq('user_id', userId);
      if (fetchErr) throw fetchErr;
      if (!zakazky?.length) return res.json({ ok: true, checked: 0, err_count: 0, message: 'Žádné zakázky.' });

      const updates = zakazky.map(z => {
        const chyby = [];
        if (!z.id_zakazky || z.id_zakazky === 'null')       chyby.push('ID zakázky');
        if (!z.prubeznа_doba || z.prubeznа_doba <= 0)       chyby.push('průběžná doba');
        if (!z.stav || z.stav === 'null')                    chyby.push('stav zakázky');
        if (!z.termin_dodani || z.termin_dodani === 'null')  chyby.push('termín dodání');
        if (!z.vyrobit_ks || z.vyrobit_ks <= 0)             chyby.push('vyrobit kusů');
        return { id_zakazky: z.id_zakazky, nazev: z.nazev_zakazky, kontrola_dat: chyby.length ? chyby.join(', ') : 'ok' };
      });
      await Promise.all(updates.map(u =>
        db.from('toc_zakazky').update({ kontrola_dat: u.kontrola_dat, updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('id_zakazky', u.id_zakazky)
      ));
      const okCount = updates.filter(u => u.kontrola_dat === 'ok').length;
      return res.json({
        ok: true, checked: updates.length, ok_count: okCount, err_count: updates.length - okCount,
        errors: updates.filter(u => u.kontrola_dat !== 'ok').map(u => ({ id: u.id_zakazky, nazev: u.nazev, chyby: u.kontrola_dat })),
      });
    }

    if (action === 'vytvor') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: zakazky, error: zErr } = await db.from('toc_zakazky').select('*')
        .eq('user_id', userId).eq('kontrola_dat', 'ok').in('stav', ['plánovaná', 'rozpracovaná']);
      if (zErr) throw zErr;
      if (!zakazky?.length) return res.json({ ok: true, planned: 0, message: 'Žádné zakázky ke zplánování.' });

      const { data: pracoviste } = await db.from('toc_pracoviste')
        .select('id_pracoviste, nazev_pracoviste, poradi').eq('user_id', userId).eq('aktivni', true).order('poradi');
      const poradiMap = {};
      for (const p of pracoviste || []) { if (p.poradi != null) poradiMap[String(p.poradi)] = p.nazev_pracoviste; }

      const results = zakazky.map(z => {
        const zbyva_ks  = Math.max(0, (z.vyrobit_ks || 0) - (z.odvedeno_ks || 0));
        const ukonceni  = z.termin_dodani;
        const zahajeni  = subtractWorkingDays(ukonceni, z.prubeznа_doba);
        const endDate   = new Date(ukonceni); endDate.setHours(0, 0, 0, 0);
        const zpozdeniMs   = today.getTime() - endDate.getTime();
        const zpozdeni_dny = zpozdeniMs > 0 ? Math.ceil(zpozdeniMs / 86400000) : null;
        const casove_plneni_pct = zpozdeni_dny && z.prubeznа_doba > 0
          ? Math.round(zpozdeni_dny / z.prubeznа_doba * 100) : null;
        const cas_plan_txt = Object.entries(z.cas_pracoviste || {})
          .filter(([, v]) => v > 0).map(([k, v]) => `${poradiMap[k] || 'P' + k}: ${Math.round((v || 0) * zbyva_ks)} min`).join(', ');
        return {
          id_zakazky: z.id_zakazky,
          planovane_zahajeni: zahajeni.toISOString().slice(0, 10),
          planovane_ukonceni: ukonceni, zpozdeni_dny, casove_plneni_pct,
          updated_at: new Date().toISOString(), _cas_plan_txt: cas_plan_txt, _zbyva_ks: zbyva_ks,
        };
      });

      await Promise.all(results.map(r =>
        db.from('toc_zakazky').update({
          planovane_zahajeni: r.planovane_zahajeni, planovane_ukonceni: r.planovane_ukonceni,
          zpozdeni_dny: r.zpozdeni_dny, casove_plneni_pct: r.casove_plneni_pct, updated_at: r.updated_at,
        }).eq('user_id', userId).eq('id_zakazky', r.id_zakazky)
      ));

      const plan = results.sort((a, b) => b.planovane_zahajeni.localeCompare(a.planovane_zahajeni))
        .map(r => {
          const z = zakazky.find(x => x.id_zakazky === r.id_zakazky);
          return {
            id_zakazky: z.id_zakazky, nazev_zakazky: z.nazev_zakazky, typ_zakazky: z.typ_zakazky,
            vyrobit_ks: z.vyrobit_ks, odvedeno_ks: z.odvedeno_ks, zbyvа_ks: r._zbyva_ks,
            planovane_zahajeni: r.planovane_zahajeni, planovane_ukonceni: r.planovane_ukonceni,
            termin_dodani: z.termin_dodani, prubeznа_doba: z.prubeznа_doba,
            zpozdeni_dny: r.zpozdeni_dny ?? 0, stav: z.stav,
            cas_pracoviste_txt: r._cas_plan_txt, kontrola_dat: z.kontrola_dat,
          };
        });
      return res.json({ ok: true, planned: plan.length, plan });
    }

    if (action === 'kapacita') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const ONE_DAY = 86400000;
      const limit = req.body.limit ? Number(req.body.limit) : null;
      const { data: zakazky, error: zErr } = await db.from('toc_zakazky')
        .select('id_zakazky, nazev_zakazky, termin_dodani, prubeznа_doba, cas_pracoviste, vyrobit_ks, odvedeno_ks')
        .eq('user_id', userId).eq('kontrola_dat', 'ok')
        .in('stav', ['plánovaná', 'rozpracovaná'])
        .gt('termin_dodani', today.toISOString().slice(0, 10));
      if (zErr) throw zErr;

      let zakazkyKap = (zakazky || []).filter(z => z.cas_pracoviste && Object.keys(z.cas_pracoviste).length > 0);
      if (limit) zakazkyKap = zakazkyKap.slice(0, limit);
      if (!zakazkyKap.length) return res.json({ ok: true, rows: [], pracoviste: [], message: 'Žádné zakázky s budoucím termínem a kapacitními daty.' });

      const { data: pracoviste } = await db.from('toc_pracoviste')
        .select('id_pracoviste, nazev_pracoviste, poradi, smena_hod, pocet_smen, pocet_zdroju, kapacita_hod')
        .eq('user_id', userId).eq('aktivni', true).order('poradi');
      if (!pracoviste?.length) return res.json({ ok: true, rows: [], pracoviste: [], message: 'Žádná pracoviště.' });

      const tomorrow = new Date(today.getTime() + ONE_DAY);
      const maxEnd   = zakazkyKap.reduce((mx, z) => { const t = new Date(z.termin_dodani).getTime(); return t > mx ? t : mx; }, tomorrow.getTime());
      const DAYS_CS  = ['Ne','Po','Út','St','Čt','Pá','So'];
      const dates    = [];
      for (let ms = tomorrow.getTime(); ms <= maxEnd + 10 * ONE_DAY; ms += ONE_DAY) dates.push(new Date(ms));

      const wplaceResults = pracoviste.map(p => {
        const poradi  = String(p.poradi);
        const kapHod  = p.kapacita_hod || ((p.smena_hod || 8) * (p.pocet_smen || 1) * (p.pocet_zdroju || 1));
        const kapMin  = kapHod * 60;
        const loadMin = new Array(dates.length).fill(0);
        for (const z of zakazkyKap) {
          const totalMin = Math.round(((z.cas_pracoviste || {})[poradi] || 0) * Math.max(0, (z.vyrobit_ks || 0) - (z.odvedeno_ks || 0)));
          if (totalMin <= 0) continue;
          const ukonceni = new Date(z.termin_dodani); ukonceni.setHours(0, 0, 0, 0);
          const zahajeni = subtractWorkingDays(ukonceni, z.prubeznа_doba || 1);
          const winStart = today > zahajeni ? today : zahajeni;
          let zbyvaDni = 0;
          for (let ms = winStart.getTime(); ms < ukonceni.getTime(); ms += ONE_DAY) {
            if (!isNonWorkingDay(new Date(ms))) zbyvaDni++;
          }
          if (zbyvaDni <= 0) continue;
          const prumerMin = totalMin / zbyvaDni;
          for (let di = 0; di < dates.length; di++) {
            const d = dates[di];
            if (d < winStart || d >= ukonceni || isNonWorkingDay(d)) continue;
            loadMin[di] += prumerMin;
          }
        }
        const loadPct = dates.map((d, di) => isNonWorkingDay(d) ? null : (loadMin[di] > 0 ? Math.round(loadMin[di] / kapMin * 100) : 0));
        return { poradi: p.poradi, nazev: p.nazev_pracoviste, kapacita_hod: kapHod, loadPct };
      });

      const rows = dates.map((d, di) => ({
        datum:      `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`,
        datum_iso:  d.toISOString().slice(0, 10),
        dow:        DAYS_CS[d.getDay()],
        nepracovni: isNonWorkingDay(d),
        zatizeni:   wplaceResults.map(w => w.loadPct[di]),
      }));
      return res.json({
        ok: true, zakazky_count: zakazkyKap.length,
        zakazky_nazvy: zakazkyKap.map(z => z.id_zakazky),
        pracoviste: wplaceResults.map(w => ({ poradi: w.poradi, nazev: w.nazev, kapacita_hod: w.kapacita_hod })),
        rows,
      });
    }

    return res.status(400).json({ error: `Neznámá akce: ${action}` });
  } catch (err) {
    console.error('[toc/plan]', err);
    return res.status(500).json({ error: err.message, code: err.code });
  }
}


// ── GET/POST ?route=import ────────────────────────────────────────
async function handleImport(req, res) {
  res.setHeader('Content-Type', 'application/json');

  // GET = export CSV
  if (req.method === 'GET') {
    const { type, userId } = req.query || {};
    if (!userId || !type) return res.status(400).json({ error: 'userId a type required' });
    const db = sb();
    if (type === 'zakazky') {
      const { data: prac } = await db.from('toc_pracoviste')
        .select('poradi, nazev_pracoviste').eq('user_id', userId).eq('aktivni', true).order('poradi');
      const { data: rows } = await db.from('toc_zakazky').select('*').eq('user_id', userId)
        .not('id_zakazky', 'like', 'TEST-%').order('termin_dodani');
      const pracoviste = prac || [];
      const hlavicka = ['id_zakazky','nazev_zakazky','termin_dodani','prubeznа_doba',
        'vyrobit_ks','odvedeno_ks','stav','typ_zakazky', ...pracoviste.map(p => p.nazev_pracoviste.toLowerCase())].join(',');
      const radky = (rows || []).map(z => {
        const cas = z.cas_pracoviste || {};
        return [z.id_zakazky, `"${z.nazev_zakazky}"`, z.termin_dodani?.slice(0,10),
          z.prubeznа_doba, z.vyrobit_ks, z.odvedeno_ks, z.stav, z.typ_zakazky || 'výroba',
          ...pracoviste.map(p => cas[String(p.poradi)] || 0)].join(',');
      });
      const csv = [hlavicka, ...radky].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="zakazky.csv"');
      return res.send('﻿' + csv);
    }
    return res.status(400).json({ error: `Export pro typ '${type}' není podporován.` });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, userId, csv } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!type)   return res.status(400).json({ error: 'type required' });
    if (!csv)    return res.status(400).json({ error: 'csv required' });

    const db   = sb();
    const rows = parseCsv(csv);
    if (!rows.length) return res.status(400).json({ error: 'CSV je prázdné nebo má jen hlavičku.' });

    if (type === 'zakazky') {
      const { data: pracoviste } = await db.from('toc_pracoviste')
        .select('poradi, nazev_pracoviste').eq('user_id', userId).eq('aktivni', true);
      const nazevMap = {};
      for (const p of pracoviste || []) nazevMap[p.nazev_pracoviste.toLowerCase()] = String(p.poradi);

      const inserted = [], errors = [];
      for (const row of rows) {
        const id = row['id_zakazky'] || row['id'];
        if (!id) { errors.push({ row, reason: 'chybí id_zakazky' }); continue; }
        const pd = int(row['prubeznа_doba'] || row['prubezna_doba'] || row['pd'], 0);
        if (pd <= 0) { errors.push({ id, reason: 'chybí nebo nulová prubeznа_doba' }); continue; }
        const termin = row['termin_dodani'] || row['termin'];
        if (!termin) { errors.push({ id, reason: 'chybí termin_dodani' }); continue; }
        const vyrobit = int(row['vyrobit_ks'] || row['vyrobit'], 0);
        if (vyrobit <= 0) { errors.push({ id, reason: 'chybí nebo nulové vyrobit_ks' }); continue; }
        const cas = {};
        for (const [col, poradi] of Object.entries(nazevMap)) {
          const v = row[col]; if (v && parseFloat(v) > 0) cas[poradi] = parseFloat(v);
        }
        inserted.push({
          user_id: userId, id_zakazky: id, nazev_zakazky: row['nazev_zakazky'] || row['nazev'] || id,
          termin_dodani: termin, prubeznа_doba: pd, vyrobit_ks: vyrobit,
          odvedeno_ks: int(row['odvedeno_ks'] || row['odvedeno'], 0),
          stav: row['stav'] || 'plánovaná', typ_zakazky: row['typ_zakazky'] || row['typ'] || 'výroba',
          cas_pracoviste: Object.keys(cas).length ? cas : {}, kontrola_dat: null, updated_at: new Date().toISOString(),
        });
      }
      if (!inserted.length) return res.status(400).json({ error: 'Žádné platné řádky.' });
      const { error: delErr } = await db.from('toc_zakazky').delete().eq('user_id', userId);
      if (delErr) throw new Error(`DELETE failed: ${delErr.message}`);
      const BATCH = 100;
      for (let i = 0; i < inserted.length; i += BATCH) {
        const { error: insErr } = await db.from('toc_zakazky').insert(inserted.slice(i, i + BATCH));
        if (insErr) throw new Error(`INSERT failed: ${insErr.message}`);
      }
      return res.json({ ok: true, type, imported: inserted.length, errors: errors.length, error_list: errors });
    }

    if (type === 'pracoviste') {
      const inserted = [], errors = [];
      for (const row of rows) {
        const poradi = int(row['poradi'] || row['pořadí'] || row['poradi_'], 0);
        const nazev  = row['nazev'] || row['nazev_pracoviste'] || row['název_pracoviště'] || row['nazev_pracoviste_'];
        if (!poradi || !nazev) { errors.push({ row, reason: 'chybí poradi nebo nazev' }); continue; }
        inserted.push({
          user_id: userId, id_pracoviste: row['id_pracoviste'] || String(poradi), poradi,
          nazev_pracoviste: nazev,
          smena_hod:    num(row['smena_hod'] || row['směna_hod.'] || row['smena'], 8),
          pocet_smen:   int(row['pocet_smen'] || row['počet_směn'] || row['smeny'], 1),
          pocet_zdroju: int(row['pocet_zdroju'] || row['počet_zdrojů'] || row['zdroje'] || row['stroje'], 1),
          updated_at: new Date().toISOString(),
        });
      }
      if (!inserted.length) return res.status(400).json({ error: 'Žádné platné řádky.' });
      const { error: delErr } = await db.from('toc_pracoviste').delete().eq('user_id', userId);
      if (delErr) throw delErr;
      const { error: insErr } = await db.from('toc_pracoviste').insert(inserted);
      if (insErr) throw insErr;
      return res.json({ ok: true, type, imported: inserted.length, errors: errors.length, error_list: errors });
    }

    if (type === 'parametry') {
      const inserted = [], errors = [];
      for (const row of rows) {
        const klic = row['klic'] || row['key'] || row['parametr'];
        if (!klic) { errors.push({ row, reason: 'chybí klic' }); continue; }
        inserted.push({
          user_id: userId, id_parametru: klic,
          parametr: row['popis'] || row['parametr'] || row['description'] || klic,
          hodnota: row['hodnota'] || row['value'] || '', updated_at: new Date().toISOString(),
        });
      }
      if (!inserted.length) return res.status(400).json({ error: 'Žádné platné řádky.' });
      const { error: delErr } = await db.from('toc_parametry').delete().eq('user_id', userId);
      if (delErr) throw delErr;
      const { error: insErr } = await db.from('toc_parametry').insert(inserted);
      if (insErr) throw insErr;
      return res.json({ ok: true, type, imported: inserted.length, errors: errors.length, error_list: errors });
    }

    return res.status(400).json({ error: `Neznámý typ: ${type}` });
  } catch (err) {
    console.error('[toc/import]', err);
    return res.status(500).json({ error: err.message, code: err.code });
  }
}


// ── Kalendářní utility (přesunuty z toc-plan.js) ─────────────────
function easterSunday(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,
        f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
        i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
        month=Math.floor((h+l-7*m+114)/31)-1,day=((h+l-7*m+114)%31)+1;
  return new Date(year,month,day);
}
function isNonWorkingDay(date) {
  const dow=date.getDay(); if(dow===0||dow===6) return true;
  const m=date.getMonth()+1,dd=date.getDate(),y=date.getFullYear();
  if(m===1&&dd===1||m===5&&dd===1||m===5&&dd===8||m===7&&dd===5||m===7&&dd===6||
     m===9&&dd===28||m===10&&dd===28||m===11&&dd===17||m===12&&dd===24||
     m===12&&dd===25||m===12&&dd===26) return true;
  const easter=easterSunday(y);
  const gf=new Date(easter); gf.setDate(easter.getDate()-2);
  const em=new Date(easter); em.setDate(easter.getDate()+1);
  const ds=`${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
  return ds===gf.toISOString().slice(0,10)||ds===em.toISOString().slice(0,10);
}
function subtractWorkingDays(fromDate,workingDays) {
  const d=new Date(fromDate); d.setHours(0,0,0,0); let remaining=workingDays;
  while(remaining>0){ d.setDate(d.getDate()-1); if(!isNonWorkingDay(d)) remaining--; }
  return d;
}

// ── CSV utility (přesunuto z toc-import.js) ──────────────────────
function parseCsv(text) {
  const lines=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim()!=='');
  if(lines.length<2) return [];
  const delim=(lines[0].split(';').length>lines[0].split(',').length)?';':',';
  const headers=splitCsvRow(lines[0],delim).map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map(line=>{ const vals=splitCsvRow(line,delim),row={};
    headers.forEach((h,i)=>{ row[h]=(vals[i]??'').trim(); }); return row; });
}
function splitCsvRow(line,delim=',') {
  const result=[]; let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i]; if(ch==='"'){inQ=!inQ;continue;} if(ch===delim&&!inQ){result.push(cur);cur='';continue;} cur+=ch;
  } result.push(cur); return result;
}
function num(v,def=0){ const n=parseFloat(v); return isNaN(n)?def:n; }
function int(v,def=0){ const n=parseInt(v,10); return isNaN(n)?def:n; }
