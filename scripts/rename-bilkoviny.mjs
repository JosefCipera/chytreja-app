import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Rename node id 'bílkoviny' → 'bilkoviny' (remove diacritic)
// bilkoviny node already inserted — just update remaining FK refs and delete old

async function run() {
  // Check if old node still exists
  const { data: oldNode } = await sb
    .from('longevity_nodes')
    .select('id')
    .eq('id', 'bílkoviny')
    .maybeSingle();

  if (!oldNode) {
    console.log('✅ Node bílkoviny already gone — nothing to do');
    return;
  }

  // Update all FK references
  const tables = [
    'longevity_actions',
    'longevity_articles',
    'user_metrics',
    'node_state_history',
    'node_inputs',
    'onboarding_questions',
    'aspiration_requirements',
    'mission_log',
  ];

  for (const table of tables) {
    const { error } = await sb
      .from(table)
      .update({ node_id: 'bilkoviny' })
      .eq('node_id', 'bílkoviny');
    if (error) console.warn(`⚠️ ${table}: ${error.message}`);
    else console.log(`✅ ${table}: updated`);
  }

  // Delete old node
  const { error: e3 } = await sb.from('longevity_nodes').delete().eq('id', 'bílkoviny');
  if (e3) { console.error('Delete old node:', e3.message); process.exit(1); }
  console.log('✅ Deleted old node bílkoviny');

  // Verify
  const { data: verify } = await sb
    .from('longevity_actions')
    .select('node_id, label')
    .eq('node_id', 'bilkoviny');
  console.log(`\n✅ Done. ${verify?.length ?? 0} actions under bilkoviny`);
}

run().catch(e => { console.error(e); process.exit(1); });
