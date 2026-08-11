// engine.js — CHJ Health Engine v1 main pipeline
//
// Pipeline:
//   fetchHealthData(userId)     → {person, clinicalHistory, observations}
//   activation()                → PERSON_NODE_STATE[] (CONFIRMED + MEASURED)
//   inference()                 → + PERSON_NODE_STATE[] (PREDICTED_CURRENT + UNKNOWN)
//   computeProjections()        → PERSON_PROJECTION[] (separate entity, M:N to node_states)
//   buildInformationNeeds()     → INFORMATION_NEED[] (deduplicated, annotated missing evidence)
//   selectNextBestEvidence()    → NEXT_BEST_EVIDENCE | null (lexicographic selection, 0 or 1)
//
// PERSON_NODE_STATE  = current state of the person (no future_projection field)
// PERSON_PROJECTION  = future risk projection (separate entity, may reference multiple node_states)
// INFORMATION_NEED   = deduplicated missing evidence candidate with impact/cost annotation
// NEXT_BEST_EVIDENCE = the single most valuable missing evidence to acquire next

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchHealthData }           from './adapter.js';
import { activation }                from './activation.js';
import { inference }                 from './inference.js';
import { computeProjections }        from './projections.js';
import { buildInformationNeeds }     from './informationNeeds.js';
import { selectNextBestEvidence }    from './nextBestEvidence.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8'));

export const ENGINE_VERSION = '1.0.0';
export const ENGINE_MASTER  = MASTER;

export async function runEngine(userId) {
  const { person, clinicalHistory, observations } = await fetchHealthData(userId);

  const activated  = activation(person, clinicalHistory, observations);
  const inferred   = inference(activated, person, clinicalHistory, observations);
  const allStates  = [...activated, ...inferred];

  const now = new Date().toISOString();

  const node_states = allStates.map(s => ({
    person_id:          userId,
    node_id:            s.node_id,
    current_state:      s.current_state,
    confidence:         s.confidence,
    evidence:           s.evidence,
    missing_evidence:   s.missing_evidence || [],
    evaluated_at:       now,
    engine_version:     ENGINE_VERSION,
    decision_relevance: null,
  }));

  const projections = computeProjections(allStates, person, clinicalHistory).map(p => ({
    person_id:      userId,
    ...p,
    evaluated_at:   now,
    engine_version: ENGINE_VERSION,
  }));

  const information_needs  = buildInformationNeeds(node_states, projections);
  const next_best_evidence = selectNextBestEvidence(
    information_needs, node_states, projections, ENGINE_VERSION
  );

  return {
    person,
    engine_version:    ENGINE_VERSION,
    evaluated_at:      now,
    node_states,
    projections,
    information_needs,
    next_best_evidence,
  };
}
