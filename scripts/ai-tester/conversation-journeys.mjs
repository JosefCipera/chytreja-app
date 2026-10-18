export function conversationScenarios() {
  const physical = { recent_falls: false, vynest_nakup: true, vstat_ze_zeme: true, zvednout_vnouce: true, rovnovaha_zavrene_oci: true };
  return ['goal-change', 'answer-correction', 'new-medical-fact', 'return-after-done', 'change-after-skip', 'stable-gait-correction'].map(id => ({
    id, conversationJourney: true, goal: id !== 'answer-correction', report: null,
    text: id === 'answer-correction' ? 'Chci zlepšit kondici.' : 'Chci zhubnout.',
    profile: { weight: id === 'answer-correction' ? 72 : 88 },
    lifestyle: { waist_cm: id === 'answer-correction' ? 84 : 99 },
    physical: { ...physical, ...(id === 'answer-correction' ? { vstat_ze_zeme: false } : {}),
      ...(id === 'stable-gait-correction' ? { zvednout_vnouce: false, rovnovaha_zavrene_oci: false } : {}) },
    // Previous conversation facts, not answers available in the onboarding wizard.
    priorPhysical: id === 'stable-gait-correction' ? { gait_stability: false, gait_instability_reported: true } : {},
  }));
}

export async function runConversationJourney({ scenario, response, turn, check, getSession, getHealth, getAssignments, getWrites, getEngine, catalog, resetSession, advanceDay }) {
  const initial = structuredClone(getSession().current_action_assignment);
  if (scenario.goal) check('journey-goal-recorded', getHealth().goal_text === scenario.text, getHealth().goal_text);
  check('journey-authoritative-uid', getWrites().every(w => w.row.user_id?.startsWith('isolated-')), getWrites().length);
  check('journey-starts-with-action', response.mode === 'ACT' && Boolean(initial), response);
  const safe = async label => {
    const r = await getEngine(), a = r.next_best_action.selected;
    if (getSession().current_action_assignment) check('safe-current-action-' + label,
      a?.action_id === getSession().current_action_assignment.action_id && ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(a?.safety?.level) && a.action_id !== 'step_down', a);
  };
  const explain = async () => {
    const before = { writes: getWrites().length, health: JSON.stringify(getHealth()), action: JSON.stringify(getSession().current_action_assignment) };
    const why = await turn('Proč?');
    check('changed-context-why-read-only', getWrites().length === before.writes && JSON.stringify(getHealth()) === before.health && JSON.stringify(getSession().current_action_assignment) === before.action, why.text);
    return why;
  };
  if (scenario.id === 'stable-gait-correction') {
    const before = await explain();
    check('initial-why-retains-actual-gait-report', /Uvádíš nejistotu při chůzi/.test(before.text), before.text);
    response = await turn('Při běžné chůzi se cítím stabilně.');
    check('stable-correction-retained', getHealth().physical.gait_instability_reported === false, getHealth().physical);
    check('stable-correction-reconciles-previous-walking-answer', getHealth().physical.gait_stability === true, getHealth().physical);
    check('correction-preserves-other-answers', getHealth().physical.zvednout_vnouce === false
      && getHealth().physical.rovnovaha_zavrene_oci === false, getHealth().physical);
    await safe('after-stable-correction');
    const why = await explain();
    check('why-removes-corrected-gait-report', !/Uvádíš nejistotu při chůzi/.test(why.text), why.text);
    const node = getSession().last_domain_response?.explanation_context?.system_leverage?.node_id;
    check('why-retains-actual-selected-source', node === 'GAIT_INSTABILITY'
      ? /Údaje o síle a rovnováze/.test(why.text) && /Samy nepotvrzují nejistotu při běžné chůzi/.test(why.text)
      : node === 'LOW_MUSCLE_STRENGTH' && /nezvládneš zvednout malé dítě/.test(why.text), { node, text: why.text });
    check('concise-why-mobile', why.text.length < 350, why.text);
    check('correction-not-a-diagnosis-or-completion', getHealth().diagnoses.length === 0 && getAssignments().length === 0, getAssignments());
  } else if (scenario.id === 'answer-correction') {
    const before = await explain();
    check('initial-why-uses-floor-answer', /nevstaneš ze země/.test(before.text), before.text);
    response = await turn('Oprava: ze země vstanu bez opory rukou.');
    check('correction-persisted', getHealth().physical.vstat_ze_zeme === true, getHealth().physical);
    const engine = await getEngine();
    check('corrected-strength-source-removed', !engine.node_states.some(n => n.node_id === 'LOW_MUSCLE_STRENGTH' && n.current_state !== 'UNKNOWN'), engine.node_states);
    check('old-action-cleared-after-correction', getSession().current_action_assignment?.action_id !== initial?.action_id, getSession().current_action_assignment);
    const why = await explain();
    check('why-does-not-claim-nonexistent-action', !/tato akce vybrána/.test(why.text), why.text);
    check('why-does-not-reuse-corrected-answer', !/nevstaneš ze země/.test(why.text), why.text);
  } else if (scenario.id === 'new-medical-fact') {
    response = await turn('Mám synkopu.');
    check('medical-fact-clears-action-and-cache', response.mode === 'HOLD' && getSession().unsupported_request?.kind === 'medical' && !getSession().current_action_assignment && !getSession().last_domain_response, response);
    await explain();
    await turn('Chci zhubnout.'); response = await turn('Hotovo');
    check('medical-stop-not-bypassed', response.mode === 'HOLD' && getAssignments().length === 0 && !getSession().current_action_assignment, response);
  } else {
    if (scenario.id === 'return-after-done') {
      await turn('Hotovo'); response = await turn('Co dál?');
      check('done-return-retains-completion', response.mode === 'HOLD' && getAssignments().length === 1 && getAssignments()[0].status === 'COMPLETED', getAssignments());
      response = await turn('Co mám dělat zítra?');
      check('tomorrow-explains-return', response.mode === 'HOLD' && /Zítra otevři Chytré já/.test(response.text) && !getSession().current_action_assignment, response);
      response = await turn('Chci zhubnout.');
      check('repeated-goal-no-false-new-information', response.mode === 'HOLD' && !/Novou informaci|Nové údaje/.test(response.text) && /Pro dnešek máš hotovo/.test(response.text) && getAssignments().length === 1, response);

    }
    if (scenario.id === 'change-after-skip') {
      response = await turn('Přeskočit');
      check('skip-retained', getAssignments().length === 1 && getAssignments()[0].status === 'SKIPPED', getAssignments());
    }
    response = await turn('Jsem nejistý při chůzi.');
    check('new-report-persisted', getHealth().physical.gait_instability_reported === true, getHealth().physical);
    if (response.mode === 'ASK' && getSession().pending_question?.evidence_type === 'gait_stability') response = await turn('Ne');
    check('new-fact-never-confirms-diagnosis', getHealth().diagnoses.length === 0, getHealth().diagnoses);
    await safe('after-report');
    const why = await explain();
    check('why-acknowledges-new-report', /nejistotu při chůzi/.test(why.text), why.text);
    if (scenario.id === 'return-after-done') {
      check('completed-day-does-not-offer-another-exercise', response.mode !== 'ACT' && !getSession().current_action_assignment, response);
      check('completed-action-not-offered-again', getSession().current_action_assignment?.action_id !== initial.action_id, getSession().current_action_assignment);
      check('new-fact-no-second-completion', getAssignments().length === 1 && getAssignments()[0].status === 'COMPLETED', getAssignments());
    }
    if (scenario.id === 'change-after-skip') {
      check('skipped-action-not-offered-again', getSession().current_action_assignment?.action_id !== initial.action_id, getSession().current_action_assignment);
      check('skip-not-converted-to-completion', getAssignments().length === 1 && getAssignments()[0].status === 'SKIPPED', getAssignments());
    }
    response = await turn('Co dál?'); await safe('after-return');
    if (scenario.id === 'return-after-done') {
      resetSession({ current_action_assignment: initial });
      response = await turn('Hotovo');
      check('stale-completion-ack-is-honest', /už máš potvrzenou/.test(response.text), response.text);
      check('stale-screen-cannot-complete-twice', getAssignments().length === 1 && !getSession().current_action_assignment, getAssignments());
      resetSession({}); response = await turn('Co dál?');
      check('completed-day-survives-client-state-reset', response.mode !== 'ACT' && !getSession().current_action_assignment && getAssignments().length === 1, response);
      advanceDay(); response = await turn('Co dál?');
      check('next-day-evaluates-again', response.mode === 'ACT' && Boolean(getSession().current_action_assignment) && getAssignments().length === 1, response);
      await safe('next-day');
      response = await turn('Mám synkopu.');
      check('medical-scope-still-active-after-day-policy', response.mode === 'HOLD' && getSession().unsupported_request?.kind === 'medical' && !getSession().current_action_assignment, response);
    }
  }
  return response;
}
