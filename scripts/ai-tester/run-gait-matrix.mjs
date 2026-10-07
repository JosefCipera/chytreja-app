// Full app pipeline; real public catalog; synthetic profiles and in-memory writes only.
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const live = process.argv.includes('--live');
const catalogArg = process.argv.find(a => a.startsWith('--catalog='));
const sourceRoot = new URL('../../', import.meta.url);
let catalog, catalogMeta;
try {
  if (live && !process.env.ANTHROPIC_API_KEY) throw Error('ANTHROPIC_API_KEY unavailable');
  if (catalogArg) {
    catalog = JSON.parse(fs.readFileSync(catalogArg.slice(10), 'utf8'));
    catalogMeta = { source: 'provided public catalog snapshot', captured_at: null };
  } else {
    // Public SELECT only, using the application's publishable browser key.
    // No service-role credential, private table, or database write is involved.
    const config = fs.readFileSync(new URL('app/js/universe/supabaseClient.js', sourceRoot), 'utf8');
    const base = config.match(/const supabaseUrl\s*=\s*'([^']+)'/)?.[1];
    const publishable = config.match(/const supabaseKey\s*=\s*'([^']+)'/)?.[1];
    if (!base || !publishable) throw Error('Public catalog configuration unavailable');
    const columns = 'id,node_id,label,protocol_type,type,duration,reps,tier,tags,constraint_exclude,intensity,modality,support_sides,stability_support,upper_body_demand,load_distribution,active';
    catalog = [];
    for (let offset = 0; ; offset += 500) {
      const endpoint = new URL('/rest/v1/longevity_actions', base);
      endpoint.search = new URLSearchParams({ select: columns, active: 'eq.true', order: 'id', limit: '500', offset: String(offset) });
      const response = await fetch(endpoint, { headers: { apikey: publishable }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error(`Public catalog HTTP ${response.status}`);
      const page = await response.json();
      if (!Array.isArray(page)) throw Error('Catalog response is not an array');
      catalog.push(...page);
      if (page.length < 500) break;
    }
    catalogMeta = { source: 'public.longevity_actions, all active rows, paginated SELECT', captured_at: new Date().toISOString() };
  }
  if (!catalog.length || new Set(catalog.map(a => a.id)).size !== catalog.length) throw Error('Empty or duplicate catalog');
  catalogMeta.rows = catalog.length;
  catalogMeta.sha256 = crypto.createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
  if (process.env.AI_TESTER_CATALOG_OUT) fs.writeFileSync(process.env.AI_TESTER_CATALOG_OUT, JSON.stringify({ ...catalogMeta, actions: catalog }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ status: 'BLOCKED', reason: error.message })); process.exit(2);
}
const ActualAI = live ? (await import('@anthropic-ai/sdk')).default : null;
const baseProfile = { birth_year: 1959, gender: 'male', height: 178, weight: 72 };
const baseHealth = { diagnoses: [], symptoms: [], medications: [], supplements: [], labs: {}, lifestyle: { waist_cm: 84 }, capacity: {}, physical: { recent_falls: false, vynest_nakup: true, vstat_ze_zeme: true, zvednout_vnouce: true, rovnovaha_zavrene_oci: true } };
const variants = [
  'Jsem nejistý při chůzi.',
  'Při chůzi mám někdy pocit, že nejdu rovně.',
  'Když jdu, občas zavrávorám.',
  'Při chůzi ztrácím rovnováhu.',
  'Chodím nejistě.',
  'Při chůzi se někdy motám.',
];
const scenarios = [
  ...variants.map((text, i) => ({ id: `spoken-${i + 1}`, text, report: true })),
  ...[1, 2].map(i => ({ id: `spoken-stagger-repeat-${i}`, text: variants[2], report: true })),
  { id: 'stable', text: 'Chodím jistě a bez problémů.', report: false },
  { id: 'negated', text: 'Nejsem při chůzi nejistý.', report: false },
  { id: 'third-person', text: 'Můj otec je nejistý při chůzi.', report: null },
  { id: 'historical', text: 'Před pěti lety jsem byl nejistý při chůzi.', report: null },
  { id: 'hypothetical', text: 'Co kdybych byl někdy nejistý při chůzi?', report: null },
  { id: 'uncertain', text: 'Nevím, jestli mám potíže s rovnováhou.', report: null },
  { id: 'tester137-profile', text: variants[0], report: true, profile: { weight: 88 }, lifestyle: { waist_cm: 99 }, physical: { rovnovaha_zavrene_oci: false } },
  { id: 'recent-fall', text: variants[0], report: true, physical: { recent_falls: true } },
  { id: 'low-strength', text: variants[0], report: true, physical: { vstat_ze_zeme: false } },
  { id: 'knee-unknown', text: variants[0], report: true, constraints: [{ constraint_type: 'physical', constraint_key: 'knee', constraint_value: 'koleno', severity: null }] },
  { id: 'knee-moderate', text: variants[0], report: true, constraints: [{ constraint_type: 'physical', constraint_key: 'knee', constraint_value: 'koleno', severity: 'moderate' }] },
  { id: 'knee-severe', text: variants[0], report: true, constraints: [{ constraint_type: 'physical', constraint_key: 'knee', constraint_value: 'koleno', severity: 'severe' }] },
  { id: 'combined', text: variants[0], report: true, profile: { gender: 'female', height: 165, weight: 91 }, lifestyle: { waist_cm: 104 }, physical: { recent_falls: true, vstat_ze_zeme: false }, constraints: [{ constraint_type: 'physical', constraint_key: 'knee', constraint_value: 'koleno', severity: 'moderate' }] },
  { id: 'unsupported-syncope', text: 'Mám synkopu a potřebuji poradit, jak cvičit.', report: null, unsupported: true },
];

async function isolated(scenario, branch = null) {
  const uid = `isolated-${scenario.id}${branch ? '-' + branch : ''}`;
  const profile = { user_id: uid, ...baseProfile, ...scenario.profile };
  let health = { ...structuredClone(baseHealth), user_id: uid, lifestyle: { ...baseHealth.lifestyle, ...scenario.lifestyle }, physical: { ...baseHealth.physical, ...scenario.physical } };
  const constraints = structuredClone(scenario.constraints ?? []);
  const assignments = [];
  const calls = [], writes = [], turns = [];
  const tables = new Set(['user_profiles', 'user_health_profile', 'user_constraints', 'action_assignments', 'daily_checkin', 'longevity_actions']);
  const db = { from(table) {
    if (!tables.has(table)) throw Error('Unexpected table: ' + table);
    const filters = [];
    let single = false;
    const rows = () => table === 'user_profiles' ? [profile] : table === 'user_health_profile' ? [health] : table === 'user_constraints' ? constraints : table === 'action_assignments' ? assignments : table === 'longevity_actions' ? catalog : [];
    const result = () => { const data = rows().filter(row => filters.every(f => f(row))); return { data: single ? data[0] ?? null : data, error: null }; };
    const mutate = (method, row) => {
      if (table === 'longevity_actions') throw Error('Catalog must remain read-only');
      writes.push({ table, method, row: structuredClone(row) });
      if (table === 'user_health_profile' && method === 'upsert') health = { ...health, ...row };
      else if (table === 'action_assignments' && method === 'insert') assignments.push({ id: 'fixture-' + (assignments.length + 1), assigned_at: new Date().toISOString(), ...row });
      else if (table === 'user_constraints' && method === 'upsert') {
        const old = constraints.find(c => c.constraint_key === row.constraint_key); if (old) Object.assign(old, row); else constraints.push(row);
      } else throw Error(`Unexpected fixture write: ${table}.${method}`);
      return Promise.resolve({ data: null, error: null });
    };
    const q = { select() { return q; }, eq(key, value) { if (key !== 'user_id') filters.push(r => r[key] === value); return q; }, in(key, values) { filters.push(r => values.includes(r[key])); return q; }, gte(key, value) { filters.push(r => r[key] >= value); return q; }, order() { return q; }, limit() { return q; }, maybeSingle() { single = true; return Promise.resolve(result()); }, single() { single = true; return Promise.resolve(result()); }, upsert(row) { return mutate('upsert', row); }, insert(row) { return mutate('insert', row); }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); } };
    return q;
  } };
  let classifierFailure = null;
  class AI { messages = { create: async args => {
    if (!live) {
      const input = { event_type: scenario.report === null ? 'GENERAL_HEALTH_REQUEST' : 'ANSWER_TO_EVIDENCE_QUESTION', payload: scenario.report === null ? { text: scenario.text } : { evidence_type: 'gait_instability_reported', value: scenario.report } };
      calls.push(input); return { content: [{ type: 'tool_use', input }] };
    }
    try {
      const response = await new ActualAI({ maxRetries: 1, timeout: 30000 }).messages.create(args);
      calls.push(response.content.find(c => c.type === 'tool_use')?.input ?? null);
      return response;
    } catch (error) { classifierFailure = error.message; throw error; }
  } }; }
  const context = vm.createContext({ console: { ...console, log: (...args) => console.error(...args) }, process, crypto, Date, Set, Map, JSON, URL });
  const cache = new Map();
  const mocks = { '@anthropic-ai/sdk': { default: AI }, '@supabase/supabase-js': { createClient: () => db }, fs, url, path };
  function moduleFor(file) { if (cache.has(file.href)) return cache.get(file.href); const m = new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { context, identifier: file.href, initializeImportMeta(meta) { meta.url = file.href; } }); cache.set(file.href, m); return m; }
  function link(spec, ref) { const alias = spec.replace(/^node:/, ''); if (mocks[alias]) { const key = 'mock:' + alias; if (!cache.has(key)) { const values = mocks[alias]; cache.set(key, new vm.SyntheticModule(Object.keys(values), function () { for (const [k, v] of Object.entries(values)) this.setExport(k, v); }, { context })); } return cache.get(key); } if (!spec.startsWith('.')) throw Error('Unexpected dependency: ' + spec); return moduleFor(new URL(spec, ref.identifier)); }
  const entry = moduleFor(new URL('api/engine/orchestrator.js', sourceRoot)); await entry.link(link); await entry.evaluate();
  const engine = cache.get(new URL('api/engine/engine.js', sourceRoot).href).namespace;
  let session = {};
  async function turn(text) { const r = await entry.namespace.processInput(uid, text, session); session = { ...session, ...r.session_updates }; turns.push({ input: text, mode: r.mode, text: r.text, buttons: r.buttons, pending: session.pending_question, action: session.current_action_assignment, debug: r.debug }); return r; }
  let response = await turn(scenario.text);
  const initialClassification = calls[0] ?? null;
  const initialPhysical = structuredClone(health.physical);
  const initialEngine = await engine.runEngine(uid);
  const checks = [];
  function check(id, ok, actual) { checks.push({ id, status: ok ? 'PASS' : 'FAIL', actual }); }
  if (classifierFailure) return { id: scenario.id, status: 'BLOCKED', reason: classifierFailure, turns, checks: [] };
  const gait = initialEngine.node_states.find(n => n.node_id === 'GAIT_INSTABILITY');
  const gaitFacts = [...(gait?.evidence?.direct ?? []), ...(gait?.evidence?.supporting ?? []), ...(gait?.evidence?.inferred_from_nodes ?? [])];
  check('report-polarity', scenario.report === null ? initialPhysical.gait_instability_reported === undefined : initialPhysical.gait_instability_reported === scenario.report, { expected: scenario.report, actual: initialPhysical.gait_instability_reported ?? null, classification: initialClassification });
  if (scenario.report === true) {
    check('report-consumed', gaitFacts.some(f => f.question_id === 'gait_instability_reported' && f.value === true), gait?.evidence);
    check('self-report-not-diagnosis', gait?.current_state !== 'CONFIRMED' && !health.diagnoses.length, { state: gait?.current_state, diagnoses: health.diagnoses });
    const step = initialEngine.next_best_action.all_candidates?.find(a => a.action_id === 'step_down');
    check('step-down-not-prescribed', initialEngine.next_best_action.selected?.action_id !== 'step_down' && (!step || !['SAFE', 'SAFE_WITH_MODIFICATION'].includes(step.safety.level)), step?.safety ?? 'Not a candidate for selected leverage');
    const why = await turn('Proč?');
    check('why-acknowledges-report', /nejist|chůz|chuz/i.test(why.text), why.text);
    if (classifierFailure) return { id: scenario.id, status: 'BLOCKED', reason: classifierFailure, turns, checks };
    // WHY is observational; it must not change the physical record or assignment.
    response = { ...response };
  }
  const selected = initialEngine.next_best_action.selected;
  check('engine-presentation-contract', response.mode !== 'ACT' || session.current_action_assignment?.action_id === selected?.action_id, { mode: response.mode, rendered: session.current_action_assignment?.action_id ?? null, engine: selected?.action_id ?? null });
  if (selected) {
    check('selected-safety', ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(selected.safety.level), selected.safety);
    const actionRow = catalog.find(a => a.id === selected.action_id);
    check('selected-catalog-row', Boolean(actionRow), selected.action_id);
    check('hard-exclusion', !(actionRow?.constraint_exclude ?? []).some(key => constraints.some(c => c.constraint_key === key)), selected.action_id);
    const eyesConflict = /zavřen|zavren/i.test(selected.label ?? '') && selected.safety.modifications_suggested?.some(m => /eyes-open only/i.test(m));
    check('instruction-consistency', !eyesConflict, { label: selected.label, modifications: selected.safety.modifications_suggested });
    // Existing joint-load contract: balance practice loads the knee regardless
    // of which balance/stability protocol a catalog row happens to use.
    const knee = constraints.find(c => c.constraint_key === 'knee');
    if (knee && ['BALANCE_PROTOKOL', 'STABILITY_PROTOKOL'].includes(actionRow?.protocol_type)) {
      check('balance-knee-severity', knee.severity !== null && knee.severity !== 'severe', { severity: knee.severity, action: selected.action_id, safety: selected.safety });
      if (knee.severity === 'moderate') check('balance-knee-modifications', selected.safety.modifications_suggested?.some(m => /pain increases/i.test(m)), selected.safety);
    }
  }
  if (scenario.unsupported) check('unsupported-no-action', response.mode !== 'ACT' && !session.current_action_assignment && writes.length === 0, { mode: response.mode, text: response.text, writes: writes.length });
  if (branch) {
    // Only answer existing questions whose true fixture values are known. Never
    // fabricate clearance or health evidence merely to force an ACT.
    const answers = { recent_falls: health.physical.recent_falls ? 'Ano' : 'Ne', fall_history: health.physical.recent_falls ? 'Ano' : 'Ne', vstat_ze_zeme: health.physical.vstat_ze_zeme ? 'Ano' : 'Ne', gait_stability: 'Ne', current_assistive_device: 'Žádná', instability_laterality: 'Obě strany', knee_severity: constraints.find(c => c.constraint_key === 'knee')?.severity };
    const seen = new Set();
    for (let i = 0; response.mode === 'ASK' && i < 3; i++) {
      const key = session.pending_question?.evidence_type;
      if (!answers[key] || seen.has(key)) break;
      seen.add(key); response = await turn(answers[key]);
    }
    if (response.mode !== 'ACT') checks.push({ id: branch + '-journey', status: 'BLOCKED', actual: { reason: 'No ACT reachable using known fixture evidence', mode: response.mode, pending: session.pending_question } });
    else {
      const assigned = structuredClone(session.current_action_assignment);
      response = await turn(branch === 'done' ? 'Hotovo' : 'Přeskočit');
      const recorded = assignments[0];
      check(branch + '-persisted', recorded?.action_id === assigned.action_id && recorded?.intervention_id === assigned.intervention_id && recorded?.status === (branch === 'done' ? 'COMPLETED' : 'SKIPPED') && recorded?.selected_leverage_node === assigned.selected_leverage_node && recorded?.selected_leverage_node !== 'UNKNOWN', recorded);
      if (branch === 'done') {
        check('done-clears-assignment', response.mode === 'HOLD' && !session.current_action_assignment, { mode: response.mode, action: session.current_action_assignment });
        await turn('Hotovo');
        check('no-duplicate-completion', assignments.length === 1, assignments.length);
        const next = await turn('Co dál?');
        check('same-day-return', next.mode === 'HOLD' && !session.current_action_assignment, { mode: next.mode, text: next.text });
      } else {
        const nextItem = session.last_daily_decision?.primary_item;
        check('next-act-has-assignment', response.mode !== 'ACT' || session.current_action_assignment?.action_id === nextItem?.action_id, { mode: response.mode, engine: nextItem?.action_id, assignment: session.current_action_assignment });
        check('skipped-not-offered-again', session.current_action_assignment?.action_id !== assigned.action_id, { mode: response.mode, next: session.current_action_assignment?.action_id ?? null });
        const equivalents = new Set(['b3f9b408-47a5-4529-bfbb-906a2324813b', 'rovnovaha_stoj_1']);
        check('skipped-equivalent-not-offered-again', !(response.mode === 'ACT' && equivalents.has(assigned.action_id) && equivalents.has(nextItem?.action_id)), { skipped: assigned.action_id, offered: nextItem?.action_id ?? null, text: response.text });
        if (response.mode === 'ACT') {
          const replacement = structuredClone(session.current_action_assignment);
          await turn('Hotovo');
          check('replacement-can-be-completed', assignments.length === 2 && assignments[1].status === 'COMPLETED' && assignments[1].action_id === replacement?.action_id, assignments);
        }
      }
    }
  }
  if (classifierFailure) return { id: scenario.id, branch, status: 'BLOCKED', reason: classifierFailure, turns, checks };
  return { id: scenario.id, branch, status: checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.some(c => c.status === 'BLOCKED') ? 'BLOCKED' : 'PASS', profile, physical: initialPhysical, constraints, classification: initialClassification, leverage: initialEngine.system_leverage.selected, engine_action: selected, candidate_count: initialEngine.next_best_action.all_candidates?.length ?? 0, turns, assignments, checks };
}
const results = [];
for (const scenario of scenarios) {
  console.error('MATRIX', scenario.id);
  try { results.push(await isolated(scenario)); } catch (error) { results.push({ id: scenario.id, status: 'BLOCKED', reason: error.message }); }
}
for (const branch of ['done', 'skip']) {
  const scenario = scenarios.find(s => s.id === 'spoken-1');
  try { results.push(await isolated({ ...scenario, id: 'journey-' + branch }, branch)); } catch (error) { results.push({ id: 'journey-' + branch, status: 'BLOCKED', reason: error.message }); }
}
const counts = Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map(s => [s, results.filter(r => r.status === s).length]));
console.log(JSON.stringify({ mode: live ? 'live_classifier_full_engine_public_catalog' : 'injected_classifier_full_engine_public_catalog', catalog: catalogMeta, counts, limitations: ['All user profiles and writes are synthetic and isolated in memory', 'No browser, authentication or microphone/audio transcription test', 'No clinical efficacy or exercise dose validation', 'BLOCKED journeys are not counted as passing'], results }, null, 2));
process.exitCode = counts.FAIL ? 1 : counts.BLOCKED ? 2 : 0;
