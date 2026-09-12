// test-sedentary-scalar-guard.mjs — Guard D.6 regression: sedentary_hours_day scalar routing
//
// STOP #6 root cause: "8 hodin" triggered Haiku Rule 6 (number + unit → NEW_MEASUREMENT).
// routeMeasurement for table='physical' returned "not a time-series target" warning and wrote
// nothing. physical.sedentary_hours_day stayed null → engine re-asked same question.
//
// Guard D.6 (pre-Haiku) intercepts before Haiku for:
//   pending_question.type === 'GENERAL' AND evidence_type === 'sedentary_hours_day'
// Normalizes scalar input to number before persistence.
//
// Section 1 — Guard D.6 regex unit tests (no DB, no network)
//   Accepted: "8", "8 hodin", "8 h", "8 hod", "8,5 hodin", "7.5", "0 hodin", "0"
//   Rejected: "hodně", "většinu dne", "moc", "8 kg", "8 hodin ale bolí mě záda", "-5"
//
// Section 2 — processInput E2E (Guard D.6 fires → Haiku NOT called → physical persisted)
//   "8 hodin" → ANSWER_TO_EVIDENCE_QUESTION, value=8, physical.sedentary_hours_day=8
//   "0 hodin" → ANSWER_TO_EVIDENCE_QUESTION, value=0, persisted
//   "hodně"   → guard does NOT fire → Haiku called (mock: DOMAIN_REQUEST)
//   "většinu dne" → guard does NOT fire → Haiku called
//
// Section 3 — E2E routing contract: "8 hodin" → not repeated on next turn
//
// Run: node --env-file=.env.local scripts/test-sedentary-scalar-guard.mjs

import esmock from 'esmock';
import { createClient } from '@supabase/supabase-js';

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(66)}\n  ${label}\n${'─'.repeat(66)}`); }

// ── Guard D.6 regex (mirrors orchestrator.js implementation exactly) ──────────
// /^\s*(\d+(?:[.,]\d+)?)\s*(?:hodin[ay]?|hod|h)?\s*$/i
const D6_RE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:hodin[ay]?|hod|h)?\s*$/i;

function d6parse(text) {
  const m = D6_RE.exec(text.trim());
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  if (isNaN(v) || v < 0 || v > 24) return null;
  return v;
}

// ── AI mock: returns DOMAIN_REQUEST by default ────────────────────────────────
let mockCalled = false;
class MockAnthropicDR {
  constructor(_opts) {}
  get messages() {
    return {
      create: async () => {
        mockCalled = true;
        return {
          content: [{ type: 'tool_use', input: { event_type: 'DOMAIN_REQUEST', payload: {} } }],
        };
      },
    };
  }
}

const { processInput } = await esmock('../api/engine/orchestrator.js', {
  '@anthropic-ai/sdk': { default: MockAnthropicDR },
});

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TESTER_UID = process.env.TEST_UID ?? null;

// ── Section 1: Guard D.6 regex unit tests ────────────────────────────────────

sep('S1 — accepted: bare integers');
{
  check(d6parse('8')  === 8,   '"8"   → value = 8');
  check(d6parse('10') === 10,  '"10"  → value = 10');
  check(d6parse('6')  === 6,   '"6"   → value = 6');
  check(d6parse('0')  === 0,   '"0"   → value = 0 (zero not excluded)');
}

sep('S1 — accepted: with hodin/h/hod unit');
{
  check(d6parse('8 hodin')  === 8,   '"8 hodin"  → value = 8');
  check(d6parse('8 h')      === 8,   '"8 h"      → value = 8');
  check(d6parse('8 hod')    === 8,   '"8 hod"    → value = 8');
  check(d6parse('8 hodiny') === 8,   '"8 hodiny" → value = 8');
  check(d6parse('0 hodin')  === 0,   '"0 hodin"  → value = 0 (zero not excluded)');
  check(d6parse('24 hodin') === 24,  '"24 hodin" → value = 24 (upper bound)');
}

sep('S1 — accepted: decimals with comma/period');
{
  check(d6parse('8,5 hodin') === 8.5, '"8,5 hodin" → value = 8.5');
  check(d6parse('7.5')       === 7.5, '"7.5"       → value = 7.5');
  check(d6parse('7,5')       === 7.5, '"7,5"       → value = 7.5');
  check(d6parse('8.5 h')     === 8.5, '"8.5 h"     → value = 8.5');
}

sep('S1 — rejected: vague qualitative answers');
{
  check(d6parse('hodně')       === null, '"hodně"       → null (no digit)');
  check(d6parse('většinu dne') === null, '"většinu dne" → null (no digit)');
  check(d6parse('moc')         === null, '"moc"         → null (no digit)');
  check(d6parse('skoro pořád') === null, '"skoro pořád" → null (no digit)');
  check(d6parse('celý den')    === null, '"celý den"    → null (no digit)');
}

sep('S1 — rejected: wrong unit or extra text');
{
  check(d6parse('8 kg')                    === null, '"8 kg"                    → null (wrong unit)');
  check(d6parse('8 hodin ale bolí mě záda') === null, '"8 hodin ale bolí mě záda" → null (extra text)');
  check(d6parse('cca 8 hodin')             === null, '"cca 8 hodin"             → null (non-digit prefix)');
}

sep('S1 — rejected: out of range');
{
  check(d6parse('25')       === null, '"25" → null (> 24 hours)');
  check(d6parse('25 hodin') === null, '"25 hodin" → null (> 24 hours)');
  // Negative numbers: regex requires digit at start, so "-5" won't match \d+
  check(d6parse('-5') === null, '"-5" → null (negative, no leading digit)');
}

sep('S1 — edge cases');
{
  check(d6parse('')   === null, '"" (empty) → null');
  check(d6parse('  8  ') === 8, '"  8  " (padded) → value = 8');
  check(d6parse('8H')  === 8, '"8H" (uppercase) → value = 8 (case-insensitive)');
}

// ── Section 2: processInput E2E ───────────────────────────────────────────────

function makeSedentaryState() {
  return {
    pending_question: {
      text: 'Přibližně kolik hodin za běžný den prosedíš?',
      evidence_type: 'sedentary_hours_day',
      type: 'GENERAL',
    },
    question_budget_remaining: 2,
    last_daily_decision: null,
    pending_clarifications: [],
    fatigue_context: null,
    person_birth_year: 1960,
    person_sex: 'male',
    resolved_physical: [],
    hp_physical: {},
  };
}

if (!TESTER_UID) {
  sep('S2/S3 — processInput E2E SKIPPED (no TEST_UID env var)');
  console.log('  ⚠️  Set TEST_UID=<disposable-tester-uid> to run E2E tests');
} else {
  sep('S2a — "8 hodin" → Guard D.6 fires → Haiku NOT called → physical.sedentary_hours_day = 8');
  {
    mockCalled = false;
    const state = makeSedentaryState();
    try {
      const res = await processInput(TESTER_UID, '8 hodin', state);
      check(!mockCalled, 'Guard D.6 intercepted → Haiku NOT called');
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.sedentary_hours_day;
      check(val === 8, `physical.sedentary_hours_day = 8 (number, not string) (got: ${JSON.stringify(val)})`);
    } catch (e) {
      check(false, `S2a threw: ${e.message}`);
    }
  }

  sep('S2b — "8" (bare integer) → Guard D.6 fires → persisted as 8');
  {
    mockCalled = false;
    const state = makeSedentaryState();
    try {
      const res = await processInput(TESTER_UID, '8', state);
      check(!mockCalled, 'Guard D.6 intercepted → Haiku NOT called');
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.sedentary_hours_day;
      check(val === 8, `"8" → physical.sedentary_hours_day = 8 (got: ${JSON.stringify(val)})`);
    } catch (e) {
      check(false, `S2b threw: ${e.message}`);
    }
  }

  sep('S2c — "8,5 hodin" → Guard D.6 fires → persisted as 8.5');
  {
    mockCalled = false;
    const state = makeSedentaryState();
    try {
      const res = await processInput(TESTER_UID, '8,5 hodin', state);
      check(!mockCalled, 'Guard D.6 intercepted → Haiku NOT called');
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.sedentary_hours_day;
      check(val === 8.5, `"8,5 hodin" → physical.sedentary_hours_day = 8.5 (got: ${JSON.stringify(val)})`);
    } catch (e) {
      check(false, `S2c threw: ${e.message}`);
    }
  }

  sep('S2d — "0 hodin" → Guard D.6 fires → persisted as 0 (zero not excluded)');
  {
    mockCalled = false;
    const state = makeSedentaryState();
    try {
      const res = await processInput(TESTER_UID, '0 hodin', state);
      check(!mockCalled, 'Guard D.6 intercepted → Haiku NOT called');
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.sedentary_hours_day;
      check(val === 0, `"0 hodin" → physical.sedentary_hours_day = 0 (got: ${JSON.stringify(val)})`);
    } catch (e) {
      check(false, `S2d threw: ${e.message}`);
    }
  }

  sep('S2e — "hodně" → Guard D.6 does NOT fire → Haiku called');
  {
    mockCalled = false;
    const state = makeSedentaryState();
    try {
      const res = await processInput(TESTER_UID, 'hodně', state);
      check(mockCalled, '"hodně" → Guard D.6 did NOT fire → Haiku called (vague, not intercepted)');
    } catch (e) {
      check(false, `S2e threw: ${e.message}`);
    }
  }

  sep('S2f — "většinu dne" → Guard D.6 does NOT fire → Haiku called');
  {
    mockCalled = false;
    const state = makeSedentaryState();
    try {
      const res = await processInput(TESTER_UID, 'většinu dne', state);
      check(mockCalled, '"většinu dne" → Guard D.6 did NOT fire → Haiku called');
    } catch (e) {
      check(false, `S2f threw: ${e.message}`);
    }
  }

  sep('S2g — "7.5" → Guard D.6 fires → persisted as 7.5');
  {
    mockCalled = false;
    const state = makeSedentaryState();
    try {
      const res = await processInput(TESTER_UID, '7.5', state);
      check(!mockCalled, 'Guard D.6 intercepted → Haiku NOT called');
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.sedentary_hours_day;
      check(val === 7.5, `"7.5" → physical.sedentary_hours_day = 7.5 (got: ${JSON.stringify(val)})`);
    } catch (e) {
      check(false, `S2g threw: ${e.message}`);
    }
  }

  // ── Section 3: E2E routing contract — same question must NOT repeat ──────────
  // Turn 1: send "8 hodin" → persisted
  // Turn 2: send any follow-up → sedentary question must NOT appear in response
  sep('S3 — routing contract: after "8 hodin", sedentary question does NOT repeat');
  {
    mockCalled = false;

    // Turn 1: answer the sedentary question
    const state1 = makeSedentaryState();
    let session_updates = {};
    try {
      const res1 = await processInput(TESTER_UID, '8 hodin', state1);
      check(!mockCalled, 'Turn 1: Guard D.6 intercepted → Haiku NOT called');
      check(res1.mode !== undefined, `Turn 1: got a mode response (got: ${res1.mode})`);
      session_updates = res1.session_updates ?? {};

      // Turn 2: follow-up with no pending sedentary question
      mockCalled = false;
      const state2 = {
        ...state1,
        ...session_updates,
        pending_question: session_updates.pending_question ?? null,
      };
      const res2 = await processInput(TESTER_UID, 'Co teď?', state2);
      const isSedentaryRepeat = res2.text?.includes('kolik hodin za běžný den prosedíš');
      check(!isSedentaryRepeat,
        `Turn 2: sedentary question NOT repeated (text: "${res2.text?.slice(0, 60) ?? 'null'}")`);
    } catch (e) {
      check(false, `S3 threw: ${e.message}`);
    }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(66)}`);
console.log(`  Guard D.6 sedentary scalar: ${passed} PASS, ${failed} FAIL`);
if (!TESTER_UID) console.log('  ⚠️  E2E sections skipped — set TEST_UID for full coverage');
console.log(`${'═'.repeat(66)}\n`);
if (failed > 0) process.exit(1);
