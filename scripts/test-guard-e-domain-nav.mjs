// test-guard-e-domain-nav.mjs — Guard E regression suite
//
// Guard E: DOMAIN_REQUEST_NAV_RE catches standalone navigation phrases
// ("Co mám dělat?", "Co tedy mám udělat?", "Co teď?", "Co dál?", "Poraď mi.")
// before the Haiku classifier so adapterType = DOMAIN_REQUEST is deterministic
// even when pending_question is in the session context.
//
// Section 1 — unit: DOMAIN_REQUEST_NAV_RE positive and negative cases (no DB)
// Section 2 — end-to-end: "Co tedy mám udělat?" WITHOUT classifier mock
//   budget=0 + live PHYSICAL_GUIDED_NOW profile + real Guard E path
//   → GUIDED_NOW_SUBSTITUTION + chair_stand_30s + budget stays 0
//
// Run: node --env-file=.env.local scripts/test-guard-e-domain-nav.mjs

import { processInput, GUIDED_NOW_TESTS, DOMAIN_REQUEST_NAV_RE } from '../api/engine/orchestrator.js';
import { createClient } from '@supabase/supabase-js';

const sb        = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FAKE_USER = `test-ge-${Date.now()}`;

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
  const d = r.debug?._diag;
  if (d) {
    console.log(`  _diag.adapterType         : ${d.adapterType}`);
    console.log(`  _diag.evidence_context    : [${(d.evidence_context_types ?? []).join(', ')}]`);
    console.log(`  _diag.guided_now_found    : ${d.guided_now_found}`);
  }
}

// ── Section 1 — DOMAIN_REQUEST_NAV_RE unit tests ──────────────────────────────

sep('Guard E regex — positive: must match (→ DOMAIN_REQUEST)');

const POSITIVE = [
  'Co mám dělat?',
  'Co tedy mám udělat?',
  'co tedy mám dělat?',       // lowercase
  'Co teď?',
  'Co dál?',
  'Poraď mi.',
  'Poraď.',
  'Co mám teď dělat?',
  'Co doporučuješ?',
  'Co mám dělat',             // no punctuation
  'Co mám dělat!',
  'Poraď mi!',
];

for (const phrase of POSITIVE) {
  check(DOMAIN_REQUEST_NAV_RE.test(phrase.trim()), `matches: "${phrase}"`);
}

sep('Guard E regex — negative: must NOT match (→ Haiku / other guard)');

const NEGATIVE = [
  'Co mám dělat, když mě bolí záda?',  // compound — comma blocks $
  'Co mám teď jíst?',                  // "jíst" ≠ dělat|udělat
  'Co to je?',                         // "to" not in pattern
  'Co bych měl dělat?',                // "bych měl" ≠ mám
  'Poraď mi, co jíst.',                // ", co jíst." fails $
  'Hotovo',                            // action completion
  'Přeskočím',                         // action skip
  'Ano',                               // bootstrap yes/no
  'Ne',
  'Nevím',
  '58',                                // birth year
  'Bolí mě koleno',                    // new symptom
  'Mám vysoký tlak 140/90',            // new measurement
  'Jsem unavený.',                     // fatigue (Guard A)
  'Co mám dělat? Mám vysoký tlak.',   // two sentences — fails $ after first ?
];

for (const phrase of NEGATIVE) {
  check(!DOMAIN_REQUEST_NAV_RE.test(phrase.trim()), `does NOT match: "${phrase}"`);
}

// ── Section 2 — end-to-end: STOP #4 without classifier mock ──────────────────
// "Co tedy mám udělat?" with budget=0 + PHYSICAL_GUIDED_NOW profile.
// Guard E intercepts before Haiku → adapterType=DOMAIN_REQUEST → guided-now fires.

const PHYSICAL_GUIDED_NOW = {
  vynest_nakup: false, vstat_ze_zeme: true, recent_falls: false,
  evidence_availability: {
    tug_test:      'NOT_AVAILABLE',
    grip_strength: 'NOT_AVAILABLE',
    // chair_stand_30s: absent → unresolved → evidence_context[0]
  },
};

await sb.from('user_profiles').upsert(
  { user_id: FAKE_USER, birth_year: 1959, gender: 'female' },
  { onConflict: 'user_id' }
);
await sb.from('user_health_profile').upsert(
  { user_id: FAKE_USER, physical: PHYSICAL_GUIDED_NOW },
  { onConflict: 'user_id' }
);

sep('E2E — "Co tedy mám udělat?" NO mock · budget=0 · chair_stand_30s unresolved → GUIDED_NOW_SUBSTITUTION');

{
  const session = {
    question_budget_remaining: 0,
    last_daily_decision: { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
    // pending_question simulates real session state that caused misclassification
    pending_question: { text: '...', evidence_type: 'tug_test', type: 'GENERAL' },
  };

  const r = await processInput(FAKE_USER, 'Co tedy mám udělat?', session);
  show(r);

  check(r.debug?.reason_code === 'GUIDED_NOW_SUBSTITUTION',
    `reason_code = GUIDED_NOW_SUBSTITUTION (got: ${r.debug?.reason_code})`);
  check(r.debug?._diag?.adapterType === 'DOMAIN_REQUEST',
    `_diag.adapterType = DOMAIN_REQUEST (got: ${r.debug?._diag?.adapterType})`);
  check((r.debug?._diag?.evidence_context_types ?? []).includes('chair_stand_30s'),
    `evidence_context contains chair_stand_30s (got: [${r.debug?._diag?.evidence_context_types?.join(', ')}])`);
  check(r.debug?._diag?.guided_now_found === 'chair_stand_30s',
    `guided_now_found = chair_stand_30s (got: ${r.debug?._diag?.guided_now_found})`);
  check(r.session_updates?.pending_question?.evidence_type === 'chair_stand_30s',
    `pending_question.evidence_type = chair_stand_30s (got: ${r.session_updates?.pending_question?.evidence_type})`);
  check(r.session_updates?.question_budget_remaining === 0,
    `budget stays 0 (got: ${r.session_updates?.question_budget_remaining})`);
  check(r.mode === 'ASK',
    `mode = ASK (got: ${r.mode})`);
}

sep('E2E — "Co mám dělat?" NO mock · budget=0 · chair_stand_30s unresolved → GUIDED_NOW_SUBSTITUTION');

{
  const session = {
    question_budget_remaining: 0,
    last_daily_decision: { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
  };

  const r = await processInput(FAKE_USER, 'Co mám dělat?', session);
  show(r);

  check(r.debug?.reason_code === 'GUIDED_NOW_SUBSTITUTION',
    `reason_code = GUIDED_NOW_SUBSTITUTION (got: ${r.debug?.reason_code})`);
  check(r.debug?._diag?.adapterType === 'DOMAIN_REQUEST',
    `_diag.adapterType = DOMAIN_REQUEST (got: ${r.debug?._diag?.adapterType})`);
  check(r.session_updates?.pending_question?.evidence_type === 'chair_stand_30s',
    `pending_question.evidence_type = chair_stand_30s (got: ${r.session_updates?.pending_question?.evidence_type})`);
}

sep('E2E — compound input "Co mám dělat, když mě bolí záda?" · falls through to Haiku (no Guard E)');

{
  // With exhausted credits, Haiku falls back to GENERAL_HEALTH_REQUEST.
  // We verify Guard E does NOT intercept compound input — it must NOT return GUIDED_NOW_SUBSTITUTION.
  const session = {
    question_budget_remaining: 0,
    last_daily_decision: { mode: 'ASK', reason_code: 'ASK_BLOCKING' },
  };

  const r = await processInput(FAKE_USER, 'Co mám dělat, když mě bolí záda?', session);
  show(r);

  check(r.debug?.reason_code !== 'GUIDED_NOW_SUBSTITUTION',
    `compound input does NOT trigger GUIDED_NOW_SUBSTITUTION (got: ${r.debug?.reason_code})`);
  check(r.debug?._diag?.adapterType !== 'DOMAIN_REQUEST',
    `compound input adapterType ≠ DOMAIN_REQUEST (got: ${r.debug?._diag?.adapterType})`);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

await sb.from('user_health_profile').delete().eq('user_id', FAKE_USER);
await sb.from('user_profiles').delete().eq('user_id', FAKE_USER);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(64)}\n`);
if (failed > 0) process.exit(1);
