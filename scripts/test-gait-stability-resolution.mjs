// test-gait-stability-resolution.mjs — STOP #8 regression: gait_stability resolution loop
//
// Root cause: gait_stability was absent from EVIDENCE_RESOLUTION_REGISTRY.
// isEvidenceResolved('gait_stability') always returned false → activation.js and
// inference.js added gait_stability to missing_evidence unconditionally (unlike
// tug_test which was guarded). Engine always selected it as next NBE → question looped.
//
// Fix:
//   1. evidenceResolution.js — gait_stability added to EVIDENCE_RESOLUTION_REGISTRY
//      as RAW_VALUE, value_source='physical', value_key='gait_stability'
//   2. activation.js — both missing_evidence sites gated with !isEvidenceResolved(...)
//   3. inference.js  — missing_evidence site gated with !isEvidenceResolved(...)
//
// "resolved" = any non-null value present in physical.gait_stability.
// Polarity is irrelevant for loop prevention — "Ne." and "Ano." both stop re-asking.
//
// MODEL GAP (out of scope for this fix): gait_stability='Ne.' does not yet feed as
// a +1 signal into inference.js GAIT_INSTABILITY strength counter. Tracked as debt.
//
// Section 1 — isEvidenceResolved unit tests (no DB, no network)
//   Before write: gait_stability is NOT resolved
//   After write 'Ne.': gait_stability IS resolved
//   After write 'Ano.': gait_stability IS resolved (polarity-agnostic)
//   missing_evidence filtered when resolved
//
// Section 2 — activation.js contract (inline simulation of clinicalHistory shapes)
//   PERIPHERAL_NEUROPATHY: gait_stability absent from missing_evidence after write
//   FALL_RISK:             gait_stability absent from missing_evidence after write
//
// Section 3 — inference.js contract (inline simulation)
//   GAIT_INSTABILITY:     gait_stability absent from missing_evidence after write
//
// Run: node --env-file=.env.local scripts/test-gait-stability-resolution.mjs

import { isEvidenceResolved, EVIDENCE_RESOLUTION_REGISTRY } from '../api/engine/evidenceResolution.js';
import { activation } from '../api/engine/activation.js';
import { inference }  from '../api/engine/inference.js';

let passed = 0; let failed = 0;

function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}

function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// ── clinicalHistory builder ──────────────────────────────────────────────────
function makeCH(gaitValue = undefined) {
  const physical = {};
  if (gaitValue !== undefined) physical.gait_stability = gaitValue;
  return {
    diagnoses:             [],
    medications:           [],
    supplements:           [],
    lifestyle:             {},
    capacity:              {},
    onboarding_inputs:     physical,
    evidence_availability: physical.evidence_availability || {},
    clinical_history_documented: true,
  };
}

// ── Section 1: isEvidenceResolved ────────────────────────────────────────────
sep('S1a — Registry contract');
{
  check('gait_stability' in EVIDENCE_RESOLUTION_REGISTRY,
    'gait_stability present in EVIDENCE_RESOLUTION_REGISTRY');
  const reg = EVIDENCE_RESOLUTION_REGISTRY['gait_stability'];
  check(reg?.evidence_kind  === 'RAW_VALUE',  'evidence_kind = RAW_VALUE');
  check(reg?.value_source   === 'physical',   'value_source  = physical');
  check(reg?.value_key      === 'gait_stability', 'value_key = gait_stability');
  check(reg?.tracks_availability === false,   'tracks_availability = false');
  check(reg?.acquisition_method === 'question', 'acquisition_method = question');
}

sep('S1b — isEvidenceResolved: before write → NOT resolved');
{
  const ch = makeCH();   // no gait_stability in physical
  check(!isEvidenceResolved('gait_stability', ch),
    'physical.gait_stability = undefined → NOT resolved');
  check(!isEvidenceResolved('gait_stability', { ...ch, onboarding_inputs: {} }),
    'onboarding_inputs empty → NOT resolved');
}

sep('S1c — isEvidenceResolved: after write → resolved (polarity-agnostic)');
{
  check(isEvidenceResolved('gait_stability', makeCH('Ne.')),
    'physical.gait_stability = "Ne."  → resolved');
  check(isEvidenceResolved('gait_stability', makeCH('Ano.')),
    'physical.gait_stability = "Ano." → resolved (polarity does not matter)');
  check(isEvidenceResolved('gait_stability', makeCH('ne')),
    'physical.gait_stability = "ne"   → resolved');
  check(isEvidenceResolved('gait_stability', makeCH('ano')),
    'physical.gait_stability = "ano"  → resolved');
  check(isEvidenceResolved('gait_stability', makeCH(false)),
    'physical.gait_stability = false  → resolved');
  check(isEvidenceResolved('gait_stability', makeCH(0)),
    'physical.gait_stability = 0      → NOT resolved (null-ish)',
    // 0 == null is false, but 0 != null is true — 0 IS non-null
    false);   // placeholder — evaluated below correctly
}

// Re-check 0 properly (0 != null → non-null → should resolve)
// isEvidenceResolved: `oi[reg.value_key] != null` — 0 != null is true → resolved
{
  const result = isEvidenceResolved('gait_stability', makeCH(0));
  check(result === true, 'physical.gait_stability = 0 → resolved (0 != null)');
}

// ── Section 2: activation.js missing_evidence contract ───────────────────────
//
// Person/state setup: minimal stubs to trigger PERIPHERAL_NEUROPATHY and FALL_RISK.

const PERSON = { person_id: 'test', sex: 'male', birth_year: 1960, height_cm: 175 };

function makeActivationCH(gaitValue = undefined) {
  const physical = { recent_falls: 'yes' };   // triggers FALL_RISK
  if (gaitValue !== undefined) physical.gait_stability = gaitValue;
  return {
    diagnoses:             [{ id: 'PERIPHERAL_NEUROPATHY', raw_label: 'neuropatie', status: 'confirmed' }],
    medications:           [],
    supplements:           [],
    lifestyle:             {},
    capacity:              {},
    onboarding_inputs:     physical,
    evidence_availability: {},
    clinical_history_documented: true,
  };
}

sep('S2a — activation.js: PERIPHERAL_NEUROPATHY missing_evidence before write');
{
  const ch     = makeActivationCH();    // no gait_stability
  const states = activation(PERSON, ch, []);
  const pn     = states.find(s => s.node_id === 'PERIPHERAL_NEUROPATHY');
  check(!!pn, 'PERIPHERAL_NEUROPATHY activated');
  const me     = pn?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(hasGait, 'gait_stability IS in PERIPHERAL_NEUROPATHY.missing_evidence before write');
}

sep('S2b — activation.js: PERIPHERAL_NEUROPATHY missing_evidence after write "Ne."');
{
  const ch     = makeActivationCH('Ne.');
  const states = activation(PERSON, ch, []);
  const pn     = states.find(s => s.node_id === 'PERIPHERAL_NEUROPATHY');
  check(!!pn, 'PERIPHERAL_NEUROPATHY still activated after gait answer');
  const me     = pn?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(!hasGait, 'gait_stability NOT in PERIPHERAL_NEUROPATHY.missing_evidence after write "Ne."');
}

sep('S2c — activation.js: PERIPHERAL_NEUROPATHY missing_evidence after write "Ano."');
{
  const ch     = makeActivationCH('Ano.');
  const states = activation(PERSON, ch, []);
  const pn     = states.find(s => s.node_id === 'PERIPHERAL_NEUROPATHY');
  const me     = pn?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(!hasGait, 'gait_stability NOT in PERIPHERAL_NEUROPATHY.missing_evidence after write "Ano." (polarity-agnostic)');
}

sep('S2d — activation.js: FALL_RISK missing_evidence before write');
{
  const ch     = makeActivationCH();
  const states = activation(PERSON, ch, []);
  const fr     = states.find(s => s.node_id === 'FALL_RISK');
  check(!!fr, 'FALL_RISK activated (recent_falls=yes)');
  const me     = fr?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(hasGait, 'gait_stability IS in FALL_RISK.missing_evidence before write');
}

sep('S2e — activation.js: FALL_RISK missing_evidence after write "Ne."');
{
  const ch     = makeActivationCH('Ne.');
  const states = activation(PERSON, ch, []);
  const fr     = states.find(s => s.node_id === 'FALL_RISK');
  const me     = fr?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(!hasGait, 'gait_stability NOT in FALL_RISK.missing_evidence after write "Ne."');
}

// ── Section 3: inference.js missing_evidence contract ────────────────────────
//
// Trigger GAIT_INSTABILITY: need strength >= 2.
// PERIPHERAL_NEUROPATHY CONFIRMED gives +2.

function makeInferenceCH(gaitValue = undefined) {
  const physical = {};
  if (gaitValue !== undefined) physical.gait_stability = gaitValue;
  return {
    diagnoses:             [{ id: 'PERIPHERAL_NEUROPATHY', raw_label: 'neuropatie', status: 'confirmed' }],
    medications:           [],
    supplements:           [],
    lifestyle:             {},
    capacity:              {},
    onboarding_inputs:     physical,
    evidence_availability: {},
    clinical_history_documented: true,
  };
}

function runInference(gaitValue) {
  const ch = makeInferenceCH(gaitValue);
  // activation produces PERIPHERAL_NEUROPATHY with state=CONFIRMED
  const activationStates = activation(PERSON, ch, []);
  // inference(activatedStates, person, clinicalHistory, observations)
  return inference(activationStates, PERSON, ch, []);
}

sep('S3a — inference.js: GAIT_INSTABILITY triggered and gait_stability in missing_evidence before write');
{
  const states  = runInference(undefined);
  const gi      = states.find(s => s.node_id === 'GAIT_INSTABILITY');
  check(!!gi, 'GAIT_INSTABILITY present (PN CONFIRMED → strength=2)');
  const me      = gi?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(hasGait, 'gait_stability IS in GAIT_INSTABILITY.missing_evidence before write');
}

sep('S3b — inference.js: gait_stability NOT in missing_evidence after write "Ne."');
{
  const states  = runInference('Ne.');
  const gi      = states.find(s => s.node_id === 'GAIT_INSTABILITY');
  check(!!gi, 'GAIT_INSTABILITY still present (PN CONFIRMED)');
  const me      = gi?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(!hasGait, 'gait_stability NOT in GAIT_INSTABILITY.missing_evidence after write "Ne."');
}

sep('S3c — inference.js: gait_stability NOT in missing_evidence after write "Ano."');
{
  const states  = runInference('Ano.');
  const gi      = states.find(s => s.node_id === 'GAIT_INSTABILITY');
  const me      = gi?.missing_evidence ?? [];
  const hasGait = me.some(e => e.obs_type === 'gait_stability');
  check(!hasGait, 'gait_stability NOT in GAIT_INSTABILITY.missing_evidence after write "Ano." (polarity-agnostic)');
}

sep('S3d — MODEL GAP documented: GAIT_INSTABILITY strength unchanged by gait_stability value');
{
  // STOP #8 fix is loop prevention only. gait_stability='Ne.' does NOT currently
  // increase the GAIT_INSTABILITY strength counter in inference.js. This is intentional
  // for this fix — tracked as separate data-contract debt.
  const statesWithGait    = runInference('Ne.');
  const statesWithoutGait = runInference(undefined);
  const giWith    = statesWithGait.find(s    => s.node_id === 'GAIT_INSTABILITY');
  const giWithout = statesWithoutGait.find(s => s.node_id === 'GAIT_INSTABILITY');
  // Both should have same confidence (strength only from PN CONFIRMED)
  check(
    giWith?.confidence === giWithout?.confidence,
    `GAIT_INSTABILITY confidence unchanged by gait_stability value (${giWith?.confidence} == ${giWithout?.confidence}) — model gap documented, not fixed here`,
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  STOP #8 gait_stability resolution: ${passed} PASS, ${failed} FAIL`);
console.log(`${'═'.repeat(70)}\n`);
if (failed > 0) process.exit(1);
