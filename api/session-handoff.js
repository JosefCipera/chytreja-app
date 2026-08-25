// api/session-handoff.js — CHJ Session Handoff v0.1
//
// POST /api/session-handoff
// Authorization: Bearer <firebase-id-token>
// Body: { session_id, structured_facts[], deferred_facts[] }
// → { ok: true, facts_applied, facts_deferred }
//
// Routes pre-intake facts to persistent storage after Firebase authentication.
// UID is taken ONLY from the verified Firebase token — body.user_id is NEVER read.
//
// structured_facts routing (P0 policy):
//   NEW_MEASUREMENT | NEW_CONSTRAINT | ANSWER_TO_EVIDENCE_QUESTION  → applyHealthEvent
//   NEW_SYMPTOM | GENERAL_HEALTH_REQUEST (overflow from pre-intake) → pending_clarifications
// deferred_facts (medication_mention, new_symptom, etc.)            → pending_clarifications
//
// Idempotency:
//   handoff_sessions row = completed-detector / audit.
//   pending_clarifications write is idempotent by session_id.
//   All applyHealthEvent paths (measurement/constraint/evidence) are idempotent upserts.
//   Order: pending written first → apply → mark completed.
//   On failure before marking: safe to retry (pending idempotent, apply idempotent).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient }     from '@supabase/supabase-js';
import { getAdminAuth }      from './lib/firebaseAdmin.js';
import { applyHealthEvent }  from './engine/healthEventAdapter.js';

export const config = { maxDuration: 30 };

// Event types routed through applyHealthEvent (all end-to-end idempotent upserts).
const APPLY_TYPES = new Set([
  'NEW_MEASUREMENT',
  'NEW_CONSTRAINT',
  'ANSWER_TO_EVIDENCE_QUESTION',
]);

// ── Pure routing ──────────────────────────────────────────────────────────────

// Classify facts into { toApply, toPend }.
// Pure function — no I/O. Exported for testing.
export function classifyFacts(structured_facts = [], deferred_facts = []) {
  const toApply = [];
  const toPend  = [];

  for (const f of structured_facts) {
    if (!f || typeof f !== 'object') continue;
    if (APPLY_TYPES.has(f.event_type)) {
      toApply.push(f);
    } else {
      // NEW_SYMPTOM, GENERAL_HEALTH_REQUEST, MEDICATION_CHANGE, or unknown → pending.
      toPend.push(f);
    }
  }

  for (const f of deferred_facts) {
    if (!f || typeof f !== 'object') continue;
    toPend.push(f);
  }

  return { toApply, toPend };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

// Idempotent append to user_health_profile.pending_clarifications.
// Skips entirely if ANY item with this session_id already exists.
// Exported for testing with mock Supabase.
export async function appendPendingClarifications(supabase, uid, session_id, items) {
  if (!items.length) return;

  const { data: row, error: readErr } = await supabase
    .from('user_health_profile')
    .select('pending_clarifications')
    .eq('user_id', uid)
    .maybeSingle();

  if (readErr) throw new Error(`pending_clarifications read: ${readErr.message}`);

  const existing = Array.isArray(row?.pending_clarifications) ? row.pending_clarifications : [];

  // Idempotency gate: if session_id already present, skip.
  if (existing.some(e => e.session_id === session_id)) return;

  const now = new Date().toISOString();
  const entries = items.map(f => ({
    session_id,
    type:             String(f.type ?? f.event_type ?? 'general_health_request'),
    raw_text:         String(f.raw_text ?? ''),
    utterance_index:  Number.isInteger(f.utterance_index) ? f.utterance_index : 0,
    reason:           String(f.reason ?? 'non_idempotent_handoff'),
    timestamp:        now,
    temporal_context: typeof f.temporal_context === 'string' ? f.temporal_context : 'unknown',
  }));

  const { error: writeErr } = await supabase
    .from('user_health_profile')
    .upsert({ user_id: uid, pending_clarifications: [...existing, ...entries] }, { onConflict: 'user_id' });

  if (writeErr) throw new Error(`pending_clarifications write: ${writeErr.message}`);
}

// Returns true if handoff_sessions already has a row for this session_id AND uid.
// Both fields are required — session_id alone is not authoritative.
// Prevents user A's completed row from blocking user B's handoff on the same session_id.
// Exported for testing.
export async function checkCompleted(supabase, session_id, uid) {
  const { data, error } = await supabase
    .from('handoff_sessions')
    .select('session_id')
    .eq('session_id', session_id)
    .eq('user_id', uid)
    .maybeSingle();

  if (error) throw new Error(`handoff_sessions read: ${error.message}`);
  return data !== null;
}

async function markCompleted(supabase, session_id, uid, facts_applied, facts_deferred) {
  const { error } = await supabase
    .from('handoff_sessions')
    .insert({ session_id, user_id: uid, facts_applied, facts_deferred });

  if (error) throw new Error(`handoff_sessions insert: ${error.message}`);
}

// ── Core handoff logic ────────────────────────────────────────────────────────

// processHandoff — exported for testing with injected supabase and applyFn.
// applyFn defaults to the real applyHealthEvent from healthEventAdapter.
export async function processHandoff({
  uid,
  session_id,
  structured_facts,
  deferred_facts,
  supabase,
  applyFn = applyHealthEvent,
}) {
  // Completed-detector: early return if session already committed FOR THIS uid.
  const already = await checkCompleted(supabase, session_id, uid);
  if (already) {
    return { ok: true, already_completed: true, facts_applied: 0, facts_deferred: 0 };
  }

  const { toApply, toPend } = classifyFacts(structured_facts, deferred_facts);
  const now = new Date().toISOString();

  // Write pending_clarifications FIRST (idempotent by session_id).
  // Safe to persist even if apply later fails — retry won't duplicate.
  await appendPendingClarifications(supabase, uid, session_id, toPend);

  // Apply idempotent structured events via healthEventAdapter.
  let facts_applied = 0;
  const applyErrors = [];

  for (const fact of toApply) {
    const event = {
      event_type: fact.event_type,
      payload:    (fact.payload && typeof fact.payload === 'object') ? fact.payload : {},
      source:     'pre-intake',
      timestamp:  now,
    };
    let result;
    try {
      result = await applyFn(uid, event);
    } catch (err) {
      applyErrors.push(`${fact.event_type}: ${err.message}`);
      continue;
    }
    if (result?.persistence_status === 'error') {
      applyErrors.push(`${fact.event_type}: ${result.error ?? 'unknown'}`);
    } else {
      facts_applied++;
    }
  }

  // If any apply failed, throw so session is not marked completed → safe retry.
  if (applyErrors.length > 0) {
    throw new Error(`applyHealthEvent failed: ${applyErrors.join('; ')}`);
  }

  // Mark session as completed (audit row). Session is now safe for no-op retry.
  await markCompleted(supabase, session_id, uid, facts_applied, toPend.length);

  return { ok: true, facts_applied, facts_deferred: toPend.length };
}

// ── Default I/O providers ─────────────────────────────────────────────────────

function defaultVerifyIdToken(token) {
  return getAdminAuth().verifyIdToken(token);
}

function defaultCreateSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

// _hooks is used ONLY in tests (verifyIdToken, createSupabase, applyFn override).
// Vercel calls handler(req, res) → _hooks = {} → all real implementations used.
export default async function handler(req, res, _hooks = {}) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Token extraction.
  const authHeader = req.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Authorization header with Bearer token required' });
  }

  // 2. Firebase token verification. UID comes ONLY from verified token.
  //    body.user_id is intentionally ignored — never read.
  let uid;
  const verifyIdToken = _hooks.verifyIdToken ?? defaultVerifyIdToken;
  try {
    const decoded = await verifyIdToken(token);
    uid = decoded?.uid;
    if (!uid) throw new Error('UID missing from decoded token');
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // 3. Request validation. body.user_id is NOT destructured — intentional.
  const { session_id, structured_facts = [], deferred_facts = [] } = req.body ?? {};

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({ error: 'session_id is required (string)' });
  }
  if (!Array.isArray(structured_facts) || !Array.isArray(deferred_facts)) {
    return res.status(400).json({ error: 'structured_facts and deferred_facts must be arrays' });
  }

  // 4. Supabase client (service_role — server-side only, never sent to client).
  const createSupabase = _hooks.createSupabase ?? defaultCreateSupabase;
  const supabase = createSupabase();

  // 5. Handoff.
  const applyFn = _hooks.applyFn ?? applyHealthEvent;
  try {
    const result = await processHandoff({ uid, session_id, structured_facts, deferred_facts, supabase, applyFn });
    return res.json(result);
  } catch (err) {
    console.error('[session-handoff] error:', err.message);
    return res.status(500).json({ error: 'Handoff failed — safe to retry', details: err.message });
  }
}
