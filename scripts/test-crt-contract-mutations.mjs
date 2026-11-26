import assert from 'node:assert/strict';
import { checkCrtInputContracts } from './ai-tester/crt-combination-contracts.mjs';
const healthy = { vstat_ze_zeme: true, zvednout_vnouce: true, vynest_nakup: true, recent_falls: false, rovnovaha_zavrene_oci: false };
const base = { scenario: { physical: healthy, profile: { weight: 72 } }, initialPhysical: healthy,
  health: { diagnoses: [] }, initialEngine: { node_states: [], system_leverage: {}, next_best_action: {} }, session: {} };
function fails(input) { const failed = []; checkCrtInputContracts({ ...input, check(id, ok) { if (!ok) failed.push(id); } }); return failed; }
assert.deepEqual(fails(base), []);
const injectedAdiposity = structuredClone(base);
injectedAdiposity.initialEngine.node_states.push({ node_id: 'EXCESS_ADIPOSITY', current_state: 'MEASURED' });
assert(fails(injectedAdiposity).includes('weight-wish-is-not-adiposity-measurement'));
const inventedStrength = structuredClone(base);
inventedStrength.initialEngine.node_states.push({ node_id: 'LOW_MUSCLE_STRENGTH', current_state: 'MEASURED', evidence: { direct: [{ source: 'ONBOARDING', question_id: 'vstat_ze_zeme', value: true }] } });
assert(fails(inventedStrength).includes('strength-provenance'));
const fabricatedPath = structuredClone(base);
fabricatedPath.scenario.physical.vstat_ze_zeme = false; fabricatedPath.initialPhysical.vstat_ze_zeme = false;
fabricatedPath.initialEngine.node_states.push({ node_id: 'LOW_MUSCLE_STRENGTH', current_state: 'MEASURED', evidence: { direct: [{ source: 'ONBOARDING', question_id: 'vstat_ze_zeme', value: false }] } });
fabricatedPath.initialEngine.system_leverage.selected = { node_id: 'LOW_MUSCLE_STRENGTH' };
fabricatedPath.session.last_domain_response = { explanation_context: { causal_context: { affected_nodes: ['INVENTED_OUTCOME'], edges_used: [{ edge_id: 'invented', from: 'LOW_MUSCLE_STRENGTH', to: 'INVENTED_OUTCOME', relation: 'CAUSES' }] }, goal_gateway_context: { gateway_nodes_reached: ['INVENTED_GOAL'] } } };
const pathFailures = fails(fabricatedPath);
for (const id of ['crt-causal-path-exists', 'crt-edges-are-real', 'future-goal-has-crt-path']) assert(pathFailures.includes(id));
console.log('PASS: contract oracle rejects invented adiposity, strength evidence, CRT edges, outcomes and goal paths.');
