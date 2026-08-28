// scripts/test-demo-abuse.mjs — Demo authorization abuse tests
// Verifies demo bypass cannot be leveraged to access real user data.
// Run: node scripts/test-demo-abuse.mjs

import { requireAuth } from '../api/lib/requireAuth.js';

let passed = 0;
let failed = 0;

function makeRes() {
  const r = { _s: null, _b: null };
  r.status = (c) => { r._s = c; return r; };
  r.json   = (b)  => { r._b = b; return r; };
  return r;
}

async function run(label, fn) {
  try {
    const result = await fn();
    if (result.ok) { console.log(`  ✓ ${label}`); passed++; }
    else { console.error(`  ✗ ${label}: ${result.reason}`); failed++; }
  } catch (e) { console.error(`  ✗ ${label}: threw ${e.message}`); failed++; }
}

const REAL_UID   = 'uid-real-user-abc';
const DEMO_UID   = 'demo-user-123';
const goodVerify = async (t) => {
  if (t === 'real-token') return { uid: REAL_UID };
  throw new Error('bad token');
};

console.log('\n── Demo Authorization Abuse Tests ─────────────────────────────\n');

// A1. No token + real userId → 401 (not demo bypass)
await run('Real userId without token → 401', async () => {
  const req = { headers: {}, body: { userId: REAL_UID }, query: {} };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (r !== null)     return { ok: false, reason: `expected null, got ${JSON.stringify(r)}` };
  if (res._s !== 401) return { ok: false, reason: `expected 401, got ${res._s}` };
  return { ok: true };
});

// A2. Demo request → only demo UID returned, never real user UID
await run('Demo userId → auth.uid === demo-user-123 only', async () => {
  const req = { headers: {}, body: { userId: DEMO_UID }, query: {} };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!r)                 return { ok: false, reason: 'expected auth, got null' };
  if (r.uid !== DEMO_UID) return { ok: false, reason: `uid should be demo-user-123, got ${r.uid}` };
  if (!r.demo)            return { ok: false, reason: 'demo flag missing' };
  return { ok: true };
});

// A3. Cannot inject real UID alongside demo via query — body wins, result is demo
await run('Demo body userId + real UID in query → body wins, uid = demo', async () => {
  const req = { headers: {}, body: { userId: DEMO_UID }, query: { userId: REAL_UID } };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!r)                 return { ok: false, reason: 'expected demo auth' };
  if (r.uid !== DEMO_UID) return { ok: false, reason: `uid should be demo, got ${r.uid}` };
  return { ok: true };
});

// A4. Demo userId in query only + no body → demo bypass with uid = demo
await run('Demo userId in query only → uid = demo, no real data access', async () => {
  const req = { headers: {}, body: {}, query: { userId: DEMO_UID } };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!r)                 return { ok: false, reason: 'expected demo auth' };
  if (r.uid !== DEMO_UID) return { ok: false, reason: `uid should be demo, got ${r.uid}` };
  return { ok: true };
});

// A5. Cannot reach real user data via context.userId with demo top-level
// requireAuth only reads top-level body.userId / query.userId
await run('Demo top-level + real UID in context.userId → requireAuth returns demo', async () => {
  const req = {
    headers: {},
    body: { userId: DEMO_UID, context: { userId: REAL_UID } },
    query: {},
  };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!r)                 return { ok: false, reason: 'expected demo auth' };
  if (r.uid !== DEMO_UID) return { ok: false, reason: `uid should be demo, got ${r.uid}` };
  return { ok: true };
});

// A6. No userId anywhere → 401 (no spurious demo grant)
await run('No userId anywhere → 401, not auto-demo', async () => {
  const req = { headers: {}, body: {}, query: {} };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (r !== null)     return { ok: false, reason: `expected null (401), got ${JSON.stringify(r)}` };
  if (res._s !== 401) return { ok: false, reason: `expected 401, got ${res._s}` };
  return { ok: true };
});

// A7. Valid token without userId → auth.uid from token only (not guessed/defaulted)
await run('Valid token, no body userId → auth.uid = token uid (not demo)', async () => {
  const req = { headers: { authorization: 'Bearer real-token' }, body: {}, query: {} };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!r)                 return { ok: false, reason: `expected auth, got null (${res._s})` };
  if (r.uid !== REAL_UID) return { ok: false, reason: `uid should be ${REAL_UID}, got ${r.uid}` };
  return { ok: true };
});

// A8. Impersonation via removed test-bypass header → 401
await run('x-test-auth-uid header → 401 (no deployed bypass)', async () => {
  const req = {
    headers: { 'x-test-auth-uid': REAL_UID, 'x-test-auth-secret': 'anything' },
    body: {},
    query: {},
  };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (r !== null)     return { ok: false, reason: `bypass should not work; got ${JSON.stringify(r)}` };
  if (res._s !== 401) return { ok: false, reason: `expected 401, got ${res._s}` };
  return { ok: true };
});

// A9. Real token + demo userId in body → demo bypass fires (body read before token)
//     Result: auth.uid = demo-user-123; DB queries see demo uid only.
//     This is safe: an attacker WITH a real token cannot escalate to access more
//     than their own data via demo — they get LESS (demo data only).
await run('Real token + demo body userId → auth.uid = demo (downgrade, not escalation)', async () => {
  const req = {
    headers: { authorization: 'Bearer real-token' },
    body: { userId: DEMO_UID },
    query: {},
  };
  const res = makeRes();
  const r = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!r)                 return { ok: false, reason: 'expected demo auth' };
  if (r.uid !== DEMO_UID) return { ok: false, reason: `uid should be demo, got ${r.uid}` };
  // Confirmed: cannot use demo bypass as escalation to read MORE data
  return { ok: true };
});

console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────────────────────\n`);
if (failed > 0) process.exit(1);
