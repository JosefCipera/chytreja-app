// test-functional-strength-training.mjs — C3: LOW_MUSCLE_STRENGTH → FUNCTIONAL_STRENGTH_TRAINING
//
// Verifies the new intervention-map.json entry wires the supported sit-to-stand action
// (sit_to_stand_supported, protocol_type FUNKCNI_SILOVY_PROTOKOL) to LOW_MUSCLE_STRENGTH,
// in isolation from PHYSICAL_INACTIVITY's and EXCESS_ADIPOSITY's own RESISTANCE_TRAINING
// mapping (protocol_types: ["SILOVY_PROTOKOL"], no tag_filter — a distinct protocol_type is
// what actually prevents the candidate-pool leak found in the previous cut; tag_filter is
// defense-in-depth, not the isolation mechanism), and confirms the existing joint Safety Gate
// and CV-risk modification apply identically to FUNKCNI_SILOVY_PROTOKOL as they do to
// SILOVY_PROTOKOL (via SILOVY_PROTOKOL_FAMILY in nextBestAction.js — no new mechanism).
//
// No DB, no network — real nextBestAction.js / dailyDecision.js / intervention-map.json.
//
// Sections:
//   F1  no constraints                                    → SAFE, sit_to_stand_supported selected
//   F2  decoy SILOVY_PROTOKOL actions (press/plyometric)   → excluded (different protocol_type)
//   F3  severe knee constraint                             → NEEDS_CLINICAL_CLEARANCE (grid, not hard exclude)
//   F4  moderate knee constraint                            → SAFE_WITH_MODIFICATION
//   F5  mild knee constraint (LIGHT intensity)               → SAFE (mild + non-high-intensity)
//   F6  DAILY_DECISION: F1 fixture                          → mode=ACT, reason_code=ACT_READY
//   F7  DAILY_DECISION: F3 fixture, sole candidate          → mode=SAFETY, reason_code=SAFETY_BLOCKED
//   F8  CV risk + FUNKCNI_SILOVY_PROTOKOL, non-HIIT         → SAFE_WITH_MODIFICATION (parity with SILOVY_PROTOKOL)
//   F9  isolation: sit_to_stand_supported is a candidate ONLY under LOW_MUSCLE_STRENGTH's
//       own mapping — NOT under PHYSICAL_INACTIVITY's or EXCESS_ADIPOSITY's real
//       RESISTANCE_TRAINING mapping (the leak this cut closes)
//
// Run: node scripts/test-functional-strength-training.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { computeDailyDecision }  from '../api/engine/dailyDecision.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const IMAP = JSON.parse(readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8'));
const INTERVENTIONS = IMAP.mappings.LOW_MUSCLE_STRENGTH.interventions;

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// ── Fixtures ──────────────────────────────────────────────────────────────────
const A = (id, label, tags, extra = {}) =>
  ({ id, label, protocol_type: 'SILOVY_PROTOKOL', type: 'reps', duration: null, reps: 5, tier: 1,
     tags, constraint_exclude: [], intensity: 'LIGHT', ...extra });

// Mirrors the real, migrated row (2026-09-29 sit_to_stand_supported, protocol_type
// FUNKCNI_SILOVY_PROTOKOL as of the C3 isolation fix).
const SIT_TO_STAND = A('sit_to_stand_supported',
  'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči',
  ['sila', 'nohy', 'sit_to_stand'], { protocol_type: 'FUNKCNI_SILOVY_PROTOKOL' });

// Real, existing SILOVY_PROTOKOL rows (2026-09-29 SELECT) — decoys proving tag_filter isolation.
const SHOULDER_PRESS_LIGHT = A('shoulder_press_light', 'Tlak nad hlavu — lehký (5 kg)',
  ['sila', 'ramena', 'overhead_press', 'dekatlon'], { constraint_exclude: ['shoulder', 'elbow'] });
const STEP_DOWN = A('step_down', 'Kontrolovaný sestup z bedny — 1 noha',
  ['sila', 'plyometrie', 'kosti', 'dopad', 'dekatlon'],
  { reps: 10, intensity: 'MODERATE', constraint_exclude: ['knee', 'ankle_foot'] });
const JUMP_SQUAT = A('jump_squat', 'Dřep s výskokem',
  ['sila', 'plyometrie', 'kosti', 'dopad', 'dekatlon'],
  { reps: 8, tier: 2, intensity: 'HIGH_INTENSITY_INTERVAL', constraint_exclude: ['knee', 'ankle_foot'] });

const constraint = (location, severity) =>
  ({ constraint_type: 'injury', constraint_key: 'test', constraint_value: { location }, severity });

function nba(pool, { constraints = [] } = {}) {
  return computeNextBestAction({
    leverageNodeId: 'LOW_MUSCLE_STRENGTH',
    interventions: INTERVENTIONS,
    actionPool: pool,
    personConstraints: constraints,
    clinicalHistory: { clinical_history_documented: true, onboarding_inputs: {} },
    decisionGate: { context_gates: [] },
    node_states: [],
    engineVersion: 'test',
    responseHistory: [],
    skippedTodayActionIds: new Set(),
  });
}

const POOL = [SIT_TO_STAND, SHOULDER_PRESS_LIGHT, STEP_DOWN, JUMP_SQUAT];

// ── F1 ────────────────────────────────────────────────────────────────────────
sep('F1 — no constraints → sit_to_stand_supported selected, SAFE');
let f1;
{
  f1 = nba(POOL);
  check(f1.status === 'SELECTED', 'F1: NBA.status = SELECTED', `actual: ${f1.status}`);
  check(f1.selected?.action_id === 'sit_to_stand_supported', 'F1: selected action_id = sit_to_stand_supported',
    `actual: ${f1.selected?.action_id}`);
  check(f1.selected?.intervention_id === 'FUNCTIONAL_STRENGTH_TRAINING',
    'F1: intervention_id = FUNCTIONAL_STRENGTH_TRAINING', `actual: ${f1.selected?.intervention_id}`);
  check(f1.selected?.safety?.level === 'SAFE', 'F1: safety.level = SAFE', `actual: ${f1.selected?.safety?.level}`);
}

// ── F2 ────────────────────────────────────────────────────────────────────────
sep('F2 — decoy SILOVY_PROTOKOL actions excluded (different protocol_type)');
{
  const ids = f1.all_candidates.map(c => c.action_id);
  check(ids.length === 1 && ids[0] === 'sit_to_stand_supported',
    'F2: only sit_to_stand_supported is a candidate — SILOVY_PROTOKOL press/plyometric rows excluded ' +
    '(FUNCTIONAL_STRENGTH_TRAINING declares protocol_types: [FUNKCNI_SILOVY_PROTOKOL] only)',
    `actual candidates: ${JSON.stringify(ids)}`);
}

// ── F3 ────────────────────────────────────────────────────────────────────────
sep('F3 — severe knee constraint → NEEDS_CLINICAL_CLEARANCE (grid, not hard exclude)');
{
  const s = nba([SIT_TO_STAND], { constraints: [constraint('koleno', 'severe')] })
    .all_candidates.find(c => c.action_id === 'sit_to_stand_supported')?.safety;
  check(s?.level === 'NEEDS_CLINICAL_CLEARANCE', 'F3: severe knee → NEEDS_CLINICAL_CLEARANCE',
    `actual: ${s?.level}`);
  check(s?.level !== 'CONTRAINDICATED', 'F3: not CONTRAINDICATED (constraint_exclude is empty by design)');
}

// ── F4 ────────────────────────────────────────────────────────────────────────
sep('F4 — moderate knee constraint → SAFE_WITH_MODIFICATION');
{
  const s = nba([SIT_TO_STAND], { constraints: [constraint('koleno', 'moderate')] })
    .all_candidates.find(c => c.action_id === 'sit_to_stand_supported')?.safety;
  check(s?.level === 'SAFE_WITH_MODIFICATION', 'F4: moderate knee → SAFE_WITH_MODIFICATION',
    `actual: ${s?.level}`);
}

// ── F5 ────────────────────────────────────────────────────────────────────────
sep('F5 — mild knee constraint, LIGHT intensity → SAFE (mild + non-high-intensity)');
{
  const s = nba([SIT_TO_STAND], { constraints: [constraint('koleno', 'mild')] })
    .all_candidates.find(c => c.action_id === 'sit_to_stand_supported')?.safety;
  check(s?.level === 'SAFE', 'F5: mild knee + LIGHT intensity → SAFE', `actual: ${s?.level}`);
}

// ── F6 ────────────────────────────────────────────────────────────────────────
sep('F6 — DAILY_DECISION: F1 fixture → mode=ACT, reason_code=ACT_READY');
{
  const dd = computeDailyDecision(
    { decision_gate: { context_gates: [] }, next_best_action: f1, response_evaluations: [], intervention_exposure: [] },
    '2026-09-29T12:00:00.000Z'
  );
  check(dd.mode === 'ACT' && dd.reason_code === 'ACT_READY', 'F6: mode=ACT, reason_code=ACT_READY',
    `actual: ${dd.mode}/${dd.reason_code}`);
  check(dd.primary_item?.action_id === 'sit_to_stand_supported', 'F6: primary_item = sit_to_stand_supported');
  check(dd.primary_item?.label?.includes('Vstaň 5×'), 'F6: primary_item.label carries the full safety instruction',
    `actual: ${dd.primary_item?.label}`);
}

// ── F7 ────────────────────────────────────────────────────────────────────────
sep('F7 — severe knee, sole candidate → DAILY_DECISION = SAFETY_BLOCKED');
{
  const next_best_action = nba([SIT_TO_STAND], { constraints: [constraint('koleno', 'severe')] });
  const dd = computeDailyDecision(
    { decision_gate: { context_gates: [] }, next_best_action, response_evaluations: [], intervention_exposure: [] },
    '2026-09-29T12:00:00.000Z'
  );
  check(next_best_action.selected === null, 'F7: NBA selects nothing (no viable candidate)',
    `actual: ${next_best_action.selected?.action_id}`);
  check(dd.mode === 'SAFETY' && dd.reason_code === 'SAFETY_BLOCKED',
    'F7: mode=SAFETY, reason_code=SAFETY_BLOCKED', `actual: ${dd.mode}/${dd.reason_code}`);
}

// ── F8 ────────────────────────────────────────────────────────────────────────
// CV-risk modification (evaluateSafetyGate rule 8) checks SILOVY_PROTOKOL_FAMILY.has(protocol_type),
// not a literal 'SILOVY_PROTOKOL' string — FUNKCNI_SILOVY_PROTOKOL must get the same protection.
sep('F8 — CV risk + FUNKCNI_SILOVY_PROTOKOL, non-HIIT → SAFE_WITH_MODIFICATION (parity with SILOVY_PROTOKOL)');
{
  const result = computeNextBestAction({
    leverageNodeId: 'LOW_MUSCLE_STRENGTH',
    interventions: INTERVENTIONS,
    actionPool: [SIT_TO_STAND],
    personConstraints: [],
    clinicalHistory: { clinical_history_documented: true, onboarding_inputs: {} },
    decisionGate: { context_gates: [{
      decision_context: { id: 'CURRENT_CV_STATE' }, status: 'EVIDENCE_SUFFICIENT',
      actionable_findings: [{ entity_id: 'HYPERTENSION', actionability: 'RISK_RELEVANT' }],
    }] },
    node_states: [],
    engineVersion: 'test',
    responseHistory: [],
    skippedTodayActionIds: new Set(),
  });
  const s = result.all_candidates.find(c => c.action_id === 'sit_to_stand_supported')?.safety;
  check(s?.level === 'SAFE_WITH_MODIFICATION', 'F8: CV risk → SAFE_WITH_MODIFICATION (rule 8 applies)',
    `actual: ${s?.level}`);
  check((s?.modifications_suggested ?? []).includes('Monitor blood pressure before and after'),
    'F8: carries the same CV modifications as any other SILOVY_PROTOKOL_FAMILY action',
    `actual: ${JSON.stringify(s?.modifications_suggested)}`);
}

// ── F9 ────────────────────────────────────────────────────────────────────────
// The leak this cut closes: PHYSICAL_INACTIVITY's and EXCESS_ADIPOSITY's own RESISTANCE_TRAINING
// entries (real intervention-map.json, protocol_types: ["SILOVY_PROTOKOL"], no tag_filter) must
// NOT pick up sit_to_stand_supported (protocol_type FUNKCNI_SILOVY_PROTOKOL).
sep('F9 — isolation: sit_to_stand_supported is a candidate only under LOW_MUSCLE_STRENGTH');
{
  for (const leverageNodeId of ['PHYSICAL_INACTIVITY', 'EXCESS_ADIPOSITY']) {
    const otherInterventions = IMAP.mappings[leverageNodeId].interventions;
    const result = computeNextBestAction({
      leverageNodeId,
      interventions: otherInterventions,
      actionPool: [SIT_TO_STAND],
      personConstraints: [],
      clinicalHistory: { clinical_history_documented: true, onboarding_inputs: {} },
      decisionGate: { context_gates: [] },
      node_states: [],
      engineVersion: 'test',
      responseHistory: [],
      skippedTodayActionIds: new Set(),
    });
    check(result.status === 'NO_CANDIDATES',
      `F9: ${leverageNodeId}'s own mapping does NOT offer sit_to_stand_supported`,
      `actual status: ${result.status}, candidates: ${JSON.stringify(result.all_candidates ?? [])}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-functional-strength-training: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
