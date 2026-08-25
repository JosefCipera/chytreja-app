// scripts/test-landing.mjs — Package 4 static analysis tests
//
// All tests are static — file existence, HTML structure, routing config,
// and source-code pattern checks. No browser, no Firebase, no network.
//
// Run: node scripts/test-landing.mjs

import { readFileSync, existsSync } from 'fs';

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

// ── Load files ────────────────────────────────────────────────────────────────

const LANDING_PATH  = 'app/landing.html';
const MANIFEST_PATH = 'app/manifest.webmanifest';
const LOGIN_PATH    = 'app/login.html';
const VERCEL_PATH   = 'vercel.json';

const landing  = existsSync(LANDING_PATH)  ? readFileSync(LANDING_PATH,  'utf-8') : '';
const loginSrc = existsSync(LOGIN_PATH)    ? readFileSync(LOGIN_PATH,     'utf-8') : '';
const vercel   = JSON.parse(readFileSync(VERCEL_PATH, 'utf-8'));
const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) : null;

// ── T1: landing.html — file and required content ──────────────────────────────

section('T1 — landing.html: exists and has required content');
check(landing.length > 100,                           'landing.html exists and is non-empty');
check(landing.includes('Chytré já'),                  'contains "Chytré já"');
check(landing.includes('Pro život, jaký chceš žít'),  'tagline present');
check(landing.includes('Zdraví si přejeme všichni'),  'opening prompt present');
check(landing.includes('Chceš, abych si tě pamatoval'), 'auth CTA text present');
check(landing.includes('Přihlásit'),                  '"Přihlásit" nav link present');
check(landing.includes('Řekni mi'),                   'input placeholder present');
check(landing.includes('manifest.webmanifest'),       'manifest linked');

// ── T2: landing.html — calls /api/pre-intake ──────────────────────────────────

section('T2 — /api/pre-intake call');
check(landing.includes('/api/pre-intake'),            '/api/pre-intake fetch present');
check(landing.includes("'Content-Type': 'application/json'") ||
      landing.includes('"Content-Type": "application/json"'), 'Content-Type header set');

// ── T3: ASK flow — conversation continues ─────────────────────────────────────

section('T3 — ASK outcome: conversation continues');
check(landing.includes("'ASK'") || landing.includes('"ASK"'), 'ASK outcome referenced');
// ASK branch: input is re-enabled (setInputEnabled(true)) — not hidden/disabled
const askBlock = landing.match(/outcome === ['"]ASK['"][\s\S]{0,400}/)?.[0] || '';
const postAsk  = landing.match(/ASK['"][\s\S]{0,300}setInputEnabled\(true\)/)?.[0] ||
                 landing.match(/setInputEnabled\(true\)[\s\S]{0,200}focus/)?.[0] || '';
check(!!postAsk || landing.includes('msgInput.focus()'), 'input re-enabled after ASK (focus called)');

// ── T4: AHA flow — auth CTA shown ────────────────────────────────────────────

section('T4 — AHA outcome: auth CTA shown, input disabled');
check(landing.includes("'AHA'") || landing.includes('"AHA"'), 'AHA outcome referenced');
check(landing.includes('authCta.hidden') && landing.includes('= false'), 'authCta shown for AHA/NOT_ENOUGH_YET');
check(landing.includes("outcome === 'AHA' || outcome === 'NOT_ENOUGH_YET'") ||
      landing.includes("'AHA'") && landing.includes('NOT_ENOUGH_YET'), 'AHA and NOT_ENOUGH_YET share auth CTA branch');

// ── T5: NOT_ENOUGH_YET flow ───────────────────────────────────────────────────

section('T5 — NOT_ENOUGH_YET outcome');
check(landing.includes('NOT_ENOUGH_YET'), 'NOT_ENOUGH_YET outcome referenced');

// ── T6: URGENT_SAFETY_EXIT — safety message, no auth CTA ─────────────────────

section('T6 — URGENT_SAFETY_EXIT: safety message, auth CTA NOT shown');
check(landing.includes('URGENT_SAFETY_EXIT'), 'URGENT_SAFETY_EXIT outcome referenced');
check(landing.includes('safetySection'),       'safetySection element referenced');
check(landing.includes('safetyText'),          'safetyText element set');
// Safety handler returns early — auth CTA MUST NOT be shown in the URGENT_SAFETY_EXIT branch
// (authCta.hidden = false must not appear after URGENT_SAFETY_EXIT in the same branch)
const safetyBlock = landing.match(/URGENT_SAFETY_EXIT[\s\S]{0,600}/)?.[0] || '';
const ctaAfterSafety = /authCta\.hidden\s*=\s*false/.test(safetyBlock);
check(!ctaAfterSafety, 'authCta NOT shown in URGENT_SAFETY_EXIT branch');
check(/URGENT_SAFETY_EXIT[\s\S]{0,400}return;/.test(landing), 'URGENT_SAFETY_EXIT handler returns early');
// Input bar hidden for safety
check(landing.includes('inputBar.hidden') && landing.includes('= true'), 'input bar hidden on safety exit');

// ── T7: auth → session-handoff → launcher ────────────────────────────────────

section('T7 — auth → session-handoff → /launcher');
check(landing.includes('/api/session-handoff'),  '/api/session-handoff fetch present');
check(landing.includes('Bearer'),                'Authorization Bearer header sent');
check(landing.includes('getIdToken'),            'Firebase getIdToken() called');
check(landing.includes("window.location.href = '/launcher'"),  'redirect to /launcher on handoff success');
check(landing.includes('session_id'),            'session_id sent in handoff body');
check(landing.includes('structured_facts'),      'structured_facts sent');
check(landing.includes('deferred_facts'),        'deferred_facts sent');

// ── T8: handoff failure → anon session preserved ──────────────────────────────

section('T8 — handoff failure: anon session preserved, retry shown');
check(landing.includes('saveAnonSession'),        'saveAnonSession() called before handoff');
check(landing.includes('clearAnonSession'),       'clearAnonSession() called on success');
check(landing.includes('chj_anon_v1'),            'anon session localStorage key present');
check(landing.includes('showHandoffError') || landing.includes('handoffErr'),
      'handoff error state shown on failure');
check(landing.includes('retryBtn'),               'retry button present');
// clearAnonSession called AFTER success (not in catch block)
const clearIdx = landing.indexOf('clearAnonSession');
const catchIdx = landing.lastIndexOf('} catch');
check(clearIdx < catchIdx || landing.split('clearAnonSession').length === 2,
      'clearAnonSession called once (on success path)');

// ── T9: login.html — ?next= redirect handling ─────────────────────────────────

section('T9 — login.html: ?next= redirect handling');
check(loginSrc.includes("get('next')"),           "login.html reads ?next= param with get('next')");
check(loginSrc.includes("|| '/launcher'"),        "login.html defaults to /launcher if no ?next=");
// onAuthStateChanged(auth, ...) call must use _next, not hardcoded '/launcher'
// Use \(auth to match the call site, not the import declaration.
const authChangedCall = loginSrc.match(/onAuthStateChanged\(auth[\s\S]{0,200}/)?.[0] || '';
check(!authChangedCall.includes("href = '/launcher'") &&
      !authChangedCall.includes('href="/launcher"'),
      'onAuthStateChanged uses ?next= variable, not hardcoded /launcher');
check(authChangedCall.includes('_next'),          'onAuthStateChanged redirects to _next variable');

// ── T10: vercel.json — / → landing.html, /landing → landing.html ──────────────

section('T10 — vercel.json: routing');
const rewrites = vercel.rewrites ?? [];
const rootRw = rewrites.find(r => r.source === '/');
check(rootRw?.destination === '/app/landing.html', '/ → /app/landing.html (not login.html)');
const landingRw = rewrites.find(r => r.source === '/landing');
check(!!landingRw,                                  '/landing route exists');
check(landingRw?.destination === '/app/landing.html', '/landing → /app/landing.html');
// login still works
const loginRw = rewrites.find(r => r.source === '/login');
check(loginRw?.destination === '/app/login.html',   '/login still routes to login.html');
// launcher unchanged
const launcherRw = rewrites.find(r => r.source === '/launcher');
check(launcherRw?.destination === '/app/launcher.html', '/launcher unchanged');

// ── T11: manifest.webmanifest — start_url = /launcher ────────────────────────

section('T11 — manifest.webmanifest: structure');
check(manifest !== null,                    'manifest.webmanifest exists and is valid JSON');
check(manifest?.start_url === '/launcher',  `start_url = "/launcher" (got: ${manifest?.start_url})`);
check(manifest?.name?.includes('Chytré'),   'name includes "Chytré"');
check(manifest?.display === 'standalone',   'display: standalone');
check(typeof manifest?.background_color === 'string', 'background_color set');

// ── T12: no auto-redirect for authenticated users ─────────────────────────────

section('T12 — landing.html: no auto-redirect for auth\'d users');
// onAuthStateChanged on landing must NOT contain unconditional redirect to /launcher
// (it should only update loginLink.href and handle isHandoff resume)
// Use \(auth to match the call site, not the import declaration.
const oasc = landing.match(/onAuthStateChanged\(auth[\s\S]{0,800}/)?.[0] || '';
const hasUnconditionalRedirect =
  /window\.location\.href\s*=\s*['"]\/launcher['"]/.test(oasc) &&
  !oasc.includes('isHandoff') &&
  !oasc.includes('handoffTriggered');
check(!hasUnconditionalRedirect, 'no unconditional /launcher redirect in onAuthStateChanged');
check(oasc.includes('loginLink.href'), 'onAuthStateChanged updates loginLink.href');
check(!oasc.includes("location.href = '/launcher'") ||
       oasc.includes('isHandoff'),    'any redirect is gated on isHandoff condition');

// ── T13: Firebase — no LOCKED files imported ──────────────────────────────────

section('T13 — landing.html: no LOCKED files referenced');
check(!landing.includes('engine.js'),          'engine.js NOT referenced');
check(!landing.includes('dailyDecision'),       'dailyDecision NOT referenced');
check(!landing.includes('orchestrator'),        'orchestrator NOT referenced');
check(!landing.includes('healthEventAdapter'), 'healthEventAdapter NOT referenced');

// ── T14: session_id lifecycle — reuse across reload + auth roundtrip ──────────

section('T14 — session_id lifecycle: reuse from localStorage, new UUID only for fresh sessions');
// SESSION_ID must be initialized from saved anon session when available
check(landing.includes('_saved?.session_id'),
      'SESSION_ID init uses _saved?.session_id (reuse from prior session)');
check(landing.includes('_saved?.session_id') && landing.includes('?? crypto.randomUUID()'),
      'Falls back to crypto.randomUUID() only when no saved session');
// loadAnonSession() called before crypto.randomUUID() — so reuse happens first
const loadIdx  = landing.indexOf('loadAnonSession()');
const uuidIdx  = landing.indexOf('crypto.randomUUID()');
check(loadIdx !== -1 && uuidIdx !== -1 && loadIdx < uuidIdx,
      'loadAnonSession() evaluated before crypto.randomUUID()');
// history and facts also restored from saved session
check(landing.includes('_saved?.history'), 'history initialized from saved session');
check(landing.includes('_saved?.structured_facts'), 'structured_facts initialized from saved session');
check(landing.includes('_saved?.deferred_facts'),   'deferred_facts initialized from saved session');
// Restore block: UI restored on reload when history exists
check(landing.includes('history.length > 0') && landing.includes('enterConv()'),
      'enterConv() called on reload when history exists');
// isHandoff block no longer re-loads from localStorage (state already in memory)
const isHandoffBlock = landing.match(/isHandoff && user[\s\S]{0,300}/)?.[0] || '';
check(!isHandoffBlock.includes('loadAnonSession()'),
      'isHandoff block does NOT re-call loadAnonSession() (state already loaded at init)');

// ── T15: launcher.html — manifest linked ─────────────────────────────────────

section('T15 — launcher.html: manifest linked (required for PWA start_url)');
const launcherSrc = existsSync('app/launcher.html')
  ? readFileSync('app/launcher.html', 'utf-8') : '';
check(launcherSrc.includes('manifest.webmanifest'),
      'launcher.html links manifest.webmanifest');
check(launcherSrc.includes('<link rel="manifest"'),
      'launcher.html has <link rel="manifest"> tag');

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${passed + failed} assertions — ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED.`);
  process.exit(1);
} else {
  console.log('\nAll assertions passed.');
}
