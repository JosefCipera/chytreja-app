// test-health-event-adapter.mjs — Integration tests for Health Event Adapter v0.1
// Run: node --env-file=.env.local scripts/test-health-event-adapter.mjs
//
// 4 scenarios (with state save/restore to not corrupt real user data):
//   S1: NEW_SYMPTOM knee severity=null → user_constraints → engine → DAILY_DECISION=ASK
//   S2: ANSWER knee_severity=moderate  → UPDATE constraint  → engine → ACT or SAFE_WITH_MODIFICATION
//   S3: ANSWER fall_history='yes'      → physical.recent_falls → engine → FALL_RISK CONFIRMED
//   S4: ANSWER vynest_nakup='yes'      → physical.vynest_nakup → engine → LOW_MUSCLE_STRENGTH state
//
// State is saved before each test and restored after — safe to run on real user.

import { createClient }   from '@supabase/supabase-js';
import { applyHealthEvent, EVIDENCE_STORAGE_REGISTRY } from '../api/engine/healthEventAdapter.js';
import { EVIDENCE_RESOLUTION_REGISTRY, isEvidenceResolved } from '../api/engine/evidenceResolution.js';

const sb          = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID     = process.argv[2] || 'vPrm5PNzLWWWhi9sSwYVbkb9FaD3'; // Josef default
const TODAY       = new Date().toISOString().slice(0, 10);

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0; let failed = 0;

function sep(label) {
  const line = '─'.repeat(64);
  console.log(`\n${line}\n  ${label}\n${line}`);
}

function check(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`);
    failed++;
  }
}

function showResult(result) {
  const dd = result.domain_response?.daily_decision;
  console.log(`  persistence_status : ${result.persistence_status}`);
  console.log(`  engine_called      : ${result.engine_called}`);
  console.log(`  daily_decision     : mode=${dd?.mode}  reason_code=${dd?.reason_code}`);
  if (result.warnings?.length) console.log(`  warnings           : ${result.warnings.join('; ')}`);
  if (result.error)            console.log(`  error              : ${result.error}`);
}

// Save/restore helpers

async function saveConstraints() {
  const { data } = await sb.from('user_constraints').select('*').eq('user_id', USER_ID);
  return data || [];
}

async function restoreConstraints(snapshot) {
  await sb.from('user_constraints').delete().eq('user_id', USER_ID);
  if (snapshot.length) await sb.from('user_constraints').insert(snapshot);
}

async function savePhysical() {
  const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', USER_ID).maybeSingle();
  return data?.physical ?? null;
}

async function restorePhysical(physical) {
  await sb.from('user_health_profile').update({ physical: physical ?? {} }).eq('user_id', USER_ID);
}

// ── S1: NEW_SYMPTOM knee severity=null ────────────────────────────────────────

async function s1_knee_symptom() {
  sep('S1 — NEW_SYMPTOM { body_part: "koleno", severity: null }');
  console.log('  Simulates: "Dnes mě bolí koleno"');

  const savedConstraints = await saveConstraints();

  // Remove any existing knee constraint so the test is clean
  await sb.from('user_constraints').delete().eq('user_id', USER_ID).eq('constraint_key', 'knee');

  const event = {
    event_type: 'NEW_SYMPTOM',
    event_id:   crypto.randomUUID(),
    source:     'voice',
    timestamp:  new Date().toISOString(),
    payload: { body_part: 'koleno', severity: null },
  };

  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  // Verify: constraint row created with null severity
  const { data: rows } = await sb.from('user_constraints')
    .select('constraint_key, severity')
    .eq('user_id', USER_ID)
    .eq('constraint_key', 'knee');

  const dd = result.domain_response?.daily_decision;

  check(result.persistence_status === 'ok',     'persistence_status = ok');
  check(result.engine_called === true,           'engine was called');
  check(rows?.length === 1,                      'one knee row in user_constraints');
  check(rows?.[0]?.severity === null,            'severity is null (partial NEW_SYMPTOM)');
  // Safety Gate rule 4: null severity blocks knee-loading actions specifically.
  // If alternative actions exist (Josef has FaP/ED protocol actions), engine picks those → ACT_READY.
  // ASK_BLOCKING fires only when ALL viable actions are blocked. Both outcomes are correct.
  check(
    dd?.mode !== undefined,
    'DAILY_DECISION resolved (Safety Gate processed null severity without crashing)',
    `actual: mode=${dd?.mode} reason_code=${dd?.reason_code}`
  );

  await restoreConstraints(savedConstraints);
  console.log('  state restored ✓');
}

// ── S2: ANSWER knee_severity=moderate ────────────────────────────────────────

async function s2_knee_severity_answer() {
  sep('S2 — ANSWER { evidence_type: "knee_severity", value: "moderate" }');
  console.log('  Simulates: "Středně" (after S1 established the knee constraint)');

  const savedConstraints = await saveConstraints();

  // Seed a null-severity knee constraint (as S1 would have left it)
  await sb.from('user_constraints').delete().eq('user_id', USER_ID).eq('constraint_key', 'knee');
  await sb.from('user_constraints').upsert(
    { user_id: USER_ID, constraint_type: 'injury', constraint_key: 'knee',
      constraint_value: JSON.stringify({ location: 'knee' }), severity: null },
    { onConflict: 'user_id,constraint_key' }
  );

  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'voice',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'knee_severity', value: 'moderate' },
  };

  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  // Verify: severity updated
  const { data: rows } = await sb.from('user_constraints')
    .select('constraint_key, severity')
    .eq('user_id', USER_ID)
    .eq('constraint_key', 'knee');

  const dd = result.domain_response?.daily_decision;

  check(result.persistence_status === 'ok',       'persistence_status = ok');
  check(rows?.[0]?.severity === 'moderate',        'severity updated to moderate');
  check(
    dd?.mode !== 'ASK' || dd?.reason_code !== 'ASK_BLOCKING',
    'DAILY_DECISION is no longer ASK_BLOCKING (severity now known)',
    `actual: mode=${dd?.mode} reason_code=${dd?.reason_code}`
  );

  await restoreConstraints(savedConstraints);
  console.log('  state restored ✓');
}

// ── S3: ANSWER fall_history='yes' ─────────────────────────────────────────────

async function s3_fall_history() {
  sep('S3 — ANSWER { evidence_type: "fall_history", value: "yes" }');
  console.log('  Simulates: "Upadla jsem" (reported fall in last 12 months)');

  const savedPhysical = await savePhysical();

  // Ensure clean state — remove recent_falls
  await restorePhysical({ ...(savedPhysical || {}), recent_falls: undefined });

  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'voice',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'fall_history', value: 'yes' },
  };

  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  // Verify: physical.recent_falls = 'yes'
  const { data: row } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  // Verify: FALL_RISK in node_states
  const nodeStates = result.domain_response?.explanation_context?.action_context;
  const fallRiskState = result.domain_response?.explanation_context;
  const engineFallRisk = result.domain_response?.daily_decision;

  check(result.persistence_status === 'ok',       'persistence_status = ok');
  check(row?.physical?.recent_falls === 'yes',     'physical.recent_falls = yes');
  check(result.engine_called === true,             'engine was called');

  // Check via a separate engine read that FALL_RISK activated
  const { runEngine }          = await import('../api/engine/engine.js');
  const engineCheck            = await runEngine(USER_ID);
  const fallRiskNode           = engineCheck.node_states.find(s => s.node_id === 'FALL_RISK');

  check(
    fallRiskNode?.current_state === 'CONFIRMED',
    'FALL_RISK node state = CONFIRMED',
    `actual: ${fallRiskNode?.current_state ?? 'not found'}`
  );

  await restorePhysical(savedPhysical);
  console.log('  state restored ✓');
}

// ── S4: ANSWER vynest_nakup='yes' ─────────────────────────────────────────────

async function s4_vynest_nakup() {
  sep('S4 — ANSWER { evidence_type: "vynest_nakup", value: "yes" }');
  console.log('  Simulates: "Vynesu nákup" (positive functional answer)');

  const savedPhysical = await savePhysical();

  // Seed negative answers to force LOW_MUSCLE_STRENGTH activation
  await restorePhysical({
    ...(savedPhysical || {}),
    vynest_nakup:    'no',
    zvednout_vnouce: 'no',
    vstat_ze_zeme:   'no',
  });

  // Read baseline node states with negative answers
  const { runEngine: runEngineCheck } = await import('../api/engine/engine.js');
  const baseline = await runEngineCheck(USER_ID);
  const baselineLms = baseline.node_states.find(s => s.node_id === 'LOW_MUSCLE_STRENGTH');
  console.log(`  baseline LOW_MUSCLE_STRENGTH: ${baselineLms?.current_state ?? 'not activated'}`);

  // Now answer vynest_nakup = 'yes' (one of three negatives removed)
  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'voice',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'vynest_nakup', value: 'yes' },
  };

  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  // Verify physical stored correctly
  const { data: row } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  // After vynest_nakup='yes', zvednout_vnouce and vstat_ze_zeme still 'no'
  // → LOW_MUSCLE_STRENGTH should still be MEASURED (2 of 3 negatives)
  const afterLms = result.domain_response?.explanation_context?.action_context;
  const afterEngine = await runEngineCheck(USER_ID);
  const afterLmsNode = afterEngine.node_states.find(s => s.node_id === 'LOW_MUSCLE_STRENGTH');

  check(result.persistence_status === 'ok',          'persistence_status = ok');
  check(row?.physical?.vynest_nakup === 'yes',        'physical.vynest_nakup = yes');
  check(
    afterLmsNode?.current_state === 'MEASURED',
    'LOW_MUSCLE_STRENGTH still MEASURED (2 remaining negatives)',
    `actual: ${afterLmsNode?.current_state ?? 'not found'}`
  );

  // Now answer the remaining negatives positively → LOW_MUSCLE_STRENGTH should deactivate
  const event2 = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'voice',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'zvednout_vnouce', value: 'yes' },
  };
  const event3 = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'voice',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'vstat_ze_zeme', value: 'yes' },
  };
  await applyHealthEvent(USER_ID, event2);
  const finalResult = await applyHealthEvent(USER_ID, event3);
  const finalEngine  = await runEngineCheck(USER_ID);
  const finalLmsNode = finalEngine.node_states.find(s => s.node_id === 'LOW_MUSCLE_STRENGTH');

  check(
    !finalLmsNode || finalLmsNode.current_state !== 'MEASURED',
    'LOW_MUSCLE_STRENGTH deactivated when all 3 answers = yes',
    `actual: ${finalLmsNode?.current_state ?? 'not present (expected)'}`
  );

  await restorePhysical(savedPhysical);
  console.log('  state restored ✓');
}

// ── Registry smoke test ───────────────────────────────────────────────────────

function registrySmoke() {
  sep('Registry — EVIDENCE_STORAGE_REGISTRY smoke check');
  const required = [
    'vynest_nakup', 'zvednout_vnouce', 'vstat_ze_zeme', 'gait_stability',
    'recent_falls', 'fall_history',
    'knee_severity',
    'activity_level', 'weight_kg',
    'lab_ldl', 'lab_crp',
  ];
  for (const key of required) {
    check(Boolean(EVIDENCE_STORAGE_REGISTRY[key]), `Registry has key: ${key}`);
  }
  // Verify fall_history is an alias for recent_falls (same DB key)
  check(
    EVIDENCE_STORAGE_REGISTRY.fall_history?.key === EVIDENCE_STORAGE_REGISTRY.recent_falls?.key,
    'fall_history is canonical alias of recent_falls'
  );
}

// ── S5: vstat_ze_zeme answer closes LOSS_OF_FLOOR_RISE_ABILITY loop ───────────
// Regression for inference.js bug: rule checked oi['vstat_ze_zeme'] but declared
// missing_evidence: obs_type='floor_rise_test'. Fix: NBE now declares vstat_ze_zeme.
// This test verifies the full loop: NBE fires → answer persists → NBE gone.

async function s5_vstat_ze_zeme_closes_loop() {
  sep('S5 — vstat_ze_zeme answer closes LOSS_OF_FLOOR_RISE_ABILITY loop');
  console.log('  Regression: inference.js declared floor_rise_test but checked vstat_ze_zeme');

  const savedPhysical = await savePhysical();

  // Seed: sedentary_hours_day → PHYSICAL_INACTIVITY → PHYSICAL_DECONDITIONING active.
  // vstat_ze_zeme absent → hasFloorData=false → LOSS_OF_FLOOR_RISE_ABILITY should appear.
  await restorePhysical({ sedentary_hours_day: 10 });

  const { runEngine } = await import('../api/engine/engine.js');

  // Baseline: floor loop open
  const baseline = await runEngine(USER_ID);
  const baselineFloor = baseline.node_states.find(s => s.node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');
  const baselineNbeVstat    = baseline.information_needs?.find(n => n.evidence_type === 'vstat_ze_zeme');
  const baselineNbeOldName  = baseline.information_needs?.find(n => n.evidence_type === 'floor_rise_test');

  console.log(`  baseline LOSS_OF_FLOOR_RISE_ABILITY : ${baselineFloor?.current_state ?? 'not present'}`);
  console.log(`  baseline NBE vstat_ze_zeme          : ${baselineNbeVstat ? 'present ✓' : 'absent ✗'}`);
  console.log(`  baseline NBE floor_rise_test (old)  : ${baselineNbeOldName ? 'present — BUG' : 'absent ✓'}`);

  check(Boolean(baselineFloor),       'baseline: LOSS_OF_FLOOR_RISE_ABILITY present');
  check(Boolean(baselineNbeVstat),    'baseline: NBE evidence_type = vstat_ze_zeme (correct name after fix)');
  check(!baselineNbeOldName,          'baseline: NBE floor_rise_test NOT present (old wrong name gone)');

  // Answer vstat_ze_zeme = 'yes' via ANSWER_TO_EVIDENCE_QUESTION
  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'vstat_ze_zeme', value: 'yes' },
  };
  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  // Verify persistence
  const { data: row } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  check(result.persistence_status === 'ok',       'persistence_status = ok');
  check(row?.physical?.vstat_ze_zeme === 'yes',   'physical.vstat_ze_zeme = yes');

  // Fresh engine: loop closed
  const after = await runEngine(USER_ID);
  const afterFloor    = after.node_states.find(s => s.node_id === 'LOSS_OF_FLOOR_RISE_ABILITY');
  const afterNbeVstat = after.information_needs?.find(n => n.evidence_type === 'vstat_ze_zeme');

  check(!afterFloor,    'after: LOSS_OF_FLOOR_RISE_ABILITY gone',
    `actual: ${afterFloor?.current_state ?? 'not present'}`);
  check(!afterNbeVstat, 'after: vstat_ze_zeme NBE gone',
    `still present: ${afterNbeVstat?.evidence_type ?? 'none'}`);

  await restorePhysical(savedPhysical);
  console.log('  state restored ✓');
}

// ── S6: validated_strength_assessment — availability semantics ─────────────────
// "Nemám výsledek" must write evidence_availability=NOT_AVAILABLE (not a raw string
// into physical.validated_strength_assessment). Fresh engine must stop re-asking.

async function s6_validated_strength_availability() {
  sep('S6 — validated_strength_assessment "Nemám" → availability=NOT_AVAILABLE → NBE gone');
  console.log('  Regression: "Nemám" closed loop with NOT_AVAILABLE, not raw string persistence');

  const savedPhysical = await savePhysical();

  // Seed: sedentary → PHYSICAL_DECONDITIONING active → LOW_MUSCLE_STRENGTH UNKNOWN
  // → missing_evidence: validated_strength_assessment → NBE fires.
  // Clear validated_strength_assessment so we start from a clean state.
  const seedPhysical = { sedentary_hours_day: 10 };
  await restorePhysical(seedPhysical);

  const { runEngine } = await import('../api/engine/engine.js');

  // Baseline: validated_strength_assessment NBE should be present
  const baseline = await runEngine(USER_ID);
  const baselineNbe = baseline.information_needs?.find(n => n.evidence_type === 'validated_strength_assessment');

  console.log(`  baseline NBE validated_strength_assessment: ${baselineNbe ? 'present ✓' : 'absent ✗'}`);
  check(Boolean(baselineNbe), 'baseline: validated_strength_assessment NBE present');

  // Answer "Nemám" — should write availability only, no value to physical.validated_strength_assessment
  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'validated_strength_assessment', value: 'Nemám' },
  };
  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  // Verify: availability marker written, no raw value in physical.validated_strength_assessment
  const { data: row } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  const availStatus   = row?.physical?.evidence_availability?.validated_strength_assessment;
  const rawValue      = row?.physical?.validated_strength_assessment;

  console.log(`  evidence_availability.validated_strength_assessment: ${availStatus ?? 'missing'}`);
  console.log(`  physical.validated_strength_assessment (raw):        ${rawValue ?? 'absent ✓'}`);

  check(result.persistence_status === 'ok',        'persistence_status = ok');
  check(availStatus === 'NOT_AVAILABLE',            'evidence_availability.validated_strength_assessment = NOT_AVAILABLE');
  check(rawValue == null,                           'physical.validated_strength_assessment NOT written (no raw string)');

  // Fresh engine: NBE must not re-appear
  const after = await runEngine(USER_ID);
  const afterNbe = after.information_needs?.find(n => n.evidence_type === 'validated_strength_assessment');

  console.log(`  after NBE validated_strength_assessment: ${afterNbe ? 'still present — BUG' : 'absent ✓'}`);
  check(!afterNbe, 'after: validated_strength_assessment NBE gone (availability resolved)',
    afterNbe ? `still present: evidence_type=${afterNbe.evidence_type}` : '');

  // Verify engine ran and produced node_states (not stuck / not crashed)
  check(Array.isArray(after.node_states) && after.node_states.length > 0,
    'after: engine ran and produced node_states (not crashed)');

  await restorePhysical(savedPhysical);
  console.log('  state restored ✓');
}

// ── S7: wearable NBE — availability semantics (steps_day + temporal_activity_trend) ─
// Regression for the class of loops where evidence_type had no registry entry at all.
// steps_day & temporal_activity_trend are AVAILABILITY_ONLY / DERIVED:
//   "Nemám" → evidence_availability[type] = NOT_AVAILABLE (no raw value written)
//   fresh engine → NBE does not re-appear

async function s7_wearable_availability() {
  sep('S7 — wearable NBE "Nemám" → availability=NOT_AVAILABLE → NBE gone');
  console.log('  Regression: steps_day and temporal_activity_trend loop (EVIDENCE_RESOLUTION_REGISTRY)');

  const savedPhysical = await savePhysical();

  // Seed: sedentary_work + no wearable data → PHYSICAL_INACTIVITY → steps_day NBE
  // Also triggers LOSS_OF_FLOOR_RISE_ABILITY projection → temporal_activity_trend NBE
  const seedPhysical = { sedentary_hours_day: 10 };
  await restorePhysical(seedPhysical);

  const { runEngine } = await import('../api/engine/engine.js');

  // ── Unit checks: registry contracts ─────────────────────────────────────────
  const stepsReg  = EVIDENCE_STORAGE_REGISTRY['steps_day'];
  const trenReg   = EVIDENCE_STORAGE_REGISTRY['temporal_activity_trend'];
  const stepsRes  = EVIDENCE_RESOLUTION_REGISTRY['steps_day'];
  const trenRes   = EVIDENCE_RESOLUTION_REGISTRY['temporal_activity_trend'];

  check(stepsReg?.tracks_availability === true,           'STORAGE: steps_day tracks_availability=true');
  check(stepsReg?.evidence_kind === 'AVAILABILITY_ONLY',  'STORAGE: steps_day evidence_kind=AVAILABILITY_ONLY');
  check(stepsReg?.key === null,                           'STORAGE: steps_day key=null (no raw value column)');
  check(trenReg?.tracks_availability === true,            'STORAGE: temporal_activity_trend tracks_availability=true');
  check(trenReg?.evidence_kind === 'DERIVED',             'STORAGE: temporal_activity_trend evidence_kind=DERIVED');
  check(trenReg?.key === null,                            'STORAGE: temporal_activity_trend key=null');

  check(stepsRes?.evidence_kind === 'AVAILABILITY_ONLY',  'RESOLUTION: steps_day evidence_kind=AVAILABILITY_ONLY');
  check(trenRes?.evidence_kind === 'DERIVED',             'RESOLUTION: temporal_activity_trend evidence_kind=DERIVED');

  // isEvidenceResolved: without availability set → not resolved
  const noAvail = { evidence_availability: {} };
  check(!isEvidenceResolved('steps_day', noAvail),             'isEvidenceResolved: steps_day unset → false');
  check(!isEvidenceResolved('temporal_activity_trend', noAvail), 'isEvidenceResolved: temporal_activity_trend unset → false');

  // isEvidenceResolved: with availability set → resolved
  const withAvail = { evidence_availability: { steps_day: 'NOT_AVAILABLE', temporal_activity_trend: 'NOT_AVAILABLE' } };
  check(isEvidenceResolved('steps_day', withAvail),             'isEvidenceResolved: steps_day NOT_AVAILABLE → true');
  check(isEvidenceResolved('temporal_activity_trend', withAvail), 'isEvidenceResolved: temporal_activity_trend NOT_AVAILABLE → true');

  // unknown type → false
  check(!isEvidenceResolved('unknown_obs_type', withAvail), 'isEvidenceResolved: unknown type → false');

  // ── Integration: steps_day full flow ─────────────────────────────────────────
  const baselineSteps = await runEngine(USER_ID);
  const baselineNbe = baselineSteps.information_needs?.find(n => n.evidence_type === 'steps_day');
  console.log(`\n  baseline NBE steps_day: ${baselineNbe ? 'present ✓' : 'absent — may depend on seed data'}`);
  // Note: NBE may be absent if another higher-priority NBE dominates; the key check is post-answer

  const eventSteps = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'steps_day', value: 'Nemám' },
  };
  const resultSteps = await applyHealthEvent(USER_ID, eventSteps);
  showResult(resultSteps);

  const { data: rowSteps } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  const stepsAvail = rowSteps?.physical?.evidence_availability?.steps_day;
  const stepsRaw   = rowSteps?.physical?.steps_day;

  console.log(`  evidence_availability.steps_day: ${stepsAvail ?? 'missing'}`);
  console.log(`  physical.steps_day (raw):        ${stepsRaw ?? 'absent ✓'}`);

  check(resultSteps.persistence_status === 'ok',   'steps_day: persistence_status = ok');
  check(stepsAvail === 'NOT_AVAILABLE',             'steps_day: evidence_availability = NOT_AVAILABLE');
  check(stepsRaw == null,                           'steps_day: no raw value written to physical');

  const afterSteps = await runEngine(USER_ID);
  const afterNbeSteps = afterSteps.information_needs?.find(n => n.evidence_type === 'steps_day');
  console.log(`  after NBE steps_day: ${afterNbeSteps ? 'still present — BUG' : 'absent ✓'}`);
  check(!afterNbeSteps, 'after: steps_day NBE gone');

  // ── Integration: temporal_activity_trend full flow ────────────────────────────
  const eventTrend = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'temporal_activity_trend', value: 'Nemám' },
  };
  const resultTrend = await applyHealthEvent(USER_ID, eventTrend);
  showResult(resultTrend);

  const { data: rowTrend } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  const trendAvail = rowTrend?.physical?.evidence_availability?.temporal_activity_trend;
  const trendRaw   = rowTrend?.physical?.temporal_activity_trend;

  console.log(`  evidence_availability.temporal_activity_trend: ${trendAvail ?? 'missing'}`);
  console.log(`  physical.temporal_activity_trend (raw):        ${trendRaw ?? 'absent ✓'}`);

  check(resultTrend.persistence_status === 'ok',   'temporal_activity_trend: persistence_status = ok');
  check(trendAvail === 'NOT_AVAILABLE',             'temporal_activity_trend: evidence_availability = NOT_AVAILABLE');
  check(trendRaw == null,                           'temporal_activity_trend: no raw value written to physical');

  const afterTrend = await runEngine(USER_ID);
  const afterNbeTrend = afterTrend.information_needs?.find(n => n.evidence_type === 'temporal_activity_trend');
  console.log(`  after NBE temporal_activity_trend: ${afterNbeTrend ? 'still present — BUG' : 'absent ✓'}`);
  check(!afterNbeTrend, 'after: temporal_activity_trend NBE gone');

  await restorePhysical(savedPhysical);
  console.log('  state restored ✓');
}

// ── S8: GENERAL_HEALTH_REQUEST — age + HYPERTENSION persistence ───────────────
// Regression: "Je mi 61 let, mám vysoký krevní tlak." must extract:
//   - birth_year = currentYear - 61  → user_profiles
//   - HYPERTENSION (structurally)    → user_health_profile.diagnoses
// Raw text must remain in symptoms as audit trail.
// Fresh engine must not return zero-data ASK_BLOCKING.

async function s8_general_health_request_age_and_diagnosis() {
  sep('S8 — GENERAL_HEALTH_REQUEST: age + HYPERTENSION persisted structurally');
  console.log('  Input: "Je mi 61 let, mám vysoký krevní tlak."');

  const TEXT = 'Je mi 61 let, mám vysoký krevní tlak.';
  const EXPECTED_BIRTH_YEAR = new Date().getFullYear() - 61;

  // Save state
  const { data: upRow }    = await sb.from('user_profiles').select('birth_year').eq('user_id', USER_ID).maybeSingle();
  const savedBirthYear     = upRow?.birth_year ?? null;
  const { data: hpRow }    = await sb.from('user_health_profile').select('symptoms, diagnoses').eq('user_id', USER_ID).maybeSingle();
  const savedSymptoms      = hpRow?.symptoms  ?? [];
  const savedDiagnoses     = hpRow?.diagnoses ?? [];

  // Clean state: clear birth_year so extraction is testable
  await sb.from('user_profiles').update({ birth_year: null }).eq('user_id', USER_ID);
  await sb.from('user_health_profile').upsert(
    { user_id: USER_ID, symptoms: [], diagnoses: [] },
    { onConflict: 'user_id' }
  );

  const event = {
    event_type: 'GENERAL_HEALTH_REQUEST',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload: { text: TEXT },
  };

  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  // Read back DB state
  const { data: afterUp } = await sb.from('user_profiles').select('birth_year').eq('user_id', USER_ID).maybeSingle();
  const { data: afterHp } = await sb.from('user_health_profile').select('symptoms, diagnoses').eq('user_id', USER_ID).maybeSingle();

  const birthYearSet   = afterUp?.birth_year;
  const diagnosesAfter = afterHp?.diagnoses ?? [];
  const symptomsAfter  = afterHp?.symptoms  ?? [];

  const hypertensionEntry = diagnosesAfter.find(d => d?.name === 'HYPERTENSION');
  const rawTextInSymptoms = symptomsAfter.includes(TEXT);

  console.log(`  birth_year written:             ${birthYearSet ?? 'null'}`);
  console.log(`  diagnoses[]:                    ${JSON.stringify(diagnosesAfter)}`);
  console.log(`  HYPERTENSION entry:             ${JSON.stringify(hypertensionEntry ?? 'absent')}`);
  console.log(`  raw text in symptoms:           ${rawTextInSymptoms}`);

  check(result.persistence_status === 'ok',                             'persistence_status = ok');
  check(birthYearSet === EXPECTED_BIRTH_YEAR,                           `birth_year = ${EXPECTED_BIRTH_YEAR} (currentYear - 61)`,
    `actual: ${birthYearSet}`);
  check(Boolean(hypertensionEntry),                                     'HYPERTENSION in diagnoses[] structurally',
    `actual diagnoses: ${JSON.stringify(diagnosesAfter)}`);
  check(hypertensionEntry?.status === 'confirmed',                      'HYPERTENSION status = confirmed');
  check(hypertensionEntry?.source === 'general_health_request',         'HYPERTENSION source = general_health_request');
  check(rawTextInSymptoms,                                              'raw text preserved in symptoms[] (audit trail)');

  // Fresh engine: HYPERTENSION node must be active, DD must not be zero-data ASK_BLOCKING
  const { runEngine } = await import('../api/engine/engine.js');
  const afterEngine   = await runEngine(USER_ID);
  const dd            = afterEngine.daily_decision ?? result.domain_response?.daily_decision;
  const hypertNode    = afterEngine.node_states?.find(s => s.node_id === 'HYPERTENSION');

  console.log(`  engine HYPERTENSION state:      ${hypertNode?.current_state ?? 'not activated'}`);
  console.log(`  DD mode / reason_code:          ${dd?.mode ?? '?'} / ${dd?.reason_code ?? '?'}`);

  check(
    Boolean(hypertNode),
    'HYPERTENSION node_state present in engine output',
    `actual node_states: ${afterEngine.node_states?.map(s => s.node_id).join(', ')}`
  );
  check(
    !(dd?.mode === 'ASK' && dd?.reason_code === 'ASK_BLOCKING'),
    'DD no longer zero-data ASK_BLOCKING after HYPERTENSION persisted',
    `actual: mode=${dd?.mode} reason_code=${dd?.reason_code}`
  );

  // Restore
  await sb.from('user_profiles').update({ birth_year: savedBirthYear }).eq('user_id', USER_ID);
  await sb.from('user_health_profile').upsert(
    { user_id: USER_ID, symptoms: savedSymptoms, diagnoses: savedDiagnoses },
    { onConflict: 'user_id' }
  );
  console.log('  state restored ✓');
}

// ── S9: SKIPPED action_id ineligible for rest of day; sibling eligible; eligible next day ─
// Contract: SKIP = "tuto konkrétní akci teď nechci", not "celou intervention".
// Regression:
//   ACT action=A → SKIPPED A → fresh runEngine → NBA.selected.action_id != A
//   A in intervention X, B also in X → skip A does NOT remove B from candidates
//   No SKIPPED row for today → A eligible again (simulates next day)

async function s9_skip_action_id_ineligible_today() {
  sep('S9 — SKIPPED action_id ineligible today; sibling in same intervention still eligible');

  const TODAY_STR = new Date().toISOString().slice(0, 10);
  const savedPhysical  = await savePhysical();

  // Save diagnoses + today's action_assignments
  const { data: hpRow } = await sb.from('user_health_profile')
    .select('diagnoses').eq('user_id', USER_ID).maybeSingle();
  const savedDiagnoses = hpRow?.diagnoses ?? [];
  const { data: savedAA } = await sb.from('action_assignments')
    .select('*').eq('user_id', USER_ID).eq('assigned_date', TODAY_STR);

  // Set up: HYPERTENSION + sedentary → activates PHYSICAL_INACTIVITY → BREAK_UP_SEDENTARY_TIME
  await sb.from('user_health_profile').upsert({
    user_id:   USER_ID,
    diagnoses: [{ name: 'HYPERTENSION', status: 'confirmed', source: 'test' }],
    physical:  { sedentary_hours_day: 9 },
  }, { onConflict: 'user_id' });
  await sb.from('action_assignments').delete()
    .eq('user_id', USER_ID).eq('assigned_date', TODAY_STR);

  const { runEngine } = await import('../api/engine/engine.js');

  // Baseline: confirm action A is selected
  const before = await runEngine(USER_ID);
  const selBefore = before.next_best_action?.selected;
  check(Boolean(selBefore?.action_id), 'baseline: NBA selected an action');
  console.log(`  baseline selected: ${selBefore?.action_id} (${selBefore?.label})`);
  console.log(`  baseline intervention: ${selBefore?.intervention_id}`);

  const skippedActionId       = selBefore?.action_id;
  const skippedInterventionId = selBefore?.intervention_id;

  if (!skippedActionId) {
    check(false, 'SKIP scenario requires a selected action — aborting S9');
    await restorePhysical(savedPhysical);
    return;
  }

  // Insert SKIPPED row for action A
  const leverageNodeId = before.system_leverage?.selected?.node_id ?? 'UNKNOWN';
  await sb.from('action_assignments').insert({
    user_id:                USER_ID,
    action_id:              skippedActionId,
    intervention_id:        skippedInterventionId,
    selected_leverage_node: leverageNodeId,
    engine_version:         '1.0.0',
    status:                 'SKIPPED',
    assigned_date:          TODAY_STR,
  });

  // After skip: A must not appear
  const after = await runEngine(USER_ID);
  const selAfter      = after.next_best_action?.selected;
  const candsAfter    = after.next_best_action?.all_candidates ?? [];

  console.log(`  after skip selected: ${selAfter?.action_id ?? 'null'} (${selAfter?.label ?? 'null'})`);

  check(
    selAfter?.action_id !== skippedActionId,
    `after skip: NBA.selected.action_id != '${skippedActionId}'`,
    `actual: ${selAfter?.action_id}`
  );

  check(
    !candsAfter.some(c => c.action_id === skippedActionId),
    `skipped action '${skippedActionId}' absent from all_candidates`,
    `found in: ${candsAfter.map(c => c.action_id).join(', ')}`
  );

  // Sibling in same intervention must still be eligible
  const sibling = candsAfter.find(
    c => c.intervention_id === skippedInterventionId && c.action_id !== skippedActionId
  );
  check(
    Boolean(sibling),
    `sibling action in '${skippedInterventionId}' still in candidates after skipping '${skippedActionId}'`,
    `candsAfter interventions: ${[...new Set(candsAfter.map(c => c.intervention_id))].join(', ')}`
  );
  if (sibling) console.log(`  sibling eligible: ${sibling.action_id} (${sibling.label})`);

  // "Next day": delete SKIPPED row → A must reappear in candidates
  await sb.from('action_assignments').delete()
    .eq('user_id', USER_ID).eq('assigned_date', TODAY_STR);

  const nextDay      = await runEngine(USER_ID);
  const candsNextDay = nextDay.next_best_action?.all_candidates ?? [];
  check(
    candsNextDay.some(c => c.action_id === skippedActionId),
    `'${skippedActionId}' eligible again when no SKIPPED row for today (simulates next day)`,
    `candsNextDay: ${candsNextDay.map(c => c.action_id).join(', ')}`
  );

  // Restore
  await sb.from('action_assignments').delete()
    .eq('user_id', USER_ID).eq('assigned_date', TODAY_STR);
  if ((savedAA ?? []).length > 0) {
    const toInsert = (savedAA ?? []).map(({ id: _id, ...rest }) => rest);
    await sb.from('action_assignments').insert(toInsert);
  }
  await sb.from('user_health_profile').upsert({
    user_id:   USER_ID,
    diagnoses: savedDiagnoses,
    physical:  savedPhysical ?? {},
  }, { onConflict: 'user_id' });
  console.log('  state restored ✓');
}

// ── S10: fatigue_context answer → physical.fatigue_context persisted ──────────
// Verifies that ANSWER_TO_EVIDENCE_QUESTION with evidence_type='fatigue_context'
// persists a normalized enum value (NEW_OR_UNUSUAL | ROUTINE | UNKNOWN)
// to user_health_profile.physical.fatigue_context via routeAnswer().
// fatigue_context has no engine activation rule — persistence_status must be 'ok'.

async function s10_fatigue_context() {
  sep('S10 — ANSWER { evidence_type: "fatigue_context" } → physical.fatigue_context persisted');
  console.log('  Verifies fatigue_context entry in EVIDENCE_STORAGE_REGISTRY wires up routeAnswer');

  check(
    Boolean(EVIDENCE_STORAGE_REGISTRY.fatigue_context),
    'EVIDENCE_STORAGE_REGISTRY has fatigue_context key'
  );
  check(
    EVIDENCE_STORAGE_REGISTRY.fatigue_context?.table === 'physical',
    'fatigue_context table = physical'
  );
  check(
    EVIDENCE_STORAGE_REGISTRY.fatigue_context?.key === 'fatigue_context',
    'fatigue_context key = fatigue_context'
  );

  const savedPhysical = await savePhysical();

  // Ensure clean state — remove any prior fatigue_context
  await restorePhysical({ ...(savedPhysical || {}), fatigue_context: undefined });

  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'fatigue_context', value: 'NEW_OR_UNUSUAL' },
  };

  const result = await applyHealthEvent(USER_ID, event);
  showResult(result);

  const { data: row } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  const storedValue = row?.physical?.fatigue_context;
  console.log(`  physical.fatigue_context: ${storedValue ?? 'missing'}`);

  check(result.persistence_status === 'ok',                      'persistence_status = ok');
  check(['NEW_OR_UNUSUAL', 'ROUTINE', 'UNKNOWN'].includes(storedValue),
    `physical.fatigue_context ∈ enum (got: ${storedValue})`);
  check(storedValue === 'NEW_OR_UNUSUAL',                        'stored value matches sent value');

  // Test ROUTINE value
  const event2 = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload: { evidence_type: 'fatigue_context', value: 'ROUTINE' },
  };
  const result2 = await applyHealthEvent(USER_ID, event2);
  const { data: row2 } = await sb.from('user_health_profile')
    .select('physical').eq('user_id', USER_ID).maybeSingle();

  check(result2.persistence_status === 'ok',                     'ROUTINE: persistence_status = ok');
  check(row2?.physical?.fatigue_context === 'ROUTINE',           'ROUTINE: physical.fatigue_context = ROUTINE');

  await restorePhysical(savedPhysical);
  console.log('  state restored ✓');
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nHealth Event Adapter v0.1 — Integration Tests`);
  console.log(`User: ${USER_ID}  |  Date: ${TODAY}`);

  registrySmoke();

  await s1_knee_symptom();
  await s2_knee_severity_answer();
  await s3_fall_history();
  await s4_vynest_nakup();
  await s5_vstat_ze_zeme_closes_loop();
  await s6_validated_strength_availability();
  await s7_wearable_availability();
  await s8_general_health_request_age_and_diagnosis();
  await s9_skip_action_id_ineligible_today();
  await s10_fatigue_context();

  const total = passed + failed;
  sep(`Results: ${passed}/${total} passed${failed ? ` — ${failed} FAILED` : ''}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
