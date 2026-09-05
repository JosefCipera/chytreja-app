// /api/tester-reset — dev/tester tooling only, not exposed in production UI
// POST { userId, mode: 'session' | 'full' }
//
// session: documents client-side contract (no DB changes)
// full:    clears DB test state for whitelisted tester accounts
//
// Protected UIDs (never reset): anything not in TESTER_UIDS whitelist.
// Add tester accounts explicitly — production accounts are protected by omission.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Explicit tester whitelist — only these UIDs may be full-reset.
// Production and demo accounts are protected by not being listed here.
export const TESTER_UIDS = new Set([
  'u58iRWcMr9bbakFMJYGFGARpi9h1', // Tester 0
  'e0ZYA3auBYUh9TOOtqQPqbkIcrJ2', // Tester 1
  // Add additional tester accounts here when needed
  // Josef (qE09cLyXXGRBRxOBCGNZqTM2XRW2) and Kovářová are PROTECTED — never add here
]);

// Core reset logic — exported so tests can call it directly without HTTP
export async function runTesterReset(userId, mode, sbClient) {
  if (!userId)                             return { status: 400, body: { error: 'userId required' } };
  if (!['session', 'full'].includes(mode)) return { status: 400, body: { error: 'mode required: session | full' } };

  if (mode === 'full' && !TESTER_UIDS.has(userId)) {
    return {
      status: 403,
      body: {
        error:  'Full reset not allowed for this account',
        reason: 'userId not in tester whitelist — add explicitly to TESTER_UIDS in api/tester-reset.js',
      },
    };
  }

  if (mode === 'session') {
    return {
      status: 200,
      body: {
        ok:                    true,
        mode:                  'session',
        local_session_cleared: true,
        note:                  'Clear in browser: localStorage.removeItem(_SK(uid)); localStorage.removeItem(_LRK(uid));',
      },
    };
  }

  // full mode
  const sb = sbClient ?? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. action_assignments — removes HOLD_TOO_EARLY gate
  const { count: aCount, error: aErr } = await sb
    .from('action_assignments').delete({ count: 'exact' }).eq('user_id', userId);
  if (aErr) return { status: 500, body: { error: `action_assignments: ${aErr.message}` } };

  // 2. user_constraints
  const { count: cCount, error: cErr } = await sb
    .from('user_constraints').delete({ count: 'exact' }).eq('user_id', userId);
  if (cErr) return { status: 500, body: { error: `user_constraints: ${cErr.message}` } };

  // 3. mission_log
  const { count: mCount, error: mErr } = await sb
    .from('mission_log').delete({ count: 'exact' }).eq('user_id', userId);
  if (mErr) return { status: 500, body: { error: `mission_log: ${mErr.message}` } };

  // 4. user_health_profile — clear test fields, preserve the row and user_profiles identity
  const { error: hErr } = await sb
    .from('user_health_profile')
    .update({
      diagnoses: null, symptoms: null, medications: null, labs: null,
      physical: null, lifestyle: null, behavior_flags: null, crt_cache: null,
      pending_clarifications: null,
    })
    .eq('user_id', userId);
  if (hErr) return { status: 500, body: { error: `user_health_profile: ${hErr.message}` } };

  // 5. user_profiles — clear Bootstrap-persisted fields; preserve row, mode, and all other fields.
  // birth_year is written by Bootstrap NBE v1 (upsertUserProfile) and must be cleared on Full Reset
  // so the next clean session starts from zero-knowledge Bootstrap state.
  const { error: upErr } = await sb
    .from('user_profiles')
    .update({ birth_year: null })
    .eq('user_id', userId);
  if (upErr) return { status: 500, body: { error: `user_profiles: ${upErr.message}` } };

  console.log(`[RESET] uid=${userId} deleted_action_assignments=${aCount ?? 0} deleted_constraints=${cCount ?? 0} deleted_mission_log=${mCount ?? 0}`);

  return {
    status: 200,
    body: {
      ok:                         true,
      mode:                       'full',
      userId,
      deleted_action_assignments: aCount ?? 0,
      deleted_constraints:        cCount ?? 0,
      deleted_mission_log:        mCount ?? 0,
      health_profile_cleared:     true,
      user_profiles_birth_year_cleared: true,
      local_session_cleared:      false, // caller must clear localStorage
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { userId, mode } = req.body ?? {};
  const { status, body } = await runTesterReset(userId, mode);
  return res.status(status).json(body);
}
