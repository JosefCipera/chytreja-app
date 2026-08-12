// test-nba-kovarova.mjs — NBA v0.1 out-of-sample test: Kovářová
// Run: node --env-file=.env.local scripts/test-nba-kovarova.mjs
//
// Kovářová does NOT have a real DB account.
// This test uses test/fixtures/kovarova.json as the authoritative data source.
// The mock adapter faithfully mirrors what adapter.js would produce for the same data
// if Kovářová had a DB row — no manual additions beyond what fixture contains.
//
// Data source audit:
//   test/fixtures/kovarova.json — diagnoses, medications, height/weight, birth_year, sex
//   No user_constraints row exists → parsedConstraints = []
//   No node_inputs rows exist → onboarding_inputs = {}
//   No daily_checkin rows exist → observations = [] (weight from physical only)
//   No user_health_profile row exists → clinical_history_documented = false
//   No doctor_notes → bridge produces nothing additional

import { readFileSync }        from 'fs';
import { fileURLToPath }       from 'url';
import { dirname, join }       from 'path';
import { createClient }        from '@supabase/supabase-js';
import { activation }          from '../api/engine/activation.js';
import { inference }           from '../api/engine/inference.js';
import { computeProjections }  from '../api/engine/projections.js';
import { buildInformationNeeds } from '../api/engine/informationNeeds.js';
import { evaluateDecisionGate }  from '../api/engine/decisionGate.js';
import { computeSystemLeverage } from '../api/engine/systemLeverage.js';
import { computeSystemConstraint } from '../api/engine/systemConstraint.js';
import { computeNextBestAction, parsePersonConstraints } from '../api/engine/nextBestAction.js';
// computeMobilityProfile and evaluateDeviceFit are not exported — we compute inline for ONE_CRUTCH scenario

const _dir = dirname(fileURLToPath(import.meta.url));
const ENGINE_VERSION = '1.0.0';
const USER_ID = 'KOVAROVA_FIXTURE';

// ── DIAG_KEYWORDS — mirrors adapter.js exactly ────────────────────────────────
const DIAG_KEYWORDS = [
  { kws: ['fibrilace', 'fap', 'atrial fibrillation', 'arytmie'],                id: 'ATRIAL_FIBRILLATION' },
  { kws: ['hypertenze', 'hypertension', 'vysoký tlak', 'vysoky tlak'],          id: 'HYPERTENSION' },
  { kws: ['dyslipid', 'cholesterol', 'ldl', 'hypercholesterol'],                id: 'DYSLIPIDEMIA' },
  { kws: ['hyperurik', 'kyselina mocova', 'kyselina močová', 'gout', 'dna'],    id: 'HYPERURICEMIA' },
  { kws: ['erektil', 'erectile', 'impotence'],                                  id: 'ERECTILE_DYSFUNCTION' },
  { kws: ['chronicke stres', 'chronický stres', 'burnout', 'vyhoren'],          id: 'CHRONIC_STRESS' },
  { kws: ['obezita', 'obese'],                                                  id: 'OBESITY' },
  { kws: ['nadváha', 'nadva', 'overweight'],                                    id: 'OVERWEIGHT' },
  { kws: ['diabetes', 'cukrovka', 'inzulin'],                                   id: 'INSULIN_RESISTANCE' },
  { kws: ['prostata', 'bph', 'hyperplazie prostaty', 'benign'],                 id: 'BENIGN_PROSTATIC_HYPERPLASIA' },
  { kws: ['extrasystol'],                                                        id: 'EXTRASYSTOLES' },
  { kws: ['fibrilace predsi', 'flutter', 'af ablace', 'ablace'],                id: 'AF_ABLATION' },
  { kws: ['neuropati', 'neuropathy', 'polyneuropati', 'polyneuropathy'],        id: 'PERIPHERAL_NEUROPATHY' },
];

function mapDiagnosis(rawString) {
  const s = rawString.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const { kws, id } of DIAG_KEYWORDS) {
    if (kws.some(kw => s.includes(kw.normalize('NFD').replace(/[̀-ͯ]/g, '')))) return id;
  }
  return null;
}

// ── Build health data from fixture ────────────────────────────────────────────
function buildHealthDataFromFixture(fixture) {
  const person = {
    person_id: USER_ID,
    sex:        fixture.sex,
    birth_year: fixture.birth_year,
    height_cm:  fixture._height,
  };

  // Map structured diagnoses using same DIAG_KEYWORDS as adapter.js
  const rawDiagnoses = [...(fixture.diagnoses || []), ...(fixture.symptoms || [])];
  const diagMapped = rawDiagnoses.map(raw => {
    const id = mapDiagnosis(raw);
    return id ? { id, raw_label: raw, status: 'confirmed' } : null;
  }).filter(Boolean);

  // Record which diagnoses were NOT mapped (critical gap audit)
  const unmappedDiagnoses = rawDiagnoses.filter(raw => !mapDiagnosis(raw));

  const medications = (fixture.medications || []).map(m => ({
    substance: typeof m === 'string' ? m : m?.name,
    dose: m?.dose || null,
    status: 'active',
  })).filter(m => m.substance);

  const clinicalHistory = {
    diagnoses:  diagMapped,
    medications,
    supplements: [],
    lifestyle: {
      sedentary_work: false,  // not in fixture
      smoking_history: 'unknown',
      alcohol_history: 'unknown',
    },
    capacity: {},
    onboarding_inputs: {},       // no node_inputs in DB
    clinical_history_documented: false,  // no user_health_profile row exists
  };

  // Observations: weight from fixture physical data (no date → undated, estimated)
  const observations = [];
  if (fixture._weight && fixture._height) {
    observations.push({
      obs_type: 'weight_kg',
      value: fixture._weight,
      unit: 'kg',
      measured_at: null,
      source: 'health_profile',
      confidence: 'estimated',
    });
  }

  return { person, clinicalHistory, observations, unmappedDiagnoses };
}

// ── Fetch action pool from DB ─────────────────────────────────────────────────
// Tries to fetch new mobility columns; falls back to base columns if migration not yet applied.
async function fetchActionPool(protocolTypes) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('longevity_actions')
    .select('id, node_id, label, protocol_type, type, duration, reps, tier, tags, constraint_exclude, intensity, modality, support_sides, stability_support, upper_body_demand, load_distribution')
    .eq('active', true)
    .in('protocol_type', protocolTypes);

  if (error) {
    if (error.message?.includes('column') || error.message?.includes('modality')) {
      // Migration not yet applied — fall back to base columns
      const { data: data2, error: error2 } = await supabase
        .from('longevity_actions')
        .select('id, node_id, label, protocol_type, type, duration, reps, tier, tags, constraint_exclude, intensity')
        .eq('active', true)
        .in('protocol_type', protocolTypes);
      if (error2) throw new Error(`fetchActionPool fallback: ${error2.message}`);
      console.log('  ⚠️  Mobility columns not yet migrated — modality/support_sides will be null. Run migrations/add_functional_mobility.sql.');
      return data2 ?? [];
    }
    throw new Error(`fetchActionPool: ${error.message}`);
  }
  return data ?? [];
}

// ── Load INTERVENTION_MAP ─────────────────────────────────────────────────────
const INTERVENTION_MAP = JSON.parse(
  readFileSync(join(_dir, '../data/engine/intervention-map.json'), 'utf8')
);

// ══ MAIN ═════════════════════════════════════════════════════════════════════

const fixture = JSON.parse(readFileSync(join(_dir, '../test/fixtures/kovarova.json'), 'utf8'));
const { person, clinicalHistory, observations, unmappedDiagnoses } = buildHealthDataFromFixture(fixture);

const bmi = fixture._weight / ((fixture._height / 100) ** 2);

console.log('\n══════════════════════════════════════════════════════════');
console.log('  NBA v0.1 OUT-OF-SAMPLE TEST — Kovářová');
console.log('══════════════════════════════════════════════════════════\n');

console.log('=== 1. DATA AUDIT ===\n');
console.log(`Person: birth_year=${person.birth_year} (age≈${2026 - person.birth_year}), sex=${person.sex}`);
console.log(`        height=${person.height_cm}cm, weight=${fixture._weight}kg → BMI=${bmi.toFixed(1)}`);
console.log(`\nFixture diagnoses:     ${fixture.diagnoses.join(', ')}`);
console.log(`Mapped to structured:  ${clinicalHistory.diagnoses.map(d => `${d.id} (raw="${d.raw_label}")`).join(', ')}`);
console.log(`UNMAPPED (no DIAG_KEYWORD match): ${unmappedDiagnoses.length ? unmappedDiagnoses.join(', ') : 'none'}`);
console.log(`\nMedications:           ${clinicalHistory.medications.map(m => m.substance).join(', ')}`);
console.log(`user_constraints:      NONE (no DB row exists for Kovářová)`);
console.log(`node_inputs:           NONE (no DB rows)`);
console.log(`daily_checkin:         NONE (no DB rows)`);
console.log(`clinical_history_documented: ${clinicalHistory.clinical_history_documented}`);
console.log(`                       → no user_health_profile row exists`);

// ── Engine pipeline ───────────────────────────────────────────────────────────

const activated = activation(person, clinicalHistory, observations);
const inferred  = inference(activated, person, clinicalHistory, observations);
const allStates = [...activated, ...inferred];
const now       = new Date().toISOString();

const node_states = allStates.map(s => ({
  person_id:          USER_ID,
  node_id:            s.node_id,
  current_state:      s.current_state,
  confidence:         s.confidence,
  evidence:           s.evidence,
  missing_evidence:   s.missing_evidence || [],
  evaluated_at:       now,
  engine_version:     ENGINE_VERSION,
  decision_relevance: null,
}));

console.log('\n=== 2. PERSON_NODE_STATE ===\n');
for (const s of node_states) {
  const directSummary = (s.evidence?.direct ?? []).map(e => {
    if (e.obs_type) return `${e.obs_type}=${e.value}${e.derived_bmi ? ` (BMI=${e.derived_bmi})` : ''}`;
    if (e.type)    return `${e.type}:${e.id ?? e.field}`;
    return e.source;
  }).join(', ');
  console.log(`  ${s.node_id.padEnd(30)} ${s.current_state.padEnd(20)} confidence=${s.confidence.padEnd(8)} evidence=[${directSummary}]`);
}

const projections = computeProjections(allStates, person, clinicalHistory).map(p => ({
  person_id: USER_ID, ...p, evaluated_at: now, engine_version: ENGINE_VERSION,
}));

console.log('\n=== 3. PERSON_PROJECTION ===\n');
for (const p of projections) {
  const pid = p.projection_id ?? p.target_node_id ?? '(id?)';
  console.log(`  ${pid} → risk=${p.risk}, confidence=${p.confidence}`);
}
if (projections.length === 0) console.log('  (none)');

const information_needs = buildInformationNeeds(node_states, projections);
const decision_gate     = evaluateDecisionGate(node_states, projections, information_needs, ENGINE_VERSION);

console.log('\n=== 4. DECISION_GATE ===\n');
for (const g of (decision_gate.context_gates ?? [])) {
  console.log(`  context=${g.decision_context.id} → status=${g.status}`);
  for (const f of (g.actionable_findings ?? [])) {
    console.log(`    └ ${f.entity_id} | ${f.actionability} | ${f.state}`);
  }
  if (g.next_best_evidence) {
    const nbe = g.next_best_evidence;
    console.log(`    ▶ NEXT_BEST_EVIDENCE: ${nbe.evidence_type}`);
    console.log(`      urgency=${nbe.urgency} | impact=${nbe.decision_impact} | cost=${nbe.acquisition_cost} | method=${nbe.acquisition_method}`);
    console.log(`      → ${(nbe.reason ?? '(no reason)')?.slice(0, 160)}`);
  }
}

const system_leverage   = computeSystemLeverage(node_states, projections, decision_gate, ENGINE_VERSION);
const system_constraint = computeSystemConstraint(node_states, projections, decision_gate, ENGINE_VERSION);

console.log('\n=== 5. SYSTEM_LEVERAGE ===\n');
console.log(`  status: ${system_leverage.status}`);
if (system_leverage.selected) {
  console.log(`  selected: ${system_leverage.selected.node_id} (${system_leverage.selected.current_state})`);
  const sb = system_leverage.selection_basis;
  console.log(`  cross_context_leverage: ${sb.cross_context_leverage?.level} [${(sb.cross_context_leverage?.contexts ?? []).join(', ')}]`);
  console.log(`  causal_reach: ${sb.causal_reach?.level} (${sb.causal_reach?.affected_nodes?.length} nodes)`);
  console.log(`  changeability: ${sb.changeability}`);
}
if (system_leverage.missing_model_elements?.length > 0) {
  console.log(`  missing_model_elements: ${system_leverage.missing_model_elements.map(m => `${m.node_id} — ${m.issue}`).join('\n    ')}`);
}
console.log(`\n  Explanation:\n${system_leverage.explanation?.split('\n').map(l => '    ' + l).join('\n')}`);

console.log('\n=== 6. SYSTEM_CONSTRAINT ===\n');
console.log(`  status: ${system_constraint.status}`);
if (system_constraint.selected) {
  const sc = system_constraint.selected;
  console.log(`  selected: ${sc.node_id} (${sc.current_state}, confidence=${sc.confidence})`);
  console.log(`  goal_threat_severity: ${sc.goal_threat_severity}`);
  console.log(`  time_sensitivity:     ${sc.time_sensitivity}`);
  console.log(`  evidence_quality:     ${sc.evidence_quality}`);
  console.log(`  causal_relevance:     ${sc.causal_relevance}`);
  console.log(`  breadth:              ${sc.breadth}`);
  const paths = sc.goal_impact?.terminal_threat_paths ?? [];
  if (paths.length > 0) {
    const p = paths[0];
    console.log(`  threat_path:          ${p.pathway_threat} → ${p.terminal_threat} via ${p.gateway_node} (${p.hop_count} hops)`);
  }
}
if (system_constraint.finalists?.length > 0) {
  console.log(`  finalists: [${system_constraint.finalists.join(', ')}]`);
  if (system_constraint.missing_evidence?.length > 0) {
    console.log(`  missing_evidence to resolve tie:`);
    system_constraint.missing_evidence.forEach(me => console.log(`    - ${me.obs_type}`));
  }
}
if (system_constraint.explanation) {
  console.log(`\n  Explanation:\n${system_constraint.explanation.split('\n').map(l => '    ' + l).join('\n')}`);
}

// ── NBA ───────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════');
console.log('  NEXT_BEST_ACTION v0.1 — Kovářová');
console.log('══════════════════════════════════════════════════════════\n');

const leverageNodeId = system_leverage.selected?.node_id ?? null;
const interventionData = leverageNodeId ? INTERVENTION_MAP.mappings?.[leverageNodeId] : null;

if (!interventionData) {
  console.log(`  status: NOT_COMPUTED`);
  console.log(`  reason: No intervention map for leverage node: ${leverageNodeId ?? 'none'}`);
} else {
  const allProtocolTypes = [...new Set(interventionData.interventions.flatMap(i => i.protocol_types))];
  const actionPool = await fetchActionPool(allProtocolTypes);

  // No DB constraints for Kovářová — use empty array (mirrors what fetchPersonConstraints would return)
  const personConstraints = [];
  const parsedConstraints = parsePersonConstraints(personConstraints);

  console.log(`  Leverage node: ${leverageNodeId}`);
  console.log(`  Protocol types in pool: [${allProtocolTypes.join(', ')}]`);
  console.log(`  Action pool size: ${actionPool.length}`);
  console.log(`  Parsed constraints from DB: ${parsedConstraints.length} (none — no user_constraints rows)`);

  const nba = computeNextBestAction({
    leverageNodeId,
    interventions:   interventionData.interventions,
    actionPool,
    personConstraints,
    clinicalHistory,
    decisionGate:    decision_gate,
    node_states,
    engineVersion:   ENGINE_VERSION,
  });

  console.log(`\n  status: ${nba.status}`);

  if (nba.status === 'SELECTED') {
    const s = nba.selected;
    console.log(`\n  ┌── SELECTED`);
    console.log(`  │  label:            ${s.label}`);
    console.log(`  │  intervention:     ${s.intervention_id}`);
    console.log(`  │  protocol_type:    ${s.protocol_type}`);
    console.log(`  │  intensity:        ${actionPool.find(a => a.id === s.action_id)?.intensity ?? 'unknown'}`);
    console.log(`  │  tier:             ${s.tier}`);
    console.log(`  │  safety:           ${s.safety.level}`);
    console.log(`  │    reason:         ${s.safety.reason}`);
    if (s.safety.modifications_suggested?.length > 0)
      console.log(`  │    mods:           ${s.safety.modifications_suggested.join(' | ')}`);
    console.log(`  │  MME:              ${s.min_meaningful_effect.level}`);
    console.log(`  │  leverage_affinity:${s.leverage_affinity}`);
    console.log(`  │  effect_leverage:  ${s.effect_on_leverage}`);
    console.log(`  │  goal_impact:      ${s.goal_impact.branches.join(', ')}`);
    console.log(`  │  feasibility:      ${s.feasibility}`);
    console.log(`  │  friction:         ${s.friction}`);
    console.log(`  └────`);

    console.log(`\n  Viable / non-viable: ${nba.viable_count} / ${nba.non_viable_count}`);
    console.log(`  CV risk context: ${nba.cv_risk_context}`);
    console.log(`  Clinical history documented: ${nba.clinical_history_documented}`);

    const SAFETY_RANK   = { SAFE: 5, SAFE_WITH_MODIFICATION: 4, NEEDS_MORE_EVIDENCE: 3, NEEDS_CLINICAL_CLEARANCE: 2, CONTRAINDICATED: 1 };
    const MME_RANK      = { MEANINGFUL: 3, PLAUSIBLE: 2, UNKNOWN: 1 };
    const AFFINITY_RANK = { PRIMARY: 4, CONTRIBUTORY: 3, ACCESSORY: 2, UNKNOWN: 1 };
    const FRIC_RANK     = { low: 3, medium: 2, high: 1 };
    const TIME_RANK     = { days: 3, days_to_weeks: 2, weeks: 1, months: 0 };

    const top5 = [...nba.all_candidates]
      .filter(c => ['SAFE','SAFE_WITH_MODIFICATION'].includes(c.safety.level))
      .sort((a, b) => {
        let d;
        d = SAFETY_RANK[b.safety.level] - SAFETY_RANK[a.safety.level]; if (d) return d;
        d = MME_RANK[b.min_meaningful_effect.level] - MME_RANK[a.min_meaningful_effect.level]; if (d) return d;
        d = AFFINITY_RANK[b.leverage_affinity] - AFFINITY_RANK[a.leverage_affinity]; if (d) return d;
        d = FRIC_RANK[b.friction] - FRIC_RANK[a.friction]; if (d) return d;
        return TIME_RANK[b.time_to_feedback] - TIME_RANK[a.time_to_feedback];
      })
      .slice(0, 5);

    console.log('\n  Top 5 viable candidates:');
    for (const c of top5) {
      const apool = actionPool.find(a => a.id === c.action_id);
      console.log(`    ${(c.label ?? '').slice(0,42).padEnd(44)} ${c.safety.level.padEnd(24)} ${c.leverage_affinity.padEnd(14)} friction=${c.friction}`);
    }

    // Non-viable breakdown
    const nonViable = nba.all_candidates.filter(c => !['SAFE','SAFE_WITH_MODIFICATION'].includes(c.safety.level));
    console.log('\n  Non-viable breakdown:');
    const nvBySafety = {};
    for (const c of nonViable) {
      nvBySafety[c.safety.level] = (nvBySafety[c.safety.level] ?? 0) + 1;
    }
    for (const [level, count] of Object.entries(nvBySafety)) {
      console.log(`    ${level}: ${count}`);
    }

  } else {
    console.log(`  reason: ${nba.reason}`);
    if (nba.next_best_question) console.log(`  next_best_question: ${nba.next_best_question}`);
  }
}

// ── ONE_CRUTCH scenario ───────────────────────────────────────────────────────
// Test DEVICE_FIT evaluation: Kovářová + current_assistive_device = ONE_CRUTCH
// Demonstrates engine does NOT recommend switching to two poles — asks for clinical review.
// (GAIT_INSTABILITY intervention pool explicit test — leverage=EXCESS_ADIPOSITY for base run)
console.log('\n══════════════════════════════════════════════════════════');
console.log('  ONE_CRUTCH SCENARIO — DEVICE_FIT evaluation');
console.log('══════════════════════════════════════════════════════════\n');

const clinicalHistoryOneCrutch = {
  ...clinicalHistory,
  onboarding_inputs: { ...clinicalHistory.onboarding_inputs, current_assistive_device: 'ONE_CRUTCH' },
};

// Fetch ASSISTIVE_PROTOKOL + BALANCE actions for explicit GAIT_INSTABILITY pool
const gaitInterventionData = INTERVENTION_MAP.mappings?.['GAIT_INSTABILITY'];
if (gaitInterventionData) {
  const gaitProtocolTypes = [...new Set(gaitInterventionData.interventions.flatMap(i => i.protocol_types))];
  const gaitActionPool = await fetchActionPool(gaitProtocolTypes);

  console.log(`  Mobility profile (ONE_CRUTCH scenario):`);
  console.log(`    instability_type:    PROPRIOCEPTIVE (from PERIPHERAL_NEUROPATHY CONFIRMED)`);
  console.log(`    laterality:          UNKNOWN (PN infers mechanism, NOT bilateral without direct evidence)`);
  console.log(`    fall_history:        UNKNOWN (no recent_falls data)`);
  console.log(`    current_device:      ONE_CRUTCH`);
  console.log(`\n  GAIT_INSTABILITY intervention pool:`);
  console.log(`    Protocol types: [${gaitProtocolTypes.join(', ')}]`);
  console.log(`    Action pool size: ${gaitActionPool.length}`);

  const nbaOneCrutch = computeNextBestAction({
    leverageNodeId:  'GAIT_INSTABILITY',
    interventions:   gaitInterventionData.interventions,
    actionPool:      gaitActionPool,
    personConstraints: [],
    clinicalHistory: clinicalHistoryOneCrutch,
    decisionGate:    decision_gate,
    node_states,
    engineVersion:   ENGINE_VERSION,
  });

  console.log(`\n  status: ${nbaOneCrutch.status}`);

  if (nbaOneCrutch.all_candidates?.length > 0) {
    console.log('\n  All GAIT_INSTABILITY candidates + DEVICE_FIT:');
    for (const c of nbaOneCrutch.all_candidates) {
      const action = gaitActionPool.find(a => a.id === c.action_id);
      const modality = action?.modality ?? 'n/a';
      const deviceFit = c.safety.device_fit;
      const deviceFitStr = deviceFit ? `DEVICE_FIT=${deviceFit.level}` : '';
      console.log(`    ${(c.label ?? '').slice(0, 45).padEnd(47)} ${c.safety.level.padEnd(24)} ${modality.padEnd(12)} ${deviceFitStr}`);
      if ((c.safety.level === 'NEEDS_CLINICAL_CLEARANCE' || c.safety.level === 'NEEDS_MORE_EVIDENCE') && deviceFit) {
        console.log(`      ↳ [${deviceFit.level}] ${deviceFit.reason}`);
      }
      if (c.safety.level === 'SAFE_WITH_MODIFICATION') {
        console.log(`      ↳ ${c.safety.reason?.slice(0, 100)}`);
      }
    }
  }

  // Dynamic verdict derived from engine output
  const oneCrutchCandidate = nbaOneCrutch.all_candidates?.find(c => {
    const a = gaitActionPool.find(a => a.id === c.action_id);
    return a?.modality === 'ONE_CRUTCH';
  });
  const twoPoleCandidate = nbaOneCrutch.all_candidates?.find(c => {
    const a = gaitActionPool.find(a => a.id === c.action_id);
    return a?.modality === 'TWO_POLES';
  });

  console.log('\n  VERDICT:');
  if (oneCrutchCandidate) {
    console.log(`  ONE_CRUTCH: ${oneCrutchCandidate.safety.level} | DEVICE_FIT=${oneCrutchCandidate.safety.device_fit?.level ?? 'n/a'}`);
    console.log(`    ↳ ${oneCrutchCandidate.safety.device_fit?.reason ?? oneCrutchCandidate.safety.reason}`);
  }
  if (twoPoleCandidate) {
    console.log(`  TWO_POLES:  ${twoPoleCandidate.safety.level} | DEVICE_FIT=${twoPoleCandidate.safety.device_fit?.level ?? 'n/a'}`);
    console.log(`    ↳ ${twoPoleCandidate.safety.device_fit?.reason ?? twoPoleCandidate.safety.reason}`);
  }
  const walkerCandidate = nbaOneCrutch.all_candidates?.find(c => gaitActionPool.find(a => a.id === c.action_id)?.modality === 'WALKER');
  if (walkerCandidate) {
    console.log(`  WALKER:     ${walkerCandidate.safety.level} | DEVICE_FIT=${walkerCandidate.safety.device_fit?.level ?? 'n/a'}`);
    console.log(`    ↳ ${walkerCandidate.safety.device_fit?.reason ?? walkerCandidate.safety.reason}`);
  }
  const unaidedCandidate = nbaOneCrutch.all_candidates?.find(c => gaitActionPool.find(a => a.id === c.action_id)?.modality === 'UNAIDED');
  if (unaidedCandidate) {
    console.log(`  UNAIDED:    ${unaidedCandidate.safety.level} | DEVICE_FIT=${unaidedCandidate.safety.device_fit?.level ?? 'n/a'}`);
    console.log(`    ↳ ${unaidedCandidate.safety.device_fit?.reason ?? unaidedCandidate.safety.reason}`);
  }

  if (nbaOneCrutch.status === 'SELECTED') {
    console.log(`\n  Selected (from viable pool): ${nbaOneCrutch.selected?.label ?? 'none'}`);
    console.log(`    safety: ${nbaOneCrutch.selected?.safety?.level}`);
  }
} else {
  console.log('  GAIT_INSTABILITY not in intervention-map — check data/engine/intervention-map.json');
}

// ── Architecture assessment ───────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log('  ARCHITECTURE ASSESSMENT');
console.log('══════════════════════════════════════════════════════════\n');

// Check if any assistive device actions exist in DB
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: assistiveActions } = await supabase
  .from('longevity_actions')
  .select('id, label, protocol_type, tags, intensity, constraint_exclude')
  .eq('active', true)
  .or('label.ilike.%berle%,label.ilike.%hole%,label.ilike.%chodítk%,label.ilike.%chodítkp%,label.ilike.%walker%,label.ilike.%cane%,label.ilike.%crutch%,tags.cs.{berle},tags.cs.{hole},tags.cs.{assistive}');

console.log(`Assistive device actions in longevity_actions: ${assistiveActions?.length ?? 0}`);
if (assistiveActions?.length > 0) {
  for (const a of assistiveActions) {
    console.log(`  ${a.label} | protocol=${a.protocol_type} | tags=${JSON.stringify(a.tags)}`);
  }
} else {
  console.log('  None found — berle, hole, chodítko are NOT in the action catalog.');
}

// Check for fall_risk, gait, balance actions
const { data: fallRiskActions } = await supabase
  .from('longevity_actions')
  .select('id, label, protocol_type, tags, intensity')
  .eq('active', true)
  .or('label.ilike.%rovnováha%,label.ilike.%pád%,label.ilike.%stabilit%,label.ilike.%chůze%,tags.cs.{rovnovaha},tags.cs.{balanc},tags.cs.{chůze}');

console.log(`\nBalance/gait/stability actions in catalog: ${fallRiskActions?.length ?? 0}`);
if (fallRiskActions?.length > 0) {
  for (const a of (fallRiskActions ?? []).slice(0, 8)) {
    console.log(`  ${a.label.slice(0,50)} | ${a.protocol_type} | intensity=${a.intensity} | tags=${JSON.stringify(a.tags)}`);
  }
}

console.log('\n══════════════════════════════════════════════════════════\n');
