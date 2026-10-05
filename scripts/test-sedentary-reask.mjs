// Regression: real processInput, isolated adapter/classifier; no DB or credentials.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

let events = [];
const dd = { mode: 'ASK', reason_code: 'ASK_BLOCKING', primary_item: null };
let engineDecision = dd;
const result = () => ({ persistence_status: 'ok', engine_called: true, warnings: [], domain_response: {
  daily_decision: engineDecision, explanation_context: { system_leverage: { node_id: 'LOW_MUSCLE_STRENGTH' } },
} });
class AI { messages = { create: async () => ({ content: [{ type: 'tool_use', input: { event_type: 'DOMAIN_REQUEST', payload: {} } }] }) }; }
const mocks = {
  '@anthropic-ai/sdk': { default: AI },
  './healthEventAdapter.js': { applyHealthEvent: async (_uid, event) => { events.push(event); return result(); } },
  './nextBestEvidence.js': { selectNextBestEvidence: () => null },
  './decisionGate.js': { synthesizePathDiscovery: () => null },
  fs, url, path,
};
const file = new URL('../api/engine/orchestrator.js', import.meta.url);
const context = vm.createContext({ console, process, crypto, Date, Set, Map, JSON });
const mod = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {
  context, identifier: file.href, initializeImportMeta(meta) { meta.url = file.href; },
});
await mod.link(spec => {
  const values = mocks[spec];
  assert.ok(values, `Unexpected dependency ${spec}`);
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [k, v] of Object.entries(values)) this.setExport(k, v);
  }, { context });
});
await mod.evaluate();
const { processInput } = mod.namespace;
const question = { text: 'Přibližně kolik hodin za běžný den prosedíš?', evidence_type: 'sedentary_hours_day', type: 'GENERAL' };
for (const text of ['7', '7 hodin', '0', '0 hodin', '7,5 hodin', '24 hodin']) {
  events = [];
  const r = await processInput('isolated-test', text, { pending_question: question, question_budget_remaining: 3 });
  assert.equal(events[0].event_type, 'ANSWER_TO_EVIDENCE_QUESTION');
  assert.equal(events[0].payload.value, Number.parseFloat(text.replace(',', '.')));
  assert.equal(r.session_updates.pending_question, null, `Repeated question for ${text}`);
  assert.equal(r.mode, 'ASK'); // Never turn lack of eligible action into invented ACT.
  assert.match(r.text, /Údaj o sezení už mám/);
}
const known = await processInput('isolated-test', 'Co mám dělat?', {
  hp_physical: { sedentary_hours_day: 7 }, question_budget_remaining: 3,
  last_daily_decision: dd,
});
assert.equal(known.session_updates.pending_question, null);
assert.match(known.text, /Údaj o sezení už mám/);
const unknown = await processInput('isolated-test', 'Co mám dělat?', { question_budget_remaining: 3 });
assert.equal(unknown.session_updates.pending_question.evidence_type, 'sedentary_hours_day');
console.log('PASS: six scalar answers, known DB value on next turn, unknown value still asked; ASK preserved.');
engineDecision = {mode: 'HOLD', reason_code: 'HOLD_SKIPPED_TODAY', primary_item: null};
const hold = await processInput('isolated-test', 'Co mám dělat?', {
  question_budget_remaining: 0,
  current_action_assignment: {action_id: 'old', intervention_id: 'old'},
});
assert.equal(hold.mode, 'HOLD');
assert.equal(hold.debug.reason_code, 'HOLD_SKIPPED_TODAY');
assert.equal(hold.session_updates.current_action_assignment, null);
assert.equal(hold.session_updates.pending_question, null);
assert.equal(hold.buttons.length, 0);
assert.match(hold.text, /přeskočil/);
assert.doesNotMatch(hold.text, /hotovo|podkladů|prosedíš/i);
console.log('PASS: exhausted question budget does not override skipped-action HOLD.');
