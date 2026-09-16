// api/lib/nbq/scenarioEvidenceMap.js
// Scenario-specific evidence map for: weight loss / obesity / exertional dyspnea.
// Covers ONLY nodes relevant to this prototype scenario — NOT a general Health Engine component.
// Does NOT contain a list of questions to ask. Contains only what evidence
// supports, weakens, or distinguishes hypothesis nodes.

export const HYPOTHESIS_NODES = [
  'OBESITY',
  'LOW_VO2MAX',
  'SEDENTARY_LIFESTYLE_ROOT',
  'INACTIVITY_ROOT',
];

export const STATUSES = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  POSSIBLE:  'POSSIBLE',
  WEAKENED:  'WEAKENED',
  UNKNOWN:   'UNKNOWN',
});

// Evidence type constants — deterministic labels assigned by evidenceExtractor.
export const ET = Object.freeze({
  USER_INTENTION_WEIGHT_LOSS:    'user_intention_weight_loss',
  SELF_REPORTED_OBESITY:         'self_reported_obesity',
  SELF_REPORTED_DYSPNEA:         'self_reported_dyspnea',
  EXERTIONAL_QUALIFIER:          'exertional_qualifier',
  RESTING_QUALIFIER:             'resting_qualifier',
  FUNCTIONAL_THRESHOLD_STAIRS:   'functional_threshold_stairs',
  MALAISE_GENERAL:               'malaise_general',
  ACTIVITY_LEVEL_LOW:            'activity_level_low',
  ACTIVITY_LEVEL_MEDIUM:         'activity_level_medium',
  ACTIVITY_LEVEL_HIGH:           'activity_level_high',
  DYSPNEA_STABLE:                'dyspnea_stable',
  DYSPNEA_PROGRESSIVE:           'dyspnea_progressive',
});

// What each evidence type does to hypothesis nodes.
// LOCK: user_intention does NOT activate any health node.
export const EVIDENCE_RULES = {
  [ET.USER_INTENTION_WEIGHT_LOSS]:  { supports: [],                                           weakens: [] },
  [ET.SELF_REPORTED_OBESITY]:       { supports: ['OBESITY'],                                  weakens: [] },
  [ET.SELF_REPORTED_DYSPNEA]:       { supports: ['LOW_VO2MAX'],                               weakens: [] },
  [ET.EXERTIONAL_QUALIFIER]:        { supports: ['LOW_VO2MAX'],                               weakens: [] },
  [ET.RESTING_QUALIFIER]:           { supports: [],                                           weakens: ['LOW_VO2MAX'] },
  [ET.FUNCTIONAL_THRESHOLD_STAIRS]: { supports: ['LOW_VO2MAX'],                               weakens: [] },
  [ET.MALAISE_GENERAL]:             { supports: [],                                           weakens: [] },
  [ET.ACTIVITY_LEVEL_LOW]:          { supports: ['SEDENTARY_LIFESTYLE_ROOT', 'INACTIVITY_ROOT'], weakens: [] },
  [ET.ACTIVITY_LEVEL_MEDIUM]:       { supports: ['SEDENTARY_LIFESTYLE_ROOT'],                 weakens: ['INACTIVITY_ROOT'] },
  [ET.ACTIVITY_LEVEL_HIGH]:         { supports: [],                                           weakens: ['SEDENTARY_LIFESTYLE_ROOT', 'INACTIVITY_ROOT'] },
  [ET.DYSPNEA_STABLE]:              { supports: ['LOW_VO2MAX'],                               weakens: [] },
  // DYSPNEA_PROGRESSIVE: captured but no causal hypothesis change in v1 (no soft-safety rules active).
  // Extension point: future soft-safety rules can check for this evidence type.
  [ET.DYSPNEA_PROGRESSIVE]:         { supports: [],                                           weakens: [] },
};

// Information needs: what question type could resolve unknown evidence.
// priority: lower number = asked first when multiple candidates exist (explicit design order).
// canChange: hypothesis nodes whose status changes if this need is resolved.
//   Only nodes currently POSSIBLE or SUPPORTED are eligible for disambiguation.
// prerequisite: evidence type that must be present for this need to be relevant.
export const INFORMATION_NEEDS = {
  dyspnea_character: {
    description:  'Is dyspnea exertional (při pohybu) or resting (i v klidu)?',
    resolvedBy:   [ET.EXERTIONAL_QUALIFIER, ET.RESTING_QUALIFIER],
    canChange:    ['LOW_VO2MAX'],
    prerequisite: ET.SELF_REPORTED_DYSPNEA,
    priority:     1,
  },
  activity_level: {
    description:  'What is the person\'s physical activity level (low/medium/high)?',
    resolvedBy:   [ET.ACTIVITY_LEVEL_LOW, ET.ACTIVITY_LEVEL_MEDIUM, ET.ACTIVITY_LEVEL_HIGH],
    canChange:    ['SEDENTARY_LIFESTYLE_ROOT', 'INACTIVITY_ROOT'],
    prerequisite: null,
    priority:     2,
  },
  dyspnea_progression: {
    description:  'Is exertional dyspnea stable over time or recently worsening?',
    resolvedBy:   [ET.DYSPNEA_STABLE, ET.DYSPNEA_PROGRESSIVE],
    // canChange is empty in v1: progression is captured but doesn't change hypothesis
    // status in the current causal model (no soft-safety rules active).
    // Extension point: add CARDIAC_FAILURE_RISK to canChange when soft-safety rules are validated.
    canChange:    [],
    prerequisite: ET.EXERTIONAL_QUALIFIER,
    priority:     3,
  },
};
