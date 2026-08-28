// tracer_post_reset_request.mjs — Post-reset "Co mám dnes dělat?" response audit
//
// Symptom: po Full resetu uživatel vidí "Co se dnes děje?" (DOM správně),
//   ale první request "Co mám dnes dělat?" vrátí follow-up HOLD text.
//
// Run: node --env-file=.env.local scripts/tracer_post_reset_request.mjs [userId]
//
// TEMPORARY EXCEPTION — TESTER_UIDS REQUIRED:
//   runTesterReset() requires the UID to be in TESTER_UIDS whitelist.
//   Without explicit userId, defaults to Tester 0 (u58iRWcMr9bbakFMJYGFGARpi9h1).
//   Tester 0 state is snapshot/restored in try/finally so automated runs
//   leave no permanent side effects.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { processInput }         from '../api/engine/orchestrator.js';
import { runEngine }            from '../api/engine/engine.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';
import { createClient }         from '@supabase/supabase-js';
import { runTesterReset }       from '../api/tester-reset.js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Tester 0 is the only allowed default — it is in TESTER_UIDS.
const TESTER_0 = 'u58iRWcMr9bbakFMJYGFGARpi9h1';
const USER_ID  = process.argv[2] || TESTER_0;
const TEXT     = 'Co mám dnes dělat?';

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

console.log(`  user_id: ${USER_ID}`);
row('  saved action_assignments count', savedAssignments?.length ?? 0);
row('  saved mission_log count',        savedMissionLog?.length ?? 0);
row('  saved user_constraints count',   savedConstraints?.length ?? 0);

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
  console.log(`  State restored ✓`);
}

try {
  // ── PREP: Full reset ──────────────────────────────────────────────────────────
  sep('PREP — Full reset: DB → clean slate');
  const reset = await runTesterReset(USER_ID, 'full', sb);
  row('  tester-reset status',       reset.status);
  row('  deleted_action_assignments', reset.body?.deleted_action_assignments);
  row('  health_profile_cleared',     reset.body?.health_profile_cleared);
  reset.status === 200 ? ok('DB clean') : fail(`reset failed: ${JSON.stringify(reset.body)}`);

  // ── TRACE 1: Engine output after full reset ───────────────────────────────────
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

  // ── TRACE 2: processInput with CLEAN session ──────────────────────────────────
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
  row('    mode',         cleanResult.mode);
  row('    text[:80]',    cleanResult.text?.slice(0, 80));
  row('    reason_code',  cleanResult.debug?.reason_code ?? '—');
  cleanResult.mode !== 'HOLD'
    ? ok(`clean session → ${cleanResult.mode} (not HOLD)`)
    : fail(`clean session still HOLD — server-side issue confirmed`);
  const isFollowUpText = (cleanResult.text ?? '').startsWith(FOLLOW_UP_TEXT);
  isFollowUpText
    ? fail(`response contains follow-up HOLD text "${FOLLOW_UP_TEXT}..."`)
    : ok(`response does not contain HOLD follow-up text`);

  // ── TRACE 3: processInput with stale HOLD session ─────────────────────────────
  sep(`TRACE 3 — processInput("${TEXT}", session=stale_HOLD) — what happens with stale browser session`);
  const staleResult = await processInput(USER_ID, TEXT, HOLD_STALE_SESSION);
  console.log('\n  stale session sent:');
  row('    last_daily_decision.mode', HOLD_STALE_SESSION.last_daily_decision.mode);
  console.log('\n  response:');
  row('    mode',        staleResult.mode);
  row('    text[:80]',   staleResult.text?.slice(0, 80));
  row('    reason_code', staleResult.debug?.reason_code ?? '—');
  staleResult.mode === 'HOLD'
    ? ok(`stale session → HOLD (isHoldFollowUp=true path fires as expected)`)
    : ok(`stale session → ${staleResult.mode} (engine overrides stale HOLD)`);
  const isFollowUpStale = (staleResult.text ?? '').startsWith(FOLLOW_UP_TEXT);
  isFollowUpStale
    ? warn(`stale session produces follow-up HOLD text "${FOLLOW_UP_TEXT}..." — this is the bug`)
    : ok(`stale session does NOT produce follow-up HOLD text`);

  // ── TRACE 4: Chain — what if clean session sees stale _LRK? ──────────────────
  sep('TRACE 4 — Chain: clean session + last_domain_response from stale _LRK');
  const chainSession = {
    last_daily_decision:  HOLD_STALE_SESSION.last_daily_decision,
    last_domain_response: null,
    pending_question:     null,
    current_action_assignment: null,
  };
  const chainResult  = await processInput(USER_ID, TEXT, chainSession);
  row('    mode',        chainResult.mode);
  row('    text[:80]',   chainResult.text?.slice(0, 80));
  row('    reason_code', chainResult.debug?.reason_code ?? '—');

  // ── TRACE 5: localStorage key contract (code analysis only) ──────────────────
  sep('TRACE 5 — localStorage key contract (code analysis)');
  console.log(`
    Browser console verification for USER_ID=${USER_ID}:
    localStorage.getItem('chj_last_response_v1:${USER_ID}')
    localStorage.getItem('chj_session_v1:${USER_ID}')
    // After Full Reset: both should be null (clearSession() ran).
    // If _LRK is not null: clearSession() used wrong key (uid=null race condition).
  `);

} finally {
  sep('RESTORE — Tester 0 state');
  await restoreState();
}

console.log('\n' + '═'.repeat(68));
console.log('  TRACER DONE — verify hypotheses with browser console commands above');
console.log('═'.repeat(68));
