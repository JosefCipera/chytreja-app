// scripts/test-system-constraint-readiness.mjs
// System Constraint Readiness #1 — Test Suite
//
// Covers:
//   T1–T12  — Functional contract tests
//   P1–P5   — Parity / mutation tests
//   ORACLE  — Parity oracle: readiness materiality prediction vs actual
//             computeSystemConstraint() outcome with B resolved to CONFIRMED.
//
// Run: node scripts/test-system-constraint-readiness.mjs
//
// No API key required, no HTTP calls, no Supabase.

import {
  evaluateSystemConstraintReadiness,
  buildCausalGraph,
  computeGoalPath,
  buildConfirmedProfile,
  compareToWinner,
  MASTER,
} from '../api/lib/constraintReadiness/systemConstraintReadiness.js';

import { computeSystemConstraint } from '../api/engine/systemConstraint.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ─────────────────────────────────────────────`);
}

// ── Test data factories ────────────────────────────────────────────────────────

// Minimal decisionGate — no safety override, no blocking uncertainties.
const GATE_CLEAN = { context_gates: [] };

function makeState(node_id, current_state, confidence = 'medium', overrides = {}) {
  return {
    node_id,
    current_state,
    confidence,
    evidence: { direct: [], supporting: [], inferred_from_nodes: [] },
    missing_evidence: [],
    ...overrides,
  };
}

// Minimal systemConstraint result scaffolds for tests that don't need the full Engine.

function makeIdentified(node_id, current_state, confidence, scores) {
  return {
    status:   'IDENTIFIED',
    selected: { node_id, current_state, confidence, ...scores },
    finalists: [],
  };
}

function makeInsufficientModel() {
  return { status: 'INSUFFICIENT_MODEL', selected: null, finalists: [] };
}

function makeInsufficientEvidence(finalists) {
  return { status: 'INSUFFICIENT_EVIDENCE', selected: null, finalists };
}

function makeSafetyOverride() {
  return { status: 'SAFETY_OVERRIDE', selected: null, finalists: [] };
}

// ── T1: basic READY ────────────────────────────────────────────────────────────
section('T1: basic READY — MEASURED winner, no material UNKNOWN');
{
  // Winner: EXCESS_ADIPOSITY MEASURED medium (has Goal path to CARDIOVASCULAR_DISEASE).
  // evidence_quality = 'medium' (MEASURED). No UNKNOWN nodes.
  const nodeStates = [makeState('EXCESS_ADIPOSITY', 'MEASURED', 'medium')];
  const scResult   = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED', 'T1-pre: systemConstraint returns IDENTIFIED');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  assert(r.decision_type === 'SYSTEM_CONSTRAINT_SELECTION', 'T1-a: decision_type correct');
  assert(r.status === 'READY',                              'T1-b: status READY');
  assert(Array.isArray(r.unmet_requirements),               'T1-c: unmet_requirements is array');
  assert(r.unmet_requirements.length === 0,                 'T1-d: unmet_requirements empty');
}

// ── T2: weak winner ────────────────────────────────────────────────────────────
section('T2: NOT_READY — PREDICTED_CURRENT confidence=low (evidence_quality=low)');
{
  // PHYSICAL_DECONDITIONING PREDICTED_CURRENT confidence=low → evidence_quality='low'.
  const nodeStates = [makeState('PHYSICAL_DECONDITIONING', 'PREDICTED_CURRENT', 'low')];
  const scResult   = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED',            'T2-pre: systemConstraint IDENTIFIED');
  assert(scResult.selected.evidence_quality === 'low','T2-pre2: evidence_quality is low');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  assert(r.status === 'NOT_READY',                              'T2-a: status NOT_READY');
  assert(r.unmet_requirements.length === 1,                     'T2-b: one unmet requirement');
  assert(r.unmet_requirements[0].type === 'INSUFFICIENT_CANDIDATE_EVIDENCE', 'T2-c: correct type');
  assert(r.unmet_requirements[0].node_id === 'PHYSICAL_DECONDITIONING',      'T2-d: correct node_id');
  assert(r.unmet_requirements[0].current_evidence_quality === 'low',         'T2-e: evidence_quality low');
  assert(r.unmet_requirements[0].required === 'medium',                      'T2-f: required medium');
  assert(r.unmet_requirements[0].current_state === 'PREDICTED_CURRENT',      'T2-g: state preserved');
  assert(r.unmet_requirements[0].confidence === 'low',                       'T2-h: confidence preserved');
  assert(Array.isArray(r.unmet_requirements[0].missing_evidence),            'T2-i: missing_evidence array');
}

// ── T3: no winner (INSUFFICIENT_MODEL) ────────────────────────────────────────
section('T3: NOT_READY — INSUFFICIENT_MODEL');
{
  const scResult = makeInsufficientModel();
  // No nodeStates needed for this check — R-COND-1 fails before anything else.
  const r = evaluateSystemConstraintReadiness([], scResult);

  assert(r.status === 'NOT_READY',                                           'T3-a: NOT_READY');
  assert(r.unmet_requirements[0].type === 'NO_VIABLE_CANDIDATE',             'T3-b: NO_VIABLE_CANDIDATE');
  assert(r.unmet_requirements[0].systemConstraint_status === 'INSUFFICIENT_MODEL', 'T3-c: status preserved');
  assert(Array.isArray(r.unmet_requirements[0].finalists),                   'T3-d: finalists array');
  assert(r.unmet_requirements[0].finalists.length === 0,                     'T3-e: finalists empty');
}

// ── T4: tied existing candidates (INSUFFICIENT_EVIDENCE) ──────────────────────
section('T4: NOT_READY — INSUFFICIENT_EVIDENCE with finalists');
{
  const scResult = makeInsufficientEvidence(['HYPERTENSION', 'DYSLIPIDEMIA']);
  const r = evaluateSystemConstraintReadiness([], scResult);

  assert(r.status === 'NOT_READY',                                                 'T4-a: NOT_READY');
  assert(r.unmet_requirements[0].type === 'NO_VIABLE_CANDIDATE',                   'T4-b: NO_VIABLE_CANDIDATE');
  assert(r.unmet_requirements[0].systemConstraint_status === 'INSUFFICIENT_EVIDENCE', 'T4-c: status preserved');
  assert(r.unmet_requirements[0].finalists.length === 2,                           'T4-d: finalists count');
  assert(r.unmet_requirements[0].finalists.includes('HYPERTENSION'),               'T4-e: HYPERTENSION in finalists');
  assert(r.unmet_requirements[0].finalists.includes('DYSLIPIDEMIA'),               'T4-f: DYSLIPIDEMIA in finalists');
}

// ── T4b: SAFETY_OVERRIDE ────────────────────────────────────────────────────
section('T4b: NOT_READY — SAFETY_OVERRIDE');
{
  const scResult = makeSafetyOverride();
  const r = evaluateSystemConstraintReadiness([], scResult);

  assert(r.status === 'NOT_READY',                                        'T4b-a: NOT_READY');
  assert(r.unmet_requirements[0].type === 'NO_VIABLE_CANDIDATE',          'T4b-b: NO_VIABLE_CANDIDATE');
  assert(r.unmet_requirements[0].systemConstraint_status === 'SAFETY_OVERRIDE', 'T4b-c: SAFETY_OVERRIDE status');
}

// ── T5: UNKNOWN with no Goal path must NOT block ───────────────────────────────
section('T5: READY — UNKNOWN B has no Goal path, must not block');
{
  // ERECTILE_DYSFUNCTION: only RISK_MARKER_FOR edge out → no causal Goal path.
  // FALL_RISK: no outgoing causal edges at all.
  // GAIT_INSTABILITY: GAIT_INSTABILITY → FALL_RISK → (leaf) — no gateway reached.
  const nodeStates = [
    makeState('EXCESS_ADIPOSITY', 'MEASURED', 'medium'),
    makeState('ERECTILE_DYSFUNCTION', 'UNKNOWN', 'unknown'),
    makeState('FALL_RISK', 'UNKNOWN', 'unknown'),
    makeState('GAIT_INSTABILITY', 'UNKNOWN', 'unknown'),
  ];
  const scResult = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED', 'T5-pre: IDENTIFIED');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  assert(r.status === 'READY',                        'T5-a: READY despite UNKNOWNs');
  assert(r.unmet_requirements.length === 0,            'T5-b: unmet_requirements empty');
}

// ── T6: UNKNOWN displaces winner ──────────────────────────────────────────────
section('T6: NOT_READY — UNKNOWN B has Goal path and outranks winner');
{
  // W = EXCESS_ADIPOSITY MEASURED medium: goal_threat_severity='medium'
  // B = HYPERTENSION UNKNOWN: @CONFIRMED → CV domain → high/high/high/high
  // B beats W on criterion 1 (high > medium).
  const nodeStates = [
    makeState('EXCESS_ADIPOSITY', 'MEASURED', 'medium'),
    makeState('HYPERTENSION', 'UNKNOWN', 'unknown'),
  ];
  const scResult = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED',                       'T6-pre: IDENTIFIED');
  assert(scResult.selected.node_id === 'EXCESS_ADIPOSITY',       'T6-pre2: correct winner');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  assert(r.status === 'NOT_READY',                                              'T6-a: NOT_READY');
  assert(r.unmet_requirements[0].type === 'UNRESOLVED_COMPETING_CANDIDATE',    'T6-b: correct type');
  assert(r.unmet_requirements[0].blocking_node_ids.includes('HYPERTENSION'),   'T6-c: HYPERTENSION in blocking');
  assert(r.unmet_requirements[0].winner_node_id === 'EXCESS_ADIPOSITY',        'T6-d: winner_node_id');
  assert(r.unmet_requirements[0].winner_scores.goal_threat_severity === 'medium', 'T6-e: winner score preserved');

  // ── T6 PARITY ORACLE ──────────────────────────────────────────────────────
  // Run actual systemConstraint with HYPERTENSION resolved to CONFIRMED.
  // Result must show EXCESS_ADIPOSITY is NO LONGER the unique winner.
  const nodeStatesOracle = [
    makeState('EXCESS_ADIPOSITY', 'MEASURED', 'medium'),
    makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'Hypertension' }], supporting: [], inferred_from_nodes: [] } }),
  ];
  const scOracle = computeSystemConstraint(nodeStatesOracle, [], GATE_CLEAN, 'test');

  // With HYPERTENSION CONFIRMED, it outranks EXCESS_ADIPOSITY MEASURED on
  // goal_threat_severity (high > medium). EXCESS_ADIPOSITY is no longer winner.
  assert(scOracle.status === 'IDENTIFIED',                              'T6-oracle-a: IDENTIFIED with both');
  assert(scOracle.selected.node_id !== 'EXCESS_ADIPOSITY',             'T6-oracle-b: W no longer winner');
  assert(scOracle.selected.node_id === 'HYPERTENSION',                 'T6-oracle-c: HYPERTENSION is new winner');
}

// ── T7: UNKNOWN creates tie ────────────────────────────────────────────────────
section('T7: NOT_READY — UNKNOWN B ties winner on all five criteria');
{
  // W = HYPERTENSION CONFIRMED CV: high/high/high/high/1
  // B = DYSLIPIDEMIA UNKNOWN: @CONFIRMED → CV domain → high/high/high/high/1
  // All 5 criteria tie → material (IDENTIFIED would become INSUFFICIENT_EVIDENCE).
  const nodeStates = [
    makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'HTN' }], supporting: [], inferred_from_nodes: [] } }),
    makeState('DYSLIPIDEMIA', 'UNKNOWN', 'unknown'),
  ];
  const scResult = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED',                        'T7-pre: IDENTIFIED (only HTN in candidates)');
  assert(scResult.selected.node_id === 'HYPERTENSION',            'T7-pre2: HYPERTENSION is winner');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  assert(r.status === 'NOT_READY',                                              'T7-a: NOT_READY');
  assert(r.unmet_requirements[0].type === 'UNRESOLVED_COMPETING_CANDIDATE',    'T7-b: correct type');
  assert(r.unmet_requirements[0].blocking_node_ids.includes('DYSLIPIDEMIA'),   'T7-c: DYSLIPIDEMIA in blocking');

  // ── T7 PARITY ORACLE ──────────────────────────────────────────────────────
  // HYPERTENSION + DYSLIPIDEMIA both CONFIRMED — both CV, same causal_relevance='high',
  // same breadth=1. All five criteria tie → INSUFFICIENT_EVIDENCE.
  const nodeStatesOracle = [
    makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'HTN' }], supporting: [], inferred_from_nodes: [] } }),
    makeState('DYSLIPIDEMIA', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'DYSLIPIDEMIA', raw_label: 'Dyslipidemia' }], supporting: [], inferred_from_nodes: [] } }),
  ];
  const scOracle = computeSystemConstraint(nodeStatesOracle, [], GATE_CLEAN, 'test');

  // With both CONFIRMED, all 5 criteria tie → systemConstraint cannot resolve → INSUFFICIENT_EVIDENCE.
  // (HYPERTENSION is no longer the UNIQUE winner.)
  assert(scOracle.status === 'INSUFFICIENT_EVIDENCE',             'T7-oracle-a: INSUFFICIENT_EVIDENCE when both CONFIRMED');
  assert(scOracle.selected === null,                              'T7-oracle-b: no unique winner');
  assert(scOracle.finalists.length === 2,                         'T7-oracle-c: two finalists');
}

// ── T8: UNKNOWN has Goal path but cannot alter winner ─────────────────────────
section('T8: READY — UNKNOWN B has Goal path but loses to winner on earlier criterion');
{
  // W = HYPERTENSION CONFIRMED CV: high/high/high/high/1
  // B = REDUCED_FUNCTIONAL_RESERVE UNKNOWN: @CONFIRMED: high/medium/high/medium/1
  //   (functional domain → time_sensitivity='medium'; path quality 'moderate' → causal_relevance='medium')
  // W beats B on criterion 2 (time_sensitivity: high > medium) → B NOT material.
  const nodeStates = [
    makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'HTN' }], supporting: [], inferred_from_nodes: [] } }),
    makeState('REDUCED_FUNCTIONAL_RESERVE', 'UNKNOWN', 'unknown'),
  ];
  const scResult = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED',                        'T8-pre: IDENTIFIED');
  assert(scResult.selected.node_id === 'HYPERTENSION',            'T8-pre2: HYPERTENSION is winner');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  assert(r.status === 'READY',                       'T8-a: READY — RFR not material');
  assert(r.unmet_requirements.length === 0,           'T8-b: no unmet requirements');

  // ── T8 PARITY ORACLE ──────────────────────────────────────────────────────
  // With REDUCED_FUNCTIONAL_RESERVE CONFIRMED, HYPERTENSION still wins on
  // time_sensitivity (high > medium). W remains the unique winner.
  const nodeStatesOracle = [
    makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'HTN' }], supporting: [], inferred_from_nodes: [] } }),
    makeState('REDUCED_FUNCTIONAL_RESERVE', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'REDUCED_FUNCTIONAL_RESERVE', raw_label: 'Reduced FR' }], supporting: [], inferred_from_nodes: [] } }),
  ];
  const scOracle = computeSystemConstraint(nodeStatesOracle, [], GATE_CLEAN, 'test');

  assert(scOracle.status === 'IDENTIFIED',                              'T8-oracle-a: still IDENTIFIED');
  assert(scOracle.selected.node_id === 'HYPERTENSION',                 'T8-oracle-b: HYPERTENSION still unique winner');
}

// ── T9: high winner is NOT automatic exemption ────────────────────────────────
section('T9: NOT_READY — winner.goal_threat_severity=high does NOT exempt from R-COND-3');
{
  // Proves that the previous "high severity → safe" shortcut is wrong.
  // W = HYPERTENSION CONFIRMED CV: high/high/high/high/1
  // B = DYSLIPIDEMIA UNKNOWN (also CV): @CONFIRMED: high/high/high/high/1 → tie → MATERIAL.
  const nodeStates = [
    makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'HTN' }], supporting: [], inferred_from_nodes: [] } }),
    makeState('DYSLIPIDEMIA', 'UNKNOWN', 'unknown'),
  ];
  const scResult = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.selected?.goal_threat_severity === 'high', 'T9-pre: winner has high severity');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  // If this were READY, the high-severity shortcut bug would be present.
  assert(r.status === 'NOT_READY',                                            'T9-a: NOT_READY despite high winner');
  assert(r.unmet_requirements[0].type === 'UNRESOLVED_COMPETING_CANDIDATE', 'T9-b: UNRESOLVED_COMPETING_CANDIDATE');
  assert(r.unmet_requirements[0].blocking_node_ids.includes('DYSLIPIDEMIA'),'T9-c: DYSLIPIDEMIA is material');
}

// ── T10: mixed UNKNOWNs — only material ones in blocking_node_ids ──────────────
section('T10: blocking_node_ids contains ONLY material UNKNOWNs');
{
  // W = HYPERTENSION CONFIRMED CV: high/high/high/high/1
  // B = DYSLIPIDEMIA UNKNOWN → @CONFIRMED: CV domain → high/high/high/high/1 → ties W → MATERIAL
  // C = ERECTILE_DYSFUNCTION UNKNOWN → no causal Goal path (RISK_MARKER_FOR only) → NOT material
  // D = REDUCED_FUNCTIONAL_RESERVE UNKNOWN → @CONFIRMED: high/MEDIUM/high/medium/1
  //     W.time_sensitivity=HIGH > D.time_sensitivity=MEDIUM → D loses on criterion 2 → NOT material
  const nodeStates = [
    makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'HTN' }], supporting: [], inferred_from_nodes: [] } }),
    makeState('DYSLIPIDEMIA',              'UNKNOWN', 'unknown'),   // B — material (ties)
    makeState('ERECTILE_DYSFUNCTION',      'UNKNOWN', 'unknown'),   // C — no Goal path
    makeState('REDUCED_FUNCTIONAL_RESERVE','UNKNOWN', 'unknown'),   // D — loses on time_sensitivity
  ];
  const scResult = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED',                    'T10-pre: IDENTIFIED');
  assert(scResult.selected.node_id === 'HYPERTENSION',        'T10-pre2: HYPERTENSION winner');
  assert(scResult.selected.time_sensitivity === 'high',       'T10-pre3: winner time_sensitivity=high (CV)');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);

  assert(r.status === 'NOT_READY',                                          'T10-a: NOT_READY');
  const blocking = r.unmet_requirements[0].blocking_node_ids;
  assert(blocking.includes('DYSLIPIDEMIA'),                                 'T10-b: DYSLIPIDEMIA in blocking (ties winner)');
  assert(!blocking.includes('ERECTILE_DYSFUNCTION'),                        'T10-c: ED NOT in blocking (no Goal path)');
  assert(!blocking.includes('REDUCED_FUNCTIONAL_RESERVE'),                  'T10-d: RFR NOT in blocking (loses on time_sensitivity)');
  assert(blocking.length === 1,                                             'T10-e: exactly one material UNKNOWN');
}

// ── T11: deterministic ordering ───────────────────────────────────────────────
section('T11: blocking_node_ids is deterministically ordered');
{
  // Two material UNKNOWNs: ATHEROSCLEROSIS and DYSLIPIDEMIA — both CV, both high.
  // ATHEROSCLEROSIS: one hop to CVD (all strong edges), causal_relevance='high', breadth=1.
  // DYSLIPIDEMIA: two hops to CVD (all strong), causal_relevance='high', breadth=1.
  // Winner = EXCESS_ADIPOSITY MEASURED — lower on criterion 1.
  // Both ATHEROSCLEROSIS and DYSLIPIDEMIA beat winner → both material.
  // Alphabetical order: ['ATHEROSCLEROSIS', 'DYSLIPIDEMIA'].

  const baseState = [makeState('EXCESS_ADIPOSITY', 'MEASURED', 'medium')];

  const orderA = [
    ...baseState,
    makeState('ATHEROSCLEROSIS', 'UNKNOWN', 'unknown'),
    makeState('DYSLIPIDEMIA',    'UNKNOWN', 'unknown'),
  ];
  const orderB = [
    ...baseState,
    makeState('DYSLIPIDEMIA',    'UNKNOWN', 'unknown'),
    makeState('ATHEROSCLEROSIS', 'UNKNOWN', 'unknown'),
  ];

  const scResult = computeSystemConstraint(baseState, [], GATE_CLEAN, 'test');
  const r1 = evaluateSystemConstraintReadiness(orderA, scResult);
  const r2 = evaluateSystemConstraintReadiness(orderB, scResult);

  const ids1 = r1.unmet_requirements[0]?.blocking_node_ids ?? [];
  const ids2 = r2.unmet_requirements[0]?.blocking_node_ids ?? [];

  assert(ids1.length >= 2,                              'T11-a: at least two material UNKNOWNs in orderA');
  assert(ids2.length >= 2,                              'T11-b: at least two material UNKNOWNs in orderB');
  assert(JSON.stringify(ids1) === JSON.stringify(ids2), 'T11-c: output is order-independent');
  assert(ids1[0] === 'ATHEROSCLEROSIS',                 'T11-d: first entry alphabetically = ATHEROSCLEROSIS');
  assert(ids1[1] === 'DYSLIPIDEMIA',                    'T11-e: second entry = DYSLIPIDEMIA');
}

// ── T12: R-COND-1 failure must not crash ─────────────────────────────────────
section('T12: R-COND-1 failure does not crash when selected=null');
{
  // systemConstraint returns INSUFFICIENT_MODEL (no winner fields).
  // Readiness must not access winner fields and must return cleanly.
  let threw = false;
  let r;
  try {
    r = evaluateSystemConstraintReadiness(
      [],
      { status: 'INSUFFICIENT_MODEL', selected: null, finalists: [] }
    );
  } catch (e) {
    threw = true;
  }

  assert(!threw,                              'T12-a: no exception when selected=null');
  assert(r.status === 'NOT_READY',            'T12-b: returns NOT_READY');
  assert(r.unmet_requirements.length === 1,   'T12-c: one unmet requirement');
  assert(r.unmet_requirements[0].type === 'NO_VIABLE_CANDIDATE', 'T12-d: correct type');
}

// ── P1: criterion order ────────────────────────────────────────────────────────
section('P1 parity: goal_threat_severity precedes time_sensitivity');
{
  // B beats W on time_sensitivity but W beats B on goal_threat_severity.
  // B must NOT be material (earlier criterion decides).
  //
  // W = HYPERTENSION CONFIRMED (CV): high/high/high/high/1
  // B scenario: construct a hypothetical where B@CONFIRMED is 'high' on severity
  //   but 'medium' on time_sensitivity (non-CV). W has 'high' on time_sensitivity.
  // W beats B on criterion 2 → B NOT material.
  //
  // Concrete: B = REDUCED_FUNCTIONAL_RESERVE (functional domain, non-CV):
  //   @CONFIRMED: high/medium/high/medium/1.
  // W: high/high/high/high/1. W wins on criterion 2. Regardless of criteria 4-5.

  const causalGraph = buildCausalGraph(MASTER);

  const wScores = { goal_threat_severity: 'high', time_sensitivity: 'high',
                    evidence_quality: 'high', causal_relevance: 'high', breadth: 1 };

  const rfr_goalPath = computeGoalPath('REDUCED_FUNCTIONAL_RESERVE', causalGraph);
  const rfr_profile  = buildConfirmedProfile('REDUCED_FUNCTIONAL_RESERVE', rfr_goalPath);

  assert(rfr_profile !== null,                          'P1-a: RFR has Goal path');
  assert(rfr_profile.time_sensitivity === 'medium',     'P1-b: non-CV → time_sensitivity medium');
  assert(rfr_profile.goal_threat_severity === 'high',   'P1-c: CONFIRMED → goal_threat_severity high');

  const comparison = compareToWinner(rfr_profile, wScores);
  assert(comparison === 'loses',                        'P1-d: RFR@CONFIRMED loses — W beats on criterion 2');
}

// ── P2: RISK_MARKER_FOR does not create Goal path ──────────────────────────────
section('P2 parity: RISK_MARKER_FOR does NOT establish causal Goal path');
{
  // ERECTILE_DYSFUNCTION: only outgoing edge is RISK_MARKER_FOR → CARDIOVASCULAR_DISEASE.
  // Since RISK_MARKER_FOR is not in CAUSAL_RELATIONS, ED has no Goal path.
  const causalGraph = buildCausalGraph(MASTER);
  const edGoalPath  = computeGoalPath('ERECTILE_DYSFUNCTION', causalGraph);

  assert(!edGoalPath.hasGoalPath,              'P2-a: ERECTILE_DYSFUNCTION has no Goal path');
  assert(edGoalPath.threatens_branches.length === 0, 'P2-b: threatens_branches empty');
  assert(edGoalPath.causal_relevance === 'none',     'P2-c: causal_relevance none');
  assert(buildConfirmedProfile('ERECTILE_DYSFUNCTION', edGoalPath) === null, 'P2-d: no CONFIRMED profile for ED');

  // Also verify FALL_RISK (leaf node, no outgoing causal edges):
  const fallGoalPath = computeGoalPath('FALL_RISK', causalGraph);
  assert(!fallGoalPath.hasGoalPath,             'P2-e: FALL_RISK has no Goal path');
}

// ── P3: tie semantics — all five equal means MATERIAL ─────────────────────────
section('P3 parity: tie on all five criteria = MATERIAL (not only \'beats\')');
{
  // B ties W on all five → 'ties' → material (would create INSUFFICIENT_EVIDENCE).
  const wScores = { goal_threat_severity: 'high', time_sensitivity: 'high',
                    evidence_quality: 'high', causal_relevance: 'high', breadth: 1 };
  const bScores = { goal_threat_severity: 'high', time_sensitivity: 'high',
                    evidence_quality: 'high', causal_relevance: 'high', breadth: 1 };

  const comparison = compareToWinner(bScores, wScores);
  assert(comparison === 'ties', 'P3-a: identical profiles → ties');

  // Now verify this triggers NOT_READY (not READY).
  // Use HYPERTENSION (W) vs DYSLIPIDEMIA (B) — both CV confirmed profiles tie identically.
  const causalGraph = buildCausalGraph(MASTER);
  const dys_path    = computeGoalPath('DYSLIPIDEMIA', causalGraph);
  const dys_profile = buildConfirmedProfile('DYSLIPIDEMIA', dys_path);
  const htn_scResult = computeSystemConstraint(
    [makeState('HYPERTENSION', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'HYPERTENSION', raw_label: 'HTN' }], supporting: [], inferred_from_nodes: [] } })],
    [], GATE_CLEAN, 'test'
  );

  const htn_scores = htn_scResult.selected;
  const cmp = compareToWinner(dys_profile, htn_scores);
  assert(cmp === 'ties', 'P3-b: DYSLIPIDEMIA@CONFIRMED ties HYPERTENSION CONFIRMED on all five');
}

// ── P4: early winner superiority — later B advantage doesn't matter ──────────
section('P4 parity: early winner superiority overrides later B superiority');
{
  // W beats B on criterion 2 (time_sensitivity). B is better on criteria 4-5.
  // compareToWinner must return 'loses' (not 'beats' or 'ties').
  const wScores = { goal_threat_severity: 'high', time_sensitivity: 'high',
                    evidence_quality: 'high', causal_relevance: 'low', breadth: 1 };
  const bScores = { goal_threat_severity: 'high', time_sensitivity: 'medium',
                    evidence_quality: 'high', causal_relevance: 'high', breadth: 2 };

  // Criterion 1: high=high (tie).
  // Criterion 2: W high > B medium → W wins → result must be 'loses'.
  // Criteria 4-5 not evaluated after W already won criterion 2.
  const comparison = compareToWinner(bScores, wScores);
  assert(comparison === 'loses', 'P4-a: W wins on criterion 2; later B superiority irrelevant');
}

// ── P5: breadth participates only after criteria 1-4 tie ──────────────────────
section('P5 parity: breadth is criterion 5, participates only after 1-4 tie');
{
  // W = PHYSICAL_INACTIVITY CONFIRMED (lifestyle domain): high/medium/high/medium/breadth=2
  // B = REDUCED_FUNCTIONAL_RESERVE UNKNOWN: @CONFIRMED: high/medium/high/medium/breadth=1
  // Criteria 1-4 all tie; W wins on breadth (2 > 1) → B NOT material.
  const causalGraph = buildCausalGraph(MASTER);

  const nodeStates = [
    makeState('PHYSICAL_INACTIVITY', 'CONFIRMED', 'high',
      { evidence: { direct: [{ source: 'CLINICAL_HISTORY', type: 'DIAGNOSIS', id: 'PHYSICAL_INACTIVITY', raw_label: 'Physical inactivity' }], supporting: [], inferred_from_nodes: [] } }),
    makeState('REDUCED_FUNCTIONAL_RESERVE', 'UNKNOWN', 'unknown'),
  ];
  const scResult = computeSystemConstraint(nodeStates, [], GATE_CLEAN, 'test');

  assert(scResult.status === 'IDENTIFIED',                         'P5-pre: IDENTIFIED');
  assert(scResult.selected.node_id === 'PHYSICAL_INACTIVITY',      'P5-pre2: PHYSICAL_INACTIVITY winner');
  assert(scResult.selected.breadth === 2,                          'P5-pre3: winner breadth=2');

  const rfr_path    = computeGoalPath('REDUCED_FUNCTIONAL_RESERVE', causalGraph);
  const rfr_profile = buildConfirmedProfile('REDUCED_FUNCTIONAL_RESERVE', rfr_path);
  assert(rfr_profile.breadth === 1,                                'P5-a: RFR breadth=1');

  // Criteria 1-4 between PHYSICAL_INACTIVITY and RFR@CONFIRMED:
  // goal_threat_severity: both high (CONFIRMED + Goal path) → tie
  // time_sensitivity: both medium (both non-CV CONFIRMED) → tie
  // evidence_quality: both high (CONFIRMED) → tie
  // causal_relevance: PI is 'medium', RFR is 'medium' → tie
  // breadth: PI=2 > RFR=1 → W wins
  const comparison = compareToWinner(rfr_profile, scResult.selected);
  assert(comparison === 'loses',                                   'P5-b: RFR loses on breadth (criterion 5)');

  const r = evaluateSystemConstraintReadiness(nodeStates, scResult);
  assert(r.status === 'READY',                                     'P5-c: READY — breadth eliminates RFR');
  assert(r.unmet_requirements.length === 0,                        'P5-d: no unmet requirements');

  // Verify breadth criterion is last by showing that if criteria 1-4 DO tie AND
  // B has higher breadth, B becomes material:
  // Use PHYSICAL_INACTIVITY (breadth=2) as B-equivalent vs a winner with breadth=1.
  // Here winner HYPERTENSION (CV, breadth=1) vs PHYSICAL_INACTIVITY UNKNOWN (breadth=2):
  // BUT PHYSICAL_INACTIVITY is 'lifestyle' domain → time_sensitivity='medium' vs
  // HYPERTENSION's time_sensitivity='high' → PHYSICAL_INACTIVITY loses on criterion 2.
  // So breadth=2 doesn't help — criterion 2 decides first.
  const htn_scores = {
    goal_threat_severity: 'high', time_sensitivity: 'high',
    evidence_quality: 'high', causal_relevance: 'high', breadth: 1,
  };
  const pi_path    = computeGoalPath('PHYSICAL_INACTIVITY', causalGraph);
  const pi_profile = buildConfirmedProfile('PHYSICAL_INACTIVITY', pi_path);
  assert(pi_profile.breadth === 2,                                 'P5-e: PHYSICAL_INACTIVITY breadth=2');
  assert(pi_profile.time_sensitivity === 'medium',                 'P5-f: lifestyle domain → time_sensitivity medium');
  const pi_cmp = compareToWinner(pi_profile, htn_scores);
  assert(pi_cmp === 'loses',                                       'P5-g: PI loses on criterion 2 despite breadth=2');
}

// ── Goal path correctness audit ───────────────────────────────────────────────
section('Goal path audit — all 16 master nodes');
{
  const causalGraph = buildCausalGraph(MASTER);

  // Nodes expected to have a Goal path (causal path to a Gateway):
  // Gateway nodes (CVD, LFRA) have a 0-hop self-path — mirrors Engine's computeGoalImpact()
  // which places the start node in predecessors with null, then finds it reachable as a gateway.
  // 0-hop: pathEdges=[], minEQRank=3 (sentinel), causal_relevance='high'.
  const HAS_GOAL_PATH = new Set([
    'PHYSICAL_INACTIVITY',       // → CVD and → LOSS_OF_FLOOR_RISE_ABILITY
    'EXCESS_ADIPOSITY',          // → CVD (via IR→HTN→...)
    'INSULIN_RESISTANCE',        // → CVD (via HTN→...)
    'HYPERTENSION',              // → CVD (via ENDOTHEL→ATHERO→CVD)
    'ENDOTHELIAL_DYSFUNCTION',   // → CVD (via ATHERO→CVD)
    'DYSLIPIDEMIA',              // → CVD (via ATHERO→CVD)
    'ATHEROSCLEROSIS',           // → CVD (1 hop)
    'PHYSICAL_DECONDITIONING',   // → LOSS_OF_FLOOR_RISE_ABILITY (via LMS→RFR→...)
    'LOW_MUSCLE_STRENGTH',       // → LOSS_OF_FLOOR_RISE_ABILITY (via RFR→...)
    'REDUCED_FUNCTIONAL_RESERVE',// → LOSS_OF_FLOOR_RISE_ABILITY (1 hop)
    'CARDIOVASCULAR_DISEASE',    // 0-hop self-path to CV gateway (Engine parity)
    'LOSS_OF_FLOOR_RISE_ABILITY',// 0-hop self-path to Functional gateway (Engine parity)
  ]);

  // Nodes expected to have NO Goal path:
  const NO_GOAL_PATH = new Set([
    'ERECTILE_DYSFUNCTION',  // RISK_MARKER_FOR only — not causal
    'PERIPHERAL_NEUROPATHY', // → GAIT_INSTABILITY → FALL_RISK (leaf, not a Gateway)
    'GAIT_INSTABILITY',      // → FALL_RISK (leaf)
    'FALL_RISK',             // leaf — no outgoing causal edges
  ]);

  for (const node of MASTER.nodes) {
    const gp = computeGoalPath(node.id, causalGraph);
    if (HAS_GOAL_PATH.has(node.id)) {
      assert(gp.hasGoalPath, `GoalPath-a: ${node.id} has Goal path`);
    } else if (NO_GOAL_PATH.has(node.id)) {
      assert(!gp.hasGoalPath, `GoalPath-b: ${node.id} has NO Goal path`);
    }
  }

  // PHYSICAL_INACTIVITY threatens BOTH branches (breadth=2):
  const pi = computeGoalPath('PHYSICAL_INACTIVITY', causalGraph);
  assert(pi.breadth === 2, 'GoalPath-c: PHYSICAL_INACTIVITY breadth=2');
  assert(pi.threatens_branches.includes('SURVIVAL_HEALTHSPAN'),      'GoalPath-d: SURVIVAL_HEALTHSPAN');
  assert(pi.threatens_branches.includes('FUNCTIONAL_INDEPENDENCE'),  'GoalPath-e: FUNCTIONAL_INDEPENDENCE');

  // 0-hop self-path: gateway nodes have causal_relevance='high' and breadth=1
  // (mirrors Engine sentinel: empty pathEdges → minEQRank=3 → 'high')
  const cvd  = computeGoalPath('CARDIOVASCULAR_DISEASE',     causalGraph);
  assert(cvd.hasGoalPath,                                    'GoalPath-f: CVD 0-hop hasGoalPath');
  assert(cvd.causal_relevance === 'high',                    'GoalPath-g: CVD 0-hop causal_relevance=high (sentinel)');
  assert(cvd.breadth === 1,                                  'GoalPath-h: CVD breadth=1');
  assert(cvd.threatens_branches.includes('SURVIVAL_HEALTHSPAN'), 'GoalPath-i: CVD threatens SURVIVAL_HEALTHSPAN');

  const lfra = computeGoalPath('LOSS_OF_FLOOR_RISE_ABILITY', causalGraph);
  assert(lfra.hasGoalPath,                                   'GoalPath-j: LFRA 0-hop hasGoalPath');
  assert(lfra.causal_relevance === 'high',                   'GoalPath-k: LFRA 0-hop causal_relevance=high (sentinel)');
  assert(lfra.breadth === 1,                                 'GoalPath-l: LFRA breadth=1');
  assert(lfra.threatens_branches.includes('FUNCTIONAL_INDEPENDENCE'), 'GoalPath-m: LFRA threatens FUNCTIONAL_INDEPENDENCE');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`System Constraint Readiness #1: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FAIL: one or more tests failed');
  process.exit(1);
} else {
  console.log('PASS: all tests passed');
}
