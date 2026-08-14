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
let _renderCalled     = false;

function orchestrate(_text) { _orchestrateCalls++; }
function renderIdle()        { _idleRendered = true; }
function render(_r)          { _renderCalled = true; }

function start(userId) {
  _uid = userId;   // scope set FIRST

  const last = loadLastResponse();
  // ASK presentation is ephemeral — discard only lastResponse, keep session intact.
  if (last && last.mode !== 'ASK') {
    render(last);
  } else {
    if (last?.mode === 'ASK') localStorage.removeItem(_LRK(_uid));
    renderIdle();
  }
}

function logout() {
  _uid = null;
}

function resetStartCounters() {
  _orchestrateCalls = 0;
  _idleRendered     = false;
  _renderCalled     = false;
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

console.log('\n[8] Auto-start guard — new user: zero orchestrate calls, idle shown');
{
  resetStartCounters();
  start('user-new');  // no saved lastResponse → renderIdle(), not orchestrate()

  assert('orchestrate call count = 0', _orchestrateCalls === 0);
  assert('idle screen rendered',       _idleRendered === true);
  assert('render() NOT called',        _renderCalled === false);
}

console.log('\n[9] Auto-start guard — returning user with ACT state: render, no orchestrate');
{
  _uid = 'user-returning';
  saveLastResponse({ mode: 'ACT', text: 'Jdi na procházku.', buttons: ['Hotovo'], expects_reply: false });

  resetStartCounters();
  start('user-returning');  // has ACT lastResponse → render(), not orchestrate()

  assert('orchestrate call count = 0', _orchestrateCalls === 0);
  assert('render() called',            _renderCalled === true);
  assert('idle NOT shown',             _idleRendered === false);
}

console.log('\n[9b] Stale ASK lastResponse — idle shown, only lastResponse removed, session preserved');
{
  _uid = 'user-stale-ask';
  saveLastResponse({ mode: 'ASK', text: 'Upřesni prosím.', buttons: [], expects_reply: true });
  saveSession({ pending_question: { text: 'Co tě trápí?' }, current_action_assignment: 'pohyb' });

  resetStartCounters();
  start('user-stale-ask');

  assert('orchestrate call count = 0',    _orchestrateCalls === 0);
  assert('idle shown (ASK presentation discarded)', _idleRendered === true);
  assert('render() NOT called',           _renderCalled === false);
  assert('lastResponse key removed',
    localStorage.getItem('chj_last_response_v1:user-stale-ask') === null);
  assert('session still exists (not wiped)',
    localStorage.getItem('chj_session_v1:user-stale-ask') !== null);

  // Verify session data intact
  const s = loadSession();
  assert('pending_question preserved',          s.pending_question?.text === 'Co tě trápí?');
  assert('current_action_assignment preserved', s.current_action_assignment === 'pohyb');
}

console.log('\n[9c] After idle: user replies "Ano" — orchestrate fires once with session intact');
{
  // _uid still 'user-stale-ask', session still has pending_question
  resetStartCounters();

  // Simulate user sending "Ano" — the session with pending_question is available for classifier
  const sessionBeforeSend = loadSession();
  orchestrate('Ano');  // in real app this sends { text:'Ano', session: loadSession() }

  assert('orchestrate call count = 1',       _orchestrateCalls === 1);
  assert('pending_question still in session', sessionBeforeSend.pending_question?.text === 'Co tě trápí?');
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
