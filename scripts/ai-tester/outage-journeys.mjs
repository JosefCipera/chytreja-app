export function outageScenarios() {
  return ['billing', 'timeout', 'server', 'malformed', 'medical-priority', 'unclear'].map(id => ({
    id: 'outage-' + id, outageJourney: true, fault: id, goal: false, report: null,
    text: 'Chci zhubnout.', profile: { weight: 88 }, lifestyle: { waist_cm: 99 },
  }));
}

export async function runOutageJourney({ scenario, turn, check, setFault, getSession, getHealth, getWrites, getCalls, getAssignments, ui }) {
  let input = scenario.fault === 'unclear' ? 'Nevím, co bych měl řešit.' : 'Jsem nejistý při chůzi.';
  if (scenario.fault === 'timeout') {
    await turn(input);
    check('pending-question-exists', getSession().pending_question?.evidence_type === 'gait_stability', getSession().pending_question);
    input = 'Občas se při chůzi musím přidržet.';
  }
  const before = { health: JSON.stringify(getHealth()), writes: getWrites().length, budget: getSession().question_budget_remaining,
    pending: JSON.stringify(getSession().pending_question) };
  setFault(scenario.fault === 'medical-priority' ? 'billing' : scenario.fault);
  let response = await turn(input);
  if (scenario.fault === 'unclear') {
    check('genuine-unclear-remains-scope-question', /Zatím nerozumím/.test(response.text) && !getSession().pending_ai_retry, response);
    return response;
  }
  check('outage-is-not-user-ambiguity', response.debug.reason_code === 'CLASSIFIER_UNAVAILABLE' && !/Zatím nerozumím/.test(response.text), response);
  check('outage-preserves-raw-request', getSession().pending_ai_retry?.text === input && response.draft_text === input, getSession().pending_ai_retry);
  check('outage-preserves-question-and-budget', JSON.stringify(getSession().pending_question) === before.pending && getSession().question_budget_remaining === before.budget, getSession().pending_question);
  check('outage-no-health-write', JSON.stringify(getHealth()) === before.health && getWrites().length === before.writes, getWrites().length);
  check('outage-clears-old-action-and-explanation', !getSession().current_action_assignment && !getSession().last_domain_response, getSession().last_daily_decision);
  check('retry-button-available', response.buttons?.includes('Zkusit znovu'), response.buttons);
  if (!response.buttons?.includes('Zkusit znovu')) return response;
  check('retry-chip-submits-control', ui.click('Zkusit znovu') === 'Zkusit znovu', response.buttons);
  if (scenario.fault === 'medical-priority') {
    const calls = getCalls().length;
    response = await turn('Mám synkopu.');
    check('medical-topic-precedes-retry', response.mode === 'HOLD' && getSession().unsupported_request?.kind === 'medical' && !getSession().pending_ai_retry && getCalls().length === calls, response);
    response = await turn('Zkusit znovu');
    check('retry-cannot-bypass-medical-refusal', response.mode === 'HOLD' && !getSession().current_action_assignment && getCalls().length === calls, response);
    return response;
  }
  const calls = getCalls().length;
  for (const control of ['Co dál?', 'Hotovo', 'Chci zhubnout.']) {
    response = await turn(control);
    check('unresolved-request-blocks-old-action-' + control, response.mode === 'HOLD' && !getSession().current_action_assignment && getAssignments().length === 0 && getCalls().length === calls && getWrites().length === before.writes, response);
  }
  const retained = JSON.stringify(getSession().pending_ai_retry);
  response = await turn('Zkusit znovu');
  check('repeated-outage-keeps-original', JSON.stringify(getSession().pending_ai_retry) === retained && response.draft_text === input && getWrites().length === before.writes, response);
  setFault(null);
  response = await turn('Zkusit znovu');
  check('recovery-clears-retry', !getSession().pending_ai_retry && response.debug?.reason_code !== 'CLASSIFIER_UNAVAILABLE', response);
  check('recovery-replays-original-health-message', scenario.fault === 'timeout'
    ? getHealth().physical.gait_stability === input : getHealth().physical.gait_instability_reported === true, getHealth().physical);
  check('recovery-no-fabricated-completion', getAssignments().length === 0 && getHealth().diagnoses.length === 0, getAssignments());
  if (scenario.fault === 'billing') {
    if (response.mode === 'ASK' && getSession().pending_question?.evidence_type === 'gait_stability') response = await turn('Ne');
    const assigned = structuredClone(getSession().current_action_assignment);
    check('retry-skip-precondition', Boolean(assigned), response);
    if (assigned) {
      await turn('Přeskočit');
      const count = getAssignments().length;
      getSession().pending_ai_retry = { text: 'Přeskočit', requested_at: new Date().toISOString(), context: { current_action_assignment: assigned, pending_question: null } };
      response = await turn('Zkusit znovu');
      check('lost-skip-response-not-counted-twice', getAssignments().length === count && getAssignments().every(a => a.status === 'SKIPPED'), getAssignments());
      getSession().pending_ai_retry = { text: 'Hotovo', requested_at: new Date(Date.now() - 86400000).toISOString(), context: { current_action_assignment: assigned, pending_question: null } };
      response = await turn('Zkusit znovu');
      check('old-day-confirmation-does-not-become-new-completion', response.debug?.reason_code === 'STALE_ACTION_RETRY' && getAssignments().length === count && !getSession().pending_ai_retry && !getSession().current_action_assignment, response);
    }
  }
  return response;
}
