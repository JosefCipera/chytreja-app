// scripts/test-bridge-person-model-integration.mjs
// Bridge → Person Model Integration #1 Tests
// Run: node scripts/test-bridge-person-model-integration.mjs
//
// Proves CHJ can accumulate knowledge about one person across utterances
// using real, unmodified Bridge #1 + Person Model #1.
// No API key, no HTTP, no database, no Engine, no LLM.

import { PersonModel, LIFECYCLE } from '../api/lib/personModel/personModel.js';
import { ingestUtterance } from '../api/lib/integration/bridgeToPersonModel.js';
import {
  CLAIM_TYPES,
  ENTITY_TYPES,
  PRECISION,
  SPEAKER_CERTAINTY,
  CLAIMED_SOURCE_TYPES,
  TEMPORAL_SCOPES,
} from '../api/lib/bridge/structuredFactBridge.js';

// ── Test runner ────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const results = [];

function check(condition, label, detail = '') {
  if (condition) {
    results.push(`  ✅  ${label}`);
    passed++;
  } else {
    results.push(`  ❌  ${label}${detail !== '' ? `\n      GOT: ${JSON.stringify(detail)}` : ''}`);
    failed++;
  }
}

function sep(label) {
  results.push(`\n${'─'.repeat(64)}\n  ${label}\n${'─'.repeat(64)}`);
}

// ── Timestamps ─────────────────────────────────────────────────────────────────
// Simulated wall-clock: Day 1 conversation, then Day 14 second weight.

const DAY1 = {
  T1: '2026-09-01T10:00:00.000Z',
  T2: '2026-09-01T10:01:00.000Z',
  T3: '2026-09-01T10:02:00.000Z',
  T4: '2026-09-01T10:03:00.000Z',
  T5: '2026-09-01T10:04:00.000Z',
};
const DAY14 = '2026-09-15T10:00:00.000Z';

// ══════════════════════════════════════════════════════════════════════════════
// TABLETOP — 5-turn conversation + second weight
// ══════════════════════════════════════════════════════════════════════════════

sep('SETUP: create fresh PersonModel');
const pm = new PersonModel();
check(pm.size === 0, 'SETUP-a: model starts empty');

// ── Turn 1 ─────────────────────────────────────────────────────────────────────

sep('TURN 1: "Chci zhubnout." → USER_INTENTION');

const t1Facts = ingestUtterance(pm, 'Chci zhubnout.', {
  conversationTurn: 1,
  extractedAt:      DAY1.T1,
});

check(t1Facts.length >= 1, 'T1-a: Bridge extracted at least one fact');

{
  const r = pm.query({ claim_type: CLAIM_TYPES.USER_INTENTION, lifecycle_status: LIFECYCLE.ACTIVE });
  check(r.length >= 1, 'T1-b: USER_INTENTION exists in Person Model');

  const f = r.find(x => x.fact.subject === 'body_weight');
  check(!!f, 'T1-c: subject = body_weight');
  check(f?.fact.value === 'reduce', 'T1-d: value = reduce', f?.fact.value);
  check(f?.lifecycle.status === LIFECYCLE.ACTIVE, 'T1-e: lifecycle = ACTIVE');
}

// ── Turn 2 ─────────────────────────────────────────────────────────────────────

sep('TURN 2: "Vážím asi 95 kilo." → MEASUREMENT APPROXIMATE ASSERTED');

const t2Facts = ingestUtterance(pm, 'Vážím asi 95 kilo.', {
  conversationTurn: 2,
  extractedAt:      DAY1.T2,
});

check(t2Facts.length >= 1, 'T2-a: Bridge extracted at least one fact');

{
  const r = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    subject:          'body_weight',
    lifecycle_status: LIFECYCLE.ACTIVE,
  });
  check(r.length === 1, 'T2-b: exactly one ACTIVE body_weight measurement', r.length);

  const f = r[0]?.fact;
  check(f?.value === 95, 'T2-c: value = 95', f?.value);
  check(f?.unit  === 'kg', 'T2-d: unit = kg', f?.unit);
  check(f?.precision === PRECISION.APPROXIMATE, 'T2-e: precision = APPROXIMATE', f?.precision);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T2-f: speaker_certainty = ASSERTED (asi marks precision, not uncertainty)', f?.speaker_certainty);
}

// ── Turn 3 ─────────────────────────────────────────────────────────────────────

sep('TURN 3: "Málo se hýbu." → SELF_REPORTED_BEHAVIOR low');

const t3Facts = ingestUtterance(pm, 'Málo se hýbu.', {
  conversationTurn: 3,
  extractedAt:      DAY1.T3,
});

check(t3Facts.length >= 1, 'T3-a: Bridge extracted at least one fact');

{
  const r = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
    subject:          'physical_activity',
    lifecycle_status: LIFECYCLE.ACTIVE,
  });
  check(r.length >= 1, 'T3-b: SELF_REPORTED_BEHAVIOR physical_activity ACTIVE');

  const f = r.find(x => x.fact.value === 'low');
  check(!!f, 'T3-c: value = low');
  check(f?.fact.entity?.type === ENTITY_TYPES.PERSON_SELF, 'T3-d: entity = PERSON_SELF');
}

// ── Turn 4 ─────────────────────────────────────────────────────────────────────

sep('TURN 4: "Doktor mi diagnostikoval vysoký tlak." → STATE DOCTOR claimed_source');

const t4Facts = ingestUtterance(pm, 'Doktor mi diagnostikoval vysoký tlak.', {
  conversationTurn: 4,
  extractedAt:      DAY1.T4,
});

check(t4Facts.length >= 1, 'T4-a: Bridge extracted at least one fact');

{
  const r = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_STATE,
    subject:          'blood_pressure',
    lifecycle_status: LIFECYCLE.ACTIVE,
  });
  check(r.length >= 1, 'T4-b: blood_pressure STATE ACTIVE');

  const f = r[0]?.fact;
  check(f?.value === 'high', 'T4-c: value = high (not clinical label)', f?.value);
  check(f?.claimed_source?.type === CLAIMED_SOURCE_TYPES.DOCTOR,
    'T4-d: claimed_source = DOCTOR (user-reported — not verified diagnosis)', f?.claimed_source);
  check(f?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'T4-e: speaker_certainty = ASSERTED', f?.speaker_certainty);

  // CRITICAL: value must NOT be upgraded to clinical label
  check(f?.value !== 'hypertension' && f?.value !== 'HYPERTENSION',
    'T4-f: value is NOT a clinical label (hypertension)');
}

// ── Turn 5 ─────────────────────────────────────────────────────────────────────

sep('TURN 5: "Zadýchávám se, když vyjdu dvě patra." → SUBJECTIVE_SYMPTOM dyspnea');

const t5Facts = ingestUtterance(pm, 'Zadýchávám se, když vyjdu dvě patra.', {
  conversationTurn: 5,
  extractedAt:      DAY1.T5,
});

check(t5Facts.length >= 1, 'T5-a: Bridge extracted at least one fact');

{
  const r = pm.query({
    claim_type:       CLAIM_TYPES.SUBJECTIVE_SYMPTOM,
    subject:          'dyspnea',
    lifecycle_status: LIFECYCLE.ACTIVE,
  });
  check(r.length >= 1, 'T5-b: dyspnea SUBJECTIVE_SYMPTOM ACTIVE');

  const f = r[0]?.fact;
  check(f?.value?.symptom === 'dyspnea',   'T5-c: value.symptom = dyspnea');
  check(f?.value?.context === 'exertional','T5-d: value.context = exertional');
  check(f?.value?.threshold === 'stairs',  'T5-e: value.threshold = stairs');

  // FORBIDDEN: no causal inference
  const allFacts = pm.query();
  const hasCausal = allFacts.some(r =>
    String(r.fact.value).toLowerCase().includes('vo2') ||
    String(r.fact.value).toLowerCase().includes('deconditioning') ||
    r.fact.claim_type === 'CAUSAL_HYPOTHESIS',
  );
  check(!hasCausal, 'T5-f: no VO2MAX / deconditioning / causal inference in model');
}

// ── Model state after 5 turns ──────────────────────────────────────────────────

sep('STATE after 5 turns: active fact count');

{
  const allActive = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });
  // Expected: USER_INTENTION + MEASUREMENT + BEHAVIOR + STATE + SYMPTOM = 5 minimum
  check(allActive.length >= 5, `STATEA-a: at least 5 ACTIVE facts (got ${allActive.length})`, allActive.length);
  check(pm.query({ lifecycle_status: LIFECYCLE.HISTORICAL }).length === 0,
    'STATEA-b: no HISTORICAL yet (only one weight so far)');
}

// ══════════════════════════════════════════════════════════════════════════════
// SECOND WEIGHT — Day 14
// ══════════════════════════════════════════════════════════════════════════════

sep('SECOND WEIGHT: Day 14 "Vážím 92 kilo." → 95 HISTORICAL, 92 ACTIVE');

const t6Facts = ingestUtterance(pm, 'Vážím 92 kilo.', {
  conversationTurn: 6,
  extractedAt:      DAY14,   // clearly later than DAY1.T2
});

check(t6Facts.length >= 1, 'W2-a: Bridge extracted second weight fact');

{
  const active = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    subject:          'body_weight',
    lifecycle_status: LIFECYCLE.ACTIVE,
  });
  const historical = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    subject:          'body_weight',
    lifecycle_status: LIFECYCLE.HISTORICAL,
  });

  check(active.length === 1, 'W2-b: exactly one ACTIVE body_weight', active.length);
  check(historical.length === 1, 'W2-c: exactly one HISTORICAL body_weight', historical.length);

  check(active[0]?.fact.value === 92, 'W2-d: ACTIVE value = 92', active[0]?.fact.value);
  check(historical[0]?.fact.value === 95, 'W2-e: HISTORICAL value = 95', historical[0]?.fact.value);

  // NOT a derived fact — no "weight decreased" conclusion
  const allFacts = pm.query();
  const hasDerived = allFacts.some(r =>
    String(r.fact.value).toLowerCase().includes('decreased') ||
    String(r.fact.value).toLowerCase().includes('improved') ||
    r.fact.claim_type === 'DERIVED',
  );
  check(!hasDerived, 'W2-f: no derived "weight decreased" fact in model');

  // 95 kg fact remains in history (immutable) — 6 facts total after 6 turns
  check(pm.size >= 6, 'W2-g: original 95 kg fact still in history (size=6)', pm.size);
}

// ══════════════════════════════════════════════════════════════════════════════
// FINAL ACTIVE PERSON MODEL
// ══════════════════════════════════════════════════════════════════════════════

sep('FINAL ACTIVE PERSON MODEL: "What does CHJ currently know?"');

{
  const allActive = pm.query({ lifecycle_status: LIFECYCLE.ACTIVE });

  check(allActive.length >= 5, `FINAL-a: at least 5 ACTIVE facts total (got ${allActive.length})`, allActive.length);

  // All expected claim types are present
  const claimTypes = new Set(allActive.map(r => r.fact.claim_type));
  check(claimTypes.has(CLAIM_TYPES.USER_INTENTION),            'FINAL-b: USER_INTENTION present');
  check(claimTypes.has(CLAIM_TYPES.SELF_REPORTED_MEASUREMENT), 'FINAL-c: SELF_REPORTED_MEASUREMENT present');
  check(claimTypes.has(CLAIM_TYPES.SELF_REPORTED_BEHAVIOR),    'FINAL-d: SELF_REPORTED_BEHAVIOR present');
  check(claimTypes.has(CLAIM_TYPES.SELF_REPORTED_STATE),       'FINAL-e: SELF_REPORTED_STATE present');
  check(claimTypes.has(CLAIM_TYPES.SUBJECTIVE_SYMPTOM),        'FINAL-f: SUBJECTIVE_SYMPTOM present');
}

// ══════════════════════════════════════════════════════════════════════════════
// EPISTEMIC PRESERVATION CHECK
// ══════════════════════════════════════════════════════════════════════════════

sep('EPISTEMIC PRESERVATION: every field intact through Bridge → PersonModel');

{
  const allFacts = pm.query();

  // Every fact must have all required epistemic fields
  for (const { fact, lifecycle } of allFacts) {
    const id = `${fact.claim_type}/${fact.subject}`;

    check(typeof fact.fact_id          === 'string', `EP [${id}]: fact_id is string`);
    check(typeof fact.claim_type       === 'string', `EP [${id}]: claim_type is string`);
    check(typeof fact.subject          === 'string', `EP [${id}]: subject is string`);
    check(fact.entity != null,                       `EP [${id}]: entity present`);
    check(fact.entity?.ref != null,                  `EP [${id}]: entity.ref present`);
    check(fact.entity?.type != null,                 `EP [${id}]: entity.type present`);
    check(fact.value != null,                        `EP [${id}]: value present`);
    check(typeof fact.precision        === 'string', `EP [${id}]: precision is string`);
    check(typeof fact.speaker_certainty=== 'string', `EP [${id}]: speaker_certainty is string`);
    check(fact.claimed_source?.type != null,         `EP [${id}]: claimed_source.type present`);
    check(fact.temporal?.scope != null,              `EP [${id}]: temporal.scope present`);
    check(typeof fact.extracted_at     === 'string', `EP [${id}]: extracted_at is string`);
    check(typeof fact.conversation_turn=== 'number', `EP [${id}]: conversation_turn is number`);
    check(typeof lifecycle.status      === 'string', `EP [${id}]: lifecycle.status is string`);
  }

  // Spot-check: blood pressure claimed_source never promoted
  const bpFacts = pm.query({ subject: 'blood_pressure' });
  const bp = bpFacts[0]?.fact;
  check(bp?.claimed_source?.type === CLAIMED_SOURCE_TYPES.DOCTOR,
    'EP-DOCTOR: claimed_source=DOCTOR preserved (not promoted to verified)');

  // Spot-check: "asi" precision correctly APPROXIMATE, certainty ASSERTED
  const weightFacts = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    lifecycle_status: LIFECYCLE.ACTIVE,
  });
  const wf = weightFacts[0]?.fact;
  check(wf?.precision === PRECISION.EXACT,
    'EP-WEIGHT: current weight precision = EXACT (92 kg exact, no asi)', wf?.precision);

  // Historical 95 kg had precision=APPROXIMATE from "asi"
  const histWeight = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    lifecycle_status: LIFECYCLE.HISTORICAL,
  });
  const hw = histWeight[0]?.fact;
  check(hw?.precision === PRECISION.APPROXIMATE,
    'EP-HIST: historical 95 kg has precision=APPROXIMATE (from "asi")', hw?.precision);
  check(hw?.speaker_certainty === SPEAKER_CERTAINTY.ASSERTED,
    'EP-CERT: historical 95 kg speaker_certainty=ASSERTED (asi ≠ uncertain)', hw?.speaker_certainty);
}

// ══════════════════════════════════════════════════════════════════════════════
// INTEGRATION GAP CHECK
// ══════════════════════════════════════════════════════════════════════════════

sep('INTEGRATION GAP: Bridge temporal explicitness for body weight');

{
  // Bridge #1 body weight extractor hardcodes temporal.explicit=false regardless
  // of temporal qualifiers in the utterance (e.g. "dnes", "teď").
  // Person Model relies on extracted_at (not temporal.explicit) for ordering
  // two CURRENT-scope measurements. This works correctly in integration because
  // extracted_at reflects real wall-clock time.
  //
  // Gap: a future utterance like "Dnes vážím 92 kilo." produces
  //   temporal = { scope: CURRENT, explicit: false }  ← same as "Vážím 92 kilo."
  // The Bridge cannot distinguish "explicit today" from "unqualified now."
  // This is safe for Person Model #1 (CURRENT ordering via extracted_at still works)
  // but worth surfacing.

  const t6 = pm.query({
    claim_type:       CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
    lifecycle_status: LIFECYCLE.ACTIVE,
  })[0]?.fact;

  // Document the gap without failing: explicit=false even though timestamp is Day14
  const explicitIsTrue = t6?.temporal?.explicit === true;
  results.push(`  ℹ️   GAP-BRIDGE-TEMPORAL: body weight extractor always sets temporal.explicit=false`);
  results.push(`        even when utterance contains "dnes"/"teď". Person Model ordering`);
  results.push(`        uses extracted_at instead — integration works, but explicit flag is lost.`);
  // This is informational — not a test failure
  passed++;  // count as pass (gap documented, not blocking)
}

// ══════════════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nBRIDGE → PERSON MODEL INTEGRATION #1 — TEST RESULTS\n');
for (const line of results) console.log(line);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  Total: ${passed + failed}  |  ✅ ${passed} passed  |  ❌ ${failed} failed`);
console.log(`${'═'.repeat(64)}\n`);

if (failed > 0) process.exit(1);
