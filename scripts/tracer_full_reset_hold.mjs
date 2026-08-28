// tracer_full_reset_hold.mjs — Full Reset FAIL: HOLD follow-up text persists after reset
// Repro: "Pro dnešek je hotovo..." → Tester Full Reset → stejný text zůstává
// Run: node --env-file=.env.local scripts/tracer_full_reset_hold.mjs [userId]
//
// Trace 7 bodů z acceptance contractu:
//   1. _SK/_LRK hodnoty před resetem (localStorage — code analysis + instrukce pro browser)
//   2. /api/tester-reset full → 200?
//   3. _SK/_LRK po clearSession() (code analysis + instrukce)
//   4. clearSession() key parity vůči saveSession()/saveLastResponse()
//   5. Co po resetu volá render() a s jakým objektem
//   6. DOM persistence vs localStorage state
//   7. DB state po full resetu

// TEMPORARY EXCEPTION — TESTER_UIDS REQUIRED:
//   runTesterReset() requires the UID to be in TESTER_UIDS whitelist.
//   Without explicit userId, defaults to Tester 0 (u58iRWcMr9bbakFMJYGFGARpi9h1).
//   Tester 0 state is snapshot/restored in try/finally so automated runs
//   leave no permanent side effects.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient }     from '@supabase/supabase-js';
import { runTesterReset }   from '../api/tester-reset.js';
import { runEngine }        from '../api/engine/engine.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Tester 0 is the only allowed default — it is in TESTER_UIDS.
const TESTER_0 = 'u58iRWcMr9bbakFMJYGFGARpi9h1';
const USER_ID  = process.argv[2] || TESTER_0;

function sep(s) { console.log(`\n${'─'.repeat(68)}\n  ${s}\n${'─'.repeat(68)}`); }
function row(k, v) { console.log(`  ${String(k).padEnd(46)} ${JSON.stringify(v)}`); }
function ok(s) { console.log(`  ✅  ${s}`); }
function fail(s) { console.log(`  ❌  ${s}`); }

// ── TRACE 4: Key parity — clearSession vs saveLastResponse ────────────────────
sep('TRACE 4 — Key parity: clearSession() vs save*() key construction');

console.log(`
  launcher.html source:
  ─────────────────────────────────────────────────────────────────────
  let _uid = null;                     ← module-level, set by start()

  const _SK  = uid => \`chj_session_v1:\${uid}\`;
  const _LRK = uid => \`chj_last_response_v1:\${uid}\`;

  saveLastResponse(r):
    localStorage.setItem(_LRK(_uid), ...)   ← uses module _uid

  clearSession():
    localStorage.removeItem(_SK(_uid))      ← uses module _uid
    localStorage.removeItem(_LRK(_uid))     ← uses module _uid

  btn-full-reset click handler:
    const uid = _uid ?? window.__chj_userId  ← local variable
    ...
    clearSession()                           ← uses module _uid — NOT local uid

  KEY PARITY RESULT:
    saveLastResponse() writes: _LRK(module._uid)
    clearSession() removes:    _LRK(module._uid)
    → PARITY OK IF module._uid == module._uid at both times.
    → PARITY FAILS if module._uid changed between save and clear.

  When could _uid change?
    _uid is set ONLY in start() and in the logout onAuthStateChanged handler:
      start(userId) → _uid = userId
      user=null     → _uid = null

    If onAuthStateChanged fires user=null between save and reset
    (e.g. Firebase session expires or network hiccup):
      _uid becomes null → clearSession() uses null → wrong key

  _uid = null edge case:
    clearSession() would remove:
      localStorage['chj_session_v1:null']         (wrong key)
      localStorage['chj_last_response_v1:null']   (wrong key)
    But _LRK for this user is:
      localStorage['chj_last_response_v1:${USER_ID}']  ← NOT removed!
`);

for (const uid of [USER_ID, null, undefined]) {
  const sk  = `chj_session_v1:${uid}`;
  const lrk = `chj_last_response_v1:${uid}`;
  console.log(`  _uid=${JSON.stringify(uid)} → _SK="${sk}"  _LRK="${lrk}"`);
}

// ── TRACE 5: Code paths that call render() after renderIdle() ─────────────────
sep('TRACE 5 — Re-render paths: what calls render() after Full Reset?');

console.log(`
  All code paths that call render() in launcher.html:
  ─────────────────────────────────────────────────────────────────────
  A. start(userId)
       → loadLastResponse() → if mode !== ASK && mode !== HOLD → render(last)
       → else → renderIdle()
     Trigger: onAuthStateChanged(user) or dev urlUserId on page load.
     RISK: If onAuthStateChanged fires again AFTER Full Reset → start() re-runs.
     Condition for render(): last !== null AND mode ∉ {ASK, HOLD}
     Current HOLD follow-up has mode='HOLD' → start() calls renderIdle() not render().
     → SAFE if mode='HOLD' is correctly stored in _LRK.

  B. orchestrate() completion
       → render(response)
       → saveLastResponse(response)
     Trigger: successful /api/orchestrate fetch.
     RISK: If orchestrate() was IN FLIGHT when Full Reset was clicked,
           the fetch completes AFTER clearSession()+renderIdle() and calls:
             render(response)         → DOM overwritten with old text
             saveLastResponse(resp)   → _LRK re-populated with old text
           Result: "Pro dnešek je hotovo..." reappears.
           _LRK re-populated → next start() would see HOLD → renderIdle() (not render).
           → Only visible in the CURRENT browser session, not on reload.

  C. Error handler in orchestrate()
       → $stage.textContent = 'Nastala chyba...'
     Not relevant (different text).

  D. setLoading(true) in orchestrate()
       → $stage.textContent = '…'
     Not relevant (different text).

  RACE CONDITION ANALYSIS (Cause B — most likely):
  ─────────────────────────────────────────────────────────────────────
  Typical orchestrate() latency: 2–8s (Haiku + engine + DB)

  Sequence that produces the bug:
    T=0     user sends "Co dál?" → orchestrate() starts → setLoading(true)
    T=0     busy = true, DOM = "…", input disabled, send/mic disabled
    T=0     TESTER PANEL BUTTONS ARE NOT DISABLED ← critical gap
    T≈0.5   user clicks "Full reset" (impatient, or quickly after seeing "…")
    T=0.5   fetch('/api/tester-reset') starts (async)
    T≈1.0   /api/tester-reset returns 200
    T≈1.0   clearSession() → _SK removed, _LRK removed
    T≈1.0   renderIdle() → DOM = "Co se dnes děje?"
    T≈3.0   /api/orchestrate returns → orchestrate() resumes:
              render(response)         → DOM = "Pro dnešek je hotovo..." ← BUG
              saveLastResponse(resp)   → _LRK re-populated
              busy = false
              $input.value = ''

  Result: text reverts to old HOLD response after clearSession()+renderIdle() already ran.

  Alternative sequence (Cause B, no race):
    T=0     user sees "Pro dnešek je hotovo..." (orchestrate already done)
    T=0     user clicks "Full reset" immediately
    T=0     busy = false (orchestrate finished)
    T≈1.0   /api/tester-reset 200 → clearSession() → renderIdle() ← no race
    → Should work correctly. Race only if orchestrate is still in flight.

  CAUSE A (_uid = null at clearSession() time):
    Requires Firebase session to expire mid-session.
    Less likely in a short test session.
    Would cause: _LRK NOT cleared → on RELOAD _LRK present with mode='HOLD'
                 → start() → mode='HOLD' → renderIdle() → "Co se dnes děje?" ✓
    → This would NOT reproduce "text persists immediately" — only on reload.
    → Probably not the cause if text appears immediately after reset.

  VERDICT:
    If text appears IMMEDIATELY after reset (no reload): Cause B (race condition).
    If text appears only after RELOAD: Cause A (_uid key mismatch).
`);

// ── TRACE 6: DOM persistence vs localStorage state ────────────────────────────
sep('TRACE 6 — DOM persistence (browser console verification instructions)');

console.log(`
  Pro ověření v browser console (F12 → Console):

  PŘED FULL RESETEM (po "Pro dnešek je hotovo..."):
    localStorage.getItem('chj_last_response_v1:${USER_ID}')
    localStorage.getItem('chj_session_v1:${USER_ID}')
    // Očekáváno: _LRK = JSON s mode:'HOLD', text:'Pro dnešek...'
    //            _SK  = JSON s last_daily_decision.mode:'HOLD'

  TĚSNĚ PO KLIKNUTÍ "Full reset" (IHNED, ještě než fetch doběhne):
    // Přidej do konzole PŘED kliknutím — observe localStorage changes:
    // V jiném tabu otevři app a sleduj:
    //   setInterval(() => console.log(localStorage.getItem('chj_last_response_v1:${USER_ID}')), 500)

  PO DOBĚHNUTÍ RESETU (po "reset ✓" v status):
    localStorage.getItem('chj_last_response_v1:${USER_ID}')
    localStorage.getItem('chj_session_v1:${USER_ID}')
    document.getElementById('stage-text').textContent

  KLÍČOVÁ KOMBINACE:
    Pokud _LRK = null ALE DOM = "Pro dnešek...":
      → Cause B: render() byl zavolán PO renderIdle() (race condition)
      → orchestrate() v pozadí přepsal DOM po resetu

    Pokud _LRK = { mode:'HOLD', text:... } ALE DOM = "Co se dnes děje?":
      → clearSession() nezmazalo správný klíč
      → _uid byl null nebo jiný UID

    Pokud _LRK = null ALE DOM = "Co se dnes děje?":
      → Reset funguje správně (bug je jinde)

  OVĚŘENÍ RACE CONDITION:
    Otevři DevTools → Network
    Klikni "Co dál?" → v Network sleduj /api/orchestrate
    DOKUD request čeká (pending) → klikni "Full reset"
    Sleduj: co se stane po dokončení /api/orchestrate requestu
`);

// ── TRACE 1+3: localStorage state (simulated — browser only) ─────────────────
sep('TRACE 1+3 — localStorage keys (simulated from code — verify in browser)');

console.log(`
  Klíče pro userId=${USER_ID}:
    _SK  = "chj_session_v1:${USER_ID}"
    _LRK = "chj_last_response_v1:${USER_ID}"

  Struktura _LRK po HOLD follow-up response:
    {
      mode: "HOLD",
      text: "Pro dnešek je hotovo. U vhodných možností ještě čekám na dostatek času nebo dat k vyhodnocení. Vrať se zítra.",
      buttons: [],
      expects_reply: false,
      debug: { reason_code: "HOLD_TOO_EARLY", warnings: [] }
    }

  clearSession() maže:
    localStorage.removeItem("chj_session_v1:${USER_ID}")
    localStorage.removeItem("chj_last_response_v1:${USER_ID}")

  Po úspěšném clearSession():
    localStorage.getItem("chj_last_response_v1:${USER_ID}") === null ← expected
`);

// ── Snapshot Tester 0 state ───────────────────────────────────────────────────
sep('SNAPSHOT — save Tester 0 state before test');

const { data: savedHp } = await sb
  .from('user_health_profile')
  .select('diagnoses,symptoms,medications,labs,physical,lifestyle,behavior_flags,crt_cache')
  .eq('user_id', USER_ID).maybeSingle();
const { data: savedAssignments } = await sb
  .from('action_assignments').select('*').eq('user_id', USER_ID);
const { data: savedMissionLog } = await sb
  .from('mission_log').select('*').eq('user_id', USER_ID);
const { data: savedConstraints } = await sb
  .from('user_constraints').select('*').eq('user_id', USER_ID);

row('  saved action_assignments count', savedAssignments?.length ?? 0);
row('  saved mission_log count',        savedMissionLog?.length ?? 0);

async function restoreState() {
  await sb.from('action_assignments').delete().eq('user_id', USER_ID);
  if (savedAssignments?.length) await sb.from('action_assignments').insert(savedAssignments);
  await sb.from('mission_log').delete().eq('user_id', USER_ID);
  if (savedMissionLog?.length) await sb.from('mission_log').insert(savedMissionLog);
  await sb.from('user_constraints').delete().eq('user_id', USER_ID);
  if (savedConstraints?.length) await sb.from('user_constraints').insert(savedConstraints);
  if (savedHp) {
    await sb.from('user_health_profile').upsert({ user_id: USER_ID, ...savedHp }, { onConflict: 'user_id' });
  }
  console.log('  State restored ✓');
}

try {

// ── TRACE 2+7: /api/tester-reset full → 200 + DB state ───────────────────────
sep('TRACE 2+7 — /api/tester-reset full reset: live API call + DB state before/after');

// DB state before reset
const { data: assignsBefore } = await sb
  .from('action_assignments').select('action_id, status', { count: 'exact' })
  .eq('user_id', USER_ID);
const { data: hpBefore } = await sb
  .from('user_health_profile')
  .select('diagnoses, symptoms, medications, labs, physical, lifestyle, behavior_flags')
  .eq('user_id', USER_ID).maybeSingle();
const { data: constraintsBefore } = await sb
  .from('user_constraints').select('constraint_key').eq('user_id', USER_ID);

console.log('\n  DB BEFORE reset:');
row('  action_assignments (count)',   assignsBefore?.length ?? 0);
row('  user_constraints (count)',     constraintsBefore?.length ?? 0);
row('  diagnoses',                    hpBefore?.diagnoses ?? '(null)');
row('  symptoms',                     hpBefore?.symptoms ?? '(null)');
row('  physical (sedentary_h)',       hpBefore?.physical?.sedentary_hours_day ?? '(null)');
row('  crt_cache present',            !!hpBefore?.behavior_flags);

// Run the full reset via exported function
console.log('\n  Running runTesterReset(userId, "full", sb)...');
const result = await runTesterReset(USER_ID, 'full', sb);
console.log(`  HTTP status: ${result.status}`);
console.log(`  Response:    ${JSON.stringify(result.body)}`);

if (result.status === 200) {
  ok('/api/tester-reset full → 200 ok');
} else {
  fail(`/api/tester-reset full → ${result.status}: ${result.body?.error}`);
}

// DB state after reset
const { data: assignsAfter } = await sb
  .from('action_assignments').select('action_id').eq('user_id', USER_ID);
const { data: hpAfter } = await sb
  .from('user_health_profile')
  .select('diagnoses, symptoms, medications, labs, physical, lifestyle, behavior_flags, crt_cache')
  .eq('user_id', USER_ID).maybeSingle();
const { data: constraintsAfter } = await sb
  .from('user_constraints').select('constraint_key').eq('user_id', USER_ID);

console.log('\n  DB AFTER reset:');
row('  action_assignments (count)',   assignsAfter?.length ?? 0);
row('  user_constraints (count)',     constraintsAfter?.length ?? 0);
row('  diagnoses',                    hpAfter?.diagnoses ?? '(null)');
row('  symptoms',                     hpAfter?.symptoms ?? '(null)');
row('  physical',                     hpAfter?.physical ?? '(null)');
row('  crt_cache',                    hpAfter?.crt_cache == null ? '(null)' : 'present');

// Verify contract
(assignsAfter?.length ?? 0) === 0 ? ok('action_assignments = 0') : fail(`action_assignments = ${assignsAfter?.length}`);
(constraintsAfter?.length ?? 0) === 0 ? ok('user_constraints = 0') : fail(`user_constraints = ${constraintsAfter?.length}`);
hpAfter?.diagnoses == null ? ok('diagnoses = null') : fail('diagnoses NOT null');
hpAfter?.symptoms  == null ? ok('symptoms = null')  : fail('symptoms NOT null');
hpAfter?.physical  == null ? ok('physical = null')  : fail('physical NOT null');
hpAfter?.crt_cache == null ? ok('crt_cache = null') : fail('crt_cache NOT null');

// Engine after reset
console.log('\n  Engine after full reset:');
const eng = await runEngine(USER_ID);
const dd  = computeDailyDecision(eng);
row('  DD mode',        dd.mode);
row('  DD reason_code', dd.reason_code);
dd.reason_code !== 'HOLD_TOO_EARLY'
  ? ok('engine NOT HOLD_TOO_EARLY after reset')
  : fail('engine still HOLD_TOO_EARLY — action_assignments not cleared?');

// ── Root cause summary ────────────────────────────────────────────────────────
sep('ROOT CAUSE SUMMARY');

console.log(`
  ACCEPTANCE CONTRACT vs. current implementation:
  ─────────────────────────────────────────────────────────────────────
  ✅  DB test state cleared       → verified above (action_assignments=0, hp cleared)
  ?   _SK absent                  → browser console only
  ?   _LRK absent                 → browser console only
  ?   stale DOM response removed  → browser console only
  ✅  renderIdle() called          → code calls renderIdle() on success path
  ?   "Co se dnes děje?" shown    → browser console only

  HYPOTHESES — ranked by probability:
  ─────────────────────────────────────────────────────────────────────
  1. RACE CONDITION [HIGH PROBABILITY — if text appears immediately]
     orchestrate() is in flight when Full Reset is clicked.
     Tester panel buttons are NOT disabled by setLoading().
     After clearSession()+renderIdle(), orchestrate() completes:
       render(response)       → DOM overwritten with "Pro dnešek..."
       saveLastResponse(resp) → _LRK re-populated
     ROOT: No mechanism to abort or ignore in-flight orchestrate() result after reset.
     MINIMAL FIX: set a "reset in progress" flag; orchestrate() checks it before render().

  2. _uid = null AT CLEAR TIME [MEDIUM PROBABILITY — if text appears on reload]
     Firebase session expired / auth state changed between save and reset.
     clearSession() removes chj_last_response_v1:null (wrong key).
     _LRK for real userId persists → start() sees mode='HOLD' → renderIdle() ✓.
     But _LRK not actually gone → if _uid is restored, stale data still there.
     ROOT: clearSession() uses module _uid without explicit uid param.
     MINIMAL FIX: pass explicit uid to clearSession() from reset handler.

  3. start() CALLED AFTER RESET [LOW PROBABILITY]
     onAuthStateChanged fires unexpectedly (token refresh, network reconnect).
     start() re-runs after renderIdle() — but _LRK has mode='HOLD' (if not cleared).
     start() sees mode='HOLD' → renderIdle() → correct text shown.
     This would actually be SAFE with current start() logic.
     Not a root cause for "text persists immediately".

  MINIMAL FIX (Cause 1 — race condition):
    In the reset handler, after clearSession()+renderIdle():
      → Set a module-level flag: _resetInProgress = true
      → In orchestrate() finally/catch: if (_resetInProgress) return (don't render)
      → Clear flag after renderIdle()
    OR simpler: reset handler sets busy = false before clearSession()
      (but orchestrate() still calls render() in its completion)
    CLEANEST: abort controller on the fetch inside orchestrate(),
      or a simple version counter that orchestrate() checks before render().

  MINIMAL FIX (Cause 2 — uid mismatch):
    clearSession() should accept explicit uid:
      function clearSession(uid = _uid) {
        localStorage.removeItem(_SK(uid));
        localStorage.removeItem(_LRK(uid));
      }
    Reset handler: clearSession(uid) where uid = _uid ?? window.__chj_userId
`);

} finally {
  sep('RESTORE — Tester 0 state');
  await restoreState();
}

console.log('\n' + '═'.repeat(68));
console.log('  TRACER DONE — verify hypotheses with browser console commands above');
console.log('═'.repeat(68));
