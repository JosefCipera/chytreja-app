// test-waist-evidence-relocation.mjs — Regression test for the waist_cm/daily_checkin repair
//
// Context: daily_checkin never had a waist_cm column (never migrated). adapter.js's
// SELECT and healthEventAdapter's EVIDENCE_STORAGE_REGISTRY both referenced it anyway,
// which made the daily_checkin SELECT fail (400) and silently drop weight/activity/
// stress/sleep observations for every user. Fix: waist_cm is removed from the
// daily_checkin contract and routed to user_health_profile.lifestyle.waist_cm — the
// same JSONB key onboarding already writes and adapter.js already reads.
//
// Proves:
//   T1: adapter.js daily_checkin SELECT no longer references waist_cm
//   T2: a daily_checkin row (weight/activity/stress) survives the SELECT and produces
//       observations — the original reported bug is fixed
//   T3: ANSWER_TO_EVIDENCE_QUESTION waist_cm=102 persists to lifestyle.waist_cm
//   T4: other existing lifestyle keys are preserved by the merge (not clobbered)
//   T5: adapter.js turns lifestyle.waist_cm into a waist_cm observation
//   T6: EXCESS_ADIPOSITY.missing_evidence no longer lists waist_cm once answered
//   T7: information_needs (NBE) no longer offers waist_cm — no re-ask
//   T8: NEW_MEASUREMENT waist_cm lands in the same store (lifestyle), not a third one
//   T9: EVIDENCE_STORAGE_REGISTRY for other daily_checkin evidence types is unchanged
//
// Run: node --env-file=.env.local scripts/test-waist-evidence-relocation.mjs
// Uses an ephemeral user_id — never touches real user data.

import { createClient }   from '@supabase/supabase-js';
import { readFileSync }   from 'fs';
import { fileURLToPath }  from 'url';
import { dirname, join }  from 'path';
import { applyHealthEvent, EVIDENCE_STORAGE_REGISTRY } from '../api/engine/healthEventAdapter.js';
import { runEngine } from '../api/engine/engine.js';
import { fetchHealthData } from '../api/engine/adapter.js';

const __dir = dirname(fileURLToPath(import.meta.url));

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(64)}\n  ${label}\n${'─'.repeat(64)}`); }

const sb      = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const USER_ID = `test-waist-${Date.now()}`;
const TODAY   = new Date().toISOString().slice(0, 10);

// ── T1: SELECT no longer references waist_cm ──────────────────────────────────

sep('T1 — adapter.js daily_checkin SELECT no longer requests waist_cm');
{
  const src = readFileSync(join(__dir, '../api/engine/adapter.js'), 'utf8');
  const selectMatch = src.match(/from\('daily_checkin'\)\s*\n?\s*\.select\('([^']+)'\)/);
  check(selectMatch != null, 'daily_checkin .select(...) call found in adapter.js');
  const cols = (selectMatch?.[1] || '').split(',').map(s => s.trim());
  check(!cols.includes('waist_cm'), 'waist_cm is not among the selected columns', `columns: ${cols.join(', ')}`);
  check(cols.includes('weight_kg') && cols.includes('movement_level') && cols.includes('stress') && cols.includes('sleep_hours'),
    'weight_kg, movement_level, stress, sleep_hours are still selected');
}

// ── Seed: user_profiles (BMI >= 25 trigger) + user_health_profile.lifestyle + daily_checkin row ──

await sb.from('user_profiles').upsert(
  { user_id: USER_ID, birth_year: 1975, gender: 'male', height: 170, weight: 80 }, // BMI ≈ 27.7
  { onConflict: 'user_id' }
);
await sb.from('user_health_profile').upsert(
  { user_id: USER_ID, lifestyle: { smoking: false, alcohol: 'none' }, physical: {}, diagnoses: [], symptoms: [], medications: [], labs: {} },
  { onConflict: 'user_id' }
);
await sb.from('daily_checkin').upsert(
  { user_id: USER_ID, date: TODAY, universe: 'longevity', weight_kg: 78, movement_level: 'medium', stress: 3, sleep_hours: 7 },
  { onConflict: 'user_id,date,universe' }
);

// ── T2: check-in survives the SELECT and produces observations (the original bug) ──

sep('T2 — daily_checkin row (weight/activity/stress) survives the SELECT and produces observations');
{
  const { observations } = await fetchHealthData(USER_ID);
  check(observations.some(o => o.obs_type === 'weight_kg' && o.source === 'daily_checkin' && o.value === 78),
    'weight_kg observation from daily_checkin present (78 kg)');
  check(observations.some(o => o.obs_type === 'activity_level' && o.source === 'daily_checkin' && o.value === 'medium'),
    'activity_level observation from daily_checkin present (medium)');
  check(observations.some(o => o.obs_type === 'stress_1_5' && o.source === 'daily_checkin' && o.value === 3),
    'stress_1_5 observation from daily_checkin present (3)');
  // sleep_hours has no observation mapping in adapter.js today (pre-existing gap, out of scope
  // for this fix) — we only assert the query itself did not fail, which it would have with
  // waist_cm still in the SELECT.
}

// ── T3+T4: ANSWER_TO_EVIDENCE_QUESTION waist_cm=102 → lifestyle.waist_cm, other keys preserved ──

sep('T3+T4 — ANSWER waist_cm=102 → user_health_profile.lifestyle.waist_cm, other lifestyle keys preserved');
{
  const event = {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload:    { evidence_type: 'waist_cm', value: 102 },
  };
  const result = await applyHealthEvent(USER_ID, event);

  check(result.persistence_status === 'ok', 'persistence_status = ok', JSON.stringify(result.warnings));
  check(!(result.warnings || []).some(w => typeof w === 'string' && w.includes('unknown evidence_type')),
    'no "unknown evidence_type" warning');

  const { data: hp } = await sb.from('user_health_profile').select('lifestyle').eq('user_id', USER_ID).maybeSingle();
  check(hp?.lifestyle?.waist_cm === 102, 'lifestyle.waist_cm = 102', `actual: ${hp?.lifestyle?.waist_cm}`);
  check(hp?.lifestyle?.smoking === false, 'pre-existing lifestyle.smoking preserved');
  check(hp?.lifestyle?.alcohol === 'none', 'pre-existing lifestyle.alcohol preserved');
}

// ── T5: adapter turns lifestyle.waist_cm into an observation ──────────────────

sep('T5 — adapter.js exposes lifestyle.waist_cm as a waist_cm observation');
{
  const { observations } = await fetchHealthData(USER_ID);
  const waistObs = observations.find(o => o.obs_type === 'waist_cm');
  check(waistObs != null, 'waist_cm observation present');
  check(waistObs?.value === 102, 'waist_cm observation value = 102');
  check(waistObs?.source === 'onboarding', 'waist_cm observation source = onboarding');
}

// ── T6: EXCESS_ADIPOSITY.missing_evidence no longer lists waist_cm ────────────

sep('T6 — EXCESS_ADIPOSITY.missing_evidence no longer contains waist_cm');
{
  const engineResult = await runEngine(USER_ID);
  const adiposity = engineResult.node_states?.find(s => s.node_id === 'EXCESS_ADIPOSITY');
  check(adiposity != null, 'EXCESS_ADIPOSITY node state present (BMI >= 25 trigger fired)');
  const stillMissing = adiposity?.missing_evidence?.some(m => m.obs_type === 'waist_cm');
  check(!stillMissing, 'EXCESS_ADIPOSITY.missing_evidence does not list waist_cm',
    JSON.stringify(adiposity?.missing_evidence));
  check(adiposity?.confidence === 'medium', 'EXCESS_ADIPOSITY confidence upgraded to medium (waist confirms BMI)',
    `actual: ${adiposity?.confidence}`);

  // ── T7: information_needs (NBE) no longer offers waist_cm ──────────────────
  sep('T7 — information_needs (NBE) no longer offers waist_cm — no re-ask');
  const waistNeed = engineResult.information_needs?.find(n => n.evidence_type === 'waist_cm');
  check(waistNeed == null, 'no information_need for waist_cm', JSON.stringify(waistNeed));
}

// ── T8: NEW_MEASUREMENT waist_cm lands in the same store (lifestyle) ──────────

sep('T8 — NEW_MEASUREMENT waist_cm=105 lands in lifestyle.waist_cm, not a third store');
{
  const event = {
    event_type: 'NEW_MEASUREMENT',
    event_id:   crypto.randomUUID(),
    source:     'voice',
    timestamp:  new Date().toISOString(),
    payload:    { obs_type: 'waist_cm', value: 105 },
  };
  const result = await applyHealthEvent(USER_ID, event);
  check(result.persistence_status === 'ok', 'persistence_status = ok', JSON.stringify(result.warnings));

  const { data: hp } = await sb.from('user_health_profile').select('lifestyle').eq('user_id', USER_ID).maybeSingle();
  check(hp?.lifestyle?.waist_cm === 105, 'lifestyle.waist_cm updated to 105 via NEW_MEASUREMENT', `actual: ${hp?.lifestyle?.waist_cm}`);
  check(hp?.lifestyle?.smoking === false, 'lifestyle.smoking still preserved after second write');

  const { data: bio } = await sb.from('user_biometrics').select('id').eq('user_id', USER_ID);
  check(!bio || bio.length === 0, 'no row written to user_biometrics (no third store introduced)');

  const { data: checkinRow } = await sb.from('daily_checkin').select('*').eq('user_id', USER_ID).eq('date', TODAY).maybeSingle();
  check(checkinRow != null && !('waist_cm' in checkinRow), 'daily_checkin row has no waist_cm key');
}

// ── T9: registry for other daily_checkin evidence types is unchanged ─────────

sep('T9 — EVIDENCE_STORAGE_REGISTRY for other daily_checkin evidence types is unchanged');
{
  check(EVIDENCE_STORAGE_REGISTRY.weight_kg?.table === 'daily_checkin' && EVIDENCE_STORAGE_REGISTRY.weight_kg?.key === 'weight_kg',
    'weight_kg still → daily_checkin.weight_kg');
  check(EVIDENCE_STORAGE_REGISTRY.activity_level?.table === 'daily_checkin' && EVIDENCE_STORAGE_REGISTRY.activity_level?.key === 'movement_level',
    'activity_level still → daily_checkin.movement_level');
  check(EVIDENCE_STORAGE_REGISTRY.stress_1_5?.table === 'daily_checkin' && EVIDENCE_STORAGE_REGISTRY.stress_1_5?.key === 'stress',
    'stress_1_5 still → daily_checkin.stress');
  check(EVIDENCE_STORAGE_REGISTRY.sleep_hours?.table === 'daily_checkin' && EVIDENCE_STORAGE_REGISTRY.sleep_hours?.key === 'sleep_hours',
    'sleep_hours still → daily_checkin.sleep_hours');
  check(EVIDENCE_STORAGE_REGISTRY.waist_cm?.table === 'lifestyle' && EVIDENCE_STORAGE_REGISTRY.waist_cm?.key === 'waist_cm',
    'waist_cm now → lifestyle.waist_cm');
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

await sb.from('daily_checkin').delete().eq('user_id', USER_ID);
await sb.from('user_health_profile').delete().eq('user_id', USER_ID);
await sb.from('user_profiles').delete().eq('user_id', USER_ID);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(64)}\n`);
if (failed > 0) process.exit(1);
