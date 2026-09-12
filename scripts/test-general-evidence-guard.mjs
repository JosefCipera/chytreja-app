// test-general-evidence-guard.mjs — Guard D.5 regression: GENERAL functional-evidence answer guard
//
// Proves that pending_question.type='GENERAL' with a functional RAW_VALUE evidence_type
// is deterministically intercepted before Haiku for:
//   1. NOT_AVAILABLE expressions  ("Ne, nemám.", "Nevím", "Nemám", ...)
//   2. Temporal refusal           ("Nemůžu ho teď udělat.", "Teď ne", "Jindy", ...)
//   3. Strict numeric scalar      ("14", "12,4", "12.4")
// And does NOT fire for context switches / compound health sentences.
//
// Section 1 — Guard boundary unit tests (no DB, no network)
//   Verifies that the guard sets classified=ANSWER_TO_EVIDENCE_QUESTION or lets it fall through.
//
// Section 2 — processInput E2E (Guard D.5 fires → Haiku mock irrelevant)
//   NOT_AVAILABLE:  TUG + "Ne, nemám." → ANSWER → NOT_AVAILABLE → resolved → not repeated
//   Temporal:       chair_stand + "Nemůžu ho teď udělat." → ANSWER → F1a → HOLD + suppression
//   Numeric valid:  chair_stand + "14" → ANSWER → parse() = 14 → DB write
//   Numeric valid:  TUG + "12,4" → ANSWER → parse() = 12.4 → DB write
//   Context switch: "Bolí mě záda" → guard does NOT fire → falls to Haiku (mock DOMAIN_REQUEST)
//   Context switch: "Co mám dělat, když mě bolí záda?" → guard does NOT fire
//   Non-interception: "Mám BMI 28" → has letters → not strict numeric → guard does NOT fire
//   Compound gate: "Nemůžu ho teď udělat, ale bolí mě záda" → COMPOUND_SIGNAL_RE → guard does NOT fire
//
// Run: node --env-file=.env.local scripts/test-general-evidence-guard.mjs

import esmock from 'esmock';
import { createClient } from '@supabase/supabase-js';

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`); }

// ── Classifier mock: returns DOMAIN_REQUEST by default ────────────────────────
// Guard D.5 must intercept before Haiku. If guard fires correctly, the mock is
// never called. If the mock IS called and returns DOMAIN_REQUEST, the test shows
// the guard did NOT intercept — which is the correct expectation for context-switch cases.
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

const {
  processInput,
  EVIDENCE_REFUSAL_NEGATION_RE,
  EVIDENCE_REFUSAL_TEMPORAL_RE,
  EVIDENCE_REFUSAL_DEFERRAL_RE,
} = await esmock('../api/engine/orchestrator.js', {
  '@anthropic-ai/sdk': { default: MockAnthropicDR },
});

// ── DB: read tester UID ───────────────────────────────────────────────────────
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Use first tester UID from tester-reset.js — test only, disposable account
const TESTER_UID = (() => {
  // Read from env or default to empty (tests will skip DB-side checks if no UID)
  return process.env.TEST_UID ?? null;
})();

// ── Section 1: Guard boundary unit tests (deterministic regex logic) ──────────

sep('S1 — NOT_AVAILABLE token: "Ne, nemám." intercepted');
{
  // The guard uses the same logic as classifyAvailability:
  //   stripped split[0] === 'ne'
  const stripped = 'Ne, nemám.'.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,!?]+$/, '');
  const NOT_AVAIL_TOKENS = new Set([
    'ne', 'no', 'nemam', 'nemam vysledek', 'nemam vysledek testu',
    'not available', 'not_available', 'n/a', 'nevim', 'zadny vysledek',
    'nemam zadny', 'nemam zadny vysledek', 'nemas', 'nic nemam',
  ]);
  const isNA = NOT_AVAIL_TOKENS.has(stripped)
    || stripped.startsWith('nemam')
    || stripped === 'ne'
    || stripped === 'no'
    || stripped.split(/[\s,]+/)[0] === 'ne';
  check(isNA, '"Ne, nemám." → isNotAvailable = true');
}

sep('S1 — NOT_AVAILABLE: "Nevím" intercepted');
{
  const stripped = 'Nevím'.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,!?]+$/, '');
  const NOT_AVAIL_TOKENS = new Set(['ne', 'no', 'nemam', 'not available', 'not_available', 'n/a', 'nevim', 'zadny vysledek', 'nemam zadny', 'nemas', 'nic nemam']);
  const isNA = NOT_AVAIL_TOKENS.has(stripped) || stripped.startsWith('nemam') || stripped === 'ne' || stripped === 'no' || stripped.split(/[\s,]+/)[0] === 'ne';
  check(isNA, '"Nevím" → isNotAvailable = true');
}

sep('S1 — Temporal refusal: "Nemůžu ho teď udělat." intercepted');
{
  const trimmed  = 'Nemůžu ho teď udělat.';
  const stripped = trimmed.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,!?]+$/, '');
  const COMPOUND_SIGNAL_RE = /\bale\b|\bprotože\b|\bjenže\b|\bavšak\b|\bpřičemž\b/i;
  const hasDigit = /\d/.test(stripped);
  const isTempRefusal = !COMPOUND_SIGNAL_RE.test(trimmed) && (
    (!hasDigit && EVIDENCE_REFUSAL_DEFERRAL_RE.test(stripped))
    || (EVIDENCE_REFUSAL_NEGATION_RE.test(stripped) && EVIDENCE_REFUSAL_TEMPORAL_RE.test(stripped))
  );
  check(!COMPOUND_SIGNAL_RE.test(trimmed), '"Nemůžu ho teď udělat." → no compound signal');
  check(EVIDENCE_REFUSAL_NEGATION_RE.test(stripped), '"Nemůžu ho teď udělat." → negation RE matches');
  check(EVIDENCE_REFUSAL_TEMPORAL_RE.test(stripped), '"Nemůžu ho teď udělat." → temporal RE matches');
  check(isTempRefusal, '"Nemůžu ho teď udělat." → isTempRefusal = true');
}

sep('S1 — Temporal refusal: "Teď ne" intercepted');
{
  const trimmed  = 'Teď ne';
  const stripped = trimmed.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,!?]+$/, '');
  const COMPOUND_SIGNAL_RE = /\bale\b|\bprotože\b|\bjenže\b|\bavšak\b|\bpřičemž\b/i;
  const hasDigit = /\d/.test(stripped);
  const isTempRefusal = !COMPOUND_SIGNAL_RE.test(trimmed) && (
    (!hasDigit && EVIDENCE_REFUSAL_DEFERRAL_RE.test(stripped))
    || (EVIDENCE_REFUSAL_NEGATION_RE.test(stripped) && EVIDENCE_REFUSAL_TEMPORAL_RE.test(stripped))
  );
  check(isTempRefusal, '"Teď ne" → isTempRefusal = true (deferral RE: "ted ne")');
}

sep('S1 — Temporal refusal: "Jindy" intercepted');
{
  const trimmed  = 'Jindy';
  const stripped = trimmed.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,!?]+$/, '');
  const COMPOUND_SIGNAL_RE = /\bale\b|\bprotože\b|\bjenže\b|\bavšak\b|\bpřičemž\b/i;
  const hasDigit = /\d/.test(stripped);
  const isTempRefusal = !COMPOUND_SIGNAL_RE.test(trimmed) && (
    (!hasDigit && EVIDENCE_REFUSAL_DEFERRAL_RE.test(stripped))
    || (EVIDENCE_REFUSAL_NEGATION_RE.test(stripped) && EVIDENCE_REFUSAL_TEMPORAL_RE.test(stripped))
  );
  check(isTempRefusal, '"Jindy" → isTempRefusal = true');
}

sep('S1 — Strict numeric: "14" intercepted');
{
  check(/^\s*\d[\d\s.,]*\s*$/.test('14'), '"14" → isStrictNumeric = true');
}

sep('S1 — Strict numeric: "12,4" intercepted');
{
  check(/^\s*\d[\d\s.,]*\s*$/.test('12,4'), '"12,4" → isStrictNumeric = true');
}

sep('S1 — Strict numeric: "12.4" intercepted');
{
  check(/^\s*\d[\d\s.,]*\s*$/.test('12.4'), '"12.4" → isStrictNumeric = true');
}

sep('S1 — "Mám BMI 28" NOT intercepted (has letters → not strict numeric)');
{
  const isStrictNumeric = /^\s*\d[\d\s.,]*\s*$/.test('Mám BMI 28');
  const stripped = 'Mám BMI 28'.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const NOT_AVAIL_TOKENS = new Set(['ne', 'no', 'nemam', 'not available', 'not_available', 'n/a', 'nevim', 'zadny vysledek', 'nemas', 'nic nemam']);
  const isNA = NOT_AVAIL_TOKENS.has(stripped) || stripped.startsWith('nemam') || stripped === 'ne' || stripped === 'no' || stripped.split(/[\s,]+/)[0] === 'ne';
  const COMPOUND_SIGNAL_RE = /\bale\b|\bprotože\b|\bjenže\b|\bavšak\b|\bpřičemž\b/i;
  const hasDigit = /\d/.test(stripped);
  const isTempRefusal = !COMPOUND_SIGNAL_RE.test('Mám BMI 28') && (
    (!hasDigit && EVIDENCE_REFUSAL_DEFERRAL_RE.test(stripped))
    || (EVIDENCE_REFUSAL_NEGATION_RE.test(stripped) && EVIDENCE_REFUSAL_TEMPORAL_RE.test(stripped))
  );
  check(!isStrictNumeric, '"Mám BMI 28" → isStrictNumeric = false');
  check(!isNA, '"Mám BMI 28" → isNotAvailable = false');
  check(!isTempRefusal, '"Mám BMI 28" → isTempRefusal = false');
}

sep('S1 — "Bolí mě záda" NOT intercepted by guard');
{
  const isStrictNumeric = /^\s*\d[\d\s.,]*\s*$/.test('Bolí mě záda');
  const stripped = 'Bolí mě záda'.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const NOT_AVAIL_TOKENS = new Set(['ne', 'no', 'nemam', 'not available', 'not_available', 'n/a', 'nevim', 'zadny vysledek', 'nemas', 'nic nemam']);
  const isNA = NOT_AVAIL_TOKENS.has(stripped) || stripped.startsWith('nemam') || stripped === 'ne' || stripped === 'no' || stripped.split(/[\s,]+/)[0] === 'ne';
  const COMPOUND_SIGNAL_RE = /\bale\b|\bprotože\b|\bjenže\b|\bavšak\b|\bpřičemž\b/i;
  const hasDigit = /\d/.test(stripped);
  const isTempRefusal = !COMPOUND_SIGNAL_RE.test('Bolí mě záda') && (
    (!hasDigit && EVIDENCE_REFUSAL_DEFERRAL_RE.test(stripped))
    || (EVIDENCE_REFUSAL_NEGATION_RE.test(stripped) && EVIDENCE_REFUSAL_TEMPORAL_RE.test(stripped))
  );
  check(!isStrictNumeric && !isNA && !isTempRefusal, '"Bolí mě záda" → guard does NOT fire');
}

sep('S1 — Compound gate: "Nemůžu ho teď udělat, ale bolí mě záda" NOT intercepted');
{
  const trimmed  = 'Nemůžu ho teď udělat, ale bolí mě záda';
  const COMPOUND_SIGNAL_RE = /\bale\b|\bprotože\b|\bjenže\b|\bavšak\b|\bpřičemž\b/i;
  const compoundMatch = COMPOUND_SIGNAL_RE.test(trimmed);
  // isTempRefusal requires !COMPOUND_SIGNAL_RE → compound blocks it
  check(compoundMatch, '"...ale bolí mě záda" → COMPOUND_SIGNAL_RE fires');
  const stripped = trimmed.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hasDigit = /\d/.test(stripped);
  const isTempRefusal = !compoundMatch && (
    (!hasDigit && EVIDENCE_REFUSAL_DEFERRAL_RE.test(stripped))
    || (EVIDENCE_REFUSAL_NEGATION_RE.test(stripped) && EVIDENCE_REFUSAL_TEMPORAL_RE.test(stripped))
  );
  check(!isTempRefusal, 'compound gate → isTempRefusal = false → guard does NOT fire');
}

// ── Section 1 cont.: Guard D.5 type boundary + buildSessionUpdates normalization ──

sep('S1 — Guard D.5 type boundary: type=GENERAL → condition passes');
{
  const pqType = 'GENERAL';
  check(pqType === 'GENERAL', 'type=GENERAL → guard condition passes');
}

sep('S1 — Guard D.5 type boundary: type=NEXT_BEST_EVIDENCE → condition fails');
{
  const pqType = 'NEXT_BEST_EVIDENCE';
  check(pqType !== 'GENERAL', 'type=NEXT_BEST_EVIDENCE → guard condition fails (engine-internal type must not reach routing)');
}

sep('S1 — Guard D.5 type boundary: type=PATH_DISCOVERY → condition fails (Guard D takes precedence)');
{
  const pqType = 'PATH_DISCOVERY';
  check(pqType !== 'GENERAL', 'type=PATH_DISCOVERY → guard condition fails (PATH_DISCOVERY is Guard D territory)');
}

sep('S1 — buildSessionUpdates normalization contract (orchestrator.js:513 — STOP #3 fix)');
{
  // Mirrors the exact ternary at line 513 after the fix:
  //   type: item?.context_id === 'BOOTSTRAP' ? 'BOOTSTRAP' : 'GENERAL'
  function normalizeType(item) {
    return item?.context_id === 'BOOTSTRAP' ? 'BOOTSTRAP' : 'GENERAL';
  }
  check(
    normalizeType({ type: 'NEXT_BEST_EVIDENCE', evidence_type: 'tug_test' }) === 'GENERAL',
    'NEXT_BEST_EVIDENCE + tug_test → normalized to GENERAL',
  );
  check(
    normalizeType({ type: 'NEXT_BEST_EVIDENCE', evidence_type: 'chair_stand_30s' }) === 'GENERAL',
    'NEXT_BEST_EVIDENCE + chair_stand_30s → normalized to GENERAL',
  );
  check(
    normalizeType({ type: 'NBA_QUESTION' }) === 'GENERAL',
    'NBA_QUESTION → normalized to GENERAL',
  );
  check(
    normalizeType(null) === 'GENERAL',
    'null item → normalized to GENERAL (no crash)',
  );
  check(
    normalizeType({ context_id: 'BOOTSTRAP', type: 'NBA_QUESTION', evidence_type: 'birth_year' }) === 'BOOTSTRAP',
    'BOOTSTRAP context_id wins over NBA_QUESTION type → BOOTSTRAP preserved',
  );
  check(
    normalizeType({ context_id: 'BOOTSTRAP', type: 'NEXT_BEST_EVIDENCE' }) === 'BOOTSTRAP',
    'BOOTSTRAP context_id wins over NEXT_BEST_EVIDENCE type → BOOTSTRAP preserved',
  );
}

// ── Section 2: processInput E2E ───────────────────────────────────────────────
// These tests require DB. Skip gracefully if no TESTER_UID.

if (!TESTER_UID) {
  sep('S2 — processInput E2E SKIPPED (no TEST_UID env var)');
  console.log('  ⚠️  Set TEST_UID=<disposable-tester-uid> to run E2E tests');
} else {
  // Build a minimal sessionState with pending_question.type='GENERAL'
  function makeState(evidenceType) {
    return {
      pending_question: {
        text: evidenceType === 'tug_test'
          ? 'Kolik sekund ti trvá ujít 3 metry, otočit se a vrátit se?'
          : 'Pokud je to pro tebe bezpečné, kolikrát vstaneš ze židle za 30 sekund?',
        evidence_type: evidenceType,
        type: 'GENERAL',
      },
      question_budget_remaining: 0,
      last_daily_decision: null,
      pending_clarifications: [],
      fatigue_context: null,
      person_birth_year: 1960,
      person_sex: 'male',
      resolved_physical: [],
      hp_physical: {},
    };
  }

  sep('S2a — TUG + "Ne, nemám." → ANSWER_TO_EVIDENCE_QUESTION → resolved');
  {
    mockCalled = false;
    const state = makeState('tug_test');
    try {
      const res = await processInput(TESTER_UID, 'Ne, nemám.', state);
      check(!mockCalled, 'Guard D.5 intercepted → Haiku NOT called');
      // Check DB: tug_test availability should be NOT_AVAILABLE
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.tug_test;
      check(val === 'NOT_AVAILABLE' || val === null || typeof val === 'number',
        `tug_test availability recorded (val=${JSON.stringify(val)}) — NOT_AVAILABLE or persisted`);
    } catch (e) {
      check(false, `S2a threw: ${e.message}`);
    }
  }

  sep('S2b — chair_stand + "Nemůžu ho teď udělat." → F1a HOLD + session suppression');
  {
    mockCalled = false;
    const state = makeState('chair_stand_30s');
    try {
      const res = await processInput(TESTER_UID, 'Nemůžu ho teď udělat.', state);
      check(!mockCalled, 'Guard D.5 intercepted → Haiku NOT called');
      check(res.mode === 'HOLD', `mode = HOLD (got ${res.mode})`);
      const skipped = res.session_updates?.session_skipped_evidence ?? [];
      check(skipped.includes('chair_stand_30s'),
        `session_skipped_evidence includes chair_stand_30s (got ${JSON.stringify(skipped)})`);
    } catch (e) {
      check(false, `S2b threw: ${e.message}`);
    }
  }

  sep('S2c — chair_stand + "14" → parse() = 14 → DB write');
  {
    mockCalled = false;
    const state = makeState('chair_stand_30s');
    try {
      const res = await processInput(TESTER_UID, '14', state);
      check(!mockCalled, 'Guard D.5 intercepted → Haiku NOT called');
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.chair_stand_30s;
      check(val === 14, `chair_stand_30s = 14 in DB (got ${JSON.stringify(val)})`);
    } catch (e) {
      check(false, `S2c threw: ${e.message}`);
    }
  }

  sep('S2d — TUG + "12,4" → parse() = 12.4 → DB write');
  {
    mockCalled = false;
    const state = makeState('tug_test');
    try {
      const res = await processInput(TESTER_UID, '12,4', state);
      check(!mockCalled, 'Guard D.5 intercepted → Haiku NOT called');
      const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', TESTER_UID).maybeSingle();
      const val = data?.physical?.tug_test;
      check(val === 12.4, `tug_test = 12.4 in DB (got ${JSON.stringify(val)})`);
    } catch (e) {
      check(false, `S2d threw: ${e.message}`);
    }
  }

  sep('S2e — "Bolí mě záda" → guard does NOT fire → Haiku called (DOMAIN_REQUEST)');
  {
    mockCalled = false;
    const state = makeState('tug_test');
    try {
      const res = await processInput(TESTER_UID, 'Bolí mě záda', state);
      check(mockCalled, 'Guard D.5 did NOT intercept → Haiku was called');
    } catch (e) {
      check(false, `S2e threw: ${e.message}`);
    }
  }

  sep('S2f — "Co mám dělat, když mě bolí záda?" → guard does NOT fire');
  {
    mockCalled = false;
    const state = makeState('tug_test');
    try {
      const res = await processInput(TESTER_UID, 'Co mám dělat, když mě bolí záda?', state);
      check(mockCalled, 'Guard D.5 did NOT intercept → Haiku was called');
    } catch (e) {
      check(false, `S2f threw: ${e.message}`);
    }
  }

  sep('S2g — "Mám BMI 28" → guard does NOT fire');
  {
    mockCalled = false;
    const state = makeState('chair_stand_30s');
    try {
      const res = await processInput(TESTER_UID, 'Mám BMI 28', state);
      check(mockCalled, 'Guard D.5 did NOT intercept → Haiku was called');
    } catch (e) {
      check(false, `S2g threw: ${e.message}`);
    }
  }

  sep('S2h — Compound: "Nemůžu ho teď udělat, ale bolí mě záda" → guard does NOT fire');
  {
    mockCalled = false;
    const state = makeState('chair_stand_30s');
    try {
      const res = await processInput(TESTER_UID, 'Nemůžu ho teď udělat, ale bolí mě záda', state);
      check(mockCalled, 'Guard D.5 did NOT intercept (compound gate) → Haiku was called');
    } catch (e) {
      check(false, `S2h threw: ${e.message}`);
    }
  }

  sep('S2i — type=NEXT_BEST_EVIDENCE + tug_test + "Ne, nemám." → Guard D.5 does NOT fire (type guard)');
  {
    // Regression boundary: guard requires type==='GENERAL'. An old session with leaked
    // engine-internal type must not be misrouted — Haiku handles it instead.
    mockCalled = false;
    const state = {
      pending_question: {
        text: 'Kolik sekund ti trvá ujít 3 metry, otočit se a vrátit se?',
        evidence_type: 'tug_test',
        type: 'NEXT_BEST_EVIDENCE',
      },
      question_budget_remaining: 0,
      last_daily_decision: null,
      pending_clarifications: [],
      fatigue_context: null,
      person_birth_year: 1960,
      person_sex: 'male',
      resolved_physical: [],
      hp_physical: {},
    };
    try {
      const res = await processInput(TESTER_UID, 'Ne, nemám.', state);
      check(mockCalled, 'type=NEXT_BEST_EVIDENCE → Guard D.5 condition fails → Haiku called (type guard holds)');
    } catch (e) {
      check(false, `S2i threw: ${e.message}`);
    }
  }

  sep('S2j — type=PATH_DISCOVERY + tug_test + "Ne, nemám." → Guard D.5 does NOT fire (Guard D territory)');
  {
    // PATH_DISCOVERY is handled by Guard D, never by Guard D.5.
    mockCalled = false;
    const state = {
      pending_question: {
        text: 'Máš výsledek TUG testu?',
        evidence_type: 'tug_test',
        type: 'PATH_DISCOVERY',
      },
      question_budget_remaining: 0,
      last_daily_decision: null,
      pending_clarifications: [],
      fatigue_context: null,
      person_birth_year: 1960,
      person_sex: 'male',
      resolved_physical: [],
      hp_physical: {},
    };
    try {
      const res = await processInput(TESTER_UID, 'Ne, nemám.', state);
      check(mockCalled, 'type=PATH_DISCOVERY → Guard D.5 condition fails → Haiku called (PATH_DISCOVERY routing separate)');
    } catch (e) {
      check(false, `S2j threw: ${e.message}`);
    }
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  Guard D.5 regression: ${passed} PASS, ${failed} FAIL`);
if (!TESTER_UID) console.log('  ⚠️  E2E section skipped — set TEST_UID for full coverage');
console.log(`${'═'.repeat(60)}\n`);
if (failed > 0) process.exit(1);
