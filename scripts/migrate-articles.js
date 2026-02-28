/**
 * migrate-articles.js
 * Copies relevant records from node_articles → longevity_articles
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// sub-node → main node mapping
const NODE_MAP = {
  'dlouhovekost': 'dlouhovekost',
  'zdravi':       'zdravi',
  'metabolicke':  'metabolicke',
  'mysl':         'mysl',
  'vyziva':       'vyziva',
  'spanek':       'zdravi',
  'stres':        'mysl',
  'smysl':        'mysl',
  'pust':         'vyziva',
};

const { data: rows, error } = await sb.from('node_articles').select('*');
if (error) { console.error('Fetch error:', error.message); process.exit(1); }

const toInsert = rows
  .filter(r => NODE_MAP[r.node_id])
  .map(r => ({
    node_id: NODE_MAP[r.node_id],
    title:   r.title,
    url:     r.url,
    lang:    'cs',
    source:  'Vlastní obsah – CHJ',
  }));

console.log('Migruji', toInsert.length, 'záznamů:');
toInsert.forEach(r => console.log(' ', r.node_id.padEnd(14), r.title));

// Check existing titles to avoid duplicates
const { data: existing } = await sb.from('longevity_articles').select('title');
const existingTitles = new Set((existing || []).map(r => r.title));
const newRows = toInsert.filter(r => !existingTitles.has(r.title));
console.log(`Přeskakuji ${toInsert.length - newRows.length} duplicitů, vkládám ${newRows.length} nových.\n`);

const { error: insError } = await sb
  .from('longevity_articles')
  .insert(newRows);

if (insError) console.error('Insert error:', insError.message);
else console.log('\n✅ Migrace hotova!');
