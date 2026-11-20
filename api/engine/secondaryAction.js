// secondaryAction.js — "volná akce" (supplementary, non-leverage) daily action.
//
// Part of the "1 hlavní + N volné" concept (docs/BACKLOG.md). Deliberately NOT
// part of the main engine pipeline: it does not run systemLeverage/
// systemConstraint, does not rank candidates, and never competes with the
// day's actual NBA.selected. It reuses the SAME node_states/decision_gate the
// main engine run already computed this turn (no activation/inference/
// decisionGate recompute) and only re-fetches clinicalHistory (cheap single
// read) plus the small action pool for the one supplementary intervention.
//
// Hard boundary unaffected: pickDefaultSafeAction() still runs the real
// Safety Gate (via buildCandidates()) — this module never bypasses safety.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchHealthData, fetchActionPool, fetchPersonConstraints } from './adapter.js';
import { pickDefaultSafeAction } from './nextBestAction.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const INTERVENTION_MAP = JSON.parse(readFileSync(join(_dir, '../../data/engine/intervention-map.json'), 'utf8'));

function findIntervention(interventionId) {
  for (const mapping of Object.values(INTERVENTION_MAP.mappings ?? {})) {
    const found = (mapping.interventions ?? []).find(iv => iv.id === interventionId);
    if (found) return found;
  }
  return null;
}

// engineResult: the SAME object runEngine(userId) returned for this turn's
// primary action — reused for node_states/decision_gate so this never
// recomputes activation/inference/decisionGate a second time.
export async function computeSecondaryOffer(userId, engineResult, interventionId) {
  const intervention = findIntervention(interventionId);
  if (!intervention) return null;

  const [{ clinicalHistory }, actionPool, personConstraints] = await Promise.all([
    fetchHealthData(userId),
    fetchActionPool(intervention.protocol_types ?? []),
    fetchPersonConstraints(userId),
  ]);

  const picked = pickDefaultSafeAction({
    interventionId,
    actionPool,
    interventions: [intervention],
    personConstraints,
    clinicalHistory,
    node_states: engineResult?.node_states ?? [],
    decisionGate: engineResult?.decision_gate ?? { context_gates: [] },
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
