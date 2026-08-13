// adherence.js — Feedback Loop v0.1
//
// Three-layer model:
//   ACTION_EXECUTION      → action_assignments rows (status: ASSIGNED/COMPLETED/SKIPPED)
//   INTERVENTION_EXPOSURE → computeInterventionExposure() — aggregated behavioral facts,
//                           no biological claim
//   RESPONSE_EVALUATION   → evaluateResponseEvaluations() — compares expected_response
//                           vs actual HEALTH_OBSERVATION
//
// Epistemic constraints (enforced throughout):
//   1. RESPONSE_EVALUATION never asserts causality.
//      Only valid result: CONSISTENT_WITH_EXPECTED_RESPONSE (correlation, not cause).
//   2. NO_RESPONSE_OBSERVED requires minimum_exposure_rule to be met.
//      Insufficient exposure → INSUFFICIENT_EXPOSURE (not a negative conclusion).
//   3. Node states change only via activation.js / inference.js (daily_checkin, labs).
//      Nothing in this module writes to or implies node state changes.
//   4. CONSISTENT_WITH_EXPECTED_RESPONSE influences NBA ranking only as a tiebreaker
//      within interventions for the current leverage node — never overrides
//      safety / leverage / affinity ranking.

// ── INTERVENTION_EXPOSURE ─────────────────────────────────────────────────────

export function computeInterventionExposure(assignments) {
  const byIntervention = new Map();

  for (const a of (assignments ?? [])) {
    if (!byIntervention.has(a.intervention_id)) {
      byIntervention.set(a.intervention_id, {
        intervention_id:    a.intervention_id,
        leverage_node_id:   a.selected_leverage_node,
        all:                [],
      });
    }
    byIntervention.get(a.intervention_id).all.push(a);
  }

  const result = [];
  for (const [, group] of byIntervention) {
    const all       = group.all;
    const completed = all.filter(a => a.status === 'COMPLETED');
    const skipped   = all.filter(a => a.status === 'SKIPPED');

    const dates = all.map(a => a.assigned_date).sort();
    const periodStart = dates[0];
    const periodEnd   = dates[dates.length - 1];
    const calendarDays = Math.max(1,
      Math.round((new Date(periodEnd) - new Date(periodStart)) / 86400000) + 1
    );

    const totalActualDuration = completed.reduce(
      (sum, a) => sum + (a.actual_duration_seconds ?? 0), 0
    );

    // First completed timestamp — used as temporal anchor for observation filtering
    const completedAts = completed
      .map(a => a.completed_at)
      .filter(Boolean)
      .sort();
    const first_completed_at = completedAts[0] ?? null;

    result.push({
      intervention_id:        group.intervention_id,
      leverage_node_id:       group.leverage_node_id,
      period_start:           periodStart,
      period_end:             periodEnd,
      calendar_days_in_period: calendarDays,
      sessions_assigned:      all.length,
      sessions_completed:     completed.length,
      sessions_skipped:       skipped.length,
      total_actual_duration_s: totalActualDuration,
      first_completed_at,
    });
  }

  return result;
}

// ── Direction evaluation ──────────────────────────────────────────────────────
// Compares post-intervention observations against expected direction.
// Returns { matches: bool, summary: string }.
// No binary threshold for ordinal types — compares relative distribution.
// For numeric types — compares first vs most-recent value.

function evaluateDirection(observations, expected_direction, obs_type) {
  if (obs_type === 'activity_level') {
    const medHigh = observations.filter(o => o.value === 'medium' || o.value === 'high').length;
    const low     = observations.filter(o => o.value === 'low').length;
    const total   = observations.length;
    if (expected_direction === 'increase') {
      return {
        matches: medHigh > low,
        summary: `${medHigh} medium/high vs ${low} low (${total} observations)`,
      };
    }
    if (expected_direction === 'decrease') {
      return {
        matches: low > medHigh,
        summary: `${low} low vs ${medHigh} medium/high (${total} observations)`,
      };
    }
  }

  // Numeric observations — compare first vs most-recent value
  const sorted = observations
    .filter(o => o.measured_at && o.value != null && !isNaN(Number(o.value)))
    .map(o => ({ v: Number(o.value), d: new Date(o.measured_at) }))
    .sort((a, b) => a.d - b.d);

  if (sorted.length < 2) {
    return { matches: false, summary: 'Fewer than 2 dated numeric observations — trend undetermined' };
  }

  const first  = sorted[0].v;
  const latest = sorted[sorted.length - 1].v;
  const delta  = latest - first;
  const sign   = delta > 0 ? '+' : '';

  if (expected_direction === 'decrease') return { matches: delta < 0, summary: `${first} → ${latest} (${sign}${delta.toFixed(1)})` };
  if (expected_direction === 'increase') return { matches: delta > 0, summary: `${first} → ${latest} (${sign}${delta.toFixed(1)})` };
  if (expected_direction === 'stabilize') {
    const pct = Math.abs(delta / first);
    return { matches: pct < 0.05, summary: `${first} → ${latest} (${sign}${delta.toFixed(1)}, ${(pct * 100).toFixed(1)}% change)` };
  }

  return { matches: false, summary: `Unknown direction "${expected_direction}"` };
}

// ── Single response evaluation ────────────────────────────────────────────────

function evaluateSingleResponse(exposure, expectedResponse, observations, firstCompletedAt) {
  const {
    response_id,
    target_node,
    observable_obs_type,
    expected_direction,
    horizon_min_days,
    minimum_exposure_rule,
    evidence_quality,
  } = expectedResponse;

  const base = { response_id, target_node, observable_obs_type, evidence_quality };

  // No completed session at all → TOO_EARLY
  if (!firstCompletedAt) {
    return {
      ...base,
      result: 'TOO_EARLY',
      reason: 'No completed sessions yet — exposure has not begun.',
    };
  }

  const daysSinceFirst = (Date.now() - new Date(firstCompletedAt)) / 86400000;

  if (daysSinceFirst < horizon_min_days) {
    return {
      ...base,
      result: 'TOO_EARLY',
      reason: `${Math.floor(daysSinceFirst)} of ${horizon_min_days} minimum days elapsed since first completed session.`,
    };
  }

  // Horizon elapsed — check minimum_exposure_rule before any negative conclusion
  if (minimum_exposure_rule) {
    const { min_sessions_completed, min_calendar_days, rationale } = minimum_exposure_rule;
    const sessionsOk  = exposure.sessions_completed >= min_sessions_completed;
    const calendarOk  = exposure.calendar_days_in_period >= min_calendar_days;

    if (!sessionsOk || !calendarOk) {
      return {
        ...base,
        result: 'INSUFFICIENT_EXPOSURE',
        reason: `Minimum exposure rule not met — ${exposure.sessions_completed}/${min_sessions_completed} sessions, ` +
                `${exposure.calendar_days_in_period}/${min_calendar_days} calendar days. ${rationale}`,
        exposure_detail: {
          sessions_completed:   exposure.sessions_completed,
          min_sessions_required: min_sessions_completed,
          calendar_days:        exposure.calendar_days_in_period,
          min_calendar_days_required: min_calendar_days,
        },
      };
    }
  }

  // Check for relevant observations AFTER intervention started
  const anchor = new Date(firstCompletedAt);
  const relevantObs = (observations ?? []).filter(o =>
    o.obs_type === observable_obs_type &&
    o.measured_at &&
    new Date(o.measured_at) > anchor
  );

  if (relevantObs.length === 0) {
    return {
      ...base,
      result: 'INSUFFICIENT_OBSERVATION',
      reason: `Horizon elapsed and minimum exposure met, but no "${observable_obs_type}" observation ` +
              `found after intervention start (${anchor.toISOString().slice(0, 10)}).`,
    };
  }

  const dir = evaluateDirection(relevantObs, expected_direction, observable_obs_type);

  if (dir.matches) {
    return {
      ...base,
      result: 'CONSISTENT_WITH_EXPECTED_RESPONSE',
      // Explicit non-causal framing — no claim that the intervention caused the change.
      reason: `Observation of "${observable_obs_type}" is consistent with expected direction ` +
              `"${expected_direction}" following exposure. Correlation only — no causal inference.`,
      observation_summary: dir.summary,
    };
  }

  return {
    ...base,
    result: 'NO_RESPONSE_OBSERVED',
    reason: `Minimum exposure met and observation available, but "${expected_direction}" direction ` +
            `not observed for "${observable_obs_type}". Consider alternative intervention or clinical assessment.`,
    observation_summary: dir.summary,
  };
}

// ── Main export — evaluates all exposures against intervention map ─────────────

function findIntervention(interventionMap, intervention_id) {
  for (const mappings of Object.values(interventionMap.mappings ?? {})) {
    const found = (mappings.interventions ?? []).find(i => i.id === intervention_id);
    if (found) return found;
  }
  return null;
}

export function evaluateResponseEvaluations(exposures, interventionMap, observations, rawAssignments) {
  const results = [];

  for (const exposure of (exposures ?? [])) {
    const interventionDef = findIntervention(interventionMap, exposure.intervention_id);
    if (!interventionDef?.expected_responses?.length) continue;

    // First completed timestamp for this intervention
    const completedAts = (rawAssignments ?? [])
      .filter(a => a.intervention_id === exposure.intervention_id && a.status === 'COMPLETED' && a.completed_at)
      .map(a => a.completed_at)
      .sort();
    const firstCompletedAt = completedAts[0] ?? null;

    for (const expectedResponse of interventionDef.expected_responses) {
      results.push({
        intervention_id:  exposure.intervention_id,
        leverage_node_id: exposure.leverage_node_id,
        ...evaluateSingleResponse(exposure, expectedResponse, observations, firstCompletedAt),
      });
    }
  }

  return results;
}

// ── Information needs from INSUFFICIENT_OBSERVATION ───────────────────────────
// Only INSUFFICIENT_OBSERVATION generates an information need.
// CONSISTENT_WITH_EXPECTED_RESPONSE and NO_RESPONSE_OBSERVED feed into NBA rationale,
// not into information needs.

export function buildResponseInformationNeeds(responseEvaluations) {
  return (responseEvaluations ?? [])
    .filter(r => r.result === 'INSUFFICIENT_OBSERVATION')
    .map(r => ({
      id:                   `NEED_response_${r.observable_obs_type}_${r.intervention_id}`,
      evidence_type:        r.observable_obs_type,
      source:               'RESPONSE_EVALUATION',
      needed_for:           [{ entity_type: 'INTERVENTION_EXPOSURE', entity_id: r.intervention_id }],
      decision_impact:      'low',
      uncertainty_reduction: 'medium',
      acquisition_cost:     r.observable_obs_type === 'activity_level' ? 'very_low' : 'low',
      urgency:              'low',
      acquisition_method:   r.observable_obs_type === 'activity_level' ? 'question' : 'home_measurement',
      explanation:          r.reason,
    }));
}
