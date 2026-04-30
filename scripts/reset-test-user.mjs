import dotenv from 'dotenv';
dotenv.config({ path: 'C:/projekty/chytreja-app/.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = process.argv[2] || 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
const today = new Date().toISOString().split('T')[0];

// 1. Clear today's mission_log
const { count: ml } = await sb.from('mission_log').delete({ count: 'exact' }).eq('user_id', userId).eq('date', today);
console.log(`✓ mission_log: smazáno ${ml ?? 0}`);

// 2. Clear today's orchestrator_log
const { count: ol } = await sb.from('orchestrator_log').delete({ count: 'exact' }).eq('user_id', userId).eq('date', today);
console.log(`✓ orchestrator_log: smazáno ${ol ?? 0}`);

// 3. Ensure plavani active via upsert
await sb.from('user_decathlon').update({ active: false }).eq('user_id', userId);
const { error } = await sb.from('user_decathlon')
  .upsert({
    user_id:        userId,
    goal_key:       'plavani',
    label:          'Uplavat 0,5 km',
    target_age:     85,
    priority:       5,
    pillar_weights: { kardio: 0.4, sila: 0.3, stabilita: 0.2, vo2max: 0.1 },
    active:         true,
  }, { onConflict: 'user_id,goal_key' });
if (error) console.warn('decathlon:', error.message);
else console.log('✓ user_decathlon: plavani aktivní');

console.log('\nTest user připraven.');
