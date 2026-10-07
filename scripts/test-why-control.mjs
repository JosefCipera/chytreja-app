import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
let classifierCalls = 0, engineCalls = 0;
class AI { messages = { create() { classifierCalls++; throw Error('Classifier unavailable'); } }; }
const context = vm.createContext({ console, process, crypto, Date, Set, Map, JSON });
const mocks = { '@anthropic-ai/sdk': { default: AI }, './healthEventAdapter.js': { applyHealthEvent() { engineCalls++; throw Error('Engine must not run'); } }, './nextBestEvidence.js': { selectNextBestEvidence() {} }, './decisionGate.js': { synthesizePathDiscovery() {} }, fs, url, path };
const file = new URL('../api/engine/orchestrator.js', import.meta.url);
const module = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file.href, initializeImportMeta(meta) { meta.url = file.href; } });
await module.link(spec => { const values = mocks[spec]; assert.ok(values, spec); return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context }); });
await module.evaluate();
const processInput = module.namespace.processInput;
const explanation_context = { system_leverage: { node_id: 'GAIT_INSTABILITY' }, reported_gait_evidence: { inferred_from_nodes: [{ question_id: 'gait_instability_reported', value: true }] } };
for (const mode of ['ACT', 'HOLD', 'SAFETY']) {
  for (const text of ['Proč?', 'proc?', 'PROČ', '  Proč?  ']) {
    const response = await processInput('isolated-why', text, { last_daily_decision: { mode }, last_domain_response: { explanation_context } });
    assert.equal(response.mode, 'EXPLAIN');
    assert.ok(response.text.includes('Uvádíš nejistotu při chůzi.'));
  }
}
assert.equal((await processInput('isolated-why', 'Proč?', {})).mode, 'EXPLAIN');
const unsupported = await processInput('isolated-why', 'Proč?', { unsupported_request: { kind: 'medical' }, last_domain_response: { explanation_context } });
assert.notEqual(unsupported.mode, 'EXPLAIN');
const medical = await processInput('isolated-why', 'Proč mám synkopu?', { last_domain_response: { explanation_context } });
assert.notEqual(medical.mode, 'EXPLAIN');
assert.equal(classifierCalls, 0);
assert.equal(engineCalls, 0);
console.log('PASS: exact WHY controls read cached context without classifier/engine; missing context and unsupported medical scope preserved.');
