// test-repetition-loop.mjs — Repetition loop regression: HOLD only for the rest of the completion day
//
// Root cause (reproduced): after the first `Hotovo`, DAILY_DECISION held the intervention
// (HOLD_TOO_EARLY → HOLD_INSUF_EXPOSURE) while HOLD carried no current_action_assignment and
// no Hotovo/Přeskočit buttons. Further sessions required by minimum_exposure_rule could not be
// recorded — the loop never reached response evaluation. Conversely, interventions without a
// holdable evaluation were re-offered as ACT on the same day (second completion possible).
//
// Fix: adherence.computeInterventionExposure → last_completed_date;
//      dailyDecision.checkHold → HOLD_DONE_TODAY only when the selected intervention was
//      completed today, reevaluate_after = tomorrow; otherwise normal ACT (NBA + Safety Gate
//      run again); orchestrator → "Pro dnešek stačí. Zítra pokračujeme."
//
// Sections (no DB, no network — engine modules are real; orchestrator dependencies mocked):
//   R1   day 1 before any session                → ACT
//   R2   day 1 after Hotovo                       → HOLD_DONE_TODAY, reevaluate_after = tomorrow
//   R3   day 2 (completed yesterday)              → ACT again (was HOLD_TOO_EARLY)
//   R4   8-day walking loop                       → 1 session/day, exposure rule reached, evaluation reached
//   R5   after horizon + exposure                 → ACT continues; same day after Hotovo → HOLD_DONE_TODAY
//   R6   intervention without expected_responses → HOLD_DONE_TODAY after Hotovo (was ACT again)
//   R7   Přeskočit today                          → no HOLD, skipped action_id not re-offered, 0 sessions
//   R8   priorities                               → SAFETY_CRITICAL / SAFETY_BLOCKED / ASK_BLOCKING beat HOLD
//   R9   completed X today, NBA selects Y         → ACT Y (no HOLD)
//   R10  future FUNCTIONAL_STRENGTH_TRAINING (in-memory mapping only) → same loop semantics
//   R11  today COMPLETED + future-dated COMPLETED   → HOLD today
//   R12  today COMPLETED + corrupted date           → HOLD today
//   R13  only future / invalid dates                → ACT today, zero valid exposure
//   R14  two COMPLETED rows on one day              → sessions_completed = 1
//   R15  SKIPPED + COMPLETED                        → only COMPLETED days count
//   R16  stale current_action_assignment            → cleared on HOLD
//   R17  fixed time around UTC midnight / month end → HOLD before, ACT after midnight
//   P1–P4 orchestrator presentation of HOLD_DONE_TODAY / next-day ACT
//
// All engine calls use a fixed UTC decision time (asOf) — results do not depend on the
// wall clock or on crossing midnight while the test runs.
//
// Run: node scripts/test-repetition-loop.mjs

import esmock from 'esmock';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { activation }              from '../api/engine/activation.js';
import { inference }               from '../api/engine/inference.js';
import { computeProjections }      from '../api/engine/projections.js';
import { buildInformationNeeds }   from '../api/engine/informationNeeds.js';
import { evaluateDecisionGate }    from '../api/engine/decisionGate.js';
import { computeSystemLeverage }   from '../api/engine/systemLeverage.js';
import { computeNextBestAction }   from '../api/engine/nextBestAction.js';
import { computeDailyDecision }    from '../api/engine/dailyDecision.js';
import { computeInterventionExposure, evaluateResponseEvaluations } from '../api/engine/adherence.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const IMAP = JSON.parse(readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8'));

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// ── Time helpers (fixed UTC decision time, same convention as assigned_date) ──
const DAY = 86400000;
const AS_OF = '2026-06-15T12:00:00.000Z';
const NOW = Date.parse(AS_OF);
const dateAgo = d => new Date(NOW - d * DAY).toISOString().slice(0, 10);
const tsAgo   = d => new Date(NOW - d * DAY).toISOString();
const TODAY    = dateAgo(0);
const TOMORROW = new Date(NOW + DAY).toISOString().slice(0, 10);

function assignment(daysAgo, action_id, intervention_id, status = 'COMPLETED') {
  return {
    id: `${action_id}-${daysAgo}-${status}`,
    action_id, intervention_id, status,
    selected_leverage_node: 'TEST',
    assigned_at:  tsAgo(daysAgo),
    completed_at: status === 'COMPLETED' ? tsAgo(daysAgo) : null,
    assigned_date: dateAgo(daysAgo),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const A = (id, label, protocol_type, type, duration, reps, tier, tags, extra = {}) =>
  ({ id, label, protocol_type, type, duration, reps, tier, tags, constraint_exclude: [], intensity: 'LIGHT', ...extra });

const POOL = [
  A('walk_a',    'Jdi na procházku 20 minut',       'TRAINING_PROTOKOL', 'timed', 1200, null, 1, ['kardio'], { constraint_exclude: ['ankle_foot'] }),
  A('walk_b',    'Procházka 10 minut po jídle',     'TRAINING_PROTOKOL', 'timed',  600, null, 1, ['kardio'], { constraint_exclude: ['ankle_foot'] }),
  A('kardio',    'Svižná chůze nebo kolo — 20 minut', 'KARDIO_PROTOKOL', 'timed', 1200, null, 1, [], { intensity: 'MODERATE' }),
  A('press',     'Tlak nad hlavu — lehký (5 kg)',   'SILOVY_PROTOKOL',   'reps',  null,   10, 1, ['sila', 'ramena']),
  A('balance',   'Stůj 30 sekund na jedné noze',    'BALANCE_PROTOKOL',  'timed',   30, null, 1, ['rovnovaha']),
  A('sit_to_stand_supported', 'Vstávání ze židle s oporou rukou — 5×', 'SILOVY_PROTOKOL', 'reps', null, 5, 1, ['sila', 'nohy', 'sit_to_stand']),
];

const PERSON = { person_id: 'test-rl', sex: null, birth_year: 1968, height_cm: null };
const SEDENTARY = { physical: { sedentary_hours_day: 8 }, diagnoses: [] };                                // → PHYSICAL_INACTIVITY
const NEUROPATHY = { physical: { recent_falls: 'Ne.' }, diagnoses: ['PERIPHERAL_NEUROPATHY'] };           // → GAIT_INSTABILITY
const WEAK       = { physical: { recent_falls: 'Ne.', vstat_ze_zeme: 'Ne.' }, diagnoses: [] };           // → LOW_MUSCLE_STRENGTH

// In-memory only: future FUNCTIONAL_STRENGTH_TRAINING mapping (NOT added to data/engine in this change).
const IMAP_FST = {
  ...IMAP,
  mappings: {
    ...IMAP.mappings,
    LOW_MUSCLE_STRENGTH: { interventions: [{
      id: 'FUNCTIONAL_STRENGTH_TRAINING', target_leverage_node: 'LOW_MUSCLE_STRENGTH',
      leverage_affinity: { level: 'PRIMARY' }, protocol_types: ['SILOVY_PROTOKOL'], tag_filter: ['sit_to_stand'],
      goal_branches: ['FUNCTIONAL_INDEPENDENCE', 'SURVIVAL_HEALTHSPAN'],
      mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE', 'PHYSICAL_DECONDITIONING'],
      expected_responses: [{
        response_id: 'FST_chair_stand_30s', target_node: 'LOW_MUSCLE_STRENGTH', observable_obs_type: 'chair_stand_30s',
        expected_direction: 'increase', horizon_min_days: 14, horizon_typical_days: 28, evidence_quality: 'moderate',
        minimum_exposure_rule: { min_sessions_completed: 6, min_calendar_days: 14, rationale: 'test fixture' },
      }],
    }] },
  },
};

// Pure mirror of engine.js runEngine (no DB): same modules, same order, same skippedToday rule.
function runPure(profile, assignments = [], { imap = IMAP, observations = [], constraints = [], asOf = AS_OF } = {}) {
  const ch = {
    diagnoses: profile.diagnoses.map(id => ({ id, raw_label: id, status: 'confirmed' })),
    medications: [], supplements: [], lifestyle: {}, capacity: {},
    onboarding_inputs: profile.physical, evidence_availability: {}, clinical_history_documented: true,
  };
  const obs = [...observations];
  if (profile.physical.sedentary_hours_day != null)
    obs.push({ obs_type: 'sedentary_hours_day', value: profile.physical.sedentary_hours_day, source: 'physical' });

  const act = activation(PERSON, ch, obs);
  const node_states = [...act, ...inference(act, PERSON, ch, obs)].map(s => ({ ...s, missing_evidence: s.missing_evidence || [] }));
  const projections = computeProjections(node_states, PERSON, ch);
  const needs = buildInformationNeeds(node_states, projections);
  const decision_gate = evaluateDecisionGate(node_states, projections, needs, 'test', {
    birth_year: PERSON.birth_year, sex: PERSON.sex, resolved_physical: Object.keys(profile.physical),
  });
  const lev = computeSystemLeverage(node_states, projections, decision_gate, 'test');
  const leverageNodeId = lev.selected?.node_id ?? null;
  const map = leverageNodeId ? imap.mappings?.[leverageNodeId] : null;

  const today = new Date(asOf).toISOString().slice(0, 10);
  const intervention_exposure = computeInterventionExposure(assignments, asOf);
  const skippedTodayActionIds = new Set(assignments.filter(a => a.status === 'SKIPPED' && a.assigned_date === today).map(a => a.action_id));
  const response_evaluations = evaluateResponseEvaluations(intervention_exposure, imap, obs, assignments, asOf);

  let next_best_action = { status: 'NOT_COMPUTED' };
  if (map) {
    const pts = new Set(map.interventions.flatMap(i => i.protocol_types));
    next_best_action = computeNextBestAction({
      leverageNodeId, interventions: map.interventions, actionPool: POOL.filter(a => pts.has(a.protocol_type)),
      personConstraints: constraints, clinicalHistory: ch, decisionGate: decision_gate, node_states,
      engineVersion: 'test', responseHistory: response_evaluations, skippedTodayActionIds,
    });
  }
  const dd = computeDailyDecision({ decision_gate, next_best_action, response_evaluations, intervention_exposure }, asOf);
  return { dd, nba: next_best_action, exposure: intervention_exposure, evals: response_evaluations, leverageNodeId };
}

// ── R1 ───────────────────────────────────────────────────────────────────────
sep('R1 — day 1 before any session → ACT');
const r1 = runPure(SEDENTARY, []);
const WALK_IID = r1.dd.primary_item?.intervention_id;
check(r1.dd.mode === 'ACT' && r1.dd.reason_code === 'ACT_READY', 'R1: mode=ACT, reason_code=ACT_READY', `actual: ${r1.dd.mode}/${r1.dd.reason_code}`);
check(WALK_IID === 'BREAK_UP_SEDENTARY_TIME', 'R1: walking intervention selected (BREAK_UP_SEDENTARY_TIME)', `actual: ${WALK_IID}`);
const WALK_AID = r1.dd.primary_item?.action_id;

// ── R2 ───────────────────────────────────────────────────────────────────────
sep('R2 — day 1 after Hotovo → HOLD_DONE_TODAY');
const r2 = runPure(SEDENTARY, [assignment(0, WALK_AID, WALK_IID)]);
check(r2.dd.mode === 'HOLD' && r2.dd.reason_code === 'HOLD_DONE_TODAY', 'R2: mode=HOLD, reason_code=HOLD_DONE_TODAY', `actual: ${r2.dd.mode}/${r2.dd.reason_code}`);
check(r2.dd.reevaluate_after === TOMORROW, `R2: reevaluate_after = tomorrow (${TOMORROW})`, `actual: ${r2.dd.reevaluate_after}`);
check(r2.dd.primary_item?.exposure_summary?.sessions_completed === 1, 'R2: exposure_summary.sessions_completed = 1');
check(r2.dd.primary_item?.exposure_summary?.last_completed_date === TODAY, 'R2: exposure_summary.last_completed_date = today');
check(r2.exposure[0]?.last_completed_date === TODAY, 'R2: adherence exposes last_completed_date');

// ── R3 ───────────────────────────────────────────────────────────────────────
sep('R3 — day 2, completed yesterday → ACT again (NBA + Safety Gate re-run)');
const r3 = runPure(SEDENTARY, [assignment(1, WALK_AID, WALK_IID)]);
check(r3.dd.mode === 'ACT' && r3.dd.reason_code === 'ACT_READY', 'R3: mode=ACT (previously HOLD_TOO_EARLY)', `actual: ${r3.dd.mode}/${r3.dd.reason_code}`);
check(r3.dd.primary_item?.intervention_id === WALK_IID, 'R3: same intervention offered again');
check(r3.nba.status === 'SELECTED' && ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(r3.dd.primary_item?.safety?.level),
  'R3: action comes from fresh NBA with a viable Safety Gate result');
check(r3.evals.some(e => e.result === 'TOO_EARLY'), 'R3: response evaluation still TOO_EARLY (informational, no longer blocks)');

// ── R4 ───────────────────────────────────────────────────────────────────────
sep('R4 — 8-day walking loop: one session per day until exposure + horizon');
{
  const history = [];
  let everyMorningAct = true, everyEveningHold = true;
  const rule = IMAP.mappings.PHYSICAL_INACTIVITY.interventions.find(i => i.id === WALK_IID).expected_responses[0];
  // Simulated day k (k = 0 … 7): history holds completions from previous days, dated k-i days ago.
  for (let k = 0; k < 8; k++) {
    const past = history.map(i => assignment(k - i, WALK_AID, WALK_IID));
    const morning = runPure(SEDENTARY, past);
    if (morning.dd.mode !== 'ACT') everyMorningAct = false;
    history.push(k);
    const evening = runPure(SEDENTARY, history.map(i => assignment(k - i, WALK_AID, WALK_IID)));
    if (evening.dd.reason_code !== 'HOLD_DONE_TODAY') everyEveningHold = false;
  }
  // Final state as seen on day 8 (sessions on days 0…7 → 7…0 days ago)
  const finalAsg = history.map(i => assignment(7 - i, WALK_AID, WALK_IID));
  const exp = computeInterventionExposure(finalAsg, AS_OF).find(e => e.intervention_id === WALK_IID);
  const perDay = new Set(finalAsg.map(a => a.assigned_date));
  check(everyMorningAct, 'R4: every morning of days 1–8 → ACT (Hotovo/Přeskočit available)');
  check(everyEveningHold, 'R4: every evening after Hotovo → HOLD_DONE_TODAY');
  check(perDay.size === finalAsg.length, 'R4: exactly one completed session per calendar day');
  check(exp.sessions_completed >= rule.minimum_exposure_rule.min_sessions_completed
     && exp.calendar_days_in_period >= rule.minimum_exposure_rule.min_calendar_days,
    `R4: minimum_exposure_rule reached (${exp.sessions_completed} sessions / ${exp.calendar_days_in_period} days)`);
  const day9 = runPure(SEDENTARY, history.map(i => assignment(8 - i, WALK_AID, WALK_IID)));
  const r = day9.evals.find(e => e.intervention_id === WALK_IID)?.result;
  check(!['TOO_EARLY', 'INSUFFICIENT_EXPOSURE'].includes(r), `R4: day 9 reaches response evaluation (result=${r})`);
}

// ── R5 ───────────────────────────────────────────────────────────────────────
sep('R5 — after horizon + exposure: ACT continues; same day after Hotovo → HOLD_DONE_TODAY');
{
  const past = [8, 7, 6, 5, 4, 3, 2, 1].map(d => assignment(d, WALK_AID, WALK_IID));
  const noObs = runPure(SEDENTARY, past);
  check(noObs.evals.some(e => e.result === 'INSUFFICIENT_OBSERVATION') && noObs.dd.mode === 'ACT',
    'R5a: no observations → INSUFFICIENT_OBSERVATION, DAILY_DECISION = ACT', `actual: ${noObs.evals.map(e => e.result)} / ${noObs.dd.mode}`);
  const obs = [1, 2, 3].map(d => ({ obs_type: 'activity_level', value: 'medium', measured_at: dateAgo(d), source: 'daily_checkin' }));
  const withObs = runPure(SEDENTARY, past, { observations: obs });
  check(withObs.evals.some(e => e.result === 'CONSISTENT_WITH_EXPECTED_RESPONSE') && withObs.dd.mode === 'ACT',
    'R5b: dated observations → CONSISTENT_WITH_EXPECTED_RESPONSE, DAILY_DECISION = ACT', `actual: ${withObs.evals.map(e => e.result)} / ${withObs.dd.mode}`);
  const doneToday = runPure(SEDENTARY, [...past, assignment(0, WALK_AID, WALK_IID)], { observations: obs });
  check(doneToday.dd.reason_code === 'HOLD_DONE_TODAY', 'R5c: evaluated intervention completed today → HOLD_DONE_TODAY (no second session)', `actual: ${doneToday.dd.reason_code}`);
}

// ── R6 ───────────────────────────────────────────────────────────────────────
sep('R6 — intervention without expected_responses (BALANCE_TRAINING) → HOLD_DONE_TODAY');
{
  const before = runPure(NEUROPATHY, []);
  const iid = before.dd.primary_item?.intervention_id;
  check(before.dd.mode === 'ACT' && iid === 'BALANCE_TRAINING', 'R6: before → ACT BALANCE_TRAINING', `actual: ${before.dd.mode} ${iid}`);
  const after = runPure(NEUROPATHY, [assignment(0, before.dd.primary_item.action_id, iid)]);
  check(after.evals.length === 0, 'R6: no response evaluations exist for this intervention');
  check(after.dd.reason_code === 'HOLD_DONE_TODAY', 'R6: after Hotovo → HOLD_DONE_TODAY (previously ACT again the same day)', `actual: ${after.dd.mode}/${after.dd.reason_code}`);
  const nextDay = runPure(NEUROPATHY, [assignment(1, before.dd.primary_item.action_id, iid)]);
  check(nextDay.dd.mode === 'ACT', 'R6: next day → ACT');
}

// ── R7 ───────────────────────────────────────────────────────────────────────
sep('R7 — Přeskočit today → no HOLD, skipped action not re-offered, no session counted');
{
  const r = runPure(SEDENTARY, [assignment(0, WALK_AID, WALK_IID, 'SKIPPED')]);
  check(r.dd.mode === 'ACT', 'R7: mode = ACT (SKIPPED does not trigger HOLD)', `actual: ${r.dd.mode}/${r.dd.reason_code}`);
  check(r.dd.primary_item?.action_id !== WALK_AID, 'R7: skipped action_id not offered again today', `actual: ${r.dd.primary_item?.action_id}`);
  check(r.exposure.find(e => e.intervention_id === WALK_IID)?.sessions_completed === 0, 'R7: sessions_completed = 0');
  check(r.exposure.find(e => e.intervention_id === WALK_IID)?.last_completed_date === null, 'R7: last_completed_date = null');
  const tomorrow = runPure(SEDENTARY, [assignment(1, WALK_AID, WALK_IID, 'SKIPPED')]);
  check(tomorrow.dd.primary_item?.action_id === WALK_AID, 'R7: next day the skipped action is eligible again');
}

// ── R8 ───────────────────────────────────────────────────────────────────────
sep('R8 — priority order: SAFETY_CRITICAL > SAFETY_BLOCKED > ASK_BLOCKING > HOLD');
{
  const exposureToday = computeInterventionExposure([assignment(0, WALK_AID, WALK_IID)], AS_OF);
  const selected = { status: 'SELECTED', selected: { action_id: WALK_AID, intervention_id: WALK_IID, label: 'x', safety: { level: 'SAFE' } },
                     all_candidates: [{ action_id: WALK_AID, safety: { level: 'SAFE' } }] };
  const gateCritical = { context_gates: [{ decision_context: { id: 'CURRENT_CV_STATE' }, status: 'EVIDENCE_SUFFICIENT',
                         actionable_findings: [{ entity_id: 'HYPERTENSION', actionability: 'SAFETY_CRITICAL' }] }] };
  const c = computeDailyDecision({ decision_gate: gateCritical, next_best_action: selected, response_evaluations: [], intervention_exposure: exposureToday }, AS_OF);
  check(c.reason_code === 'SAFETY_CRITICAL', 'R8a: SAFETY_CRITICAL beats HOLD_DONE_TODAY', `actual: ${c.reason_code}`);
  const blocked = { status: 'SELECTED', selected: null, all_candidates: [{ action_id: WALK_AID, safety: { level: 'CONTRAINDICATED', reason: 'x' } }] };
  const b = computeDailyDecision({ decision_gate: { context_gates: [] }, next_best_action: blocked, response_evaluations: [], intervention_exposure: exposureToday }, AS_OF);
  check(b.reason_code === 'SAFETY_BLOCKED', 'R8b: SAFETY_BLOCKED beats HOLD_DONE_TODAY', `actual: ${b.reason_code}`);
  const needEv = { status: 'NEED_MORE_EVIDENCE', next_best_question: 'Jak závažné je tvé omezení pohybu?', selected: null,
                   all_candidates: [{ action_id: WALK_AID, safety: { level: 'NEEDS_MORE_EVIDENCE' } }] };
  const a = computeDailyDecision({ decision_gate: { context_gates: [] }, next_best_action: needEv, response_evaluations: [], intervention_exposure: exposureToday }, AS_OF);
  check(a.reason_code === 'ASK_BLOCKING', 'R8c: ASK_BLOCKING beats HOLD_DONE_TODAY', `actual: ${a.reason_code}`);
  const h = computeDailyDecision({ decision_gate: { context_gates: [] }, next_best_action: selected, response_evaluations: [], intervention_exposure: exposureToday }, AS_OF);
  check(h.reason_code === 'HOLD_DONE_TODAY', 'R8d: without higher priority → HOLD_DONE_TODAY');
}

// ── R9 ───────────────────────────────────────────────────────────────────────
sep('R9 — completed another intervention today, NBA selects a different one → ACT');
{
  const r = runPure(SEDENTARY, [assignment(0, 'kardio', 'AEROBIC_TRAINING')]);
  check(r.dd.mode === 'ACT' && r.dd.primary_item?.intervention_id === WALK_IID,
    'R9: AEROBIC_TRAINING completed today does not hold the selected BREAK_UP_SEDENTARY_TIME',
    `actual: ${r.dd.mode} ${r.dd.primary_item?.intervention_id}`);
}

// ── R10 ──────────────────────────────────────────────────────────────────────
sep('R10 — future FUNCTIONAL_STRENGTH_TRAINING (in-memory mapping only)');
{
  const opts = { imap: IMAP_FST };
  const d1 = runPure(WEAK, [], opts);
  check(d1.dd.mode === 'ACT' && d1.dd.primary_item?.action_id === 'sit_to_stand_supported'
     && d1.dd.primary_item?.intervention_id === 'FUNCTIONAL_STRENGTH_TRAINING',
    'R10: day 1 → ACT sit_to_stand_supported / FUNCTIONAL_STRENGTH_TRAINING', `actual: ${d1.dd.mode} ${d1.dd.primary_item?.action_id}`);
  const aid = 'sit_to_stand_supported', iid = 'FUNCTIONAL_STRENGTH_TRAINING';
  const d1done = runPure(WEAK, [assignment(0, aid, iid)], opts);
  check(d1done.dd.reason_code === 'HOLD_DONE_TODAY', 'R10: day 1 after Hotovo → HOLD_DONE_TODAY');
  check(d1done.evals[0]?.observable_obs_type === 'chair_stand_30s', 'R10: response is chair_stand_30s (not activity_level)', `actual: ${d1done.evals[0]?.observable_obs_type}`);
  const d2 = runPure(WEAK, [assignment(1, aid, iid)], opts);
  check(d2.dd.mode === 'ACT', 'R10: day 2 → ACT (repetition possible)');
  const later = runPure(WEAK, [16, 14, 12, 10, 8, 6, 4, 2].map(d => assignment(d, aid, iid)), opts);
  check(later.evals[0]?.result === 'INSUFFICIENT_OBSERVATION' && later.dd.mode === 'ACT',
    'R10: after 8 sessions / 15 days → INSUFFICIENT_OBSERVATION (measurement mechanism not yet built), ACT continues',
    `actual: ${later.evals[0]?.result} / ${later.dd.mode}`);
}

// ── R11 ──────────────────────────────────────────────────────────────────────
sep('R11 — today COMPLETED + future-dated COMPLETED → HOLD today');
{
  const future = assignment(-3, WALK_AID, WALK_IID);   // assigned_date 3 days after the decision date
  const r = runPure(SEDENTARY, [assignment(0, WALK_AID, WALK_IID), future]);
  check(r.dd.reason_code === 'HOLD_DONE_TODAY', 'R11: future row does not mask today → HOLD_DONE_TODAY', `actual: ${r.dd.mode}/${r.dd.reason_code}`);
  const e = r.exposure.find(x => x.intervention_id === WALK_IID);
  check(e?.sessions_completed === 1 && JSON.stringify(e?.completed_days) === JSON.stringify([TODAY]),
    'R11: future row not counted (sessions_completed = 1, completed_days = [today])', `actual: ${e?.sessions_completed} ${JSON.stringify(e?.completed_days)}`);
  check(e?.period_end === TODAY && e?.last_completed_date === TODAY, 'R11: period_end / last_completed_date = today');
}

// ── R12 ──────────────────────────────────────────────────────────────────────
sep('R12 — today COMPLETED + corrupted date → HOLD today');
{
  const corrupted = { ...assignment(0, WALK_AID, WALK_IID), id: 'corrupt', assigned_date: 'zzzz-garbage', completed_at: 'not-a-date' };
  const badCalendar = { ...assignment(0, WALK_AID, WALK_IID), id: 'feb30', assigned_date: '2026-02-30', completed_at: null };
  const r = runPure(SEDENTARY, [corrupted, assignment(0, WALK_AID, WALK_IID), badCalendar]);
  check(r.dd.reason_code === 'HOLD_DONE_TODAY', 'R12: corrupted rows do not mask today → HOLD_DONE_TODAY', `actual: ${r.dd.mode}/${r.dd.reason_code}`);
  const e = r.exposure.find(x => x.intervention_id === WALK_IID);
  check(e?.sessions_assigned === 1 && e?.sessions_completed === 1, 'R12: corrupted rows ignored (sessions_assigned = 1, sessions_completed = 1)',
    `actual: ${e?.sessions_assigned}/${e?.sessions_completed}`);
  check(e?.period_start === TODAY && e?.calendar_days_in_period === 1, 'R12: period not stretched by corrupted rows');
}

// ── R13 ──────────────────────────────────────────────────────────────────────
sep('R13 — only future / invalid dates → ACT today, zero valid exposure');
{
  const rows = [
    assignment(-1, WALK_AID, WALK_IID),
    { ...assignment(0, WALK_AID, WALK_IID), id: 'bad', assigned_date: 'garbage', completed_at: 'garbage' },
  ];
  const r = runPure(SEDENTARY, rows);
  check(r.dd.mode === 'ACT' && r.dd.primary_item?.intervention_id === WALK_IID, 'R13: mode = ACT for the walking intervention', `actual: ${r.dd.mode}/${r.dd.reason_code}`);
  check(r.exposure.length === 0, 'R13: no valid exposure (future and invalid rows ignored)', `actual: ${JSON.stringify(r.exposure)}`);
  check(r.evals.length === 0, 'R13: no response evaluation anchored on a future / invalid row');
}

// ── R14 ──────────────────────────────────────────────────────────────────────
sep('R14 — two COMPLETED rows of one intervention on one day → sessions_completed = 1');
{
  const rows = [
    { ...assignment(1, WALK_AID, WALK_IID), id: 'y-1' },
    { ...assignment(1, 'walk_b', WALK_IID), id: 'y-2', completed_at: new Date(NOW - DAY + 3600000).toISOString() },
  ];
  const e = computeInterventionExposure(rows, AS_OF).find(x => x.intervention_id === WALK_IID);
  check(e?.sessions_completed === 1, 'R14: sessions_completed = 1 (unique completed days)', `actual: ${e?.sessions_completed}`);
  check(e?.sessions_assigned === 2, 'R14: sessions_assigned still counts both rows', `actual: ${e?.sessions_assigned}`);
  check(JSON.stringify(e?.completed_days) === JSON.stringify([dateAgo(1)]), 'R14: completed_days = [yesterday]');
  check(e?.first_completed_at === tsAgo(1), 'R14: first_completed_at = earliest completion of that day');
}

// ── R15 ──────────────────────────────────────────────────────────────────────
sep('R15 — SKIPPED + COMPLETED → only COMPLETED days count');
{
  const rows = [assignment(2, WALK_AID, WALK_IID), assignment(1, WALK_AID, WALK_IID, 'SKIPPED'), assignment(0, 'walk_b', WALK_IID, 'SKIPPED')];
  const r = runPure(SEDENTARY, rows);
  const e = r.exposure.find(x => x.intervention_id === WALK_IID);
  check(e?.sessions_completed === 1 && e?.sessions_skipped === 2, 'R15: sessions_completed = 1, sessions_skipped = 2',
    `actual: ${e?.sessions_completed}/${e?.sessions_skipped}`);
  check(JSON.stringify(e?.completed_days) === JSON.stringify([dateAgo(2)]), 'R15: completed_days contains only the COMPLETED day');
  check(r.dd.mode === 'ACT', 'R15: SKIPPED today does not trigger HOLD', `actual: ${r.dd.mode}/${r.dd.reason_code}`);
  const sameDay = runPure(SEDENTARY, [assignment(0, 'walk_b', WALK_IID, 'SKIPPED'), assignment(0, WALK_AID, WALK_IID)]);
  const e2 = sameDay.exposure.find(x => x.intervention_id === WALK_IID);
  check(e2?.sessions_completed === 1 && sameDay.dd.reason_code === 'HOLD_DONE_TODAY',
    'R15: SKIPPED + COMPLETED on the same day → 1 session, HOLD_DONE_TODAY', `actual: ${e2?.sessions_completed} ${sameDay.dd.reason_code}`);
}

// ── R16 ──────────────────────────────────────────────────────────────────────
sep('R16 — stale current_action_assignment is cleared on HOLD');
{
  const { _buildSessionUpdates_test } = await esmock('../api/engine/orchestrator.js', {
    '@anthropic-ai/sdk': { default: class { constructor() {} } },
    '../api/engine/healthEventAdapter.js': { applyHealthEvent: async () => ({}) },
  });
  const holdDd = runPure(SEDENTARY, [assignment(0, WALK_AID, WALK_IID)]).dd;
  const result = { domain_response: { daily_decision: holdDd } };
  const u = _buildSessionUpdates_test('DOMAIN_REQUEST', {}, result);
  check(Object.prototype.hasOwnProperty.call(u, 'current_action_assignment') && u.current_action_assignment === null,
    'R16: buildSessionUpdates(HOLD) sets current_action_assignment = null explicitly', `actual: ${JSON.stringify(u.current_action_assignment)}`);
  const actDd = runPure(SEDENTARY, [assignment(1, WALK_AID, WALK_IID)]).dd;
  const uAct = _buildSessionUpdates_test('DOMAIN_REQUEST', {}, { domain_response: { daily_decision: actDd } });
  check(uAct.current_action_assignment?.action_id === actDd.primary_item.action_id, 'R16: ACT still sets a fresh assignment');
}

// ── R17 ──────────────────────────────────────────────────────────────────────
sep('R17 — fixed decision time around UTC midnight / month end');
{
  const completion = {
    id: 'midnight', action_id: WALK_AID, intervention_id: WALK_IID, status: 'COMPLETED', selected_leverage_node: 'TEST',
    assigned_at: '2026-03-31T23:50:00.000Z', completed_at: '2026-03-31T23:59:30.000Z', assigned_date: '2026-03-31',
  };
  const before = runPure(SEDENTARY, [completion], { asOf: '2026-03-31T23:59:59.000Z' });
  check(before.dd.reason_code === 'HOLD_DONE_TODAY', 'R17: 23:59:59Z same UTC day → HOLD_DONE_TODAY', `actual: ${before.dd.reason_code}`);
  check(before.dd.reevaluate_after === '2026-04-01', 'R17: reevaluate_after = 2026-04-01 (month rollover)', `actual: ${before.dd.reevaluate_after}`);
  check(before.dd.evaluated_at === '2026-03-31T23:59:59.000Z', 'R17: evaluated_at = injected asOf', `actual: ${before.dd.evaluated_at}`);
  const after = runPure(SEDENTARY, [completion], { asOf: '2026-04-01T00:00:01.000Z' });
  check(after.dd.mode === 'ACT' && after.dd.primary_item?.intervention_id === WALK_IID, 'R17: 00:00:01Z next UTC day → ACT', `actual: ${after.dd.mode}/${after.dd.reason_code}`);
  const early = runPure(SEDENTARY, [completion], { asOf: '2026-03-31T12:00:00.000Z' });
  check(early.exposure.length === 1 && early.dd.reason_code === 'HOLD_DONE_TODAY',
    'R17: same-day asOf before completed_at still counts the day (day granularity)');
  const r1a = computeDailyDecision({ decision_gate: { context_gates: [] }, next_best_action: { status: 'NOT_COMPUTED' }, response_evaluations: [], intervention_exposure: [] });
  check(typeof r1a.evaluated_at === 'string' && Math.abs(Date.parse(r1a.evaluated_at) - Date.now()) < 60000,
    'R17: without asOf → production default = current time');
}

// ── P1–P4: orchestrator presentation (applyHealthEvent + classifier mocked) ───
sep('P1–P4 — orchestrator presentation of HOLD_DONE_TODAY and next-day ACT');
{
  let nextDd = null;
  let nextClassification = { event_type: 'DOMAIN_REQUEST', payload: {} };
  class MockAnthropic {
    constructor() {}
    get messages() {
      return { create: async () => ({ content: [{ type: 'tool_use', input: nextClassification }] }) };
    }
  }
  const { processInput } = await esmock('../api/engine/orchestrator.js', {
    '@anthropic-ai/sdk': { default: MockAnthropic },
    '../api/engine/healthEventAdapter.js': {
      applyHealthEvent: async () => ({
        persistence_status: 'ok', engine_called: true, warnings: [], error: null,
        domain_response: { domain: 'health', daily_decision: nextDd,
          explanation_context: { system_constraint: null, system_leverage: { node_id: 'PHYSICAL_INACTIVITY' }, action_context: null, evidence_context: [] } },
      }),
    },
  });

  const holdDd = runPure(SEDENTARY, [assignment(0, WALK_AID, WALK_IID)]).dd;
  const actDd  = runPure(SEDENTARY, [assignment(1, WALK_AID, WALK_IID)]).dd;
  const assignmentInSession = { action_id: WALK_AID, label: 'Jdi na procházku 20 minut', intervention_id: WALK_IID };

  nextDd = holdDd;
  const p2 = await processInput('test-rl-user', 'Hotovo', { current_action_assignment: assignmentInSession, question_budget_remaining: 3 });
  check(p2.mode === 'HOLD' && p2.text === 'Hotovo. Pro dnešek stačí. Výsledek budeme hodnotit až po několika opakováních.',
    'P2: Hotovo → existing completion acknowledgment', `actual: ${p2.mode} "${p2.text}"`);
  check(p2.session_updates?.current_action_assignment == null, 'P2: current_action_assignment cleared after Hotovo');

  nextClassification = { event_type: 'DOMAIN_REQUEST', payload: {} };
  const p1 = await processInput('test-rl-user', 'Co dál?', { last_daily_decision: holdDd, current_action_assignment: assignmentInSession, question_budget_remaining: 3 });
  check(p1.mode === 'HOLD' && p1.text === 'Pro dnešek stačí. Zítra pokračujeme.', 'P1: same day revisit → "Pro dnešek stačí. Zítra pokračujeme."', `actual: ${p1.mode} "${p1.text}"`);
  check((p1.buttons ?? []).length === 0, 'P1: no buttons (no second session today)');
  check(p1.session_updates?.current_action_assignment === null, 'P1: stale current_action_assignment from session explicitly cleared (null)',
    `actual: ${JSON.stringify(p1.session_updates?.current_action_assignment)}`);

  nextClassification = { event_type: 'NEW_SYMPTOM', payload: { body_part: 'zápěstí', severity: null } };
  const p4 = await processInput('test-rl-user', 'Bolí mě zápěstí', { question_budget_remaining: 3 });
  check(p4.mode === 'HOLD' && p4.text?.startsWith('Beru novou informaci') && p4.text.endsWith('Pro dnešek stačí. Zítra pokračujeme.'),
    'P4: health input on a done-today HOLD → acknowledged + HOLD_DONE_TODAY text', `actual: "${p4.text}"`);

  nextDd = actDd;
  nextClassification = { event_type: 'DOMAIN_REQUEST', payload: {} };
  const p3 = await processInput('test-rl-user', 'Co mám dělat?', { last_daily_decision: holdDd, question_budget_remaining: 3 });
  check(p3.mode === 'ACT', 'P3: next day → ACT', `actual: ${p3.mode}`);
  check(JSON.stringify(p3.buttons) === JSON.stringify(['Hotovo', 'Přeskočit']), 'P3: buttons Hotovo / Přeskočit', `actual: ${JSON.stringify(p3.buttons)}`);
  check(p3.session_updates?.current_action_assignment?.action_id === actDd.primary_item.action_id
     && p3.session_updates?.current_action_assignment?.intervention_id === WALK_IID,
    'P3: new current_action_assignment from the fresh DAILY_DECISION');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-repetition-loop: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
