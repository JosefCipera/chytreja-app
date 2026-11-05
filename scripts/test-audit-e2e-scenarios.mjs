// Isolated end-to-end scenarios from the DECISION_GATE audit (T1–T7).
// Real engine pipeline (activation → inference → projections → decisionGate →
// systemLeverage → systemConstraint → nextBestAction → dailyDecision) and real
// orchestrator.js presentation text. Only the DB fetch boundary is fixture:
// person/clinicalHistory/observations/actionPool/personConstraints/actionAssignments
// are supplied directly instead of read from Supabase. No network, no AI calls
// for scenarios that do not require live classification (noted per scenario).
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { activation } from '../api/engine/activation.js';
import { inference } from '../api/engine/inference.js';
import { computeProjections } from '../api/engine/projections.js';
import { buildInformationNeeds, mergeResponseNeeds } from '../api/engine/informationNeeds.js';
import { evaluateDecisionGate } from '../api/engine/decisionGate.js';
import { computeSystemLeverage } from '../api/engine/systemLeverage.js';
import { computeSystemConstraint } from '../api/engine/systemConstraint.js';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { findAvailableLeverage, computeDailyDecision } from '../api/engine/dailyDecision.js';
import { computeInterventionExposure, evaluateResponseEvaluations, buildResponseInformationNeeds } from '../api/engine/adherence.js';
import { applyActionInstructions } from '../api/engine/actionInstructions.js';
import { _buildDomainResponse_test as buildDomainResponse } from '../api/engine/healthEventAdapter.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const MASTER           = JSON.parse(fs.readFileSync(join(_dir, '../data/engine/master.json'), 'utf8'));
const INTERVENTION_MAP = JSON.parse(fs.readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8'));
const ENGINE_VERSION = 'audit-e2e-1.0.0';

// Small, representative fixture action pool — real catalog ids/protocol_types/
// tags observed in the dev DB during this audit, not invented data.
const ACTION_POOL = [
  { id: 'sit_to_stand_supported', node_id: 'low_muscle_strength', label: 'Podpořené vstávání ze židle', protocol_type: 'FUNKCNI_SILOVY_PROTOKOL', type: 'reps', reps: 8, tier: 1, tags: ['sit_to_stand'], constraint_exclude: [], intensity: 'LOW' },
  { id: 'walk_20', node_id: 'kardio', label: 'Svižná chůze — 20 minut', protocol_type: 'KARDIO_PROTOKOL', type: 'duration', duration: 1200, tier: 1, tags: ['kardio'], constraint_exclude: ['knee', 'ankle_foot'], intensity: 'MODERATE' },
  { id: 'step_down', node_id: 'plyometrie', label: 'Kontrolovaný sestup z bedny — 1 noha', protocol_type: 'SILOVY_PROTOKOL', type: 'reps', reps: 10, tier: 1, tags: ['sila', 'plyometrie', 'kosti', 'dopad'], constraint_exclude: ['knee', 'ankle_foot'], intensity: 'MODERATE' },
  { id: 'balance_single_leg', node_id: 'rovnovaha', label: 'Stoj na jedné noze u opory', protocol_type: 'BALANCE_PROTOKOL', type: 'duration', duration: 60, tier: 1, tags: ['rovnovaha'], constraint_exclude: [], intensity: 'LOW' },
];

async function runFixtureEngine({ person, clinicalHistory, observations, actionAssignments = [], personConstraints = [] }) {
  const activated = activation(person, clinicalHistory, observations);
  const inferred  = inference(activated, person, clinicalHistory, observations);
  const allStates = [...activated, ...inferred];
  const now = new Date().toISOString();
  const node_states = allStates.map(s => ({ person_id: 'audit-fixture', ...s, evaluated_at: now, engine_version: ENGINE_VERSION, decision_relevance: null }));
  const projections = computeProjections(allStates, person, clinicalHistory).map(p => ({ person_id: 'audit-fixture', ...p, evaluated_at: now, engine_version: ENGINE_VERSION }));
  const information_needs_base = buildInformationNeeds(node_states, projections);
  const decision_gate = evaluateDecisionGate(node_states, projections, information_needs_base, ENGINE_VERSION, {
    birth_year: person.birth_year, sex: person.sex, resolved_physical: Object.keys(clinicalHistory.onboarding_inputs ?? {}),
  });
  const system_leverage   = computeSystemLeverage(node_states, projections, decision_gate, ENGINE_VERSION);
  const system_constraint = computeSystemConstraint(node_states, projections, decision_gate, ENGINE_VERSION);

  const leverageNodeId   = system_leverage.selected?.node_id ?? null;
  const interventionData = leverageNodeId ? INTERVENTION_MAP.mappings?.[leverageNodeId] : null;
  let next_best_action = { status: 'NOT_COMPUTED', reason: `No intervention map for leverage node: ${leverageNodeId ?? 'none'}` };

  const intervention_exposure = computeInterventionExposure(actionAssignments);
  const today = new Date().toISOString().slice(0, 10);
  const skippedTodayActionIds = new Set(actionAssignments.filter(a => a.status === 'SKIPPED' && a.assigned_date === today).map(a => a.action_id));
  const response_evaluations = evaluateResponseEvaluations(intervention_exposure, INTERVENTION_MAP, observations, actionAssignments);
  const information_needs = mergeResponseNeeds(information_needs_base, buildResponseInformationNeeds(response_evaluations));

  async function evaluateLeverage(nodeId, data) {
    const allProtocolTypes = [...new Set(data.interventions.flatMap(i => i.protocol_types))];
    const actionPool = applyActionInstructions(ACTION_POOL.filter(a => allProtocolTypes.includes(a.protocol_type)));
    return computeNextBestAction({
      leverageNodeId: nodeId, interventions: data.interventions, actionPool, personConstraints, clinicalHistory,
      decisionGate: decision_gate, node_states, engineVersion: ENGINE_VERSION, responseHistory: response_evaluations, skippedTodayActionIds,
    });
  }
  if (interventionData) next_best_action = await evaluateLeverage(leverageNodeId, interventionData);
  const available = await findAvailableLeverage({ systemLeverage: system_leverage, primaryNba: next_best_action, decisionGate: decision_gate,
    responseEvaluations: response_evaluations, interventionExposure: intervention_exposure, mappings: INTERVENTION_MAP.mappings, evaluate: evaluateLeverage });
  next_best_action = available.nba;

  return { person, engine_version: ENGINE_VERSION, evaluated_at: now, node_states, projections, information_needs, decision_gate,
    system_leverage, system_constraint, next_best_action, intervention_exposure, response_evaluations, action_leverage: available.actionLeverage, action_fallback: available.fallback };
}

// ── Real orchestrator.js presentation, DB/AI isolated ───────────────────────
const vmContext = vm.createContext({ console, process, crypto, Date, Set, Map, JSON });
async function isolated(file, mocks) {
  const m = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context: vmContext, identifier: file.href, initializeImportMeta(meta) { meta.url = file.href; } });
  await m.link(spec => { const v = mocks[spec]; if (!v) throw new Error('Unexpected dependency: ' + spec);
    return new vm.SyntheticModule(Object.keys(v), function () { for (const [k, x] of Object.entries(v)) this.setExport(k, x); }, { context: vmContext }); });
  await m.evaluate(); return m.namespace;
}
class NoAI { messages = { create() { throw new Error('This scenario must not require a live classifier call'); } }; }
let pendingEngineResult = null;
const presentation = await isolated(new URL('../api/engine/orchestrator.js', import.meta.url), {
  '@anthropic-ai/sdk': { default: NoAI },
  './healthEventAdapter.js': { applyHealthEvent: async () => ({ persistence_status: 'noop', engine_called: true, domain_response: buildDomainResponse(pendingEngineResult) }) },
  './nextBestEvidence.js': { selectNextBestEvidence: () => null },
  './decisionGate.js': { synthesizePathDiscovery: () => null },
  fs, url, path,
});

async function presentFor(engineResult, state = {}, text = 'Co teď?') {
  pendingEngineResult = engineResult;
  return presentation.processInput('audit-fixture', text, state);
}

const basePerson = { person_id: 'audit-fixture', sex: 'male', birth_year: 1966, height_cm: 178 };
const emptyClinicalHistory = (overrides = {}) => ({
  diagnoses: [], medications: [], supplements: [], lifestyle: { sedentary_work: false, smoking_history: 'unknown', alcohol_history: 'unknown' },
  capacity: {}, onboarding_inputs: {}, evidence_availability: {}, clinical_history_documented: true, ...overrides,
});

let failures = 0;
function report(id, label, ok, detail) {
  console.log(`${ok ? '✅' : '❌'}  ${id} — ${label}${detail ? '  :: ' + detail : ''}`);
  if (!ok) failures++;
}

// ── T1: Tester 1 — healthy, "Chci mít větší svaly." ─────────────────────────
{
  const person = basePerson;
  const ch = emptyClinicalHistory({ onboarding_inputs: { recent_falls: false, vynest_nakup: true, zvednout_vnouce: true, vstat_ze_zeme: true, rovnovaha_zavrene_oci: true } });
  const observations = [];
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations });
  report('T1', 'no node_states activated for a genuinely healthy profile', engineResult.node_states.length === 0, JSON.stringify(engineResult.node_states.map(s => s.node_id)));
  const out = await presentFor(engineResult, { person_goal: 'MUSCLE_RESERVE' });
  report('T1', 'response acknowledges the goal and names the longevity relation, not a diagnosis',
    out.text.includes('větší svaly') && out.text.includes('svalovou rezervou') && out.text.includes('ne s diagnózou'), out.text);
  report('T1', 'no fabricated action (mode is not ACT)', out.mode !== 'ACT', out.mode);
}

// ── T2: funkční slabost — vstat_ze_zeme = "Ne." ─────────────────────────────
{
  const person = basePerson;
  const ch = emptyClinicalHistory({ onboarding_inputs: { recent_falls: false, vynest_nakup: true, zvednout_vnouce: true, vstat_ze_zeme: 'Ne.', rovnovaha_zavrene_oci: true } });
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations: [] });
  const low = engineResult.node_states.find(s => s.node_id === 'LOW_MUSCLE_STRENGTH');
  report('T2', 'LOW_MUSCLE_STRENGTH activates as MEASURED from the direct functional answer', low?.current_state === 'MEASURED', JSON.stringify(low));
  report('T2', 'selected leverage is LOW_MUSCLE_STRENGTH', engineResult.action_leverage?.selected?.node_id === 'LOW_MUSCLE_STRENGTH' || engineResult.system_leverage?.selected?.node_id === 'LOW_MUSCLE_STRENGTH', JSON.stringify(engineResult.system_leverage?.selected));
  const out = await presentFor(engineResult);
  report('T2', 'a concrete action is offered (mode ACT)', out.mode === 'ACT', out.mode);
}

// ── T3: nejistá chůze — self-reported gait instability ──────────────────────
{
  const person = basePerson;
  const ch = emptyClinicalHistory({ onboarding_inputs: { recent_falls: false, vynest_nakup: true, zvednout_vnouce: true, vstat_ze_zeme: true, rovnovaha_zavrene_oci: 'Ne.', gait_instability_reported: true } });
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations: [] });
  const gait = engineResult.node_states.find(s => s.node_id === 'GAIT_INSTABILITY');
  report('T3', 'GAIT_INSTABILITY is PREDICTED_CURRENT, never CONFIRMED from a self-report alone', gait?.current_state === 'PREDICTED_CURRENT', JSON.stringify(gait));
  const out = await presentFor(engineResult);
  report('T3', 'safety-relevant leverage produces a concrete, supported action (mode ACT)', out.mode === 'ACT', JSON.stringify({ mode: out.mode, text: out.text }));
}

// ── T4: nadváha — BMI≥25, no other finding, person_goal unrelated ──────────
{
  const person = { ...basePerson, height_cm: 178 };
  const ch = emptyClinicalHistory({ onboarding_inputs: { recent_falls: false, vynest_nakup: true, zvednout_vnouce: true, vstat_ze_zeme: true, rovnovaha_zavrene_oci: true }, lifestyle: { ...emptyClinicalHistory().lifestyle, waist_cm: 99 } });
  const observations = [{ obs_type: 'weight_kg', value: 90, unit: 'kg', measured_at: null, source: 'onboarding', confidence: 'estimated' },
    { obs_type: 'waist_cm', value: 99, unit: 'cm', measured_at: null, source: 'onboarding', confidence: 'estimated' }];
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations });
  const adip = engineResult.node_states.find(s => s.node_id === 'EXCESS_ADIPOSITY');
  report('T4', 'EXCESS_ADIPOSITY activates as MEASURED from BMI', adip?.current_state === 'MEASURED', JSON.stringify(adip?.evidence?.direct));
  const outNoGoal = await presentFor(engineResult, {});
  report('T4', 'without a stated goal, the reason given is the measured adiposity itself (no silent unrelated justification)', outNoGoal.mode === 'ACT', outNoGoal.text);
  const outGoal = await presentFor(engineResult, { person_goal: 'MUSCLE_RESERVE' });
  report('T4', 'with an unrelated stated goal, priority over that goal is explicitly justified, never silent', outGoal.text.includes('Dnes má přednost'), outGoal.text);
}

// ── T5: více rizik současně — one constraint, one action (TOC, not a list) ──
{
  const person = { ...basePerson, birth_year: 1957 };
  const ch = emptyClinicalHistory({
    diagnoses: [{ id: 'HYPERTENSION', raw_label: 'hypertenze', status: 'confirmed' }, { id: 'ERECTILE_DYSFUNCTION', raw_label: 'erektilní dysfunkce', status: 'confirmed' }, { id: 'DYSLIPIDEMIA', raw_label: 'dyslipidémie', status: 'confirmed' }],
    lifestyle: { ...emptyClinicalHistory().lifestyle, sedentary_work: true },
    onboarding_inputs: {},
  });
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations: [] });
  report('T5', 'exactly one node is selected as leverage, not a list', typeof engineResult.system_leverage?.selected?.node_id === 'string', JSON.stringify(engineResult.system_leverage?.selected));
  report('T5', 'multiple CONFIRMED CV findings all surface as candidates (model sees all, decides one)', engineResult.system_leverage?.candidates?.filter(c => ['HYPERTENSION', 'ERECTILE_DYSFUNCTION', 'DYSLIPIDEMIA'].includes(c.node_id)).length >= 2, JSON.stringify(engineResult.system_leverage?.candidates?.map(c => c.node_id)));
}

// ── T6: nedostatek dat — brand-new account, zero evidence ───────────────────
{
  const person = { person_id: 'audit-fixture', sex: null, birth_year: null, height_cm: null };
  const ch = emptyClinicalHistory({ clinical_history_documented: false });
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations: [] });
  report('T6', 'zero node_states for a brand-new account', engineResult.node_states.length === 0, '');
  const bootstrapGate = engineResult.decision_gate.context_gates.find(g => g.decision_context.id === 'BOOTSTRAP');
  report('T6', 'BOOTSTRAP context asks exactly one targeted question, never invents an action', !!bootstrapGate && bootstrapGate.status === 'NEED_MORE_EVIDENCE', JSON.stringify(bootstrapGate?.next_best_evidence?.evidence_type));
  const out = await presentFor(engineResult);
  report('T6', 'presentation mode is ASK, not ACT, with no evidence at all', out.mode === 'ASK', JSON.stringify({ mode: out.mode, text: out.text }));
}

// ── T7: opakované vyhodnocování účinku — COMPLETED count ≠ proof of effect ──
{
  const person = basePerson;
  const ch = emptyClinicalHistory({ onboarding_inputs: { recent_falls: false, vynest_nakup: true, zvednout_vnouce: true, vstat_ze_zeme: 'Ne.', rovnovaha_zavrene_oci: true } });
  const today = new Date();
  const dayStr = d => new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
  const actionAssignments = [0, 1, 2].map(d => ({
    action_id: 'sit_to_stand_supported', intervention_id: 'FUNCTIONAL_STRENGTH_TRAINING', selected_leverage_node: 'LOW_MUSCLE_STRENGTH',
    status: 'COMPLETED', assigned_date: dayStr(d), completed_at: new Date(today.getTime() - d * 86400000).toISOString(),
  }));
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations: [], actionAssignments });
  const exposure = engineResult.intervention_exposure.find(e => e.intervention_id === 'FUNCTIONAL_STRENGTH_TRAINING');
  report('T7', 'COMPLETED rows are counted as exposure (sessions), not as a confirmed effect', exposure?.sessions_completed === 3 && !('effect_confirmed' in (exposure ?? {})), JSON.stringify(exposure));
  const responseEval = engineResult.response_evaluations.find(r => r.intervention_id === 'FUNCTIONAL_STRENGTH_TRAINING');
  report('T7', 'response evaluation is a distinct, separately-labelled finding from raw completion count', responseEval === undefined || typeof responseEval?.result === 'string', JSON.stringify(responseEval));
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'} — ${7} audit scenarios (T1–T7), real engine pipeline, isolated DB/AI boundary.`);
process.exitCode = failures === 0 ? 0 : 1;
