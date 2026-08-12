// audit-kovarova.mjs — DB audit for Kovářová out-of-sample NBA test
// Run: node --env-file=.env.local scripts/audit-kovarova.mjs

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n══════════════════════════════════════════');
console.log('  Kovářová — DB Audit');
console.log('══════════════════════════════════════════\n');

// 1. Find Kovářová by birth_year=1948 in user_profiles
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('user_id, birth_year, gender, height, weight, email, name')
  .eq('birth_year', 1948);

console.log('=== user_profiles (birth_year=1948) ===');
console.log(JSON.stringify(profiles, null, 2));

// Try also by gender=female, birth_year=1948
const { data: profiles2 } = await supabase
  .from('user_profiles')
  .select('user_id, birth_year, gender, height, weight')
  .gte('birth_year', 1945)
  .lte('birth_year', 1952)
  .eq('gender', 'female');

console.log('\n=== user_profiles (female, birth 1945-1952) ===');
console.log(JSON.stringify(profiles2, null, 2));

if (!profiles?.length && !profiles2?.length) {
  console.log('\n⚠️  Žádný uživatel s birth_year≈1948 nebyl nalezen v user_profiles.');
  console.log('    Kovářová existuje POUZE jako test fixture — nemá reálný DB účet.');
  console.log('    Test musí použít fixture data nebo vytvořit dočasný mock user.\n');
  process.exit(0);
}

// If found, use first match
const candidates = [...(profiles || []), ...(profiles2 || [])];
const unique = [...new Map(candidates.map(p => [p.user_id, p])).values()];
console.log('\nNalezení kandidáti:', unique.map(p => p.user_id));

for (const p of unique) {
  const uid = p.user_id;
  console.log(`\n\n═══ USER: ${uid} (birth=${p.birth_year}, gender=${p.gender}) ═══`);

  const [
    { data: hp },
    { data: constraints },
    { data: nodeInputs },
    { data: checkins },
    { data: metrics },
  ] = await Promise.all([
    supabase.from('user_health_profile')
      .select('diagnoses, symptoms, medications, supplements, labs, lifestyle, capacity, physical, doctor_notes')
      .eq('user_id', uid).maybeSingle(),
    supabase.from('user_constraints')
      .select('constraint_type, constraint_key, constraint_value, severity')
      .eq('user_id', uid),
    supabase.from('node_inputs')
      .select('node_id, question_id, value')
      .eq('user_id', uid),
    supabase.from('daily_checkin')
      .select('weight_kg, energy, sleep_hours, stress, movement_level, date')
      .eq('user_id', uid)
      .order('date', { ascending: false })
      .limit(5),
    supabase.from('user_metrics')
      .select('node_id, current_index, state, universe')
      .eq('user_id', uid)
      .limit(20),
  ]);

  console.log('\n--- health_profile ---');
  console.log(JSON.stringify(hp, null, 2));

  console.log('\n--- user_constraints ---');
  console.log(JSON.stringify(constraints, null, 2));

  console.log('\n--- node_inputs ---');
  console.log(JSON.stringify(nodeInputs, null, 2));

  console.log('\n--- daily_checkin (last 5) ---');
  console.log(JSON.stringify(checkins, null, 2));

  console.log('\n--- user_metrics (sample) ---');
  console.log(JSON.stringify(metrics, null, 2));
}
