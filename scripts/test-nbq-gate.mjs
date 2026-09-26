// scripts/test-nbq-gate.mjs
// Integration tests: NBQ gate — TRACE flow through the production connector.
//
// Tests evaluateGate() from api/lib/nbq/evidenceGate.js — the exact function
// called by api/orchestrate.js after processInput(). No mocking.
//
// Does NOT re-test T1–T10 (covered by test-nbq.mjs).
// Tests the session-based nbq_messages accumulation path that orchestrate.js uses.

import { evaluateGate } from '../api/lib/nbq/evidenceGate.js';

// ── Test infrastructure ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function check(condition, label) {
  if (condition) {
    results.push(`  ✅  ${label}`);
    passed++;
  } else {
    results.push(`  ❌  ${label}`);
    failed++;
  }
}

function sep(label) {
  results.push(`\n${'─'.repeat(60)}`);
  results.push(`  ${label}`);
  results.push('─'.repeat(60));
}

// ── TRACE: turn-by-turn session accumulation ──────────────────────────────────
// Replicates the TRACE scenario from test-nbq.mjs but uses the production
// evaluateGate() connector and accumulates nbq_messages as orchestrate.js does.

sep('TRACE: turn-by-turn session accumulation via evaluateGate');

let nbqMessages = [];

{
  // Turn 1: "Chci zhubnout." — empty session
  const r = evaluateGate(nbqMessages, 'Chci zhubnout.');
  check(r.outcome === 'OPEN_INFORMATION_NEED',
    'TRACE_G1: empty session → OPEN_INFORMATION_NEED');
  check(r.information_need === undefined || r.information_need === null,
    'TRACE_G1b: no specific information_need');
  check(r.hypothesisState.OBESITY          === 'UNKNOWN', 'TRACE_G1c: OBESITY UNKNOWN');
  check(r.hypothesisState.LOW_VO2MAX       === 'UNKNOWN', 'TRACE_G1d: LOW_VO2MAX UNKNOWN');

  // Simulate session accumulation: orchestrate.js appends user turn + gate question
  nbqMessages = [
    { role: 'user',      content: 'Chci zhubnout.' },
    { role: 'assistant', content: 'Co tě k tomu vede?' },
  ];
}

{
  // Turn 2: obesity + dyspnea
  const r = evaluateGate(nbqMessages, 'Mám nadváhu, zadýchávám se a necítím se dobře.');
  check(r.outcome === 'ASK',
    'TRACE_G2: obesity+dyspnea → ASK');
  check(r.information_need === 'dyspnea_character',
    'TRACE_G2b: information_need = dyspnea_character (priority 1 before activity)');
  check(r.hypothesisState.OBESITY    === 'POSSIBLE', 'TRACE_G2c: OBESITY POSSIBLE');
  check(r.hypothesisState.LOW_VO2MAX === 'POSSIBLE', 'TRACE_G2d: LOW_VO2MAX POSSIBLE');

  nbqMessages = [
    ...nbqMessages,
    { role: 'user',      content: 'Mám nadváhu, zadýchávám se a necítím se dobře.' },
    { role: 'assistant', content: 'Zadýcháváš se hlavně při pohybu, nebo i v klidu?' },
  ];
}

{
  // Turn 3: exertional qualifier
  const r = evaluateGate(nbqMessages, 'Hlavně při pohybu. Třeba když vyjdu dvě patra.');
  check(r.outcome === 'ASK',
    'TRACE_G3: exertional confirmed → ASK');
  check(r.information_need === 'activity_level',
    'TRACE_G3b: information_need = activity_level');
  check(r.hypothesisState.LOW_VO2MAX === 'SUPPORTED',
    'TRACE_G3c: LOW_VO2MAX SUPPORTED (dyspnea + exertional)');
  check(r.hypothesisState.SEDENTARY_LIFESTYLE_ROOT === 'POSSIBLE',
    'TRACE_G3d: SEDENTARY POSSIBLE via pattern inference');

  nbqMessages = [
    ...nbqMessages,
    { role: 'user',      content: 'Hlavně při pohybu. Třeba když vyjdu dvě patra.' },
    { role: 'assistant', content: 'Jak to máš s pohybem — sportuješ nějak pravidelně?' },
  ];
}

{
  // Turn 4 Sim A: activity answered → STOP_QUESTIONING → ACT may proceed
  const r = evaluateGate(
    nbqMessages,
    'Je to tak celé roky, vždy jsem byl v horší kondici. Skoro nic nesportuji. Vůbec se nehýbu.',
  );
  check(r.outcome === 'STOP_QUESTIONING',
    'TRACE_G4: activity answered → STOP_QUESTIONING (ACT gate opens)');
  check(r.hypothesisState.SEDENTARY_LIFESTYLE_ROOT === 'POSSIBLE',
    'TRACE_G4b: SEDENTARY POSSIBLE from activity_level_low');
  check(r.hypothesisState.INACTIVITY_ROOT === 'POSSIBLE',
    'TRACE_G4c: INACTIVITY POSSIBLE from activity_level_low');
}

// ── TRACE Sim B: activity still unknown → gate keeps ASK ─────────────────────

sep('TRACE Sim B: activity still unknown → ASK');

{
  // Reset to after Turn 3 (same state as TRACE_G3 nbqMessages above)
  const msgSimB = [
    { role: 'user',      content: 'Chci zhubnout.' },
    { role: 'assistant', content: 'Co tě k tomu vede?' },
    { role: 'user',      content: 'Mám nadváhu, zadýchávám se a necítím se dobře.' },
    { role: 'assistant', content: 'Zadýcháváš se hlavně při pohybu, nebo i v klidu?' },
    { role: 'user',      content: 'Hlavně při pohybu. Třeba když vyjdu dvě patra.' },
    { role: 'assistant', content: 'Jak to máš s pohybem — sportuješ nějak pravidelně?' },
  ];
  const r = evaluateGate(msgSimB, 'V poslední době se mi zdá, že hůř než dřív.');
  check(r.outcome === 'ASK',
    'TRACE_B: progressive dyspnea without activity answer → still ASK');
  check(r.information_need === 'activity_level',
    'TRACE_B2: information_need = activity_level (not safety)');
}

// ── Gate pass-through: non-GENERAL_HEALTH_REQUEST paths ──────────────────────
// evaluateGate is pure — the mode/classifier check is in runNbqGate() in orchestrate.js.
// Here we verify the selector correctly returns STOP_QUESTIONING for full evidence,
// which causes runNbqGate to return null (pass through).

sep('Gate pass-through: STOP_QUESTIONING → ACT unblocked');

{
  // Full evidence — all needs resolved
  const fullHistory = [
    { role: 'user', content: 'Chci zhubnout.' },
    { role: 'assistant', content: 'Co tě k tomu vede?' },
    { role: 'user', content: 'Mám nadváhu, zadýchávám se a necítím se dobře.' },
    { role: 'assistant', content: 'Zadýcháváš se hlavně při pohybu, nebo i v klidu?' },
    { role: 'user', content: 'Hlavně při pohybu. Třeba když vyjdu dvě patra.' },
    { role: 'assistant', content: 'Jak to máš s pohybem?' },
  ];
  const r = evaluateGate(fullHistory, 'Skoro nic nesportuji. Vůbec se nehýbu.');
  check(r.outcome === 'STOP_QUESTIONING',
    'PASSTHROUGH: full evidence → STOP_QUESTIONING → gate returns null → ACT passes');
}

// ── evidenceItems accumulate correctly across turns ───────────────────────────

sep('Evidence accumulation across session turns');

{
  // Use "Zadýchávám se." without "při pohybu" so EXERTIONAL_QUALIFIER is NOT extracted.
  // This keeps dyspnea_character UNKNOWN (not yet resolved), making it the priority-1 candidate.
  const history = [
    { role: 'user',      content: 'Mám nadváhu.' },
    { role: 'assistant', content: 'Jak se cítíš fyzicky?' },
  ];
  const r = evaluateGate(history, 'Zadýchávám se.');
  check(r.evidenceItems.some(e => e.type === 'self_reported_obesity'),
    'ACCUM1: obesity from prior turn present in evidenceItems');
  check(r.evidenceItems.some(e => e.type === 'self_reported_dyspnea'),
    'ACCUM2: dyspnea from current turn present in evidenceItems');
  check(!r.evidenceItems.some(e => e.type === 'exertional_qualifier'),
    'ACCUM2b: no exertional_qualifier → dyspnea_character not yet resolved');
  check(r.outcome === 'ASK',
    'ACCUM3: accumulated evidence → ASK');
  check(r.information_need === 'dyspnea_character',
    'ACCUM4: dyspnea_character selected (priority 1, not yet resolved)');
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log('\n══ NBQ GATE INTEGRATION TESTS ══════════════════════════');
for (const r of results) console.log(r);
console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${passed + failed} | Pass: ${passed} | Fail: ${failed}`);
if (failed > 0) {
  console.log('\nFAILED TESTS:');
  results.filter(r => r.includes('❌')).forEach(r => console.log(r));
  process.exit(1);
}
