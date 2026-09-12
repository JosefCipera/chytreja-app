// test-compound-inability-guard.mjs — Guard B.1 regression: compound inability → ACTION_SKIPPED
//
// STOP #7 root cause: "Co mám dělat, když to teď nemůžu udělat?" fell through Guard B
// (ACTION_SKIP_RE anchored) and Guard E (DOMAIN_REQUEST_NAV_RE anchored), hit Haiku,
// was classified as DOMAIN_REQUEST → action assignment not cleared → same action repeated.
//
// Guard B.1 intercepts BEFORE Haiku when:
//   current_action_assignment valid (action_id + intervention_id)
//   AND B1_INABILITY_RE matches (nemůžu + ≤3 tokens + udělat/dělat)
//   AND COMPOUND_SIGNAL_RE does NOT match (ale/protože/jenže/avšak/přičemž)
//   AND B1_REASON_RE does NOT match (kvůli/bolí)
//
// Contract:
//   Type A (pure inability)  → ACTION_SKIPPED (deterministic, no Haiku)
//   Type B (inability+reason) → falls through to Haiku
//
// Section 1 — regex unit tests (no DB, no network)
//   Positive: type A inputs match B1_INABILITY_RE and pass both reject guards
//   Negative: type B inputs blocked by COMPOUND_SIGNAL_RE or B1_REASON_RE
//   No-assignment: Guard B.1 condition fails → B1_INABILITY_RE irrelevant
//   Backward-compat: "Přeskočit" / "Nemůžu" still caught by Guard B (ACTION_SKIP_RE)
//
// Section 2 — processInput E2E (requires TEST_UID)
//   Live case: assignment active + "Co mám dělat, když to teď nemůžu udělat?"
//              → ACTION_SKIPPED, Haiku NOT called, assignment SKIPPED, next turn clean
//
// Run: node --env-file=.env.local scripts/test-compound-inability-guard.mjs

import esmock from 'esmock';
import { createClient } from '@supabase/supabase-js';

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// ── Mirror production regex constants (must stay in sync with orchestrator.js) ──
const ACTION_SKIP_RE    = /^(p[rř]esko[cč][ií][mt]?|vynech[aá][mt]|dnes\s+ne|nem[uůo]žu)[\s.,!?]*$/i;
const COMPOUND_SIGNAL_RE = /\bale\b|\bprotože\b|\bjenže\b|\bavšak\b|\bpřičemž\b/i;
const B1_INABILITY_RE   = /nem[uůo]žu(?:\s+\S+){0,3}\s+(?:ud[eě]lat|d[eě]lat)/i;
const B1_REASON_RE      = /\bkvůli\b|\bbolí/i;

function wouldB1Fire(text) {
  const t = text.trim();
  return B1_INABILITY_RE.test(t)
      && !COMPOUND_SIGNAL_RE.test(t)
      && !B1_REASON_RE.test(t);
}

// ── Section 1a: Type A — Guard B.1 MUST fire ────────────────────────────────
sep('S1a — Type A: pure inability → Guard B.1 fires (ACTION_SKIPPED)');
{
  check(wouldB1Fire('Nemůžu to teď udělat.'),
    '"Nemůžu to teď udělat." → B.1 fires');
  check(wouldB1Fire('Co mám dělat, když to teď nemůžu udělat?'),
    '"Co mám dělat, když to teď nemůžu udělat?" → B.1 fires (STOP #7 live case)');
  check(wouldB1Fire('Teď to nemůžu udělat.'),
    '"Teď to nemůžu udělat." → B.1 fires');
  check(wouldB1Fire('To teď nemůžu dělat.'),
    '"To teď nemůžu dělat." → B.1 fires (dělat variant)');
  check(wouldB1Fire('Nemůžu to vůbec udělat.'),
    '"Nemůžu to vůbec udělat." → B.1 fires');
  check(wouldB1Fire('Nemůžu to teď vůbec udělat.'),
    '"Nemůžu to teď vůbec udělat." → B.1 fires (3 tokens between)');
  check(wouldB1Fire('Nemůžu udělat.'),
    '"Nemůžu udělat." → B.1 fires (0 tokens between)');
}

// ── Section 1b: Type B — Guard B.1 must NOT fire (falls through to Haiku) ──
sep('S1b — Type B: inability+reason → Guard B.1 blocked, falls through');
{
  check(!wouldB1Fire('Nemůžu to udělat, protože mě bolí rameno.'),
    '"...protože mě bolí rameno." → blocked by COMPOUND_SIGNAL_RE (protože)');
  check(!wouldB1Fire('Teď to nemůžu udělat, bolí mě záda.'),
    '"...bolí mě záda." → blocked by B1_REASON_RE (bolí)');
  check(!wouldB1Fire('Nemůžu to dělat kvůli kolenu.'),
    '"...kvůli kolenu." → blocked by B1_REASON_RE (kvůli)');
  check(!wouldB1Fire('Nemůžu to udělat, ale zkusím to zítra.'),
    '"...ale zkusím to zítra." → blocked by COMPOUND_SIGNAL_RE (ale)');
  check(!wouldB1Fire('Nemůžu to dělat kvůli bolavému ramenu.'),
    '"...kvůli bolavému ramenu." → blocked by B1_REASON_RE (kvůli)');
  check(!wouldB1Fire('Bolí mě záda, nemůžu to udělat.'),
    '"Bolí mě záda, nemůžu..." → blocked by B1_REASON_RE (bolí)');
}

// ── Section 1c: no-assignment guard — B1 condition requires valid assignment ─
// (regex tests only; the assignment check is in orchestrator, not testable here
//  without processInput — verified structurally: Guard B.1 code requires
//  state.current_action_assignment?.action_id AND ?.intervention_id)
sep('S1c — Guard B.1 regex scope: B1_INABILITY_RE does NOT match unrelated inputs');
{
  check(!B1_INABILITY_RE.test('Co teď?'),
    '"Co teď?" → B1_INABILITY_RE no match (Guard B.1 cannot fire on this input)');
  check(!B1_INABILITY_RE.test('Hotovo.'),
    '"Hotovo." → B1_INABILITY_RE no match');
  check(!B1_INABILITY_RE.test('Jak to funguje?'),
    '"Jak to funguje?" → B1_INABILITY_RE no match');
  check(!B1_INABILITY_RE.test('8 hodin'),
    '"8 hodin" → B1_INABILITY_RE no match (Guard D.6 input)');
}

// ── Section 1d: backward-compat — Guard B (ACTION_SKIP_RE) still covers short phrases ─
sep('S1d — Backward-compat: short bare phrases caught by Guard B (ACTION_SKIP_RE)');
{
  check(ACTION_SKIP_RE.test('Přeskočit'),
    '"Přeskočit" → ACTION_SKIP_RE ✓ (Guard B, not B.1)');
  check(ACTION_SKIP_RE.test('Nemůžu'),
    '"Nemůžu" → ACTION_SKIP_RE ✓ (Guard B fires before B.1)');
  check(ACTION_SKIP_RE.test('Dnes ne'),
    '"Dnes ne" → ACTION_SKIP_RE ✓');
  check(ACTION_SKIP_RE.test('přeskočím'),
    '"přeskočím" → ACTION_SKIP_RE ✓');
  // these are caught by Guard B — Guard B.1 never reached for them
  check(!ACTION_SKIP_RE.test('Nemůžu to teď udělat.'),
    '"Nemůžu to teď udělat." → ACTION_SKIP_RE ✗ (compound — Guard B misses, B.1 catches)');
  check(!ACTION_SKIP_RE.test('Co mám dělat, když to teď nemůžu udělat?'),
    '"Co mám dělat, když..." → ACTION_SKIP_RE ✗ (compound — Guard B misses, B.1 catches)');
}

// ── Section 2: processInput E2E ──────────────────────────────────────────────
let mockCalled = false;
class MockAnthropicSkip {
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
  '@anthropic-ai/sdk': { default: MockAnthropicSkip },
});

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const TESTER_UID = process.env.TEST_UID ?? null;

function makeActionState(actionId = 'overhead_press_light', interventionId = 'INT_STRENGTH_001') {
  return {
    current_action_assignment: { action_id: actionId, intervention_id: interventionId },
    pending_question: null,
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
  sep('S2 — processInput E2E SKIPPED (no TEST_UID env var)');
  console.log('  ⚠️  Set TEST_UID=<disposable-tester-uid> to run E2E tests');
} else {
  // ── S2a: STOP #7 live case ─────────────────────────────────────────────────
  sep('S2a — STOP #7 live case: "Co mám dělat, když to teď nemůžu udělat?" → ACTION_SKIPPED');
  {
    mockCalled = false;
    const state = makeActionState();
    try {
      const res = await processInput(TESTER_UID, 'Co mám dělat, když to teď nemůžu udělat?', state);
      check(!mockCalled, 'Guard B.1 intercepted → Haiku NOT called');
      // assignment should be marked SKIPPED in DB
      const { data } = await sb.from('action_assignments')
        .select('status')
        .eq('user_id', TESTER_UID)
        .eq('action_id', 'overhead_press_light')
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      check(data?.status === 'SKIPPED',
        `assignment status = SKIPPED in DB (got: ${JSON.stringify(data?.status)})`);
    } catch (e) {
      check(false, `S2a threw: ${e.message}`);
    }
  }

  // ── S2b: next engine turn must not return same assignment ──────────────────
  sep('S2b — after SKIP, next turn must not re-surface same action as active');
  {
    mockCalled = false;
    const state = makeActionState();
    try {
      const res1 = await processInput(TESTER_UID, 'Co mám dělat, když to teď nemůžu udělat?', state);
      const sessionUpdates = res1.session_updates ?? {};
      // next turn with cleared assignment
      const state2 = { ...state, ...sessionUpdates, current_action_assignment: sessionUpdates.current_action_assignment ?? null };
      const res2 = await processInput(TESTER_UID, 'Co teď?', state2);
      const stillSameAction = res2.session_updates?.current_action_assignment?.action_id === 'overhead_press_light';
      check(!stillSameAction,
        `Next turn: same action NOT re-assigned as active (got: ${res2.session_updates?.current_action_assignment?.action_id ?? 'null'})`);
    } catch (e) {
      check(false, `S2b threw: ${e.message}`);
    }
  }

  // ── S2c: Type A "Nemůžu to teď udělat." also fires Guard B.1 ─────────────
  sep('S2c — "Nemůžu to teď udělat." → Guard B.1 fires → Haiku NOT called');
  {
    mockCalled = false;
    const state = makeActionState();
    try {
      await processInput(TESTER_UID, 'Nemůžu to teď udělat.', state);
      check(!mockCalled, '"Nemůžu to teď udělat." → Guard B.1 intercepted → Haiku NOT called');
    } catch (e) {
      check(false, `S2c threw: ${e.message}`);
    }
  }

  // ── S2d: Type B "bolí" falls through to Haiku ─────────────────────────────
  sep('S2d — "Teď to nemůžu udělat, bolí mě záda." → Guard B.1 blocked → Haiku called');
  {
    mockCalled = false;
    const state = makeActionState();
    try {
      await processInput(TESTER_UID, 'Teď to nemůžu udělat, bolí mě záda.', state);
      check(mockCalled, '"...bolí mě záda." → Guard B.1 blocked → Haiku called');
    } catch (e) {
      check(false, `S2d threw: ${e.message}`);
    }
  }

  // ── S2e: Type B "kvůli" falls through to Haiku ────────────────────────────
  sep('S2e — "Nemůžu to dělat kvůli kolenu." → Guard B.1 blocked → Haiku called');
  {
    mockCalled = false;
    const state = makeActionState();
    try {
      await processInput(TESTER_UID, 'Nemůžu to dělat kvůli kolenu.', state);
      check(mockCalled, '"...kvůli kolenu." → Guard B.1 blocked → Haiku called');
    } catch (e) {
      check(false, `S2e threw: ${e.message}`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  Guard B.1 compound inability: ${passed} PASS, ${failed} FAIL`);
if (!TESTER_UID) console.log('  ⚠️  E2E sections skipped — set TEST_UID for full coverage');
console.log(`${'═'.repeat(70)}\n`);
if (failed > 0) process.exit(1);
