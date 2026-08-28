// tracer_why_ux.mjs — trace WHY UX bug: ACT buttons disappear after WHY
// Repro: ACT → user: "Proč?" → EXPLAIN → Hotovo/Přeskočit chips gone
// Run: node --env-file=.env.local scripts/tracer_why_ux.mjs [userId]

// Ephemeral test UID seeded with sedentary profile; deleted in finally.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient }                              from '@supabase/supabase-js';
import { processInput, _buildSessionUpdates_test as buildSessionUpdates } from '../api/engine/orchestrator.js';
import { runEngine }                                 from '../api/engine/engine.js';
import { computeDailyDecision }                      from '../api/engine/dailyDecision.js';

const sb       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID  = process.argv[2] || `test-why-${Date.now()}`;
const EPHEMERAL = !process.argv[2];

const SEED_HP = {
  physical: { sedentary_hours_day: 8, steps_day: 4000 },
  diagnoses: [], symptoms: [], medications: [], lifestyle: {},
};
const SEED_UP = { birth_year: 1975 };

function sep(s) { console.log(`\n${'─'.repeat(64)}\n  ${s}\n${'─'.repeat(64)}`); }

async function run() {
  if (EPHEMERAL) {
    await sb.from('user_health_profile').upsert({ user_id: USER_ID, ...SEED_HP }, { onConflict: 'user_id' });
    await sb.from('user_profiles').upsert({ user_id: USER_ID, ...SEED_UP }, { onConflict: 'user_id' });
  }

// ── STEP 1: Get a real engine response ────────────────────────────────────────
sep('STEP 1 — engine run → get last_domain_response / last_daily_decision');

const engineResult = await runEngine(USER_ID);
const dd = computeDailyDecision(engineResult);
const dr = {
  daily_decision:      dd,
  explanation_context: {
    system_leverage:   engineResult.system_leverage?.selected   ?? null,
    system_constraint: engineResult.system_constraint?.selected ?? null,
    action_context:    engineResult.next_best_action            ?? null,
  },
  information_needs:   engineResult.information_needs ?? [],
  warnings:            [],
};

console.log('  engine DD mode:', dd.mode, ' reason_code:', dd.reason_code);
console.log('  primary_item label:', dd.primary_item?.label ?? '—');
console.log('  system_leverage:', engineResult.system_leverage?.selected?.node_id ?? '—');

// ── STEP 2: Synthesise ACT session state ──────────────────────────────────────
sep('STEP 2 — synthesise session after ACT presentation');

// Simulate what buildSessionUpdates would produce for an ACT response
const actSessionUpdates = buildSessionUpdates('DOMAIN_REQUEST', {}, { domain_response: dr, warnings: [] });
console.log('  actSessionUpdates.current_action_assignment:', JSON.stringify(actSessionUpdates.current_action_assignment));

// This is what session looks like right after ACT is shown to user
const sessionAfterAct = {
  current_action_assignment: actSessionUpdates.current_action_assignment,
  last_daily_decision:       actSessionUpdates.last_daily_decision,
  last_domain_response:      actSessionUpdates.last_domain_response,
  pending_question:          null,
};

// 1. session.current_action_assignment after ACT
console.log('\n  [Q1] session.current_action_assignment after ACT:');
console.log('       ', JSON.stringify(sessionAfterAct.current_action_assignment));

// 2. session.last_daily_decision after ACT
console.log('\n  [Q2] session.last_daily_decision.mode:', sessionAfterAct.last_daily_decision?.mode ?? '—');
console.log('       primary_item.action_id:', sessionAfterAct.last_daily_decision?.primary_item?.action_id ?? '—');

// ── STEP 3: WHY request → what does processInput return? ─────────────────────
sep('STEP 3 — processInput("Proč?", session=after ACT)');

const whyResponse = await processInput(USER_ID, 'Proč?', sessionAfterAct);

// 3. WHY response buttons
console.log('\n  [Q3] buildWhyResponse() buttons:', JSON.stringify(whyResponse.buttons));
console.log('       mode:', whyResponse.mode);
console.log('       text:', whyResponse.text?.slice(0, 120));
console.log('       expects_reply:', whyResponse.expects_reply);
console.log('       debug.source:', whyResponse.debug?.source ?? '—');

// 4. session_updates from WHY
console.log('\n  [Q4] WHY session_updates:', JSON.stringify(whyResponse.session_updates));
const sessionAfterWhy = { ...sessionAfterAct, ...whyResponse.session_updates };
console.log('\n  [Q4] session after WHY merge:');
console.log('       current_action_assignment:', JSON.stringify(sessionAfterWhy.current_action_assignment));
console.log('       last_daily_decision.mode:', sessionAfterWhy.last_daily_decision?.mode ?? '—');
console.log('       last_domain_response present:', !!sessionAfterWhy.last_domain_response);
console.log('       pending_question:', JSON.stringify(sessionAfterWhy.pending_question));

// 5. Can we safely show Hotovo/Přeskočit after WHY?
const assignmentSurvives = sessionAfterWhy.current_action_assignment?.action_id != null;
const ddSurvives         = sessionAfterWhy.last_daily_decision?.mode === 'ACT';
console.log('\n  [Q5] Is session intact after WHY for continuing ACT?');
console.log('       current_action_assignment survives:', assignmentSurvives);
console.log('       last_daily_decision.mode=ACT survives:', ddSurvives);
console.log('       Safe to re-render [Hotovo] [Přeskočit]:', assignmentSurvives || ddSurvives);

// ── STEP 4: Root cause summary ────────────────────────────────────────────────
sep('STEP 4 — root cause + proposed minimal fix');

console.log('  ROOT CAUSE:');
console.log('    buildWhyResponse returns buttons:[] unconditionally.');
console.log('    Launcher renders chips from response.buttons only — no fallback to session context.');
console.log('    Session state (current_action_assignment) is NOT corrupted by WHY');
console.log('    (session_updates={} → merge leaves existing session keys intact).');
console.log('    But saveLastResponse() caches EXPLAIN with buttons:[] so next render shows no chips.');
console.log();
console.log('  AFFECTED LAYER: presentation only (orchestrator.js buildWhyResponse, no engine).');
console.log();
console.log('  MINIMAL FIX (orchestrator.js, one line):');
console.log('    In buildWhyResponse(), if sessionState.current_action_assignment is set,');
console.log('    include buttons:[\'Hotovo\',\'Přeskočit\'] in the return value.');
console.log('    Zero impact on Engine / NBE / NBA / DD.');
console.log();
console.log('  SECONDARY (not blocking):');
console.log('    saveLastResponse() caches EXPLAIN → on page reload launcher shows EXPLAIN, not ACT.');
console.log('    Fix: also save action context so reload can restore ACT view.');
console.log('    Can be addressed in a follow-up (Fix 3 equivalent).');

  console.log('\n' + '═'.repeat(64));
  console.log('  TRACER DONE');
  console.log('═'.repeat(64));
} // end run()

try {
  await run();
} finally {
  if (EPHEMERAL) {
    await sb.from('user_health_profile').delete().eq('user_id', USER_ID);
    await sb.from('user_profiles').delete().eq('user_id', USER_ID);
  }
}
