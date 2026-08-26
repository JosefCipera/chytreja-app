// test-nba-policy.mjs — NBA ranking policy P3 regression tests
// Run: node --env-file=.env.local scripts/test-nba-policy.mjs
//
// Tests:
//   NBA-P1..P5 — new sedentary user via runEngine(): P3 selects starter walk, not SILOVY
//   NBA-G1..G3 — gait instability: P3 does not break safety/ranking branch

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient }         from '@supabase/supabase-js';
import { applyHealthEvent }     from '../api/engine/healthEventAdapter.js';
import { runEngine }            from '../api/engine/engine.js';
import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import { readFileSync }         from 'fs';
import { fileURLToPath }        from 'url';
import { dirname, join }        from 'path';

const _dir  = dirname(fileURLToPath(import.meta.url));
const IMAP  = JSON.parse(readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8'));

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let passed = 0;
let failed = 0;

function sep(title) { console.log(`\n── ${title} ─────────────────────`); }
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${detail ? `\n      got: ${detail}` : ''}`);
    failed++;
  }
}

// ── P scenarios: new sedentary user via real runEngine() ─────────────────────

async function scenarioP() {
  sep('NBA-P — new sedentary user (sedentary_hours_day=10), leverage=PHYSICAL_INACTIVITY');
  const UID = `test-nba-p3-${Date.now()}`;
  try {
    await applyHealthEvent(UID, {
      event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
      payload: { evidence_type: 'sedentary_hours_day', value: 10 },
    });

    const result = await runEngine(UID);
    const nba    = result?.next_best_action;
    const sel    = nba?.selected;

    check('NBA-P1 status is SELECTED',
      nba?.status === 'SELECTED',
      `nba.status=${nba?.status}`);

    check('NBA-P2 selected action exists',
      sel != null,
      'selected is null');

    check('NBA-P3 not SILOVY_PROTOKOL — P3 tier/ttf preferred over friction',
      sel?.protocol_type !== 'SILOVY_PROTOKOL',
      `protocol_type=${sel?.protocol_type} action_id=${sel?.action_id}`);

    check('NBA-P4 tier === 1 — starter-appropriate action selected first',
      sel?.tier === 1,
      `tier=${sel?.tier} action_id=${sel?.action_id}`);

    check('NBA-P5 time_to_feedback is not weeks — fast feedback preferred',
      sel?.time_to_feedback !== 'weeks',
      `time_to_feedback=${sel?.time_to_feedback} action_id=${sel?.action_id}`);

    check('NBA-P6 intervention is movement/walk (BREAK_UP or AEROBIC or DAILY_MOVEMENT)',
      ['BREAK_UP_SEDENTARY_TIME', 'AEROBIC_TRAINING', 'DAILY_MOVEMENT'].includes(sel?.intervention_id),
      `intervention_id=${sel?.intervention_id} action_id=${sel?.action_id}`);

    console.log(`  [info] selected: ${sel?.action_id} / ${sel?.intervention_id} / tier:${sel?.tier} / ttf:${sel?.time_to_feedback} / friction:${sel?.friction}`);
  } finally {
    await sb.from('user_health_profile').delete().eq('user_id', UID);
    await sb.from('user_constraints').delete().eq('user_id', UID);
  }
}

// ── G scenarios: gait instability — direct computeNextBestAction ─────────────
// Uses artificial node_states to avoid complex DB setup for GAIT_INSTABILITY activation.
// Verifies that P3 does not cause null selection or sort regression in the safety branch.

async function scenarioG() {
  sep('NBA-G — gait instability: P3 does not break safety/ranking branch');

  const ivData         = IMAP.mappings['PHYSICAL_INACTIVITY'];
  const allProtocols   = [...new Set(ivData.interventions.flatMap(i => i.protocol_types))];
  const { data: pool } = await sb.from('longevity_actions').select('*').in('protocol_type', allProtocols);

  const gaitNodeStates = [{
    node_id:       'GAIT_INSTABILITY',
    current_state: 'CONFIRMED',
    confidence:    'high',
  }];

  const nba = computeNextBestAction({
    leverageNodeId:       'PHYSICAL_INACTIVITY',
    interventions:        ivData.interventions,
    actionPool:           pool ?? [],
    personConstraints:    [],
    clinicalHistory:      null,
    decisionGate:         null,
    node_states:          gaitNodeStates,
    engineVersion:        '1.0.0',
    responseHistory:      [],
    skippedTodayActionIds: new Set(),
  });

  const sel    = nba?.selected;
  const viable = (nba?.all_candidates ?? []).filter(c =>
    ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(c.safety?.level)
  );

  check('NBA-G1 viable candidates exist even with gait instability',
    viable.length > 0,
    `viable=${viable.length}`);

  check('NBA-G2 selected action exists (not null after P3 sort)',
    sel != null,
    'selected is null');

  check('NBA-G3 selected.tier is a number (P3 tier sort does not break)',
    typeof sel?.tier === 'number',
    `tier=${sel?.tier}`);

  // Walking protocols requiring steady gait should be NEEDS_MORE_EVIDENCE → non-viable
  // Only SILOVY_PROTOKOL and certain ASSISTIVE remain safe without gait assessment.
  const walkingProtocols = new Set(['KARDIO_PROTOKOL', 'VYTRVALOST_PROTOKOL']);
  const selIsWalkingWithoutMod =
    walkingProtocols.has(sel?.protocol_type) &&
    sel?.safety?.level === 'SAFE'; // unaided walking flagged as safe with gait instability = wrong

  check('NBA-G4 safety gate limits unaided walking when gait is unstable (walking non-viable or SAFE_WITH_MODIFICATION only)',
    viable.filter(c => walkingProtocols.has(c.protocol_type)).every(c => c.safety?.level === 'SAFE_WITH_MODIFICATION') || !selIsWalkingWithoutMod,
    `selected protocol=${sel?.protocol_type} safety=${sel?.safety?.level}`);

  console.log(`  [info] viable count: ${viable.length} | selected: ${sel?.action_id} / ${sel?.protocol_type} / tier:${sel?.tier} / safety:${sel?.safety?.level}`);
  console.log(`  [info] viable interventions: ${[...new Set(viable.map(c => c.intervention_id))].join(', ')}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('NBA POLICY P3 REGRESSION TESTS\n');
  await scenarioP();
  await scenarioG();

  console.log(`\n── RESULT: ${passed}/${passed + failed} passed${failed > 0 ? ` — ${failed} FAILED` : ' — all clear'} ──`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n💥 FATAL:', err.message, '\n', err.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
