// Product/software contracts; the graph is a model, not clinical proof.
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const master = JSON.parse(fs.readFileSync(new URL('data/engine/master.json', root), 'utf8'));
const bridge = JSON.parse(fs.readFileSync(new URL('data/engine/intervention-map.json', root), 'utf8'));
export const physicalKeys = ['vstat_ze_zeme', 'zvednout_vnouce', 'vynest_nakup', 'recent_falls', 'rovnovaha_zavrene_oci'];
export function combinationScenarios() {
  const cases = [];
  for (let mask = 0; mask < 32; mask++) {
    const physical = Object.fromEntries(physicalKeys.map((k, i) => [k, Boolean(mask & (1 << i))]));
    for (const weight of [72, 88]) for (const intent of ['weight', 'gait'])
      for (const answer of ['Ano', 'Ne', 'Nevím']) for (const outcome of ['done', 'skip']) cases.push({
        id: `crt-${mask}-${weight}-${intent}-${answer}-${outcome}`,
        text: intent === 'weight' ? 'Chci zhubnout.' : 'Jsem nejistý při chůzi.',
        goal: intent === 'weight', report: intent === 'gait' ? true : null,
        profile: { weight }, lifestyle: { waist_cm: weight === 72 ? 84 : 99 }, physical,
        // Explicit synthetic answers; empty records are not medical clearance.
        discoveryAnswers: { bp_systolic: 'Nemám změřeno', clinical_context: 'Ne', weekly_aerobic_activity_days: '0', exertional_dyspnea: 'Ne', known_blood_pressure_approx: 'Nevím', sedentary_hours_day: '7' },
        comboJourney: true, matrix: { mask, intent, gaitAnswer: answer, outcome },
      });
  }
  return cases;
}
export function clinicalDiscoveryScenarios() {
  const seed = combinationScenarios().find(s => s.id === 'crt-7-72-weight-Ano-done');
  return [
    ['no-positive-signal', {}],
    ['active-unknown-pressure', { weekly_aerobic_activity_days: '3' }],
    ['active-known-pressure', { weekly_aerobic_activity_days: '3', known_blood_pressure_approx: '120/80' }],
    ['high-pressure', { weekly_aerobic_activity_days: '3', known_blood_pressure_approx: '150/90' }],
    ['dyspnea', { exertional_dyspnea: 'Ano' }],
  ].map(([id, answers]) => ({ ...structuredClone(seed), id: 'discovery-' + id,
    discoveryAnswers: { ...seed.discoveryAnswers, ...answers }, discoveryJourney: true }));
}
export function bloodPressureScenarios() {
  const seed = combinationScenarios().find(s => s.id === 'crt-31-72-weight-Ano-done');
  const current = ['120', '120/80', '150', 'Nevím', 'Nemám změřeno'].map((answer, i) => ({
    ...structuredClone(seed), id: 'bp-current-' + i, bpJourney: true,
    discoveryAnswers: { ...seed.discoveryAnswers, bp_systolic: answer },
  }));
  const discovery = combinationScenarios().find(s => s.id === 'crt-7-72-weight-Ano-done');
  return [...current, { ...structuredClone(seed), id: 'bp-invalid-then-valid', bpJourney: true, bpInvalid: true, discoveryAnswers: { ...seed.discoveryAnswers, bp_systolic: '120' } }, ...['120/80', 'Nevím', 'Nemám změřeno'].map((answer, i) => ({
    ...structuredClone(discovery), id: 'bp-approx-' + i, discoveryJourney: true,
    discoveryAnswers: { ...discovery.discoveryAnswers, known_blood_pressure_approx: answer },
  }))];
}
export function checkCrtInputContracts({ scenario, initialPhysical, health, initialEngine, session, check }) {
  const states = initialEngine.node_states;
  for (const key of physicalKeys) check('input-' + key, initialPhysical[key] === scenario.physical[key], initialPhysical[key]);
  check('no-invented-diagnosis', health.diagnoses.length === 0, health.diagnoses);
  const expectedStrengthFacts = physicalKeys.slice(0, 3).filter(k => scenario.physical[k] === false).sort();
  const strength = states.find(n => n.node_id === 'LOW_MUSCLE_STRENGTH');
  const direct = (strength?.evidence?.direct ?? []).filter(f => f.source === 'ONBOARDING').map(f => f.question_id).sort();
  check('strength-provenance', JSON.stringify(direct) === JSON.stringify(expectedStrengthFacts), { expected: expectedStrengthFacts, actual: direct });
  check('strength-evidence-keeps-answer-values', (strength?.evidence?.direct ?? []).every(f => f.source !== 'ONBOARDING' || f.value === scenario.physical[f.question_id]), strength?.evidence?.direct ?? []);
  check('onboarding-does-not-invent-extra-load', (strength?.evidence?.direct ?? []).every(f => f.source !== 'ONBOARDING' || !/3\. patra|10\+ kg/.test(f.note ?? '')), strength?.evidence?.direct ?? []);
  check('self-report-not-confirmed-strength', strength?.current_state !== 'CONFIRMED', strength?.current_state ?? null);
  const gait = states.find(n => n.node_id === 'GAIT_INSTABILITY');
  if (scenario.report === true) {
    const facts = [...(gait?.evidence?.direct ?? []), ...(gait?.evidence?.supporting ?? []), ...(gait?.evidence?.inferred_from_nodes ?? [])];
    check('spoken-gait-retained-as-report', initialPhysical.gait_instability_reported === true && facts.some(f => f.question_id === 'gait_instability_reported' && f.value === true), gait?.evidence);
    check('self-report-not-confirmed-gait', gait?.current_state !== 'CONFIRMED', gait?.current_state);
  } else if (expectedStrengthFacts.length === 0 && scenario.physical.recent_falls === false) {
    check('eyes-closed-alone-not-ordinary-gait-finding', !gait || gait.current_state === 'UNKNOWN', gait?.current_state ?? null);
  }
  const adiposity = states.find(n => n.node_id === 'EXCESS_ADIPOSITY');
  check('weight-wish-is-not-adiposity-measurement', scenario.profile.weight === 88
    ? adiposity?.current_state === 'MEASURED'
    : !['MEASURED', 'CONFIRMED'].includes(adiposity?.current_state), adiposity?.current_state ?? null);
  const leverage = (initialEngine.action_leverage ?? initialEngine.system_leverage).selected?.node_id;
  if (leverage) {
    check('leverage-has-recorded-evidence', states.some(n => n.node_id === leverage && n.current_state !== 'UNKNOWN'), leverage);
    const reached = new Set(), queue = [leverage];
    while (queue.length) {
      const current = queue.shift();
      for (const edge of master.edges.filter(e => e.from === current)) {
        if (['CAUSES', 'CONTRIBUTES_TO'].includes(edge.relation) && !reached.has(edge.to)) { reached.add(edge.to); queue.push(edge.to); }
      }
    }
    const causal = session.last_domain_response?.explanation_context?.causal_context;
    check('crt-causal-path-exists', (causal?.affected_nodes ?? []).every(id => reached.has(id)), causal?.affected_nodes ?? []);
    check('crt-edges-are-real', (causal?.edges_used ?? []).every(e => master.edges.some(x => x.id === e.edge_id && x.from === e.from && x.to === e.to && x.relation === e.relation)), causal?.edges_used ?? []);
    const gateways = session.last_domain_response?.explanation_context?.goal_gateway_context?.gateway_nodes_reached ?? [];
    check('future-goal-has-crt-path', gateways.every(id => reached.has(id)), gateways);
    const selected = initialEngine.next_best_action.selected;
    if (selected) check('action-bridge-matches-leverage', bridge.mappings[leverage]?.interventions.some(i => i.id === selected.intervention_id && i.protocol_types.includes(selected.protocol_type) && i.mechanism_targets.includes(leverage)), { leverage, intervention: selected.intervention_id });
  }
}

export async function runCombinationJourney({ scenario, initialPhysical, initialEngine, onboarding, getCurrentEngine, getHealth, getSession, getWrites, getCalls, getAssignments, turn, check, catalog, response }) {
  const reviews = [];
  check('actual-onboarding-handlers', onboarding?.removed && onboarding?.reloaded, onboarding);
  checkCrtInputContracts({ scenario, initialPhysical, health: getHealth(), initialEngine, session: getSession(), check });
  if (scenario.bpInvalid) {
    for (const invalid of ['999', '120 kg']) {
      const before = getWrites().length;
      response = await turn(invalid);
      check('invalid-bp-not-persisted-' + invalid, response.mode === 'ASK' && getSession().pending_question?.evidence_type === 'bp_systolic' && getWrites().length === before && getHealth().physical.bp_systolic == null, response);
    }
  }
  const seenQuestions = new Set();
  for (let i = 0; response.mode === 'ASK' && i < 10; i++) {
    const key = getSession().pending_question?.evidence_type;
    check('ask-has-typed-pending-' + i, Boolean(key) && !getSession().current_action_assignment, getSession().pending_question);
    if (!key) break;
    check('no-repeated-resolved-question-' + i, !seenQuestions.has(key), key);
    if (seenQuestions.has(key)) break;
    const answer = scenario.discoveryAnswers?.[key] ?? (key === 'gait_stability' ? scenario.matrix.gaitAnswer
      : ['recent_falls', 'fall_history'].includes(key) ? (getHealth().physical.recent_falls ? 'Ano' : 'Ne')
      : key === 'vstat_ze_zeme' ? (getHealth().physical.vstat_ze_zeme ? 'Ano' : 'Ne')
      : ['tug_test', 'chair_stand_30s', 'grip_strength', 'validated_strength_assessment'].includes(key) ? 'Nemám výsledek' : null);
    if (!answer) { reviews.push({ code: 'UNMODELED_EVIDENCE', question: key, text: response.text }); break; }
    seenQuestions.add(key);
    if (scenario.bpJourney && key === 'bp_systolic') check('current-bp-question-reached', true, response.text);
    const callsBefore = getCalls().length;
    response = await turn(answer);
    if (key === 'bp_systolic') {
      const known = /^\d/.test(answer);
      check('bp-answer-no-classifier', getCalls().length === callsBefore, getCalls().length - callsBefore);
      check('bp-value-or-unavailable', known ? getHealth().physical.bp_systolic === Number(answer.split('/')[0]) && getHealth().physical.evidence_availability?.bp_systolic === 'AVAILABLE' : getHealth().physical.bp_systolic == null && getHealth().physical.evidence_availability?.bp_systolic === 'NOT_AVAILABLE', { physical: getHealth().physical.bp_systolic, availability: getHealth().physical.evidence_availability });
      check('bp-does-not-repeat-resolved-question', getSession().pending_question?.evidence_type !== key, getSession().pending_question);
      check('bp-not-invented-hypertension', getHealth().diagnoses.length === 0, getHealth().diagnoses);
    }
    if (key === 'clinical_context') check('clinical-negative-no-invented-diagnoses-or-medication', getHealth().diagnoses.length === 0 && getHealth().medications.length === 0, getHealth());
    if (['weekly_aerobic_activity_days', 'exertional_dyspnea', 'known_blood_pressure_approx', 'sedentary_hours_day'].includes(key)) {
      check('typed-discovery-bypasses-classifier-' + key, getCalls().length === callsBefore, getCalls().length - callsBefore);
      const expected = key === 'exertional_dyspnea' ? answer === 'Ano' : key === 'known_blood_pressure_approx' ? ['Nevím', 'Nemám změřeno'].includes(answer) ? 0 : Number(answer.split('/')[0]) : Number(answer);
      check('typed-discovery-stored-' + key, getHealth().physical[key] === expected, getHealth().physical[key]);
    }
  }
  const assignment = structuredClone(getSession().current_action_assignment);
  const currentEngine = await getCurrentEngine();
  checkCrtInputContracts({ scenario, initialPhysical, health: getHealth(), initialEngine: currentEngine,
    session: getSession(), check: (id, ok, actual) => check('after-clarification-' + id, ok, actual) });
  if (scenario.bpJourney) check('single-pressure-reading-not-confirmed-hypertension', !currentEngine.node_states.some(n => n.node_id === 'HYPERTENSION' && n.current_state === 'CONFIRMED'), currentEngine.node_states.find(n => n.node_id === 'HYPERTENSION'));
  const healthBefore = structuredClone(getHealth()), writeCount = getWrites().length, callCount = getCalls().length;
  if (response.mode === 'ACT') {
    const context = getSession().last_domain_response?.explanation_context;
    const f = currentEngine.action_fallback;
    check('active-action-still-viable', ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(currentEngine.next_best_action.selected?.safety?.level)
      && currentEngine.next_best_action.selected.action_id === assignment?.action_id, currentEngine.next_best_action.selected?.action_id);
    if (f?.status === 'SELECTED') {
      check('fallback-retains-primary-block', f.primary_node_id === currentEngine.system_leverage.selected?.node_id
        && f.primary_decision.reason_code === 'SAFETY_BLOCKED' && f.primary_decision.primary_item.blocked_candidates.length > 0
        && f.primary_decision.primary_item.blocked_candidates.every(c => ['CONTRAINDICATED', 'NEEDS_CLINICAL_CLEARANCE'].includes(c.safety_level)), f.primary_node_id);
      check('fallback-explains-actual-action-branch', context.system_leverage.node_id === currentEngine.action_leverage.selected.node_id
        && context.system_priority.node_id === currentEngine.system_leverage.selected.node_id && context.action_fallback.status === 'SELECTED', context.system_leverage);
      reviews.push({ code: 'CHECKED_ALTERNATIVE', primary: f.primary_node_id, action_branch: f.selected_node_id });
    }
    for (const text of ['Proč?', 'Kam směřuješ?', 'Co tím změníš?']) {
      const r = await turn(text);
      check('explanation-mode-' + text, r.mode === 'EXPLAIN' && Boolean(r.text) && r.text.length > 10, { mode: r.mode, text: r.text });
      if (text === 'Proč?') {
        const claims = { vstat_ze_zeme: /nevstaneš ze země/, zvednout_vnouce: /nezvládneš zvednout malé dítě/, vynest_nakup: /nezvládneš vynést nákup/ };
        check('why-does-not-reverse-answers', Object.entries(claims).every(([key, claim]) => scenario.physical[key] !== true || !claim.test(r.text)), r.text);
      }
      if (text === 'Kam směřuješ?') {
        const meanings = { LOW_MUSCLE_STRENGTH: /síla|síly|sílu|vstát/, GAIT_INSTABILITY: /upadneš|pádu/, EXCESS_ADIPOSITY: /inzulín|srdce|cév/ };
        const meaning = meanings[getSession().last_domain_response?.explanation_context?.system_leverage?.node_id];
        check('trajectory-matches-selected-crt-branch', !meaning || meaning.test(r.text), r.text);
        check('trajectory-is-possibility', /může/i.test(r.text), r.text);
      }
      if (text === 'Co tím změníš?' && /kolo/.test(assignment?.label ?? '')) check('cycling-benefit-not-walking-only', !/^Rychlá chůze/.test(r.text), r.text);
    }
    check('explanations-observational', getWrites().length === writeCount && getCalls().length === callCount && JSON.stringify(getHealth()) === JSON.stringify(healthBefore) && JSON.stringify(getSession().current_action_assignment) === JSON.stringify(assignment), { writes: getWrites().length - writeCount, classifier_calls: getCalls().length - callCount });
    if (scenario.matrix.outcome === 'done') {
      response = await turn('Hotovo');
      check('completed-once', getAssignments().length === 1 && getAssignments()[0].status === 'COMPLETED' && getAssignments()[0].action_id === assignment.action_id && response.mode === 'HOLD' && !getSession().current_action_assignment, getAssignments());
      await turn('Hotovo'); response = await turn('Co dál?');
      check('completion-return-stays-done', getAssignments().length === 1 && response.mode === 'HOLD' && !getSession().current_action_assignment, { mode: response.mode, assignments: getAssignments() });
    } else {
      const seenActions = new Set(), skippedByIntervention = new Map();
      const ranks = { LIGHT: 1, MODERATE: 2, VIGOROUS: 3, HIGH_INTENSITY_INTERVAL: 4 };
      const groups = JSON.parse(fs.readFileSync(new URL('data/engine/action-equivalents.json', root), 'utf8')).skip_groups;
      response = await turn('Co dál?');
      for (let i = 0; response.mode === 'ACT' && i < 16; i++) {
        const assigned = structuredClone(getSession().current_action_assignment);
        const row = catalog.find(a => a.id === assigned?.action_id);
        const identity = groups.find(g => g.action_ids.includes(row?.id))?.id ?? row?.id;
        check('skip-no-equivalent-' + i, Boolean(row) && !seenActions.has(identity), identity);
        seenActions.add(identity);
        const previous = skippedByIntervention.get(assigned?.intervention_id) ?? [];
        check('skip-tier-nonincrease-' + i, previous.every(p => Number.isFinite(row?.tier) && row.tier <= p.tier), { tier: row?.tier, previous: previous.map(p => p.tier) });
        check('skip-dose-nonincrease-' + i, previous.every(p => ranks[row?.intensity] && ranks[row.intensity] <= ranks[p.intensity] && row.type === p.type && (row.type === 'timed' ? Number.isFinite(row.duration) && row.duration > 0 && Number.isFinite(p.duration) && p.duration > 0 && row.duration <= p.duration : row.type === 'reps' ? Number.isFinite(row.reps) && row.reps > 0 && Number.isFinite(p.reps) && p.reps > 0 && row.reps <= p.reps : row.type === 'habit' && row.duration == null && row.reps == null && p.duration == null && p.reps == null)), { type: row?.type, duration: row?.duration, reps: row?.reps, intensity: row?.intensity });
        previous.push(row); skippedByIntervention.set(assigned?.intervention_id, previous);
        response = await turn('Přeskočit');
        check('skip-write-' + i, getAssignments().length === i + 1 && getAssignments().at(-1).status === 'SKIPPED' && getAssignments().at(-1).action_id === assigned.action_id, getAssignments().at(-1));
      }
      check('skip-terminates', response.mode !== 'ACT', { mode: response.mode });
      const count = getAssignments().length, exhausted = response.mode === 'HOLD';
      await turn('Hotovo'); response = await turn('Co dál?');
      check('skip-no-false-completion', getAssignments().length === count && getAssignments().every(a => a.status === 'SKIPPED'), getAssignments());
      if (exhausted) check('exhausted-return-stays-ended', response.mode === 'HOLD' && !getSession().current_action_assignment, { mode: response.mode });
      if (response.mode === 'ASK') reviews.push({ code: 'EVIDENCE_PENDING_AFTER_SKIP', question: getSession().pending_question?.evidence_type, text: response.text });
    }
  } else if (response.mode === 'SAFETY_BLOCKED') {
    const why = await turn('Proč?');
    check('blocked-explanation-preserves-safety', why.mode === 'SAFETY_BLOCKED' && !getSession().current_action_assignment && getWrites().length === writeCount && getCalls().length === callCount, why.text);
    response = await turn('Co dál?');
    check('blocked-return-no-prescription', response.mode === 'SAFETY_BLOCKED' && getAssignments().length === 0 && !getSession().current_action_assignment && !getSession().pending_question, { mode: response.mode });
    reviews.push({ code: 'ASSESSMENT_STOP', leverage: initialEngine.system_leverage.selected?.node_id, text: response.text });
  } else if (response.mode === 'ASK') {
    reviews.push({ code: 'EVIDENCE_PENDING', question: getSession().pending_question?.evidence_type, text: response.text });
    check('pending-evidence-no-prescription', !getSession().current_action_assignment && getAssignments().length === 0, { mode: response.mode });
  } else if (response.mode === 'HOLD') {
    const discoveryReason = response.debug?.reason_code;
    const discoveryText = response.text;
    if (scenario.discoveryJourney) {
      check('discovery-ends-without-prescribing', !getSession().current_action_assignment && getAssignments().length === 0, response);
      check('discovery-has-resolved-questions', !getSession().pending_question, getSession().pending_question);
      const before = { calls: getCalls().length, writes: getWrites().length, health: JSON.stringify(getHealth()) };
      const why = await turn('Proč?');
      check('discovery-why-retains-result', why.mode === 'EXPLAIN' && why.text === discoveryText, why.text);
      check('discovery-why-is-observational', getCalls().length === before.calls && getWrites().length === before.writes && JSON.stringify(getHealth()) === before.health, before);

    }
    response = await turn('Co dál?');
    if (scenario.discoveryJourney) {
      check('discovery-return-keeps-hold', response.mode === 'HOLD' && !getSession().pending_question, { mode: response.mode, original: discoveryReason, pending: getSession().pending_question });
      check('discovery-signals-not-invented-diagnoses', getHealth().diagnoses.length === 0, getHealth().diagnoses);
      response = await turn('Mám synkopu.');
      check('new-medical-fact-still-handled', response.mode === 'HOLD' && getSession().unsupported_request?.kind === 'medical' && !getSession().current_action_assignment, response);
    }
    if (scenario.bpJourney) {
      check('bp-return-no-repeat', getSession().pending_question?.evidence_type !== 'bp_systolic', getSession().pending_question);
      if (['Nevím', 'Nemám změřeno'].includes(scenario.discoveryAnswers.bp_systolic)) {
        response = await turn('120');
        check('missing-bp-can-be-supplied-later', getHealth().physical.bp_systolic === 120 && getHealth().physical.evidence_availability.bp_systolic === 'AVAILABLE' && getSession().pending_question?.evidence_type !== 'bp_systolic', getHealth().physical);
      }
    }
    check('hold-no-false-completion', getAssignments().length === 0 && !getSession().current_action_assignment, { mode: response.mode });
  } else check('recognized-initial-outcome', false, { mode: response.mode, text: response.text });
  if (scenario.report && initialEngine.system_leverage.selected?.node_id === 'EXCESS_ADIPOSITY') reviews.push({ code: 'GAIT_REQUEST_ADIPOSITY_PRIORITY', text: 'A gait request selects adiposity by the current ranking; judge this product choice separately from software PASS.' });
  return { response, reviews };
}
