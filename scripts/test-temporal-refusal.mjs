// test-temporal-refusal.mjs — STOP #5B regression: Guard F1 / Guard F2
//
// Proves deterministic temporal-refusal classification and orchestrator behavior.
//
// Classifier mock (same pattern as test-guided-now-budget.mjs / STOP #4):
//   @anthropic-ai/sdk replaced via esmock so classifyIntent always returns
//   ANSWER_TO_EVIDENCE_QUESTION with the pending evidence_type.
//   Production classifier is UNCHANGED — this is test-side only.
//
// Section 1 — Regex unit tests (no DB, no network)
//   All cases from the semantic-check report:
//   "14", "abc", "14 kg", "Nevím", "Nemůžu to udělat" (permanent — NOT temporal),
//   "Nemůžu ho teď udělat", "Teď ne", "Jindy", "14 później" (hasDigit guard),
//   "12 teď nemůžu" (negation+temporal wins even with digit)
//
// Section 2 — processInput E2E (mock classifier + real DB)
//   F1a: temporal refusal → HOLD + session_skipped_evidence
//   F1b: formatting error → re-ask, no suppression
//   F1b: permanent inability phrase → re-ask, NOT suppressed
//   F2:  same-session guidance request → HOLD (not BUDGET_EXHAUSTED)
//   Lifecycle: empty session_skipped_evidence → no stale suppression
//
// Run: node --env-file=.env.local scripts/test-temporal-refusal.mjs

import esmock from 'esmock';
import { createClient } from '@supabase/supabase-js';

// ── Classifier mock ────────────────────────────────────────────────────────────
// classifyIntent normally calls Haiku. The mock intercepts at the SDK boundary so
// processInput always classifies an input as ANSWER_TO_EVIDENCE_QUESTION with the
// evidence_type stored in the current session state.
//
// The mock reads lastPendingEvType (set by each test before calling processInput)
// so the payload.evidence_type matches whatever pending_question the test injected.
let lastPendingEvType = 'chair_stand_30s';  // default; overridden per test
let lastUserText      = '';                  // set in hook below

class MockAnthropic {
  constructor(_opts) {}
  get messages() {
    return {
      create: async () => ({
        content: [{
          type:  'tool_use',
          input: {
            event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
            payload:    { evidence_type: lastPendingEvType, value: lastUserText },
          },
        }],
      }),
    };
  }
}

// DOMAIN_REQUEST mock — used by F2 tests (guidance request after F1a).
class MockAnthropicDR {
  constructor(_opts) {}
  get messages() {
    return {
      create: async () => ({
        content: [{ type: 'tool_use', input: { event_type: 'DOMAIN_REQUEST', payload: {} } }],
      }),
    };
  }
}

const {
  processInput,
  EVIDENCE_REFUSAL_NEGATION_RE,
  EVIDENCE_REFUSAL_TEMPORAL_RE,
  EVIDENCE_REFUSAL_DEFERRAL_RE,
} = await esmock('../api/engine/orchestrator.js', {
  '@anthropic-ai/sdk': { default: MockAnthropic },
});

const { processInput: processInputDR } = await esmock('../api/engine/orchestrator.js', {
  '@anthropic-ai/sdk': { default: MockAnthropicDR },
});

// Wrapper: syncs mock state and calls processInput
async function runMocked(userId, userText, sessionState) {
  lastPendingEvType = sessionState.pending_question?.evidence_type ?? 'chair_stand_30s';
  lastUserText      = userText;
  return processInput(userId, userText, sessionState);
}

const sb        = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FAKE_USER = `test-tr-${Date.now()}`;

let passed = 0; let failed = 0;

// Base physical seed — mirrors STOP #4 PHYSICAL_GUIDED_NOW.
// vynest_nakup=false activates LOW_MUSCLE_STRENGTH; tug_test/grip_strength are
// NOT_AVAILABLE (resolved) so chair_stand_30s is the only remaining GUIDED_NOW_TESTS
// candidate. Without this profile the engine returns ACT_READY and F2 never fires.
const BASE_PHYSICAL = {
  vynest_nakup:  false,
  vstat_ze_zeme: true,
  recent_falls:  false,
  evidence_availability: {
    tug_test:      'NOT_AVAILABLE',
    grip_strength: 'NOT_AVAILABLE',
  },
};
async function resetPhysical() {
  await sb.from('user_health_profile').upsert(
    {
      user_id:     FAKE_USER,
      physical:    BASE_PHYSICAL,
      diagnoses:   [],
      symptoms:    [],
      medications: [],
    },
    { onConflict: 'user_id' }
  );
}

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(l) { console.log(`\n${'─'.repeat(64)}\n  ${l}\n${'─'.repeat(64)}`); }

// Helper: strip diacritics (mirrors Guard F1 inline logic)
function strip(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

// Helper: classify temporal refusal (mirrors Guard F1 predicate in orchestrator.js)
function isTemporalRefusal(raw) {
  const s = strip(raw);
  const hasDigit = /\d/.test(s);
  return (!hasDigit && EVIDENCE_REFUSAL_DEFERRAL_RE.test(s))
      || (EVIDENCE_REFUSAL_NEGATION_RE.test(s) && EVIDENCE_REFUSAL_TEMPORAL_RE.test(s));
}

// ── Section 1: Regex unit tests (no DB, no network) ──────────────────────────

sep('Temporal-refusal regex — should match (F1a path)');

check(isTemporalRefusal('Nemůžu ho teď udělat.'), '"Nemůžu ho teď udělat." → temporal');
check(isTemporalRefusal('Teď to neudělám.'),       '"Teď to neudělám." → temporal');
check(isTemporalRefusal('Nemůžu teď.'),            '"Nemůžu teď." → temporal');
check(isTemporalRefusal('Teď ne.'),                '"Teď ne." → temporal (compound negation)');
check(isTemporalRefusal('Jindy'),                  '"Jindy" → temporal (pure deferral)');
check(isTemporalRefusal('Udělám to později.'),     '"Udělám to později." → temporal (pure deferral)');
check(isTemporalRefusal('Příště.'),                '"Příště." → temporal (pure deferral)');
check(isTemporalRefusal('Dnes ne.'),               '"Dnes ne." → temporal (compound)');
check(isTemporalRefusal('Momentálně to nejde.'),   '"Momentálně to nejde." → temporal');
check(isTemporalRefusal('Zatím nemohu.'),          '"Zatím nemohu." → temporal');

sep('Temporal-refusal regex — must NOT match (F1b or valid path)');

check(!isTemporalRefusal('14'),                 '"14" → NOT temporal (valid answer)');
check(!isTemporalRefusal('abc'),                '"abc" → NOT temporal → F1b re-ask');
check(!isTemporalRefusal('14 kg'),              '"14 kg" → NOT temporal → F1b re-ask');
check(!isTemporalRefusal('14 później'),         '"14 później" → NOT temporal (hasDigit blocks pure deferral)');
check(!isTemporalRefusal('Nemůžu to udělat.'), '"Nemůžu to udělat." → NOT temporal (no temporal marker) → F1b');
check(!isTemporalRefusal('Nedokážu to.'),       '"Nedokážu to." → NOT temporal (no temporal marker) → F1b');
check(!isTemporalRefusal('Nejde to.'),          '"Nejde to." → NOT temporal (no temporal marker) → F1b');
check(!isTemporalRefusal('Nevím.'),             '"Nevím." → NOT temporal (classifyAvailability handles upstream)');

sep('Edge: negation+temporal wins even when input contains a digit');
check(isTemporalRefusal('12 teď nemohu'),     '"12 teď nemohu" → temporal (negation+temporal overrides hasDigit)');
check(isTemporalRefusal('10 pozdeji nemohu'), '"10 pozdeji nemohu" → temporal (nemohu+pozdeji)');

// ── Section 2: processInput E2E (mock classifier, real DB) ───────────────────

// Seed: LOW_MUSCLE_STRENGTH activated (vynest_nakup=false); tug/grip NOT_AVAILABLE;
// chair_stand_30s unresolved → the only remaining GUIDED_NOW_TESTS candidate.
// Same profile as STOP #4 PHYSICAL_GUIDED_NOW — proven to make chair_stand_30s
// the engine's NBE so F2 suppression has something to intercept.
await sb.from('user_profiles').upsert(
  { user_id: FAKE_USER, birth_year: 1959, gender: 'female' },
  { onConflict: 'user_id' }
);
await sb.from('user_health_profile').upsert(
  {
    user_id:     FAKE_USER,
    physical:    BASE_PHYSICAL,
    diagnoses:   [],
    symptoms:    [],
    medications: [],
  },
  { onConflict: 'user_id' }
);

const CHAIR_PENDING = {
  text:          'Pokud je to pro tebe bezpečné, kolikrát vstaneš ze židle za 30 sekund bez opory rukou? Napiš číslo.',
  evidence_type: 'chair_stand_30s',
  type:          'GENERAL',
};
const SESSION_WITH_CHAIR = {
  pending_question:         CHAIR_PENDING,
  question_budget_remaining: 2,
  session_skipped_evidence: [],
  skipped_bootstrap_types:  [],
};

// ── F1a ───────────────────────────────────────────────────────────────────────

sep('F1a — "Nemůžu ho teď udělat." → HOLD + session_skipped_evidence');
{
  const r = await runMocked(FAKE_USER, 'Nemůžu ho teď udělat.', SESSION_WITH_CHAIR);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  console.log(`  text (60c)     : ${r.text?.slice(0, 60)}`);
  console.log(`  session_skipped: ${JSON.stringify(r.session_updates?.session_skipped_evidence)}`);
  console.log(`  pending_q      : ${JSON.stringify(r.session_updates?.pending_question)}`);
  console.log(`  budget         : ${r.session_updates?.question_budget_remaining}`);

  check(r.mode === 'HOLD',                                     'mode = HOLD');
  check(r.debug?.reason_code === 'EVIDENCE_TEMPORAL_REFUSAL',  'reason_code = EVIDENCE_TEMPORAL_REFUSAL');
  check(r.text?.includes('necháme to na později'),             'text contains approved copy');
  check(r.session_updates?.session_skipped_evidence?.includes('chair_stand_30s'),
    'session_skipped_evidence contains chair_stand_30s');
  check(r.session_updates?.pending_question === null,          'pending_question cleared');
  check(r.session_updates?.question_budget_remaining === 2,    'budget unchanged (2 → 2)');
}

sep('F1a — "Teď ne." → HOLD + suppress');
{
  const r = await runMocked(FAKE_USER, 'Teď ne.', SESSION_WITH_CHAIR);
  check(r.mode === 'HOLD',                                    '"Teď ne." → HOLD');
  check(r.debug?.reason_code === 'EVIDENCE_TEMPORAL_REFUSAL', 'reason_code = EVIDENCE_TEMPORAL_REFUSAL');
  check(r.session_updates?.session_skipped_evidence?.includes('chair_stand_30s'),
    'chair_stand_30s suppressed');
}

sep('F1a — "Jindy." → HOLD + suppress');
{
  const r = await runMocked(FAKE_USER, 'Jindy.', SESSION_WITH_CHAIR);
  check(r.mode === 'HOLD',                                    '"Jindy." → HOLD');
  check(r.debug?.reason_code === 'EVIDENCE_TEMPORAL_REFUSAL', 'reason_code = EVIDENCE_TEMPORAL_REFUSAL');
  check(r.session_updates?.session_skipped_evidence?.includes('chair_stand_30s'),
    'chair_stand_30s suppressed');
}

// ── F1b ───────────────────────────────────────────────────────────────────────

sep('F1b — "abc" → re-ask, no suppression, budget unchanged');
{
  const r = await runMocked(FAKE_USER, 'abc', SESSION_WITH_CHAIR);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  console.log(`  pending_q type : ${r.session_updates?.pending_question?.evidence_type}`);
  console.log(`  session_skipped: ${JSON.stringify(r.session_updates?.session_skipped_evidence)}`);

  check(r.mode === 'ASK',                                      '"abc" → ASK (re-ask)');
  check(r.debug?.reason_code === 'EVIDENCE_INVALID_REASK',     'reason_code = EVIDENCE_INVALID_REASK');
  check(r.session_updates?.pending_question?.evidence_type === 'chair_stand_30s',
    'pending_question preserved with chair_stand_30s');
  check(!(r.session_updates?.session_skipped_evidence ?? []).includes('chair_stand_30s'),
    'chair_stand_30s NOT in session_skipped_evidence');
  check(r.session_updates?.question_budget_remaining === 2,    'budget unchanged (2 → 2)');
}

sep('F1b — "14 kg" → re-ask, no suppression');
{
  const r = await runMocked(FAKE_USER, '14 kg', SESSION_WITH_CHAIR);
  check(r.mode === 'ASK',                                   '"14 kg" → ASK (re-ask)');
  check(r.debug?.reason_code === 'EVIDENCE_INVALID_REASK',  'reason_code = EVIDENCE_INVALID_REASK');
  check(r.session_updates?.pending_question?.evidence_type === 'chair_stand_30s',
    'pending_question preserved');
}

sep('F1b — "14 później" → re-ask (hasDigit blocks pure-deferral path)');
{
  const r = await runMocked(FAKE_USER, '14 później', SESSION_WITH_CHAIR);
  check(r.mode === 'ASK',                                   '"14 później" → ASK (hasDigit guard)');
  check(r.debug?.reason_code === 'EVIDENCE_INVALID_REASK',  'reason_code = EVIDENCE_INVALID_REASK');
}

sep('F1b — "Nemůžu to udělat." → re-ask (permanent inability, no temporal marker — NOT suppressed)');
{
  const r = await runMocked(FAKE_USER, 'Nemůžu to udělat.', SESSION_WITH_CHAIR);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  console.log(`  session_skipped: ${JSON.stringify(r.session_updates?.session_skipped_evidence)}`);

  check(r.mode === 'ASK',
    '"Nemůžu to udělat." → ASK (re-ask, NOT suppressed)');
  check(r.debug?.reason_code === 'EVIDENCE_INVALID_REASK',
    'reason_code = EVIDENCE_INVALID_REASK (not EVIDENCE_TEMPORAL_REFUSAL)');
  check(!(r.session_updates?.session_skipped_evidence ?? []).includes('chair_stand_30s'),
    'chair_stand_30s NOT suppressed — permanent inability ≠ temporal refusal');
}

// ── Valid input (Guard F1 must NOT fire) ──────────────────────────────────────

sep('"14" → valid answer persisted, Guard F1 does not fire');
{
  const r = await runMocked(FAKE_USER, '14', SESSION_WITH_CHAIR);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  check(r.debug?.reason_code !== 'EVIDENCE_TEMPORAL_REFUSAL'
     && r.debug?.reason_code !== 'EVIDENCE_INVALID_REASK',
    '"14" → Guard F1 does not fire (valid value persisted)');
  // Reset: "14" persisted chair_stand_30s=14; without reset later tests see a MEASURED
  // LOW_MUSCLE_STRENGTH which drops chair_stand_30s decision_impact to 'low' → engine
  // skips the evidence question → ACT_READY instead of ASK (breaks F2 test).
  await resetPhysical();
}

// ── "Nevím." — NOT_AVAILABLE path (classifyAvailability short-circuits before parse) ──

sep('"Nevím." → NOT_AVAILABLE path (Guard F1 does not fire)');
{
  // Mock returns ANSWER_TO_EVIDENCE_QUESTION so the test exercises the adapter path,
  // but classifyAvailability catches "nevím" → NOT_AVAILABLE before parse is called.
  const r = await runMocked(FAKE_USER, 'Nevím.', SESSION_WITH_CHAIR);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  check(r.debug?.reason_code !== 'EVIDENCE_TEMPORAL_REFUSAL'
     && r.debug?.reason_code !== 'EVIDENCE_INVALID_REASK',
    '"Nevím." → classifyAvailability path (Guard F1 never fires)');
  // Reset: "Nevím." wrote evidence_availability.chair_stand_30s=NOT_AVAILABLE which
  // removes chair_stand_30s from NBE candidates → same ACT_READY issue for F2 tests.
  await resetPhysical();
}

// ── F2: same-session guidance request ─────────────────────────────────────────
// processInputDR uses the module-level MockAnthropicDR (DOMAIN_REQUEST).
// Profile: BASE_PHYSICAL (vynest_nakup=false, tug/grip NOT_AVAILABLE, chair unresolved) —
// already active in DB. chair_stand_30s is the only GUIDED_NOW_TESTS candidate.
// last_daily_decision: ASK_BLOCKING is required for the budget gate to enter the
// GUIDED_NOW_SUBSTITUTION path (mirrors STOP #4 T1 session state that was proven to work).

sep('F2 Turn B — budget=0: "Co mám dělat?" after temporal refusal → HOLD (not BUDGET_EXHAUSTED)');
{
  // Simulates state after F1a: chair_stand_30s deferred, pending_question cleared, budget=0.
  const sessionAfterF1a = {
    pending_question:          null,
    question_budget_remaining: 0,
    session_skipped_evidence:  ['chair_stand_30s'],
    skipped_bootstrap_types:   [],
    last_daily_decision:       { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
    last_domain_response:      null,
  };

  const r = await processInputDR(FAKE_USER, 'Co mám dělat?', sessionAfterF1a);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  console.log(`  text (80c)     : ${r.text?.slice(0, 80)}`);

  check(r.mode === 'HOLD',
    'Turn B — "Co mám dělat?" after temporal refusal → HOLD');
  check(r.debug?.reason_code === 'EVIDENCE_SKIPPED_SUPPRESSION',
    'reason_code = EVIDENCE_SKIPPED_SUPPRESSION (not BUDGET_EXHAUSTED, not ACT_READY)');
  check(r.text?.includes('Odložený test'),
    'text acknowledges deferred test');
  check(Array.isArray(r.session_updates?.session_skipped_evidence)
     && r.session_updates.session_skipped_evidence.includes('chair_stand_30s'),
    'session_skipped_evidence preserved in session_updates');
}

sep('F2 Turn B — budget=2: chair_stand_30s is not re-asked when skipped');
{
  // At budget=2, chair_stand_30s is surfaced only via GUIDED_NOW_SUBSTITUTION (budget=0).
  // Normal NBE selection at budget>0 does not select chair_stand_30s, so post-buildPresentation
  // F2 does not fire. The correct outcome is still that chair_stand_30s is never asked —
  // confirmed by checking pending_question.evidence_type ≠ chair_stand_30s.
  const sessionAfterF1a_budget2 = {
    pending_question:          null,
    question_budget_remaining: 2,
    session_skipped_evidence:  ['chair_stand_30s'],
    skipped_bootstrap_types:   [],
    last_daily_decision:       { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
    last_domain_response:      null,
  };

  const r = await processInputDR(FAKE_USER, 'Co mám dělat?', sessionAfterF1a_budget2);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  const pendingType = r.session_updates?.pending_question?.evidence_type;
  check(pendingType !== 'chair_stand_30s',
    'Turn B budget=2 — chair_stand_30s NOT re-asked when in session_skipped_evidence');
}

sep('F2 Turn C — after Launcher reload (session_skipped_evidence=[]) → chair_stand eligible again');
{
  // Launcher start() calls saveSession({ session_skipped_evidence: [] }) on every page load.
  // That reset is client-side (launcher.html) and cannot be tested server-side without
  // adding production code. This test proves server behavior with empty session_skipped_evidence:
  // the engine must select chair_stand_30s again via GUIDED_NOW_SUBSTITUTION.
  const sessionAfterReset = {
    pending_question:          null,
    question_budget_remaining: 0,
    session_skipped_evidence:  [],   // simulates Launcher start() reset
    skipped_bootstrap_types:   [],
    last_daily_decision:       { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
    last_domain_response:      null,
  };

  const r = await processInputDR(FAKE_USER, 'Co mám dělat?', sessionAfterReset);
  console.log(`  mode           : ${r.mode}`);
  console.log(`  reason_code    : ${r.debug?.reason_code}`);
  console.log(`  pending_ev     : ${r.session_updates?.pending_question?.evidence_type}`);

  check(r.debug?.reason_code !== 'EVIDENCE_SKIPPED_SUPPRESSION',
    'Turn C — chair_stand_30s NOT suppressed when session_skipped_evidence is empty');
  check(r.session_updates?.pending_question?.evidence_type === 'chair_stand_30s',
    'Turn C — chair_stand_30s eligible again: engine selects it via GUIDED_NOW_SUBSTITUTION');
}

// ── Lifecycle: page reload resets session_skipped_evidence ────────────────────

sep('Lifecycle — fresh session (empty session_skipped_evidence): F1b fires, no suppression');
{
  // After page reload, Launcher calls saveSession({ session_skipped_evidence: [] }).
  // Proves there is no stale suppression from a previous conversation.
  const freshSession = {
    pending_question:         CHAIR_PENDING,
    question_budget_remaining: 2,
    session_skipped_evidence: [],   // reset by Launcher start()
    skipped_bootstrap_types:  [],
  };
  const r = await runMocked(FAKE_USER, 'abc', freshSession);
  check(r.mode === 'ASK',
    'After page reload (empty session_skipped_evidence): "abc" → re-ask (not suppressed by F2)');
  check(r.debug?.reason_code === 'EVIDENCE_INVALID_REASK',
    'F1b fires correctly — no stale suppression from previous session');
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

await sb.from('user_health_profile').delete().eq('user_id', FAKE_USER);
await sb.from('user_profiles').delete().eq('user_id', FAKE_USER);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(64)}\n`);
if (failed > 0) process.exit(1);
