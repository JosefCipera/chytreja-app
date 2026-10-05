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
//   HOLD_DONE_TODAY      — selected intervention already completed today; offer it again tomorrow
//   ACT_READY            — NBA selected a viable action
//
// HOLD_TOO_EARLY / HOLD_INSUF_EXPOSURE are no longer emitted: TOO_EARLY and
// INSUFFICIENT_EXPOSURE remain RESPONSE_EVALUATION results, but they must not block
// the repetitions that minimum_exposure_rule requires. Repetition is limited to one
// completed session per intervention per day.

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

// HOLD: NBA selected an action AND that same intervention already has a COMPLETED
// session today (UTC date). The hold lasts only for the rest of the day — the next day
// NBA and the Safety Gate run again and the intervention is offered as a normal ACT,
// until minimum_exposure_rule and the response horizon are reached.
// Returns hold context or null.
function checkHold(next_best_action, response_evaluations, intervention_exposure, now) {
  if (next_best_action?.status !== 'SELECTED') return null;
  const selectedInterventionId = next_best_action.selected?.intervention_id;
  if (!selectedInterventionId) return null;

  const today = now.slice(0, 10);
  // Membership in the set of valid completed days — not the lexicographically last date,
  // so a corrupted or future-dated row cannot mask today's completion.
  const exposure = (intervention_exposure ?? []).find(
    e => e.intervention_id === selectedInterventionId
      && (e.completed_days ?? [e.last_completed_date]).includes(today)
  );
  if (!exposure) return null;

  const evals = (response_evaluations ?? []).filter(
    r => r.intervention_id === selectedInterventionId
  );

  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  return {
    evals,
    exposure,
    reevaluate_after: tomorrow.toISOString().slice(0, 10),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

// asOf (optional): decision time as Date or ISO string — defaults to the current time.
// Tests pass a fixed UTC time; production callers omit it.
export function computeDailyDecision(engineResult, asOf = new Date()) {
  const {
    decision_gate,
    next_best_action,
    response_evaluations,
    intervention_exposure,
  } = engineResult;

  const now = new Date(asOf).toISOString();

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

  // No evidence can restore an action explicitly skipped for today.
  // This is not completion; only the exhausted daily candidate pool triggers HOLD.
  if (next_best_action?.status === 'NO_CANDIDATES'
      && next_best_action.reason_code === 'ALL_ACTIONS_SKIPPED_TODAY') {
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return {
      mode: 'HOLD', primary_item: null, reason_code: 'HOLD_SKIPPED_TODAY',
      source: 'NBA.skippedTodayActionIds',
      reevaluate_after: tomorrow.toISOString().slice(0, 10), evaluated_at: now,
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
  const hold = checkHold(next_best_action, response_evaluations, intervention_exposure, now);
  if (hold) {
    const sel = next_best_action.selected;
    return {
      mode: 'HOLD',
      primary_item: {
        action_id:       sel?.action_id,
        label:           sel?.label,
        protocol_type:   sel?.protocol_type,
        intervention_id: sel?.intervention_id,
        safety:          sel?.safety,
        response_result: hold.evals[0]?.result ?? null,
        exposure_summary: {
          sessions_completed:  hold.exposure.sessions_completed,
          first_completed_at:  hold.exposure.first_completed_at,
          last_completed_date: hold.exposure.last_completed_date,
        },
      },
      reason_code:      'HOLD_DONE_TODAY',
      source:           'INTERVENTION_EXPOSURE + NBA.selected',
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
