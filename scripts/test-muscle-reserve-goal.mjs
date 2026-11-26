// Fix #1 regression: "Chci mít větší svaly." is a goal, not a diagnosis or a
// functional deficit. Pure regex + isolated presentation checks; no DB, no AI.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { readYesNo } from '../api/engine/evidenceResolution.js';
import { parseSupportedGoal } from '../api/engine/healthEventAdapter.js';

// ── 1. parseSupportedGoal: exact-phrase recognition, no false positives ──────
for (const text of [
  'chci mít větší svaly', 'Chci mít větší svaly.', 'Chtěla bych zvětšit svalovou hmotu',
  'chci zvětšit svalovou hmotnost', 'chtěl bych nabrat svaly', 'Chci nabrat svalovou hmotu.',
]) assert.equal(parseSupportedGoal(text), 'MUSCLE_RESERVE', text);

for (const text of [
  'nechci mít větší svaly', 'chci mít větší svaly a bolí mě koleno', 'řekla: chci mít větší svaly',
  'chci být silnější', 'chci zlepšit kondici', 'přibral jsem na svalech',
]) assert.equal(parseSupportedGoal(text), null, text);

// WEIGHT_LOSS must still work unchanged (no regression on the existing contract).
assert.equal(parseSupportedGoal('chci zhubnout'), 'WEIGHT_LOSS');
console.log('PASS: parseSupportedGoal recognizes MUSCLE_RESERVE as an exact phrase, rejects negation/compound/third-person, WEIGHT_LOSS unchanged.');

// ── 2. GENERAL_HEALTH_REQUEST persists as goal_text, never into symptoms ─────
{
  let writes = [];
  const db = {
    from(table) {
      const q = {
        select() { return q; }, eq() { return q; },
        maybeSingle: async () => ({ data: { symptoms: [], diagnoses: [] } }),
        upsert(row) { writes.push({ table, row }); return Promise.resolve({ error: null }); },
      };
      return q;
    },
  };
  const context = vm.createContext({ console, process, crypto, Date, Set, Map, JSON });
  async function isolated(file, mocks) {
    const m = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file.href,
      initializeImportMeta(meta) { meta.url = file.href; } });
    await m.link(spec => { const v = mocks[spec]; assert.ok(v, spec);
      return new vm.SyntheticModule(Object.keys(v), function () { for (const [k, x] of Object.entries(v)) this.setExport(k, x); }, { context }); });
    await m.evaluate(); return m.namespace;
  }
  const adapter = await isolated(new URL('../api/engine/healthEventAdapter.js', import.meta.url), {
    '@supabase/supabase-js': { createClient: () => db },
    './engine.js': { runEngine: async () => ({}) },
    './dailyDecision.js': { computeDailyDecision: () => ({ mode: 'HOLD' }) },
    './adapter.js': { mapDiagnosis: () => null },
    './evidenceResolution.js': { readYesNo },
  });
  const r = await adapter.applyHealthEvent('fixture', { event_type: 'GENERAL_HEALTH_REQUEST', payload: { text: 'Chci mít větší svaly.' } });
  assert.equal(r.persistence_status, 'ok');
  assert.equal(writes.length, 1, 'Recognized goal must take the single goal_text write path, not the symptoms audit-trail path');
  assert.equal(writes[0].table, 'user_health_profile');
  assert.deepEqual(Object.keys(writes[0].row).sort(), ['goal_text', 'user_id']);
  assert.equal(writes[0].row.goal_text, 'Chci mít větší svaly.');
  console.log('PASS: recognized muscle-mass goal persists as goal_text, never written to symptoms[].');
}

// ── 3. Presentation: acknowledges goal, explains relation, never invents an action ──
{
  const context = vm.createContext({ console, process, crypto, Date, Set, Map, JSON });
  async function isolated(file, mocks) {
    const m = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file.href,
      initializeImportMeta(meta) { meta.url = file.href; } });
    await m.link(spec => { const v = mocks[spec]; if (!v) throw new Error('Unexpected dependency: ' + spec);
      return new vm.SyntheticModule(Object.keys(v), function () { for (const [k, x] of Object.entries(v)) this.setExport(k, x); }, { context }); });
    await m.evaluate(); return m.namespace;
  }
  class AI { messages = { create() { throw new Error('No classifier call expected for DOMAIN_REQUEST nav guard'); } }; }
  const presentation = await isolated(new URL('../api/engine/orchestrator.js', import.meta.url), {
    '@anthropic-ai/sdk': { default: AI },
    './healthEventAdapter.js': {
      applyHealthEvent: async (uid, event) => makeResponse(),
    },
    './nextBestEvidence.js': { selectNextBestEvidence: () => null },
    './decisionGate.js': { synthesizePathDiscovery: () => null },
    fs, url, path,
  });

  let scenario = 'low_muscle_strength';
  function makeResponse() {
    if (scenario === 'low_muscle_strength') {
      return { persistence_status: 'noop', engine_called: true, domain_response: {
        engine_version: 'fixture', daily_decision: { mode: 'ACT', primary_item: { action_id: 'sit_to_stand_supported', intervention_id: 'FUNCTIONAL_STRENGTH_TRAINING', label: 'Podpořené vstávání ze židle.' } },
        explanation_context: { system_leverage: { node_id: 'LOW_MUSCLE_STRENGTH' }, action_context: { selected: { action_id: 'sit_to_stand_supported', intervention_id: 'FUNCTIONAL_STRENGTH_TRAINING' } } },
      } };
    }
    if (scenario === 'excess_adiposity') {
      return { persistence_status: 'noop', engine_called: true, domain_response: {
        engine_version: 'fixture', daily_decision: { mode: 'ACT', primary_item: { action_id: 'walk_20', intervention_id: 'AEROBIC_TRAINING', label: 'Svižná chůze — 20 minut.' } },
        explanation_context: { system_leverage: { node_id: 'EXCESS_ADIPOSITY' }, action_context: { selected: { action_id: 'walk_20', intervention_id: 'AEROBIC_TRAINING' } } },
      } };
    }
    // healthy: no leverage identified at all
    return { persistence_status: 'noop', engine_called: true, domain_response: {
      engine_version: 'fixture', daily_decision: { mode: 'ASK', reason_code: 'BOOTSTRAP' },
      explanation_context: { system_leverage: null, action_context: null },
    } };
  }

  const state = { person_goal: 'MUSCLE_RESERVE' };

  scenario = 'low_muscle_strength';
  let out = await presentation.processInput('fixture', 'Co teď?', state);
  assert.ok(out.text.startsWith('Chceš mít větší svaly. To souvisí se svalovou rezervou pro dlouhověkost.'), out.text);
  assert.ok(!out.text.includes('Dnes má přednost'), 'Action already targets muscle reserve — no competing-priority justification needed: ' + out.text);

  scenario = 'excess_adiposity';
  out = await presentation.processInput('fixture', 'Co teď?', state);
  assert.ok(out.text.startsWith('Chceš mít větší svaly. To souvisí se svalovou rezervou pro dlouhověkost. Dnes má přednost'), out.text);

  scenario = 'healthy';
  out = await presentation.processInput('fixture', 'Co teď?', state);
  assert.ok(out.text.includes('ne s diagnózou'), out.text);
  assert.notEqual(out.mode, 'ACT', 'No leverage was identified — must not present a fabricated action: ' + JSON.stringify(out));

  console.log('PASS: presentation acknowledges the muscle-mass goal, explains the longevity relation, justifies a differing priority, and never fabricates an action when no leverage exists.');
}
