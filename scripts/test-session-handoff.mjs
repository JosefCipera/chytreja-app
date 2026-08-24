// scripts/test-session-handoff.mjs — Package 3 test suite
// All tests are unit/mock — no real Firebase or Supabase calls.
// M1 (handoff_sessions) and M2 (pending_clarifications) migrations do NOT need to be run.
//
// Run: node scripts/test-session-handoff.mjs
// Expected: all assertions pass, no process.exit(1)

import { readFileSync } from 'fs';
import {
  classifyFacts,
  appendPendingClarifications,
  checkCompleted,
  processHandoff,
} from '../api/session-handoff.js';

// Pull the default export separately (used for handler-level tests).
import handlerModule from '../api/session-handoff.js';
const handler = handlerModule;

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// Minimal mock res compatible with handler's res.status(n).json({}) and res.json({}).
function mockRes() {
  const r = {
    statusCode: 200,
    body:       null,
    status(code) { r.statusCode = code; return r; },
    json(body)   { r.body = body;       return r; },
  };
  return r;
}

// Chainable Supabase mock.
// state.sessions → handoff_sessions rows (array of objects with session_id).
// state.pending  → pending_clarifications for the single test user (array of items).
function createMockSupabase(initialState = {}) {
  const state = {
    sessions: [...(initialState.sessions ?? [])],
    pending:  [...(initialState.pending  ?? [])],
    calls:    [],
  };

  function makeChain(table) {
    const _filters = {};    // accumulate multiple .eq() calls
    const chain = {
      select(_cols)   { return chain; },
      eq(col, val)    { _filters[col] = val; return chain; },
      maybeSingle() {
        if (table === 'handoff_sessions') {
          // Match ALL accumulated eq() filters (session_id AND user_id).
          const found = state.sessions.find(s =>
            Object.entries(_filters).every(([k, v]) => s[k] === v)
          );
          return Promise.resolve({ data: found ?? null, error: null });
        }
        if (table === 'user_health_profile') {
          return Promise.resolve({
            data: { pending_clarifications: [...state.pending] },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
      upsert(data, _opts) {
        state.calls.push({ op: 'upsert', table, data });
        if (table === 'user_health_profile' && Array.isArray(data?.pending_clarifications)) {
          state.pending = [...data.pending_clarifications];
        }
        return Promise.resolve({ error: null });
      },
      insert(data) {
        state.calls.push({ op: 'insert', table, data });
        if (table === 'handoff_sessions') state.sessions.push(data);
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  }

  return { from: (table) => makeChain(table), _state: state };
}

const SESSION_A = 'a0000000-0000-0000-0000-000000000001';
const SESSION_B = 'b0000000-0000-0000-0000-000000000002';
const UID       = 'test-uid-123';

// ── T1: Missing Authorization → 401 ───────────────────────────────────────────

section('T1 — Missing Authorization header → 401');

{
  const req = { method: 'POST', headers: {}, body: { session_id: SESSION_A, structured_facts: [], deferred_facts: [] } };
  const res = mockRes();
  await handler(req, res);
  check(res.statusCode === 401, 'missing Authorization header → 401');
  check(res.body?.error?.includes('Authorization'), 'error message mentions Authorization');
}
{
  const req = { method: 'POST', headers: { authorization: 'Basic xyz' }, body: { session_id: SESSION_A, structured_facts: [], deferred_facts: [] } };
  const res = mockRes();
  await handler(req, res);
  check(res.statusCode === 401, 'non-Bearer scheme → 401');
}
{
  const req = { method: 'POST', headers: { authorization: 'Bearer ' }, body: { session_id: SESSION_A, structured_facts: [], deferred_facts: [] } };
  const res = mockRes();
  await handler(req, res);
  check(res.statusCode === 401, 'empty Bearer token → 401');
}

// ── T2: Invalid token → 401 ────────────────────────────────────────────────────

section('T2 — Invalid Firebase token → 401');

{
  const req = { method: 'POST', headers: { authorization: 'Bearer bad-token' }, body: { session_id: SESSION_A, structured_facts: [], deferred_facts: [] } };
  const res = mockRes();
  await handler(req, res, { verifyIdToken: async () => { throw new Error('Token expired'); } });
  check(res.statusCode === 401, 'thrown verifyIdToken → 401');
  check(res.body?.error?.toLowerCase().includes('invalid') || res.body?.error?.toLowerCase().includes('expired'), 'error message mentions invalid/expired');
}
{
  const req = { method: 'POST', headers: { authorization: 'Bearer bad-token' }, body: { session_id: SESSION_A, structured_facts: [], deferred_facts: [] } };
  const res = mockRes();
  // verifyIdToken returns decoded without uid → should also 401.
  await handler(req, res, { verifyIdToken: async () => ({ /* no uid */ }) });
  check(res.statusCode === 401, 'decoded token without uid → 401');
}

// ── T3: UID spoofing is impossible ─────────────────────────────────────────────

section('T3 — UID comes from verified token, body.user_id is ignored');

{
  let capturedUid = null;
  const sb = createMockSupabase();

  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer real-token' },
    body: {
      session_id:       SESSION_A,
      user_id:          'evil-attacker-uid',  // must be ignored
      structured_facts: [{
        event_type: 'NEW_MEASUREMENT',
        payload:    { obs_type: 'weight_kg', value: 80 },
        raw_text:   'Vážím 80 kg',
        utterance_index: 0,
      }],
      deferred_facts: [],
    },
  };
  const res = mockRes();

  await handler(req, res, {
    verifyIdToken:  async () => ({ uid: 'server-verified-uid' }),
    createSupabase: ()       => sb,
    applyFn:        async (uid, _event) => { capturedUid = uid; return { persistence_status: 'ok' }; },
  });

  check(res.statusCode === 200, 'handler succeeds');
  check(capturedUid === 'server-verified-uid', 'applyFn called with verified uid, not body.user_id');
  check(capturedUid !== 'evil-attacker-uid',   'evil body user_id was NOT used');
}

// ── T4: classifyFacts — idempotent types → toApply ────────────────────────────

section('T4 — classifyFacts: idempotent types route to toApply');

{
  const { toApply, toPend } = classifyFacts([
    { event_type: 'NEW_MEASUREMENT',           payload: { obs_type: 'weight_kg', value: 80 }, raw_text: 'Vážím 80 kg', utterance_index: 0 },
    { event_type: 'NEW_CONSTRAINT',            payload: { affected_area: 'koleno', source_type: 'injury' }, raw_text: 'Mám poranění kolena', utterance_index: 1 },
    { event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { evidence_type: 'vstat_ze_zeme', value: 'obtížně' }, raw_text: 'Vstávám obtížně', utterance_index: 2 },
  ], []);

  check(toApply.length === 3, 'all 3 idempotent types → toApply');
  check(toPend.length  === 0, 'nothing in toPend for idempotent types');
  check(toApply.every(f => ['NEW_MEASUREMENT', 'NEW_CONSTRAINT', 'ANSWER_TO_EVIDENCE_QUESTION'].includes(f.event_type)), 'event_types preserved');
}

// ── T5: classifyFacts — symptom/GHR → toPend ──────────────────────────────────

section('T5 — classifyFacts: NEW_SYMPTOM and GENERAL_HEALTH_REQUEST → toPend');

{
  const { toApply, toPend } = classifyFacts([
    { event_type: 'NEW_SYMPTOM',            raw_text: 'Bolí mě záda', utterance_index: 0 },
    { event_type: 'GENERAL_HEALTH_REQUEST', raw_text: 'Mám hypertenze', utterance_index: 1 },
  ], []);

  check(toApply.length === 0, 'no idempotent facts → toApply empty');
  check(toPend.length  === 2, 'NEW_SYMPTOM + GENERAL_HEALTH_REQUEST → toPend');
}

// ── T6: classifyFacts — medication_mention deferred → toPend ──────────────────

section('T6 — classifyFacts: medication deferred_facts → toPend');

{
  const { toApply, toPend } = classifyFacts(
    [
      { event_type: 'NEW_MEASUREMENT', payload: { obs_type: 'lab_ldl', value: 3.5 }, raw_text: 'LDL 3.5', utterance_index: 0 },
    ],
    [
      { type: 'medication_mention', raw_text: 'Beru Pradaxu 110 mg', utterance_index: 1, reason: 'unsupported_structured_persistence' },
    ],
  );

  check(toApply.length === 1, 'measurement → toApply');
  check(toPend.length  === 1, 'medication_mention deferred → toPend');
  check(toPend[0].type === 'medication_mention', 'toPend item type preserved');
}

// ── T7: idempotent no-op after completed ──────────────────────────────────────

section('T7 — retry same session_id after completed → no-op');

{
  // Supabase already has a row for SESSION_A.
  const sb = createMockSupabase({ sessions: [{ session_id: SESSION_A, user_id: UID, facts_applied: 1, facts_deferred: 0 }] });
  let applyCallCount = 0;

  const result = await processHandoff({
    uid:              UID,
    session_id:       SESSION_A,
    structured_facts: [{ event_type: 'NEW_MEASUREMENT', payload: { obs_type: 'weight_kg', value: 70 }, raw_text: 'Vážím 70 kg', utterance_index: 0 }],
    deferred_facts:   [],
    supabase:         sb,
    applyFn:          async () => { applyCallCount++; return { persistence_status: 'ok' }; },
  });

  check(result.ok,                     'returns ok: true');
  check(result.already_completed,      'already_completed flag set');
  check(result.facts_applied === 0,    'facts_applied: 0 (no new work)');
  check(applyCallCount === 0,          'applyFn NOT called on retry after completion');
  check(sb._state.calls.length === 0,  'no DB writes on completed retry');
}

// ── T7b: cross-user isolation — same session_id, different uid ────────────────

section('T7b — same session_id, different uid → NOT considered completed (user isolation)');

{
  const UID_A = 'user-a-uid';
  const UID_B = 'user-b-uid';

  // Simulate: user A already completed their handoff with SESSION_A.
  const sb = createMockSupabase({
    sessions: [{ session_id: SESSION_A, user_id: UID_A, facts_applied: 1, facts_deferred: 0 }],
  });
  let applyCalledForB = false;

  // User B attempts handoff with the same session_id (targeted attack or UUID collision).
  // checkCompleted must NOT match user A's row — uid filter ensures isolation.
  let thrownForB = false;
  try {
    await processHandoff({
      uid:              UID_B,
      session_id:       SESSION_A,  // same session_id as user A
      structured_facts: [{ event_type: 'NEW_MEASUREMENT', payload: { obs_type: 'weight_kg', value: 65 }, raw_text: '65 kg', utterance_index: 0 }],
      deferred_facts:   [],
      supabase:         sb,
      applyFn:          async () => { applyCalledForB = true; return { persistence_status: 'ok' }; },
    });
  } catch {
    // markCompleted INSERT may fail with PK violation (session_id already exists from user A).
    // That's acceptable — the important thing is that the session was NOT silently no-op'd.
    thrownForB = true;
  }

  // The critical assertion: user B's handoff was NOT silently short-circuited as "already completed".
  // Either applyFn was called (success path) or it threw on markCompleted (PK collision).
  // Both outcomes prove that user B's data was NOT silently ignored due to user A's completed row.
  check(applyCalledForB || thrownForB, 'user B handoff NOT silently blocked by user A completed row');
  check(applyCalledForB, 'applyFn WAS called for user B (data processed, not ignored)');
}

// ── T8: no duplicates in pending_clarifications on retry before completion ─────

section('T8 — retry before completion → pending_clarifications idempotent (no duplicates)');

{
  const sb = createMockSupabase({ sessions: [], pending: [] });  // session NOT yet completed

  const items = [
    { type: 'medication_mention', raw_text: 'Beru Pradaxu', utterance_index: 0, reason: 'unsupported_structured_persistence' },
    { type: 'new_symptom',        raw_text: 'Bolí mě koleno', utterance_index: 1, reason: 'non_idempotent_handoff' },
  ];

  // First call: write pending.
  await appendPendingClarifications(sb, UID, SESSION_A, items);
  const afterFirst = sb._state.pending.length;
  check(afterFirst === 2, `first write: ${afterFirst} items stored`);

  // Second call (retry, same session_id): idempotency gate must prevent duplicates.
  await appendPendingClarifications(sb, UID, SESSION_A, items);
  const afterSecond = sb._state.pending.length;
  check(afterSecond === 2, `after retry: still ${afterSecond} items (no duplicates)`);
  check(sb._state.pending.filter(e => e.session_id === SESSION_A).length === 2,
    'all items have session_id = SESSION_A');

  // Third call with a DIFFERENT session_id: should append.
  await appendPendingClarifications(sb, UID, SESSION_B, [
    { type: 'new_symptom', raw_text: 'Bolí mě záda', utterance_index: 0, reason: 'non_idempotent_handoff' },
  ]);
  const afterThird = sb._state.pending.length;
  check(afterThird === 3, `new session_id appended: ${afterThird} items total`);
}

// ── T9: no DB write without verified token ────────────────────────────────────

section('T9 — no DB write without verified token');

{
  let supabaseCreated = false;
  let applyFnCalled   = false;

  const req = {
    method:  'POST',
    headers: { authorization: 'Bearer expired-token' },
    body:    { session_id: SESSION_A, structured_facts: [], deferred_facts: [] },
  };
  const res = mockRes();

  await handler(req, res, {
    verifyIdToken:  async () => { throw new Error('Token revoked'); },
    createSupabase: ()       => { supabaseCreated = true; return createMockSupabase(); },
    applyFn:        async () => { applyFnCalled = true; return { persistence_status: 'ok' }; },
  });

  check(res.statusCode === 401,    '401 returned on bad token');
  check(!supabaseCreated,          'Supabase client NOT created without verified token');
  check(!applyFnCalled,            'applyFn NOT called without verified token');
}

// ── T10: static check — no LOCKED files imported ─────────────────────────────

section('T10 — static analysis: no write to LOCKED files');

{
  const LOCKED = [
    'api/engine/engine.js',
    'api/engine/dailyDecision.js',
    // healthEventAdapter is IMPORTED (read-only use) — not a violation.
    // orchestrator.js is also LOCKED and must not be imported by session-handoff.
    'api/engine/orchestrator.js',
  ];

  const src = readFileSync('api/session-handoff.js', 'utf-8');

  // orchestrator.js must not be imported.
  check(!src.includes('orchestrator'), 'orchestrator.js NOT imported');

  // engine.js and dailyDecision.js must not be imported.
  check(!src.includes("'./engine/engine.js'"),        "engine.js NOT imported");
  check(!src.includes("'./engine/dailyDecision.js'"), "dailyDecision.js NOT imported");

  // applyHealthEvent from healthEventAdapter is allowed (read-only use, LOCKED but importable).
  check(src.includes('healthEventAdapter'), 'healthEventAdapter imported (allowed)');

  // Supabase anon key must not appear (only service_role key is used, from env).
  check(!src.includes('supabaseClient'), 'anon supabaseClient NOT imported');

  // Firebase credentials not hardcoded.
  check(!src.match(/AIza[A-Za-z0-9_-]{35}/), 'no Firebase API key literal');

  // SUPABASE_SERVICE_ROLE_KEY read from env, not hardcoded.
  const hasServiceKey = src.includes('SUPABASE_SERVICE_ROLE_KEY');
  check(hasServiceKey, 'uses SUPABASE_SERVICE_ROLE_KEY env var');
}

// ── T11: processHandoff full happy path ───────────────────────────────────────

section('T11 — processHandoff full happy path (measurement + medication)');

{
  const sb = createMockSupabase();
  const applyLog = [];

  const result = await processHandoff({
    uid:        UID,
    session_id: SESSION_A,
    structured_facts: [
      { event_type: 'NEW_MEASUREMENT', payload: { obs_type: 'weight_kg', value: 85 }, raw_text: 'Vážím 85 kg', utterance_index: 0 },
    ],
    deferred_facts: [
      { type: 'medication_mention', raw_text: 'Beru metformin', utterance_index: 1, reason: 'unsupported_structured_persistence' },
    ],
    supabase: sb,
    applyFn: async (uid, event) => {
      applyLog.push({ uid, event_type: event.event_type });
      return { persistence_status: 'ok' };
    },
  });

  check(result.ok,                      'ok: true');
  check(!result.already_completed,      'already_completed not set');
  check(result.facts_applied === 1,     'facts_applied: 1 (measurement)');
  check(result.facts_deferred === 1,    'facts_deferred: 1 (medication)');
  check(applyLog.length === 1,          'applyFn called once for measurement');
  check(applyLog[0].event_type === 'NEW_MEASUREMENT', 'applyFn event_type: NEW_MEASUREMENT');
  check(applyLog[0].uid === UID,        'applyFn called with correct uid');

  // handoff_sessions row should be created.
  const sessionRow = sb._state.sessions.find(s => s.session_id === SESSION_A);
  check(!!sessionRow,                             'handoff_sessions row created');
  check(sessionRow?.user_id === UID,              'session row user_id correct');
  check(sessionRow?.facts_applied === 1,          'session row facts_applied = 1');
  check(sessionRow?.facts_deferred === 1,         'session row facts_deferred = 1');

  // pending_clarifications should have the medication item.
  check(sb._state.pending.length === 1,           'pending has 1 item');
  check(sb._state.pending[0]?.session_id === SESSION_A, 'pending item session_id correct');
  check(sb._state.pending[0]?.type === 'medication_mention', 'pending item type correct');
}

// ── T12: processHandoff — applyHealthEvent error → not marked completed ────────

section('T12 — applyHealthEvent error → session NOT marked completed (safe retry)');

{
  const sb = createMockSupabase();

  let thrown = false;
  try {
    await processHandoff({
      uid:        UID,
      session_id: SESSION_A,
      structured_facts: [
        { event_type: 'NEW_MEASUREMENT', payload: { obs_type: 'lab_ldl', value: 4.2 }, raw_text: 'LDL 4.2', utterance_index: 0 },
      ],
      deferred_facts: [],
      supabase: sb,
      applyFn: async () => ({ persistence_status: 'error', error: 'DB unavailable' }),
    });
  } catch {
    thrown = true;
  }

  check(thrown, 'processHandoff throws when applyFn returns error');
  // handoff_sessions row must NOT exist (session not marked completed → safe retry).
  check(sb._state.sessions.length === 0, 'handoff_sessions row NOT created on failure');
}

// ── T13: 405 for non-POST ──────────────────────────────────────────────────────

section('T13 — 405 for non-POST methods');

{
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    const req = { method, headers: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    check(res.statusCode === 405, `${method} → 405`);
  }
}

// ── T14: missing/invalid body fields → 400 ────────────────────────────────────

section('T14 — missing/invalid body fields → 400');

{
  const makeReq = (body) => ({
    method:  'POST',
    headers: { authorization: 'Bearer t' },
    body,
  });
  const goodHooks = {
    verifyIdToken:  async () => ({ uid: UID }),
    createSupabase: ()       => createMockSupabase(),
    applyFn:        async () => ({ persistence_status: 'ok' }),
  };

  // Missing session_id.
  {
    const res = mockRes();
    await handler(makeReq({ structured_facts: [], deferred_facts: [] }), res, goodHooks);
    check(res.statusCode === 400, 'missing session_id → 400');
  }

  // structured_facts not an array.
  {
    const res = mockRes();
    await handler(makeReq({ session_id: SESSION_A, structured_facts: 'bad', deferred_facts: [] }), res, goodHooks);
    check(res.statusCode === 400, 'structured_facts not array → 400');
  }

  // deferred_facts not an array.
  {
    const res = mockRes();
    await handler(makeReq({ session_id: SESSION_A, structured_facts: [], deferred_facts: {} }), res, goodHooks);
    check(res.statusCode === 400, 'deferred_facts not array → 400');
  }
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${passed + failed} assertions — ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED.`);
  process.exit(1);
} else {
  console.log('\nAll assertions passed.');
}
