// test-why-response-subject.mjs — buildWhyResponse never splices the raw action label as subject
//
// Original C4 regression: buildWhyResponse spliced the raw action label as the grammatical
// subject of "<label> ji ovlivňuje..." / "<label> cílí na...". Action labels are free text and
// can be an imperative sentence (e.g. sit_to_stand_supported: "...nejistotě skonči"), which
// breaks the sentence: "...skonči ji ovlivňuje..." is not valid Czech.
//
// This cut (human-language "Proč?") replaced the two-sentence "Teď je největší páka..." /
// "Tato akce ji ovlivňuje..." construction entirely: the sentence subject is now always the
// LEVERAGE (or constraint) node's human phrase (WHY_SUBJECT_CS, falling back to NODE_LABEL_CS)
// — the action label itself is never read as a subject candidate at all, so the original bug
// class is structurally impossible, not just avoided by a fallback string. These tests assert
// that invariant directly against the new wording.
//
// No DB, no network — real orchestrator.js (_buildWhyResponse_test, _buildActResponse_test).
//
// Sections:
//   W1  exact live output for LOW_MUSCLE_STRENGTH / sit_to_stand_supported (new human text)
//   W2  imperative action label text never appears anywhere in the WHY text
//   W3  ordinary noun-phrase action label also never appears (subject is never the label)
//   W4  no-leverage branch → generic fallback sentence, no label spliced in either
//   W5  buildActResponse (ACT text) is unaffected — still splices the raw label as before
//
// Run: node scripts/test-why-response-subject.mjs

import {
  _buildWhyResponse_test as buildWhyResponse,
  _buildActResponse_test as buildActResponse,
} from '../api/engine/orchestrator.js';

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

// Real label, live on dev (sit_to_stand_supported, migrations/20260929_functional_strength_training.sql).
const IMPERATIVE_LABEL = 'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči';
const NOUN_LABEL       = 'Tlak nad hlavu — lehký (5 kg)'; // existing SILOVY_PROTOKOL action, real label

const sitToStandAction = {
  label: IMPERATIVE_LABEL,
  leverage_affinity: 'PRIMARY',
  goal_impact: { branches: ['FUNCTIONAL_INDEPENDENCE', 'SURVIVAL_HEALTHSPAN'] },
  safety: { level: 'SAFE', modifications_suggested: [] },
};

const pressAction = {
  label: NOUN_LABEL,
  leverage_affinity: 'PRIMARY',
  goal_impact: { branches: ['SURVIVAL_HEALTHSPAN'] },
  safety: { level: 'SAFE', modifications_suggested: [] },
};

const sessionState = (action, { leverage = null } = {}) => ({
  current_action_assignment: { action_id: 'x', label: action.label },
  last_domain_response: {
    explanation_context: {
      system_leverage:   leverage,
      system_constraint: null,
      action_context:    { selected: action },
    },
  },
});

// ── W1 — exact live output for LOW_MUSCLE_STRENGTH ────────────────────────────
sep('W1 — exact live output for LOW_MUSCLE_STRENGTH / sit_to_stand_supported');
{
  const state = sessionState(sitToStandAction, { leverage: { node_id: 'LOW_MUSCLE_STRENGTH' } });
  const response = buildWhyResponse(state);
  const expected = 'Protože tvoje svalová síla teď nejvíc ovlivňuje tvoji soběstačnost a zdraví.';
  check(response.text === expected, 'W1: exact text match',
    `expected: ${expected}\n      actual:   ${response.text}`);
}

// ── W2 — imperative label does not repeat in the WHY text ─────────────────────
sep('W2 — imperative label text does not appear anywhere in the WHY text');
{
  const state = sessionState(sitToStandAction, { leverage: { node_id: 'LOW_MUSCLE_STRENGTH' } });
  const response = buildWhyResponse(state);
  check(!response.text.includes(IMPERATIVE_LABEL),
    'W2: raw imperative label absent from WHY text', `text: ${response.text}`);
  check(!response.text.includes('skonči'),
    'W2: no broken "...skonči..." fragment', `text: ${response.text}`);
  check(response.text.includes('tvoje svalová síla'),
    'W2: subject is the leverage node phrase, not the action label', `text: ${response.text}`);
}

// ── W3 — ordinary noun-phrase label is also never spliced ─────────────────────
// The fix must be unconditional — the action label is never read as a subject candidate,
// regardless of whether it looks imperative or not.
sep('W3 — ordinary noun-phrase label also never spliced in (subject is never the label)');
{
  const state = sessionState(pressAction, { leverage: { node_id: 'PHYSICAL_INACTIVITY' } });
  const response = buildWhyResponse(state);
  check(!response.text.includes(NOUN_LABEL),
    'W3: noun-phrase label is not spliced into the sentence', `text: ${response.text}`);
  check(response.text.includes('tvůj nedostatek pohybu'),
    'W3: subject is the leverage node phrase', `text: ${response.text}`);
}

// ── W4 — no-leverage branch → generic fallback, no label spliced in ───────────
sep('W4 — no leverage identified → generic fallback sentence, no crash');
{
  const state = sessionState(pressAction, { leverage: null });
  const response = buildWhyResponse(state);
  check(response.text === 'Tahle doporučená akce teď nejvíc odpovídá tvému aktuálnímu zdravotnímu stavu.',
    'W4: exact generic fallback text when no leverage subject is available', `text: ${response.text}`);
  check(!response.text.includes(NOUN_LABEL),
    'W4: label still not spliced in the no-leverage branch', `text: ${response.text}`);
}

// ── W5 — buildActResponse (ACT text) is unaffected ─────────────────────────────
sep('W5 — ACT text unchanged: still splices the raw label as before');
{
  const dd = { primary_item: sitToStandAction };
  const response = buildActResponse(dd, {}, {}, []);
  check(response.text === `${IMPERATIVE_LABEL}.`,
    'W5: ACT text is exactly "<label>." — untouched by the WHY-response fix',
    `actual: ${response.text}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-why-response-subject: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
