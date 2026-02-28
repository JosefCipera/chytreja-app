/**
 * insert-videos.js
 * Inserts curated YouTube videos into longevity_media table.
 * Skips duplicates (checks by URL).
 *
 * Run: node scripts/insert-videos.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Video manifest ─────────────────────────────────────────────────────────────
const VIDEOS = [
  // ── DLOUHOVĚKOST (hlavní uzel) ────────────────────────────────────────────
  {
    node_id: 'dlouhovekost',
    title: 'Pohyb, výživa a hormony pro vitalitu a dlouhověkost – Dr. Peter Attia',
    url: 'https://www.youtube.com/watch?v=DTCmprPCDqc',
    type: 'video',
    summary: 'Attia jako host u Hubermana. Celý jeho framework dlouhověkosti – pohyb, výživa, hormony, healthspan vs. lifespan. Nejlepší úvod do jeho myšlení.',
    duration_min: 170,
    source: 'Huberman Lab #85',
  },
  {
    node_id: 'dlouhovekost',
    title: 'Čtyři jezdci apokalypsy: obezita, cukrovka, rakovina – Dr. Peter Attia',
    url: 'https://www.youtube.com/watch?v=5-vZMmoZ2SI',
    type: 'video',
    summary: 'Attia u Jordana Petersona. Přístupně vysvětluje čtyři hlavní příčiny chronické nemoci a předčasné smrti. Skvělý úvod do Medicine 3.0.',
    duration_min: 118,
    source: 'Jordan B. Peterson Podcast #360',
  },

  // ── TĚLO ──────────────────────────────────────────────────────────────────
  {
    node_id: 'telo',
    title: 'Jak budovat sílu, svalovou hmotu a vytrvalost – Dr. Andy Galpin',
    url: 'https://www.youtube.com/watch?v=IAnhFUUCq6c',
    type: 'video',
    summary: 'Věda o silovém tréninku – protokoly, počty sérií, periodizace, regenerace. Galpin je přední výzkumník svalové fyziologie.',
    duration_min: 180,
    source: 'Huberman Lab #65',
  },
  {
    node_id: 'telo',
    title: 'Jak optimalizovat tréninkový plán pro zdraví a dlouhověkost – Dr. Andy Galpin',
    url: 'https://www.youtube.com/watch?v=UIy-WQCZd4M',
    type: 'video',
    summary: 'Tréninkový plán speciálně zaměřený na dlouhověkost – jak kombinovat sílu, zónu 2 a regeneraci pro funkční zdraví ve stáří.',
    duration_min: 185,
    source: 'Huberman Lab – Galpin Series část 4',
  },

  // ── MYSL ──────────────────────────────────────────────────────────────────
  {
    node_id: 'mysl',
    title: 'Ovládni spánek a buď více čilý za bdění – Andrew Huberman',
    url: 'https://www.youtube.com/watch?v=nm1TxQj9IsQ',
    type: 'video',
    summary: 'Základní epizoda o spánku – cirkadiánní rytmus, světlo, adenosin, melatonin. Nejposlouchanější vědecký podcast o spánku.',
    duration_min: 99,
    source: 'Huberman Lab #2',
  },
  {
    node_id: 'mysl',
    title: 'Spánkový toolkit: nástroje pro optimalizaci spánku – Andrew Huberman',
    url: 'https://www.youtube.com/watch?v=h2aWYjSA1Jc',
    type: 'video',
    summary: 'Praktický návod na zlepšení spánku – behaviorální protokoly, doplňky, načasování. Pokračování základní spánkové epizody.',
    duration_min: 90,
    source: 'Huberman Lab #84',
  },

  // ── VÝŽIVA ────────────────────────────────────────────────────────────────
  {
    node_id: 'vyziva',
    title: 'Věda o stravování pro zdraví, hubnutí a svaly – Dr. Layne Norton',
    url: 'https://www.youtube.com/watch?v=K4Ze-Sp6aUE',
    type: 'video',
    summary: 'Nejkomplexnější nutriční epizoda na Huberman Lab. Protein, energetická bilance, srovnání diet (keto, vegan, omnivore). Rigorózní věda.',
    duration_min: 227,
    source: 'Huberman Lab #97',
  },

  // ── ZDRAVÍ ────────────────────────────────────────────────────────────────
  {
    node_id: 'zdravi',
    title: 'Doplňky stravy pro dlouhověkost a jejich účinnost – Dr. Peter Attia',
    url: 'https://www.youtube.com/watch?v=79p1X_7rAMo',
    type: 'video',
    summary: 'Attia hodnotí vědecké důkazy za NAD+, rapamycin, resveratrol a další. Metabolické a preventivní zdraví z pohledu Medicine 3.0.',
    duration_min: 148,
    source: 'Huberman Lab #187',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎬 Vkládání YouTube videí do longevity_media\n');

  // Load existing to skip duplicates
  const { data: existing } = await supabase
    .from('longevity_media')
    .select('url');

  const existingUrls = new Set((existing || []).map(r => r.url));

  let inserted = 0;
  let skipped = 0;

  for (const v of VIDEOS) {
    if (existingUrls.has(v.url)) {
      console.log(`  ⏭  SKIP (již existuje): "${v.title.substring(0, 60)}…"`);
      skipped++;
      continue;
    }

    const { error } = await supabase
      .from('longevity_media')
      .insert({
        node_id:      v.node_id,
        title:        v.title,
        url:          v.url,
        type:         v.type,
        summary:      v.summary,
        lang:         'cs',
        source:       v.source,
      });

    if (error) {
      console.log(`  ❌ CHYBA: "${v.title.substring(0, 50)}" – ${error.message}`);
    } else {
      console.log(`  ✅ [${v.node_id}] "${v.title.substring(0, 60)}"`);
      inserted++;
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`➕ Vloženo:     ${inserted} videí`);
  console.log(`⏭  Přeskočeno:  ${skipped} (duplicity)`);
  console.log('─────────────────────────────────\n');
}

main().catch(console.error);
