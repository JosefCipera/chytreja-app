// test-dnes-trajectory-mechanism.mjs — "Kam směřuji?" / "Co tím změním?" on the DNES screen
//
// Exposes already-computed Decision Engine output (systemLeverage's causal_reach,
// an intervention's mechanism_targets) to the user, read-only — no new health model,
// no new decision logic. Verifies:
//   - cautious, qualitative wording (never a number, never personal-certainty framing)
//   - "unknown" risk/confidence is rendered honestly, not papered over
//   - effect text comes from mechanism_targets, never from the action's label text
//   - graceful fallback text when no data is cached yet
//
// No DB, no network — real orchestrator.js (_buildTrajectoryResponse_test, _buildMechanismResponse_test).
//
// Sections:
//   T1  no causal_context                          → graceful fallback, no crash
//   T2  affected_nodes + affected_projections       → qualitative risk/confidence wording, no numbers
//   T3  'unknown' risk/confidence                    → rendered honestly as "zatím nejasné/nejistý", not omitted
//   T4  affected_nodes present, NO affected_projections → node labels only, no fabricated risk/confidence
//   T5  disclaimer sentence always present           → never framed as a certain personal prognosis
//   M1  no mechanism_targets                         → graceful fallback, no crash
//   M2  mechanism_targets present                    → "Tato akce cílí na: <labels>" from mechanism_targets
//   M3  effect text is NOT derived from the action's label                → label text absent from output
//   G1  Guard F routes "Kam směřuji?" deterministically, through the real processInput
//       dispatcher, without reaching the AI classifier or any engine/DB call
//   G2  same for "Co tím změním?"
//
// Run: node scripts/test-dnes-trajectory-mechanism.mjs

import {
  _buildTrajectoryResponse_test as buildTrajectoryResponse,
  _buildMechanismResponse_test as buildMechanismResponse,
  processInput,
} from '../api/engine/orchestrator.js';

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

const NUMBER_RE = /\b\d+(\.\d+)?%?\b/;

// ── T1 ────────────────────────────────────────────────────────────────────────
sep('T1 — no causal_context → graceful fallback, no crash');
{
  const r = buildTrajectoryResponse({ last_domain_response: { explanation_context: {} } });
  check(r.mode === 'EXPLAIN', 'T1: mode = EXPLAIN');
  check(typeof r.text === 'string' && r.text.length > 0, 'T1: fallback text present', `text: ${r.text}`);
  check(!NUMBER_RE.test(r.text), 'T1: fallback text has no number');
}

// ── T2 ────────────────────────────────────────────────────────────────────────
sep('T2 — affected_nodes + affected_projections → qualitative wording, no numbers');
{
  const ctx = {
    last_domain_response: { explanation_context: {
      causal_context: {
        level: 'high',
        affected_nodes: ['HYPERTENSION', 'ENDOTHELIAL_DYSFUNCTION'],
        affected_projections: [
          { target: 'HYPERTENSION', risk: 'medium', confidence: 'medium' },
        ],
        edges_used: [],
      },
    } },
  };
  const r = buildTrajectoryResponse(ctx);
  check(r.text.includes('Arteriální hypertenze'), 'T2: node label resolved via NODE_LABEL_CS', `text: ${r.text}`);
  check(r.text.includes('riziko: střední'), 'T2: qualitative risk wording present', `text: ${r.text}`);
  check(r.text.includes('odhad: středně podložený'), 'T2: qualitative confidence wording present', `text: ${r.text}`);
  check(!NUMBER_RE.test(r.text), 'T2: no raw number anywhere in the text', `text: ${r.text}`);
}

// ── T3 ────────────────────────────────────────────────────────────────────────
sep('T3 — \'unknown\' risk/confidence rendered honestly, not omitted');
{
  const ctx = {
    last_domain_response: { explanation_context: {
      causal_context: {
        level: 'low',
        affected_nodes: ['LOSS_OF_FLOOR_RISE_ABILITY'],
        affected_projections: [
          { target: 'LOSS_OF_FLOOR_RISE_ABILITY', risk: 'unknown', confidence: 'unknown' },
        ],
        edges_used: [],
      },
    } },
  };
  const r = buildTrajectoryResponse(ctx);
  check(r.text.includes('riziko: zatím nejasné'), 'T3: unknown risk rendered as "zatím nejasné"', `text: ${r.text}`);
  check(r.text.includes('odhad: zatím nejistý'), 'T3: unknown confidence rendered as "zatím nejistý"', `text: ${r.text}`);
  check(!r.text.includes('undefined') && !r.text.includes('null'), 'T3: no raw undefined/null leaked into text', `text: ${r.text}`);
}

// ── T4 ────────────────────────────────────────────────────────────────────────
sep('T4 — affected_nodes present, no affected_projections → labels only, nothing fabricated');
{
  const ctx = {
    last_domain_response: { explanation_context: {
      causal_context: {
        level: 'medium',
        affected_nodes: ['INSULIN_RESISTANCE'],
        affected_projections: [],
        edges_used: [],
      },
    } },
  };
  const r = buildTrajectoryResponse(ctx);
  check(r.text.includes('Inzulínová rezistence'), 'T4: node label present', `text: ${r.text}`);
  check(!r.text.includes('riziko:'), 'T4: no risk wording fabricated when no projection exists', `text: ${r.text}`);
  check(!r.text.includes('odhad:'), 'T4: no confidence wording fabricated when no projection exists', `text: ${r.text}`);
}

// ── T5 ────────────────────────────────────────────────────────────────────────
sep('T5 — disclaimer: never framed as a certain personal prognosis');
{
  const ctx = {
    last_domain_response: { explanation_context: {
      causal_context: { level: 'high', affected_nodes: ['HYPERTENSION'], affected_projections: [], edges_used: [] },
    } },
  };
  const r = buildTrajectoryResponse(ctx);
  check(r.text.includes('možnou souvislost') && r.text.includes('ne o jistou předpověď'),
    'T5: disclaimer sentence present', `text: ${r.text}`);
}

// ── M1 ────────────────────────────────────────────────────────────────────────
sep('M1 — no mechanism_targets → graceful fallback, no crash');
{
  const r = buildMechanismResponse({ last_domain_response: { explanation_context: {} } });
  check(r.mode === 'EXPLAIN', 'M1: mode = EXPLAIN');
  check(typeof r.text === 'string' && r.text.length > 0, 'M1: fallback text present', `text: ${r.text}`);
}

// ── M2 ────────────────────────────────────────────────────────────────────────
sep('M2 — mechanism_targets present → effect text built from them');
{
  const ctx = {
    last_domain_response: { explanation_context: {
      action_context: { selected: {
        label: 'Svižná chůze nebo kolo — 20 minut',
        mechanism_targets: ['EXCESS_ADIPOSITY', 'INSULIN_RESISTANCE'],
      } },
    } },
  };
  const r = buildMechanismResponse(ctx);
  check(r.text.includes('Nadměrný tuk'), 'M2: first mechanism target resolved', `text: ${r.text}`);
  check(r.text.includes('Inzulínová rezistence'), 'M2: second mechanism target resolved', `text: ${r.text}`);
}

// ── M3 ────────────────────────────────────────────────────────────────────────
sep('M3 — effect is NOT derived from the action label text');
{
  const ctx = {
    last_domain_response: { explanation_context: {
      action_context: { selected: {
        label: 'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči',
        mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE'],
      } },
    } },
  };
  const r = buildMechanismResponse(ctx);
  check(!r.text.includes('Vstaň 5×'), 'M3: raw action label absent from the effect text', `text: ${r.text}`);
  check(r.text.includes('Snížená svalová síla'), 'M3: effect text comes from mechanism_targets instead', `text: ${r.text}`);
}

// ── G1 / G2 ───────────────────────────────────────────────────────────────────
// Real processInput() call. If Guard F did not fire, this would fall through to
// classifyIntent (Haiku), which calls the Anthropic API and would throw/hang without
// ANTHROPIC_API_KEY — so a clean, fast, correct result here is itself proof the LLM
// was never reached, not just an assertion about it.
sep('G1/G2 — Guard F routes both chip texts deterministically, no AI classifier, no DB');
{
  const sessionState = {
    last_domain_response: { explanation_context: {
      causal_context: { level: 'medium', affected_nodes: ['INSULIN_RESISTANCE'], affected_projections: [], edges_used: [] },
      action_context: { selected: { label: 'x', mechanism_targets: ['EXCESS_ADIPOSITY'] } },
    } },
  };
  const rTraj = await processInput('test-guard-f', 'Kam směřuji?', sessionState);
  check(rTraj.mode === 'EXPLAIN' && rTraj.text.includes('Inzulínová rezistence'),
    'G1: "Kam směřuji?" routed to buildTrajectoryResponse via Guard F', `text: ${rTraj.text}`);

  const rMech = await processInput('test-guard-f', 'Co tím změním?', sessionState);
  check(rMech.mode === 'EXPLAIN' && rMech.text.includes('Nadměrný tuk'),
    'G2: "Co tím změním?" routed to buildMechanismResponse via Guard F', `text: ${rMech.text}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-dnes-trajectory-mechanism: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
