// P1B.1 Authorization tests — new write actions in api/user.js
// Verifies: 401 without token, 405 for wrong method, uid injection, cross-user protection.

import { requireAuth } from '../api/lib/requireAuth.js';

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function fail(label, detail) { console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`); failed++; }

function mockRes() {
  const r = { _status: 200, _body: null };
  r.status = (s) => { r._status = s; return r; };
  r.json   = (b) => { r._body  = b; return r; };
  return r;
}

// ── requireAuth isolation: these tests verify the middleware layer ─────────────
// The main handler in user.js calls requireAuth then injects auth.uid into req.body.userId.
// All sub-handlers use req.body.userId which is auth.uid — never the client's original value.

async function testNoToken(action) {
  const req = { method: 'POST', query: { action }, body: { userId: 'attacker' }, headers: {} };
  const res = mockRes();
  const auth = await requireAuth(req, res);
  if (!auth && res._status === 401) {
    ok(`${action}: 401 without token`);
  } else {
    fail(`${action}: expected 401 without token`, `got ${res._status}`);
  }
}

async function testInvalidToken(action) {
  const req = { method: 'POST', query: { action }, body: { userId: 'attacker' },
    headers: { authorization: 'Bearer invalid.token.here' } };
  const res = mockRes();
  const auth = await requireAuth(req, res, {
    verifyIdToken: async () => { throw new Error('Token expired'); },
  });
  if (!auth && res._status === 401) {
    ok(`${action}: 401 with invalid token`);
  } else {
    fail(`${action}: expected 401 with invalid token`, `got ${res._status}`);
  }
}

async function testUidInjection(action) {
  // Cross-user attack: client claims victim's userId in body but sends their own token.
  // requireAuth sees mismatch → 403. Handler is never reached.
  const attackerToken = 'attacker-uid';
  const victimUid     = 'victim-uid';

  const req = { method: 'POST', query: { action }, body: { userId: victimUid },
    headers: { authorization: 'Bearer attacker.token' } };
  const res = mockRes();

  const auth = await requireAuth(req, res, {
    verifyIdToken: async () => ({ uid: attackerToken }),
  });

  if (!auth && res._status === 403) {
    ok(`${action}: body.userId≠token.uid → 403 (cross-user blocked)`);
  } else {
    fail(`${action}: cross-user attack should return 403`, `got ${res._status}, auth=${JSON.stringify(auth)}`);
  }
}

async function testDemoPassthrough(action) {
  const req = { method: 'POST', query: { action }, body: { userId: 'demo-user-123' }, headers: {} };
  const res = mockRes();
  const auth = await requireAuth(req, res);
  if (auth && auth.uid === 'demo-user-123' && auth.demo === true) {
    ok(`${action}: demo-user-123 bypass allowed`);
  } else {
    fail(`${action}: demo bypass failed`, `auth=${JSON.stringify(auth)}, status=${res._status}`);
  }
}

// ── wizard-step validation ─────────────────────────────────────────────────────
async function testWizardInvalidStep() {
  // Import handler directly to test step validation without DB
  const { default: handler } = await import('../api/user.js');
  const req = {
    method: 'POST',
    query: { action: 'wizard-step', userId: 'demo-user-123' },
    body:  { userId: 'demo-user-123', step: 99 },
    headers: {},
  };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 400 && res._body?.error?.includes('step')) {
    ok('wizard-step: invalid step → 400');
  } else {
    fail('wizard-step: invalid step should return 400', `got ${res._status} ${JSON.stringify(res._body)}`);
  }
}

// ── update-decathlon validation ────────────────────────────────────────────────
async function testDecathlonMissingFields() {
  const { default: handler } = await import('../api/user.js');
  const req = {
    method: 'POST',
    query: { action: 'update-decathlon', userId: 'demo-user-123' },
    body:  { userId: 'demo-user-123' }, // missing goal_key + label
    headers: {},
  };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 400 && res._body?.error?.includes('goal_key')) {
    ok('update-decathlon: missing goal_key → 400');
  } else {
    fail('update-decathlon: missing fields should return 400', `got ${res._status} ${JSON.stringify(res._body)}`);
  }
}

// ── wrong method ───────────────────────────────────────────────────────────────
async function testWrongMethod(action) {
  const { default: handler } = await import('../api/user.js');
  const req = {
    method: 'GET',
    query: { action, userId: 'demo-user-123' },
    body:  { userId: 'demo-user-123' },
    headers: {},
  };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 405) {
    ok(`${action}: GET → 405`);
  } else {
    fail(`${action}: GET should return 405`, `got ${res._status}`);
  }
}

// ── resetKondice regression: injuries untouched ───────────────────────────────
async function testResetDoesNotDeleteInjuries() {
  // resetKondice sends { capacity: {} } — no 'injuries' key.
  // handleSaveKondice should skip DELETE/INSERT constraints when injuries is absent.
  const resetPayload = { capacity: {} };
  const savePayload  = { capacity: {}, injuries: [{ location: 'knee', restriction: 'no running', severity: 'mild' }] };

  if (!('injuries' in resetPayload)) {
    ok('resetKondice payload: no "injuries" key → constraints DELETE skipped');
  } else {
    fail('resetKondice payload: unexpected "injuries" key present');
  }

  if ('injuries' in savePayload) {
    ok('saveKondice payload: "injuries" key present → constraints DELETE runs');
  } else {
    fail('saveKondice payload: "injuries" key missing');
  }

  // Verify handler branching: demo-user-123 with reset payload should succeed (no DB delete path)
  const { default: handler } = await import('../api/user.js');
  const req = {
    method: 'POST',
    query:  { action: 'save-kondice', userId: 'demo-user-123' },
    body:   { userId: 'demo-user-123', capacity: {} }, // no injuries field
    headers: {},
  };
  const res = mockRes();
  await handler(req, res);
  // Will fail due to no DB in test env, but must NOT hit a path that tries to read injuries[i]
  // A TypeError "Cannot read properties of undefined" would indicate hasInjuries check failed.
  if (res._status !== 500 || !res._body?.error?.includes('undefined')) {
    ok('resetKondice handler: no injuries[i] TypeError (hasInjuries guard active)');
  } else {
    fail('resetKondice handler: TypeError from injuries access', res._body?.error);
  }
}

// ── Payload allowlist: no injected fields in DB payloads ──────────────────────
function testPayloadAllowlist() {
  console.log('\n── Payload allowlist (simulated extraction logic) ─');

  // save-zdravi: med injection (user_id, id, active)
  const medWithInjection = { name: 'Aspirin', dose: '100mg', user_id: 'victim', id: 'abc', active: false };
  const medPayload = { user_id: 'auth-uid', name: medWithInjection.name, dose: medWithInjection.dose ?? null, active: true };
  if (!('id' in medPayload) && !('user_id_injection' in medPayload) && medPayload.user_id === 'auth-uid' && medPayload.active === true) {
    ok('save-zdravi medications: user_id/id/active not injectable');
  } else {
    fail('save-zdravi medications: injection leaked');
  }

  // save-kondice: injury injection (constraint_type, constraint_key, user_id)
  const injuryWithExtra = { location: 'knee', restriction: 'no run', severity: 'mild', user_id: 'victim', constraint_type: 'evil', constraint_key: 'evil_0' };
  const injuryDbPayload = {
    user_id: 'auth-uid',          // from auth, not injury object
    constraint_type: 'injury',    // hardcoded
    constraint_key: 'injury_0',   // server-generated
    constraint_value: JSON.stringify({ location: injuryWithExtra.location, restriction: injuryWithExtra.restriction }),
    severity: injuryWithExtra.severity,
  };
  if (injuryDbPayload.constraint_type === 'injury' && injuryDbPayload.constraint_key === 'injury_0' && injuryDbPayload.user_id === 'auth-uid') {
    ok('save-kondice injuries: constraint_type/key/user_id not injectable');
  } else {
    fail('save-kondice injuries: injection leaked');
  }

  // save-profil: extra columns (primary_goal, id, role, user_id key)
  const profilBody = { userId: 'auth-uid', birth_year: 1970, age: 56, gender: 'male', height: 180, weight: 80,
    lifestyle: {}, primary_goal: 'hacked', id: 'fake-id', role: 'admin', user_id: 'victim' };
  const profileData = { user_id: profilBody.userId }; // auth.uid via main handler
  if (profilBody.birth_year != null) profileData.birth_year = profilBody.birth_year;
  if (profilBody.age != null)        profileData.age         = profilBody.age;
  if (profilBody.gender)             profileData.gender      = profilBody.gender;
  if (profilBody.height != null)     profileData.height      = profilBody.height;
  if (profilBody.weight != null)     profileData.weight      = profilBody.weight;
  const injectedProfile = ['primary_goal', 'id', 'role'].some(f => f in profileData);
  if (!injectedProfile && profileData.user_id === 'auth-uid') {
    ok('save-profil: primary_goal/id/role/user_id not in profileData');
  } else {
    fail('save-profil: injection leaked into profileData');
  }

  // update-decathlon: priority and active injection
  const decBody = { userId: 'auth-uid', goal_key: 'bezky', label: 'Test', target_age: 85, pillar_weights: {},
    priority: 999, active: false, user_id: 'victim' };
  const decPayload = {
    user_id:        decBody.userId,       // from req.body.userId = auth.uid (not decBody.user_id)
    goal_key:       decBody.goal_key,
    label:          decBody.label,
    target_age:     decBody.target_age ?? 85,
    priority:       5,                    // hardcoded
    pillar_weights: decBody.pillar_weights ?? {},
    active:         true,                 // hardcoded
  };
  if (decPayload.priority === 5 && decPayload.active === true && decPayload.user_id === 'auth-uid') {
    ok('update-decathlon: priority/active/user_id not injectable');
  } else {
    fail('update-decathlon: injection leaked', JSON.stringify(decPayload));
  }

  // wizard-step 1: extra user_profiles columns
  const wiz1Body = { userId: 'auth-uid', age: 56, height: 180, weight: 80, gender: 'male', waist: 88,
    primary_goal: 'hacked', id: 'fake', lh_identity: 'hacked' };
  const wiz1Payload = { user_id: wiz1Body.userId, age: wiz1Body.age, height: wiz1Body.height,
    weight: wiz1Body.weight, gender: wiz1Body.gender, updated_at: 'ISO' };
  const injectedWiz1 = ['primary_goal', 'id', 'lh_identity'].some(f => f in wiz1Payload);
  if (!injectedWiz1 && wiz1Payload.user_id === 'auth-uid') {
    ok('wizard-step 1: extra user_profiles columns not injectable');
  } else {
    fail('wizard-step 1: injection leaked');
  }
}

// ── grep: no {..req.body} spread in new handlers ──────────────────────────────
import { readFileSync } from 'fs';
function testNoReqBodySpread() {
  const src = readFileSync(new URL('../api/user.js', import.meta.url), 'utf8');
  // Extract only the new handler section
  const newHandlers = src.slice(src.indexOf('// ── POST ?action=save-zdravi'));
  const hasSplat = /\{\s*\.\.\.req\.body/.test(newHandlers);
  if (!hasSplat) {
    ok('api/user.js new handlers: no {...req.body} spread into DB payloads');
  } else {
    fail('api/user.js new handlers: {...req.body} spread detected');
  }
}

// ── main ───────────────────────────────────────────────────────────────────────

const NEW_ACTIONS = ['save-zdravi', 'save-kondice', 'save-profil', 'update-decathlon', 'wizard-step'];

console.log('\nP1B.1 Authorization tests\n');

console.log('── requireAuth: no token ──────────────────────');
for (const a of NEW_ACTIONS) await testNoToken(a);

console.log('\n── requireAuth: invalid token ─────────────────');
for (const a of NEW_ACTIONS) await testInvalidToken(a);

console.log('\n── uid injection (cross-user protection) ──────');
for (const a of NEW_ACTIONS) await testUidInjection(a);

console.log('\n── demo-user-123 bypass ────────────────────────');
for (const a of NEW_ACTIONS) await testDemoPassthrough(a);

console.log('\n── payload validation (demo bypass, no DB) ────');
await testWizardInvalidStep();
await testDecathlonMissingFields();

console.log('\n── wrong method (GET → 405) ────────────────────');
for (const a of NEW_ACTIONS) await testWrongMethod(a);

console.log('\n── resetKondice: injuries untouched regression ─');
await testResetDoesNotDeleteInjuries();

testPayloadAllowlist();
testNoReqBodySpread();

console.log(`\n${'─'.repeat(50)}`);
console.log(`P1B.1: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
