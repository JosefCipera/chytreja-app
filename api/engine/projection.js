// SUPERSEDED — replaced by projections.js (Engine v1 Architecture update)
//
// Old approach: projection() added future_projection as a field on each PERSON_NODE_STATE.
// Problem: projection is a M:N relationship (multiple states → one target) — it cannot
// belong to a single node state.
//
// New approach: computeProjections() in projections.js returns PERSON_PROJECTION[],
// a separate runtime entity. engine.js assembles both node_states and projections.
//
// This file is kept to avoid import errors during transition. It exports a no-op.

export function projection(states) {
  return states;
}
