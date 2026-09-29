// test-safety-cv-joint-priority.mjs — Safety Gate: CV risk must not mask a more restrictive joint constraint
//
// Root cause (reproduced): evaluateSafetyGate returned the CV rule (confirmed CV risk + non-HIIT
// SILOVY_PROTOKOL → SAFE_WITH_MODIFICATION) before the constraint × intensity grid ran.
// A severe knee / hip / lower-back constraint on a region the action loads therefore produced
// SAFE_WITH_MODIFICATION (viable → ACT) instead of NEEDS_CLINICAL_CLEARANCE — but only for
// people with confirmed CV risk. Without CV risk the same constraint was correctly blocked.
//
// Fix: the CV rule evaluates the joint grid too and returns the joint result only when it is
// strictly more restrictive. Every other output stays byte-identical to the previous behavior.
//
// Sections (no DB, no network — real nextBestAction / dailyDecision / intervention-map):
//   J1  HT + severe knee, SILOVY action loading the knee          → NEEDS_CLINICAL_CLEARANCE (was SWM)
//   J2  HT + severe lower back, shoulder_press_light (real row)   → NEEDS_CLINICAL_CLEARANCE (was SWM)
//   J3  HT + severe knee, sole candidate → DAILY_DECISION          → SAFETY_BLOCKED (was ACT)
//   J4  HT + moderate knee                                         → CV result unchanged
//   J5  HT + mild knee                                             → CV result unchanged
//   J6  HT, no constraints                                         → CV result unchanged
//   J7  HT + severe knee, action not loading the knee              → CV result unchanged
//   J8  no CV risk + severe / moderate / mild knee                 → joint grid unchanged
//   J9  HT + severe knee, non-SILOVY action (KARDIO)                → joint grid unchanged
//   J10 HT + HIIT SILOVY action                                    → NEEDS_CLINICAL_CLEARANCE (rule 2) unchanged
//   J11 HT + knee constraint_exclude                               → CONTRAINDICATED (rule 1) unchanged
//   J12 HT + unknown knee severity                                 → NEEDS_MORE_EVIDENCE (rule 4) unchanged
//
// Second defect (same grid): the joint grid returned the result of the FIRST loaded constraint,
// not the most restrictive one — input order decided the safety level. Fix: the grid evaluates
// every loaded constraint and returns the most restrictive result (SAFETY_RANK); on equal level
// the first result is kept, so today's text priority stays deterministic.
//   J13 HT + mild knee, then severe hip                             → NEEDS_CLINICAL_CLEARANCE
//   J14 HT + severe hip, then mild knee                             → NEEDS_CLINICAL_CLEARANCE
//   J15 no CV risk + mild knee / severe hip, both orders            → NEEDS_CLINICAL_CLEARANCE
//   J16 two equally severe constraints                              → first result kept (stable)
//   J17 non-loaded constraint before a loaded one                   → the loaded constraint's result
//
// Run: node scripts/test-safety-cv-joint-priority.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { computeDailyDecision }  from '../api/engine/dailyDecision.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const IMAP = JSON.parse(readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8'));
const INTERVENTIONS = IMAP.mappings.PHYSICAL_INACTIVITY.interventions;

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// ── Fixtures ──────────────────────────────────────────────────────────────────
const A = (id, protocol_type, tags, constraint_exclude, intensity, extra = {}) =>
  ({ id, label: id, protocol_type, type: 'reps', duration: null, reps: 10, tier: 1, tags, constraint_exclude, intensity, ...extra });

// Mirrors of real longevity_actions rows (SELECT, 2026-09-29) + one fixture loading the legs.
const SHOULDER_PRESS_LIGHT = A('shoulder_press_light', 'SILOVY_PROTOKOL', ['sila', 'ramena', 'overhead_press', 'dekatlon'], ['shoulder', 'elbow'], 'LIGHT');
const STEP_DOWN            = A('step_down', 'SILOVY_PROTOKOL', ['sila', 'plyometrie', 'kosti', 'dopad', 'dekatlon'], ['knee', 'ankle_foot'], 'MODERATE');
const JUMP_SQUAT           = A('jump_squat', 'SILOVY_PROTOKOL', ['sila', 'plyometrie', 'kosti', 'dopad', 'dekatlon'], ['knee', 'ankle_foot'], 'HIGH_INTENSITY_INTERVAL', { reps: 8, tier: 2 });
const LEGS_SILOVY          = A('legs_silovy', 'SILOVY_PROTOKOL', ['sila', 'nohy'], [], 'LIGHT', { reps: 5 });
const KARDIO               = A('kardio', 'KARDIO_PROTOKOL', [], [], 'MODERATE', { type: 'timed', duration: 1200, reps: null });

const CV_GATE = { context_gates: [{
  decision_context: { id: 'CURRENT_CV_STATE' }, status: 'EVIDENCE_SUFFICIENT',
  actionable_findings: [{ entity_id: 'HYPERTENSION', actionability: 'RISK_RELEVANT' }],
}] };
const NO_CV_GATE = { context_gates: [] };

const constraint = (location, severity) =>
  ({ constraint_type: 'injury', constraint_key: 'test', constraint_value: { location }, severity });

// Expected outputs of the rules as they behaved before the fix (must stay identical where not stricter).
const CV_RESULT = {
  level: 'SAFE_WITH_MODIFICATION',
  reason: 'Resistance training with confirmed cardiovascular risk. Safe with blood pressure monitoring and no Valsalva maneuver.',
  modifications_suggested: [
    'Monitor blood pressure before and after',
    'Avoid Valsalva (breath-holding during exertion)',
    'Stop if chest pain, severe dyspnea, or dizziness',
  ],
};
const gridResult = (severity, key, intensity) => {
  if (severity === 'severe') return {
    level: 'NEEDS_CLINICAL_CLEARANCE',
    reason: `severe constraint on "${key}" — this modality loads the region at ${intensity} intensity.`,
    modifications_suggested: ['Obtain physician or physiotherapist clearance before any loading of this region'],
  };
  if (severity === 'moderate') return {
    level: 'SAFE_WITH_MODIFICATION',
    reason: `moderate constraint on "${key}" — this modality loads the region at ${intensity} intensity.`,
    modifications_suggested: ['Consult physiotherapist first', 'Avoid high-impact variants', 'Stop immediately if pain increases'],
  };
  return {
    level: 'SAFE',
    reason: `mild constraint on "${key}" — this modality loads the region at ${intensity} intensity.`,
    modifications_suggested: ['Prefer low-impact variant (e.g. cycling over running)', 'Stop if discomfort increases'],
  };
};

function nba(pool, { cv = false, constraints = [] } = {}) {
  return computeNextBestAction({
    leverageNodeId: 'PHYSICAL_INACTIVITY',
    interventions: INTERVENTIONS,
    actionPool: pool,
    personConstraints: constraints,
    clinicalHistory: { clinical_history_documented: true, onboarding_inputs: {} },
    decisionGate: cv ? CV_GATE : NO_CV_GATE,
    node_states: [],
    engineVersion: 'test',
    responseHistory: [],
    skippedTodayActionIds: new Set(),
  });
}
function safetyOf(action, opts) {
  return nba([action], opts).all_candidates.find(c => c.action_id === action.id)?.safety;
}
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const show = s => JSON.stringify(s);

// ── J1–J3: the reproduced bug ─────────────────────────────────────────────────
sep('J1 — HT + severe knee, SILOVY action loading the knee → NEEDS_CLINICAL_CLEARANCE');
{
  const s = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('koleno', 'severe')] });
  check(s?.level === 'NEEDS_CLINICAL_CLEARANCE', 'J1: level = NEEDS_CLINICAL_CLEARANCE (not masked by CV rule)', `actual: ${s?.level}`);
  check(same(s, gridResult('severe', 'knee', 'LIGHT')), 'J1: identical to the joint result a person without CV risk gets', `actual: ${show(s)}`);
}

sep('J2 — HT + severe lower back, shoulder_press_light (real row, tag sila → lower_back)');
{
  const s = safetyOf(SHOULDER_PRESS_LIGHT, { cv: true, constraints: [constraint('záda', 'severe')] });
  check(s?.level === 'NEEDS_CLINICAL_CLEARANCE', 'J2: level = NEEDS_CLINICAL_CLEARANCE', `actual: ${s?.level}`);
  check(same(s, gridResult('severe', 'lower_back', 'LIGHT')), 'J2: joint result returned unchanged', `actual: ${show(s)}`);
}

sep('J3 — HT + severe knee, sole candidate → DAILY_DECISION = SAFETY_BLOCKED');
{
  const next_best_action = nba([LEGS_SILOVY], { cv: true, constraints: [constraint('koleno', 'severe')] });
  const dd = computeDailyDecision({ decision_gate: CV_GATE, next_best_action, response_evaluations: [], intervention_exposure: [] },
    '2026-06-15T12:00:00.000Z');
  check(next_best_action.selected === null, 'J3: NBA selects nothing (no viable candidate)', `actual: ${next_best_action.selected?.action_id}`);
  check(dd.mode === 'SAFETY' && dd.reason_code === 'SAFETY_BLOCKED', 'J3: mode = SAFETY / SAFETY_BLOCKED (was ACT)', `actual: ${dd.mode}/${dd.reason_code}`);
  check(dd.primary_item?.worst_safety_level === 'NEEDS_CLINICAL_CLEARANCE', 'J3: worst_safety_level = NEEDS_CLINICAL_CLEARANCE');
}

// ── J4–J7: CV result unchanged where the joint is not more restrictive ───────
sep('J4 — HT + moderate knee → CV result unchanged');
{
  const s = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('koleno', 'moderate')] });
  check(same(s, CV_RESULT), 'J4: exactly the previous CV result (level, reason, modifications)', `actual: ${show(s)}`);
}

sep('J5 — HT + mild knee → CV result unchanged');
{
  const s = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('koleno', 'mild')] });
  check(same(s, CV_RESULT), 'J5: exactly the previous CV result', `actual: ${show(s)}`);
}

sep('J6 — HT, no constraints → CV result unchanged');
{
  for (const action of [LEGS_SILOVY, SHOULDER_PRESS_LIGHT, STEP_DOWN]) {
    const s = safetyOf(action, { cv: true });
    check(same(s, CV_RESULT), `J6: ${action.id} → previous CV result`, `actual: ${show(s)}`);
  }
}

sep('J7 — HT + severe knee, action that does not load the knee → CV result unchanged');
{
  const s = safetyOf(SHOULDER_PRESS_LIGHT, { cv: true, constraints: [constraint('koleno', 'severe')] });
  check(same(s, CV_RESULT), 'J7: shoulder_press_light (loads lower_back only) → previous CV result', `actual: ${show(s)}`);
}

// ── J8–J12: paths outside the CV rule stay unchanged ─────────────────────────
sep('J8 — no CV risk → joint grid unchanged');
{
  for (const sev of ['severe', 'moderate', 'mild']) {
    const s = safetyOf(LEGS_SILOVY, { cv: false, constraints: [constraint('koleno', sev)] });
    check(same(s, gridResult(sev, 'knee', 'LIGHT')), `J8: ${sev} knee → previous grid result`, `actual: ${show(s)}`);
  }
  const none = safetyOf(LEGS_SILOVY, { cv: false });
  check(none?.level === 'SAFE' && none.modifications_suggested.length === 0, 'J8: no constraints → SAFE', `actual: ${show(none)}`);
}

sep('J9 — HT + severe knee, non-SILOVY action (KARDIO_PROTOKOL) → joint grid unchanged');
{
  const s = safetyOf(KARDIO, { cv: true, constraints: [constraint('koleno', 'severe')] });
  check(same(s, gridResult('severe', 'knee', 'MODERATE')), 'J9: KARDIO → previous grid result (CV rule does not apply)', `actual: ${show(s)}`);
}

sep('J10 — HT + HIIT SILOVY action → rule 2 unchanged');
{
  const s = safetyOf(JUMP_SQUAT, { cv: true, constraints: [constraint('rameno', 'severe')] });
  check(s?.level === 'NEEDS_CLINICAL_CLEARANCE' && s.reason.startsWith('HIGH_INTENSITY_INTERVAL intensity with confirmed cardiovascular risk'),
    'J10: jump_squat → NEEDS_CLINICAL_CLEARANCE from the HIIT + CV rule', `actual: ${show(s)}`);
}

sep('J11 — HT + knee in constraint_exclude → rule 1 unchanged');
{
  const s = safetyOf(STEP_DOWN, { cv: true, constraints: [constraint('koleno', 'mild')] });
  check(s?.level === 'CONTRAINDICATED', 'J11: step_down → CONTRAINDICATED', `actual: ${show(s)}`);
}

sep('J12 — HT + unknown knee severity → rule 4 unchanged');
{
  const s = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('koleno', null)] });
  check(s?.level === 'NEEDS_MORE_EVIDENCE', 'J12: NEEDS_MORE_EVIDENCE (severity question)', `actual: ${show(s)}`);
}

// ── J13–J17: most restrictive joint constraint, independent of input order ───
sep('J13 — HT + mild knee first, severe hip second → NEEDS_CLINICAL_CLEARANCE');
{
  const s = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('koleno', 'mild'), constraint('kyčel', 'severe')] });
  check(same(s, gridResult('severe', 'hip', 'LIGHT')), 'J13: severe hip result (not masked by mild knee or CV rule)', `actual: ${show(s)}`);
}

sep('J14 — HT + severe hip first, mild knee second → NEEDS_CLINICAL_CLEARANCE');
{
  const s = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('kyčel', 'severe'), constraint('koleno', 'mild')] });
  check(same(s, gridResult('severe', 'hip', 'LIGHT')), 'J14: severe hip result', `actual: ${show(s)}`);
}

sep('J15 — no CV risk + mild knee / severe hip, both orders → NEEDS_CLINICAL_CLEARANCE');
{
  const a = safetyOf(LEGS_SILOVY, { cv: false, constraints: [constraint('koleno', 'mild'), constraint('kyčel', 'severe')] });
  const b = safetyOf(LEGS_SILOVY, { cv: false, constraints: [constraint('kyčel', 'severe'), constraint('koleno', 'mild')] });
  check(same(a, gridResult('severe', 'hip', 'LIGHT')), 'J15: mild knee first → severe hip result', `actual: ${show(a)}`);
  check(same(b, gridResult('severe', 'hip', 'LIGHT')), 'J15: severe hip first → severe hip result', `actual: ${show(b)}`);
  const k = safetyOf(KARDIO, { cv: false, constraints: [constraint('kotník', 'mild'), constraint('koleno', 'severe')] });
  check(same(k, gridResult('severe', 'knee', 'MODERATE')), 'J15: KARDIO mild ankle first → severe knee result', `actual: ${show(k)}`);
}

sep('J16 — two equally severe constraints → first result kept (stable)');
{
  const kh = safetyOf(LEGS_SILOVY, { cv: false, constraints: [constraint('koleno', 'moderate'), constraint('kyčel', 'moderate')] });
  const hk = safetyOf(LEGS_SILOVY, { cv: false, constraints: [constraint('kyčel', 'moderate'), constraint('koleno', 'moderate')] });
  check(same(kh, gridResult('moderate', 'knee', 'LIGHT')), 'J16: moderate knee, moderate hip → knee result (first)', `actual: ${show(kh)}`);
  check(same(hk, gridResult('moderate', 'hip', 'LIGHT')), 'J16: moderate hip, moderate knee → hip result (first)', `actual: ${show(hk)}`);
  const ss = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('koleno', 'severe'), constraint('kyčel', 'severe')] });
  check(same(ss, gridResult('severe', 'knee', 'LIGHT')), 'J16: HT + severe knee, severe hip → knee result (first)', `actual: ${show(ss)}`);
}

sep('J17 — non-loaded constraint before a loaded one → loaded constraint result');
{
  const s = safetyOf(LEGS_SILOVY, { cv: false, constraints: [constraint('rameno', 'severe'), constraint('koleno', 'moderate')] });
  check(same(s, gridResult('moderate', 'knee', 'LIGHT')), 'J17: severe shoulder (not loaded) ignored → moderate knee result', `actual: ${show(s)}`);
  const cv = safetyOf(LEGS_SILOVY, { cv: true, constraints: [constraint('rameno', 'severe'), constraint('koleno', 'mild')] });
  check(same(cv, CV_RESULT), 'J17: HT + severe shoulder (not loaded) + mild knee → CV result unchanged', `actual: ${show(cv)}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-safety-cv-joint-priority: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
