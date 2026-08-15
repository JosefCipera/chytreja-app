// tracer_post_reset_request.mjs — Post-reset "Co mám dnes dělat?" response audit
//
// Symptom: po Full resetu uživatel vidí "Co se dnes děje?" (DOM správně),
//   ale první request "Co mám dnes dělat?" vrátí follow-up HOLD text.
//
// Klíčová otázka: stale session přichází z browseru, nebo server produkuje HOLD
//   i pro čistou (prázdnou) session?
//
// Run: node --env-file=.env.local scripts/tracer_post_reset_request.mjs [userId]

import { processInput }         from '../api/engine/orchestrator.js';
import { runEngine }            from '../api/engine/engine.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';
import { createClient }         from '@supabase/supabase-js';
import { runTesterReset }       from '../api/tester-reset.js';

const sb      = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID = process.argv[2] || 'vPrm5PNzLWWWhi9sSwYVbkb9FaD3';
const TEXT    = 'Co mám dnes dělat?';

function sep(s)     { console.log(`\n${'─'.repeat(68)}\n  ${s}\n${'─'.repeat(68)}`); }
function row(k, v)  { console.log(`  ${String(k).padEnd(46)} ${JSON.stringify(v)}`); }
function ok(s)      { console.log(`  ✅  ${s}`); }
function fail(s)    { console.log(`  ❌  ${s}`); }
function warn(s)    { console.log(`  ⚠   ${s}`); }

const FOLLOW_UP_TEXT = 'Pro dnešek je hotovo';
const HOLD_STALE_SESSION = {
  last_daily_decision: {
    mode:         'HOLD',
    reason_code:  'HOLD_TOO_EARLY',
    primary_item: { label: 'Intervalový trénink: 4 min naplno, 3 min klus — 4×' },
    evaluated_at: new Date().toISOString(),
  },
  last_domain_response:      null,
  pending_question:          null,
  current_action_assignment: null,
};

// ── PREP: Full reset (ensure clean DB) ────────────────────────────────────────
sep('PREP — Full reset: DB → clean slate');

const reset = await runTesterReset(USER_ID, 'full', sb);
row('  tester-reset status',       reset.status);
row('  deleted_action_assignments', reset.body?.deleted_action_assignments);
row('  health_profile_cleared',     reset.body?.health_profile_cleared);
reset.status === 200 ? ok('DB clean') : fail(`reset failed: ${JSON.stringify(reset.body)}`);

// ── TRACE 1: Engine output after full reset ────────────────────────────────────
sep('TRACE 1 — Fresh engine after DB reset');

const eng = await runEngine(USER_ID);
const dd  = computeDailyDecision(eng);

row('  engine DD mode',        dd.mode);
row('  engine DD reason_code', dd.reason_code);
row('  NBA status',            eng.next_best_action?.status);
row('  NBA selected',          eng.next_best_action?.selected?.action_id ?? '(null)');
row('  intervention_exposure count', eng.intervention_exposure?.length ?? 0);
row('  response_evaluations count',  eng.response_evaluations?.length ?? 0);

dd.mode !== 'HOLD'
  ? ok(`engine returns ${dd.mode} (not HOLD) — DB reset confirmed effective`)
  : fail(`engine returns HOLD after reset — action_assignments may not be cleared`);

// ── TRACE 2: processInput with CLEAN session = {} ─────────────────────────────
sep(`TRACE 2 — processInput("${TEXT}", session={}) — what SHOULD happen post-reset`);

const cleanSession = {};
const cleanResult  = await processInput(USER_ID, TEXT, cleanSession);

console.log('\n  session sent:');
row('    session (keys)', Object.keys(cleanSession));
row('    last_daily_decision', cleanSession.last_daily_decision ?? null);

console.log('\n  isHoldFollowUp computed from:');
row('    adapterType (DOMAIN_REQUEST?)', 'DOMAIN_REQUEST (expected — plain question)');
row('    state.last_daily_decision?.mode', cleanSession.last_daily_decision?.mode ?? null);
row('    → isHoldFollowUp', 'DOMAIN_REQUEST && null === HOLD → false');

console.log('\n  response:');
row('    mode',          cleanResult.mode);
row('    text (first 80)', cleanResult.text?.slice(0, 80));
row('    buttons',       cleanResult.buttons);
row('    reason_code',   cleanResult.debug?.reason_code);

const cleanIsFollowUp = cleanResult.text?.includes(FOLLOW_UP_TEXT);
cleanIsFollowUp
  ? fail(`TRACE 2: clean session produces follow-up HOLD text — SERVER BUG`)
  : ok(`TRACE 2: clean session → ${cleanResult.mode} (expected, no follow-up HOLD)`);

// ── TRACE 3: processInput with STALE session (last_daily_decision.mode='HOLD') ─
sep(`TRACE 3 — processInput("${TEXT}", session={last_daily_decision:{mode:'HOLD'}}) — stale browser sends this`);

const staleResult = await processInput(USER_ID, TEXT, HOLD_STALE_SESSION);

console.log('\n  session sent:');
row('    last_daily_decision.mode', HOLD_STALE_SESSION.last_daily_decision.mode);

console.log('\n  isHoldFollowUp computed from:');
row('    adapterType', 'DOMAIN_REQUEST (expected)');
row('    state.last_daily_decision?.mode', 'HOLD');
row('    → isHoldFollowUp', 'DOMAIN_REQUEST && HOLD === HOLD → TRUE');

console.log('\n  response:');
row('    mode',          staleResult.mode);
row('    text (first 80)', staleResult.text?.slice(0, 80));
row('    buttons',       staleResult.buttons);
row('    reason_code',   staleResult.debug?.reason_code);

const staleIsFollowUp = staleResult.text?.includes(FOLLOW_UP_TEXT);
staleIsFollowUp
  ? ok(`TRACE 3: stale session produces follow-up HOLD (this matches user-observed behavior)`)
  : warn(`TRACE 3: stale session did NOT produce follow-up HOLD — unexpected`);

// ── TRACE 4: session_updates returned from TRACE 2 (clean path) ───────────────
sep('TRACE 4 — session_updates from clean path: what does launcher save after first response?');

console.log(`
  After clean-session request completes, orchestrate() calls:
    saveSession(response.session_updates)
    saveLastResponse(response)

  response.session_updates from TRACE 2:
`);

const su = cleanResult.session_updates ?? {};
row('    last_daily_decision.mode', su.last_daily_decision?.mode ?? '(null)');
row('    last_daily_decision.reason_code', su.last_daily_decision?.reason_code ?? '(null)');
row('    pending_question',   su.pending_question ?? '(null)');
row('    current_action_assignment', su.current_action_assignment ?? '(null)');

if (su.last_daily_decision?.mode === 'HOLD') {
  warn('TRACE 4: clean request saves last_daily_decision.mode=HOLD into _SK!');
  warn('         Next request will compute isHoldFollowUp=true — CHAIN BUG!');
} else {
  ok(`TRACE 4: clean request saves last_daily_decision.mode=${su.last_daily_decision?.mode ?? 'null'} — OK`);
}

// ── TRACE 5: processInput SECOND clean request (chain effect check) ───────────
sep('TRACE 5 — Second request with session from TRACE 2 session_updates (chain)');

console.log(`
  Simulates: user sends TWO messages after reset.
  First response saved session_updates into _SK.
  Second message reads from _SK — what session does launcher send?
`);

const chainSession = {
  last_daily_decision:       su.last_daily_decision ?? null,
  last_domain_response:      su.last_domain_response ?? null,
  pending_question:          su.pending_question ?? null,
  current_action_assignment: su.current_action_assignment ?? null,
};

row('  second request last_daily_decision.mode', chainSession.last_daily_decision?.mode ?? '(null)');
row('  isHoldFollowUp for second request', `DOMAIN_REQUEST && ${chainSession.last_daily_decision?.mode} === HOLD → ${chainSession.last_daily_decision?.mode === 'HOLD'}`);

const chainResult  = await processInput(USER_ID, TEXT, chainSession);
row('  second response mode',          chainResult.mode);
row('  second response text (first 80)', chainResult.text?.slice(0, 80));

chainResult.text?.includes(FOLLOW_UP_TEXT)
  ? fail('TRACE 5: chain effect — second post-reset message returns follow-up HOLD!')
  : ok(`TRACE 5: chain OK — second message returns ${chainResult.mode}`);

// ── ROOT CAUSE MATRIX ─────────────────────────────────────────────────────────
sep('ROOT CAUSE MATRIX — which scenario matches observed behavior?');

console.log(`
  Observed: DOM = "Co se dnes děje?" after reset ✓
            response to "Co mám dnes dělat?" = "Pro dnešek je hotovo..." (HOLD follow-up)

  ┌─────────────────────────────────────────────────────────────────────────┐
  │ TRACE 2 clean session → follow-up HOLD:  ${cleanIsFollowUp ? 'YES ← SERVER BUG' : 'NO'} │
  │ TRACE 3 stale session → follow-up HOLD:  ${staleIsFollowUp ? 'YES' : 'NO'} │
  │ TRACE 4 saves mode=HOLD into _SK:        ${su.last_daily_decision?.mode === 'HOLD' ? 'YES ← CHAIN BUG' : 'NO'} │
  │ TRACE 5 second request → follow-up HOLD: ${chainResult.text?.includes(FOLLOW_UP_TEXT) ? 'YES ← CHAIN BUG' : 'NO'} │
  └─────────────────────────────────────────────────────────────────────────┘
`);

if (cleanIsFollowUp) {
  fail('ROOT CAUSE A: SERVER BUG — processInput with clean session produces HOLD follow-up.');
  fail('  → last_daily_decision in state is somehow HOLD even with session={}');
  fail('  → check if buildSessionUpdates reads state instead of fresh engine result');
} else if (chainResult.text?.includes(FOLLOW_UP_TEXT)) {
  fail('ROOT CAUSE B: CHAIN BUG — first request after reset saves mode=HOLD into _SK.');
  fail(`  → buildSessionUpdates saves last_daily_decision.mode=${su.last_daily_decision?.mode}`);
  fail('  → second message reads this → isHoldFollowUp=true → follow-up HOLD text');
  fail('  → fix: saveSession should NOT preserve last_daily_decision from clean requests');
} else {
  warn('ROOT CAUSE C: BROWSER SENDS STALE SESSION — _SK not cleared before first request.');
  warn('  → stale last_daily_decision.mode=HOLD reaches server');
  warn('  → clearSession(uid) did not run, ran with wrong uid, or was overwritten by race');
}

// ── Browser console verification ──────────────────────────────────────────────
sep('BROWSER VERIFICATION — console commands to run BEFORE first post-reset message');

console.log(`
  After "Co se dnes děje?" appears — BEFORE typing "Co mám dnes dělat?":

  1. Inspect _SK (session state):
     JSON.parse(localStorage.getItem('chj_session_v1:${USER_ID}') || 'null')
     Expected after reset: null
     If HOLD present: stale _SK → root cause C (race or uid mismatch)

  2. Inspect _LRK (presentation cache):
     JSON.parse(localStorage.getItem('chj_last_response_v1:${USER_ID}') || 'null')
     Expected after reset: null

  3. Watch _SK during first request:
     let before = localStorage.getItem('chj_session_v1:${USER_ID}');
     console.log('_SK before:', before);
     // send "Co mám dnes dělat?" → then:
     let after = localStorage.getItem('chj_session_v1:${USER_ID}');
     console.log('_SK after:', JSON.parse(after || 'null')?.last_daily_decision?.mode);

  4. Check if in-flight orchestrate() rewrote _SK (race):
     setInterval(() => {
       const v = localStorage.getItem('chj_session_v1:${USER_ID}');
       const dd = v ? JSON.parse(v).last_daily_decision?.mode : null;
       if (dd) console.log('[SK changed]', dd, new Date().toISOString());
     }, 200);
     // Then click Full Reset — watch for any SK changes after renderIdle()

  KEY DIAGNOSTIC:
    _SK = null before first message AND response = follow-up HOLD → Root cause A or B (server)
    _SK = {last_daily_decision:{mode:'HOLD'}} before first message → Root cause C (browser/race)
`);

console.log('═'.repeat(68));
console.log('  TRACER DONE');
console.log('═'.repeat(68));
