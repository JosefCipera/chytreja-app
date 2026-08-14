/**
 * Regression tests: NEXT_BEST_EVIDENCE → Czech question bridge.
 *
 * Verifies that when DD returns mode=ASK with a NEXT_BEST_EVIDENCE primary_item,
 * the orchestrator presentation layer produces a concrete Czech question —
 * never the bare "Upřesni prosím." fallback.
 *
 * Run: node scripts/test-nbe-question-bridge.mjs
 */

// ── Replicate the bridge from orchestrator.js ─────────────────────────────────
// Keep in sync with NBE_QUESTION_MAP / NBE_METHOD_FALLBACK in orchestrator.js.

const NBE_QUESTION_MAP = {
  weight_kg:       'Kolik teď vážíš?',
  waist_cm:        'Jaký je tvůj obvod pasu v centimetrech?',
  bp_systolic:     'Jaký máš aktuálně systolický krevní tlak?',
  bp_diastolic:    'Jaký máš aktuálně diastolický krevní tlak?',
  heart_rate:      'Jaký je tvůj klidový tep?',
  activity_level:  'Jaký byl dnes tvůj pohyb? Nízký, střední, nebo vysoký?',
  sedentary_hours_day: 'Kolik hodin denně průměrně sedíš?',
  recent_falls:    'Upadl/a jsi během posledních 12 měsíců?',
  fall_history:    'Upadl/a jsi během posledních 12 měsíců?',
  gait_stability:  'Cítíš se při běžné chůzi stabilně?',
  vynest_nakup:    'Zvládneš vynést nákup (5 kg) do 2. patra bez zastavení?',
  zvednout_vnouce: 'Zvládneš zvednout dítě nebo těžší předmět ze země bez bolesti?',
  vstat_ze_zeme:   'Dokážeš vstát ze země bez opory rukou?',
  floor_rise_test: 'Pokud je pro tebe bezpečné jít na zem, zkus si sednout na zem a vstát s co nejmenší oporou. Zvládneš vstát? Pokud si nejsi jistý/á stabilitou, test nedělej sám/sama.',
  chair_stand_30s: 'Pokud je to pro tebe bezpečné, kolikrát vstaneš ze židle za 30 sekund bez opory rukou? Napiš číslo.',
  tug_test:        'Máš změřený TUG test — vstát ze židle, ujít 3 m, otočit se a vrátit? Pokud ano, napiš čas v sekundách.',
  grip_strength:   'Máš změřenou sílu stisku dynamometrem? Pokud ano, napiš hodnotu.',
  validated_strength_assessment: 'Máš výsledek ověřeného testu svalové síly? Pokud ano, napiš typ testu a výsledek.',
  knee_severity:       'Jak moc tě koleno omezuje? Mírně, středně, nebo výrazně?',
  hip_severity:        'Jak moc tě kyčel omezuje? Mírně, středně, nebo výrazně?',
  lower_back_severity: 'Jak moc tě záda omezují? Mírně, středně, nebo výrazně?',
  shoulder_severity:   'Jak moc tě rameno omezuje? Mírně, středně, nebo výrazně?',
  elbow_severity:      'Jak moc tě loket omezuje? Mírně, středně, nebo výrazně?',
  ankle_foot_severity: 'Jak moc tě kotník nebo chodidlo omezuje? Mírně, středně, nebo výrazně?',
  wrist_severity:      'Jak moc tě zápěstí omezuje? Mírně, středně, nebo výrazně?',
  lab_hba1c:       'Máš k dispozici výsledek HbA1c? Pokud ano, napiš hodnotu.',
  lab_apob:        'Máš k dispozici výsledek ApoB? Pokud ano, napiš hodnotu.',
  lab_ldl:         'Máš k dispozici výsledek LDL cholesterolu? Pokud ano, napiš hodnotu.',
  lab_hdl:         'Máš k dispozici výsledek HDL cholesterolu? Pokud ano, napiš hodnotu.',
  lab_triglycerides: 'Máš k dispozici výsledek triglyceridů? Pokud ano, napiš hodnotu.',
  lab_glucose_fasting: 'Máš k dispozici výsledek glykémie nalačno? Pokud ano, napiš hodnotu.',
  lab_crp:         'Máš k dispozici výsledek CRP (zánětlivý marker)? Pokud ano, napiš hodnotu.',
  lab_uric_acid:   'Máš k dispozici výsledek kyseliny močové? Pokud ano, napiš hodnotu.',
  lab_alt:         'Máš k dispozici výsledek ALT (jaterní enzym)? Pokud ano, napiš hodnotu.',
  lab_ast:         'Máš k dispozici výsledek AST (jaterní enzym)? Pokud ano, napiš hodnotu.',
  lab_testosterone: 'Máš k dispozici výsledek testosteronu? Pokud ano, napiš hodnotu.',
  lab_hrv:         'Máš k dispozici výsledek HRV (variabilita srdečního tepu)? Pokud ano, napiš hodnotu.',
};

const NBE_METHOD_FALLBACK = {
  question:         'Potřebuji od tebe jednu informaci. Můžeš odpovědět přímo?',
  home_measurement: 'Potřebuji jedno domácí měření. Máš hodnotu k dispozici?',
  functional_test:  'Potřebuji výsledek funkčního testu. Zvládneš ho teď?',
  wearable:         'Máš data z wearablu nebo sporttestru? Jaká je aktuální hodnota?',
  laboratory:       'Potřebuji laboratorní výsledek. Máš ho k dispozici?',
  clinician:        'Tuto hodnotu je třeba změřit u lékaře. Máš aktuální výsledek?',
};

function buildEvidenceQuestion(nbe) {
  if (!nbe) return null;
  return NBE_QUESTION_MAP[nbe.evidence_type]
    ?? NBE_METHOD_FALLBACK[nbe.acquisition_method]
    ?? (nbe.evidence_type
        ? `Potřebuji informaci o: ${nbe.evidence_type}. Máš ji k dispozici?`
        : 'Potřebuji jednu konkrétní informaci. Můžeš mi ji poskytnout?');
}

// ── Simulate the orchestrator presentation layer ──────────────────────────────
// Mirrors buildSessionUpdates (ASK branch) + buildAskResponse in orchestrator.js.

function simulateAskFlow(dd) {
  // buildSessionUpdates — ASK branch
  const item = dd.primary_item;
  const questionText = item?.question ?? item?.question_text ?? buildEvidenceQuestion(item);
  const evidenceType = item?.evidence_type ?? null;

  const sessionUpdates = {
    pending_question: questionText ? {
      text:          questionText,
      evidence_type: evidenceType,
      type:          item?.type ?? 'GENERAL',
    } : null,
  };

  // buildAskResponse — main path (guard for null primary_item already tested elsewhere)
  const question = sessionUpdates.pending_question?.text
    ?? dd.primary_item?.question
    ?? dd.primary_item?.question_text
    ?? buildEvidenceQuestion(dd.primary_item)
    ?? 'Potřebuji konkrétní informaci. Napiš mi ji.';

  const response = {
    mode: 'ASK',
    text: question,
    expects_reply: true,
    session_updates: sessionUpdates,
  };

  return { response, sessionUpdates };
}

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

const FORBIDDEN = ['Upřesni prosím.', 'Potřebuji více informací. Upřesni prosím.'];
function notForbidden(text) {
  return !FORBIDDEN.includes(text);
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log('\n[1] weight_kg NBE → concrete question, no "Upřesni prosím."');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: {
      type: 'NEXT_BEST_EVIDENCE', context_id: 'ctx-1',
      evidence_type: 'weight_kg', acquisition_method: 'home_measurement',
      urgency: 'high', decision_impact: 'high',
    },
  };
  const { response, sessionUpdates } = simulateAskFlow(dd);

  assert('response.text = Kolik teď vážíš?',
    response.text === 'Kolik teď vážíš?');
  assert('response.text === pending_question.text (no divergence)',
    response.text === sessionUpdates.pending_question?.text);
  assert('response.text not forbidden fallback', notForbidden(response.text));
  assert('pending_question.evidence_type = weight_kg',
    sessionUpdates.pending_question?.evidence_type === 'weight_kg');
}

console.log('\n[2] lab_apob NBE → lab instruction, not a question that expects immediate measurement');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: {
      type: 'NEXT_BEST_EVIDENCE', context_id: 'ctx-2',
      evidence_type: 'lab_apob', acquisition_method: 'laboratory',
      urgency: 'high', decision_impact: 'high',
    },
  };
  const { response, sessionUpdates } = simulateAskFlow(dd);

  assert('response.text = ApoB instruction',
    response.text === 'Máš k dispozici výsledek ApoB? Pokud ano, napiš hodnotu.');
  assert('response.text === pending_question.text', response.text === sessionUpdates.pending_question?.text);
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[3] bp_systolic NBE → blood pressure question');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'bp_systolic', acquisition_method: 'home_measurement' },
  };
  const { response } = simulateAskFlow(dd);
  assert('bp_systolic question', response.text === 'Jaký máš aktuálně systolický krevní tlak?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[4] activity_level NBE → activity question');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'activity_level', acquisition_method: 'question' },
  };
  const { response } = simulateAskFlow(dd);
  assert('activity_level question', response.text === 'Jaký byl dnes tvůj pohyb? Nízký, střední, nebo vysoký?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[5] recent_falls NBE → fall history question');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'recent_falls', acquisition_method: 'question' },
  };
  const { response } = simulateAskFlow(dd);
  assert('recent_falls question', response.text === 'Upadl/a jsi během posledních 12 měsíců?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[6] knee_severity NBE → constraint severity question');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'knee_severity', acquisition_method: 'question' },
  };
  const { response } = simulateAskFlow(dd);
  assert('knee_severity question', response.text === 'Jak moc tě koleno omezuje? Mírně, středně, nebo výrazně?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[7] lab_ldl NBE → lab instruction');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'lab_ldl', acquisition_method: 'laboratory' },
  };
  const { response } = simulateAskFlow(dd);
  assert('lab_ldl instruction', response.text === 'Máš k dispozici výsledek LDL cholesterolu? Pokud ano, napiš hodnotu.');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[7b] floor_rise_test → safe-framed instruction');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'floor_rise_test', acquisition_method: 'functional_test' },
  };
  const { response, sessionUpdates } = simulateAskFlow(dd);
  assert('floor_rise_test has safe framing', response.text.includes('bezpečné'));
  assert('floor_rise_test not generic fallback', response.text !== 'Potřebuji výsledek funkčního testu. Zvládneš ho teď?');
  assert('not forbidden', notForbidden(response.text));
  assert('response.text === pending_question.text', response.text === sessionUpdates.pending_question?.text);
}

console.log('\n[7c] validated_strength_assessment → neutral, no implicit chair_stand');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'validated_strength_assessment', acquisition_method: 'functional_test' },
  };
  const { response } = simulateAskFlow(dd);
  assert('validated_strength_assessment neutral text', response.text === 'Máš výsledek ověřeného testu svalové síly? Pokud ano, napiš typ testu a výsledek.');
  assert('does not mention chair stand (would assume specific test)', !response.text.toLowerCase().includes('chair') && !response.text.includes('židle za 30'));
  assert('not generic fallback', response.text !== 'Potřebuji výsledek funkčního testu. Zvládneš ho teď?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[7d] chair_stand_30s → safe-framed count question');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'chair_stand_30s', acquisition_method: 'functional_test' },
  };
  const { response } = simulateAskFlow(dd);
  assert('chair_stand_30s asks for count', response.text.includes('30 sekund'));
  assert('has safe framing', response.text.includes('bezpečné'));
  assert('not generic fallback', response.text !== 'Potřebuji výsledek funkčního testu. Zvládneš ho teď?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[7e] tug_test → clinical framing, no assumption user knows test');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'tug_test', acquisition_method: 'functional_test' },
  };
  const { response } = simulateAskFlow(dd);
  assert('tug_test explains test protocol', response.text.includes('3 m'));
  assert('asks for time in seconds', response.text.includes('sekund'));
  assert('not generic fallback', response.text !== 'Potřebuji výsledek funkčního testu. Zvládneš ho teď?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[7f] grip_strength → dynamometer only, no substitute test');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: { type: 'NEXT_BEST_EVIDENCE', evidence_type: 'grip_strength', acquisition_method: 'functional_test' },
  };
  const { response } = simulateAskFlow(dd);
  assert('grip_strength mentions dynamometer', response.text.includes('dynamometrem'));
  assert('no substitute home test suggested', !response.text.includes('stiskni') && !response.text.includes('pevně'));
  assert('not generic fallback', response.text !== 'Potřebuji výsledek funkčního testu. Zvládneš ho teď?');
  assert('not forbidden', notForbidden(response.text));
}

console.log('\n[8] UNKNOWN evidence_type + known acquisition_method → method fallback, not "Upřesni prosím."');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: {
      type: 'NEXT_BEST_EVIDENCE', evidence_type: 'vo2max_direct',
      acquisition_method: 'clinician',
    },
  };
  const { response, sessionUpdates } = simulateAskFlow(dd);

  assert('uses method fallback (not forbidden)', notForbidden(response.text));
  assert('response is non-empty', response.text.length > 10);
  assert('response.text === pending_question.text', response.text === sessionUpdates.pending_question?.text);
  assert('method fallback text', response.text === 'Tuto hodnotu je třeba změřit u lékaře. Máš aktuální výsledek?');
}

console.log('\n[9] UNKNOWN evidence_type + UNKNOWN acquisition_method → generic fallback with evidence_type name');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: {
      type: 'NEXT_BEST_EVIDENCE', evidence_type: 'some_new_marker',
      acquisition_method: 'unknown_method',
    },
  };
  const { response } = simulateAskFlow(dd);

  assert('not forbidden', notForbidden(response.text));
  assert('contains evidence_type name', response.text.includes('some_new_marker'));
  assert('non-empty', response.text.length > 10);
}

console.log('\n[10] All required evidence_types from spec have explicit mapping');
{
  const required = [
    'bp_systolic', 'weight_kg', 'waist_cm', 'activity_level',
    'recent_falls', 'fall_history', 'gait_stability',
    'vynest_nakup', 'zvednout_vnouce', 'vstat_ze_zeme',
    'knee_severity', 'lab_hba1c', 'lab_apob', 'lab_ldl',
    'floor_rise_test', 'chair_stand_30s', 'tug_test', 'grip_strength', 'validated_strength_assessment',
  ];
  for (const et of required) {
    const q = NBE_QUESTION_MAP[et];
    assert(`${et} has explicit mapping`, typeof q === 'string' && q.length > 5);
    assert(`${et} not forbidden`, notForbidden(q));
  }
}

console.log('\n[11] NBA_QUESTION item (has question field) — unchanged path');
{
  const dd = {
    mode: 'ASK', reason_code: 'ASK_BLOCKING',
    primary_item: {
      type: 'NBA_QUESTION',
      question: 'Jak závažné je tvé omezení pohybu? (lehké / střední / závažné)',
    },
  };
  const { response, sessionUpdates } = simulateAskFlow(dd);
  assert('NBA_QUESTION uses item.question directly',
    response.text === 'Jak závažné je tvé omezení pohybu? (lehké / střední / závažné)');
  assert('pending_question.text matches',
    sessionUpdates.pending_question?.text === response.text);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
const total = passed + failed;
console.log(`  ${total} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('  REGRESSION DETECTED');
  process.exit(1);
} else {
  console.log('  NBE → question bridge invariants hold.');
}
