// tracer_vstat.mjs — runtime tracer for vstat_ze_zeme ASK loop
// Simulates the exact second request: pending_question=vstat_ze_zeme, user says "Ano"
// Run: node --env-file=.env.local scripts/tracer_vstat.mjs [userId]
//
// Without userId: creates an ephemeral UID seeded with a sedentary profile, deleted in finally.
// With userId:    operates on that user's existing DB state (saves/restores physical).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { applyHealthEvent, EVIDENCE_STORAGE_REGISTRY } from '../api/engine/healthEventAdapter.js';
import { buildEvent, processInput }                    from '../api/engine/orchestrator.js';
import { runEngine }                                   from '../api/engine/engine.js';

const sb       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID  = process.argv[2] || `test-vstat-${Date.now()}`;
const EPHEMERAL = !process.argv[2];

const SEED_HP = {
  physical: { sedentary_hours_day: 8, steps_day: 4000 },
  diagnoses: [], symptoms: [], medications: [], lifestyle: {},
};
const SEED_UP = { birth_year: 1975 };

function sep(s) { console.log(`\n${'─'.repeat(64)}\n  ${s}\n${'─'.repeat(64)}`); }

async function run() {
  let savedPhysical = {};

  if (EPHEMERAL) {
    await sb.from('user_health_profile').upsert({ user_id: USER_ID, ...SEED_HP }, { onConflict: 'user_id' });
    await sb.from('user_profiles').upsert({ user_id: USER_ID, ...SEED_UP }, { onConflict: 'user_id' });
    savedPhysical = { ...SEED_HP.physical };
  } else {
    // ── Step 0: Save state ────────────────────────────────────────────────────
    const { data: origRow } = await sb.from('user_health_profile').select('physical').eq('user_id', USER_ID).maybeSingle();
    savedPhysical = origRow?.physical ?? {};
    console.log('Saved physical for restore.');
  }

  try {
    // ── Step 1: Seed — clear vstat_ze_zeme ───────────────────────────────────
    sep('STEP 1 — seed: clear vstat_ze_zeme');
    const seedPhysical = { ...savedPhysical };
    delete seedPhysical.vstat_ze_zeme;
    if (seedPhysical.evidence_availability?.vstat_ze_zeme) {
      delete seedPhysical.evidence_availability.vstat_ze_zeme;
    }
    await sb.from('user_health_profile').upsert({ user_id: USER_ID, physical: seedPhysical }, { onConflict: 'user_id' });
    console.log('  vstat_ze_zeme cleared from physical.');

    // ── Step 2: First engine run ──────────────────────────────────────────────
    sep('STEP 2 — baseline: run engine without vstat_ze_zeme');
    const baseline = await runEngine(USER_ID);
    const baselineNbe = baseline.information_needs?.find(n => n.evidence_type === 'vstat_ze_zeme');
    console.log(`  information_needs[vstat_ze_zeme]: ${baselineNbe ? JSON.stringify({ evidence_type: baselineNbe.evidence_type, acquisition_method: baselineNbe.acquisition_method }) : 'NOT PRESENT'}`);
    console.log(`  baseline DD mode: ${baseline.daily_decision?.mode}`);
    if (!baselineNbe) {
      console.log('  ⚠  vstat_ze_zeme not in NBE baseline — test may not be meaningful');
    }

    // ── Step 3: Simulate pending_question ─────────────────────────────────────
    sep('STEP 3 — session.pending_question');
    const sessionState = {
      pending_question: {
        text:          'Dokážeš vstát ze země bez opory rukou?',
        evidence_type: 'vstat_ze_zeme',
        type:          'NEXT_BEST_EVIDENCE',
      },
      current_action_assignment: null,
      last_daily_decision:       baseline.daily_decision ?? null,
      last_domain_response:      null,
    };
    console.log('  pending_question:', JSON.stringify(sessionState.pending_question, null, 2));

    // ── Step 4: processInput flow ─────────────────────────────────────────────
    sep('STEP 4 — classifyIntent("Ano")');
    const userText = 'Ano';
    console.log(`  user text: "${userText}"`);
    console.log('  Calling processInput to capture full flow...');

    sep('STEP 5 — processInput("Ano") with pending_question=vstat_ze_zeme');
    const { data: preRow } = await sb.from('user_health_profile').select('physical').eq('user_id', USER_ID).maybeSingle();
    console.log(`  BEFORE: physical.vstat_ze_zeme = ${JSON.stringify(preRow?.physical?.vstat_ze_zeme)}`);
    console.log(`  BEFORE: physical.evidence_availability = ${JSON.stringify(preRow?.physical?.evidence_availability)}`);

    const response = await processInput(USER_ID, userText, sessionState);

    const { data: postRow } = await sb.from('user_health_profile').select('physical').eq('user_id', USER_ID).maybeSingle();
    console.log(`\n  AFTER: physical.vstat_ze_zeme = ${JSON.stringify(postRow?.physical?.vstat_ze_zeme)}`);
    console.log(`  AFTER: physical.evidence_availability = ${JSON.stringify(postRow?.physical?.evidence_availability)}`);
    console.log('\n  response.mode:', response.mode);
    console.log('  response.text:', response.text?.slice(0, 120));
    console.log('  response.expects_reply:', response.expects_reply);
    console.log('  response.debug:', JSON.stringify(response.debug));
    console.log('  session_updates.pending_question:', JSON.stringify(response.session_updates?.pending_question));
    console.log('  session_updates.current_action_assignment:', JSON.stringify(response.session_updates?.current_action_assignment));

    // ── Step 6: Fresh engine run ──────────────────────────────────────────────
    sep('STEP 6 — fresh engine run after processInput');
    const after = await runEngine(USER_ID);
    const afterNbe = after.information_needs?.find(n => n.evidence_type === 'vstat_ze_zeme');
    console.log(`  information_needs[vstat_ze_zeme]: ${afterNbe ? JSON.stringify({ evidence_type: afterNbe.evidence_type, acquisition_method: afterNbe.acquisition_method, needed_for: afterNbe.needed_for }) : 'absent ✓'}`);
    console.log(`  after DD mode: ${after.daily_decision?.mode}`);
    console.log(`  after DD reason_code: ${after.daily_decision?.reason_code}`);
    if (after.information_needs?.length > 0) {
      console.log('\n  ALL information_needs:');
      for (const n of after.information_needs) {
        console.log(`    ${n.evidence_type} (${n.acquisition_method}, urgency=${n.urgency})`);
      }
    }

    // ── Step 7: Registry contract ─────────────────────────────────────────────
    sep('STEP 7 — EVIDENCE_STORAGE_REGISTRY[vstat_ze_zeme]');
    const regEntry = EVIDENCE_STORAGE_REGISTRY['vstat_ze_zeme'];
    console.log('  registry entry:', JSON.stringify(regEntry));
    console.log('  tracks_availability:', regEntry?.tracks_availability ?? 'false (not set)');
    console.log('  evidence_kind:', regEntry?.evidence_kind ?? '(not set)');

    // ── Step 8: buildEvent unit check ─────────────────────────────────────────
    sep('STEP 8 — buildEvent unit: ANSWER with and without evidence_type in classifier payload');
    const sessionForBuild = { pending_question: { evidence_type: 'vstat_ze_zeme', text: '...' } };
    const eventA = buildEvent({ event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { value: 'Ano' } }, sessionForBuild);
    console.log('  Case A (classifier omits evidence_type):');
    console.log('    event.payload.evidence_type:', eventA.payload.evidence_type);
    console.log('    event.payload.value:', eventA.payload.value);
    const eventB = buildEvent({ event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { evidence_type: 'vstat_ze_zeme', value: 'Ano' } }, sessionForBuild);
    console.log('  Case B (classifier includes evidence_type):');
    console.log('    event.payload.evidence_type:', eventB.payload.evidence_type);
    console.log('    event.payload.value:', eventB.payload.value);

  } finally {
    if (EPHEMERAL) {
      await sb.from('user_health_profile').delete().eq('user_id', USER_ID);
      await sb.from('user_profiles').delete().eq('user_id', USER_ID);
    } else {
      await sb.from('user_health_profile').upsert({ user_id: USER_ID, physical: savedPhysical }, { onConflict: 'user_id' });
    }
    console.log(`\n  ${EPHEMERAL ? 'Ephemeral rows deleted ✓' : 'State restored ✓'}`);
  }

  console.log('\n' + '═'.repeat(64));
  console.log('  TRACER DONE');
  console.log('═'.repeat(64));
}

await run();
