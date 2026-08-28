// tracer_activity_loop.mjs — trace "jak aktivní jsi přes den?" repeat loop
// Repro: zero-data → user provides health info → CHJ asks about activity → loop
// Run: node --env-file=.env.local scripts/tracer_activity_loop.mjs [userId]
//
// Without userId: creates an ephemeral UID seeded with a fresh profile, deleted in finally.
// With userId:    operates on that user's existing DB state (saves/restores in finally).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { fetchHealthData } from '../api/engine/adapter.js';
import { processInput, buildEvent, _buildSessionUpdates_test as buildSessionUpdates } from '../api/engine/orchestrator.js';
import { runEngine } from '../api/engine/engine.js';
import { computeDailyDecision } from '../api/engine/dailyDecision.js';

const sb       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID  = process.argv[2] || `test-act-loop-${Date.now()}`;
const EPHEMERAL = !process.argv[2];

const SEED_HP = { diagnoses: [], symptoms: [], medications: [], physical: {}, lifestyle: {} };
const SEED_UP = { birth_year: 1975 };

function sep(s) { console.log(`\n${'─'.repeat(64)}\n  ${s}\n${'─'.repeat(64)}`); }

async function run() {
  let savedSymptoms  = [];
  let savedPhysical  = {};
  let savedLifestyle = {};

  if (EPHEMERAL) {
    await sb.from('user_health_profile').upsert({ user_id: USER_ID, ...SEED_HP }, { onConflict: 'user_id' });
    await sb.from('user_profiles').upsert({ user_id: USER_ID, ...SEED_UP }, { onConflict: 'user_id' });
  } else {
    const { data: origHp } = await sb.from('user_health_profile')
      .select('diagnoses, symptoms, medications, physical, lifestyle')
      .eq('user_id', USER_ID).maybeSingle();
    savedSymptoms  = origHp?.symptoms  ?? [];
    savedPhysical  = origHp?.physical  ?? {};
    savedLifestyle = origHp?.lifestyle ?? {};
    console.log('  State saved for restore.');
  }

  try {
    // ── STEP 1: Seed — simulate state after first GENERAL_HEALTH_REQUEST ────────
    sep('STEP 1 — seed: state after first GENERAL_HEALTH_REQUEST');
    await sb.from('user_health_profile').upsert({
      user_id:  USER_ID,
      symptoms: ['vysoký tlak'],
      physical: { ...savedPhysical, sedentary_hours_day: undefined },
      lifestyle: {},
    }, { onConflict: 'user_id' });

    const healthAfterSeed = await fetchHealthData(USER_ID);
    console.log('  diagnoses from symptoms after seed:', JSON.stringify(healthAfterSeed.clinicalHistory.diagnoses.map(d => d.id)));
    console.log('  sedentary_hours_day obs:', healthAfterSeed.observations.find(o => o.obs_type === 'sedentary_hours_day') ?? 'absent');
    console.log('  lifestyle.sedentary_work:', healthAfterSeed.clinicalHistory.lifestyle.sedentary_work);

    // ── STEP 2: Engine run ───────────────────────────────────────────────────────
    sep('STEP 2 — engine run after seed → what context drives the activity fallback?');
    const engineAfterSeed = await runEngine(USER_ID);
    const ddAfterSeed = computeDailyDecision(engineAfterSeed);
    console.log('  DD mode:', ddAfterSeed.mode, '  reason_code:', ddAfterSeed.reason_code);
    console.log('  system_leverage:', JSON.stringify(engineAfterSeed.system_leverage?.selected));
    console.log('  information_needs:');
    for (const n of (engineAfterSeed.information_needs ?? [])) {
      console.log(`    - ${n.evidence_type} (${n.acquisition_method}, urgency=${n.urgency})`);
    }
    const hasLeverageContext = Boolean(engineAfterSeed.system_leverage?.selected?.node_id);
    console.log('\n  hasLeverageContext:', hasLeverageContext);
    console.log('  → Activity fallback text fires:', ddAfterSeed.mode === 'ASK' && !ddAfterSeed.primary_item && hasLeverageContext ? 'YES ← THIS IS THE LOOP SOURCE' : 'no');

    // ── STEP 3: pending_question after activity fallback ─────────────────────────
    sep('STEP 3 — buildSessionUpdates for activity fallback: pending_question=?');
    const fakeAskBlockingResult = {
      domain_response: {
        daily_decision: ddAfterSeed,
        explanation_context: { system_leverage: engineAfterSeed.system_leverage?.selected ?? null },
      },
      warnings: [], error: null,
    };
    const suAfterFallback = buildSessionUpdates('DOMAIN_REQUEST', {}, fakeAskBlockingResult);
    console.log('  pending_question after activity fallback:', JSON.stringify(suAfterFallback.pending_question));

    // ── STEP 4: Simulate user answer ─────────────────────────────────────────────
    sep('STEP 4 — processInput("Spíš málo. Většinu dne sedím.", pending_question=null)');
    const sessionAfterFallback = {
      pending_question:          suAfterFallback.pending_question,
      current_action_assignment: null,
      last_daily_decision:       ddAfterSeed,
    };
    const { data: beforeAnswerHp } = await sb.from('user_health_profile')
      .select('physical, symptoms, lifestyle').eq('user_id', USER_ID).maybeSingle();
    console.log('  BEFORE: physical.sedentary_hours_day:', beforeAnswerHp?.physical?.sedentary_hours_day ?? 'absent');
    console.log('  BEFORE: lifestyle.sedentary:', beforeAnswerHp?.lifestyle?.sedentary ?? 'absent');
    console.log('  BEFORE: symptoms count:', (beforeAnswerHp?.symptoms ?? []).length);

    const activityAnswer = 'Spíš málo. Většinu dne sedím.';
    const response = await processInput(USER_ID, activityAnswer, sessionAfterFallback);

    const { data: afterAnswerHp } = await sb.from('user_health_profile')
      .select('physical, symptoms, lifestyle').eq('user_id', USER_ID).maybeSingle();
    console.log('\n  AFTER:  physical.sedentary_hours_day:', afterAnswerHp?.physical?.sedentary_hours_day ?? 'absent');
    console.log('  AFTER:  lifestyle.sedentary:', afterAnswerHp?.lifestyle?.sedentary ?? 'absent');
    console.log('  AFTER:  symptoms:', JSON.stringify(afterAnswerHp?.symptoms));
    console.log('\n  response.mode:', response.mode);
    console.log('  response.text:', response.text?.slice(0, 120));
    console.log('  response.session_updates.pending_question:', JSON.stringify(response.session_updates?.pending_question));

    // ── STEP 5: Engine re-run after answer ───────────────────────────────────────
    sep('STEP 5 — engine re-run after activity answer');
    const engineAfterAnswer = await runEngine(USER_ID);
    const ddAfterAnswer = computeDailyDecision(engineAfterAnswer);
    console.log('  DD mode after answer:', ddAfterAnswer.mode, '  reason_code:', ddAfterAnswer.reason_code);
    console.log('  system_leverage after answer:', JSON.stringify(engineAfterAnswer.system_leverage?.selected));
    console.log('  PHYSICAL_INACTIVITY node state:', engineAfterAnswer.activation?.find(s => s.node_id === 'PHYSICAL_INACTIVITY')?.current_state ?? 'not activated');
    console.log('  information_needs after answer:');
    for (const n of (engineAfterAnswer.information_needs ?? [])) {
      console.log(`    - ${n.evidence_type} (${n.acquisition_method})`);
    }
    const hasLeverageAfter = Boolean(engineAfterAnswer.system_leverage?.selected?.node_id);
    console.log('\n  Activity fallback would fire again:', ddAfterAnswer.mode === 'ASK' && !ddAfterAnswer.primary_item && hasLeverageAfter ? 'YES ← LOOP CONFIRMED' : 'no');

    // ── STEP 6: Inject sedentary_hours_day directly to break loop ────────────────
    sep('STEP 6 — what breaks the loop: inject sedentary_hours_day=10 directly');
    await sb.from('user_health_profile').upsert({
      user_id: USER_ID,
      physical: { ...afterAnswerHp?.physical, sedentary_hours_day: 10 },
    }, { onConflict: 'user_id' });
    const engineWithSedHours = await runEngine(USER_ID);
    const ddWithSedHours = computeDailyDecision(engineWithSedHours);
    const physInactivityState = engineWithSedHours.activation?.find(s => s.node_id === 'PHYSICAL_INACTIVITY')?.current_state;
    console.log('  PHYSICAL_INACTIVITY with sedentary_hours_day=10:', physInactivityState ?? 'not activated');
    console.log('  DD mode with sedentary_hours_day=10:', ddWithSedHours.mode, '  reason_code:', ddWithSedHours.reason_code);
    console.log('  Loop would fire again:', ddWithSedHours.mode === 'ASK' && !ddWithSedHours.primary_item ? 'yes' : 'NO ← LOOP BROKEN');

    // ── STEP 7: DIAG_KEYWORDS check ──────────────────────────────────────────────
    sep('STEP 7 — DIAG_KEYWORDS: does "Spíš málo. Většinu dne sedím." match?');
    const { data: withActivitySymptom } = await sb.from('user_health_profile')
      .select('symptoms').eq('user_id', USER_ID).maybeSingle();
    console.log('  symptoms in DB after answer:', JSON.stringify(withActivitySymptom?.symptoms));
    const healthWithActivity = await fetchHealthData(USER_ID);
    console.log('  diagnoses extracted from symptoms:', JSON.stringify(healthWithActivity.clinicalHistory.diagnoses.map(d => d.id)));
    console.log('  activity observations:', healthWithActivity.observations.filter(o =>
      ['activity_level','sedentary_hours_day','steps_day'].includes(o.obs_type)
    ));

  } finally {
    if (EPHEMERAL) {
      await sb.from('user_health_profile').delete().eq('user_id', USER_ID);
      await sb.from('user_profiles').delete().eq('user_id', USER_ID);
    } else {
      await sb.from('user_health_profile').upsert({
        user_id:   USER_ID,
        symptoms:  savedSymptoms,
        physical:  savedPhysical,
        lifestyle: savedLifestyle,
      }, { onConflict: 'user_id' });
    }
    console.log(`\n  ${EPHEMERAL ? 'Ephemeral rows deleted ✓' : 'State restored ✓'}`);
  }

  console.log('\n' + '═'.repeat(64));
  console.log('  TRACER DONE');
  console.log('═'.repeat(64));
}

await run();
