// dailyDecision.js — DAILY_DECISION orchestration (Engine v1)
//
// Pure orchestration layer — reads runEngine() output, returns one decision.
// NO new clinical inference. NO changes to NBA/NBE ranking.
//
// Priority:
//   SAFETY_CRITICAL  > SAFETY_BLOCKED  > ASK_BLOCKING  > HOLD  > ACT
//
// reason_code values:
//   SAFETY_CRITICAL      — SAFETY_CRITICAL actionability in decision_gate (person state signal)
//   SAFETY_BLOCKED       — all action candidates non-viable due to safety gate (not a crisis)
//   ASK_BLOCKING         — NBA cannot select any action; evidence would unblock
//   HOLD_TOO_EARLY       — active intervention, horizon not yet elapsed
//   HOLD_INSUF_EXPOSURE  — horizon elapsed but minimum exposure rule not met
//   ACT_READY            — NBA selected a viable action

// ── Internal helpers ──────────────────────────────────────────────────────────

const URGENCY_RANK = { high: 0, medium: 1, low: 2 };
const IMPACT_RANK  = { high: 0, medium: 1, low: 2 };
const UNCERT_RANK  = { high: 0, medium: 1, low: 2 };
const COST_RANK    = { very_low: 0, low: 1, medium: 2, high: 3 };

// Picks the highest-priority next_best_evidence across all NEED_MORE_EVIDENCE context gates.
// Same lexicographic order as nextBestEvidence.js.
// Returns { nbe, context_id } or null.
function pickBestNbe(decision_gate) {
  const candidates = (decision_gate?.context_gates ?? [])
    .filter(g => g.status === 'NEED_MORE_EVIDENCE' && g.next_best_evidence != null)
    .map(g => ({ nbe: g.next_best_evidence, context_id: g.decision_context.id }));

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const na = a.nbe, nb = b.nbe;
    return (URGENCY_RANK[na.urgency] ?? 99) - (URGENCY_RANK[nb.urgency] ?? 99)
        || (IMPACT_RANK[na.decision_impact] ?? 99)  - (IMPACT_RANK[nb.decision_impact] ?? 99)
        || (UNCERT_RANK[na.uncertainty_reduction] ?? 99) - (UNCERT_RANK[nb.uncertainty_reduction] ?? 99)
        || (COST_RANK[na.acquisition_cost] ?? 99)   - (COST_RANK[nb.acquisition_cost] ?? 99);
  })[0];
}

// ── Check functions (one per priority level) ──────────────────────────────────

// SAFETY_CRITICAL: SAFETY_CRITICAL actionability in any context gate.
// Person-state signal — may override the entire daily loop.
// Returns finding object or null.
function checkSafetyCritical(decision_gate) {
  for (const gate of (decision_gate?.context_gates ?? [])) {
    const critical = (gate.actionable_findings ?? [])
      .find(f => f.actionability === 'SAFETY_CRITICAL');
    if (critical) {
      return {
        context_id:      gate.decision_context.id,
        finding_node_id: critical.entity_id,
        actionability:   'SAFETY_CRITICAL',
      };
    }
  }
  return null;
}

// SAFETY_BLOCKED: viable_count === 0 AND every candidate is hard-blocked by safety gate.
// Hard-blocked = CONTRAINDICATED or NEEDS_CLINICAL_CLEARANCE (not NEEDS_MORE_EVIDENCE).
// Mixed (some NEEDS_MORE_EVIDENCE) → returns null → falls through to ASK_BLOCKING.
// Returns blocked summary or null.
function checkSafetyBlocked(next_best_action) {
  const candidates = next_best_action?.all_candidates ?? [];
  if (candidates.length === 0) return null;

  const viable = candidates.filter(c =>
    ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(c.safety?.level)
  );
  if (viable.length > 0) return null;

  const hardBlocked = candidates.filter(c =>
    ['CONTRAINDICATED', 'NEEDS_CLINICAL_CLEARANCE'].includes(c.safety?.level)
  );

  // Must be ALL hard-blocked — any NEEDS_MORE_EVIDENCE → ASK territory, not SAFETY_BLOCKED
  if (hardBlocked.length !== candidates.length) return null;

  const worst = hardBlocked.some(c => c.safety?.level === 'CONTRAINDICATED')
    ? 'CONTRAINDICATED'
    : 'NEEDS_CLINICAL_CLEARANCE';

  return {
    blocked_count:      candidates.length,
    worst_safety_level: worst,
    blocked_candidates: hardBlocked.map(c => ({
      action_id:               c.action_id,
      label:                   c.label,
      safety_level:            c.safety.level,
      reason:                  c.safety.reason,
      modifications_suggested: c.safety.modifications_suggested ?? [],
    })),
  };
}

// ASK_BLOCKING: NBA cannot deliver an action.
// Triggers on:
//   NBA.status ∈ {NEED_MORE_EVIDENCE, NO_CANDIDATES, NOT_COMPUTED}
//   NBA.status === SELECTED but selected === null (edge: mixed safety levels, none viable)
// Returns { primary_item, nba_status } or null.
function checkAskBlocking(next_best_action, decision_gate) {
  const nbaStatus = next_best_action?.status;
  const effectivelyBlocked =
    ['NEED_MORE_EVIDENCE', 'NO_CANDIDATES', 'NOT_COMPUTED'].includes(nbaStatus) ||
    (nbaStatus === 'SELECTED' && !next_best_action?.selected);

  if (!effectivelyBlocked) return null;

  // Primary: NBA has its own constraint-severity question
  if (nbaStatus === 'NEED_MORE_EVIDENCE' && next_best_action.next_best_question) {
    return {
      primary_item: {
        type:     'NBA_QUESTION',
        question: next_best_action.next_best_question,
      },
      nba_status: nbaStatus,
    };
  }

  // Secondary: pick best NBE from context gates
  const bestNbe = pickBestNbe(decision_gate);
  if (bestNbe) {
    return {
      primary_item: {
        type:       'NEXT_BEST_EVIDENCE',
        context_id: bestNbe.context_id,
        ...bestNbe.nbe,
      },
      nba_status: nbaStatus,
    };
  }

  // No question available — still signal ASK (UI will handle the empty case)
  return {
    primary_item: null,
    nba_status:   nbaStatus,
  };
}

// HOLD: NBA selected an action AND that same intervention has active exposure
// AND all response_evals for it are TOO_EARLY or INSUFFICIENT_EXPOSURE.
// Returns hold context or null.
function checkHold(next_best_action, response_evaluations, intervention_exposure) {
  if (next_best_action?.status !== 'SELECTED') return null;
  const selectedInterventionId = next_best_action.selected?.intervention_id;
  if (!selectedInterventionId) return null;

  // Must have active exposure for the selected intervention
  const activeExposure = (intervention_exposure ?? []).find(
    e => e.intervention_id === selectedInterventionId && e.sessions_completed > 0
  );
  if (!activeExposure) return null;

  // All response_evals for this intervention must be in the holdable set
  const HOLDABLE = new Set(['TOO_EARLY', 'INSUFFICIENT_EXPOSURE']);
  const evalsForIntervention = (response_evaluations ?? []).filter(
    r => r.intervention_id === selectedInterventionId
  );
  if (evalsForIntervention.length === 0) return null;
  if (!evalsForIntervention.every(r => HOLDABLE.has(r.result))) return null;

  // TOO_EARLY takes priority when both are present (earlier temporal signal)
  const holdResult = evalsForIntervention.some(r => r.result === 'TOO_EARLY')
    ? 'TOO_EARLY'
    : 'INSUFFICIENT_EXPOSURE';

  const holdEval = evalsForIntervention.find(r => r.result === holdResult);
  const reevaluate_after = computeReevaluateAfter(holdResult, holdEval, activeExposure);

  return {
    hold_result:    holdResult,
    evals:          evalsForIntervention,
    exposure:       activeExposure,
    reevaluate_after,
  };
}

// Computes reevaluate_after date for HOLD.
// TOO_EARLY:          parse horizon_min_days from reason string + add to first_completed_at
// INSUFFICIENT_EXPOSURE: use exposure_detail.min_calendar_days_required to estimate
function computeReevaluateAfter(holdResult, holdEval, activeExposure) {
  if (holdResult === 'TOO_EARLY' && activeExposure?.first_completed_at) {
    // reason: "X of Y minimum days elapsed since first completed session."
    const match = holdEval?.reason?.match(/of (\d+) minimum days/);
    if (match) {
      const horizonDays = parseInt(match[1], 10);
      const base = new Date(activeExposure.first_completed_at);
      base.setDate(base.getDate() + horizonDays);
      return base.toISOString().slice(0, 10);
    }
  }

  if (holdResult === 'INSUFFICIENT_EXPOSURE') {
    const detail = holdEval?.exposure_detail;
    if (detail) {
      const daysRemaining = Math.max(0,
        detail.min_calendar_days_required - detail.calendar_days
      );
      const today = new Date();
      today.setDate(today.getDate() + daysRemaining + 1);
      return today.toISOString().slice(0, 10);
    }
  }

  return null;
}

// Returns the best safe alternative candidate that is not in active exposure.
// Used to bypass HOLD when the originally selected intervention was just completed
// but a health-state change (new symptom/constraint) opens another viable action.
// General: does not inspect body regions — relies on safety.level from the engine.
function findAlternativeCandidate(next_best_action, intervention_exposure) {
  const selectedId = next_best_action?.selected?.intervention_id;
  const candidates = next_best_action?.all_candidates ?? [];
  const activeIds = new Set(
    (intervention_exposure ?? [])
      .filter(e => e.sessions_completed > 0)
      .map(e => e.intervention_id)
  );

  return candidates.find(c =>
    c.intervention_id !== selectedId
    && ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(c.safety?.level)
    && !activeIds.has(c.intervention_id)
  ) ?? null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeDailyDecision(engineResult) {
  const {
    decision_gate,
    next_best_action,
    response_evaluations,
    intervention_exposure,
  } = engineResult;

  const now = new Date().toISOString();

  // ── 1. SAFETY_CRITICAL ────────────────────────────────────────────────────────
  const safetyCritical = checkSafetyCritical(decision_gate);
  if (safetyCritical) {
    return {
      mode:             'SAFETY',
      primary_item:     safetyCritical,
      reason_code:      'SAFETY_CRITICAL',
      source:           'DECISION_GATE.actionable_findings',
      reevaluate_after: null,
      evaluated_at:     now,
    };
  }

  // ── 2. SAFETY_BLOCKED ─────────────────────────────────────────────────────────
  const safetyBlocked = checkSafetyBlocked(next_best_action);
  if (safetyBlocked) {
    return {
      mode:             'SAFETY',
      primary_item:     safetyBlocked,
      reason_code:      'SAFETY_BLOCKED',
      source:           'NBA.all_candidates',
      reevaluate_after: null,
      evaluated_at:     now,
    };
  }

  // ── 3. ASK_BLOCKING ───────────────────────────────────────────────────────────
  const askBlocking = checkAskBlocking(next_best_action, decision_gate);
  if (askBlocking) {
    return {
      mode:         'ASK',
      primary_item: askBlocking.primary_item,
      reason_code:  'ASK_BLOCKING',
      source:       askBlocking.primary_item?.type === 'NBA_QUESTION'
        ? 'NBA.next_best_question'
        : 'DECISION_GATE.next_best_evidence',
      reevaluate_after: null,
      evaluated_at:    now,
    };
  }

  // From here: NBA.status === 'SELECTED' with a non-null selected action

  // ── 4. HOLD ───────────────────────────────────────────────────────────────────
  const hold = checkHold(next_best_action, response_evaluations, intervention_exposure);
  if (hold) {
    // Before committing to HOLD: check for a safe alternative without active exposure.
    // Prevents stale HOLD when health state changed (new symptom/constraint) and the
    // originally selected intervention was just completed, but others remain viable.
    const alternative = findAlternativeCandidate(next_best_action, intervention_exposure);
    if (alternative) {
      return {
        mode:         'ACT',
        primary_item: {
          action_id:         alternative.action_id,
          label:             alternative.label,
          protocol_type:     alternative.protocol_type,
          intervention_id:   alternative.intervention_id,
          safety:            alternative.safety,
          leverage_affinity: alternative.leverage_affinity,
          goal_impact:       alternative.goal_impact,
          friction:          alternative.friction,
          time_to_feedback:  alternative.time_to_feedback,
        },
        reason_code:      'ACT_READY',
        source:           'NBA.all_candidates',
        reevaluate_after: null,
        evaluated_at:     now,
      };
    }

    const sel = next_best_action.selected;
    return {
      mode: 'HOLD',
      primary_item: {
        action_id:       sel?.action_id,
        label:           sel?.label,
        protocol_type:   sel?.protocol_type,
        intervention_id: sel?.intervention_id,
        safety:          sel?.safety,
        response_result: hold.hold_result,
        exposure_summary: {
          sessions_completed: hold.exposure.sessions_completed,
          first_completed_at: hold.exposure.first_completed_at,
        },
      },
      reason_code:      hold.hold_result === 'TOO_EARLY'
        ? 'HOLD_TOO_EARLY'
        : 'HOLD_INSUF_EXPOSURE',
      source:           'RESPONSE_EVALUATION + NBA.selected',
      reevaluate_after: hold.reevaluate_after,
      evaluated_at:     now,
    };
  }

  // ── 5. ACT ────────────────────────────────────────────────────────────────────
  const sel = next_best_action?.selected;
  return {
    mode: 'ACT',
    primary_item: {
      action_id:       sel?.action_id,
      label:           sel?.label,
      protocol_type:   sel?.protocol_type,
      intervention_id: sel?.intervention_id,
      safety:          sel?.safety,
      leverage_affinity: sel?.leverage_affinity,
      goal_impact:     sel?.goal_impact,
      friction:        sel?.friction,
      time_to_feedback: sel?.time_to_feedback,
    },
    reason_code:      'ACT_READY',
    source:           'NBA.selected',
    reevaluate_after: null,
    evaluated_at:     now,
  };
}
