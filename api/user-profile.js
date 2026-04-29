// POST /api/user-profile
// Upserts user profile fields (server-side, service_role).
// Replaces direct Supabase write from universe-init.js upgradeToLongevity().
//
// Body: { userId, primaryGoal? }

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, primaryGoal } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const update = { user_id: userId };
  if (primaryGoal !== undefined) update.primary_goal = primaryGoal;

  const { error } = await sb.from('user_profiles')
    .upsert(update, { onConflict: 'user_id' });

  if (error) {
    console.error('[user-profile] error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true });
}
