// secondaryAction.js — "volná akce" (supplementary, non-leverage) daily action.
//
// Part of the "1 hlavní + N volné" concept (docs/BACKLOG.md). Deliberately NOT
// part of the main engine pipeline: it never runs systemLeverage/
// systemConstraint, never ranks candidates, and never competes with the day's
// actual NBA.selected. It recomputes only the read-only per-person health
// state (activation → inference → projections → decisionGate) needed to run
// the real Safety Gate correctly — the same pure functions engine.js itself
// calls, imported directly here so NO locked core file (engine.js,
// dailyDecision.js, healthEventAdapter.js, orchestrator.js) needs to change
// its return shape to expose internal engine state. It never runs
// systemLeverage/systemConstraint/nextBestAction's ranking or dailyDecision.
//
// Hard boundary unaffected: pickDefaultSafeAction() still runs the real
// Safety Gate (via buildCandidates()) — this module never bypasses safety.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchHealthData, fetchActionPool, fetchPersonConstraints } from './adapter.js';
import { activation }            from './activation.js';
import { inference }             from './inference.js';
import { computeProjections }    from './projections.js';
import { buildInformationNeeds } from './informationNeeds.js';
import { evaluateDecisionGate }  from './decisionGate.js';
import { pickDefaultSafeAction } from './nextBestAction.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const INTERVENTION_MAP = JSON.parse(readFileSync(join(_dir, '../../data/engine/intervention-map.json'), 'utf8'));
const ENGINE_VERSION = '1.0.0'; // matches ENGINE_VERSION in engine.js (LOCKED, not imported from it)

function findIntervention(interventionId) {
  for (const mapping of Object.values(INTERVENTION_MAP.mappings ?? {})) {
    const found = (mapping.interventions ?? []).find(iv => iv.id === interventionId);
    if (found) return found;
  }
  return null;
}

export async function computeSecondaryOffer(userId, interventionId) {
  const intervention = findIntervention(interventionId);
  if (!intervention) return null;

  const [{ person, clinicalHistory, observations }, actionPool, personConstraints] = await Promise.all([
    fetchHealthData(userId),
    fetchActionPool(intervention.protocol_types ?? []),
    fetchPersonConstraints(userId),
  ]);

  const activated = activation(person, clinicalHistory, observations);
  const inferred  = inference(activated, person, clinicalHistory, observations);
  const node_states = [...activated, ...inferred];

  const projections = computeProjections(node_states, person, clinicalHistory);
  const information_needs = buildInformationNeeds(node_states, projections);
  const decisionGate = evaluateDecisionGate(node_states, projections, information_needs, ENGINE_VERSION, {
    birth_year: person.birth_year,
    sex:        person.sex,
    resolved_physical: Object.keys(clinicalHistory.onboarding_inputs ?? {}),
  });

  const picked = pickDefaultSafeAction({
    interventionId,
    actionPool,
    interventions: [intervention],
    personConstraints,
    clinicalHistory,
    node_states,
    decisionGate,
  });

  if (!picked) return null;

  return {
    action_id:       picked.action_id,
    intervention_id: picked.intervention_id,
    label:           picked.label,
    tier:            picked.tier,
    dose:            picked.dose,
    safety:          picked.safety,
  };
}
