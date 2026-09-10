// test-guided-now-budget.mjs — ALPHA STOP #4 regression tests
// Proves the GUIDED_NOW_TESTS guided-now budget-gate substitution for chair_stand_30s.
//
// Root cause: when budget=0 and the engine's LONGEVITY_FUNCTION gate is EVIDENCE_SUFFICIENT
// (LOW_MUSCLE_STRENGTH MEASURED → ACTIONABLE), the engine emits no NBE (primary_item=null).
// The orchestrator fallback selects sedentary_hours_day, which the budget gate blocks.
// chair_stand_30s knowledge exists in missing_evidence but is surfaced via evidence_context,
// not via pending_question. The fix looks up evidence_context in the BUDGET_EXHAUSTED path.
//
// Classifier mock: @anthropic-ai/sdk is replaced via esmock so classifyIntent always returns
// DOMAIN_REQUEST, independent of Haiku API credit availability. This is test-side only —
// no production code is modified. All other deps (adapter, healthEventAdapter, etc.) are real.
//
// T1: DOMAIN_REQUEST + budget=0 + chair_stand_30s in evidence_context → GUIDED_NOW_SUBSTITUTION
//     pending_question.evidence_type = 'chair_stand_30s', budget stays 0 (end-to-end)
// T2: GUIDED_NOW_TESTS does NOT contain tug_test (constant correctness)
// T3: GUIDED_NOW_TESTS does NOT contain grip_strength (constant correctness)
// T4: tug_test unresolved (chair+grip resolved) → tug_test in evidence_context, not GUIDED_NOW
//     → BUDGET_EXHAUSTED fires (end-to-end)
// T5: budget=1 (not exhausted), chair_stand_30s unresolved → guided-now substitution does NOT fire,
//     normal decrement to 0 (end-to-end — substitution only fires at budget=0)
// T6: grip_strength unresolved (chair+tug resolved) → grip in evidence_context, not GUIDED_NOW
//     → BUDGET_EXHAUSTED fires (end-to-end)
//
// Run: node --env-file=.env.local scripts/test-guided-now-budget.mjs

import esmock from 'esmock';
import { createClient } from '@supabase/supabase-js';

// ── Classifier mock ────────────────────────────────────────────────────────────
// Replace @anthropic-ai/sdk so classifyIntent returns DOMAIN_REQUEST without a
// real Haiku call. The orchestrator's getClient() lazily creates new MockAnthropic(),
// whose messages.create() returns a synthetic tool_use block.
// esmock loads orchestrator.js fresh with this substitution; all local deps are real.
class MockAnthropic {
  constructor(_opts) {}
  get messages() {
    return {
      create: async () => ({
        content: [{ type: 'tool_use', input: { event_type: 'DOMAIN_REQUEST', payload: {} } }],
      }),
    };
  }
}

const { processInput, GUIDED_NOW_TESTS } = await esmock('../api/engine/orchestrator.js', {
  '@anthropic-ai/sdk': { default: MockAnthropic },
});

const sb        = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FAKE_USER = `test-gnb-${Date.now()}`;

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(64)}\n  ${label}\n${'─'.repeat(64)}`); }

function show(r) {
  console.log(`  mode        : ${r.mode}`);
  console.log(`  reason_code : ${r.debug?.reason_code ?? '—'}`);
  console.log(`  text (80c)  : ${(r.text ?? '').slice(0, 80)}`);
  console.log(`  budget_rem  : ${r.session_updates?.question_budget_remaining ?? '—'}`);
  const pq = r.session_updates?.pending_question;
  if (pq) console.log(`  pending_q   : ${pq.evidence_type} (${pq.type})`);
}

// ── Shared profile: LOW_MUSCLE_STRENGTH(MEASURED) + chair_stand_30s unresolved ─
// vynest_nakup=false activates LOW_MUSCLE_STRENGTH.
// tug_test and grip_strength are NOT_AVAILABLE (resolved) so chair_stand_30s is
// the only GUIDED_NOW_TESTS candidate in evidence_context.

const PHYSICAL_GUIDED_NOW = {
  vynest_nakup: false, vstat_ze_zeme: true, recent_falls: false,
  evidence_availability: {
    tug_test:      'NOT_AVAILABLE',
    grip_strength: 'NOT_AVAILABLE',
    // chair_stand_30s: intentionally absent → unresolved → in evidence_context[0]
  },
};

// T4 profile: chair_stand_30s resolved, tug_test unresolved.
// LOW_MUSCLE_STRENGTH.missing_evidence = [] (grip + chair both resolved).
// REDUCED_FUNCTIONAL_RESERVE.missing_evidence = [tug_test].
// evidence_context[0] = tug_test → not in GUIDED_NOW_TESTS → BUDGET_EXHAUSTED.
const PHYSICAL_TUG_UNRESOLVED = {
  vynest_nakup: false, vstat_ze_zeme: true, recent_falls: false,
  evidence_availability: {
    chair_stand_30s: 'NOT_AVAILABLE',
    grip_strength:   'NOT_AVAILABLE',
    // tug_test: intentionally absent → unresolved → in evidence_context[0]
  },
};

// T6 profile: chair_stand_30s resolved, grip_strength unresolved.
// LOW_MUSCLE_STRENGTH.missing_evidence = [grip_strength] (chair resolved, grip not).
// evidence_context[0] = grip_strength → not in GUIDED_NOW_TESTS → BUDGET_EXHAUSTED.
const PHYSICAL_GRIP_UNRESOLVED = {
  vynest_nakup: false, vstat_ze_zeme: true, recent_falls: false,
  evidence_availability: {
    chair_stand_30s: 'NOT_AVAILABLE',
    tug_test:        'NOT_AVAILABLE',
    // grip_strength: intentionally absent → unresolved → in evidence_context[0]
  },
};

await sb.from('user_profiles').upsert(
  { user_id: FAKE_USER, birth_year: 1959, gender: 'female' },
  { onConflict: 'user_id' }
);

// ── T1: GUIDED_NOW_SUBSTITUTION end-to-end ────────────────────────────────────

sep('T1 — DOMAIN_REQUEST + budget=0 + chair_stand_30s unresolved → GUIDED_NOW_SUBSTITUTION');

{
  await sb.from('user_health_profile').upsert(
    { user_id: FAKE_USER, physical: PHYSICAL_GUIDED_NOW },
    { onConflict: 'user_id' }
  );
  const session = {
    question_budget_remaining: 0,
    last_daily_decision: { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
  };
  const r = await processInput(FAKE_USER, 'Co tedy mám udělat?', session);
  show(r);

  check(r.debug?.reason_code === 'GUIDED_NOW_SUBSTITUTION',
    `reason_code = GUIDED_NOW_SUBSTITUTION (got: ${r.debug?.reason_code})`);
  check(r.session_updates?.pending_question?.evidence_type === 'chair_stand_30s',
    `pending_question.evidence_type = 'chair_stand_30s' (got: ${r.session_updates?.pending_question?.evidence_type})`);
  check(r.session_updates?.question_budget_remaining === 0,
    `budget_remaining stays 0 (got: ${r.session_updates?.question_budget_remaining})`);
  check(r.mode === 'ASK',
    `mode = ASK (got: ${r.mode})`);
}

// ── T2/T3: constant correctness (no DB needed) ────────────────────────────────

sep('T2 — GUIDED_NOW_TESTS does NOT contain tug_test');
check(!GUIDED_NOW_TESTS.has('tug_test'), 'tug_test not in GUIDED_NOW_TESTS');

sep('T3 — GUIDED_NOW_TESTS does NOT contain grip_strength');
check(!GUIDED_NOW_TESTS.has('grip_strength'), 'grip_strength not in GUIDED_NOW_TESTS');

// ── T4: tug_test unresolved → evidence_context[0]=tug_test → BUDGET_EXHAUSTED ─

sep('T4 — tug_test unresolved (not GUIDED_NOW) + budget=0 → BUDGET_EXHAUSTED');

{
  await sb.from('user_health_profile').update(
    { physical: PHYSICAL_TUG_UNRESOLVED },
  ).eq('user_id', FAKE_USER);
  const session = {
    question_budget_remaining: 0,
    last_daily_decision: { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
  };
  const r = await processInput(FAKE_USER, 'Co tedy mám udělat?', session);
  show(r);

  const ec = r.session_updates?.last_domain_response?.explanation_context?.evidence_context ?? [];
  console.log(`  evidence_ctx : [${ec.map(n => n.evidence_type).join(', ')}]`);
  check(r.debug?.reason_code === 'BUDGET_EXHAUSTED',
    `reason_code = BUDGET_EXHAUSTED — tug_test does not bypass gate (got: ${r.debug?.reason_code})`);
}

// ── T5: budget=1 (not exhausted) → no substitution, normal decrement ──────────

sep('T5 — budget=1 + chair_stand_30s unresolved → ASK_BLOCKING, decrement to 0 (no substitution)');

{
  await sb.from('user_health_profile').update(
    { physical: PHYSICAL_GUIDED_NOW },
  ).eq('user_id', FAKE_USER);
  const session = {
    question_budget_remaining: 1,
    last_daily_decision: { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
  };
  const r = await processInput(FAKE_USER, 'Co tedy mám udělat?', session);
  show(r);

  check(r.debug?.reason_code !== 'GUIDED_NOW_SUBSTITUTION',
    `guided-now substitution does NOT fire at budget=1 (got: ${r.debug?.reason_code})`);
  check(r.session_updates?.question_budget_remaining === 0,
    `budget decrements 1 → 0 (got: ${r.session_updates?.question_budget_remaining})`);
}

// ── T6: grip_strength unresolved → evidence_context[0]=grip → BUDGET_EXHAUSTED ─

sep('T6 — grip_strength unresolved (not GUIDED_NOW) + budget=0 → BUDGET_EXHAUSTED');

{
  await sb.from('user_health_profile').update(
    { physical: PHYSICAL_GRIP_UNRESOLVED },
  ).eq('user_id', FAKE_USER);
  const session = {
    question_budget_remaining: 0,
    last_daily_decision: { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
  };
  const r = await processInput(FAKE_USER, 'Co tedy mám udělat?', session);
  show(r);

  const ec = r.session_updates?.last_domain_response?.explanation_context?.evidence_context ?? [];
  console.log(`  evidence_ctx : [${ec.map(n => n.evidence_type).join(', ')}]`);
  check(r.debug?.reason_code === 'BUDGET_EXHAUSTED',
    `reason_code = BUDGET_EXHAUSTED — grip_strength does not bypass gate (got: ${r.debug?.reason_code})`);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

await sb.from('user_health_profile').delete().eq('user_id', FAKE_USER);
await sb.from('user_profiles').delete().eq('user_id', FAKE_USER);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(64)}\n`);
if (failed > 0) process.exit(1);
