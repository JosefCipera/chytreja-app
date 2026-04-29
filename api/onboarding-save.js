// POST /api/onboarding-save
// Saves onboarding results server-side (service_role bypasses RLS).
// Replaces direct Supabase writes that were in onboarding.js.
//
// Body: { userId, nodes: [{ nodeId, state, currentIndex }], primaryGoal }

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, nodes, primaryGoal } = req.body || {};
  if (!userId || !Array.isArray(nodes)) {
    return res.status(400).json({ error: 'userId and nodes[] required' });
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  try {
    // 1. node_inputs — onboarding answers
    const inputs = nodes.map(n => ({
      user_id: userId,
      node_id: n.nodeId,
      source: 'onboarding',
      state: n.state,
      value_numeric: n.currentIndex,
    }));
    if (inputs.length) {
      await sb.from('node_inputs').insert(inputs);
    }

    // 2. user_metrics — current index per node (upsert)
    const metrics = nodes.map(n => ({
      user_id: userId,
      node_id: n.nodeId,
      universe: 'longevity',
      current_index: n.currentIndex,
      state: n.state,
    }));
    if (metrics.length) {
      await sb.from('user_metrics').upsert(metrics, { onConflict: 'user_id,node_id' });
    }

    // 3. node_state_history — sparkline baseline
    const history = nodes.map(n => ({
      user_id: userId,
      node_id: n.nodeId,
      date: today,
      state: n.state,
      current_index: n.currentIndex,
    }));
    if (history.length) {
      await sb.from('node_state_history').insert(history);
    }

    // 4. user_profiles — primary goal
    if (primaryGoal) {
      await sb.from('user_profiles').upsert(
        { user_id: userId, primary_goal: primaryGoal },
        { onConflict: 'user_id' }
      );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[onboarding-save] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
