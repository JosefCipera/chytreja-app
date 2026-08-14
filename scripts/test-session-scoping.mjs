/**
 * Regression test: session scoping per Firebase UID.
 * Simulates user A → session → logout → user B must start fresh.
 *
 * Run: node scripts/test-session-scoping.mjs
 */

// ── Mock localStorage ──────────────────────────────────────────────────────────
const _store = {};
const localStorage = {
  getItem:    k      => _store[k] ?? null,
  setItem:    (k, v) => { _store[k] = v; },
  removeItem: k      => { delete _store[k]; },
  keys:       ()     => Object.keys(_store),
};

// ── Replicate the scoped session logic from launcher.html ─────────────────────
let _uid = null;

const _SK  = uid => `chj_session_v1:${uid}`;
const _LRK = uid => `chj_last_response_v1:${uid}`;

function loadSession()     { try { return JSON.parse(localStorage.getItem(_SK(_uid))  || '{}');   } catch { return {}; } }
function loadLastResponse(){ try { return JSON.parse(localStorage.getItem(_LRK(_uid)) || 'null'); } catch { return null; } }

function saveSession(updates) {
  const merged = { ...loadSession(), ...updates };
  localStorage.setItem(_SK(_uid), JSON.stringify(merged));
  return merged;
}
function saveLastResponse(r) {
  localStorage.setItem(_LRK(_uid), JSON.stringify({
    mode: r.mode, text: r.text, buttons: r.buttons, expects_reply: r.expects_reply,
    debug: r.debug ?? null,
  }));
}
function clearSession() {
  localStorage.removeItem(_SK(_uid));
  localStorage.removeItem(_LRK(_uid));
}

function start(userId) {
  _uid = userId;   // scope set FIRST
}

function logout() {
  _uid = null;
}

// ── Test harness ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n[1] Key format');
{
  assert('_SK format', _SK('uid-abc') === 'chj_session_v1:uid-abc');
  assert('_LRK format', _LRK('uid-abc') === 'chj_last_response_v1:uid-abc');
}

console.log('\n[2] User A creates a session');
{
  start('user-A');
  saveSession({ pending_question: { text: 'Upřesni prosím.' } });
  saveLastResponse({ mode: 'ASK', text: 'Upřesni prosím.', buttons: [], expects_reply: true });

  const s = loadSession();
  assert('A: pending_question saved', s.pending_question?.text === 'Upřesni prosím.');
  assert('A: lastResponse saved', loadLastResponse()?.text === 'Upřesni prosím.');
}

console.log('\n[3] Logout user A');
{
  logout();
  assert('_uid cleared after logout', _uid === null);
}

console.log('\n[4] User B starts — must see empty session');
{
  start('user-B');
  const s  = loadSession();
  const lr = loadLastResponse();

  assert('B: session is {}',            Object.keys(s).length === 0);
  assert('B: lastResponse is null',     lr === null);
  assert('B: no pending_question',      !s.pending_question);
  assert('B: no current_action_assignment', !s.current_action_assignment);
  assert('B: no last_daily_decision',   !s.last_daily_decision);
  assert('B: no last_domain_response',  !s.last_domain_response);
}

console.log('\n[5] A\'s keys untouched in storage (isolation)');
{
  const aSession  = JSON.parse(localStorage.getItem('chj_session_v1:user-A') || 'null');
  const bSession  = JSON.parse(localStorage.getItem('chj_session_v1:user-B') || 'null');
  assert('A key still has pending_question', aSession?.pending_question?.text === 'Upřesni prosím.');
  assert('B key is absent or empty', bSession === null || Object.keys(bSession).length === 0);
}

console.log('\n[6] clearSession removes only current user\'s keys');
{
  start('user-B');
  saveSession({ some_data: true });
  clearSession();

  const aKey = localStorage.getItem('chj_session_v1:user-A');
  const bKey = localStorage.getItem('chj_session_v1:user-B');
  assert('B key removed', bKey === null);
  assert('A key preserved', aKey !== null);
}

console.log('\n[7] Unscoped legacy keys do not exist');
{
  const legacySession  = localStorage.getItem('chj_session_v1');
  const legacyResponse = localStorage.getItem('chj_last_response_v1');
  assert('no unscoped chj_session_v1',       legacySession  === null);
  assert('no unscoped chj_last_response_v1', legacyResponse === null);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('  REGRESSION DETECTED');
  process.exit(1);
} else {
  console.log('  All session-scoping invariants hold.');
}
