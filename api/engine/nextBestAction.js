// nextBestAction.js — NEXT_BEST_ACTION v0.1 (PHYSICAL_INACTIVITY vertical slice)
//
// Pipeline:
//   buildCandidates()   → ACTION_CANDIDATE[] from existing longevity_actions
//   evaluateSafetyGate() per candidate
//   evaluateMinMeaningfulEffect() per candidate
//   selectNextBestAction() → ordinal selection: safety → MME → leverage_affinity
//                           → effect_on_leverage → goal_impact → feasibility
//                           → friction → time_to_feedback
//
// Constraint source: user_constraints table (PERSON_ACTION_CONSTRAINT, no new table).
// Safety gate: separate layer, does NOT replace decisionGate.actionability.
// Candidate pool: ONLY from existing longevity_actions rows (not hand-crafted).

// ── Constraint keyword mapping ────────────────────────────────────────────────
// Same categories as hud-data-bulk.js; normalized to canonical body-region keys.

const CONSTRAINT_KEYWORDS = {
  knee:       ['koleno', 'kolena', 'kolenní', 'knee'],
  hip:        ['kyčel', 'kycle', 'hip', 'bok'],
  lower_back: ['záda', 'zada', 'bedra', 'bederní', 'beder', 'lumbar', 'lower back'],
  shoulder:   ['rameno', 'ramena', 'ramenní', 'shoulder'],
  elbow:      ['loket', 'lokty', 'elbow'],
  ankle_foot: ['kotník', 'kotnik', 'chodidlo', 'pata', 'ankle', 'foot'],
  wrist:      ['zápěstí', 'zapesti', 'wrist'],
};

// Body regions each protocol_type stresses (for SAFE_WITH_MODIFICATION evaluation).
// This is separate from constraint_exclude (hard block).
// Used only when the action doesn't hard-exclude the constraint — to decide if
// a soft modification is warranted.
// PROTOCOL_BODY_LOAD: which body regions each protocol stresses at the protocol level.
// SILOVY_PROTOKOL = null → derive from tags (shoulder press ≠ box jump in knee load).
// TRAINING_PROTOKOL = null → derive from tags.
const PROTOCOL_BODY_LOAD = {
  KARDIO_PROTOKOL:     new Set(['knee', 'ankle_foot']),
  VYTRVALOST_PROTOKOL: new Set(['knee', 'ankle_foot']),
  SILOVY_PROTOKOL:     null, // per-action via tags — overhead press ≠ box jump
  TRAINING_PROTOKOL:   null, // per-action via tags
  BALANCE_PROTOKOL:    new Set(['ankle_foot', 'knee']),
  PREVENTION_PROTOKOL: new Set(),
};

// TAG_BODY_LOAD: region sets per tag. 'sila' → lower_back only (NOT knee — strength
// exercises vary widely; only explicitly leg/plyometric tags → knee).
const TAG_BODY_LOAD = {
  nohy:       new Set(['knee', 'hip', 'ankle_foot']),
  drep:       new Set(['knee', 'hip']),
  plyometrie: new Set(['knee', 'ankle_foot']),
  dopad:      new Set(['knee', 'ankle_foot']),
  kardio:     new Set(['knee', 'ankle_foot']),
  beh:        new Set(['knee', 'ankle_foot']),
  horni:      new Set(['shoulder', 'elbow']),
  kliky:      new Set(['shoulder', 'elbow']),
  ramena:     new Set(['shoulder']),
  core:       new Set(['lower_back']),
  plank:      new Set(['lower_back', 'shoulder', 'elbow']),
  sila:       new Set(['lower_back']),   // generic strength → lower-back stabilizer, NOT knee
};

// ── Safety gate level ordinal ─────────────────────────────────────────────────

const SAFETY_RANK = {
  SAFE:                    5,
  SAFE_WITH_MODIFICATION:  4,
  NEEDS_MORE_EVIDENCE:     3,
  NEEDS_CLINICAL_CLEARANCE: 2,
  CONTRAINDICATED:         1,
};

// SAFE and SAFE_WITH_MODIFICATION are viable without further action.
const VIABLE_SAFETY = new Set(['SAFE', 'SAFE_WITH_MODIFICATION']);

// ── Constraint parsing ────────────────────────────────────────────────────────

export function parsePersonConstraints(userConstraintsRows) {
  const result = [];
  for (const row of (userConstraintsRows ?? [])) {
    let location = null;
    try {
      const val = typeof row.constraint_value === 'string'
        ? JSON.parse(row.constraint_value)
        : row.constraint_value;
      location = val?.location ?? null;
    } catch (_) {
      location = row.constraint_value ?? null;
    }

    if (!location) continue;
    const normalized = location.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');

    let key = null;
    for (const [bodyKey, keywords] of Object.entries(CONSTRAINT_KEYWORDS)) {
      if (keywords.some(kw => normalized.includes(
        kw.normalize('NFD').replace(/[̀-ͯ]/g, '')
      ))) {
        key = bodyKey;
        break;
      }
    }

    if (!key) continue;
    result.push({
      key,
      severity:       row.severity ?? null,
      constraint_type: row.constraint_type ?? 'injury',
      raw_location:   location,
    });
  }
  return result;
}

// ── Body load check ───────────────────────────────────────────────────────────

function actionLoadsRegion(action, regionKey) {
  const protocolLoad = PROTOCOL_BODY_LOAD[action.protocol_type];

  if (protocolLoad === null) {
    // TRAINING_PROTOKOL: derive from tags
    const tags = action.tags ?? [];
    const tagLoad = new Set();
    for (const tag of tags) {
      const regions = TAG_BODY_LOAD[tag];
      if (regions) regions.forEach(r => tagLoad.add(r));
    }
    return tagLoad.has(regionKey);
  }

  return protocolLoad?.has(regionKey) ?? false;
}

// ── Safety gate ───────────────────────────────────────────────────────────────

function evaluateSafetyGate(action, parsedConstraints, hasCvRiskRelevant) {
  const excludeList = action.constraint_exclude ?? [];

  // 1. Hard exclusion via constraint_exclude — CONTRAINDICATED regardless of severity
  for (const c of parsedConstraints) {
    if (excludeList.includes(c.key)) {
      return {
        level: 'CONTRAINDICATED',
        reason: `constraint_exclude match: "${c.key}" (severity=${c.severity ?? 'unknown'}). Action explicitly excluded for this body region.`,
        modifications_suggested: [],
      };
    }
  }

  // 2. High-intensity resistance or interval training with confirmed CV risk
  const isHighIntensity = action.tier >= 3 || (action.tags ?? []).includes('interval') || (action.tags ?? []).includes('norsky');
  if (hasCvRiskRelevant && (action.protocol_type === 'SILOVY_PROTOKOL' || isHighIntensity)) {
    return {
      level: 'NEEDS_CLINICAL_CLEARANCE',
      reason: 'High-intensity training with confirmed cardiovascular risk (RISK_RELEVANT). Obtain physician clearance before starting.',
      modifications_suggested: [
        'Consult cardiologist or GP before beginning',
        'Start with tier 1–2 intensity first',
        'Monitor blood pressure response',
      ],
    };
  }

  // 3. Constraint with unknown severity that would load the body region
  for (const c of parsedConstraints) {
    if (c.severity === null && actionLoadsRegion(action, c.key)) {
      return {
        level: 'NEEDS_MORE_EVIDENCE',
        reason: `Constraint on "${c.key}" with unknown severity — cannot assess safe loading without more information.`,
        modifications_suggested: ['Clarify injury severity before proceeding'],
      };
    }
  }

  // 4. Moderate resistance with CV risk (tier 1–2)
  if (hasCvRiskRelevant && action.protocol_type === 'SILOVY_PROTOKOL') {
    return {
      level: 'SAFE_WITH_MODIFICATION',
      reason: 'Resistance training with confirmed cardiovascular risk. Safe with BP monitoring and no Valsalva maneuver.',
      modifications_suggested: [
        'Monitor blood pressure before and after',
        'Avoid Valsalva (breath-holding)',
        'Stop if chest pain, severe dyspnea, or dizziness',
      ],
    };
  }

  // 5. Body constraint that loads the region — severity-graded response
  for (const c of parsedConstraints) {
    if (actionLoadsRegion(action, c.key)) {
      const level = c.severity === 'severe'   ? 'NEEDS_CLINICAL_CLEARANCE'
                  : c.severity === 'moderate' ? 'SAFE_WITH_MODIFICATION'
                  : 'SAFE'; // mild → proceed; low-impact variants preferred but not required
      const mods = c.severity === 'mild'
        ? ['Prefer low-impact variant (e.g. cycling over running)', 'Stop if discomfort increases']
        : c.severity === 'moderate'
        ? ['Consult physiotherapist first', 'Avoid high-impact variants', 'Stop immediately if pain increases']
        : ['Obtain physician clearance before starting'];
      return {
        level,
        reason: `${c.severity ?? 'unknown'} constraint on "${c.key}" — protocol loads this region. ${c.severity === 'mild' ? 'Mild: proceed with preferred low-impact variant.' : 'Requires modification.'}`,
        modifications_suggested: mods,
      };
    }
  }

  return {
    level: 'SAFE',
    reason: 'No relevant constraints or safety concerns identified.',
    modifications_suggested: [],
  };
}

// ── Minimum meaningful effect ─────────────────────────────────────────────────
// Structural gate only. No evidence-based dose/frequency thresholds in v0.1.
// MEANINGFUL: reserved for explicit evidence-based MME rules (none defined yet in v0.1).
// PLAUSIBLE:  timed/reps action — mechanism pathway exists, dose not validated.
// UNKNOWN:    habit/bool — effect depends on execution consistency alone.
//
// Protocol type (KARDIO, SILOVY, VYTRVALOST) is NOT sufficient to claim MEANINGFUL
// without a validated dose/frequency rule. Use PLAUSIBLE until rules are defined.

function evaluateMinMeaningfulEffect(action, _intervention) {
  const { type } = action;

  if (type === 'habit' || type === 'bool') {
    return {
      level: 'UNKNOWN',
      reason: 'Habit-type action — effect depends on execution consistency, not guaranteed by action type.',
    };
  }

  if (type === 'timed' || type === 'reps') {
    return {
      level: 'PLAUSIBLE',
      reason: 'Timed/rep-based action with a mechanism pathway. Protocol type alone is not a validated dose rule — MEANINGFUL requires an explicit evidence-based MME rule (not yet defined in v0.1).',
    };
  }

  return { level: 'UNKNOWN', reason: 'Action type does not guarantee a minimum effect dose.' };
}

// ── Intervention assignment ───────────────────────────────────────────────────
// Assigns each action to one intervention from the map.
// For TRAINING_PROTOKOL (shared across multiple interventions), disambiguation by tags.

const CARDIO_TAGS  = new Set(['kardio', 'zona2', 'vo2max', 'beh', 'vytrvalost', 'sprint', 'interval', 'pohyb', 'aerobni']);
const STRENGTH_TAGS = new Set(['sila', 'core', 'nohy', 'horni', 'kliky', 'drep', 'plank', 'stabilita', 'plyometrie']);

function assignIntervention(action, interventions) {
  const { protocol_type } = action;
  const tags = action.tags ?? [];

  // Non-TRAINING protocols → single exact match (KARDIO/VYTRVALOST → AEROBIC, SILOVY → RESISTANCE)
  if (protocol_type !== 'TRAINING_PROTOKOL') {
    const exact = interventions.filter(i => i.protocol_types.includes(protocol_type));
    return exact.length === 1 ? exact[0] : (exact[0] ?? null);
  }

  // TRAINING_PROTOKOL — disambiguate by tag semantics
  const hasCardio   = tags.some(t => CARDIO_TAGS.has(t));
  const hasStrength = tags.some(t => STRENGTH_TAGS.has(t));

  if (hasStrength && !hasCardio) {
    // Strength-primary action → RESISTANCE_TRAINING only if it declares TRAINING_PROTOKOL
    const rt = interventions.find(i => i.id === 'RESISTANCE_TRAINING' && i.protocol_types.includes('TRAINING_PROTOKOL'));
    return rt ?? null; // null → excluded from candidate pool
  }

  if (hasCardio) {
    // Walking/movement → BREAK_UP_SEDENTARY_TIME first, then DAILY_MOVEMENT
    const bst = interventions.find(i => i.id === 'BREAK_UP_SEDENTARY_TIME' && i.protocol_types.includes('TRAINING_PROTOKOL'));
    if (bst) return bst;
    const dm = interventions.find(i => i.id === 'DAILY_MOVEMENT' && i.protocol_types.includes('TRAINING_PROTOKOL'));
    return dm ?? null;
  }

  // No distinguishing tags → exclude rather than misassign
  return null;
}

// ── Scalar helpers ────────────────────────────────────────────────────────────

function computeLeverageAffinity(intervention) {
  return intervention?.leverage_affinity?.level ?? 'UNKNOWN';
}

function computeEffectOnLeverage(intervention, leverageNodeId) {
  if (!intervention) return 'low';
  return intervention.mechanism_targets.includes(leverageNodeId) ? 'high' : 'medium';
}

function computeGoalImpact(intervention) {
  if (!intervention) return { branches: [], survival_healthspan: false, functional_independence: false, mechanism_count: 0 };
  return {
    branches:                intervention.goal_branches ?? [],
    survival_healthspan:     (intervention.goal_branches ?? []).includes('SURVIVAL_HEALTHSPAN'),
    functional_independence: (intervention.goal_branches ?? []).includes('FUNCTIONAL_INDEPENDENCE'),
    mechanism_count:         (intervention.mechanism_targets ?? []).length,
  };
}

function computeFriction(action) {
  const { type, duration, reps, tier } = action;
  if (type === 'habit' || type === 'bool') return 'low';
  if (type === 'reps') return (reps ?? 0) <= 10 && tier <= 1 ? 'low' : 'medium';
  const min = (duration ?? 0) / 60;
  if (min <= 15) return 'low';
  if (min <= 40) return 'medium';
  return 'high';
}

function computeTimeToFeedback(action) {
  const { protocol_type } = action;
  if (['KARDIO_PROTOKOL', 'VYTRVALOST_PROTOKOL'].includes(protocol_type)) return 'days_to_weeks';
  if (protocol_type === 'SILOVY_PROTOKOL') return 'weeks';
  const tags = action.tags ?? [];
  if (tags.some(t => CARDIO_TAGS.has(t))) return 'days';
  return 'days_to_weeks';
}

function computeFeasibility(safety) {
  if (safety.level === 'SAFE')                    return 'high';
  if (safety.level === 'SAFE_WITH_MODIFICATION')  return 'medium';
  if (safety.level === 'NEEDS_MORE_EVIDENCE')     return 'low';
  if (safety.level === 'NEEDS_CLINICAL_CLEARANCE') return 'low';
  return 'none';
}

// ── Candidate builder ─────────────────────────────────────────────────────────

function buildCandidates(actionPool, interventions, parsedConstraints, hasCvRiskRelevant, leverageNodeId) {
  const candidates = [];

  for (const action of actionPool) {
    const intervention = assignIntervention(action, interventions);
    if (!intervention) continue;

    // Apply tag_filter if intervention specifies one (BREAK_UP_SEDENTARY_TIME → only kardio-tagged actions)
    if (intervention.tag_filter?.length > 0) {
      const tags = action.tags ?? [];
      if (!tags.some(t => intervention.tag_filter.includes(t))) continue;
    }

    const safety               = evaluateSafetyGate(action, parsedConstraints, hasCvRiskRelevant);
    const min_meaningful_effect = evaluateMinMeaningfulEffect(action, intervention);
    const leverage_affinity    = computeLeverageAffinity(intervention);
    const effect_on_leverage   = computeEffectOnLeverage(intervention, leverageNodeId);
    const goal_impact          = computeGoalImpact(intervention);
    const feasibility          = computeFeasibility(safety);
    const friction             = computeFriction(action);
    const time_to_feedback     = computeTimeToFeedback(action);

    const constraint_matches = parsedConstraints
      .filter(c => (action.constraint_exclude ?? []).includes(c.key) || actionLoadsRegion(action, c.key))
      .map(c => ({ key: c.key, severity: c.severity, excluded: (action.constraint_exclude ?? []).includes(c.key) }));

    candidates.push({
      action_id:            action.id,
      intervention_id:      intervention.id,
      protocol_type:        action.protocol_type,
      label:                action.label,
      tier:                 action.tier,
      safety,
      min_meaningful_effect,
      leverage_affinity,
      effect_on_leverage,
      goal_impact,
      feasibility,
      friction,
      time_to_feedback,
      constraint_matches,
      evidence:             [],
      missing_evidence:     [],
    });
  }

  return candidates;
}

// ── Ordinal selection ─────────────────────────────────────────────────────────
// Order: safety → MME → leverage_affinity → effect_on_leverage → goal_impact
//        → feasibility → friction → time_to_feedback

const MME_RANK      = { MEANINGFUL: 3, PLAUSIBLE: 2, UNKNOWN: 1 };
const AFFINITY_RANK = { PRIMARY: 4, CONTRIBUTORY: 3, ACCESSORY: 2, UNKNOWN: 1 };
const LEVER_RANK    = { high: 3, medium: 2, low: 1 };
const FEAS_RANK     = { high: 3, medium: 2, low: 1, none: 0 };
const FRIC_RANK     = { low: 3, medium: 2, high: 1 };
const TIME_RANK     = { days: 3, days_to_weeks: 2, weeks: 1, months: 0 };

function selectBestCandidate(viable, hasCvRiskContext) {
  if (viable.length === 0) return null;

  return viable.slice().sort((a, b) => {
    // 1. Safety (SAFE > SAFE_WITH_MODIFICATION — both viable but SAFE preferred)
    const sd = SAFETY_RANK[b.safety.level] - SAFETY_RANK[a.safety.level];
    if (sd !== 0) return sd;

    // 2. Min meaningful effect
    const md = MME_RANK[b.min_meaningful_effect.level] - MME_RANK[a.min_meaningful_effect.level];
    if (md !== 0) return md;

    // 3. Leverage affinity — how directly the intervention acts on the leverage node
    const afd = AFFINITY_RANK[b.leverage_affinity] - AFFINITY_RANK[a.leverage_affinity];
    if (afd !== 0) return afd;

    // 4. Effect on leverage
    const ed = LEVER_RANK[b.effect_on_leverage] - LEVER_RANK[a.effect_on_leverage];
    if (ed !== 0) return ed;

    // 5. Goal impact — SURVIVAL_HEALTHSPAN priority when CV risk context active
    if (hasCvRiskContext) {
      const cvd = (b.goal_impact.survival_healthspan ? 1 : 0) - (a.goal_impact.survival_healthspan ? 1 : 0);
      if (cvd !== 0) return cvd;
    }
    const bd = b.goal_impact.branches.length - a.goal_impact.branches.length;
    if (bd !== 0) return bd;

    // 6. Feasibility
    const fd = FEAS_RANK[b.feasibility] - FEAS_RANK[a.feasibility];
    if (fd !== 0) return fd;

    // 7. Friction (lower is better → higher FRIC_RANK wins)
    const frd = FRIC_RANK[b.friction] - FRIC_RANK[a.friction];
    if (frd !== 0) return frd;

    // 8. Time to feedback (faster is better)
    return TIME_RANK[b.time_to_feedback] - TIME_RANK[a.time_to_feedback];
  })[0] ?? null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeNextBestAction({
  leverageNodeId,
  interventions,
  actionPool,
  personConstraints,
  clinicalHistory,
  decisionGate,
  node_states,
  engineVersion,
}) {
  const now = new Date().toISOString();

  // Detect CV risk context from decision gate (HYPERTENSION / DYSLIPIDEMIA CONFIRMED → RISK_RELEVANT)
  const hasCvRiskRelevant = (decisionGate?.context_gates ?? []).some(g =>
    g.decision_context?.id === 'CURRENT_CV_STATE' &&
    (g.actionable_findings ?? []).some(f => f.actionability === 'RISK_RELEVANT')
  );

  const parsedConstraints = parsePersonConstraints(personConstraints);

  const candidates = buildCandidates(
    actionPool,
    interventions,
    parsedConstraints,
    hasCvRiskRelevant,
    leverageNodeId,
  );

  if (candidates.length === 0) {
    return {
      status:         'NO_CANDIDATES',
      reason:         `No longevity_actions matched protocol_types for ${leverageNodeId} intervention map.`,
      selected:       null,
      all_candidates: [],
      evaluated_at:   now,
      engine_version: engineVersion,
    };
  }

  // Partition by viable safety
  const viable       = candidates.filter(c => VIABLE_SAFETY.has(c.safety.level));
  const non_viable   = candidates.filter(c => !VIABLE_SAFETY.has(c.safety.level));

  // If all non-viable due to NEEDS_MORE_EVIDENCE → request evidence
  const allNeedEvidence = non_viable.length > 0 &&
    viable.length === 0 &&
    non_viable.every(c => c.safety.level === 'NEEDS_MORE_EVIDENCE');

  if (allNeedEvidence) {
    return {
      status:          'NEED_MORE_EVIDENCE',
      reason:          'All candidates blocked by unknown constraint severity. Clarify injury status to proceed.',
      next_best_question: 'Jak závažné je tvé omezení pohybu? (lehké / střední / závažné)',
      selected:        null,
      all_candidates:  candidates,
      evaluated_at:    now,
      engine_version:  engineVersion,
    };
  }

  const selected = selectBestCandidate(viable, hasCvRiskRelevant);

  return {
    status:              'SELECTED',
    selected,
    viable_count:        viable.length,
    non_viable_count:    non_viable.length,
    parsed_constraints:  parsedConstraints,
    cv_risk_context:     hasCvRiskRelevant,
    all_candidates:      candidates,
    evaluated_at:        now,
    engine_version:      engineVersion,
  };
}
