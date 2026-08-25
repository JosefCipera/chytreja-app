// scripts/test-pre-intake.mjs — CHJ Pre-intake API tests
// Run: node --env-file=.env.local scripts/test-pre-intake.mjs
//
// Static / unit tests (T6–T10): no API key required.
// Integration tests (T1–T5, T11–T12): require ANTHROPIC_API_KEY in .env.local.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let passed  = 0;
let failed  = 0;
let skipped = 0;

function check(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`);
    failed++;
  }
}
function skip(label, reason) {
  console.log(`  ○  ${label} [skipped: ${reason}]`);
  skipped++;
}
function sep(label) {
  console.log(`\n${'─'.repeat(64)}\n  ${label}\n${'─'.repeat(64)}`);
}

// Mock req / res ──────────────────────────────────────────────────────────────

function mockReq(body) { return { method: 'POST', body }; }
function mockRes() {
  let _status = 200, _body = null;
  const r = {
    status(c)  { _status = c; return r; },
    json(b)    { _body   = b; return r; },
    get statusCode() { return _status; },
    get body()       { return _body;   },
  };
  return r;
}

const VALID_OUTCOMES = new Set(['ASK', 'AHA', 'NOT_ENOUGH_YET', 'URGENT_SAFETY_EXIT']);

// ─────────────────────────────────────────────────────────────────────────────
// T6: No DB persistence — static source analysis (no API key)
// ─────────────────────────────────────────────────────────────────────────────
sep('T6: No DB persistence (static)');

const src = readFileSync(resolve(ROOT, 'api/pre-intake.js'), 'utf-8');

check(!src.includes('@supabase'),                 'No @supabase import');
check(!src.includes('createClient'),              'No createClient call');
check(!src.includes('SUPABASE_URL'),              'No SUPABASE_URL reference');
check(!src.includes('SUPABASE_SERVICE_ROLE_KEY'), 'No service_role key reference');
check(!src.includes('SUPABASE_ANON_KEY'),         'No anon key reference');

// ─────────────────────────────────────────────────────────────────────────────
// T7: No Health Engine / orchestrator import — static source analysis (no API key)
// ─────────────────────────────────────────────────────────────────────────────
sep('T7: No Health Engine / orchestrator import (static)');

check(!src.includes('./engine/engine'),           'No engine.js import');
check(!src.includes('./engine/orchestrator'),     'No orchestrator.js import');
check(!src.includes('./engine/dailyDecision'),    'No dailyDecision.js import');
check(!src.includes('./engine/healthEventAdapter'), 'No healthEventAdapter import');
check(!src.includes('./orchestrate'),             'No orchestrate.js import');
check(!src.includes('applyHealthEvent'),          'No applyHealthEvent call');
check(!src.includes('runEngine'),                 'No runEngine call');
check(!src.includes('computeDailyDecision'),      'No computeDailyDecision call');

// ─────────────────────────────────────────────────────────────────────────────
// T8: sanitizeFacts unit tests — no API key
// ─────────────────────────────────────────────────────────────────────────────
sep('T8: sanitizeFacts unit tests (no API)');
{
  const { sanitizeFacts } = await import('../api/pre-intake.js');
  const NOW = '2026-08-24T10:00:00.000Z';

  // Forbidden event_types must move from structured_facts → deferred_facts
  {
    const parsed = {
      outcome: 'ASK', message: 'test',
      structured_facts: [
        { event_type: 'NEW_SYMPTOM',            raw_text: 'bolí mě koleno', utterance_index: 0, payload: {} },
        { event_type: 'GENERAL_HEALTH_REQUEST', raw_text: 'mám FaP',        utterance_index: 0, payload: {} },
        { event_type: 'MEDICATION_CHANGE',      raw_text: 'beru Pradaxu',   utterance_index: 0, payload: {} },
      ],
      deferred_facts: [],
    };
    const { structured_facts, deferred_facts } = sanitizeFacts(parsed, NOW);
    check(structured_facts.length === 0, 'Forbidden types: cleared from structured_facts');
    check(deferred_facts.length === 3,   'Forbidden types: all moved to deferred_facts');
    check(deferred_facts.some(f => f.type === 'new_symptom'),           'NEW_SYMPTOM → new_symptom');
    check(deferred_facts.some(f => f.type === 'general_health_request'),'GENERAL_HEALTH_REQUEST → general_health_request');
    check(deferred_facts.some(f => f.type === 'medication_mention'),    'MEDICATION_CHANGE → medication_mention');
  }

  // Allowed event_types pass through with source + timestamp
  {
    const parsed = {
      outcome: 'AHA', message: 'ok',
      structured_facts: [
        { event_type: 'NEW_MEASUREMENT', payload: { obs_type: 'weight_kg', value: 92 }, raw_text: 'Vážím 92 kg.', utterance_index: 0 },
        { event_type: 'NEW_CONSTRAINT',  payload: { affected_area: 'koleno' },           raw_text: 'Bolí koleno.',  utterance_index: 1 },
      ],
      deferred_facts: [],
    };
    const { structured_facts, deferred_facts } = sanitizeFacts(parsed, NOW);
    check(structured_facts.length === 2,           'Allowed types: both pass through');
    check(structured_facts[0].source === 'pre-intake', 'source=pre-intake added');
    check(structured_facts[0].timestamp === NOW,   'timestamp added');
    check(deferred_facts.length === 0,             'No overflow to deferred');
  }

  // medication_mention in deferred stays in deferred
  {
    const parsed = {
      outcome: 'AHA', message: 'ok',
      structured_facts: [],
      deferred_facts: [
        { type: 'medication_mention', raw_text: 'Beru Pradaxu 110mg.', utterance_index: 0, reason: 'unsupported_structured_persistence' },
      ],
    };
    const { deferred_facts } = sanitizeFacts(parsed, NOW);
    check(deferred_facts.length === 1,                                         'Deferred fact preserved');
    check(deferred_facts[0].type === 'medication_mention',                     'Type retained');
    check(deferred_facts[0].reason === 'unsupported_structured_persistence',   'Reason preserved');
    check(deferred_facts[0].timestamp === NOW,                                 'Timestamp added');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T9: isEmergency() positive cases — must return true (no API key)
// ─────────────────────────────────────────────────────────────────────────────
sep('T9: Emergency positive cases — isEmergency() = true (static)');
{
  const { isEmergency } = await import('../api/pre-intake.js');

  const positives = [
    // Chest + breathing combo (heart attack signal)
    ['Bolest na hrudi + dušnost',         'Mám silnou bolest na hrudi a špatně se mi dýchá.'],
    ['Tlak na hrudi + dušnost',           'Cítím tlak na hrudi a mám dušnost.'],
    ['Svírání hrudi + zkrácený dech',     'Svírání na hrudi a zkrácený dech.'],
    // Speech + limb combo (stroke signal)
    ['Špatně mluvím + nemůžu hýbat',     'Najednou nemůžu hýbat levou rukou a špatně mluvím.'],
    ['Nemohu mluvit + nemohu hýbat',     'Nemohu mluvit ani hýbat pravou rukou.'],
    // Standalone: cannot breathe / suffocating
    ['Nemůžu dýchat',                     'Nemůžu dýchat, potřebuji pomoc.'],
    ['Nemohu dýchat',                     'Nemohu dýchat vůbec.'],
    ['Dusím se',                          'Dusím se.'],
    // Standalone: severe bleeding
    ['Silně krvácím',                     'Silně krvácím z rány a nemohu to zastavit.'],
    ['Silné krvácení',                    'Mám silné krvácení.'],
    // Standalone: explicit loss of consciousness phrase
    ['Ztrácím vědomí',                    'Ztrácím vědomí.'],
    ['Ztráta vědomí',                     'Měl jsem ztrátu vědomí.'],
  ];

  for (const [label, text] of positives) {
    check(isEmergency(text) === true, `POSITIVE: ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T10: isEmergency() negative cases — must return false (no API key)
// ─────────────────────────────────────────────────────────────────────────────
sep('T10: Emergency negative cases — isEmergency() = false (static)');
{
  const { isEmergency } = await import('../api/pre-intake.js');

  const negatives = [
    // Ambiguous singles — need companion signal to trigger
    ['Omdlel jsem (alone)',               'Právě jsem omdlel.'],
    ['Bolí na hrudi (alone)',             'Bolí mě na hrudi.'],
    ['Špatně mluvím (alone)',             'Špatně mluvím od rána.'],
    ['Dušnost při námaze (no chest)',     'Mám dušnost při námaze.'],
    ['Bušení srdce (alone)',              'Cítím bušení srdce.'],
    // General health (non-urgent)
    ['Únava',                             'Jsem velmi unavený celý den.'],
    ['Bolest zad + chůze',               'Mám bolesti v zádech a špatně chodím.'],
    ['Tlak v hlavě + závratě',           'Mám tlak v hlavě a závratě.'],
    ['Špatně spím',                       'Špatně spím a mám noční pocení.'],
    // Near-miss: chest without breathing
    ['Bolest hrudi po cvičení (no breath)', 'Mám bolest v hrudníku po cvičení.'],
    // Near-miss: breathing without chest
    ['Dušnost + kašel (no chest)',       'Mám dušnost a kašel od minulého týdne.'],
    // Near-miss: limb without speech (e.g. injury/arthritis)
    ['Nemůžu ohýbat koleno (injury)',    'Bolí mě koleno a nemůžu ohýbat nohu.'],
  ];

  for (const [label, text] of negatives) {
    check(isEmergency(text) === false, `NEGATIVE: ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T13: classifyTemporalContext — deterministic temporal classification (no API)
// ─────────────────────────────────────────────────────────────────────────────
sep('T13: classifyTemporalContext — temporal classification (no API)');
{
  const { classifyTemporalContext } = await import('../api/pre-intake.js');

  const cases = [
    // acute
    ['od rána se motám',            'acute'],
    ['od dnes ráno mě bolí hlava',  'acute'],
    ['začalo mi to dnes',           'acute'],
    ['náhle se mi točí hlava',      'acute'],
    ['právě mě bolí záda',          'acute'],
    ['najednou mám závratě',        'acute'],
    ['před chvílí jsem upadl',      'acute'],
    // recent
    ['od včera se mi špatně dýchá', 'recent'],
    ['pár dní mi to dělá',          'recent'],
    ['minulý týden začal kašel',    'recent'],
    ['nedávno jsem měl chřipku',    'recent'],
    // chronic
    ['dlouhodobě trpím bolestí',    'chronic'],
    ['celý život mám alergii',      'chronic'],
    ['od roku 2020 mám diabetes',   'chronic'],
    ['mám chronicky bolavé koleno', 'chronic'],
    // unknown (no temporal signal)
    ['bolí mě záda',                'unknown'],
    ['mám únavu',                   'unknown'],
    ['cítím se špatně',             'unknown'],
  ];

  for (const [text, expected] of cases) {
    const got = classifyTemporalContext(text);
    check(got === expected, `"${text}" → '${expected}' (got: '${got}')`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T14: sanitizeFacts — temporal_context + acute gait guard (no API)
// ─────────────────────────────────────────────────────────────────────────────
sep('T14: sanitizeFacts — temporal_context + acute gait guard (no API)');
{
  const { sanitizeFacts } = await import('../api/pre-intake.js');
  const NOW = '2026-08-25T10:00:00.000Z';

  // temporal_context added to new_symptom deferred_facts
  {
    const parsed = {
      outcome: 'AHA', message: 'ok',
      structured_facts: [],
      deferred_facts: [
        { type: 'new_symptom', raw_text: 'od rána se motám', utterance_index: 0, reason: 'non_idempotent_handoff' },
        { type: 'new_symptom', raw_text: 'mám chronicky bolavé koleno', utterance_index: 1, reason: 'non_idempotent_handoff' },
        { type: 'new_symptom', raw_text: 'bolí mě záda', utterance_index: 2, reason: 'non_idempotent_handoff' },
        { type: 'medication_mention', raw_text: 'beru Pradaxu', utterance_index: 3, reason: 'unsupported_structured_persistence' },
      ],
    };
    const { deferred_facts } = sanitizeFacts(parsed, NOW);
    const mota = deferred_facts.find(f => f.raw_text.includes('motám'));
    const koleno = deferred_facts.find(f => f.raw_text.includes('koleno'));
    const zada = deferred_facts.find(f => f.raw_text.includes('záda'));
    const med = deferred_facts.find(f => f.type === 'medication_mention');
    check(mota?.temporal_context === 'acute',   'od rána se motám → temporal_context=acute');
    check(koleno?.temporal_context === 'chronic','chronicky bolavé koleno → temporal_context=chronic');
    check(zada?.temporal_context === 'unknown',  'bolí mě záda → temporal_context=unknown');
    check(!med?.temporal_context,                'medication_mention has no temporal_context');
  }

  // temporal_context from Haiku is preserved if valid
  {
    const parsed = {
      outcome: 'ASK', message: 'ok',
      structured_facts: [],
      deferred_facts: [
        { type: 'new_symptom', raw_text: 'bolí mě záda', utterance_index: 0, reason: 'non_idempotent_handoff', temporal_context: 'recent' },
      ],
    };
    const { deferred_facts } = sanitizeFacts(parsed, NOW);
    check(deferred_facts[0].temporal_context === 'recent', 'Haiku-supplied temporal_context=recent preserved');
  }

  // Acute gait guard: new_symptom(acute) + ANSWER(gait_stability) → gait moved to deferred
  {
    const parsed = {
      outcome: 'AHA', message: 'ok',
      structured_facts: [
        { event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { evidence_type: 'gait_stability', value: 'ne' }, raw_text: 'Nestabilně.', utterance_index: 1 },
        { event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { evidence_type: 'recent_falls', value: 'ne' },   raw_text: 'Nespadl jsem.', utterance_index: 2 },
        { event_type: 'NEW_MEASUREMENT',             payload: { obs_type: 'weight_kg', value: 88 },             raw_text: 'Vážím 88 kg.', utterance_index: 0 },
      ],
      deferred_facts: [
        { type: 'new_symptom', raw_text: 'od rána se motám', utterance_index: 0, reason: 'non_idempotent_handoff' },
      ],
    };
    const { structured_facts, deferred_facts } = sanitizeFacts(parsed, NOW);
    check(!structured_facts.some(f => f.payload?.evidence_type === 'gait_stability'), 'gait_stability NOT in structured_facts (acute guard)');
    check(!structured_facts.some(f => f.payload?.evidence_type === 'recent_falls'),   'recent_falls NOT in structured_facts (acute guard)');
    check(structured_facts.some(f => f.payload?.obs_type === 'weight_kg'),            'weight_kg stays in structured_facts (non-gait)');
    check(deferred_facts.some(f => f.reason === 'acute_symptom_context'),             'gait evidence moved to deferred with reason=acute_symptom_context');
    check(deferred_facts.filter(f => f.reason === 'acute_symptom_context').every(f => f.temporal_context === 'acute'),
      'moved gait facts have temporal_context=acute');
  }

  // Chronic symptom does NOT trigger acute guard
  {
    const parsed = {
      outcome: 'AHA', message: 'ok',
      structured_facts: [
        { event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { evidence_type: 'gait_stability', value: 'ne' }, raw_text: 'Nestabilně.', utterance_index: 1 },
      ],
      deferred_facts: [
        { type: 'new_symptom', raw_text: 'dlouhodobě mám bolesti kloubů', utterance_index: 0, reason: 'non_idempotent_handoff' },
      ],
    };
    const { structured_facts } = sanitizeFacts(parsed, NOW);
    check(structured_facts.some(f => f.payload?.evidence_type === 'gait_stability'),
      'gait_stability stays in structured_facts for chronic new_symptom (guard inactive)');
  }

  // unknown temporal_context does NOT trigger acute guard
  {
    const parsed = {
      outcome: 'AHA', message: 'ok',
      structured_facts: [
        { event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { evidence_type: 'gait_stability', value: 'ne' }, raw_text: 'Nestabilně.', utterance_index: 1 },
      ],
      deferred_facts: [
        { type: 'new_symptom', raw_text: 'bolí mě záda', utterance_index: 0, reason: 'non_idempotent_handoff' },
      ],
    };
    const { structured_facts } = sanitizeFacts(parsed, NOW);
    check(structured_facts.some(f => f.payload?.evidence_type === 'gait_stability'),
      'gait_stability stays in structured_facts for unknown temporal_context (guard inactive)');
  }

  // Non-gait evidence types are not affected by acute guard
  {
    const parsed = {
      outcome: 'AHA', message: 'ok',
      structured_facts: [
        { event_type: 'ANSWER_TO_EVIDENCE_QUESTION', payload: { evidence_type: 'sedentary_hours_day', value: 8 }, raw_text: '8 hodin.', utterance_index: 1 },
        { event_type: 'NEW_MEASUREMENT', payload: { obs_type: 'weight_kg', value: 90 }, raw_text: '90 kg.', utterance_index: 0 },
      ],
      deferred_facts: [
        { type: 'new_symptom', raw_text: 'od rána se motám', utterance_index: 0, reason: 'non_idempotent_handoff' },
      ],
    };
    const { structured_facts } = sanitizeFacts(parsed, NOW);
    check(structured_facts.some(f => f.payload?.evidence_type === 'sedentary_hours_day'),
      'sedentary_hours_day not affected by acute gait guard');
    check(structured_facts.some(f => f.payload?.obs_type === 'weight_kg'),
      'weight_kg not affected by acute gait guard');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests — require ANTHROPIC_API_KEY
// ─────────────────────────────────────────────────────────────────────────────

const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

if (!hasApiKey) {
  console.log('\n⚠  ANTHROPIC_API_KEY not set — skipping integration tests T1–T5, T11–T12');
  const total = passed + failed;
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  RESULT: ${passed}/${total} passed${failed > 0 ? ` — ${failed} FAILED` : ' — all clear'} (T1–T5, T11–T12 skipped)`);
  console.log(`${'═'.repeat(64)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

const { default: handler } = await import('../api/pre-intake.js');

// ─────────────────────────────────────────────────────────────────────────────
// T1: ASK after vague first message
// ─────────────────────────────────────────────────────────────────────────────
sep('T1: ASK after vague first message');
{
  const req = mockReq({ history: [{ role: 'user', content: 'Tak jsem tady.' }] });
  const res = mockRes();
  await handler(req, res);
  const b = res.body;

  check(res.statusCode === 200,                                  'Status 200');
  check(VALID_OUTCOMES.has(b?.outcome),                          `Valid outcome (got: ${b?.outcome})`);
  check(typeof b?.message === 'string' && b.message.length > 0,  'Has message');
  check(Array.isArray(b?.structured_facts),                      'structured_facts is array');
  check(Array.isArray(b?.deferred_facts),                        'deferred_facts is array');
  check(typeof b?.question_count === 'number',                   'question_count is number');
  if (b?.outcome === 'ASK') {
    check(b.question_count === 1, 'question_count incremented to 1 on ASK');
    check(b.message.includes('?'), 'ASK message contains a question');
  }
  console.log(`  → outcome: ${b?.outcome} | qcount: ${b?.question_count} | "${b?.message?.slice(0, 80)}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T2: AHA after multiple explicit connectable facts
// ─────────────────────────────────────────────────────────────────────────────
sep('T2: AHA after explicitly connectable facts');
{
  const req = mockReq({
    history: [
      { role: 'user',      content: 'Mám cukrovku 2. typu a vím, že moje HbA1c bylo naposledy 7,8 %.' },
      { role: 'assistant', content: 'Jak spíš?' },
      { role: 'user',      content: 'Spím jen 5 hodin a chodím málo — za celý den udělám tak 3000 kroků.' },
    ],
  });
  const res = mockRes();
  await handler(req, res);
  const b = res.body;

  check(res.statusCode === 200,             'Status 200');
  check(VALID_OUTCOMES.has(b?.outcome),     `Valid outcome (got: ${b?.outcome})`);
  check(typeof b?.message === 'string' && b.message.length > 0, 'Has message');
  check(Array.isArray(b?.structured_facts), 'structured_facts is array');
  check(Array.isArray(b?.deferred_facts),   'deferred_facts is array');
  if (b?.outcome === 'AHA') {
    const msg = b.message.toLowerCase();
    check(!msg.includes('způsobuje') && !msg.includes('diagnóza'), 'AHA: no causality/diagnosis language');
  }
  if (b?.structured_facts?.length > 0) {
    check(b.structured_facts.every(f => f.source === 'pre-intake' && f.timestamp), 'structured_facts have source+timestamp');
  }
  console.log(`  → outcome: ${b?.outcome} | sf: ${b?.structured_facts?.length} | df: ${b?.deferred_facts?.length}`);
  console.log(`  → "${b?.message?.slice(0, 100)}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T3: NOT_ENOUGH_YET — 3 assistant turns in history → limit enforced by server
// ─────────────────────────────────────────────────────────────────────────────
sep('T3: NOT_ENOUGH_YET when 3 assistant turns in history');
{
  // Server derives qCount=3 from 3 assistant messages — limit enforced server-side.
  const req = mockReq({
    history: [
      { role: 'user',      content: 'Nevím. Cítím se tak nějak.' },
      { role: 'assistant', content: 'Jak spíš?' },
      { role: 'user',      content: 'No, tak normálně.' },
      { role: 'assistant', content: 'Cvičíš?' },
      { role: 'user',      content: 'Moc ne.' },
      { role: 'assistant', content: 'Jak bys popsal/a svoji únavu?' },
      { role: 'user',      content: 'Taková celková.' },
    ],
  });
  const res = mockRes();
  await handler(req, res);
  const b = res.body;

  check(res.statusCode === 200,               'Status 200');
  check(b?.outcome === 'NOT_ENOUGH_YET',      `Outcome NOT_ENOUGH_YET (got: ${b?.outcome})`);
  check(typeof b?.message === 'string' && b.message.length > 0, 'Has message');
  check(b?.question_count === 3,              'question_count=3 (derived from 3 assistant turns)');
  console.log(`  → outcome: ${b?.outcome} | "${b?.message?.slice(0, 80)}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T4: Medication → deferred_facts, never structured_facts
// ─────────────────────────────────────────────────────────────────────────────
sep('T4: Medication → deferred_facts only');
{
  const req = mockReq({
    history: [{ role: 'user', content: 'Beru Pradaxu 110mg dvakrát denně kvůli fibrilaci síní.' }],
  });
  const res = mockRes();
  await handler(req, res);
  const b = res.body;

  check(res.statusCode === 200,                                        'Status 200');
  check(VALID_OUTCOMES.has(b?.outcome),                                `Valid outcome (got: ${b?.outcome})`);
  check(b?.deferred_facts?.some(f => f.type === 'medication_mention'), 'medication_mention in deferred_facts');
  check(!b?.structured_facts?.some(f =>
    ['MEDICATION_CHANGE', 'GENERAL_HEALTH_REQUEST'].includes(f.event_type)),
    'No medication in structured_facts');

  const medFact = b?.deferred_facts?.find(f => f.type === 'medication_mention');
  if (medFact) {
    check(medFact.reason === 'unsupported_structured_persistence', 'Correct reason');
    check(typeof medFact.raw_text === 'string' && medFact.raw_text.length > 0, 'raw_text present');
  }
  console.log(`  → deferred_facts: ${JSON.stringify(b?.deferred_facts?.map(f => f.type))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T5: Explicit numeric measurement → structured_facts NEW_MEASUREMENT
// ─────────────────────────────────────────────────────────────────────────────
sep('T5: Explicit measurement → structured_facts NEW_MEASUREMENT');
{
  const req = mockReq({
    history: [{ role: 'user', content: 'Z poslední kontroly vím, že mám LDL 4,3 mmol/l a váhu 98 kg.' }],
  });
  const res = mockRes();
  await handler(req, res);
  const b = res.body;

  check(res.statusCode === 200,    'Status 200');
  check(VALID_OUTCOMES.has(b?.outcome), `Valid outcome (got: ${b?.outcome})`);

  const measurements = b?.structured_facts?.filter(f => f.event_type === 'NEW_MEASUREMENT') ?? [];
  check(measurements.length > 0,  `≥1 NEW_MEASUREMENT in structured_facts (got: ${measurements.length})`);
  if (measurements.length > 0) {
    const m = measurements[0];
    check(m.source === 'pre-intake',       'source=pre-intake');
    check(typeof m.timestamp === 'string', 'timestamp present');
    check(typeof m.raw_text === 'string' && m.raw_text.length > 0, 'raw_text present');
    check(typeof m.payload?.obs_type === 'string', 'payload.obs_type present');
    check(typeof m.payload?.value === 'number',    'payload.value is number');
    check(!b?.structured_facts?.some(f => f.event_type === 'MEDICATION_CHANGE'), 'No MEDICATION_CHANGE');
  }
  console.log(`  → structured: ${measurements.map(m => `${m.payload?.obs_type}=${m.payload?.value}`).join(', ')}`);
  console.log(`  → deferred: ${b?.deferred_facts?.length ?? 0} items`);
}

// ─────────────────────────────────────────────────────────────────────────────
// T11: Emergency input → URGENT_SAFETY_EXIT, no Haiku call
// ─────────────────────────────────────────────────────────────────────────────
sep('T11: URGENT_SAFETY_EXIT — emergency input, no Haiku call');
{
  const { EMERGENCY_MESSAGE } = await import('../api/pre-intake.js');

  const cases = [
    'Mám silnou bolest na hrudi a špatně se mi dýchá.',
    'Najednou nemůžu hýbat levou rukou a špatně mluvím.',
    'Nemůžu dýchat.',
  ];

  for (const text of cases) {
    const req = mockReq({ history: [{ role: 'user', content: text }] });
    const res = mockRes();
    const t0  = Date.now();
    await handler(req, res);
    const elapsed = Date.now() - t0;
    const b   = res.body;
    const lbl = `"${text.slice(0, 40)}…"`;

    check(res.statusCode === 200,                  `${lbl} — status 200`);
    check(b?.outcome === 'URGENT_SAFETY_EXIT',     `${lbl} — outcome URGENT_SAFETY_EXIT`);
    check(b?.message === EMERGENCY_MESSAGE,        `${lbl} — exact EMERGENCY_MESSAGE (no Haiku)`);
    check(b?.structured_facts?.length === 0,       `${lbl} — structured_facts empty`);
    check(b?.deferred_facts?.length === 0,         `${lbl} — deferred_facts empty`);
    // Haiku call takes ≥1s — sub-2s response confirms we skipped Haiku
    check(elapsed < 2000, `${lbl} — response < 2s (elapsed: ${elapsed}ms)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T12: question_count bypass — client sends question_count: 0 with 3-turn history
//      Server MUST derive qCount=3 from history and enforce NOT_ENOUGH_YET
// ─────────────────────────────────────────────────────────────────────────────
sep('T12: question_count bypass prevention — server derives from history');
{
  // 3 assistant messages in history = 3 questions already asked.
  // Client claims question_count: 0 — server must ignore it.
  const req = mockReq({
    history: [
      { role: 'user',      content: 'Nevím co říct.' },
      { role: 'assistant', content: 'Jak spíš?' },
      { role: 'user',      content: 'Docela dobře.' },
      { role: 'assistant', content: 'Cvičíš pravidelně?' },
      { role: 'user',      content: 'Někdy.' },
      { role: 'assistant', content: 'Máš nějaké chronické potíže?' },
      { role: 'user',      content: 'Ne, nic zvláštního.' },
    ],
    question_count: 0,   // attacker claims reset — must be ignored
  });
  const res = mockRes();
  await handler(req, res);
  const b = res.body;

  check(res.statusCode === 200,          'Status 200');
  check(b?.outcome === 'NOT_ENOUGH_YET', `NOT_ENOUGH_YET despite question_count: 0 in body (got: ${b?.outcome})`);
  check(b?.question_count === 3,         `Response question_count=3 (derived from history, not client 0; got: ${b?.question_count})`);
  console.log(`  → outcome: ${b?.outcome} | qcount: ${b?.question_count} | "${b?.message?.slice(0, 80)}"`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${'═'.repeat(64)}`);
console.log(`  RESULT: ${passed}/${total} passed${failed > 0 ? ` — ${failed} FAILED` : ' — all clear'}`);
if (skipped > 0) console.log(`  (${skipped} skipped)`);
console.log(`${'═'.repeat(64)}\n`);

process.exit(failed > 0 ? 1 : 0);
