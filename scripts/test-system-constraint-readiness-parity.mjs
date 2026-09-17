/**
 * Differential Parity Oracle — System Constraint Readiness #1
 *
 * For each UNKNOWN node B in master.json:
 *   1. Build fixture with baseline winner W (CONFIRMED) + B (UNKNOWN)
 *   2. Run evaluateSystemConstraintReadiness → readiness_material(B)
 *   3. Replace B with strongest CONFIRMED state, run computeSystemConstraint
 *   4. actual_material(B) = W is no longer the unique IDENTIFIED winner
 *   5. Assert readiness_material === actual_material
 *
 * Oracle: actual computeSystemConstraint() — never compareToWinner().
 * Two baseline winners: HYPERTENSION (CV), REDUCED_FUNCTIONAL_RESERVE (functional).
 */

import { computeSystemConstraint }            from '../api/engine/systemConstraint.js';
import { evaluateSystemConstraintReadiness, MASTER }
  from '../api/lib/constraintReadiness/systemConstraintReadiness.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_DECISIONGATE = { context_gates: [] };
const ENGINE_VERSION     = 'test-parity-1.0';

/** Build a CONFIRMED PERSON_NODE_STATE for node B. */
function confirmedState(nodeId) {
  return { node_id: nodeId, current_state: 'CONFIRMED', confidence: 'high' };
}

/** Build an UNKNOWN PERSON_NODE_STATE for node B. */
function unknownState(nodeId) {
  return { node_id: nodeId, current_state: 'UNKNOWN', confidence: null };
}

/**
 * Run the differential oracle for a single (winner, candidate) pair.
 *
 * Returns:
 *   { node_id, readiness_material, actual_material, match,
 *     readiness_status, oracle_status, oracle_selected }
 */
function runDifferential(winnerNodeId, candidateNodeId) {
  // ── Step 1: fixture with W=CONFIRMED, B=UNKNOWN ───────────────────────────
  const fixtureReadiness = [confirmedState(winnerNodeId), unknownState(candidateNodeId)];

  // Compute systemConstraint with B as UNKNOWN (B is skipped by Engine).
  const scResult = computeSystemConstraint(
    fixtureReadiness, [], EMPTY_DECISIONGATE, ENGINE_VERSION
  );

  // Run readiness evaluation.
  const readiness = evaluateSystemConstraintReadiness(fixtureReadiness, scResult);
  const readiness_material =
    readiness.status === 'NOT_READY' &&
    readiness.unmet_requirements.some(r =>
      r.type === 'UNRESOLVED_COMPETING_CANDIDATE' &&
      r.blocking_node_ids.includes(candidateNodeId)
    );

  // ── Step 2: fixture with W=CONFIRMED, B=CONFIRMED (oracle) ────────────────
  const fixtureOracle = [confirmedState(winnerNodeId), confirmedState(candidateNodeId)];

  const oracleResult = computeSystemConstraint(
    fixtureOracle, [], EMPTY_DECISIONGATE, ENGINE_VERSION
  );

  // Actual materiality: W is no longer the unique IDENTIFIED winner.
  const actual_material =
    oracleResult.status !== 'IDENTIFIED' ||
    oracleResult.selected?.node_id !== winnerNodeId;

  return {
    node_id:           candidateNodeId,
    readiness_material,
    actual_material,
    match:             readiness_material === actual_material,
    readiness_status:  readiness.status,
    oracle_status:     oracleResult.status,
    oracle_selected:   oracleResult.selected?.node_id ?? null,
  };
}

// ── Baseline winners ──────────────────────────────────────────────────────────

const WINNERS = [
  { node_id: 'HYPERTENSION',             label: 'W1 — HYPERTENSION (CV CONFIRMED)' },
  { node_id: 'REDUCED_FUNCTIONAL_RESERVE', label: 'W2 — REDUCED_FUNCTIONAL_RESERVE (functional CONFIRMED)' },
];

// ── All master.json node IDs ──────────────────────────────────────────────────

const ALL_NODE_IDS = MASTER.nodes.map(n => n.id);

// ── Run oracle ────────────────────────────────────────────────────────────────

let totalTests   = 0;
let totalPass    = 0;
let totalFail    = 0;
const mismatches = [];

for (const winner of WINNERS) {
  console.log(`\n${'═'.repeat(68)}`);
  console.log(`  ${winner.label}`);
  console.log(`${'═'.repeat(68)}`);

  // Verify winner itself is uniquely IDENTIFIED when alone.
  const soloResult = computeSystemConstraint(
    [confirmedState(winner.node_id)], [], EMPTY_DECISIONGATE, ENGINE_VERSION
  );
  if (soloResult.status !== 'IDENTIFIED' || soloResult.selected.node_id !== winner.node_id) {
    console.error(`  FATAL: winner ${winner.node_id} not uniquely IDENTIFIED when alone! Status=${soloResult.status}`);
    process.exit(1);
  }

  const CANDIDATES = ALL_NODE_IDS.filter(id => id !== winner.node_id);

  let winnerPass = 0;
  let winnerFail = 0;

  // Group results for table output
  const rows = [];

  for (const candidateId of CANDIDATES) {
    const r = runDifferential(winner.node_id, candidateId);
    rows.push(r);
    totalTests++;
    if (r.match) {
      totalPass++;
      winnerPass++;
    } else {
      totalFail++;
      winnerFail++;
      mismatches.push({ winner: winner.node_id, ...r });
    }
  }

  // Print table
  const icon   = r => r.match ? '✅' : '❌';
  const mat    = v => v ? 'MATERIAL  ' : 'not-material';
  const oracle = r => r.oracle_status === 'IDENTIFIED'
    ? `IDENTIFIED(${r.oracle_selected})`
    : r.oracle_status;

  console.log(`\n  ${'Node'.padEnd(34)} RDY-material  ACT-material  Oracle`);
  console.log(`  ${'─'.repeat(90)}`);
  for (const r of rows) {
    const line = `  ${icon(r)} ${r.node_id.padEnd(32)} ${mat(r.readiness_material)}  ${mat(r.actual_material)}  ${oracle(r)}`;
    console.log(line);
  }
  console.log(`\n  Pass: ${winnerPass} / ${CANDIDATES.length}  Fail: ${winnerFail}`);
}

// ── Goal-path parity check ────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(68)}`);
console.log(`  GOAL-PATH PARITY CHECK`);
console.log(`${'═'.repeat(68)}`);
console.log(`\n  Verifies: readiness Goal-path classification consistent with Engine admission.`);
console.log(`  Rule A: readiness says no Goal path → resolved B must NOT gain a viablecandidate path.`);
console.log(`  Rule B: readiness says Goal path → resolved B should be eligible (not excluded).`);

// Use W=HYPERTENSION as baseline for path parity (W is always the unique winner solo).
const PATH_WINNER = 'HYPERTENSION';
const PATH_CANDIDATES = ALL_NODE_IDS.filter(id => id !== PATH_WINNER);

import { computeGoalPath, buildCausalGraph } from '../api/lib/constraintReadiness/systemConstraintReadiness.js';
const causalGraph = buildCausalGraph(MASTER);

let pathPass = 0;
let pathFail = 0;

for (const candidateId of PATH_CANDIDATES) {
  const goalPath      = computeGoalPath(candidateId, causalGraph);
  const rdyHasPath    = goalPath.hasGoalPath;

  // Run Engine with B=CONFIRMED to check if B becomes a viable candidate.
  const oracleResult  = computeSystemConstraint(
    [confirmedState(PATH_WINNER), confirmedState(candidateId)],
    [], EMPTY_DECISIONGATE, ENGINE_VERSION
  );

  // Engine considers B viable if it appears in candidates and is NOT excluded.
  const engineCandidates = oracleResult.candidates ?? [];
  const bCandidate       = engineCandidates.find(c => c.node_id === candidateId);
  const engineHasPath    = bCandidate != null && bCandidate.exclusion_reason == null;

  const match = rdyHasPath === engineHasPath;
  if (match) pathPass++; else pathFail++;

  const icon = match ? '✅' : '❌';
  const rdy  = rdyHasPath    ? 'has-Goal-path   ' : 'no-Goal-path    ';
  const eng  = engineHasPath ? 'viable-candidate' : 'excluded        ';
  console.log(`  ${icon} ${candidateId.padEnd(34)} rdyPath:${rdy}  engViable:${eng}`);
}
console.log(`\n  Path parity — Pass: ${pathPass} / ${PATH_CANDIDATES.length}  Fail: ${pathFail}`);

// ── Final summary ─────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(68)}`);
console.log(`  DIFFERENTIAL ORACLE SUMMARY`);
console.log(`${'═'.repeat(68)}`);
console.log(`  Total oracle tests : ${totalTests}`);
console.log(`  Pass               : ${totalPass}`);
console.log(`  Fail               : ${totalFail}`);
console.log(`  Path parity pass   : ${pathPass}`);
console.log(`  Path parity fail   : ${pathFail}`);

if (mismatches.length > 0) {
  console.log(`\n  MISMATCHES DETAIL:`);
  for (const m of mismatches) {
    console.log(`\n  Node: ${m.node_id}  Winner: ${m.winner}`);
    console.log(`    Readiness: ${m.readiness_material ? 'MATERIAL' : 'not-material'}`);
    console.log(`    Oracle   : ${m.oracle_status} → selected=${m.oracle_selected}`);
    console.log(`    Actual   : ${m.actual_material ? 'MATERIAL' : 'not-material'}`);
  }
}

const allPass = totalFail === 0 && pathFail === 0;
console.log(`\n${'═'.repeat(68)}`);
console.log(allPass
  ? `  SYSTEM_CONSTRAINT_READINESS DIFFERENTIAL PARITY: PASS`
  : `  SYSTEM_CONSTRAINT_READINESS DIFFERENTIAL PARITY: GAP FOUND`);
console.log(`${'═'.repeat(68)}\n`);
