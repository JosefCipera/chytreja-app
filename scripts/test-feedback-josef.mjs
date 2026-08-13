// test-feedback-josef.mjs — Feedback Loop v0.1 end-to-end test: Josef
// Run: node --env-file=.env.local scripts/test-feedback-josef.mjs
//
// Simulates 14 days of Josefovy action_assignments (AEROBIC_TRAINING, 8/14 COMPLETED)
// plus 14 days of daily_checkin (9/14 medium/high) already expected in DB from prior sessions.
//
// Flow:
//   1. Insert 14 action_assignments (ASSIGNED + 8 COMPLETED)
//   2. runEngine(Josef) — first run (baseline for Feedback Loop output)
//   3. Display: node_states, intervention_exposure, response_evaluations, information_needs, NBA
//   4. Simulate day 15: one more COMPLETED assignment
//   5. runEngine(Josef) — second run (shows tiebreaker logic if applicable)
//   6. Cleanup: DELETE inserted action_assignments (rollback test data)
//
// Prerequisites:
//   - JOSEF_USER_ID env var set (real DB user with PHYSICAL_INACTIVITY profile)
//   - action_assignments table exists (migration: add_action_assignments.sql)
//   - daily_checkin rows with movement_level=medium/high in last 14 days preferred
//     (engine will show INSUFFICIENT_OBSERVATION if daily_checkin missing)

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient }  from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runEngine }     from '../api/engine/engine.js';

const _dir    = dirname(fileURLToPath(import.meta.url));
const JOSEF_USER_ID = process.env.JOSEF_USER_ID || process.argv[2];

if (!JOSEF_USER_ID) {
  console.error('ERROR: Set JOSEF_USER_ID env var or pass as first argument.');
  console.error('  JOSEF_USER_ID=<uuid> node --env-file=.env.local scripts/test-feedback-josef.mjs');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function tsAgo(n, hourOffset = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hourOffset, 0, 0, 0);
  return d.toISOString();
}

function sep(label) {
  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${label}`);
  console.log(line);
}

function show(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

// ── Fetch a KARDIO_PROTOKOL action from longevity_actions ─────────────────────

async function fetchKardioAction() {
  const { data, error } = await supabase
    .from('longevity_actions')
    .select('id, label, protocol_type')
    .eq('protocol_type', 'KARDIO_PROTOKOL')
    .eq('active', true)
    .limit(1)
    .single();
  if (error) throw new Error(`fetchKardioAction: ${error.message}`);
  return data;
}

// ── Insert simulated action_assignments ───────────────────────────────────────
// 14 assignments over 14 days, 8 COMPLETED, 6 SKIPPED.
// COMPLETED on days: 13,12,11,9,8,6,5,3 ago (days 1,2,3,5,6,8,9,11)
// SKIPPED on days: 10,7,4,2,1,0 ago

async function insertTestAssignments(actionId) {
  const ENGINE_VERSION        = '1.0.0';
  const INTERVENTION_ID       = 'AEROBIC_TRAINING';
  const SELECTED_LEVERAGE_NODE = 'PHYSICAL_INACTIVITY';

  const COMPLETED_DAYS = [13, 12, 11, 9, 8, 6, 5, 3];
  const SKIPPED_DAYS   = [10, 7, 4, 2, 1, 0];

  const rows = [];

  for (const d of COMPLETED_DAYS) {
    rows.push({
      user_id:                JOSEF_USER_ID,
      action_id:              actionId,
      intervention_id:        INTERVENTION_ID,
      selected_leverage_node: SELECTED_LEVERAGE_NODE,
      engine_version:         ENGINE_VERSION,
      status:                 'COMPLETED',
      assigned_at:            tsAgo(d, 8),
      completed_at:           tsAgo(d, 9),
      actual_duration_seconds: 1200 + Math.floor(Math.random() * 300),
      assigned_date:          daysAgo(d),
    });
  }

  for (const d of SKIPPED_DAYS) {
    rows.push({
      user_id:                JOSEF_USER_ID,
      action_id:              actionId,
      intervention_id:        INTERVENTION_ID,
      selected_leverage_node: SELECTED_LEVERAGE_NODE,
      engine_version:         ENGINE_VERSION,
      status:                 'SKIPPED',
      assigned_at:            tsAgo(d, 8),
      assigned_date:          daysAgo(d),
    });
  }

  const { data, error } = await supabase
    .from('action_assignments')
    .insert(rows)
    .select('id');

  if (error) throw new Error(`insertTestAssignments: ${error.message}`);
  console.log(`  Inserted ${data.length} action_assignments (8 COMPLETED, 6 SKIPPED)`);
  return data.map(r => r.id);
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function cleanup(insertedIds) {
  if (!insertedIds?.length) return;
  const { error } = await supabase
    .from('action_assignments')
    .delete()
    .in('id', insertedIds);
  if (error) console.warn(`  Cleanup warning: ${error.message}`);
  else console.log(`  Cleaned up ${insertedIds.length} test action_assignments`);
}

// ── Display helpers ────────────────────────────────────────────────────────────

function displayNodeStates(node_states) {
  sep('PERSON_NODE_STATE');
  for (const s of node_states) {
    console.log(`  ${s.node_id.padEnd(30)} ${s.current_state.padEnd(20)} confidence=${s.confidence}`);
  }
}

function displayExposure(intervention_exposure) {
  sep('INTERVENTION_EXPOSURE');
  if (!intervention_exposure?.length) {
    console.log('  (empty — no action_assignments found)');
    return;
  }
  for (const e of intervention_exposure) {
    console.log(`  intervention: ${e.intervention_id}`);
    console.log(`    leverage_node:      ${e.leverage_node_id}`);
    console.log(`    period:            ${e.period_start} → ${e.period_end} (${e.calendar_days_in_period} days)`);
    console.log(`    sessions:          ${e.sessions_completed} completed / ${e.sessions_assigned} assigned / ${e.sessions_skipped} skipped`);
    console.log(`    total_duration:    ${Math.round(e.total_actual_duration_s / 60)} min actual`);
    console.log(`    first_completed:   ${e.first_completed_at ?? 'none'}`);
  }
}

function displayResponseEvaluations(response_evaluations) {
  sep('RESPONSE_EVALUATION');
  if (!response_evaluations?.length) {
    console.log('  (none — no exposures with expected_responses)');
    return;
  }
  for (const r of response_evaluations) {
    const icon = {
      CONSISTENT_WITH_EXPECTED_RESPONSE: '✅',
      NO_RESPONSE_OBSERVED:              '❌',
      INSUFFICIENT_OBSERVATION:          '⚠️ ',
      INSUFFICIENT_EXPOSURE:             '⏳',
      TOO_EARLY:                         '🕐',
    }[r.result] ?? '?';
    console.log(`\n  ${icon} ${r.result}`);
    console.log(`     intervention:    ${r.intervention_id}`);
    console.log(`     response_id:     ${r.response_id}`);
    console.log(`     obs_type:        ${r.observable_obs_type}`);
    console.log(`     target_node:     ${r.target_node}`);
    console.log(`     evidence_quality: ${r.evidence_quality}`);
    console.log(`     reason: ${r.reason}`);
    if (r.observation_summary) console.log(`     obs_summary: ${r.observation_summary}`);
    if (r.exposure_detail)    console.log(`     exposure_detail:`, r.exposure_detail);
  }
}

function displayInformationNeeds(information_needs) {
  sep('INFORMATION_NEEDS (top 5)');
  const sorted = [...(information_needs ?? [])].sort((a, b) => {
    const urgOrd = { high: 3, medium: 2, low: 1 };
    return (urgOrd[b.urgency] ?? 0) - (urgOrd[a.urgency] ?? 0);
  });
  for (const n of sorted.slice(0, 5)) {
    const src = n.source ? `[${n.source}] ` : '';
    console.log(`  ${src}${n.evidence_type.padEnd(32)} urgency=${n.urgency.padEnd(7)} impact=${n.decision_impact.padEnd(7)} cost=${n.acquisition_cost}`);
  }
}

function displayNBA(next_best_action) {
  sep('NEXT_BEST_ACTION');
  if (next_best_action.status !== 'SELECTED') {
    console.log(`  status: ${next_best_action.status}`);
    console.log(`  reason: ${next_best_action.reason}`);
    return;
  }
  const s = next_best_action.selected;
  console.log(`  status:         ${next_best_action.status}`);
  console.log(`  selected:       "${s?.label}"`);
  console.log(`  action_id:      ${s?.action_id}`);
  console.log(`  intervention:   ${s?.intervention_id}`);
  console.log(`  protocol_type:  ${s?.protocol_type}`);
  console.log(`  safety:         ${s?.safety?.level}`);
  console.log(`  leverage_affinity: ${s?.leverage_affinity}`);
  console.log(`  viable_count:   ${next_best_action.viable_count}`);
  console.log(`  non_viable:     ${next_best_action.non_viable_count}`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  CHJ Engine v1 — Feedback Loop v0.1 End-to-End Test: Josef');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  user_id: ${JOSEF_USER_ID}`);
  console.log(`  date:    ${new Date().toISOString().slice(0, 10)}`);

  let insertedIds = [];

  try {
    // ── Step 1: Setup ─────────────────────────────────────────────────────────
    sep('STEP 1 — Fetch KARDIO_PROTOKOL action + insert test assignments');
    const kardioAction = await fetchKardioAction();
    console.log(`  Using action: "${kardioAction.label}" (${kardioAction.protocol_type})`);
    insertedIds = await insertTestAssignments(kardioAction.id);

    // ── Step 2: First runEngine ────────────────────────────────────────────────
    sep('STEP 2 — runEngine() — FIRST RUN (with 14-day exposure)');
    console.log('  Running...');
    const result1 = await runEngine(JOSEF_USER_ID);

    displayNodeStates(result1.node_states);
    displayExposure(result1.intervention_exposure);
    displayResponseEvaluations(result1.response_evaluations);
    displayInformationNeeds(result1.information_needs);
    displayNBA(result1.next_best_action);

    // ── Step 3: Insert one more completion (day 15 simulation) ─────────────────
    sep('STEP 3 — Simulate day 15: insert one more COMPLETED assignment');
    const { data: extra, error: extraErr } = await supabase
      .from('action_assignments')
      .insert([{
        user_id:                JOSEF_USER_ID,
        action_id:              kardioAction.id,
        intervention_id:        'AEROBIC_TRAINING',
        selected_leverage_node: 'PHYSICAL_INACTIVITY',
        engine_version:         '1.0.0',
        status:                 'COMPLETED',
        assigned_at:            new Date().toISOString(),
        completed_at:           new Date().toISOString(),
        actual_duration_seconds: 1260,
        assigned_date:          daysAgo(0),
      }])
      .select('id');
    if (extraErr) throw new Error(`extra insert: ${extraErr.message}`);
    insertedIds.push(...extra.map(r => r.id));
    console.log('  Day 15 COMPLETED assignment inserted (9/15 COMPLETED total)');

    // ── Step 4: Second runEngine ───────────────────────────────────────────────
    sep('STEP 4 — runEngine() — SECOND RUN (day 15)');
    console.log('  Running...');
    const result2 = await runEngine(JOSEF_USER_ID);

    console.log('\n  Δ node_states vs first run:');
    for (const s of result2.node_states) {
      const prev = result1.node_states.find(p => p.node_id === s.node_id);
      const changed = prev && (prev.current_state !== s.current_state || prev.confidence !== s.confidence);
      const marker = changed ? ' ← CHANGED' : '';
      console.log(`    ${s.node_id.padEnd(30)} ${s.current_state.padEnd(20)} confidence=${s.confidence}${marker}`);
    }

    displayExposure(result2.intervention_exposure);
    displayResponseEvaluations(result2.response_evaluations);

    sep('NEXT_BEST_ACTION — SECOND RUN');
    const s1 = result1.next_best_action?.selected;
    const s2 = result2.next_best_action?.selected;
    console.log(`  Run 1: "${s1?.label ?? '(none)'}"`);
    console.log(`  Run 2: "${s2?.label ?? '(none)'}"`);
    if (s1?.action_id === s2?.action_id) {
      console.log('  → Same action selected (consistent)');
    } else {
      console.log('  → Different action selected (response history tiebreaker may have influenced)');
    }

    // ── Verdict ────────────────────────────────────────────────────────────────
    sep('VERDICT');
    const r1evals = result1.response_evaluations ?? [];
    const consistent = r1evals.some(r => r.result === 'CONSISTENT_WITH_EXPECTED_RESPONSE');
    const insufObs   = r1evals.some(r => r.result === 'INSUFFICIENT_OBSERVATION');
    const insufExp   = r1evals.some(r => r.result === 'INSUFFICIENT_EXPOSURE');
    const tooEarly   = r1evals.some(r => r.result === 'TOO_EARLY');
    const noResp     = r1evals.some(r => r.result === 'NO_RESPONSE_OBSERVED');

    if (consistent) {
      console.log('  PASS — CONSISTENT_WITH_EXPECTED_RESPONSE present.');
      console.log('  → activity_level observation is directionally consistent with AEROBIC_TRAINING exposure.');
      console.log('  → No causality claimed. Node states unchanged by adherence.');
    } else if (insufObs) {
      console.log('  PARTIAL_PASS — INSUFFICIENT_OBSERVATION.');
      console.log('  → Exposure met minimum rule but daily_checkin activity_level missing post-intervention.');
      console.log('  → Add check-in data or log movement_level in daily_checkin to enable evaluation.');
    } else if (insufExp) {
      console.log('  PARTIAL_PASS — INSUFFICIENT_EXPOSURE.');
      console.log('  → Horizon elapsed but minimum exposure rule not met. Add more completed sessions.');
    } else if (tooEarly) {
      console.log('  TOO_EARLY — Horizon not yet elapsed.');
    } else if (noResp) {
      console.log('  NO_RESPONSE_OBSERVED — Minimum exposure met, direction not observed.');
    } else {
      console.log('  No response evaluations computed — check intervention_exposure.');
    }

  } finally {
    sep('CLEANUP');
    await cleanup(insertedIds);
    console.log('\n  Test complete.\n');
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
