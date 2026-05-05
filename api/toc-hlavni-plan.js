// GET /api/toc-hlavni-plan?userId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns daily production plan: plan_ks / uvolnene_ks / predvydane_ks

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Content-Type', 'application/json');

  try {
    const { userId, from, to } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let q = sb.from('toc_hlavni_plan')
      .select('datum, plan_ks, uvolnene_ks, predvydane_ks, poznamka')
      .eq('user_id', userId)
      .order('datum', { ascending: true });

    if (from) q = q.gte('datum', from);
    if (to)   q = q.lte('datum', to);

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ data: data || [] });

  } catch (err) {
    console.error('[toc-hlavni-plan]', err);
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}
