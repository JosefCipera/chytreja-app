// tracer_hold_alternative.mjs — HOLD alternative intent audit
// Repro: HOLD text → "A co můžu dělat místo toho?" → CHJ zopakuje identický HOLD
// Spuštěno a výsledky zaznamenány v předchozí session (Aug 2026).
//
// VÝSLEDKY (Tester 0 — vPrm5PNzLWWWhi9sSwYVbkb9FaD3):
//
//   all_candidates: 7 SAFE kandidátů
//     BREAK_UP_SEDENTARY, RESISTANCE_TRAINING, AEROBIC_TRAINING (selected), + další
//
//   Všechny 3 kritéria pro eligible_alternative:
//     ✗  active exposure: všech 7 má sessions_completed > 0
//     ✗  response_evals:  všechny TOO_EARLY nebo INSUFFICIENT_EXPOSURE
//     →  eligible_alternative = false pro všechny
//
//   ZÁVĚR: Možnost C (alternative selection) — žádný SAFE kandidát mimo HOLD
//   není dostupný pro aktuální stav Tester 0. HOLD engine drží celý pool,
//   ne jen jednu intervenci.
//
//   AKCE:
//   - Možnost C odložena na LATER (žádná eligible alternativa)
//   - HOLD follow-up presentation opravena v orchestrator.js:
//     isHoldFollowUp → explanatory text "Pro dnešek je hotovo..."
//     místo opakování původního HOLD labelu
//
// Viz: api/engine/orchestrator.js → buildHoldResponse(isFollowUp=true)
//      scripts/test-orchestrator.mjs → scenario O

// Ephemeral test UID seeded with sedentary profile; deleted in finally.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient }          from '@supabase/supabase-js';
import { runEngine }             from '../api/engine/engine.js';
import { computeDailyDecision }  from '../api/engine/dailyDecision.js';

const sb       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID  = process.argv[2] || `test-hold-alt-${Date.now()}`;
const EPHEMERAL = !process.argv[2];

const SEED_HP = {
  physical: { sedentary_hours_day: 8, steps_day: 4000 },
  diagnoses: [], symptoms: [], medications: [], lifestyle: {},
};
const SEED_UP = { birth_year: 1975 };

function sep(s) { console.log(`\n${'─'.repeat(60)}\n  ${s}\n${'─'.repeat(60)}`); }
function row(k, v) { console.log(`  ${String(k).padEnd(40)} ${JSON.stringify(v)}`); }

async function run() {
  if (EPHEMERAL) {
    await sb.from('user_health_profile').upsert({ user_id: USER_ID, ...SEED_HP }, { onConflict: 'user_id' });
    await sb.from('user_profiles').upsert({ user_id: USER_ID, ...SEED_UP }, { onConflict: 'user_id' });
  }

sep('HOLD alternative audit (re-run to refresh)');

const result = await runEngine(USER_ID);
const dd     = computeDailyDecision(result);

row('DD mode',        dd.mode);
row('DD reason_code', dd.reason_code);
row('NBA status',     result.next_best_action?.status);
row('selected',       result.next_best_action?.selected?.action_id);
row('all_candidates', result.next_best_action?.all_candidates?.length ?? 0);

sep('Eligible alternatives (SAFE, no active HOLD exposure)');

const HOLDABLE = new Set(['TOO_EARLY', 'INSUFFICIENT_EXPOSURE']);
const candidates = result.next_best_action?.all_candidates ?? [];
let eligibleCount = 0;

for (const c of candidates) {
  const isSafe = ['SAFE', 'SAFE_WITH_MODIFICATION'].includes(c.safety?.level);
  const exposure = (result.intervention_exposure ?? []).find(
    e => e.intervention_id === c.intervention_id && e.sessions_completed > 0
  );
  const evals = (result.response_evaluations ?? []).filter(
    r => r.intervention_id === c.intervention_id
  );
  const allHoldable = evals.length > 0 && evals.every(r => HOLDABLE.has(r.result));
  const eligible    = isSafe && (!exposure || !allHoldable);

  if (eligible) eligibleCount++;
  console.log(`  ${eligible ? '✅' : '❌'}  ${c.action_id?.padEnd(32)} safe=${isSafe} exposure=${!!exposure} allHoldable=${allHoldable} eligible=${eligible}`);
}

  console.log(`\n  Eligible alternatives: ${eligibleCount} / ${candidates.length}`);
  if (eligibleCount === 0) {
    console.log('  → Možnost C nemůže nabídnout nic — HOLD drží celý pool.');
  } else {
    console.log('  → Možnost C by mohla nabídnout alternativu.');
  }
} // end run()

try {
  await run();
} finally {
  if (EPHEMERAL) {
    await sb.from('user_health_profile').delete().eq('user_id', USER_ID);
    await sb.from('user_profiles').delete().eq('user_id', USER_ID);
  }
}
