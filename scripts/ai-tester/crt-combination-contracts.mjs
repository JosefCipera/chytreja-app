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
        comboJourney: true, matrix: { mask, intent, gaitAnswer: answer, outcome },
      });
  }
  return cases;
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
  const leverage = initialEngine.system_leverage.selected?.node_id;
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

export async function runCombinationJourney({ scenario, initialPhysical, initialEngine, onboarding, getHealth, getSession, getWrites, getCalls, getAssignments, turn, check, catalog, response }) {
  const reviews = [];
  check('actual-onboarding-handlers', onboarding?.removed && onboarding?.reloaded, onboarding);
  checkCrtInputContracts({ scenario, initialPhysical, health: getHealth(), initialEngine, session: getSession(), check });
  const seenQuestions = new Set();
  for (let i = 0; response.mode === 'ASK' && i < 6; i++) {
    const key = getSession().pending_question?.evidence_type;
    check('ask-has-typed-pending-' + i, Boolean(key) && !getSession().current_action_assignment, getSession().pending_question);
    if (!key) break;
    check('no-repeated-resolved-question-' + i, !seenQuestions.has(key), key);
    if (seenQuestions.has(key)) break;
    const answer = key === 'gait_stability' ? scenario.matrix.gaitAnswer
      : ['recent_falls', 'fall_history'].includes(key) ? (getHealth().physical.recent_falls ? 'Ano' : 'Ne')
      : key === 'vstat_ze_zeme' ? (getHealth().physical.vstat_ze_zeme ? 'Ano' : 'Ne')
      : ['tug_test', 'chair_stand_30s', 'grip_strength', 'validated_strength_assessment'].includes(key) ? 'Nemám výsledek' : null;
    if (!answer) { reviews.push({ code: 'UNMODELED_EVIDENCE', question: key, text: response.text }); break; }
    seenQuestions.add(key); response = await turn(answer);
  }
  const assignment = structuredClone(getSession().current_action_assignment);
  const healthBefore = structuredClone(getHealth()), writeCount = getWrites().length, callCount = getCalls().length;
  if (response.mode === 'ACT') {
    for (const text of ['Proč?', 'Kam směřuješ?', 'Co tím změníš?']) {
      const r = await turn(text);
      check('explanation-mode-' + text, r.mode === 'EXPLAIN' && Boolean(r.text) && r.text.length > 10, { mode: r.mode, text: r.text });
      if (text === 'Proč?') {
        const claims = { vstat_ze_zeme: /nevstaneš ze země/, zvednout_vnouce: /nezvládneš zvednout malé dítě/, vynest_nakup: /nezvládneš vynést nákup/ };
        check('why-does-not-reverse-answers', Object.entries(claims).every(([key, claim]) => scenario.physical[key] !== true || !claim.test(r.text)), r.text);
      }
      if (text === 'Kam směřuješ?') {
        const meanings = { LOW_MUSCLE_STRENGTH: /síla|síly|sílu|vstát/, GAIT_INSTABILITY: /upadneš|pádu/, EXCESS_ADIPOSITY: /inzulín|srdce|cév/ };
        const meaning = meanings[initialEngine.system_leverage.selected?.node_id];
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
        check('skip-dose-nonincrease-' + i, previous.every(p => ranks[row?.intensity] && ranks[row.intensity] <= ranks[p.intensity] && row.type === p.type && (row.type === 'timed' ? row.duration <= p.duration : row.type === 'reps' ? row.reps <= p.reps : row.type === 'habit')), { type: row?.type, duration: row?.duration, reps: row?.reps, intensity: row?.intensity });
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
    response = await turn('Co dál?');
    check('hold-no-false-completion', getAssignments().length === 0 && !getSession().current_action_assignment, { mode: response.mode });
  } else check('recognized-initial-outcome', false, { mode: response.mode, text: response.text });
  if (scenario.report && initialEngine.system_leverage.selected?.node_id === 'EXCESS_ADIPOSITY') reviews.push({ code: 'GAIT_REQUEST_ADIPOSITY_PRIORITY', text: 'A gait request selects adiposity by the current ranking; judge this product choice separately from software PASS.' });
  return { response, reviews };
}
