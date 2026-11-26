// api/secondary-action-complete.js — "volná akce" completion logging
//
// POST { action_id, intervention_id, actual_duration_seconds?, actual_reps? }
// → { ok: true } | { ok: false, warning }
//
// Deliberately does NOT go through api/orchestrate.js → processInput() →
// applyHealthEvent(): that path re-runs the full engine pipeline just to
// return a new ACT/HOLD decision we would throw away (see docs/BACKLOG.md,
// "Rozhodnuto ... zápis dokončení volné akce"). This persists the completion
// directly via the same persistActionAssignment() the main path uses — same
// dedupe guard, same action_assignments row shape, no engine re-run and no
// risk of overwriting the main action's session state.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { persistActionAssignment } from './engine/healthEventAdapter.js';
import { requireAuth } from './lib/requireAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;
  const userId = auth.uid;

  const { action_id, intervention_id, actual_duration_seconds, actual_reps } = req.body ?? {};
  if (!action_id || !intervention_id) {
    return res.status(400).json({ error: 'action_id and intervention_id required' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const warning = await persistActionAssignment(
      supabase, userId,
      {
        action_id, intervention_id,
        selected_leverage_node: 'VOLNA_AKCE', // marks this as the supplementary-slot flow, not NBA's own pick
        actual_duration_seconds: actual_duration_seconds ?? null,
        actual_reps: actual_reps ?? null,
      },
      'COMPLETED',
    );
    return res.status(200).json({ ok: true, warning: warning ?? null });
  } catch (err) {
    console.error('[secondary-action-complete] error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
