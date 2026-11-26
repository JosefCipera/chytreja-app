// Text-quality audit across the 4 longevity areas we're testing first
// (nadváha / pohyb / síla / rovnováha), per CLAUDE.md §8 "CHJ Language Rules".
//
// Same isolation pattern as test-audit-e2e-scenarios.mjs: real engine pipeline
// (activation → inference → projections → decisionGate → systemLeverage →
// systemConstraint → nextBestAction → dailyDecision) and real orchestrator.js
// presentation text. No network, no live AI classifier call.
//
// Scope, deliberately narrow (per the agreed pairwise-reduction approach):
// one shared "no data" scenario (ASK, same for every area) + one "weak
// evidence" and one "strong evidence" scenario per area = 9 total, not a
// full cross-product. Each resulting text is checked against the hard,
// already-decided rules; this script does NOT judge tone/voice — that
// needs a human read of what's flagged (or of everything, if nothing is).
import vm from 'node:vm';
import fs from 'node:fs';
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
const ENGINE_VERSION = 'text-audit-1.0.0';

const ACTION_POOL = [
  { id: 'sit_to_stand_supported', node_id: 'low_muscle_strength', label: 'Podpořené vstávání ze židle', protocol_type: 'FUNKCNI_SILOVY_PROTOKOL', type: 'reps', reps: 8, tier: 1, tags: ['sit_to_stand'], constraint_exclude: [], intensity: 'LOW' },
  { id: 'walk_20', node_id: 'kardio', label: 'Svižná chůze — 20 minut', protocol_type: 'KARDIO_PROTOKOL', type: 'duration', duration: 1200, tier: 1, tags: ['kardio'], constraint_exclude: ['knee', 'ankle_foot'], intensity: 'MODERATE' },
  { id: 'step_down', node_id: 'plyometrie', label: 'Kontrolovaný sestup z bedny — 1 noha', protocol_type: 'SILOVY_PROTOKOL', type: 'reps', reps: 10, tier: 1, tags: ['sila', 'plyometrie', 'kosti', 'dopad'], constraint_exclude: ['knee', 'ankle_foot'], intensity: 'MODERATE' },
  { id: 'balance_single_leg', node_id: 'rovnovaha', label: 'Stoj na jedné noze u opory', protocol_type: 'BALANCE_PROTOKOL', type: 'duration', duration: 60, tier: 1, tags: ['rovnovaha'], constraint_exclude: [], intensity: 'LOW' },
  // Mirrors the real catalog's 'rovnovaha_habit' — the safe fallback Variant A relies on.
  { id: 'balance_habit', node_id: 'rovnovaha', label: 'Proveď dnes rovnovážné cvičení', protocol_type: 'BALANCE_PROTOKOL', type: 'habit', tier: 1, tags: ['rovnovaha'], constraint_exclude: [], intensity: 'LOW' },
];

async function runFixtureEngine({ person, clinicalHistory, observations, actionAssignments = [], personConstraints = [] }) {
  const activated = activation(person, clinicalHistory, observations);
  const inferred  = inference(activated, person, clinicalHistory, observations);
  const allStates = [...activated, ...inferred];
  const now = new Date().toISOString();
  const node_states = allStates.map(s => ({ person_id: 'text-audit-fixture', ...s, evaluated_at: now, engine_version: ENGINE_VERSION, decision_relevance: null }));
  const projections = computeProjections(allStates, person, clinicalHistory).map(p => ({ person_id: 'text-audit-fixture', ...p, evaluated_at: now, engine_version: ENGINE_VERSION }));
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
  fs, url: await import('node:url'), path: await import('node:path'),
});
async function presentFor(engineResult, state = {}, text = 'Co teď?') {
  pendingEngineResult = engineResult;
  return presentation.processInput('text-audit-fixture', text, state);
}

const basePerson = { person_id: 'text-audit-fixture', sex: 'male', birth_year: 1966, height_cm: 178 };
const healthyOi = { recent_falls: false, vynest_nakup: true, zvednout_vnouce: true, vstat_ze_zeme: true, rovnovaha_zavrene_oci: true, gait_instability_reported: false, balanc_jedna_noha: true };
const emptyClinicalHistory = (overrides = {}) => ({
  diagnoses: [], medications: [], supplements: [], lifestyle: { sedentary_work: false, smoking_history: 'unknown', alcohol_history: 'unknown' },
  capacity: {}, onboarding_inputs: {}, evidence_availability: {}, clinical_history_documented: true, ...overrides,
});

// ── Deterministic rule check — CLAUDE.md §8 "CHJ Language Rules" ─────────────
// Flags objective violations only. Does NOT judge tone/voice/clarity — that's
// the human pass on whatever this flags (or on everything, if nothing is).
const FORBIDDEN_WORDS = ['musíš', 'musíte', 'okamžitě', 'je důležité', 'měl bys', 'měla bys', 'hrozí', 'ohrožuje', 'samostatnost', 'závislý', 'závislá', 'závislé', 'pomoc druhých', 'špatně', 'trpí', 'trpíš'];
function checkText(mode, text) {
  const issues = [];
  if (!text) return issues;
  const lower = text.toLowerCase();
  for (const w of FORBIDDEN_WORDS) if (lower.includes(w)) issues.push(`zakázané slovo: "${w}"`);
  if (['ACT', 'ASK', 'HOLD'].includes(mode)) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words > 15) issues.push(`${words} slov (limit 15 pro ${mode})`);
    const sentences = (text.match(/[.!?]+(?=\s|$)/g) || []).length;
    if (sentences > 1) issues.push(`${sentences} vět (limit 1 pro ${mode})`);
  }
  if (/\b(Vy|Váš|Vaše|Vaši|Vám|Vás|Vašeho|Vaší|Vašich)\b/.test(text)) issues.push('možné vykání (formální tvar s velkým V)');
  return issues;
}

let totalIssues = 0;
function runScenario(id, label, engineResult, state = {}) {
  return presentFor(engineResult, state).then(out => {
    const issues = checkText(out.mode, out.text);
    totalIssues += issues.length;
    console.log(`\n${issues.length === 0 ? '✅' : '⚠️ '} ${id} — ${label}`);
    console.log(`   mode=${out.mode}  text="${out.text}"`);
    if (issues.length) issues.forEach(i => console.log(`   ✗ ${i}`));
    return { id, label, mode: out.mode, text: out.text, issues };
  });
}

const results = [];

// ── S0: shared "no data" — brand-new account, zero evidence ────────────────
{
  const person = { person_id: 'text-audit-fixture', sex: null, birth_year: null, height_cm: null };
  const ch = emptyClinicalHistory({ clinical_history_documented: false });
  const engineResult = await runFixtureEngine({ person, clinicalHistory: ch, observations: [] });
  results.push(await runScenario('S0', 'žádná data (sdílené pro všechny oblasti)', engineResult));
}

// ── Síla / LOW_MUSCLE_STRENGTH ───────────────────────────────────────────────
{
  const ch = emptyClinicalHistory({ onboarding_inputs: { ...healthyOi, vynest_nakup: 'Ne.' } });
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations: [] });
  results.push(await runScenario('S1', 'síla — slabá evidence (1 negativní self-report)', engineResult));
}
{
  const ch = emptyClinicalHistory({ onboarding_inputs: { ...healthyOi, vynest_nakup: 'Ne.', zvednout_vnouce: 'Ne.', vstat_ze_zeme: 'Ne.' } });
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations: [] });
  results.push(await runScenario('S2', 'síla — silná evidence (3 negativní self-reporty)', engineResult));
}

// ── Rovnováha / GAIT_INSTABILITY ─────────────────────────────────────────────
{
  const ch = emptyClinicalHistory({ onboarding_inputs: { ...healthyOi, gait_instability_reported: true } });
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations: [] });
  results.push(await runScenario('S3', 'rovnováha — slabá evidence (jen self-report nejistoty)', engineResult));
}
{
  const ch = emptyClinicalHistory({ onboarding_inputs: { ...healthyOi, gait_instability_reported: true, balanc_jedna_noha: 'Ne.' } });
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations: [] });
  results.push(await runScenario('S4', 'rovnováha — silná evidence (self-report + neúspěšný test)', engineResult));
}
{
  // Model Kovářová-like case: gait instability + already using a walking aid.
  // Confirms the new walking-aid guard in nextBestAction.js steers away from an
  // unsupported single-leg stand instead of appending more safety sentences to it.
  const ch = emptyClinicalHistory({ onboarding_inputs: { ...healthyOi, gait_instability_reported: true, current_assistive_device: 'TWO_CRUTCHES' } });
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations: [] });
  results.push(await runScenario('S4b', 'rovnováha — nestabilita chůze + používá dvě hole (walking-aid guard)', engineResult));
}

// ── Nadváha / EXCESS_ADIPOSITY ────────────────────────────────────────────────
{
  const ch = emptyClinicalHistory({ onboarding_inputs: healthyOi });
  const observations = [{ obs_type: 'weight_kg', value: 81, unit: 'kg', measured_at: null, source: 'onboarding', confidence: 'estimated' }];
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations });
  results.push(await runScenario('S5', 'nadváha — slabá evidence (jen BMI ~25.6, bez obvodu pasu)', engineResult));
}
{
  const ch = emptyClinicalHistory({ onboarding_inputs: healthyOi, lifestyle: { ...emptyClinicalHistory().lifestyle, waist_cm: 99 } });
  const observations = [
    { obs_type: 'weight_kg', value: 90, unit: 'kg', measured_at: null, source: 'onboarding', confidence: 'estimated' },
    { obs_type: 'waist_cm',  value: 99, unit: 'cm', measured_at: null, source: 'onboarding', confidence: 'estimated' },
  ];
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations });
  results.push(await runScenario('S6', 'nadváha — silná evidence (BMI ~28.4 + obvod pasu)', engineResult));
}

// ── Pohyb / PHYSICAL_INACTIVITY ──────────────────────────────────────────────
{
  const ch = emptyClinicalHistory({ onboarding_inputs: healthyOi, lifestyle: { ...emptyClinicalHistory().lifestyle, sedentary_work: true } });
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations: [] });
  results.push(await runScenario('S7', 'pohyb — slabá evidence (jen sedavé zaměstnání)', engineResult));
}
{
  const ch = emptyClinicalHistory({ onboarding_inputs: healthyOi });
  const today = new Date();
  const dayStr = d => new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
  const observations = [0, 1, 2, 3, 4].map(d => ({ obs_type: 'activity_level', value: 'low', source: 'daily_checkin', measured_at: dayStr(d), confidence: 'confirmed' }));
  const engineResult = await runFixtureEngine({ person: basePerson, clinicalHistory: ch, observations });
  results.push(await runScenario('S8', 'pohyb — silná evidence (5/5 dní nízká aktivita)', engineResult));
}

const flagged = results.filter(r => r.issues.length > 0);
console.log(`\n${'─'.repeat(60)}`);
console.log(`${results.length} scénářů, ${flagged.length} s porušením pravidla, ${totalIssues} nálezů celkem.`);
if (flagged.length) {
  console.log('\nK ručnímu rozhodnutí (porušují pravidlo, nebo text pod nimi):');
  flagged.forEach(r => console.log(`  ${r.id}: ${r.issues.join('; ')}`));
}
process.exitCode = 0; // informational audit, not a pass/fail gate
