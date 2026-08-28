// tracer_reset.mjs — trace RESET FAIL: HOLD survives after Reset
// Repro: ACT → WHY → Hotovo → HOLD → Reset → Launcher still shows HOLD
// Run: node --env-file=.env.local scripts/tracer_reset.mjs [userId]
//
// What this tracer covers:
//   1. DB persistence layers (engine inputs)
//   2. start() logic reconstruction (localStorage can't be read from Node —
//      logic is traced from launcher.html source)
//   3. Which source produces the HOLD after reset
//   4. Two reset contracts: UI/session vs Tester full reset

import { createClient }     from '@supabase/supabase-js';
import { fetchHealthData }  from '../api/engine/adapter.js';
import { runEngine }        from '../api/engine/engine.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';

const sb      = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Explicit userId required — no default. This tracer reads live user state.
// Run: node --env-file=.env.local scripts/tracer_reset.mjs <userId>
const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error('Usage: node --env-file=.env.local scripts/tracer_reset.mjs <userId>');
  process.exit(1);
}

function sep(s) { console.log(`\n${'─'.repeat(64)}\n  ${s}\n${'─'.repeat(64)}`); }
function row(k, v) { console.log(`  ${k.padEnd(38)} ${JSON.stringify(v)}`); }

// ── STEP 1: localStorage logic trace (source code, not live browser state) ────
sep('STEP 1 — start() logic: what renders after Reset');

console.log(`
  start(userId) in app/launcher.html:
  ─────────────────────────────────────────────────────
  1. _uid = userId
  2. last = loadLastResponse()              ← JSON.parse(localStorage['chj_last_response_v1:UID'])
  3. if (last && last.mode !== 'ASK')
       → render(last)                       ← ❗ renders whatever was saved by saveLastResponse()
     else
       → renderIdle()

  saveLastResponse() is called on EVERY orchestrate() response:
    { mode, text, buttons, expects_reply, debug }

  After the flow ACT → WHY → Hotovo:
    - ACT response:   saveLastResponse({ mode:'ACT', text:'...', buttons:['Hotovo','Přeskočit'] })
    - WHY response:   saveLastResponse({ mode:'EXPLAIN', text:'...', buttons:['Hotovo','Přeskočit'] })
    - Hotovo result:  saveLastResponse({ mode:'HOLD', text:'Tlak nad hlavu...', buttons:[] })

  _LRK key now contains: { mode:'HOLD', text:'Tlak nad hlavu...', buttons:[] }

  clearSession() removes BOTH _SK and _LRK.
  BUT clearSession() is defined and never wired to any button in launcher.html.

  So "Reset" as Tester 0 knows it is most likely one of:
    A) Page reload (Cmd+R / F5)           → _LRK survives → HOLD rendered
    B) Sign-out + sign-in (Firebase)      → _LRK survives (same UID key) → HOLD rendered
    C) DevTools > Application > Clear     → _LRK gone → renderIdle() — NOT the bug
    D) Clearing _SK only (not _LRK)       → _LRK survives → HOLD rendered

  CONCLUSION: _LRK (chj_last_response_v1:UID) is NOT cleared by any in-app Reset.
  start() sees last.mode='HOLD' → render(last) → HOLD shown. Source = A.
`);

// ── STEP 2: DB state — what engine inputs survive ──────────────────────────────
sep('STEP 2 — DB persistence layers active for Tester 0');

// 2a. user_health_profile
const { data: hp } = await sb
  .from('user_health_profile')
  .select('diagnoses, symptoms, medications, labs, physical, lifestyle, behavior_flags, crt_cache')
  .eq('user_id', USER_ID).maybeSingle();

row('diagnoses',           hp?.diagnoses ?? '(empty)');
row('symptoms',            hp?.symptoms ?? '(empty)');
row('medications',         hp?.medications ?? '(empty)');
row('physical (keys)',     hp?.physical ? Object.keys(hp.physical) : '(empty)');
row('sedentary_hours_day', hp?.physical?.sedentary_hours_day ?? 'null');
row('evidence_availability (keys)',
  hp?.physical?.evidence_availability ? Object.keys(hp.physical.evidence_availability) : '(empty)');
row('lifestyle',           hp?.lifestyle ?? '(empty)');
row('labs (count)',        Array.isArray(hp?.labs) ? hp.labs.length : 'null');
row('crt_cache present',   !!hp?.crt_cache);

// 2b. action_assignments — rolling 7-day window the engine reads
const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const { data: assignments } = await sb
  .from('action_assignments')
  .select('action_id, status, assigned_date, completed_at')
  .eq('user_id', USER_ID)
  .gte('assigned_date', since7)
  .order('assigned_date', { ascending: false });

sep('STEP 2b — action_assignments (last 7 days)');
if (assignments?.length) {
  for (const a of assignments) {
    console.log(`  ${a.assigned_date}  ${a.status.padEnd(12)} action=${a.action_id?.slice(0,8)}...`);
  }
} else {
  console.log('  (none in last 7 days)');
}

// 2c. user_constraints
const { data: constraints } = await sb
  .from('user_constraints')
  .select('constraint_type, body_part, severity, created_at')
  .eq('user_id', USER_ID);

sep('STEP 2c — user_constraints');
if (constraints?.length) {
  for (const c of constraints) {
    console.log(`  ${c.constraint_type} / ${c.body_part ?? '—'} / severity=${c.severity ?? 'null'}`);
  }
} else {
  console.log('  (none)');
}

// 2d. user_aspirations
const { data: aspirations } = await sb
  .from('user_aspirations')
  .select('aspiration_text, created_at')
  .eq('user_id', USER_ID);
row('user_aspirations', aspirations?.length ? aspirations.map(a => a.aspiration_text) : '(none)');

// ── STEP 3: Fresh engine run — why does it still return HOLD? ─────────────────
sep('STEP 3 — fresh engine run (what the orchestrate() call after Reset would see)');

const health  = await fetchHealthData(USER_ID);
const engine  = await runEngine(USER_ID);
const dd      = computeDailyDecision(engine);

console.log('\n  Health data fed to engine:');
row('  diagnoses (count)',   health.clinicalHistory?.diagnoses?.length ?? 0);
row('  observations (list)', (health.observations ?? []).map(o => `${o.obs_type}=${o.value}`));
row('  constraints (count)', health.constraints?.length ?? 0);
row('  action_history len',  health.actionHistory?.length ?? 0);

console.log('\n  Engine output:');
row('  DD mode',          dd.mode);
row('  DD reason_code',   dd.reason_code);
row('  primary_item',     dd.primary_item?.label ?? '—');
row('  system_leverage',  engine.system_leverage?.selected?.node_id ?? '—');
row('  information_needs', (engine.information_needs ?? []).map(n => n.evidence_type));

console.log('\n  HOLD_TOO_EARLY means: action was completed today (within the rolling window)');
console.log('  → action_assignments has a completed row for today');
console.log('  → Engine correctly suppresses a new ACT');
console.log('  → After full reset, action_assignments must be cleared for first-run ACT to fire');

// ── STEP 4: Root cause summary ────────────────────────────────────────────────
sep('STEP 4 — root cause: which source produces the HOLD after Reset');

console.log(`
  Source of HOLD after Reset:

  HOLD is served from TWO independent sources after a session reset:

  SOURCE A — _LRK (chj_last_response_v1:UID) — PRIMARY (immediate)
    saveLastResponse() saved HOLD text after Hotovo.
    start() reads _LRK, finds mode='HOLD' (not ASK), calls render(last).
    → HOLD text shown WITHOUT any orchestrate() call.
    → This is what Tester 0 sees immediately after reload/re-login.
    → Cleared by: clearSession(), DevTools Application clear, or explicit
      localStorage.removeItem('chj_last_response_v1:UID').

  SOURCE B — fresh orchestrate() after Reset — SECONDARY (if user types anything)
    Even if _LRK is cleared → renderIdle() shown → user types "Co mám dělat?"
    → orchestrate() → fresh engine → action_assignments has today's completed row
    → HOLD_TOO_EARLY again.
    → Cleared by: deleting today's action_assignments rows from DB.
`);

// ── STEP 5: Two reset contracts ───────────────────────────────────────────────
sep('STEP 5 — two reset contracts');

console.log(`
  UI/SESSION RESET (prezentační vrstva):
  ─────────────────────────────────────
  Clears:
    • localStorage['chj_last_response_v1:UID']    (saveLastResponse cache)
    • localStorage['chj_session_v1:UID']          (pending_question, current_action_assignment, etc.)
  Does NOT touch:
    • user_health_profile (diagnoses, symptoms, physical, sedentary_hours_day, labs)
    • action_assignments (completed/skipped history)
    • user_constraints
    • user_aspirations
    • crt_cache
  Effect: Launcher shows renderIdle() on next load. But if user types "Co mám dělat?",
    engine still returns HOLD_TOO_EARLY (action_assignments not cleared).
  Use when: testing UI flow, clearing stale chip, soft reset without losing health data.

  TESTER FULL RESET (first-run stav od nuly):
  ────────────────────────────────────────────
  Clears everything in UI/session reset PLUS these DB rows:
    • action_assignments         WHERE user_id = UID        (removes HOLD_TOO_EARLY gate)
    • user_health_profile        WHERE user_id = UID        (removes symptoms/diagnoses/physical/labs)
    • user_constraints           WHERE user_id = UID        (removes knee/wrist constraints)
    • user_aspirations           WHERE user_id = UID        (removes aspirations)
    • crt_cache field            in user_health_profile     (already covered above)
  Optional:
    • node_state_history         WHERE user_id = UID        (sparkline history)
    • mission_log                WHERE user_id = UID        (completed steps — game loop)
    • daily_checkin              WHERE user_id = UID        (Lehkost check-in data)
  Does NOT touch:
    • user_profiles (role, universe) — affects access model, not engine state
    • longevity_nodes, aspiration_requirements — shared data, not per-user
  Effect: first orchestrate() → engine sees no data → ASK_BLOCKING → CHJ vyzve
    uživatele k zadání zdravotních dat. True first-run flow.
`);

// ── STEP 6: What full reset SQL looks like ────────────────────────────────────
sep('STEP 6 — full reset target rows (current state for Tester 0)');

const { count: assignmentCount } = await sb
  .from('action_assignments').select('*', { count: 'exact', head: true })
  .eq('user_id', USER_ID);
const { count: constraintCount } = await sb
  .from('user_constraints').select('*', { count: 'exact', head: true })
  .eq('user_id', USER_ID);
const { count: missionCount } = await sb
  .from('mission_log').select('*', { count: 'exact', head: true })
  .eq('user_id', USER_ID);

row('action_assignments rows',  assignmentCount);
row('user_constraints rows',    constraintCount);
row('user_aspirations rows',    aspirations?.length ?? 0);
row('mission_log rows',         missionCount);
row('user_health_profile row',  hp ? '1 (exists)' : '0 (absent)');

console.log(`
  Tester full reset SQL (safe, scoped to one user):

    DELETE FROM action_assignments   WHERE user_id = '${USER_ID}';
    DELETE FROM user_constraints     WHERE user_id = '${USER_ID}';
    DELETE FROM user_aspirations     WHERE user_id = '${USER_ID}';
    DELETE FROM mission_log          WHERE user_id = '${USER_ID}';
    UPDATE user_health_profile
      SET diagnoses=NULL, symptoms=NULL, medications=NULL,
          labs=NULL, physical=NULL, lifestyle=NULL,
          behavior_flags=NULL, crt_cache=NULL
      WHERE user_id = '${USER_ID}';

  + Browser: localStorage.removeItem('chj_session_v1:${USER_ID}');
             localStorage.removeItem('chj_last_response_v1:${USER_ID}');
`);

console.log('\n' + '═'.repeat(64));
console.log('  TRACER DONE');
console.log('═'.repeat(64));
