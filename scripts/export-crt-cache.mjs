// Exportuje crt_cache všech uživatelů do data/crt/cache-backup/
// Spustit PŘED každým _v_pp bumpm: node scripts/export-crt-cache.mjs
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from('user_health_profile')
  .select('user_id, crt_cache, crt_cache_hash, crt_cache_at')
  .not('crt_cache', 'is', null);

if (error) { console.error('Supabase error:', error.message); process.exit(1); }

const dir = 'data/crt/cache-backup';
mkdirSync(dir, { recursive: true });

for (const row of data) {
  if (!row.crt_cache?.nodes?.length) continue;
  const file = join(dir, `${row.user_id}.json`);
  writeFileSync(file, JSON.stringify({
    user_id:         row.user_id,
    crt_cache_hash:  row.crt_cache_hash,
    crt_cache_at:    row.crt_cache_at,
    crt_cache:       row.crt_cache,
  }, null, 2));
  console.log(`✓ ${row.user_id}  ${row.crt_cache.nodes.length} nodes  →  ${file}`);
}
console.log('\nHotovo. Commitni data/crt/cache-backup/ do gitu.');
