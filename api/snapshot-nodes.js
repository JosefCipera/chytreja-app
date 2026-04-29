// POST /api/snapshot-nodes
// Upserts daily state snapshot into node_state_history (server-side).
// Replaces direct Supabase upsert from universe-init.js snapshotNodeStates().
//
// Body: { userId, rows: [{ node_id, date, state, current_index }] }

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, rows } = req.body || {};
  if (!userId || !Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'userId and rows[] required' });
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Enforce userId on all rows (never trust client-supplied user_id inside rows)
  const safe = rows.map(r => ({ ...r, user_id: userId }));

  const { error } = await sb.from('node_state_history')
    .upsert(safe, { onConflict: 'user_id,node_id,date', ignoreDuplicates: true });

  if (error) {
    console.error('[snapshot-nodes] error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true, saved: safe.length });
}
