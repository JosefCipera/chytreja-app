import dotenv from 'dotenv';
dotenv.config({ path: 'C:/projekty/chytreja-app/.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = process.argv[2] || 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
const today = new Date().toISOString().split('T')[0];

const [readiness, metrics, orchLog, decathlon] = await Promise.all([
  sb.from('user_readiness').select('date, energy_level, sleep_hours, hrv_ms').eq('user_id', userId).eq('date', today).maybeSingle(),
  sb.from('user_metrics').select('node_id, state, current_index').eq('user_id', userId).eq('universe', 'longevity').in('node_id', ['telo','zdravi','mysl','vyziva']),
  sb.from('orchestrator_log').select('date, pillar, verdict, completion_feedback').eq('user_id', userId).eq('date', today),
  sb.from('user_decathlon').select('goal_key, label, active').eq('user_id', userId),
]);

console.log('=== USER:', userId, '===');
console.log('\nReadiness dnes:', readiness.data ?? 'CHYBÍ');
console.log('\nMetriky:', metrics.data ?? 'CHYBÍ');
console.log('\nOrchestrator log dnes:', orchLog.data?.length ? orchLog.data : 'PRÁZDNÝ');
console.log('\nDecathlon:', decathlon.data ?? 'CHYBÍ');
