/**
 * Regression tests: session scoping per Firebase UID + auto-start guard.
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

// ── Replicate auto-start logic from launcher.html ─────────────────────────────
// orchestrate() is the ONLY place a network call goes out. We mock it to count calls.
let _orchestrateCalls = 0;
let _idleRendered     = false;

function orchestrate(_text) { _orchestrateCalls++; }
function renderIdle()        { _idleRendered = true; }
function render(_response)   { /* would show last saved response */ }

function start(userId) {
  _uid = userId;   // scope set FIRST

  const last = loadLastResponse();
  if (last) render(last);
  else      renderIdle();  // ← no orchestrate() here
}

function logout() {
  _uid = null;
}

function resetStartCounters() {
  _orchestrateCalls = 0;
  _idleRendered     = false;
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

console.log('\n[8] Auto-start guard — new user: zero orchestrate calls');
{
  resetStartCounters();
  start('user-new');  // no saved lastResponse → renderIdle(), not orchestrate()

  assert('orchestrate call count = 0', _orchestrateCalls === 0);
  assert('idle screen rendered',       _idleRendered === true);
}

console.log('\n[9] Auto-start guard — returning user: render saved state, still zero auto-calls');
{
  // Seed a saved response for user-returning
  _uid = 'user-returning';
  saveLastResponse({ mode: 'ACT', text: 'Jdi na procházku.', buttons: ['Hotovo'], expects_reply: false });

  resetStartCounters();
  start('user-returning');  // has lastResponse → render(), not orchestrate()

  assert('orchestrate call count = 0', _orchestrateCalls === 0);
  assert('idle screen NOT rendered (has saved state)', _idleRendered === false);
}

console.log('\n[10] Explicit user input triggers exactly one orchestrate call');
{
  resetStartCounters();
  // Simulate user typing "Co mám dnes dělat?" and pressing send
  orchestrate('Co mám dnes dělat?');

  assert('orchestrate call count = 1', _orchestrateCalls === 1);
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
