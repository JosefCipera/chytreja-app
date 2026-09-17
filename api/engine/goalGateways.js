// api/engine/goalGateways.js — Goal Gateway Identity Contract
//
// Single authoritative source for Goal Gateway identity.
// Both systemConstraint.js and systemConstraintReadiness.js import from here.
//
// A Goal Gateway is the last master.json node before a Goal branch terminal threat.
// It represents the state of the goal or loss of the goal.
// Goal Gateways are NOT SYSTEM_CONSTRAINT candidates (see locked contract).
//
// Adding a new gateway: update GOAL_GATEWAYS only. GOAL_GATEWAY_IDS is derived.

export const GOAL_GATEWAYS = {
  CARDIOVASCULAR_DISEASE: {
    pathway_threat:  'ASCVD',
    terminal_threats: ['PREMATURE_MORTALITY', 'MAJOR_MORBIDITY'],
    branch:           'SURVIVAL_HEALTHSPAN',
  },
  LOSS_OF_FLOOR_RISE_ABILITY: {
    pathway_threat:  'FRAILTY_FUNCTIONAL_DECLINE',
    terminal_threats: ['LOSS_OF_INDEPENDENCE'],
    branch:           'FUNCTIONAL_INDEPENDENCE',
  },
};

export const GOAL_GATEWAY_IDS = new Set(Object.keys(GOAL_GATEWAYS));
