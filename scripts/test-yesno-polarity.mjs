// test-yesno-polarity.mjs — X5 regression: yes/no polarity read contract
//
// Root cause (X5): yes/no evidence answers are persisted to user_health_profile.physical
// either as canonical tokens ('yes', 'no', true …) or as the raw reply ("Ne.", "Ano").
// activation.js / inference.js / nextBestAction.js compared against exact canonical
// tokens only → "Ne." to vstat_ze_zeme never activated LOW_MUSCLE_STRENGTH and
// "Ano." to recent_falls never activated FALL_RISK, while the question was already
// considered answered (evidence silently lost).
//
// Fix: evidenceResolution.readYesNo() — one narrow generic polarity reader shared by
// activation, inference and NBA (computeMobilityProfile.fall_history).
// No model, priority, intervention-map or DAILY_DECISION change: the same answer
// written raw or canonically must produce identical engine output (YN-10 parity).
//
// Sections (no DB, no network):
//   YN-1   readYesNo() input → output table
//   YN-2   vstat_ze_zeme "Ne." → LOW_MUSCLE_STRENGTH MEASURED (raw value preserved)
//   YN-3   generic "no" variants on all three functional keys → MEASURED
//   YN-4   vstat_ze_zeme "Ano." → no LOW_MUSCLE_STRENGTH
//   YN-5   recent_falls "Ano." → FALL_RISK CONFIRMED + GAIT_INSTABILITY recent_falls signal
//   YN-6   recent_falls "Ne." → no FALL_RISK (same as 'no')
//   YN-7   balanc_jedna_noha / rovnovaha_zavrene_oci "Ne." → GAIT_INSTABILITY (same as 'ne')
//   YN-8   canonical values unchanged vs. previous exact-match logic
//   YN-9   free-text / hedged / compound / question-specific replies → null, no state
//   YN-10  full pure pipeline parity: raw vs canonical → identical output
//   YN-11  NBA parity: recent_falls "Ano." ≡ 'yes' in computeNextBestAction (DEVICE_FIT)
//
// Run: node scripts/test-yesno-polarity.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readYesNo }               from '../api/engine/evidenceResolution.js';
import { activation }              from '../api/engine/activation.js';
import { inference }               from '../api/engine/inference.js';
import { computeProjections }      from '../api/engine/projections.js';
import { buildInformationNeeds }   from '../api/engine/informationNeeds.js';
import { evaluateDecisionGate }    from '../api/engine/decisionGate.js';
import { computeSystemLeverage }   from '../api/engine/systemLeverage.js';
import { computeSystemConstraint } from '../api/engine/systemConstraint.js';
import { computeNextBestAction }   from '../api/engine/nextBestAction.js';
import { computeDailyDecision }    from '../api/engine/dailyDecision.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const IMAP = JSON.parse(readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8'));

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PERSON = { person_id: 'test-yn', sex: 'male', birth_year: 1968, height_cm: 178 };

function makeCH(physical = {}, diagnoses = []) {
  return {
    diagnoses:             diagnoses.map(id => ({ id, raw_label: id, status: 'confirmed' })),
    medications:           [],
    supplements:           [],
    lifestyle:             {},
    capacity:              {},
    onboarding_inputs:     physical,
    evidence_availability: physical.evidence_availability || {},
    clinical_history_documented: true,
  };
}

function statesFor(physical, diagnoses = [], observations = []) {
  const ch  = makeCH(physical, diagnoses);
  const act = activation(PERSON, ch, observations);
  return [...act, ...inference(act, PERSON, ch, observations)];
}

const byId = (states, id) => states.find(s => s.node_id === id);

// Minimal action pool covering every protocol type of the mapped leverage nodes.
const POOL = [
  { id: 'walk',       label: 'Jdi na procházku 20 minut',    protocol_type: 'TRAINING_PROTOKOL', type: 'timed', duration: 1200, tier: 1, tags: ['kardio'], constraint_exclude: [], intensity: 'LIGHT' },
  { id: 'kardio',     label: 'Svižná chůze 20 minut',        protocol_type: 'KARDIO_PROTOKOL',   type: 'timed', duration: 1200, tier: 1, tags: [], constraint_exclude: [], intensity: 'MODERATE' },
  { id: 'step_down',  label: 'Kontrolovaný sestup z bedny',  protocol_type: 'SILOVY_PROTOKOL',   type: 'reps',  reps: 10,       tier: 1, tags: ['sila'], constraint_exclude: [], intensity: 'MODERATE' },
  { id: 'balance',    label: 'Stůj 30 sekund na jedné noze', protocol_type: 'BALANCE_PROTOKOL',  type: 'timed', duration: 30,   tier: 1, tags: [], constraint_exclude: [], intensity: 'LIGHT' },
  { id: 'unaided',    label: 'Chůze bez pomůcky',            protocol_type: 'ASSISTIVE_PROTOKOL', type: 'timed', duration: 1200, tier: 1, tags: [], constraint_exclude: [], intensity: 'LIGHT', modality: 'UNAIDED',   support_sides: 'none',      stability_support: 'low',       upper_body_demand: 'none',   load_distribution: 'symmetric' },
  { id: 'two_poles',  label: 'Chůze s dvěma holemi',         protocol_type: 'ASSISTIVE_PROTOKOL', type: 'timed', duration: 1200, tier: 1, tags: [], constraint_exclude: [], intensity: 'LIGHT', modality: 'TWO_POLES', support_sides: 'bilateral', stability_support: 'high',      upper_body_demand: 'medium', load_distribution: 'symmetric' },
  { id: 'walker',     label: 'Chůze s chodítkem',            protocol_type: 'ASSISTIVE_PROTOKOL', type: 'timed', duration: 1200, tier: 2, tags: [], constraint_exclude: [], intensity: 'LIGHT', modality: 'WALKER',    support_sides: 'bilateral', stability_support: 'very_high', upper_body_demand: 'low',    load_distribution: 'symmetric' },
];

// Full pure pipeline (mirrors engine.js runEngine without DB I/O).
function runPure(physical, diagnoses = []) {
  const ch = makeCH(physical, diagnoses);
  const observations = physical.sedentary_hours_day != null
    ? [{ obs_type: 'sedentary_hours_day', value: physical.sedentary_hours_day, source: 'physical' }]
    : [];
  const act        = activation(PERSON, ch, observations);
  const all        = [...act, ...inference(act, PERSON, ch, observations)];
  const node_states = all.map(s => ({ ...s, missing_evidence: s.missing_evidence || [] }));
  const projections = computeProjections(all, PERSON, ch);
  const information_needs = buildInformationNeeds(node_states, projections);
  const decision_gate = evaluateDecisionGate(node_states, projections, information_needs, 'test', {
    birth_year: PERSON.birth_year, sex: PERSON.sex, resolved_physical: Object.keys(physical),
  });
  const system_leverage   = computeSystemLeverage(node_states, projections, decision_gate, 'test');
  const system_constraint = computeSystemConstraint(node_states, projections, decision_gate, 'test');
  const leverageNodeId    = system_leverage.selected?.node_id ?? null;
  const map               = leverageNodeId ? IMAP.mappings?.[leverageNodeId] : null;
  let next_best_action    = { status: 'NOT_COMPUTED' };
  if (map) {
    const pts = new Set(map.interventions.flatMap(i => i.protocol_types));
    next_best_action = computeNextBestAction({
      leverageNodeId, interventions: map.interventions,
      actionPool: POOL.filter(a => pts.has(a.protocol_type)), personConstraints: [],
      clinicalHistory: ch, decisionGate: decision_gate, node_states, engineVersion: 'test',
      responseHistory: [], skippedTodayActionIds: new Set(),
    });
  }
  const daily_decision = computeDailyDecision({
    decision_gate, next_best_action, response_evaluations: [], intervention_exposure: [],
  });
  return { node_states, projections, information_needs, decision_gate, system_leverage,
           system_constraint, next_best_action, daily_decision };
}

// Strip timestamps and raw stored answer values (evidence.direct[].value carries the
// answer exactly as persisted, which legitimately differs between "Ne." and 'ne').
function normalizeOutput(o) {
  return JSON.stringify(o, (k, v) => {
    if (k === 'evaluated_at' || k === 'selected_at') return undefined;
    if (k === 'value' && typeof v !== 'object') return '<answer>';
    return v;
  });
}

// ── YN-1: readYesNo table ─────────────────────────────────────────────────────
sep('YN-1 — readYesNo() input → output');
const TABLE = [
  // canonical (backward compatibility)
  ['yes', 'yes'], [true, 'yes'], ['true', 'yes'],
  ['no', 'no'], ['ne', 'no'], [false, 'no'], ['false', 'no'], ['0', 'no'], [0, 'no'],
  // generic Czech polarity — case, surrounding whitespace, trailing punctuation
  ['ano', 'yes'], ['Ano', 'yes'], ['Ano.', 'yes'], ['ANO!', 'yes'], ['  ano  ', 'yes'], ['Ano?', 'yes'], ['Ano…', 'yes'],
  ['Jo', 'yes'], ['jo.', 'yes'], ['Yes', 'yes'], ['TRUE', 'yes'],
  ['Ne', 'no'], ['Ne.', 'no'], ['NE!', 'no'], [' ne ', 'no'], ['Ne!!', 'no'], ['Nene', 'no'], ['nene.', 'no'], ['False', 'no'],
  // "no": only the exact canonical token; Czech colloquial "No." means "yes" → null
  ['No', null], ['No.', null], ['No!', null], ['NO', null], ['no.', null],
  // question-specific sentences — never interpreted by the generic reader
  ['Upadla jsem', null], ['Upadl', null], ['Neupadla jsem', null],
  ['Zvládnu', null], ['Nezvládnu', null], ['Můžu', null], ['Nemůžu', null],
  ['Dokážu', null], ['Nedokážu.', null],
  // compound / hedged / unknown
  ['Ano, ale jen s oporou', null], ['Asi ano', null], ['Spíš ne', null], ['Nevím', null],
  ['Ne, vůbec.', null], ['Ano, bohužel ano', null], ['Ne, bohužel ano', null],
  ['Občas', null], ['Nemám', null],
  // non-answers / other types
  ['', null], ['   ', null], [null, null], [undefined, null], ['1', null], [1, null], [{}, null], [[], null],
];
let tableOk = 0;
for (const [input, expected] of TABLE) {
  const got = readYesNo(input);
  if (got === expected) tableOk++;
  else check(false, `readYesNo(${JSON.stringify(input)}) = ${JSON.stringify(expected)}`, `got ${JSON.stringify(got)}`);
}
check(tableOk === TABLE.length, `readYesNo table: ${tableOk}/${TABLE.length} cases match`);

// ── YN-2: "Ne." → LOW_MUSCLE_STRENGTH MEASURED ───────────────────────────────
sep('YN-2 — vstat_ze_zeme "Ne." → LOW_MUSCLE_STRENGTH MEASURED');
{
  const states = statesFor({ vstat_ze_zeme: 'Ne.' });
  const lms = byId(states, 'LOW_MUSCLE_STRENGTH');
  check(lms?.current_state === 'MEASURED', 'LOW_MUSCLE_STRENGTH = MEASURED', `actual: ${lms?.current_state ?? 'absent'}`);
  check(lms?.evidence?.direct?.some(d => d.question_id === 'vstat_ze_zeme' && d.value === 'Ne.'),
    'evidence.direct keeps the raw stored answer "Ne." (no data rewrite)');
  check(byId(states, 'REDUCED_FUNCTIONAL_RESERVE')?.current_state === 'PREDICTED_CURRENT',
    'REDUCED_FUNCTIONAL_RESERVE = PREDICTED_CURRENT (same downstream as canonical)');
}

// ── YN-3: generic "no" variants on all functional keys ───────────────────────
sep('YN-3 — generic "no" variants on vstat_ze_zeme / vynest_nakup / zvednout_vnouce');
for (const key of ['vstat_ze_zeme', 'vynest_nakup', 'zvednout_vnouce']) {
  for (const v of ['Ne', 'ne.', 'NE!', ' Ne ', 'Nene']) {
    const lms = byId(statesFor({ [key]: v }), 'LOW_MUSCLE_STRENGTH');
    check(lms?.current_state === 'MEASURED', `${key}=${JSON.stringify(v)} → LOW_MUSCLE_STRENGTH MEASURED`,
      `actual: ${lms?.current_state ?? 'absent'}`);
  }
}

// ── YN-4: "Ano." → no LOW_MUSCLE_STRENGTH ────────────────────────────────────
sep('YN-4 — vstat_ze_zeme "Ano." → no LOW_MUSCLE_STRENGTH (same as "yes")');
{
  const lms = byId(statesFor({ vstat_ze_zeme: 'Ano.' }), 'LOW_MUSCLE_STRENGTH');
  check(!lms, 'LOW_MUSCLE_STRENGTH absent', `actual: ${lms?.current_state}`);
}

// ── YN-5: "Ano." → FALL_RISK CONFIRMED ───────────────────────────────────────
sep('YN-5 — recent_falls "Ano." → FALL_RISK CONFIRMED');
for (const v of ['Ano.', 'ano', 'Jo']) {
  const states = statesFor({ recent_falls: v }, ['PERIPHERAL_NEUROPATHY']);
  const fr   = byId(states, 'FALL_RISK');
  const gait = byId(states, 'GAIT_INSTABILITY');
  check(fr?.current_state === 'CONFIRMED', `recent_falls=${JSON.stringify(v)} → FALL_RISK CONFIRMED`,
    `actual: ${fr?.current_state ?? 'absent'}`);
  check(states.filter(s => s.node_id === 'FALL_RISK').length === 1,
    `recent_falls=${JSON.stringify(v)} → exactly one FALL_RISK state (no parallel UNKNOWN)`);
  check(gait?.evidence?.inferred_from_nodes?.some(s => s.question_id === 'recent_falls'),
    `recent_falls=${JSON.stringify(v)} → GAIT_INSTABILITY includes recent_falls supporting signal`);
}

// ── YN-6: "Ne." → no FALL_RISK ───────────────────────────────────────────────
sep('YN-6 — recent_falls "Ne." → no FALL_RISK (same as "no")');
for (const v of ['Ne.', 'ne', 'Nene']) {
  const states = statesFor({ recent_falls: v }, ['PERIPHERAL_NEUROPATHY']);
  check(!byId(states, 'FALL_RISK'), `recent_falls=${JSON.stringify(v)} → FALL_RISK absent`,
    `actual: ${byId(states, 'FALL_RISK')?.current_state}`);
}

// ── YN-7: balance answers ────────────────────────────────────────────────────
sep('YN-7 — balanc_jedna_noha / rovnovaha_zavrene_oci "Ne." → GAIT_INSTABILITY');
for (const key of ['balanc_jedna_noha', 'rovnovaha_zavrene_oci']) {
  const raw  = byId(statesFor({ [key]: 'Ne.' }), 'GAIT_INSTABILITY');
  const canon = byId(statesFor({ [key]: 'ne' }), 'GAIT_INSTABILITY');
  check(raw?.current_state === 'PREDICTED_CURRENT', `${key}="Ne." → GAIT_INSTABILITY PREDICTED_CURRENT`,
    `actual: ${raw?.current_state ?? 'absent'}`);
  check(raw?.confidence === canon?.confidence, `${key}="Ne." confidence equals canonical 'ne'`);
}

// ── YN-8: canonical values unchanged vs. previous logic ──────────────────────
sep('YN-8 — canonical values: same result as previous exact-match logic');
{
  // Previous logic, verbatim semantics (activation.js / inference.js before X5 fix)
  const oldIsNeg = v => ['no', 'false', '0', false, 0].includes(v) || v === 'ne';
  const oldIsYes = v => v === 'yes' || v === true || v === 'true';
  const CANON = ['yes', 'no', 'ne', true, false, 'true', 'false', '0', 0];
  let same = 0, total = 0;
  for (const v of CANON) {
    total += 2;
    if ((readYesNo(v) === 'no')  === oldIsNeg(v)) same++;
    if ((readYesNo(v) === 'yes') === oldIsYes(v)) same++;
  }
  check(same === total, `readYesNo agrees with old isNeg / isYes on all canonical values (${same}/${total})`);

  for (const v of CANON) {
    const lmsOld = oldIsNeg(v);
    const lmsNew = byId(statesFor({ vstat_ze_zeme: v }), 'LOW_MUSCLE_STRENGTH')?.current_state === 'MEASURED';
    const frOld  = oldIsYes(v);
    const frNew  = byId(statesFor({ recent_falls: v }, ['PERIPHERAL_NEUROPATHY']), 'FALL_RISK')?.current_state === 'CONFIRMED';
    check(lmsOld === lmsNew && frOld === frNew,
      `canonical ${JSON.stringify(v)}: LOW_MUSCLE_STRENGTH=${lmsNew}, FALL_RISK CONFIRMED=${frNew} (unchanged)`);
  }
}

// ── YN-9: free text / ambiguous → null, no state ─────────────────────────────
sep('YN-9 — free-text, hedged, compound and question-specific replies → no state');
for (const v of ['Nevím', 'Spíš ne', 'Asi ano', 'Ano, ale jen s oporou', 'Ne, bohužel ano',
                 'No.', 'No!', 'Nemám', 'Nezvládnu', 'Nedokážu', 'Nemůžu', 'Upadla jsem', 'Neupadla jsem']) {
  const lms = byId(statesFor({ vstat_ze_zeme: v }), 'LOW_MUSCLE_STRENGTH');
  const fr  = byId(statesFor({ recent_falls: v }, ['PERIPHERAL_NEUROPATHY']), 'FALL_RISK');
  check(readYesNo(v) === null && !lms && !fr,
    `${JSON.stringify(v)} → null; no LOW_MUSCLE_STRENGTH, no FALL_RISK`,
    `readYesNo=${readYesNo(v)} lms=${lms?.current_state} fall=${fr?.current_state}`);
}

// ── YN-10: full pipeline parity raw vs canonical ─────────────────────────────
sep('YN-10 — full pure pipeline parity: raw answer ≡ canonical answer');
{
  const CASES = [
    ['vstat "Ne." + sedentary 8',   { vstat_ze_zeme: 'Ne.', sedentary_hours_day: 8 }, { vstat_ze_zeme: 'ne', sedentary_hours_day: 8 }, []],
    ['vstat "Ne." (no inactivity)', { vstat_ze_zeme: 'Ne.' },                         { vstat_ze_zeme: 'no' },                         []],
    ['vynest "NE!" + zvednout "Ne"',{ vynest_nakup: 'NE!', zvednout_vnouce: 'Ne' },   { vynest_nakup: 'no', zvednout_vnouce: 'no' },   []],
    ['recent_falls "Ano." + PN',    { recent_falls: 'Ano.' },                         { recent_falls: 'yes' },                         ['PERIPHERAL_NEUROPATHY']],
    ['recent_falls "Ne." + PN',     { recent_falls: 'Ne.' },                          { recent_falls: 'no' },                          ['PERIPHERAL_NEUROPATHY']],
    ['balanc "Ne." + sedentary 8',  { balanc_jedna_noha: 'Ne.', sedentary_hours_day: 8 }, { balanc_jedna_noha: 'ne', sedentary_hours_day: 8 }, []],
  ];
  for (const [label, rawPhys, canonPhys, dx] of CASES) {
    const a = runPure(rawPhys, dx);
    const b = runPure(canonPhys, dx);
    check(normalizeOutput(a) === normalizeOutput(b),
      `${label}: node_states, projections, needs, gate, constraint, leverage, NBA, DAILY_DECISION identical`,
      `raw: ${a.system_constraint.selected?.node_id}/${a.system_leverage.selected?.node_id}/${a.daily_decision.mode} ` +
      `canon: ${b.system_constraint.selected?.node_id}/${b.system_leverage.selected?.node_id}/${b.daily_decision.mode}`);
  }
  const r = runPure({ vstat_ze_zeme: 'Ne.', sedentary_hours_day: 8 });
  check(r.system_constraint.selected?.node_id === 'LOW_MUSCLE_STRENGTH',
    'vstat "Ne." + sedentary 8 → SYSTEM_CONSTRAINT = LOW_MUSCLE_STRENGTH (evidence now changes the model)',
    `actual: ${r.system_constraint.selected?.node_id}`);
}

// ── YN-11: NBA parity (computeMobilityProfile.fall_history) ──────────────────
sep('YN-11 — NBA parity: recent_falls "Ano." ≡ "yes" in computeNextBestAction');
{
  const nbaFor = (physical) => {
    const ch = makeCH(physical, ['PERIPHERAL_NEUROPATHY']);
    const act = activation(PERSON, ch, []);
    const node_states = [...act, ...inference(act, PERSON, ch, [])];
    const gate = evaluateDecisionGate(node_states, [], buildInformationNeeds(node_states, []), 'test', {});
    const map  = IMAP.mappings.GAIT_INSTABILITY;
    const pts  = new Set(map.interventions.flatMap(i => i.protocol_types));
    return computeNextBestAction({
      leverageNodeId: 'GAIT_INSTABILITY', interventions: map.interventions,
      actionPool: POOL.filter(a => pts.has(a.protocol_type)), personConstraints: [],
      clinicalHistory: ch, decisionGate: gate, node_states, engineVersion: 'test',
      responseHistory: [], skippedTodayActionIds: new Set(),
    });
  };
  const safetyOf = nba => JSON.stringify((nba.all_candidates ?? []).map(c => [c.action_id, c.safety]));
  const yes = nbaFor({ recent_falls: 'yes' });
  const raw = nbaFor({ recent_falls: 'Ano.' });
  const no  = nbaFor({ recent_falls: 'no' });
  const rawNo = nbaFor({ recent_falls: 'Ne.' });
  const none  = nbaFor({});
  check(normalizeOutput(raw) === normalizeOutput(yes), '"Ano." → NBA output identical to "yes" (fall_history RECENT)');
  check(normalizeOutput(rawNo) === normalizeOutput(no), '"Ne." → NBA output identical to "no" (fall_history NONE_REPORTED)');
  check(safetyOf(raw) !== safetyOf(none),
    '"Ano." is not read as unanswered — DEVICE_FIT differs from the no-answer baseline');
  check(normalizeOutput(nbaFor({ recent_falls: 'Upadla jsem' })) !== normalizeOutput(yes),
    '"Upadla jsem" (question-specific) is NOT interpreted by the generic reader');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-yesno-polarity: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
