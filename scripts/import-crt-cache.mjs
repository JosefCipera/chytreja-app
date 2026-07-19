// Importuje crt_cache zpět do Supabase po _v_pp bumpu.
// Přepočítá hash s aktuálními _v_ai/_v_pp tak aby cache hit fungoval.
// Spustit PO _v_pp bumpu: node scripts/import-crt-cache.mjs
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Musí odpovídat hodnotám v api/crt-generate.js
const _v_ai = 12;
const _v_pp = 30;
const DEFAULT_MODEL = 'claude-sonnet-5'; // MODEL_MAP.haiku.id = MODELS.crt = 'claude-sonnet-5'

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return String(h >>> 0);
}

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const dir = 'data/crt/cache-backup';
const files = readdirSync(dir).filter(f => f.endsWith('.json'));

if (!files.length) { console.log('Žádné soubory v', dir); process.exit(0); }

for (const file of files) {
  const backup = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const userId = backup.user_id;

  // Načti aktuální profil pro výpočet nového hashe
  const { data: prof, error: pe } = await sb
    .from('user_health_profile')
    .select('diagnoses, doctor_notes, medications, labs, goal_text')
    .eq('user_id', userId)
    .single();

  if (pe) { console.error(`✗ ${userId}: profil nenalezen —`, pe.message); continue; }

  const { data: metrics } = await sb
    .from('user_metrics')
    .select('node_id, state')
    .eq('user_id', userId);

  const ctx = {
    profile: prof || {},
    metrics: metrics || [],
  };

  const newHash = hashStr(JSON.stringify({
    _v_ai,
    _v_pp,
    model:        DEFAULT_MODEL,
    diagnoses:    ctx.profile.diagnoses || [],
    doctor_notes: ctx.profile.doctor_notes || '',
    medications:  (ctx.profile.medications || []).map(m => m.name),
    labs:         ctx.profile.labs || {},
    goal:         ctx.profile.goal_text || '',
    metrics:      ctx.metrics.map(m => `${m.node_id}:${m.state}`).sort(),
  }));

  const { error } = await sb
    .from('user_health_profile')
    .upsert({
      user_id:         userId,
      crt_cache:       backup.crt_cache,
      crt_cache_hash:  newHash,
      crt_cache_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) console.error(`✗ ${userId}:`, error.message);
  else console.log(`✓ ${userId}  ${backup.crt_cache?.nodes?.length} nodes  hash=${newHash}`);
}
console.log('\nHotovo. Uživatelé dostanou cache hit při příštím načtení.');
