// scripts/test-auth-security.mjs
// P1A Security tests: requireAuth middleware — 7 scenarios
// Uses _hooks.verifyIdToken mock — no real Firebase tokens needed, no deployed bypass.
//
// Run: node scripts/test-auth-security.mjs

import { requireAuth } from '../api/lib/requireAuth.js';

let passed = 0;
let failed = 0;

function makeResMock() {
  const mock = { _status: null, _body: null };
  mock.status = (code) => { mock._status = code; return mock; };
  mock.json   = (body)  => { mock._body  = body; return mock; };
  return mock;
}

async function run(label, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label}: ${result.reason}`);
      failed++;
    }
  } catch (e) {
    console.error(`  ✗ ${label}: threw ${e.message}`);
    failed++;
  }
}

const REAL_UID    = 'uid-alice-123';
const OTHER_UID   = 'uid-bob-456';
const VALID_TOKEN = 'valid-token';

// _hooks mock: accepts VALID_TOKEN → REAL_UID, throws for anything else
const goodVerify = async (token) => {
  if (token === VALID_TOKEN) return { uid: REAL_UID };
  throw new Error('Token verification failed');
};

console.log('\n── P1A Authorization Security Tests ──────────────────────────\n');

// 1. No Authorization header → 401
await run('No token → 401', async () => {
  const req = { method: 'POST', headers: {}, body: { userId: REAL_UID } };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (result !== null)       return { ok: false, reason: `expected null, got ${JSON.stringify(result)}` };
  if (res._status !== 401)   return { ok: false, reason: `expected 401, got ${res._status}` };
  return { ok: true };
});

// 2. Invalid/expired token → 401
await run('Invalid token → 401', async () => {
  const req = { method: 'POST', headers: { authorization: 'Bearer bad-token' }, body: { userId: REAL_UID } };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (result !== null)       return { ok: false, reason: `expected null, got ${JSON.stringify(result)}` };
  if (res._status !== 401)   return { ok: false, reason: `expected 401, got ${res._status}` };
  return { ok: true };
});

// 3. Token uid A + body userId B → 403
await run('Token uid A + body userId B → 403', async () => {
  const req = { method: 'POST', headers: { authorization: `Bearer ${VALID_TOKEN}` }, body: { userId: OTHER_UID } };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (result !== null)       return { ok: false, reason: `expected null, got ${JSON.stringify(result)}` };
  if (res._status !== 403)   return { ok: false, reason: `expected 403, got ${res._status}` };
  return { ok: true };
});

// 4. Token uid A + body userId A → allowed, uid = A
await run('Token uid A + body userId A → 200, uid=A', async () => {
  const req = { method: 'POST', headers: { authorization: `Bearer ${VALID_TOKEN}` }, body: { userId: REAL_UID } };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!result)               return { ok: false, reason: `expected auth object, got null (status ${res._status})` };
  if (result.uid !== REAL_UID) return { ok: false, reason: `uid mismatch: got ${result.uid}` };
  return { ok: true };
});

// 5. Token uid A, no userId in body → server uses A
await run('Token uid A, no userId in body → uid=A', async () => {
  const req = { method: 'POST', headers: { authorization: `Bearer ${VALID_TOKEN}` }, body: {} };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!result)               return { ok: false, reason: `expected auth object, got null (status ${res._status})` };
  if (result.uid !== REAL_UID) return { ok: false, reason: `uid mismatch: got ${result.uid}` };
  return { ok: true };
});

// 6. Cross-user access blocked — token A cannot supply userId B via query param
await run('Cross-user data access blocked (token A, userId B via query → 403)', async () => {
  const req = { method: 'GET', headers: { authorization: `Bearer ${VALID_TOKEN}` }, query: { userId: OTHER_UID }, body: {} };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (result !== null)       return { ok: false, reason: `expected null (403), got ${JSON.stringify(result)}` };
  if (res._status !== 403)   return { ok: false, reason: `expected 403, got ${res._status}` };
  return { ok: true };
});

// 7. Demo bypass — demo-user-123 allowed without token
await run('Demo user bypass — no token required', async () => {
  const req = { method: 'GET', headers: {}, query: { userId: 'demo-user-123' }, body: { userId: 'demo-user-123' } };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  if (!result)               return { ok: false, reason: `expected demo auth, got null` };
  if (result.uid !== 'demo-user-123') return { ok: false, reason: `uid mismatch: ${result.uid}` };
  if (!result.demo)          return { ok: false, reason: 'missing demo flag' };
  return { ok: true };
});

// 8. No deployed impersonation bypass — x-test-auth-uid header must NOT grant access
await run('No impersonation bypass — x-test-auth-uid header ignored', async () => {
  const req = {
    method: 'POST',
    headers: { 'x-test-auth-uid': REAL_UID, 'x-test-auth-secret': 'any-secret' },
    body: { userId: REAL_UID },
  };
  const res = makeResMock();
  const result = await requireAuth(req, res, { verifyIdToken: goodVerify });
  // Must NOT grant access (should return null with 401 — no Bearer token)
  if (result !== null)       return { ok: false, reason: `bypass should not work; got ${JSON.stringify(result)}` };
  if (res._status !== 401)   return { ok: false, reason: `expected 401, got ${res._status}` };
  return { ok: true };
});

console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────────────────────\n`);
if (failed > 0) process.exit(1);
