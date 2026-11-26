// scripts/test-nbq.mjs — NBQ Prototype #1 Tests
// Run: node scripts/test-nbq.mjs
//
// Pure unit tests — no API key required, no HTTP calls.
// Tests T1–T10 as specified. T10 verifies pre-intake exports are unchanged.

import { extractEvidence, extractEvidenceFromHistory } from '../api/lib/nbq/evidenceExtractor.js';
import { computeHypothesisState, extractUserIntention } from '../api/lib/nbq/hypothesisState.js';
import { resolveInformationNeed, needPrerequisiteMet }  from '../api/lib/nbq/evidenceResolver.js';
import { selectInformationNeed }                        from '../api/lib/nbq/nbqSelector.js';
import { ET, STATUSES, INFORMATION_NEEDS }              from '../api/lib/nbq/scenarioEvidenceMap.js';
import { isEmergency, EMERGENCY_MESSAGE }               from '../api/pre-intake.js';

const { SUPPORTED, POSSIBLE, WEAKENED, UNKNOWN } = STATUSES;

let passed = 0, failed = 0;
const results = [];

function check(condition, label, detail = '') {
  if (condition) {
    results.push(`  ✅  ${label}`);
    passed++;
  } else {
    results.push(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`);
    failed++;
  }
}

function sep(label) {
  results.push(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`);
}

// ── T1: user intention ≠ health state ────────────────────────────────────────

sep('T1: User intention ≠ health state');

{
  const ev = extractEvidence('Chci zhubnout.');
  const types = new Set(ev.map(e => e.type));

  check(types.has(ET.USER_INTENTION_WEIGHT_LOSS),
    'T1a: "chci zhubnout" extracts user_intention_weight_loss');
  check(!types.has(ET.SELF_REPORTED_OBESITY),
    'T1b: "chci zhubnout" does NOT extract obesity evidence');

  const state = computeHypothesisState(ev);
  check(state.OBESITY === UNKNOWN,
    'T1c: OBESITY remains UNKNOWN from intention alone');
  check(state.LOW_VO2MAX === UNKNOWN,
    'T1d: LOW_VO2MAX remains UNKNOWN from intention alone');
  check(state.SEDENTARY_LIFESTYLE_ROOT === UNKNOWN,
    'T1e: SEDENTARY_LIFESTYLE_ROOT remains UNKNOWN from intention alone');
  check(state.INACTIVITY_ROOT === UNKNOWN,
    'T1f: INACTIVITY_ROOT remains UNKNOWN from intention alone');

  const intent = extractUserIntention(ev);
  check(intent === 'weight_loss_goal',
    'T1g: extractUserIntention returns weight_loss_goal');
}

// ── T2: evidence extraction ───────────────────────────────────────────────────

sep('T2: Evidence extraction');

{
  const ev1 = extractEvidence('Mám nadváhu, zadýchávám se a necítím se dobře.');
  const t1 = new Set(ev1.map(e => e.type));
  check(t1.has(ET.SELF_REPORTED_OBESITY), 'T2a: "mám nadváhu" → self_reported_obesity');
  check(t1.has(ET.SELF_REPORTED_DYSPNEA), 'T2b: "zadýchávám se" → self_reported_dyspnea');
  check(t1.has(ET.MALAISE_GENERAL),       'T2c: "necítím se dobře" → malaise_general');

  const ev2 = extractEvidence('Hlavně při pohybu. Třeba když vyjdu dvě patra.');
  const t2 = new Set(ev2.map(e => e.type));
  check(t2.has(ET.EXERTIONAL_QUALIFIER),        'T2d: "při pohybu" → exertional_qualifier');
  check(t2.has(ET.FUNCTIONAL_THRESHOLD_STAIRS), 'T2e: "dvě patra" → functional_threshold_stairs');

  const history = [
    { role: 'user',      content: 'Chci zhubnout.' },
    { role: 'assistant', content: 'Co tě k tomu vede?' },
    { role: 'user',      content: 'Mám nadváhu, zadýchávám se a necítím se dobře.' },
    { role: 'assistant', content: 'Zadýcháváš se hlavně při pohybu, nebo i v klidu?' },
    { role: 'user',      content: 'Hlavně při pohybu. Třeba když vyjdu dvě patra.' },
  ];
  const evAll = extractEvidenceFromHistory(history);
  const tAll  = new Set(evAll.map(e => e.type));
  check(tAll.has(ET.USER_INTENTION_WEIGHT_LOSS),  'T2f: full history → user_intention');
  check(tAll.has(ET.SELF_REPORTED_OBESITY),        'T2g: full history → obesity');
  check(tAll.has(ET.EXERTIONAL_QUALIFIER),         'T2h: full history → exertional_qualifier');

  const evAssistant = evAll.filter(e => e.raw_text === 'Co tě k tomu vede?');
  check(evAssistant.length === 0, 'T2i: assistant turns produce no evidence');
}

// ── T3: hypothesis update ─────────────────────────────────────────────────────

sep('T3: Hypothesis state updates');

{
  // LOW_VO2MAX SUPPORTED when dyspnea + exertional
  const ev1 = [
    ...extractEvidence('Zadýchávám se.'),
    ...extractEvidence('Hlavně při pohybu.'),
  ];
  const s1 = computeHypothesisState(ev1);
  check(s1.LOW_VO2MAX === SUPPORTED, 'T3a: dyspnea + exertional → LOW_VO2MAX SUPPORTED');

  // LOW_VO2MAX POSSIBLE without exertional
  const ev2 = extractEvidence('Zadýchávám se.');
  const s2 = computeHypothesisState(ev2);
  check(s2.LOW_VO2MAX === POSSIBLE, 'T3b: dyspnea alone → LOW_VO2MAX POSSIBLE (not SUPPORTED)');

  // OBESITY self-report → POSSIBLE (not SUPPORTED — not measured)
  const ev3 = extractEvidence('Mám nadváhu.');
  const s3 = computeHypothesisState(ev3);
  check(s3.OBESITY === POSSIBLE, 'T3c: self-reported obesity → POSSIBLE (not SUPPORTED)');

  // RESTING qualifier weakens LOW_VO2MAX
  const ev4 = [
    ...extractEvidence('Zadýchávám se.'),
    ...extractEvidence('I v klidu.'),
  ];
  const s4 = computeHypothesisState(ev4);
  check(s4.LOW_VO2MAX !== SUPPORTED, 'T3d: resting qualifier prevents LOW_VO2MAX from being SUPPORTED');

  // Pattern inference: OBESITY + LOW_VO2MAX → SEDENTARY/INACTIVITY become POSSIBLE
  const ev5 = [
    ...extractEvidence('Mám nadváhu.'),
    ...extractEvidence('Zadýchávám se při pohybu.'),
  ];
  const s5 = computeHypothesisState(ev5);
  check(s5.SEDENTARY_LIFESTYLE_ROOT === POSSIBLE, 'T3e: obesity+low_vo2max pattern → SEDENTARY POSSIBLE');
  check(s5.INACTIVITY_ROOT          === POSSIBLE, 'T3f: obesity+low_vo2max pattern → INACTIVITY POSSIBLE');

  // activity_level_low supports SEDENTARY + INACTIVITY
  const ev6 = [
    ...extractEvidence('Mám nadváhu.'),
    ...extractEvidence('Vůbec se nehýbu.'),
  ];
  const s6 = computeHypothesisState(ev6);
  check(s6.SEDENTARY_LIFESTYLE_ROOT === POSSIBLE, 'T3g: activity_level_low → SEDENTARY POSSIBLE');
  check(s6.INACTIVITY_ROOT          === POSSIBLE, 'T3h: activity_level_low → INACTIVITY POSSIBLE');

  // activity_level_high weakens SEDENTARY + INACTIVITY
  const ev7 = [
    ...extractEvidence('Mám nadváhu.'),
    ...extractEvidence('Pravidelně cvičím.'),
  ];
  const s7 = computeHypothesisState(ev7);
  check(s7.SEDENTARY_LIFESTYLE_ROOT === WEAKENED, 'T3i: activity_level_high → SEDENTARY WEAKENED');
  check(s7.INACTIVITY_ROOT          === WEAKENED, 'T3j: activity_level_high → INACTIVITY WEAKENED');
}

// ── T4: existing emergency gate unchanged ─────────────────────────────────────

sep('T4: Existing emergency gate');

{
  check(isEmergency('Nemůžu dýchat.'),    'T4a: "nemůžu dýchat" triggers emergency');
  check(isEmergency('Dusím se.'),          'T4b: "dusím se" triggers emergency');
  check(isEmergency('Silně krvácím.'),     'T4c: "silně krvácím" triggers emergency');
  check(!isEmergency('Zadýchávám se.'),    'T4d: "zadýchávám se" does NOT trigger emergency');
  check(!isEmergency('Chci zhubnout.'),    'T4e: "chci zhubnout" does NOT trigger emergency');

  // Selector returns URGENT_EXIT for emergency text
  const emptyState = computeHypothesisState([]);
  const r = selectInformationNeed('Nemůžu dýchat!', emptyState, new Set(), {});
  check(r.outcome === 'URGENT_EXIT', 'T4f: selector returns URGENT_EXIT for emergency text');
}

// ── T5: no soft-safety rule fires ────────────────────────────────────────────

sep('T5: No soft-safety rule fires (LOCK 2)');

{
  const ev = [
    ...extractEvidence('Mám nadváhu.'),
    ...extractEvidence('Zadýchávám se hlavně při pohybu. Třeba když vyjdu dvě patra.'),
  ];
  const state   = computeHypothesisState(ev);
  const types   = new Set(ev.map(e => e.type));

  check(state.LOW_VO2MAX === SUPPORTED, 'T5a: LOW_VO2MAX is SUPPORTED in this state');
  check(state.OBESITY    === POSSIBLE,  'T5b: OBESITY is POSSIBLE in this state');

  const result = selectInformationNeed('Hlavně při pohybu. Třeba když vyjdu dvě patra.', state, types, {});

  check(result.outcome !== 'URGENT_EXIT',
    'T5c: LOW_VO2MAX SUPPORTED + OBESITY POSSIBLE does NOT trigger URGENT_EXIT');

  // Must NOT return NEED_INFORMATION_FIRST (not a valid outcome in v1)
  check(!('NEED_INFORMATION_FIRST' in result),
    'T5d: no NEED_INFORMATION_FIRST field in result (soft-safety inactive)');

  if (result.outcome === 'ASK') {
    check(result.information_need === 'activity_level',
      `T5e: if ASK, information_need is activity_level (got: ${result.information_need})`);
  } else {
    check(result.outcome === 'STOP_QUESTIONING',
      `T5e: outcome is ASK or STOP_QUESTIONING (got: ${result.outcome})`);
  }
}

// ── T6: resolver KNOWN prevents duplicate question ────────────────────────────

sep('T6: Evidence Resolver — KNOWN');

{
  // dyspnea_character resolved when exertional_qualifier present
  const types1 = new Set([ET.EXERTIONAL_QUALIFIER]);
  const r1 = resolveInformationNeed('dyspnea_character', types1, {});
  check(r1.known === true, 'T6a: dyspnea_character KNOWN when exertional_qualifier in conversation');
  check(r1.source === 'conversation', 'T6b: source is conversation');

  // also works with resting qualifier
  const types2 = new Set([ET.RESTING_QUALIFIER]);
  const r2 = resolveInformationNeed('dyspnea_character', types2, {});
  check(r2.known === true, 'T6c: dyspnea_character KNOWN when resting_qualifier in conversation');

  // known_facts path
  const r3 = resolveInformationNeed('activity_level', new Set(), { activity_level: 'low' });
  check(r3.known === true,          'T6d: activity_level KNOWN from known_facts');
  check(r3.source === 'known_facts', 'T6e: source is known_facts');

  // Prerequisite check
  const metDyspnea = needPrerequisiteMet('dyspnea_character', new Set([ET.SELF_REPORTED_DYSPNEA]));
  check(metDyspnea === true, 'T6f: dyspnea_character prerequisite met when dyspnea present');

  const notMet = needPrerequisiteMet('dyspnea_character', new Set());
  check(notMet === false, 'T6g: dyspnea_character prerequisite NOT met without dyspnea');
}

// ── T7: resolver UNKNOWN allows information need ──────────────────────────────

sep('T7: Evidence Resolver — UNKNOWN');

{
  const r1 = resolveInformationNeed('activity_level', new Set(), {});
  check(r1.known === false, 'T7a: activity_level UNKNOWN when not in conversation or known_facts');

  const r2 = resolveInformationNeed('dyspnea_progression', new Set([ET.EXERTIONAL_QUALIFIER]), {});
  check(r2.known === false, 'T7b: dyspnea_progression UNKNOWN when stable/progressive not in conversation');

  // Unknown need returns eligible for questioning
  const r3 = resolveInformationNeed('nonexistent_need', new Set(), {});
  check(r3.known === false, 'T7c: unknown need key returns not-known gracefully');
}

// ── T8: NBQ output never contains root/constraint/leverage/action ──────────────

sep('T8: NBQ output — no root/constraint/leverage/action');

{
  const ev = [
    ...extractEvidence('Mám nadváhu.'),
    ...extractEvidence('Zadýchávám se hlavně při pohybu.'),
  ];
  const state = computeHypothesisState(ev);
  const types = new Set(ev.map(e => e.type));

  const result = selectInformationNeed('Zadýchávám se při pohybu.', state, types, {});

  const forbidden = ['root', 'constraint', 'leverage', 'action', 'intervention', 'winner', 'cause'];
  for (const key of forbidden) {
    check(!(key in result), `T8: output has no "${key}" field`);
  }

  // Verify only permitted fields
  const permittedKeys = new Set(['outcome', 'information_need']);
  const extraKeys = Object.keys(result).filter(k => !permittedKeys.has(k));
  check(extraKeys.length === 0,
    `T8: output contains only permitted fields (extra: ${extraKeys.join(', ') || 'none'})`);
}

// ── T9: STOP_QUESTIONING when no decision-changing unknown remains ─────────────

sep('T9: STOP_QUESTIONING');

{
  // Full scenario evidence including activity_level answer
  const ev = [
    ...extractEvidence('Chci zhubnout.'),
    ...extractEvidence('Mám nadváhu, zadýchávám se a necítím se dobře.'),
    ...extractEvidence('Hlavně při pohybu. Třeba když vyjdu dvě patra.'),
    ...extractEvidence('Skoro nic nesportuji. Vůbec se nehýbu.'),
  ];
  const state = computeHypothesisState(ev);
  const types = new Set(ev.map(e => e.type));

  // dyspnea_character → KNOWN (exertional_qualifier present)
  // activity_level    → KNOWN (activity_level_low present)
  // dyspnea_progression → canChange: [] → not a candidate in v1

  const result = selectInformationNeed('Skoro nic nesportuji.', state, types, {});
  check(result.outcome === 'STOP_QUESTIONING',
    `T9a: STOP_QUESTIONING when all needs resolved (got: ${result.outcome})`);

  // Partial: only dyspnea resolved → still need activity
  const evPartial = [
    ...extractEvidence('Mám nadváhu.'),
    ...extractEvidence('Zadýchávám se při pohybu.'),
  ];
  const stateP = computeHypothesisState(evPartial);
  const typesP = new Set(evPartial.map(e => e.type));
  const resultP = selectInformationNeed('Zadýchávám se při pohybu.', stateP, typesP, {});
  check(resultP.outcome === 'ASK',
    `T9b: still ASK when activity_level unknown (got: ${resultP.outcome})`);
  check(resultP.information_need === 'activity_level',
    `T9c: asks activity_level (got: ${resultP.information_need})`);
}

// ── T10: pre-intake exports unchanged ─────────────────────────────────────────

sep('T10: Pre-intake exports unchanged');

{
  check(typeof isEmergency === 'function',
    'T10a: isEmergency is still a function');
  check(typeof EMERGENCY_MESSAGE === 'string' && EMERGENCY_MESSAGE.length > 0,
    'T10b: EMERGENCY_MESSAGE is still a non-empty string');

  // Spot-check existing emergency behavior unchanged
  check(isEmergency('Dusím se.'),             'T10c: emergency: "dusím se" still triggers');
  check(!isEmergency('Zadýchávám se.'),        'T10d: non-emergency: "zadýchávám se" still safe');
  check(isEmergency('Nemůžu se nadechnout.'),  'T10e: emergency: "nemůžu se nadechnout" still triggers');
  check(EMERGENCY_MESSAGE.includes('155'),     'T10f: EMERGENCY_MESSAGE still contains 155');
}

// ── Scenario trace summary ─────────────────────────────────────────────────────

sep('SCENARIO TRACE');

{
  results.push('  Turn 1: "Chci zhubnout."');
  const ev1 = extractEvidence('Chci zhubnout.');
  const s1  = computeHypothesisState(ev1);
  const t1  = new Set(ev1.map(e => e.type));
  const r1  = selectInformationNeed('Chci zhubnout.', s1, t1, {});
  results.push(`  → hypotheses: ${JSON.stringify(s1)}`);
  results.push(`  → selector: ${r1.outcome}`);
  check(r1.outcome === 'OPEN_INFORMATION_NEED', 'TRACE T1: selector → OPEN_INFORMATION_NEED');

  results.push('\n  Turn 2: "Mám nadváhu, zadýchávám se a necítím se dobře."');
  const ev2all = [...ev1, ...extractEvidence('Mám nadváhu, zadýchávám se a necítím se dobře.')];
  const s2 = computeHypothesisState(ev2all);
  const t2 = new Set(ev2all.map(e => e.type));
  const r2 = selectInformationNeed('Mám nadváhu, zadýchávám se a necítím se dobře.', s2, t2, {});
  results.push(`  → hypotheses: ${JSON.stringify(s2)}`);
  results.push(`  → selector: ${r2.outcome} / need: ${r2.information_need}`);
  check(r2.outcome === 'ASK', 'TRACE T2: selector → ASK');
  check(r2.information_need === 'dyspnea_character', 'TRACE T2: information_need → dyspnea_character');

  results.push('\n  Turn 3: "Hlavně při pohybu. Třeba když vyjdu dvě patra."');
  const ev3all = [...ev2all, ...extractEvidence('Hlavně při pohybu. Třeba když vyjdu dvě patra.')];
  const s3 = computeHypothesisState(ev3all);
  const t3 = new Set(ev3all.map(e => e.type));
  const r3 = selectInformationNeed('Hlavně při pohybu. Třeba když vyjdu dvě patra.', s3, t3, {});
  results.push(`  → hypotheses: ${JSON.stringify(s3)}`);
  results.push(`  → selector: ${r3.outcome} / need: ${r3.information_need}`);
  check(s3.LOW_VO2MAX === SUPPORTED,       'TRACE T3: LOW_VO2MAX → SUPPORTED');
  check(r3.outcome === 'ASK',              'TRACE T3: selector → ASK');
  check(r3.information_need === 'activity_level', 'TRACE T3: information_need → activity_level');

  // Simulation A: stable, always been in poor shape
  results.push('\n  Simulation A: "Je to tak celé roky, vždy jsem byl v horší kondici."');
  const evA = [...ev3all, ...extractEvidence('Je to tak celé roky, vždy jsem byl v horší kondici. Skoro nic nesportuji. Vůbec se nehýbu.')];
  const sA  = computeHypothesisState(evA);
  const tA  = new Set(evA.map(e => e.type));
  const rA  = selectInformationNeed('Vždy jsem byl.', sA, tA, {});
  results.push(`  → selector: ${rA.outcome}`);
  check(rA.outcome === 'STOP_QUESTIONING', 'TRACE A: STOP_QUESTIONING after activity answered');

  // Simulation B: worsening recently
  results.push('\n  Simulation B: "V poslední době se mi zdá, že hůř než dřív."');
  const evB = [...ev3all, ...extractEvidence('V poslední době se mi zdá, že hůř než dřív.')];
  const sB  = computeHypothesisState(evB);
  const tB  = new Set(evB.map(e => e.type));
  const rB  = selectInformationNeed('Hůř než dřív.', sB, tB, {});
  results.push(`  → selector: ${rB.outcome} / need: ${rB.information_need}`);
  check(rB.outcome === 'ASK', 'TRACE B: still ASK (activity_level still UNKNOWN)');
  check(rB.information_need === 'activity_level', 'TRACE B: information_need → activity_level (not safety)');
}

// ── Results ────────────────────────────────────────────────────────────────────

console.log('\n══ NBQ PROTOTYPE #1 TESTS ══════════════════════════════');
for (const r of results) console.log(r);
console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${passed + failed} | Pass: ${passed} | Fail: ${failed}`);
if (failed > 0) {
  console.log('\nFAILED TESTS:');
  results.filter(r => r.includes('❌')).forEach(r => console.log(r));
  process.exit(1);
}
