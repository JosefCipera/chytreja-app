// update-norbekov.js – smaže staré Norbekov záznamy a vloží nové z XLSX
import 'dotenv/config';
import { readFileSync } from 'fs';
import { read, utils } from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const VIDEO_ID = 'ARZkhlxoqYY';
const SOURCE   = 'Norbekov – Kloubní Gymnastika';

const NODE_MAP = {
  POHYB:  'mobilita',
  STABIL: 'stabilita',
  KARDIO: 'kardio',
  MYSL:   'mysl',
};

// Excel časový zlomek → celé sekundy
function excelTimeToSec(v) {
  return Math.round(v * 86400);
}

// Excel časový zlomek → délka v minutách (min 1)
function durMin(start, end) {
  return Math.max(1, Math.round((end - start) * 1440));
}

// Načti XLSX
const wb = read(readFileSync('scripts/Norbekov Protocol 2.0 pro Supabase.xlsx'));
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { header: 1 }).slice(1); // přeskoč header

const exercises = rows.map(r => ({
  id_csv:   r[0],
  uzel:     r[1],
  nazev:    r[2],
  startSec: excelTimeToSec(r[3]),
  endSec:   excelTimeToSec(r[4]),
  popis:    String(r[5] || '').replace(/^"|"$/g, '').trim(),
  durMin:   durMin(r[3], r[4]),
}));

const records = [
  // Celé video
  {
    node_id:      'mobilita',
    title:        'Norbekov – Kloubní Gymnastika (celé video)',
    type:         'video',
    url:          `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    summary:      'Kompletní kloubní gymnastika od hlavy po chodidla. Ideální ranní rutina.',
    tags:         ['norbekov', 'klouby', 'celé video', 'ranní rutina'],
    lang:         'cs',
    duration_min: 30,
    source:       SOURCE,
  },
  // Jednotlivé cviky
  ...exercises.map(ex => ({
    node_id:      NODE_MAP[ex.uzel] || 'mobilita',
    title:        `Norbekov – ${ex.nazev}`,
    type:         'video',
    url:          `https://www.youtube.com/watch?v=${VIDEO_ID}&t=${ex.startSec}s`,
    summary:      ex.popis,
    tags:         ['norbekov', 'klouby', NODE_MAP[ex.uzel] || 'mobilita'],
    lang:         'cs',
    duration_min: ex.durMin,
    source:       SOURCE,
  })),
];

async function run() {
  // 1. Smaž staré záznamy
  console.log('🗑️  Mažu staré Norbekov záznamy...');
  const { error: delErr, count } = await sb
    .from('longevity_media')
    .delete({ count: 'exact' })
    .eq('source', SOURCE);

  if (delErr) {
    console.error('❌ Chyba při mazání:', delErr.message);
    process.exit(1);
  }
  console.log(`   Smazáno: ${count ?? '?'} záznamů`);

  // 2. Vlož nové
  console.log(`📦 Vkládám ${records.length} záznamů (1 celé video + ${exercises.length} cviků)...`);
  const { data, error: insErr } = await sb
    .from('longevity_media')
    .insert(records)
    .select('id, node_id, title, url');

  if (insErr) {
    console.error('❌ Chyba při vkládání:', insErr.message);
    process.exit(1);
  }

  console.log(`✅ Vloženo ${data.length} záznamů:`);
  data.forEach(r => {
    const t = new URL(r.url).searchParams.get('t') || '(celé)';
    console.log(`  [${r.node_id}] ${r.title}  → t=${t}`);
  });
}

run();
