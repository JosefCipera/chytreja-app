// Safety-relevant scenario regression suite — started 2026-11-17 after a live test
// surfaced a real question: when sedentary lifestyle alone activates PHYSICAL_INACTIVITY
// and the engine goes straight to an action, does a concurrent fall/gait-instability
// signal correctly restrict unaided walking? This file is meant to grow: add a new
// scenario here whenever a live test raises a safety-relevant "what if X and Y together"
// question, instead of re-deriving the answer by hand each time.
//
// Real engine pipeline (activation → inference → decisionGate → systemLeverage →
// nextBestAction → dailyDecision), isolated from DB/AI — person/clinicalHistory/
// observations/actionPool are fixtures, not read from Supabase. No network calls.
import { activation } from '../api/engine/activation.js';
import { inference } from '../api/engine/inference.js';
import { computeProjections } from '../api/engine/projections.js';
import { buildInformationNeeds } from '../api/engine/informationNeeds.js';
import { evaluateDecisionGate } from '../api/engine/decisionGate.js';
import { computeSystemLeverage } from '../api/engine/systemLeverage.js';
import { computeSystemConstraint } from '../api/engine/systemConstraint.js';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { findAvailableLeverage } from '../api/engine/dailyDecision.js';
import { computeInterventionExposure } from '../api/engine/adherence.js';
import { applyActionInstructions } from '../api/engine/actionInstructions.js';
import { mapDiagnosis } from '../api/engine/adapter.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const _dir = dirname(fileURLToPath(import.meta.url));
const INTERVENTION_MAP = JSON.parse(fs.readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8'));
const ENGINE_VERSION = 'safety-scenarios-1.0.0';

// Same small, representative fixture action pool used by test-audit-e2e-scenarios.mjs —
// real catalog protocol_types/tags, not invented data.
const ACTION_POOL = [
  { id: 'sit_to_stand_supported', node_id: 'low_muscle_strength', label: 'Podpořené vstávání ze židle', protocol_type: 'FUNKCNI_SILOVY_PROTOKOL', type: 'reps', reps: 8, tier: 1, tags: ['sit_to_stand'], constraint_exclude: [], intensity: 'LOW' },
  { id: 'walk_20', node_id: 'kardio', label: 'Svižná chůze — 20 minut', protocol_type: 'KARDIO_PROTOKOL', type: 'duration', duration: 1200, tier: 1, tags: ['kardio'], constraint_exclude: ['knee', 'ankle_foot'], intensity: 'MODERATE' },
  { id: 'step_down', node_id: 'plyometrie', label: 'Kontrolovaný sestup z bedny — 1 noha', protocol_type: 'SILOVY_PROTOKOL', type: 'reps', reps: 10, tier: 1, tags: ['sila', 'plyometrie', 'kosti', 'dopad'], constraint_exclude: ['knee', 'ankle_foot'], intensity: 'MODERATE' },
  { id: 'balance_single_leg', node_id: 'rovnovaha', label: 'Stoj na jedné noze u opory', protocol_type: 'BALANCE_PROTOKOL', type: 'duration', duration: 60, tier: 1, tags: ['rovnovaha'], constraint_exclude: [], intensity: 'LOW' },
];

async function runFixtureEngine({ person, clinicalHistory, observations = [] }) {
  const activated = activation(person, clinicalHistory, observations);
  const inferred  = inference(activated, person, clinicalHistory, observations);
  const node_states = [...activated, ...inferred];
  const projections = computeProjections(node_states, person, clinicalHistory);
  const information_needs = buildInformationNeeds(node_states, projections);
  const decision_gate = evaluateDecisionGate(node_states, projections, information_needs, ENGINE_VERSION, {
    birth_year: person.birth_year, sex: person.sex, resolved_physical: Object.keys(clinicalHistory.onboarding_inputs ?? {}),
  });
  const system_leverage   = computeSystemLeverage(node_states, projections, decision_gate, ENGINE_VERSION);
  const system_constraint = computeSystemConstraint(node_states, projections, decision_gate, ENGINE_VERSION);

  const leverageNodeId   = system_leverage.selected?.node_id ?? null;
  const interventionData = leverageNodeId ? INTERVENT_MAP_safe(leverageNodeId) : null;
  async function evaluateLeverage(nodeId, data) {
    const allProtocolTypes = [...new Set(data.interventions.flatMap(i => i.protocol_types))];
    const actionPool = applyActionInstructions(ACTION_POOL.filter(a => allProtocolTypes.includes(a.protocol_type)));
    return computeNextBestAction({
      leverageNodeId: nodeId, interventions: data.interventions, actionPool, personConstraints: [], clinicalHistory,
      decisionGate: decision_gate, node_states, engineVersion: ENGINE_VERSION, responseHistory: [], skippedTodayActionIds: new Set(),
    });
  }
  let next_best_action = interventionData ? await evaluateLeverage(leverageNodeId, interventionData) : { status: 'NOT_COMPUTED' };
  const available = await findAvailableLeverage({
    systemLeverage: system_leverage, primaryNba: next_best_action, decisionGate: decision_gate,
    responseEvaluations: [], interventionExposure: computeInterventionExposure([]), mappings: INTERVENTION_MAP.mappings, evaluate: evaluateLeverage,
  });
  next_best_action = available.nba;

  return { node_states, system_leverage, system_constraint, next_best_action };
}
function INTERVENT_MAP_safe(nodeId) { return INTERVENTION_MAP.mappings?.[nodeId] ?? null; }

const basePerson = { person_id: 'safety-fixture', sex: 'male', birth_year: 1956, height_cm: 178 };
const sedentaryClinicalHistory = (onboarding_inputs = {}) => ({
  diagnoses: [], medications: [], supplements: [],
  lifestyle: { sedentary_work: true, smoking_history: 'unknown', alcohol_history: 'unknown' },
  capacity: {}, onboarding_inputs, evidence_availability: {}, clinical_history_documented: true,
});

let failures = 0;
function report(id, label, ok, detail) {
  console.log(`${ok ? '✅' : '❌'}  ${id} — ${label}${detail ? '  :: ' + detail : ''}`);
  if (!ok) failures++;
}
function walkCandidate(nba) {
  return nba.all_candidates?.find(c => c.action_id === 'walk_20') ?? null;
}

// ── S1: sedentary alone activates PHYSICAL_INACTIVITY and walk_20 is unrestricted ──
// Baseline — matches the live test that originally raised this question.
{
  const ch = sedentaryClinicalHistory();
  const r = await runFixtureEngine({ person: basePerson, clinicalHistory: ch });
  report('S1', 'PHYSICAL_INACTIVITY activates from sedentary_work alone',
    r.node_states.some(s => s.node_id === 'PHYSICAL_INACTIVITY'), JSON.stringify(r.node_states.map(s => s.node_id)));
  report('S1', 'leverage is PHYSICAL_INACTIVITY', r.system_leverage.selected?.node_id === 'PHYSICAL_INACTIVITY');
  const walk = walkCandidate(r.next_best_action);
  report('S1', 'walk_20 safety is SAFE (no gait instability active)', walk?.safety?.level === 'SAFE', JSON.stringify(walk?.safety));
}

// ── S2: a single reported fall does NOT by itself restrict unaided walking ──────────
// recent_falls=true activates FALL_RISK CONFIRMED directly (activation.js), but
// contributes only +1 toward GAIT_INSTABILITY's strength-2 threshold (inference.js) —
// one fall alone is not treated as evidence of current gait instability. The walking
// safety gate in nextBestAction.js keys off GAIT_INSTABILITY, not FALL_RISK. This
// scenario documents that as the current, intentional behavior — not an outright bug —
// but it means recent_falls alone will not stop a walking recommendation.
{
  const ch = sedentaryClinicalHistory({ recent_falls: true });
  const r = await runFixtureEngine({ person: basePerson, clinicalHistory: ch });
  report('S2', 'FALL_RISK activates as CONFIRMED from recent_falls=true',
    r.node_states.find(s => s.node_id === 'FALL_RISK')?.current_state === 'CONFIRMED');
  report('S2', 'GAIT_INSTABILITY does NOT activate from a fall report alone',
    !r.node_states.some(s => s.node_id === 'GAIT_INSTABILITY'));
  const walk = walkCandidate(r.next_best_action);
  report('S2', 'walk_20 safety is still SAFE — documents that FALL_RISK alone does not gate walking',
    walk?.safety?.level === 'SAFE', JSON.stringify(walk?.safety));
}

// ── S3: a real gait-instability signal blocks unaided walking (no viable action) ────
// gait_instability_reported=true crosses GAIT_INSTABILITY's strength-2 threshold on its
// own (+2). The safety gate then requires a gait_stability answer before it will treat
// unaided walking as safe — with none given, walk_20 is NEEDS_MORE_EVIDENCE and (with
// this toy 4-action pool) there is no other viable candidate either.
{
  const ch = sedentaryClinicalHistory({ gait_instability_reported: true });
  const r = await runFixtureEngine({ person: basePerson, clinicalHistory: ch });
  report('S3', 'GAIT_INSTABILITY activates (PREDICTED_CURRENT) from the self-report',
    r.node_states.find(s => s.node_id === 'GAIT_INSTABILITY')?.current_state === 'PREDICTED_CURRENT');
  const walk = walkCandidate(r.next_best_action);
  report('S3', 'walk_20 is blocked pending a gait_stability answer (NEEDS_MORE_EVIDENCE), not silently offered',
    walk?.safety?.level === 'NEEDS_MORE_EVIDENCE', JSON.stringify(walk?.safety));
  report('S3', 'no unaided-walking action is actually selected',
    r.next_best_action.selected?.action_id !== 'walk_20');
}

// ── S4: fall + unstable gait together steer to a supported balance action, not a walk ──
// Two converging signals (recent_falls + gait_stability="Ne.") cross the strength-2
// threshold with medium confidence. The engine should steer away from unaided walking
// toward a supported, modified action instead of either blocking entirely or silently
// prescribing a plain walk.
{
  const ch = sedentaryClinicalHistory({ recent_falls: true, gait_stability: 'Ne.' });
  const r = await runFixtureEngine({ person: basePerson, clinicalHistory: ch });
  report('S4', 'GAIT_INSTABILITY activates with medium confidence (two converging signals)',
    r.node_states.find(s => s.node_id === 'GAIT_INSTABILITY')?.confidence === 'medium');
  const selected = r.next_best_action.selected;
  report('S4', 'selected action is not unaided walking',
    selected?.action_id !== 'walk_20', JSON.stringify(selected?.action_id));
  report('S4', 'selected action is SAFE_WITH_MODIFICATION, not a bare SAFE walk',
    selected?.safety?.level === 'SAFE_WITH_MODIFICATION', JSON.stringify(selected?.safety));
}

// ── S5: a reported medication that matches no DIAG_KEYWORDS creates no diagnosis ───
// "Beru léky na ředění krve" (blood thinners) has no entry in DIAG_KEYWORDS
// (api/engine/adapter.js) — confirms it silently creates no diagnosis rather than
// matching something wrong. This is the root fact behind the clinical_context-repeat
// bug fixed earlier: a real answer that maps to nothing is still a real answer.
{
  const id = mapDiagnosis('Beru léky na ředění krve.');
  report('S5', '"léky na ředění krve" maps to no known diagnosis ID', id === null, String(id));
}

if (failures > 0) {
  console.log(`\n${failures} FAILED`);
  process.exit(1);
}
console.log('\nALL PASS — safety scenario suite');
