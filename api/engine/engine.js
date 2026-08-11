// engine.js — CHJ Health Engine v1 main pipeline
// Runs parallel to old CRT engine. Does NOT touch buildDeterministicCRT.
//
// Pipeline:
//   fetchHealthData(userId)  → {person, clinicalHistory, observations}
//   activation()             → PERSON_NODE_STATE[] (CONFIRMED + MEASURED)
//   inference()              → + PERSON_NODE_STATE[] (PREDICTED_CURRENT)
//   projection()             → future_projection added to all states
//
// Master nodes in this slice: 6
//   PHYSICAL_INACTIVITY, EXCESS_ADIPOSITY, INSULIN_RESISTANCE,
//   HYPERTENSION, ENDOTHELIAL_DYSFUNCTION, ERECTILE_DYSFUNCTION

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchHealthData } from './adapter.js';
import { activation }      from './activation.js';
import { inference }       from './inference.js';
import { projection }      from './projection.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8'));

export const ENGINE_VERSION = '1.0.0';
export const ENGINE_MASTER  = MASTER;

export async function runEngine(userId) {
  const { person, clinicalHistory, observations, _debug: _adapterDebug } = await fetchHealthData(userId);

  const activated  = activation(person, clinicalHistory, observations);
  const inferred   = inference(activated, person, clinicalHistory, observations);
  const projected  = projection([...activated, ...inferred]);

  const now = new Date().toISOString();
  const node_states = projected.map(s => ({
    person_id:          userId,
    node_id:            s.node_id,
    current_state:      s.current_state,
    confidence:         s.confidence,
    evidence:           s.evidence,
    missing_evidence:   s.missing_evidence || [],
    future_projection:  s.future_projection || null,
    evaluated_at:       now,
    engine_version:     ENGINE_VERSION,
    decision_relevance: null,
  }));

  const _debug_weight_obs = observations.filter(o => o.obs_type === 'weight_kg');
  return { person, engine_version: ENGINE_VERSION, evaluated_at: now, node_states, _debug_weight_obs, _adapterDebug };
}
