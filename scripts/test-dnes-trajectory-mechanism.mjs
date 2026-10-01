// test-dnes-trajectory-mechanism.mjs — "Proč?" / "Kam směřuji?" / "Co tím změním?" on the DNES screen
//
// Exposes already-computed Decision Engine output to the user, read-only — no new health
// model, no new decision logic. All three builders read ONLY cached explanation_context /
// causal_context / goal_gateway_context / action_context from last_domain_response.
//
//   - "Proč?": leverage (+ constraint) + known user goal branch(es), humanized. No invented
//     personal goal (e.g. a target age) — that data does not exist in explanation_context.
//   - "Kam směřuji?": current problem → first causal step → reachable Goal Gateway(s), using
//     ONLY goal_gateway_context.gateway_nodes_reached (computeGoalImpact in systemConstraint.js
//     — see goalGateways.js for the two gateways: CARDIOVASCULAR_DISEASE,
//     LOSS_OF_FLOOR_RISE_ABILITY). No gateway reachable → no human-stake clause. "může", never
//     "stane se"; no separate disclaimer sentence appended.
//   - "Co tím změním?": primary mechanism target (mechanism_targets[0]) + up to 3 secondary
//     targets with a plain-language phrase — never a flat dump, never derived from the action's
//     label text. Subject is the action's real label when safe, else "Tato akce" (imperative
//     action labels are not safe sentence subjects — same fix as the C4 WHY cut).
//
// No DB, no network — real orchestrator.js (_buildWhyResponse_test, _buildTrajectoryResponse_test,
// _buildMechanismResponse_test).
//
// Sections:
//   W1  no explanation_context                        → graceful fallback, no crash
//   W2  leverage only, no goal branches known          → generic goal-state fallback phrase
//   W3  leverage + single goal branch                  → one-sentence human form
//   W4  leverage + both goal branches                   → both phrases joined with "a"
//   W5  constraint present and different from leverage  → extra "Zároveň hraje roli…" clause
//   W6  constraint same as leverage                     → no duplicate clause
//   W7  SAFE_WITH_MODIFICATION                          → modification clause appended
//   W8  no forbidden jargon in any producible-node WHY text
//   T1  no causal_context / no curated causal step      → graceful fallback, no crash
//   T2  exactly one Goal Gateway reachable               → single combined sentence
//   T3  no Goal Gateway reachable                        → causal step only, no human-stake clause
//   T4  both Goal Gateways reachable                     → two-sentence form, both named
//   T5  "může" always used, "stane se" never used; no disclaimer sentence appended
//   T6  no forbidden jargon in any producible-node trajectory text
//   M1  no mechanism_targets                            → graceful fallback, no crash
//   M2  0 secondary targets                              → single-sentence form
//   M3  1 secondary target                               → "...ale zároveň zlepšit i Y."
//   M4  2-3 secondary targets, capped                    → "...ale zároveň zlepšit Y, Z a W. Ovlivňuješ..."
//   M5  effect is NOT derived from the action's label text
//   M6  a target with no plain-language phrase is skipped (e.g. ENDOTHELIAL_DYSFUNCTION)
//   M7  imperative action label falls back to "Tato akce" as subject
//   M8  non-imperative (noun-phrase) action label IS used as the real sentence subject
//   S1  EXCESS_ADIPOSITY — exact required texts for all three views
//   S2  LOW_MUSCLE_STRENGTH — texts for all three views, grammatically sound
//   G1  Guard F routes "Kam směřuji?" deterministically, through the real processInput
//       dispatcher, without reaching the AI classifier or any engine/DB call
//   G2  same for "Co tím změním?"
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

// Jargon that must never leak into the three human-facing views when a human equivalent exists.
const FORBIDDEN_JARGON = [
  'největší páka', 'zdravé přežití', 'funkční samostatnost', 'fyzická dekondice', 'endoteliální dysfunkce',
];
function assertNoJargon(text, label) {
  for (const term of FORBIDDEN_JARGON) {
    check(!text.toLowerCase().includes(term.toLowerCase()), `${label}: no "${term}"`, `text: ${text}`);
  }
}

// All 13 currently producible Alpha node_ids (confirmed via activation.js/inference.js).
const PRODUCIBLE_NODES = [
  'ENDOTHELIAL_DYSFUNCTION', 'ERECTILE_DYSFUNCTION', 'EXCESS_ADIPOSITY', 'FALL_RISK',
  'GAIT_INSTABILITY', 'HYPERTENSION', 'INSULIN_RESISTANCE', 'LOSS_OF_FLOOR_RISE_ABILITY',
  'LOW_MUSCLE_STRENGTH', 'PERIPHERAL_NEUROPATHY', 'PHYSICAL_DECONDITIONING',
  'PHYSICAL_INACTIVITY', 'REDUCED_FUNCTIONAL_RESERVE',
];
// Leverage nodes with a real intervention-map.json mapping (mechanism_targets source).
const MAPPED_LEVERAGE_NODES = ['PHYSICAL_INACTIVITY', 'EXCESS_ADIPOSITY', 'GAIT_INSTABILITY', 'LOW_MUSCLE_STRENGTH'];

const ctxFor = ({ leverageNodeId, constraintNodeId, affected_nodes = ['X'], gateways = [], action } = {}) => ({
  current_action_assignment: action ? { action_id: 'a1', label: action.label ?? 'x' } : null,
  last_domain_response: { explanation_context: {
    system_leverage: leverageNodeId ? { node_id: leverageNodeId } : null,
    system_constraint: constraintNodeId ? { node_id: constraintNodeId } : null,
    causal_context: affected_nodes.length ? { level: 'medium', affected_nodes, edges_used: [] } : null,
    goal_gateway_context: { gateway_nodes_reached: gateways },
    action_context: action ? { selected: action } : null,
  } },
});

// ══════════════════════════════════════════════════════════════════════════════
// "Proč?"
// ══════════════════════════════════════════════════════════════════════════════

sep('W1 — no explanation_context → graceful fallback, no crash');
{
  const r = buildWhyResponse({ last_domain_response: {} });
  check(r.mode === 'EXPLAIN', 'W1: mode = EXPLAIN');
  check(r.text.length > 0, 'W1: fallback text present', `text: ${r.text}`);
}

sep('W2 — leverage known, no goal branches → generic goal-state fallback');
{
  const r = buildWhyResponse(ctxFor({ leverageNodeId: 'EXCESS_ADIPOSITY', action: { label: 'x', goal_impact: { branches: [] } } }));
  check(r.text === 'Protože tvůj tuk teď nejvíc ovlivňuje tvůj aktuální zdravotní stav.',
    'W2: exact fallback-goal text', `text: ${r.text}`);
}

sep('W3 — leverage + single goal branch → one-sentence human form');
{
  const r = buildWhyResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY',
    action: { label: 'x', goal_impact: { branches: ['SURVIVAL_HEALTHSPAN'] } },
  }));
  check(r.text === 'Protože tvůj tuk teď nejvíc ovlivňuje tvoje zdraví.',
    'W3: exact single-branch text', `text: ${r.text}`);
}

sep('W4 — leverage + both goal branches → joined with "a"');
{
  const r = buildWhyResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY',
    action: { label: 'x', goal_impact: { branches: ['SURVIVAL_HEALTHSPAN', 'FUNCTIONAL_INDEPENDENCE'] } },
  }));
  check(r.text === 'Protože tvůj tuk teď nejvíc ovlivňuje tvoje zdraví a tvoji soběstačnost.',
    'W4: EXCESS_ADIPOSITY exact required text', `text: ${r.text}`);
}

sep('W5 — constraint present and different from leverage → extra clause');
{
  const r = buildWhyResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', constraintNodeId: 'LOW_MUSCLE_STRENGTH',
    action: { label: 'x', goal_impact: { branches: ['SURVIVAL_HEALTHSPAN'] } },
  }));
  check(r.text === 'Protože tvůj tuk teď nejvíc ovlivňuje tvoje zdraví. Zároveň hraje roli tvoje svalová síla.',
    'W5: exact constraint-clause text', `text: ${r.text}`);
}

sep('W6 — constraint same as leverage → no duplicate clause');
{
  const r = buildWhyResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', constraintNodeId: 'EXCESS_ADIPOSITY',
    action: { label: 'x', goal_impact: { branches: ['SURVIVAL_HEALTHSPAN'] } },
  }));
  check(!r.text.includes('Zároveň hraje roli'), 'W6: no duplicate constraint clause', `text: ${r.text}`);
}

sep('W7 — SAFE_WITH_MODIFICATION → modification clause appended');
{
  const r = buildWhyResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY',
    action: {
      label: 'x', goal_impact: { branches: ['SURVIVAL_HEALTHSPAN'] },
      safety: { level: 'SAFE_WITH_MODIFICATION', modifications_suggested: ['Stop if pain increases'] },
    },
  }));
  check(r.text.endsWith('Doporučená úprava: Přestaň, pokud bolest zesílí.'),
    'W7: modification clause present and translated', `text: ${r.text}`);
}

sep('W8 — no forbidden jargon in WHY text across all producible nodes');
{
  for (const nodeId of PRODUCIBLE_NODES) {
    const r = buildWhyResponse(ctxFor({
      leverageNodeId: nodeId,
      action: { label: 'x', goal_impact: { branches: ['SURVIVAL_HEALTHSPAN', 'FUNCTIONAL_INDEPENDENCE'] } },
    }));
    assertNoJargon(r.text, `W8 ${nodeId}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// "Kam směřuji?"
// ══════════════════════════════════════════════════════════════════════════════

sep('T1 — no causal_context / no curated causal step → graceful fallback, no crash');
{
  const r1 = buildTrajectoryResponse({ last_domain_response: { explanation_context: {} } });
  check(r1.mode === 'EXPLAIN', 'T1a: mode = EXPLAIN (no context at all)');
  check(r1.text.length > 0, 'T1a: fallback text present', `text: ${r1.text}`);

  // ERECTILE_DYSFUNCTION has no outgoing causal edge in master.json — no CAUSAL_STEP_CS entry.
  const r2 = buildTrajectoryResponse(ctxFor({ leverageNodeId: 'ERECTILE_DYSFUNCTION', affected_nodes: ['X'] }));
  check(r2.text === r1.text, 'T1b: uncurated/terminal leverage node falls back to the same graceful text',
    `text: ${r2.text}`);
}

sep('T2 — exactly one Goal Gateway reachable → single combined sentence');
{
  const r = buildTrajectoryResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', affected_nodes: ['INSULIN_RESISTANCE'], gateways: ['CARDIOVASCULAR_DISEASE'],
  }));
  check(r.text === 'Může se ti zhoršovat citlivost na inzulín a zvyšovat riziko nemocí srdce a cév.',
    'T2: EXCESS_ADIPOSITY exact required text', `text: ${r.text}`);
}

sep('T3 — no Goal Gateway reachable → causal step only, no human-stake clause');
{
  const r = buildTrajectoryResponse(ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', affected_nodes: ['INSULIN_RESISTANCE'], gateways: [],
  }));
  check(r.text === 'Může se ti zhoršovat citlivost na inzulín.',
    'T3: exact text — no gateway clause fabricated when none reachable', `text: ${r.text}`);
  check(!r.text.includes('riziku') && !r.text.includes('ohrozit') && !r.text.includes('ohrožovat'),
    'T3: no gateway wording leaked in', `text: ${r.text}`);
}

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

sep('T5 — "může" always used, "stane se" never used, no disclaimer sentence');
{
  const r = buildTrajectoryResponse(ctxFor({
    leverageNodeId: 'LOW_MUSCLE_STRENGTH', affected_nodes: ['REDUCED_FUNCTIONAL_RESERVE'], gateways: ['LOSS_OF_FLOOR_RISE_ABILITY'],
  }));
  check(/může/i.test(r.text) && !r.text.includes('stane se'), 'T5: "může" used, "stane se" never used', `text: ${r.text}`);
  check(!r.text.includes('Je to možný směr vývoje'), 'T5: no separate disclaimer sentence appended', `text: ${r.text}`);
}

sep('T6 — no forbidden jargon in trajectory text across curated producible nodes');
{
  const curated = ['EXCESS_ADIPOSITY', 'LOW_MUSCLE_STRENGTH', 'PHYSICAL_INACTIVITY', 'PHYSICAL_DECONDITIONING',
    'REDUCED_FUNCTIONAL_RESERVE', 'GAIT_INSTABILITY', 'PERIPHERAL_NEUROPATHY', 'HYPERTENSION', 'INSULIN_RESISTANCE'];
  for (const nodeId of curated) {
    const r = buildTrajectoryResponse(ctxFor({
      leverageNodeId: nodeId, affected_nodes: ['X'],
      gateways: ['CARDIOVASCULAR_DISEASE', 'LOSS_OF_FLOOR_RISE_ABILITY'],
    }));
    assertNoJargon(r.text, `T6 ${nodeId}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// "Co tím změním?"
// ══════════════════════════════════════════════════════════════════════════════

sep('M1 — no mechanism_targets → graceful fallback, no crash');
{
  const r = buildMechanismResponse({ last_domain_response: { explanation_context: {} } });
  check(r.mode === 'EXPLAIN', 'M1: mode = EXPLAIN');
  check(r.text.length > 0, 'M1: fallback text present', `text: ${r.text}`);
}

sep('M2 — 0 secondary targets → single-sentence form');
{
  const r = buildMechanismResponse(ctxFor({ action: { label: 'Nějaká akce', mechanism_targets: ['LOW_MUSCLE_STRENGTH'] } }));
  check(r.text === 'Nějaká akce ti pomůže posílit svalovou sílu.', 'M2: exact single-target text', `text: ${r.text}`);
}

sep('M3 — 1 secondary target → "...ale zároveň zlepšit i Y."');
{
  const r = buildMechanismResponse(ctxFor({ action: { label: 'Nějaká akce', mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE'] } }));
  check(r.text === 'Nějaká akce ti pomůže nejen posílit svalovou sílu, ale zároveň zlepšit i celkovou tělesnou odolnost.',
    'M3: exact one-secondary text', `text: ${r.text}`);
}

sep('M4 — 2-3 secondary targets, capped at 3');
{
  const r = buildMechanismResponse(ctxFor({
    action: {
      label: 'Svižná chůze nebo kolo — 20 minut (dá se mluvit)',
      mechanism_targets: ['EXCESS_ADIPOSITY', 'PHYSICAL_INACTIVITY', 'HYPERTENSION', 'INSULIN_RESISTANCE', 'ENDOTHELIAL_DYSFUNCTION'],
    },
  }));
  check(r.text === 'Svižná chůze nebo kolo — 20 minut (dá se mluvit) ti pomůže nejen snížit množství tuku, ' +
    'ale zároveň zlepšit pohybovou aktivitu, krevní tlak a citlivost na inzulín. Ovlivňuješ tak několik problémů najednou.',
    'M4: exact capped-at-3 text (5 real mechanism_targets, 1 skipped, 1 would-be-4th never reached)', `text: ${r.text}`);
}

sep('M5 — effect is NOT derived from the action label text');
{
  const r = buildMechanismResponse(ctxFor({
    action: {
      label: 'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči',
      mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE'],
    },
  }));
  check(!r.text.includes('Vstaň 5×'), 'M5: raw imperative action label absent from the effect text', `text: ${r.text}`);
}

sep('M6 — a mechanism target with no plain-language phrase is skipped, not shown as jargon');
{
  const r = buildMechanismResponse(ctxFor({ action: { label: 'Nějaká akce', mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'PERIPHERAL_NEUROPATHY'] } }));
  assertNoJargon(r.text, 'M6');
  check(r.text === 'Nějaká akce ti pomůže posílit svalovou sílu.',
    'M6: falls back to single-target form since the only secondary has no phrase', `text: ${r.text}`);
}

sep('M7 — imperative action label falls back to "Tato akce" as subject');
{
  const r = buildMechanismResponse(ctxFor({
    action: { label: 'Jdi na procházku 20 minut', mechanism_targets: ['PHYSICAL_INACTIVITY'] },
  }));
  check(r.text.startsWith('Tato akce ti pomůže'), 'M7: imperative label replaced by "Tato akce"', `text: ${r.text}`);
}

sep('M8 — non-imperative (noun-phrase) action label used as the real sentence subject');
{
  const r = buildMechanismResponse(ctxFor({
    action: { label: 'Svižná chůze nebo kolo — 20 minut (dá se mluvit)', mechanism_targets: ['EXCESS_ADIPOSITY'] },
  }));
  check(r.text.startsWith('Svižná chůze nebo kolo — 20 minut (dá se mluvit) ti pomůže'),
    'M8: real action label used as subject', `text: ${r.text}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// S1 / S2 — full scenario texts across all three views
// ══════════════════════════════════════════════════════════════════════════════

sep('S1 — EXCESS_ADIPOSITY, exact required texts for all three views');
{
  const whyCtx = ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY',
    action: { label: 'Svižná chůze nebo kolo — 20 minut (dá se mluvit)', goal_impact: { branches: ['SURVIVAL_HEALTHSPAN', 'FUNCTIONAL_INDEPENDENCE'] } },
  });
  check(buildWhyResponse(whyCtx).text === 'Protože tvůj tuk teď nejvíc ovlivňuje tvoje zdraví a tvoji soběstačnost.',
    'S1: Proč? — exact required text');

  const trajCtx = ctxFor({
    leverageNodeId: 'EXCESS_ADIPOSITY', affected_nodes: ['INSULIN_RESISTANCE'], gateways: ['CARDIOVASCULAR_DISEASE'],
  });
  check(buildTrajectoryResponse(trajCtx).text === 'Může se ti zhoršovat citlivost na inzulín a zvyšovat riziko nemocí srdce a cév.',
    'S1: Kam směřuji? — exact required text');

  const mechCtx = ctxFor({
    action: {
      label: 'Svižná chůze nebo kolo — 20 minut (dá se mluvit)',
      mechanism_targets: ['EXCESS_ADIPOSITY', 'PHYSICAL_INACTIVITY', 'HYPERTENSION', 'INSULIN_RESISTANCE', 'ENDOTHELIAL_DYSFUNCTION'],
    },
  });
  check(buildMechanismResponse(mechCtx).text === 'Svižná chůze nebo kolo — 20 minut (dá se mluvit) ti pomůže nejen snížit množství tuku, ' +
    'ale zároveň zlepšit pohybovou aktivitu, krevní tlak a citlivost na inzulín. Ovlivňuješ tak několik problémů najednou.',
    'S1: Co tím změním? — exact required text');
}

sep('S2 — LOW_MUSCLE_STRENGTH, texts for all three views');
{
  const whyCtx = ctxFor({
    leverageNodeId: 'LOW_MUSCLE_STRENGTH',
    action: { label: 'x', goal_impact: { branches: ['FUNCTIONAL_INDEPENDENCE', 'SURVIVAL_HEALTHSPAN'] } },
  });
  check(buildWhyResponse(whyCtx).text === 'Protože tvoje svalová síla teď nejvíc ovlivňuje tvoji soběstačnost a tvoje zdraví.',
    'S2: Proč? — exact text');

  const trajCtx = ctxFor({
    leverageNodeId: 'LOW_MUSCLE_STRENGTH', affected_nodes: ['REDUCED_FUNCTIONAL_RESERVE'], gateways: ['LOSS_OF_FLOOR_RISE_ABILITY'],
  });
  check(buildTrajectoryResponse(trajCtx).text ===
    'Může se ti snižovat tvoje rezervy síly a ohrožovat schopnost zvládat běžné fyzické úkony — například vstát ze země bez cizí pomoci.',
    'S2: Kam směřuji? — exact text');

  const mechCtx = ctxFor({
    action: {
      label: 'Vstaň 5× ze židle u zdi s oporou rukou; při bolesti, závrati či nejistotě skonči',
      mechanism_targets: ['LOW_MUSCLE_STRENGTH', 'REDUCED_FUNCTIONAL_RESERVE'],
    },
  });
  check(buildMechanismResponse(mechCtx).text === 'Tato akce ti pomůže nejen posílit svalovou sílu, ale zároveň zlepšit i celkovou tělesnou odolnost.',
    'S2: Co tím změním? — exact text (imperative label → "Tato akce" subject)');
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
    action: { label: 'Svižná chůze nebo kolo — 20 minut (dá se mluvit)', mechanism_targets: ['EXCESS_ADIPOSITY'] },
  });

  const rTraj = await processInput('test-guard-f', 'Kam směřuji?', sessionState);
  check(rTraj.mode === 'EXPLAIN' && rTraj.text.includes('citlivost na inzulín'),
    'G1: "Kam směřuji?" routed to buildTrajectoryResponse via Guard F', `text: ${rTraj.text}`);

  const rMech = await processInput('test-guard-f', 'Co tím změním?', sessionState);
  check(rMech.mode === 'EXPLAIN' && rMech.text.includes('množství tuku'),
    'G2: "Co tím změním?" routed to buildMechanismResponse via Guard F', `text: ${rMech.text}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`);
console.log(`  test-dnes-trajectory-mechanism: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(70)}`);
process.exit(failed > 0 ? 1 : 0);
