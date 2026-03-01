/**
 * upload-content.js
 * Uploads all longevity .md files to Supabase Storage (sokrates-content bucket)
 * and syncs longevity_articles table with correct Storage URLs.
 *
 * Run: node scripts/upload-content.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'sokrates-content';
const BASE = 'app/content/longevity';

// ── File manifest ─────────────────────────────────────────────────────────────
// local: path relative to project root
// storage: path inside bucket (under longevity/)
// node_id: which node this belongs to
// addToDB: true = insert/update in longevity_articles (false = just upload)
const FILES = [
  // ── TĚLO ─────────────────────────────────────────────────────────────────
  {
    local:   `${BASE}/docs/dlouhovekost/telo/centenarian-decathlon.md`,
    storage: 'longevity/telo/centenarian-decathlon.md',
    node_id: 'telo',
    addToDB: true,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/sila-proti-starnuti.md`,
    storage: 'longevity/telo/sila-proti-starnuti.md',
    node_id: 'telo',
    addToDB: true,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/telo-exercise.md`,
    storage: 'longevity/telo/telo-exercise.md',
    node_id: 'telo',
    addToDB: true,
  },
  {
    local:   `${BASE}/clanky/telo/svaly-organ-dlouhovekosti.md`,
    storage: 'longevity/telo/svaly-organ-dlouhovekosti.md',
    node_id: 'telo',
    addToDB: true,
  },
  {
    local:   `${BASE}/clanky/telo/zone2-pruvodce.md`,
    storage: 'longevity/telo/zone2-pruvodce.md',
    node_id: 'telo',
    addToDB: true,
  },
  // stubs – upload only, user rozhodne
  {
    local:   `${BASE}/docs/dlouhovekost/telo/pohyb.md`,
    storage: 'longevity/telo/pohyb.md',
    node_id: 'telo',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/sila.md`,
    storage: 'longevity/telo/sila.md',
    node_id: 'telo',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/vo2max.md`,
    storage: 'longevity/telo/vo2max.md',
    node_id: 'telo',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/zone2.md`,
    storage: 'longevity/telo/zone2.md',
    node_id: 'telo',
    addToDB: false,
  },
  // dýchání (v rámci těla)
  {
    local:   `${BASE}/docs/dlouhovekost/telo/dychani/uvod.md`,
    storage: 'longevity/telo/dychani/uvod.md',
    node_id: 'telo',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/dychani/buteyko.md`,
    storage: 'longevity/telo/dychani/buteyko.md',
    node_id: 'telo',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/dychani/dechova-koherence.md`,
    storage: 'longevity/telo/dychani/dechova-koherence.md',
    node_id: 'telo',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/telo/dychani/nosni-dychani.md`,
    storage: 'longevity/telo/dychani/nosni-dychani.md',
    node_id: 'telo',
    addToDB: false,
  },

  // ── ZDRAVÍ / SPÁNEK ───────────────────────────────────────────────────────
  {
    local:   `${BASE}/docs/dlouhovekost/zdravi/spanek/spanek.md`,
    storage: 'longevity/zdravi/spanek/spanek.md',
    node_id: 'zdravi',
    addToDB: true,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/zdravi/spanek/spanek-hygiena.md`,
    storage: 'longevity/zdravi/spanek/spanek-hygiena.md',
    node_id: 'zdravi',
    addToDB: true,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/zdravi/spanek/spanek-chronotypy.md`,
    storage: 'longevity/zdravi/spanek/spanek-chronotypy.md',
    node_id: 'zdravi',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/zdravi/spanek/zaklady-zdravi.md`,
    storage: 'longevity/zdravi/spanek/zaklady-zdravi.md',
    node_id: 'zdravi',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/zdravi/spanek/jak-lepe-spat.md`,
    storage: 'longevity/zdravi/spanek/jak-lepe-spat.md',
    node_id: 'zdravi',
    addToDB: false,
  },

  // ── VÝŽIVA ────────────────────────────────────────────────────────────────
  {
    local:   `${BASE}/docs/dlouhovekost/vyziva/bilkoviny.md`,
    storage: 'longevity/vyziva/bilkoviny.md',
    node_id: 'vyziva',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/vyziva/glukoza.md`,
    storage: 'longevity/vyziva/glukoza.md',
    node_id: 'vyziva',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/vyziva/principy-vyzivy.md`,
    storage: 'longevity/vyziva/principy-vyzivy.md',
    node_id: 'vyziva',
    addToDB: false,
  },
  {
    local:   `${BASE}/docs/dlouhovekost/vyziva/pust.md`,
    storage: 'longevity/vyziva/pust.md',
    node_id: 'vyziva',
    addToDB: false,
  },

  // ── MYSL ──────────────────────────────────────────────────────────────────
  {
    local:   `${BASE}/docs/dlouhovekost/mysl/odolnost.md`,
    storage: 'longevity/mysl/odolnost.md',
    node_id: 'mysl',
    addToDB: false,
  },

  // ── ÚVOD (hlavní uzel) ────────────────────────────────────────────────────
  {
    local:   `${BASE}/docs/dlouhovekost/uvod/uvod-dlouhovekost.md`,
    storage: 'longevity/uvod/uvod-dlouhovekost.md',
    node_id: 'dlouhovekost',
    addToDB: false,
  },

  // ── NOVÉ ČESKÉ ČLÁNKY (Attia framework) ───────────────────────────────────
  {
    local:   `${BASE}/clanky/dlouhovekost/stolety-desetibojar.md`,
    storage: 'longevity/dlouhovekost/stolety-desetibojar.md',
    node_id: 'dlouhovekost',
    addToDB: true,
  },
  {
    local:   `${BASE}/clanky/telo/sila-a-svaly-jako-pojistka.md`,
    storage: 'longevity/telo/sila-a-svaly-jako-pojistka.md',
    node_id: 'telo',
    addToDB: true,
  },
  {
    local:   `${BASE}/clanky/mysl/mozek-na-dlouhou-trat.md`,
    storage: 'longevity/mysl/mozek-na-dlouhou-trat.md',
    node_id: 'mysl',
    addToDB: true,
  },
  {
    local:   `${BASE}/clanky/vyziva/jist-pro-sto-let.md`,
    storage: 'longevity/vyziva/jist-pro-sto-let.md',
    node_id: 'vyziva',
    addToDB: true,
  },
  {
    local:   `${BASE}/clanky/zdravi/prevence-metabolismus-markery.md`,
    storage: 'longevity/zdravi/prevence-metabolismus-markery.md',
    node_id: 'zdravi',
    addToDB: true,
  },

  // ── DECATHLON UZLY – SÍLA ────────────────────────────────────────────────
  { local: `${BASE}/clanky/sila/sila-jako-pojistka-dlouhovekosti.md`,   storage: 'longevity/sila/sila-jako-pojistka-dlouhovekosti.md',   node_id: 'sila',   addToDB: true },
  { local: `${BASE}/clanky/sila/sarkopenie-tichy-zlodej.md`,            storage: 'longevity/sila/sarkopenie-tichy-zlodej.md',            node_id: 'sila',   addToDB: true },

  // ── VÝDRŽ ────────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/vytrvalost/vo2max-cislo-ktere-rozhoduje.md`,      storage: 'longevity/vytrvalost/vo2max-cislo-ktere-rozhoduje.md',      node_id: 'vytrvalost', addToDB: true },
  { local: `${BASE}/clanky/vytrvalost/zona2-zaklad-aerobniho-zdravi.md`,     storage: 'longevity/vytrvalost/zona2-zaklad-aerobniho-zdravi.md',     node_id: 'vytrvalost', addToDB: true },

  // ── MOBILITA ─────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/mobilita/mobilita-neznamena-jen-strecink.md`,  storage: 'longevity/mobilita/mobilita-neznamena-jen-strecink.md',  node_id: 'mobilita', addToDB: true },
  { local: `${BASE}/clanky/mobilita/klouby-a-chrupavky-jak-je-udrzet.md`, storage: 'longevity/mobilita/klouby-a-chrupavky-jak-je-udrzet.md', node_id: 'mobilita', addToDB: true },

  // ── STABILITA ────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/stabilita/stabilita-zaklad-ktery-vsechno-drzi.md`, storage: 'longevity/stabilita/stabilita-zaklad-ktery-vsechno-drzi.md', node_id: 'stabilita', addToDB: true },
  { local: `${BASE}/clanky/stabilita/bolesti-zad-a-jak-jim-predchazet.md`,    storage: 'longevity/stabilita/bolesti-zad-a-jak-jim-predchazet.md',    node_id: 'stabilita', addToDB: true },

  // ── ROVNOVÁHA ────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/rovnovaha/rovnovaha-a-pad-nejvetsi-riziko-stari.md`,    storage: 'longevity/rovnovaha/rovnovaha-a-pad-nejvetsi-riziko-stari.md',    node_id: 'rovnovaha', addToDB: true },
  { local: `${BASE}/clanky/rovnovaha/propriocepce-smysl-ktery-zachranuje-zivot.md`, storage: 'longevity/rovnovaha/propriocepce-smysl-ktery-zachranuje-zivot.md', node_id: 'rovnovaha', addToDB: true },

  // ── KARDIO ───────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/kardio/srdce-jako-sval-ktery-trenujes.md`,          storage: 'longevity/kardio/srdce-jako-sval-ktery-trenujes.md',          node_id: 'kardio', addToDB: true },
  { local: `${BASE}/clanky/kardio/apob-a-ateroskleroze-co-opravdu-skodi-cevam.md`, storage: 'longevity/kardio/apob-a-ateroskleroze-co-opravdu-skodi-cevam.md', node_id: 'kardio', addToDB: true },

  // ── SPÁNEK ───────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/spanek/proc-spanek-neni-lenistvim.md`,               storage: 'longevity/spanek/proc-spanek-neni-lenistvim.md',               node_id: 'spanek', addToDB: true },
  { local: `${BASE}/clanky/spanek/spanek-a-mozek-glymfatika-a-alzheimer.md`,    storage: 'longevity/spanek/spanek-a-mozek-glymfatika-a-alzheimer.md',    node_id: 'spanek', addToDB: true },

  // ── STRES ────────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/stres/kortizol-pritel-i-nepritel.md`,          storage: 'longevity/stres/kortizol-pritel-i-nepritel.md',          node_id: 'stres', addToDB: true },
  { local: `${BASE}/clanky/stres/chronicky-stres-a-co-dela-s-telem.md`,   storage: 'longevity/stres/chronicky-stres-a-co-dela-s-telem.md',   node_id: 'stres', addToDB: true },

  // ── METABOLICKÉ ──────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/metabolicke/insulinova-rezistence-koren-problemu.md`, storage: 'longevity/metabolicke/insulinova-rezistence-koren-problemu.md', node_id: 'metabolicke', addToDB: true },
  { local: `${BASE}/clanky/metabolicke/metabolicky-syndrom-pet-signalu.md`,      storage: 'longevity/metabolicke/metabolicky-syndrom-pet-signalu.md',      node_id: 'metabolicke', addToDB: true },

  // ── NERVOVÝ SYSTÉM ───────────────────────────────────────────────────────
  { local: `${BASE}/clanky/nervovy_system/neuroplasticita-mozek-ktery-se-meni.md`,  storage: 'longevity/nervovy_system/neuroplasticita-mozek-ktery-se-meni.md',  node_id: 'nervovy_system', addToDB: true },
  { local: `${BASE}/clanky/nervovy_system/autonomni-nervovy-system-jak-ho-treovat.md`, storage: 'longevity/nervovy_system/autonomni-nervovy-system-jak-ho-treovat.md', node_id: 'nervovy_system', addToDB: true },

  // ── IMUNITNÍ ─────────────────────────────────────────────────────────────
  { local: `${BASE}/clanky/imunitni/imunita-a-starnuti-inflammaging.md`,    storage: 'longevity/imunitni/imunita-a-starnuti-inflammaging.md',    node_id: 'imunitni', addToDB: true },
  { local: `${BASE}/clanky/imunitni/jak-pohyb-a-spanek-siliji-imunitu.md`,  storage: 'longevity/imunitni/jak-pohyb-a-spanek-siliji-imunitu.md',  node_id: 'imunitni', addToDB: true },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function publicUrl(storagePath) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractSummary(content) {
  // First paragraph after the title (skip empty lines and headings)
  const lines = content.split('\n');
  let pastTitle = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!pastTitle && trimmed.startsWith('#')) { pastTitle = true; continue; }
    if (pastTitle && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      // Return first real paragraph, strip markdown formatting
      return trimmed.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').substring(0, 200);
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📦 Supabase Storage upload – bucket: ${BUCKET}\n`);

  // Load existing articles to detect what needs UPDATE vs INSERT
  const { data: existingArticles } = await supabase
    .from('longevity_articles')
    .select('id, node_id, title, url');

  const existingByLocalPath = {};
  for (const a of (existingArticles || [])) {
    // match by filename in URL
    const filename = a.url.split('/').pop();
    existingByLocalPath[filename] = a;
  }

  const results = { uploaded: 0, skipped: 0, dbUpdated: 0, dbInserted: 0, errors: [] };

  for (const f of FILES) {
    if (!existsSync(f.local)) {
      console.log(`  ⚠️  NENALEZEN: ${f.local}`);
      results.skipped++;
      continue;
    }

    const content = readFileSync(f.local);
    const contentStr = content.toString('utf-8');
    const title = extractTitle(contentStr);
    const summary = extractSummary(contentStr);
    const filename = basename(f.local);

    // Upload to Storage (upsert = overwrite if exists)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(f.storage, content, {
        contentType: 'text/markdown; charset=utf-8',
        upsert: true,
      });

    if (upErr) {
      console.log(`  ❌ UPLOAD FAILED: ${f.storage} – ${upErr.message}`);
      results.errors.push(f.storage);
      continue;
    }

    const url = publicUrl(f.storage);
    console.log(`  ✅ ${f.storage}`);
    results.uploaded++;

    if (!f.addToDB) continue;

    // DB: UPDATE existing or INSERT new
    const existing = existingByLocalPath[filename];
    if (existing) {
      const { error: updErr } = await supabase
        .from('longevity_articles')
        .update({ url, ...(summary && { summary }) })
        .eq('id', existing.id);
      if (updErr) {
        console.log(`     ⚠️  DB update failed: ${updErr.message}`);
      } else {
        console.log(`     🔄 DB updated: "${existing.title}"`);
        results.dbUpdated++;
      }
    } else {
      const { error: insErr } = await supabase
        .from('longevity_articles')
        .insert({
          node_id: f.node_id,
          title: title || filename.replace('.md', ''),
          url,
          summary: summary || null,
          lang: 'cs',
          source: 'Vlastní obsah – CHJ',
        });
      if (insErr) {
        console.log(`     ⚠️  DB insert failed: ${insErr.message}`);
      } else {
        console.log(`     ➕ DB inserted: "${title}"`);
        results.dbInserted++;
      }
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`✅ Uploadováno:  ${results.uploaded} souborů`);
  console.log(`🔄 DB updated:   ${results.dbUpdated} záznamů`);
  console.log(`➕ DB inserted:  ${results.dbInserted} záznamů`);
  console.log(`⏭  Přeskočeno:   ${results.skipped} souborů (nenalezeny)`);
  if (results.errors.length) console.log(`❌ Chyby:        ${results.errors.join(', ')}`);
  console.log('─────────────────────────────────\n');
}

main().catch(console.error);
