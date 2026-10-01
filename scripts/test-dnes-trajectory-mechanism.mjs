// test-dnes-trajectory-mechanism.mjs — "Kam směřuji?" / "Co tím změním?" on the DNES screen
//
// Exposes already-computed Decision Engine output to the user, read-only — no new health
// model, no new decision logic:
//   - "Kam směřuji?": current problem → first causal step → reachable Goal Gateway(s),
//     using ONLY goal_gateway_context.gateway_nodes_reached (computeGoalImpact in
//     systemConstraint.js, already computed generically per node — see goalGateways.js for
//     the two gateways: CARDIOVASCULAR_DISEASE, LOSS_OF_FLOOR_RISE_ABILITY). No gateway
//     reachable → no human-stake clause. "může", never "stane se".
//   - "Co tím změním?": primary mechanism target (mechanism_targets[0]) + up to 3 secondary
//     targets with a plain-language phrase — never a flat dump of all mechanism_targets,
//     never derived from the action's label text.
//
// No DB, no network — real orchestrator.js (_buildTrajectoryResponse_test, _buildMechanismResponse_test).
//
// Sections:
//   T1  no causal_context / no curated causal step   → graceful fallback, no crash
//   T2  exactly one Goal Gateway reachable            → single combined sentence
//   T3  no Goal Gateway reachable                     → causal step only, no human-stake clause
//   T4  both Goal Gateways reachable                  → two-sentence form, both named
//   T5  disclaimer sentence always present, "může" not "stane se"
//   M1  no mechanism_targets                          → graceful fallback, no crash
//   M2  0 secondary targets                           → "cílí přímo na X"
//   M3  1 secondary target                            → "Neřešíš jen X. ... i na Y."
//   M4  2-3 secondary targets, capped                 → "Neřešíš jen X. ... Y, Z a W."
//   M5  effect is NOT derived from the action's label text
//   M6  a target with no plain-language phrase is skipped (e.g. ENDOTHELIAL_DYSFUNCTION)
//   S1-S3  full scenario texts, exact match against the approved copy, for all three
//          leverage nodes: EXCESS_ADIPOSITY, LOW_MUSCLE_STRENGTH, PHYSICAL_INACTIVITY
//   G1  Guard F routes "Kam směřuji?" deterministically, through the real processInput
//       dispatcher, without reaching the AI classifier or any engine/DB call
//   G2  same for "Co tím změním?"
//   W1  Proč? (WHY_REQUEST) is completely unaffected by this cut
//
// Run: node scripts/test-dnes-trajectory-mechanism.mjs

import {
  _buildTrajectoryResponse_test as buildTrajectoryResponse,
  _buildMechanismResponse_test as buildMechanismResponse,
  _buildWhyResponse_test as buildWhyResponse,
  processInput,
} from '../api/engine/orchestrator.js';

let passed = 0; let failed = 0;
function check(cond, label, detail = '') {
  if (cond) { console.log(`  ✅  ${label}`); passed++; }
  else       { console.log(`  ❌  ${label}${detail ? `\n      ${detail}` : ''}`); failed++; }
}
function sep(label) { console.log(`\n${'─'.repeat(70)}\n  ${label}\n${'─'.repeat(70)}`); }

const DISCLAIMER = 'Je to možný směr vývoje, ne jistá předpověď.';

const ctxFor = ({ leverageNodeId, affected_nodes = ['X'], gateways = [], action } = {}) => ({
  last_domain_response: { explanation_context: {
    system_leverage: leverageNodeId ? { node_id: leverageNodeId } : null,
    causal_context: affected_nodes.length ? { level: 'medium', affected_nodes, edges_used: [] } : null,
    goal_gateway_context: { gateway_nodes_reached: gateways },
    action_context: action ? { selected: action } : null,
  } },
});

// ── T1 ────────────────────────────────────────────────────────────────────────
sep('T1 — no causal_context / no curated causal step → graceful fallback, no crash');
{
  const r1 = buildTrajectoryResponse({ last_domain_response: { explanation_context: {} } });
  check(r1.mode === 'EXPLAIN', 'T1a: mode = EXPLAIN (no context at all)');
  check(r1.text.length > 0, 'T1a: fallback text present', `text: ${r1.text}`);

  // Real causal data, but the leverage node has no curated CAUSAL_STEP_CS entry — must not
  // produce broken/mechanical grammar, must fall back gracefully instead.
  const r2 = buildTrajectoryResponse(ctxFor({ leverageNodeId: 'HYPERTENSION', affected_nodes: ['ENDOTHELIAL_DYSFUNCTION'] }));
  check(r2.text === r1.text, 'T1b: uncurated leverage node falls back to the same graceful text',
    `text: ${r2.text}`);
}

// ── T2 ────────────────────────────────────────────────────────────────────────
sep('T2 — exactly one Goal Gateway reachable → single combined sentence');
{
  const r = buildTrajectoryResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', affected_nodes: ['INSULIN_RESISTANCE'], gateways: ['CARDIOVASCULAR_DISEASE'],
  }));
  check(r.text.startsWith('Nadměrný tuk může postupně zhoršovat citlivost na inzulín'),
    'T2: causal step + solo gateway phrase in one sentence', `text: ${r.text}`);
  check(r.text.includes('riziku nemocí srdce a cév'), 'T2: gateway phrase present', `text: ${r.text}`);
  check(r.text.endsWith(DISCLAIMER), 'T2: disclaimer present at the end', `text: ${r.text}`);
}

// ── T3 ────────────────────────────────────────────────────────────────────────
sep('T3 — no Goal Gateway reachable → causal step only, no human-stake clause');
{
  const r = buildTrajectoryResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', affected_nodes: ['INSULIN_RESISTANCE'], gateways: [],
  }));
  check(r.text === `Nadměrný tuk může postupně zhoršovat citlivost na inzulín. ${DISCLAIMER}`,
    'T3: exact text — no gateway clause fabricated when none reachable', `text: ${r.text}`);
  check(!r.text.includes('riziku') && !r.text.includes('ohrozit'),
    'T3: no gateway wording leaked in', `text: ${r.text}`);
}

// ── T4 ────────────────────────────────────────────────────────────────────────
sep('T4 — both Goal Gateways reachable → two-sentence form, both named');
{
  const r = buildTrajectoryResponse(ctxFor({
    leverageNodeId: 'PHYSICAL_INACTIVITY', affected_nodes: ['EXCESS_ADIPOSITY'],
    gateways: ['CARDIOVASCULAR_DISEASE', 'LOSS_OF_FLOOR_RISE_ABILITY'],
  }));
  check(r.text.includes('riziko nemocí srdce a cév') && r.text.includes('schopnost zvládat běžné fyzické úkony'),
    'T4: both gateway phrases present', `text: ${r.text}`);
  check(r.text.includes('zároveň'), 'T4: both-gateways connective present', `text: ${r.text}`);
}

// ── T5 ────────────────────────────────────────────────────────────────────────
sep('T5 — disclaimer always present, "může" not "stane se"');
{
  const r = buildTrajectoryResponse(ctxFor({
    leverageNodeId: 'LOW_MUSCLE_STRENGTH', affected_nodes: ['REDUCED_FUNCTIONAL_RESERVE'], gateways: ['LOSS_OF_FLOOR_RISE_ABILITY'],
  }));
  check(r.text.endsWith(DISCLAIMER), 'T5: disclaimer present', `text: ${r.text}`);
  check(r.text.includes('může') && !r.text.includes('stane se'), 'T5: "může" used, "stane se" never used', `text: ${r.text}`);
}

// ── M1 ────────────────────────────────────────────────────────────────────────
sep('M1 — no mechanism_targets → graceful fallback, no crash');
{
  const r = buildMechanismResponse({ last_domain_response: { explanation_context: {} } });
  check(r.mode === 'EXPLAIN', 'M1: mode = EXPLAIN');
  check(r.text.length > 0, 'M1: fallback text present', `text: ${r.text}`);
}

// ── M2 ────────────────────────────────────────────────────────────────────────
sep('M2 — 0 secondary targets → "cílí přímo na X"');
{
  const r = buildMechanismResponse(ctxFor({ action: { mechanism_targets: ['LOW_MUSCLE_STRENGTH'] } }));
  check(r.text === 'Tato akce cílí přímo na svalovou sílu.', 'M2: exact single-target text', `text: ${r.text}`);
}

// ── M3 ────────────────────────────────────────────────────────────────────────
sep('M3 — 1 secondary target → "Neřešíš jen X. ... i na Y."');
{
  const r = buildMechanismResponse(ctxFor({ action: { mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE'] } }));
  check(r.text === 'Neřešíš jen svalovou sílu. Tato akce současně působí i na tvoji funkční rezervu.',
    'M3: exact one-secondary text', `text: ${r.text}`);
}

// ── M4 ────────────────────────────────────────────────────────────────────────
sep('M4 — 2-3 secondary targets, capped at 3');
{
  const r = buildMechanismResponse(ctxFor({
    action: { mechanism_targets: ['EXCESS_ADIPOSITY', 'PHYSICAL_INACTIVITY', 'HYPERTENSION', 'INSULIN_RESISTANCE', 'ENDOTHELIAL_DYSFUNCTION'] },
  }));
  check(r.text === 'Neřešíš jen nadměrný tuk. Tato akce současně působí na pohybovou aktivitu, krevní tlak a citlivost na inzulín. Jednou věcí tak ovlivňuješ několik problémů najednou.',
    'M4: exact capped-at-3 text (5 real mechanism_targets, 1 skipped, 1 would-be-4th never reached)', `text: ${r.text}`);
}

// ── M5 ────────────────────────────────────────────────────────────────────────
sep('M5 — effect is NOT derived from the action label text');
{
  const r = buildMechanismResponse(ctxFor({
    action: {
      label: 'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči',
      mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE'],
    },
  }));
  check(!r.text.includes('Vstaň 5×'), 'M5: raw action label absent from the effect text', `text: ${r.text}`);
}

// ── M6 ────────────────────────────────────────────────────────────────────────
sep('M6 — a mechanism target with no plain-language phrase is skipped, not shown as jargon');
{
  const r = buildMechanismResponse(ctxFor({ action: { mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'ENDOTHELIAL_DYSFUNCTION'] } }));
  check(!r.text.includes('Endoteliální') && !r.text.includes('ENDOTHELIAL'),
    'M6: no clinical jargon leaked in for an uncurated node', `text: ${r.text}`);
  check(r.text === 'Tato akce cílí přímo na svalovou sílu.',
    'M6: falls back to single-target form since the only secondary has no phrase', `text: ${r.text}`);
}

// ── S1 / S2 / S3 — full scenario texts, exact match ────────────────────────────
sep('S1 — EXCESS_ADIPOSITY, exact approved text for both views');
{
  const ctx = ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', affected_nodes: ['INSULIN_RESISTANCE'], gateways: ['CARDIOVASCULAR_DISEASE'],
    action: { mechanism_targets: ['EXCESS_ADIPOSITY', 'PHYSICAL_INACTIVITY', 'HYPERTENSION', 'INSULIN_RESISTANCE', 'ENDOTHELIAL_DYSFUNCTION'] },
  });
  check(buildTrajectoryResponse(ctx).text ===
    'Nadměrný tuk může postupně zhoršovat citlivost na inzulín a tím přispívat k vyššímu riziku nemocí srdce a cév. Je to možný směr vývoje, ne jistá předpověď.',
    'S1: Kam směřuji? — exact approved text');
  check(buildMechanismResponse(ctx).text ===
    'Neřešíš jen nadměrný tuk. Tato akce současně působí na pohybovou aktivitu, krevní tlak a citlivost na inzulín. Jednou věcí tak ovlivňuješ několik problémů najednou.',
    'S1: Co tím změním? — exact approved text');
}

sep('S2 — LOW_MUSCLE_STRENGTH, exact approved text for both views');
{
  const ctx = ctxFor({
    leverageNodeId: 'LOW_MUSCLE_STRENGTH', affected_nodes: ['REDUCED_FUNCTIONAL_RESERVE'], gateways: ['LOSS_OF_FLOOR_RISE_ABILITY'],
    action: { mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE'] },
  });
  check(buildTrajectoryResponse(ctx).text ===
    'Pokles svalové síly může postupně snižovat funkční rezervu a ohrozit schopnost zvládat běžné fyzické úkony — například vstát ze země bez cizí pomoci. Je to možný směr vývoje, ne jistá předpověď.',
    'S2: Kam směřuji? — exact approved text');
  check(buildMechanismResponse(ctx).text ===
    'Neřešíš jen svalovou sílu. Tato akce současně působí i na tvoji funkční rezervu.',
    'S2: Co tím změním? — exact approved text');
}

sep('S3 — PHYSICAL_INACTIVITY, exact approved text for both views');
{
  const ctx = ctxFor({
    leverageNodeId: 'PHYSICAL_INACTIVITY', affected_nodes: ['EXCESS_ADIPOSITY'],
    gateways: ['CARDIOVASCULAR_DISEASE', 'LOSS_OF_FLOOR_RISE_ABILITY'],
    action: { mechanism_targets: ['PHYSICAL_INACTIVITY', 'INSULIN_RESISTANCE'] },
  });
  check(buildTrajectoryResponse(ctx).text ===
    'Dlouhodobý nedostatek pohybu může zvyšovat množství tělesného tuku. Tím může postupně růst riziko nemocí srdce a cév a zároveň se zhoršovat schopnost zvládat běžné fyzické úkony. Je to možný směr vývoje, ne jistá předpověď.',
    'S3: Kam směřuji? — exact approved text');
  check(buildMechanismResponse(ctx).text ===
    'Neřešíš jen pohybovou aktivitu. Tato akce současně působí i na citlivost na inzulín.',
    'S3: Co tím změním? — exact approved text');
}

// ── G1 / G2 ───────────────────────────────────────────────────────────────────
// Real processInput() call. If Guard F did not fire, this would fall through to
// classifyIntent (Haiku), which calls the Anthropic API and would throw/hang without
// ANTHROPIC_API_KEY — so a clean, fast, correct result here is itself proof the LLM
// was never reached, not just an assertion about it.
sep('G1/G2 — Guard F routes both chip texts deterministically, no AI classifier, no DB');
{
  const sessionState = ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', affected_nodes: ['INSULIN_RESISTANCE'], gateways: ['CARDIOVASCULAR_DISEASE'],
    action: { mechanism_targets: ['EXCESS_ADIPOSITY'] },
  });

  const rTraj = await processInput('test-guard-f', 'Kam směřuji?', sessionState);
  check(rTraj.mode === 'EXPLAIN' && rTraj.text.includes('Nadměrný tuk'),
    'G1: "Kam směřuji?" routed to buildTrajectoryResponse via Guard F', `text: ${rTraj.text}`);

  const rMech = await processInput('test-guard-f', 'Co tím změním?', sessionState);
  check(rMech.mode === 'EXPLAIN' && rMech.text.includes('nadměrný tuk'),
    'G2: "Co tím změním?" routed to buildMechanismResponse via Guard F', `text: ${rMech.text}`);
}

// ── W1 ────────────────────────────────────────────────────────────────────────
// Proč? must be completely unaffected by this cut — same builder, same cached-context
// contract, no shared state with the two new builders.
sep('W1 — Proč? (WHY_REQUEST) is unaffected by this cut');
{
  const state = {
    current_action_assignment: { action_id: 'x', label: 'x' },
    last_domain_response: { explanation_context: {
      system_leverage: { node_id: 'LOW_MUSCLE_STRENGTH' },
      action_context: { selected: {
        label: 'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči',
        leverage_affinity: 'PRIMARY',
        goal_impact: { branches: ['FUNCTIONAL_INDEPENDENCE', 'SURVIVAL_HEALTHSPAN'] },
        safety: { level: 'SAFE', modifications_suggested: [] },
      } },
    } },
  };
  const r = buildWhyResponse(state);
  check(r.text === 'Teď je největší páka v oblasti: Snížená svalová síla. ' +
    'Tato akce ji ovlivňuje a podporuje funkční samostatnost a zdravé přežití.',
    'W1: WHY text unchanged from the C4 cut', `text: ${r.text}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-dnes-trajectory-mechanism: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
