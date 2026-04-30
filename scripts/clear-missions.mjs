import dotenv from 'dotenv';
dotenv.config({ path: 'C:/projekty/chytreja-app/.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = process.argv[2] || 'qE09cLyXXGRBRxOBCGNZqTM2XRW2';
const today = new Date().toISOString().split('T')[0];

const { error, count } = await sb.from('mission_log')
  .delete({ count: 'exact' })
  .eq('user_id', userId)
  .eq('date', today);

if (error) console.error('ERR:', error.message);
else console.log(`✓ Smazáno ${count ?? '?'} záznamů pro ${userId} dne ${today}`);
