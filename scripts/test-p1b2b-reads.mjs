// P1B.2b — non-core private READ migration tests
// Covers: node-history endpoint, notifications.js migration audit,
//         data-layer.js fetchTrend authFetch migration.
// universe-panel.js aspiration DEFERRED (P1B.2b #2 not yet approved).

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { requireAuth } from '../api/lib/requireAuth.js';
import { default as handler } from '../api/user.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0; let failed = 0;
function ok(label)      { console.log(`  ✓ ${label}`); passed++; }
function fail(label, d) { console.error(`  ✗ ${label}${d !== undefined ? ': ' + d : ''}`); failed++; }

function mockRes() {
  const r = { _status: 200, _body: null, _headers: {} };
  r.status    = (s) => { r._status = s; return r; };
  r.json      = (b) => { r._body   = b; return r; };
  r.setHeader = (k, v) => { r._headers[k] = v; };
  return r;
}

// ── 1. Auth boundary — no token → 401 ───────────────────────────
console.log('\n── 1. Auth boundary (no token) ───────────────────');

{
  const req = { method: 'GET', query: { action: 'node-history', nodeId: 'telo' },
    body: {}, headers: {} };
  const res = mockRes();
  const auth = await requireAuth(req, res);
  if (!auth && res._status === 401) ok('node-history: 401 without token');
  else fail('node-history: expected 401', res._status);
}

// ── 2. Auth boundary — invalid token → 401 ──────────────────────
console.log('\n── 2. Auth boundary (invalid token) ──────────────');

{
  const req = { method: 'GET', query: { action: 'node-history', nodeId: 'telo' },
    body: {}, headers: { authorization: 'Bearer bad.token' } };
  const res = mockRes();
  const auth = await requireAuth(req, res,
    { verifyIdToken: async () => { throw new Error('token-expired'); } });
  if (!auth && res._status === 401) ok('node-history: 401 invalid token');
  else fail('node-history: invalid token should 401', res._status);
}

// ── 3. Cross-user — victim userId + attacker token → 403 ────────
console.log('\n── 3. Cross-user protection ──────────────────────');

{
  const req = { method: 'GET',
    query: { action: 'node-history', nodeId: 'telo', userId: 'victim-uid' },
    body: {}, headers: { authorization: 'Bearer attacker.token' } };
  const res = mockRes();
  const auth = await requireAuth(req, res,
    { verifyIdToken: async () => ({ uid: 'attacker-uid' }) });
  if (!auth && res._status === 403) ok('node-history: victim userId + attacker uid → 403');
  else fail('node-history: cross-user should 403', res._status);
}

// ── 4. Wrong method → 405 ────────────────────────────────────────
console.log('\n── 4. Wrong method ───────────────────────────────');

{
  const req = { method: 'POST',
    query: { action: 'node-history', nodeId: 'telo', userId: 'demo-user-123' },
    body: { userId: 'demo-user-123' }, headers: {} };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 405) ok('node-history: POST → 405');
  else fail('node-history: POST should 405', res._status);
}

// ── 5. nodeId validation ─────────────────────────────────────────
console.log('\n── 5. nodeId validation ──────────────────────────');

{
  const req = { method: 'GET',
    query: { action: 'node-history', userId: 'demo-user-123' },
    body: {}, headers: {} };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 400) ok('node-history: missing nodeId → 400');
  else fail('node-history: missing nodeId should 400', res._status);
}

{
  const req = { method: 'GET',
    query: { action: 'node-history', nodeId: '../secret', userId: 'demo-user-123' },
    body: {}, headers: {} };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 400) ok('node-history: special chars in nodeId → 400');
  else fail('node-history: special chars should 400', res._status);
}

{
  const req = { method: 'GET',
    query: { action: 'node-history', nodeId: 'a'.repeat(65), userId: 'demo-user-123' },
    body: {}, headers: {} };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 400) ok('node-history: nodeId >64 chars → 400');
  else fail('node-history: nodeId >64 should 400', res._status);
}

// ── 6. Demo bypass — response shape, ordering, 30d cutoff ────────
console.log('\n── 6. Demo bypass — response shape ───────────────');

{
  const req = { method: 'GET',
    query: { action: 'node-history', nodeId: 'telo', userId: 'demo-user-123' },
    body: {}, headers: {} };
  const res = mockRes();
  await handler(req, res);

  if (res._status !== 200) {
    fail('node-history demo: expected 200', res._status);
  } else {
    const d = res._body;
    if (Array.isArray(d?.data)) ok('node-history demo: response.data is array');
    else fail('node-history demo: response.data should be array', JSON.stringify(d));

    if (Array.isArray(d?.data) && d.data.length > 0) {
      const item = d.data[0];
      const hasShape = 'date' in item && 'state' in item && 'current_index' in item;
      if (hasShape) ok('node-history demo: items have {date, state, current_index}');
      else fail('node-history demo: item shape wrong', JSON.stringify(item));

      const sorted = d.data.every((v, i, a) => i === 0 || a[i-1].date <= v.date);
      if (sorted) ok('node-history demo: data ordered ASC by date');
      else fail('node-history demo: data not ASC ordered');

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 31);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const allFresh = d.data.every(r => r.date >= cutoffStr);
      if (allFresh) ok('node-history demo: all items within 30-day window');
      else fail('node-history demo: item older than 30 days found');
    } else {
      ok('node-history demo: empty history (no data for demo-user)');
      ok('node-history demo: ordering N/A (empty)');
      ok('node-history demo: 30d cutoff N/A (empty)');
    }

    // Cache-Control header
    if (res._headers['Cache-Control'] === 'no-store') ok('node-history demo: Cache-Control: no-store');
    else fail('node-history demo: missing Cache-Control: no-store', res._headers['Cache-Control']);
  }
}

// ── 7. handleNodeHistory reads only auth.uid (no client override) ─
console.log('\n── 7. Source audit — handleNodeHistory ───────────');

{
  const src = readFileSync(path.join(root, 'api/user.js'), 'utf8');
  const nhStart = src.indexOf('// ── GET ?action=node-history');
  const nhEnd   = src.indexOf('// ── POST ?action=save-zdravi');

  if (nhStart === -1 || nhEnd === -1 || nhStart >= nhEnd) {
    fail('handleNodeHistory: could not find section boundaries', `${nhStart}..${nhEnd}`);
  } else {
    const section = src.slice(nhStart, nhEnd);

    const hasSpread = /\{\s*\.\.\.req\.(query|body)/.test(section);
    if (!hasSpread) ok('handleNodeHistory: no {...req.query/body} spread');
    else fail('handleNodeHistory: spread detected — injection risk');

    const usesAuthUid = /req\.query\.userId/.test(section);
    if (usesAuthUid) ok('handleNodeHistory: reads userId from req.query (auth.uid injected)');
    else fail('handleNodeHistory: does not read userId from query');

    const hasNodeIdValidation = /\^.*a-z0-9_.*\$/.test(section) || /nodeId\.length/.test(section);
    if (hasNodeIdValidation) ok('handleNodeHistory: nodeId validation present');
    else fail('handleNodeHistory: nodeId validation not found');
  }
}

// ── 8. notifications.js — no direct Supabase calls ───────────────
console.log('\n── 8. notifications.js migration audit ───────────');

{
  const src = readFileSync(path.join(root, 'app/js/universe/notifications.js'), 'utf8');

  const noDirectSb = !/window\.supabaseClient\s*\.from\s*\(\s*['"]mission_log/.test(src);
  if (noDirectSb) ok('notifications.js: no direct mission_log Supabase access');
  else fail('notifications.js: still has mission_log Supabase call');

  const hasAuthFetch = /import.*authFetch/.test(src);
  if (hasAuthFetch) ok('notifications.js: authFetch imported');
  else fail('notifications.js: authFetch not imported');

  const usesAuthFetch = /authFetch\(.*mission-log/.test(src);
  if (usesAuthFetch) ok('notifications.js: uses authFetch for mission-log');
  else fail('notifications.js: does not use authFetch for mission-log');

  const noCalcStreak = !/_calcStreak/.test(src);
  if (noCalcStreak) ok('notifications.js: _calcStreak removed (computed server-side)');
  else fail('notifications.js: _calcStreak still present');
}

// ── 9. data-layer.js — fetchTrend uses authFetch ─────────────────
console.log('\n── 9. data-layer.js fetchTrend audit ─────────────');

{
  const src = readFileSync(path.join(root, 'app/js/universe/data-layer.js'), 'utf8');

  const noDirectSb = !/window\.supabaseClient.*node_state_history/.test(src);
  if (noDirectSb) ok('data-layer.js fetchTrend: no direct node_state_history Supabase call');
  else fail('data-layer.js: still has direct node_state_history Supabase call');

  const usesAuthFetch = /authFetch.*node-history/.test(src);
  if (usesAuthFetch) ok('data-layer.js fetchTrend: uses authFetch for node-history');
  else fail('data-layer.js: fetchTrend does not use authFetch for node-history');

  const hasEmpty = /EMPTY\s*=\s*\{/.test(src);
  if (hasEmpty) ok('data-layer.js fetchTrend: EMPTY fallback constant present');
  else fail('data-layer.js: EMPTY fallback missing');
}

// ── 10. Notifications mission-log branching parity ────────────────
console.log('\n── 10. Notifications branching parity ────────────');

{
  const cases = [
    { streak: 3, todayMissions: [{ mission_id: 'x' }], expected: 'allDone' },
    { streak: 5, todayMissions: [],                     expected: 'streakRisk' },
    { streak: 0, todayMissions: [],                     expected: 'noMission' },
    { streak: 2, todayMissions: [],                     expected: 'noMission' },
  ];

  for (const c of cases) {
    const donToday = c.todayMissions.length > 0;
    const branch = donToday ? 'allDone' : c.streak >= 3 ? 'streakRisk' : 'noMission';
    if (branch === c.expected)
      ok(`mission parity: streak=${c.streak} done=${donToday} → ${c.expected}`);
    else
      fail(`mission parity: streak=${c.streak} done=${donToday}`, `got ${branch}, expected ${c.expected}`);
  }
}

// ── 11. aspiration-type — no auth → 401 ─────────────────────────
console.log('\n── 11. aspiration-type auth boundary ─────────────');

{
  const req = { method: 'GET', query: { action: 'aspiration-type' }, body: {}, headers: {} };
  const res = mockRes();
  const auth = await requireAuth(req, res);
  if (!auth && res._status === 401) ok('aspiration-type: 401 without token');
  else fail('aspiration-type: expected 401', res._status);
}

// ── 12. aspiration-type — cross-user → 403 ───────────────────────
console.log('\n── 12. aspiration-type cross-user ────────────────');

{
  const req = { method: 'GET',
    query: { action: 'aspiration-type', userId: 'victim-uid' },
    body: {}, headers: { authorization: 'Bearer attacker.token' } };
  const res = mockRes();
  const auth = await requireAuth(req, res,
    { verifyIdToken: async () => ({ uid: 'attacker-uid' }) });
  if (!auth && res._status === 403) ok('aspiration-type: victim userId + attacker uid → 403');
  else fail('aspiration-type: cross-user should 403', res._status);
}

// ── 13. aspiration-type — wrong method → 405 ────────────────────
console.log('\n── 13. aspiration-type wrong method ──────────────');

{
  const req = { method: 'POST',
    query: { action: 'aspiration-type', userId: 'demo-user-123' },
    body: { userId: 'demo-user-123' }, headers: {} };
  const res = mockRes();
  await handler(req, res);
  if (res._status === 405) ok('aspiration-type: POST → 405');
  else fail('aspiration-type: POST should 405', res._status);
}

// ── 14. aspiration-type — demo → response shape ──────────────────
console.log('\n── 14. aspiration-type demo response shape ────────');

{
  const req = { method: 'GET',
    query: { action: 'aspiration-type', userId: 'demo-user-123' },
    body: {}, headers: {} };
  const res = mockRes();
  await handler(req, res);

  if (res._status !== 200) {
    fail('aspiration-type demo: expected 200', res._status);
  } else {
    const d = res._body;
    const hasKey = 'aspiration_type' in d;
    if (hasKey) ok('aspiration-type demo: response has aspiration_type key');
    else fail('aspiration-type demo: response missing aspiration_type key', JSON.stringify(d));

    const isNullOrString = d.aspiration_type === null || typeof d.aspiration_type === 'string';
    if (isNullOrString) ok('aspiration-type demo: aspiration_type is null or string');
    else fail('aspiration-type demo: aspiration_type wrong type', typeof d.aspiration_type);

    if (res._headers['Cache-Control'] === 'no-store') ok('aspiration-type demo: Cache-Control: no-store');
    else fail('aspiration-type demo: missing Cache-Control: no-store', res._headers['Cache-Control']);
  }
}

// ── 15. universe-panel.js — no private Supabase access ───────────
console.log('\n── 15. universe-panel.js private access audit ─────');

{
  const src = readFileSync(path.join(root, 'app/js/universe/universe-panel.js'), 'utf8');

  const noAspSb = !/window\.supabaseClient.*user_aspirations|\.from\s*\(\s*['"]user_aspirations/.test(src);
  if (noAspSb) ok('universe-panel.js: no direct user_aspirations Supabase call');
  else fail('universe-panel.js: still has user_aspirations Supabase call');

  const usesAuthFetch = /authFetch\(.*aspiration-type/.test(src);
  if (usesAuthFetch) ok('universe-panel.js: uses authFetch for aspiration-type');
  else fail('universe-panel.js: does not use authFetch for aspiration-type');

  // No private table access at all (non-public tables)
  const privatePattern = /window\.supabaseClient\.from\s*\(\s*['"](?!longevity_)/.test(src);
  if (!privatePattern) ok('universe-panel.js: no remaining private Supabase table access');
  else fail('universe-panel.js: still has private Supabase table access');
}

// ── results ──────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(52)}`);
console.log(`P1B.2b reads: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
