// test-raw-value-validation.mjs — ALPHA STOP #5A regression: RAW_VALUE typed grammar
//
// Proves that invalid/non-numeric input is rejected before both writes:
//   upsertPhysical + upsertEvidenceAvailability('AVAILABLE') are both blocked.
//
// Section 1 — parse unit tests: chair_stand_30s / tug_test / grip_strength
//   accepted and rejected examples per the typed grammar contract
// Section 2 — end-to-end via applyHealthEvent: corruption cases now blocked
//   (proven corrupted in STOP #5A proof — must now return warning, no DB write)
// Section 3 — valid values accepted and written with correct type (number, not string)
// Section 4 — NOT_AVAILABLE path unchanged (classifyAvailability short-circuits before parse)
//
// Run: node --env-file=.env.local scripts/test-raw-value-validation.mjs

import { createClient } from '@supabase/supabase-js';

const { applyHealthEvent, EVIDENCE_STORAGE_REGISTRY, classifyAvailability } =
  await import('../api/engine/healthEventAdapter.js');

const sb        = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const FAKE_USER = `test-rvv-${Date.now()}`;

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(l) { console.log(`\n${'─'.repeat(64)}\n  ${l}\n${'─'.repeat(64)}`); }

// ── Section 1: parse unit tests (no DB) ──────────────────────────────────────

sep('chair_stand_30s — parse (non-negative integer, strict)');

{
  const { parse } = EVIDENCE_STORAGE_REGISTRY.chair_stand_30s;

  // Accepted
  check(parse('0')   === 0,  'parse("0") = 0  — zero valid (cannot stand)');
  check(parse('1')   === 1,  'parse("1") = 1');
  check(parse('14')  === 14, 'parse("14") = 14');

  // Rejected — full-string numeric contract
  check(parse('3.7')              === null, 'parse("3.7") = null  — decimal not integer');
  check(parse('14,0')             === null, 'parse("14,0") = null — decimal comma not integer');
  check(parse('12 reps')          === null, 'parse("12 reps") = null — unit-bearing string');
  check(parse('12 ')              === 12,   'parse("12 ") = 12  — trailing space trimmed before validation');
  check(parse('-5')               === null, 'parse("-5") = null — negative');
  check(parse('Nemůžu ho teď udělat.') === null, 'parse("Nemůžu ho teď udělat.") = null — garbage');
  check(parse('abc')              === null, 'parse("abc") = null — arbitrary text');
  check(parse('')                 === null, 'parse("") = null — empty string');
}

sep('tug_test — parse (positive float, comma/period accepted, strict)');

{
  const { parse } = EVIDENCE_STORAGE_REGISTRY.tug_test;

  // Accepted
  check(parse('12')   === 12,   'parse("12") = 12');
  check(parse('12.4') === 12.4, 'parse("12.4") = 12.4');
  check(parse('12,4') === 12.4, 'parse("12,4") = 12.4 — comma converted');
  check(parse('9')    === 9,    'parse("9") = 9');

  // Rejected
  check(parse('0')                    === null, 'parse("0") = null — zero not valid for time');
  check(parse('-5')                   === null, 'parse("-5") = null — negative');
  check(parse('14.2s')                === null, 'parse("14.2s") = null — unit letter appended');
  check(parse('Nemůžu ho teď udělat.') === null, 'parse("Nemůžu ho teď udělat.") = null — garbage');
  check(parse('nevím')                === null, 'parse("nevím") = null — text');
  check(parse('abc')                  === null, 'parse("abc") = null — arbitrary text');
  check(parse('')                     === null, 'parse("") = null — empty string');
}

sep('grip_strength — parse (positive float, same as tug_test, unit strings rejected)');

{
  const { parse } = EVIDENCE_STORAGE_REGISTRY.grip_strength;

  // Accepted
  check(parse('25')    === 25,   'parse("25") = 25');
  check(parse('25.3')  === 25.3, 'parse("25.3") = 25.3');
  check(parse('25,3')  === 25.3, 'parse("25,3") = 25.3 — comma converted');

  // Rejected
  check(parse('25 kg')               === null, 'parse("25 kg") = null — unit-bearing string rejected');
  check(parse('0')                   === null, 'parse("0") = null — zero not valid for force');
  check(parse('-5')                  === null, 'parse("-5") = null — negative');
  check(parse('Nemůžu ho teď udělat.') === null, 'parse("Nemůžu ho teď udělat.") = null — garbage');
  check(parse('później')             === null, 'parse("później") = null — Polish deferred');
  check(parse('abc')                 === null, 'parse("abc") = null — arbitrary text');
}

// ── Section 2: end-to-end — corruption cases now blocked ─────────────────────

await sb.from('user_profiles').upsert(
  { user_id: FAKE_USER, birth_year: 1959, gender: 'female' },
  { onConflict: 'user_id' }
);
await sb.from('user_health_profile').upsert(
  { user_id: FAKE_USER, physical: { vynest_nakup: false, vstat_ze_zeme: true, recent_falls: false } },
  { onConflict: 'user_id' }
);

async function readPhysical() {
  const { data } = await sb.from('user_health_profile').select('physical').eq('user_id', FAKE_USER).maybeSingle();
  return data?.physical ?? {};
}

async function resetPhysical() {
  await sb.from('user_health_profile').upsert(
    { user_id: FAKE_USER, physical: { vynest_nakup: false, vstat_ze_zeme: true, recent_falls: false } },
    { onConflict: 'user_id' }
  );
}

async function applyAnswer(evidence_type, value) {
  return applyHealthEvent(FAKE_USER, {
    event_type: 'ANSWER_TO_EVIDENCE_QUESTION',
    event_id:   crypto.randomUUID(),
    source:     'text',
    timestamp:  new Date().toISOString(),
    payload:    { evidence_type, value },
  });
}

sep('E2E — "Nemůžu ho teď udělat." for chair_stand_30s → no write (was corruption)');

{
  const r  = await applyAnswer('chair_stand_30s', 'Nemůžu ho teď udělat.');
  const ph = await readPhysical();
  const raw = ph['chair_stand_30s'];
  const ea  = ph?.evidence_availability?.['chair_stand_30s'];

  console.log(`  persistence_status             : ${r.persistence_status}`);
  console.log(`  warnings                       : ${JSON.stringify(r.warnings)}`);
  console.log(`  physical.chair_stand_30s       : ${JSON.stringify(raw)}`);
  console.log(`  evidence_availability.c30s     : ${ea}`);

  check(r.persistence_status === 'ok',
    'persistence_status = ok (adapter does not throw on invalid)');
  check(r.warnings?.some(w => w.includes('chair_stand_30s')),
    `warnings[] contains chair_stand_30s entry (got: ${JSON.stringify(r.warnings)})`);
  check(raw === undefined || raw === null,
    `physical.chair_stand_30s NOT written (got: ${JSON.stringify(raw)})`);
  check(ea === undefined || ea === null,
    `evidence_availability.chair_stand_30s NOT written (got: ${ea})`);
  await resetPhysical();
}

sep('E2E — "abc" for chair_stand_30s → no write');

{
  const r  = await applyAnswer('chair_stand_30s', 'abc');
  const ph = await readPhysical();
  const raw = ph['chair_stand_30s'];
  const ea  = ph?.evidence_availability?.['chair_stand_30s'];

  check(raw === undefined || raw === null, `"abc" NOT written as chair_stand_30s (got: ${JSON.stringify(raw)})`);
  check(ea  === undefined || ea === null,  `AVAILABLE NOT written for "abc" (got: ${ea})`);
  await resetPhysical();
}

sep('E2E — "później" for grip_strength → no write (was corruption)');

{
  const r  = await applyAnswer('grip_strength', 'później');
  const ph = await readPhysical();
  const raw = ph['grip_strength'];
  const ea  = ph?.evidence_availability?.['grip_strength'];

  check(raw === undefined || raw === null, `"później" NOT written as grip_strength (got: ${JSON.stringify(raw)})`);
  check(ea  === undefined || ea === null,  `AVAILABLE NOT written for "później" (got: ${ea})`);
  await resetPhysical();
}

sep('E2E — "14.2s" for tug_test → no write (was corruption)');

{
  const r  = await applyAnswer('tug_test', '14.2s');
  const ph = await readPhysical();
  const raw = ph['tug_test'];
  const ea  = ph?.evidence_availability?.['tug_test'];

  check(raw === undefined || raw === null, `"14.2s" NOT written as tug_test (got: ${JSON.stringify(raw)})`);
  check(ea  === undefined || ea === null,  `AVAILABLE NOT written for "14.2s" (got: ${ea})`);
  await resetPhysical();
}

sep('E2E — "25 kg" for grip_strength → no write (Alpha: unit strings rejected)');

{
  const r  = await applyAnswer('grip_strength', '25 kg');
  const ph = await readPhysical();
  const raw = ph['grip_strength'];
  const ea  = ph?.evidence_availability?.['grip_strength'];

  check(raw === undefined || raw === null, `"25 kg" NOT written as grip_strength (got: ${JSON.stringify(raw)})`);
  check(ea  === undefined || ea === null,  `AVAILABLE NOT written for "25 kg" (got: ${ea})`);
  await resetPhysical();
}

// ── Section 3: valid values accepted, written as numbers ─────────────────────

sep('E2E — valid values accepted and stored as number (not string)');

{
  const r = await applyAnswer('chair_stand_30s', '14');
  const ph = await readPhysical();
  const raw = ph['chair_stand_30s'];
  const ea  = ph?.evidence_availability?.['chair_stand_30s'];

  check(raw === 14,         `"14" written as number 14, not string (got: ${JSON.stringify(raw)})`);
  check(ea  === 'AVAILABLE', `evidence_availability.chair_stand_30s = AVAILABLE (got: ${ea})`);
  await resetPhysical();
}

{
  const r = await applyAnswer('tug_test', '12,4');
  const ph = await readPhysical();
  const raw = ph['tug_test'];
  const ea  = ph?.evidence_availability?.['tug_test'];

  check(raw === 12.4,        `"12,4" written as 12.4 (number, comma converted) (got: ${JSON.stringify(raw)})`);
  check(ea  === 'AVAILABLE', `evidence_availability.tug_test = AVAILABLE (got: ${ea})`);
  await resetPhysical();
}

{
  const r = await applyAnswer('grip_strength', '25.3');
  const ph = await readPhysical();
  const raw = ph['grip_strength'];
  const ea  = ph?.evidence_availability?.['grip_strength'];

  check(raw === 25.3,        `"25.3" written as 25.3 (number) (got: ${JSON.stringify(raw)})`);
  check(ea  === 'AVAILABLE', `evidence_availability.grip_strength = AVAILABLE (got: ${ea})`);
  await resetPhysical();
}

{
  const r = await applyAnswer('chair_stand_30s', '0');
  const ph = await readPhysical();
  const raw = ph['chair_stand_30s'];

  check(raw === 0, `"0" written as 0 — zero valid for chair_stand (cannot stand) (got: ${JSON.stringify(raw)})`);
  await resetPhysical();
}

// ── Section 4: NOT_AVAILABLE path unchanged ───────────────────────────────────

sep('E2E — NOT_AVAILABLE path: classifyAvailability short-circuits, parse not reached');

{
  const r = await applyAnswer('tug_test', 'nevím');
  const ph = await readPhysical();
  const raw = ph['tug_test'];
  const ea  = ph?.evidence_availability?.['tug_test'];

  check(raw === undefined || raw === null, `"nevím" → no raw value for tug_test (got: ${JSON.stringify(raw)})`);
  check(ea  === 'NOT_AVAILABLE',           `"nevím" → evidence_availability = NOT_AVAILABLE (got: ${ea})`);
  await resetPhysical();
}

{
  const r = await applyAnswer('chair_stand_30s', 'Ne, nemám.');
  const ph = await readPhysical();
  const raw = ph['chair_stand_30s'];
  const ea  = ph?.evidence_availability?.['chair_stand_30s'];

  check(raw === undefined || raw === null, `"Ne, nemám." → no raw value for chair_stand_30s (got: ${JSON.stringify(raw)})`);
  check(ea  === 'NOT_AVAILABLE',           `"Ne, nemám." → NOT_AVAILABLE (got: ${ea})`);
  await resetPhysical();
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

await sb.from('user_health_profile').delete().eq('user_id', FAKE_USER);
await sb.from('user_profiles').delete().eq('user_id', FAKE_USER);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(64)}\n`);
if (failed > 0) process.exit(1);
