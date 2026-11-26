// Fix #3 regression: a direct longevity / healthy-ageing / self-sufficiency
// wish is the CHJ mission itself — recognize it (several phrasings, not one
// fixed sentence), acknowledge it, never file it as a symptom, never invent
// a constraint/deficit/action. Pure regex + isolated presentation; no DB, no AI.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { readYesNo } from '../api/engine/evidenceResolution.js';
import { parseSupportedGoal } from '../api/engine/healthEventAdapter.js';

// ── 1. parseSupportedGoal: several real phrasings, not one fixed sentence ──
for (const text of [
  'Chci se dožít 100 let ve zdraví.',
  'Chci se dožít 100 let ve zdraví jako Japonci.',
  'chci se dožít vysokého věku ve zdraví',
  'Chci žít dlouho a zdravě.',
  'Chci dlouho žít ve zdraví.',
  'chci zdravě zestárnout',
  'Chci zdravě stárnout.',
  'Chci zůstat soběstačný co nejdéle.',
  'Chtěla bych zůstat soběstačná co nejdéle.',
  'Chci být zdravý a fit i v 85 letech.',
  'chtěl bych být fit i v 90 letech',
  'Chci se zaměřit na dlouhověkost.',
]) assert.equal(parseSupportedGoal(text), 'LONGEVITY_INTENT', text);

// ── 2. Negation, compound statements, quoted/third-person stay excluded ────
for (const text of [
  'Nechci se dožít 100 let ve zdraví.',
  'Chci se dožít 100 let ve zdraví a mám cukrovku.',
  'Říkala: chci žít dlouho a zdravě.',
  'Táta chce zůstat soběstačný co nejdéle.',
  'Nevím, jestli chci žít dlouho.',
]) assert.equal(parseSupportedGoal(text), null, text);

// WEIGHT_LOSS / MUSCLE_RESERVE must stay unchanged (no cross-regression).
assert.equal(parseSupportedGoal('chci zhubnout'), 'WEIGHT_LOSS');
assert.equal(parseSupportedGoal('chci mít větší svaly'), 'MUSCLE_RESERVE');
console.log('PASS: parseSupportedGoal recognizes LONGEVITY_INTENT across many phrasings, rejects negation/compound/third-person, WEIGHT_LOSS/MUSCLE_RESERVE unchanged.');

// ── 3. GENERAL_HEALTH_REQUEST persists as goal_text, never into symptoms ────
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
  const r = await adapter.applyHealthEvent('fixture', { event_type: 'GENERAL_HEALTH_REQUEST', payload: { text: 'Chci se dožít 100 let ve zdraví.' } });
  assert.equal(r.persistence_status, 'ok');
  assert.equal(writes.length, 1, 'Recognized longevity intent must take the goal_text write path, not the symptoms audit-trail path');
  assert.deepEqual(Object.keys(writes[0].row).sort(), ['goal_text', 'user_id']);
  assert.equal(writes[0].row.goal_text, 'Chci se dožít 100 let ve zdraví.');
  console.log('PASS: recognized longevity intent persists as goal_text, never written to symptoms[].');
}

// ── 4. Presentation: acknowledges the mission, never overrides the decision ─
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
  let scenario = 'no_evidence';
  function makeResponse() {
    if (scenario === 'no_evidence') {
      // T6-style: brand-new, zero node_states — BOOTSTRAP asks one question.
      return { persistence_status: 'noop', engine_called: true, domain_response: {
        engine_version: 'fixture', daily_decision: { mode: 'ASK', reason_code: 'BOOTSTRAP' },
        explanation_context: { system_leverage: null, action_context: null },
      } };
    }
    // sufficient_evidence: CHJ already has enough data for a concrete action.
    return { persistence_status: 'noop', engine_called: true, domain_response: {
      engine_version: 'fixture', daily_decision: { mode: 'ACT', primary_item: { action_id: 'sit_to_stand_supported', intervention_id: 'FUNCTIONAL_STRENGTH_TRAINING', label: 'Podpořené vstávání ze židle.' } },
      explanation_context: { system_leverage: { node_id: 'LOW_MUSCLE_STRENGTH' }, action_context: { selected: { action_id: 'sit_to_stand_supported', intervention_id: 'FUNCTIONAL_STRENGTH_TRAINING' } } },
    } };
  }
  const presentation = await isolated(new URL('../api/engine/orchestrator.js', import.meta.url), {
    '@anthropic-ai/sdk': { default: AI },
    './healthEventAdapter.js': { applyHealthEvent: async () => makeResponse() },
    './nextBestEvidence.js': { selectNextBestEvidence: () => null },
    './decisionGate.js': { synthesizePathDiscovery: () => null },
    fs, url, path,
  });
  const state = { person_goal: 'LONGEVITY_INTENT' };

  scenario = 'no_evidence';
  let out = await presentation.processInput('fixture', 'Co teď?', state);
  assert.ok(out.text.startsWith('Přesně to je poslání Chytrého já.'), out.text);
  assert.equal(out.mode, 'ASK', 'Insufficient evidence must still ask, not fabricate an action: ' + out.mode);

  scenario = 'sufficient_evidence';
  out = await presentation.processInput('fixture', 'Co teď?', state);
  assert.ok(out.text.startsWith('Přesně to je poslání Chytrého já.'), out.text);
  assert.equal(out.mode, 'ACT', 'With enough evidence the standard decision (ACT) must proceed unchanged: ' + out.mode);

  console.log('PASS: presentation acknowledges the longevity mission and otherwise defers entirely to the unchanged DECISION_GATE outcome, with and without sufficient evidence.');
}
