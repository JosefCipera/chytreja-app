// crt-from-engine.mjs — PROTOTYPE (read-only, offline): causal graph from the ENGINE model.
//
// Takes a fixture profile, runs the engine's activation + inference + projections,
// and prints the personal causal graph in the same node/edge shape as the stored CRT examples.
// No DB, no AI, no API, no changes to crt.html. Nothing is written unless --out is given.
//
// Usage: node scripts/prototypes/crt-from-engine.mjs test/fixtures/josef.json [--out graph.json]

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { activation }         from '../../api/engine/activation.js';
import { inference }          from '../../api/engine/inference.js';
import { computeProjections } from '../../api/engine/projections.js';
import { mapDiagnosis }       from '../../api/engine/adapter.js';

const _dir   = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8'));
const CAUSAL = new Set(['CAUSES', 'CONTRIBUTES_TO']);
const ACTIVE = new Set(['CONFIRMED', 'MEASURED', 'PREDICTED_CURRENT']);

const args    = process.argv.slice(2);
const fixPath = args.find(a => !a.startsWith('--'));
const outPath = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
if (!fixPath) { console.error('usage: crt-from-engine.mjs <fixture.json> [--out file]'); process.exit(1); }
const fixture = JSON.parse(readFileSync(fixPath, 'utf8'));

// ── fixture → engine input (same mapping as scripts/test-nba-kovarova.mjs) ──
const raw = [...(fixture.diagnoses || []), ...(fixture.symptoms || [])];
const person = { person_id: 'FIXTURE', sex: fixture.sex, birth_year: fixture.birth_year, height_cm: fixture._height };
const clinicalHistory = {
  diagnoses: raw.map(r => { const id = mapDiagnosis(r); return id ? { id, raw_label: r, status: 'confirmed' } : null; }).filter(Boolean),
  medications: (fixture.medications || []).map(m => ({ substance: typeof m === 'string' ? m : m?.name, status: 'active' })).filter(m => m.substance),
  supplements: [], lifestyle: { sedentary_work: false, smoking_history: 'unknown', alcohol_history: 'unknown' },
  capacity: {}, onboarding_inputs: {}, clinical_history_documented: false,
};
const observations = (fixture._weight && fixture._height)
  ? [{ obs_type: 'weight_kg', value: fixture._weight, unit: 'kg', measured_at: null, source: 'health_profile', confidence: 'estimated' }] : [];

const activated = activation(person, clinicalHistory, observations);
const inferred  = inference(activated, person, clinicalHistory, observations);
const states    = [...activated, ...inferred];
const projections = computeProjections(states, person, clinicalHistory);

// ── depth (level) over the full model: longest causal path from any root ──
const nodes = Object.fromEntries(MASTER.nodes.map(n => [n.id, n]));
const parents = {}; for (const n of MASTER.nodes) parents[n.id] = [];
for (const e of MASTER.edges) if (CAUSAL.has(e.relation)) parents[e.to].push(e.from);
const depth = {};
const d = id => depth[id] ??= parents[id].length ? 1 + Math.max(...parents[id].map(d)) : 0;
MASTER.nodes.forEach(n => d(n.id));

// ── included nodes: active states + projection targets ──
const stateOf = Object.fromEntries(states.filter(s => ACTIVE.has(s.current_state) && nodes[s.node_id]).map(s => [s.node_id, s]));
const projOf  = Object.fromEntries(projections.filter(p => nodes[p.target_node_id]).map(p => [p.target_node_id, p]));
// One-hop consequences of active nodes that are outcomes ("where this can lead"), shown as POSSIBLE, not asserted.
const possible = new Set();
for (const e of MASTER.edges) {
  if (CAUSAL.has(e.relation) && stateOf[e.from] && !stateOf[e.to] && !projOf[e.to]
      && ['outcome', 'functional_outcome'].includes(nodes[e.to]?.category)
      && !(e.to === 'ERECTILE_DYSFUNCTION' && person.sex === 'female')) possible.add(e.to);  // master.json has no sex attribute per node
}
const ids = new Set([...Object.keys(stateOf), ...Object.keys(projOf), ...possible]);

const BRANCH_BY_DOMAIN = { cardiovascular: 'RC', metabolic: 'C', lifestyle: 'C', functional: 'L', musculoskeletal: 'L', neurological: 'L' };
const PANEL = {
  CONFIRMED: 'Potvrzeno z tvých údajů.',
  MEASURED: 'Vychází z naměřených údajů.',
  PREDICTED_CURRENT: 'Předpoklad podle toho, co o tobě víme. Zatím nepotvrzeno.',
  PROJECTED: 'Odhad rizika podle tvých údajů, ne diagnóza.',
  POSSIBLE: 'Možný důsledek, ne potvrzený stav.',
};
const graphNodes = [...ids].map(id => {
  const n = nodes[id], s = stateOf[id], p = projOf[id];
  const isRoot = parents[id].length === 0;
  const isEnd  = ['outcome', 'functional_outcome'].includes(n.category);
  return {
    id, label: n.label_cs, label_layman: n.label_cs,
    type: isEnd ? 'ude' : isRoot ? 'golden_box' : 'cause',
    level: depth[id], branch: BRANCH_BY_DOMAIN[n.domain] ?? 'C',
    state: s ? s.current_state : p ? 'PROJECTED' : 'POSSIBLE',
    ...(s?.current_state === 'PREDICTED_CURRENT' ? { _inferred: true } : {}),
    ...(p ? { risk: p.risk } : {}),
    panel_text: PANEL[s ? s.current_state : p ? 'PROJECTED' : 'POSSIBLE'],
  };
}).sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));

const graphEdges = MASTER.edges
  .filter(e => ids.has(e.from) && ids.has(e.to))
  .map(e => ({ from: e.from, to: e.to, relation: e.relation, strength: e.strength, evidence_quality: e.evidence_quality }));

// Same top-level shape as app/assets/examples/crt-kovarova.json, so the existing renderer can show it.
const graph = {
  title: 'Graf z modelu enginu', subtitle: 'Prototyp: stav z enginu, ukázková data',
  nodes: graphNodes, edges: graphEdges.map(e => ({ from: e.from, to: e.to, relation: e.relation })),
  medications_map: [], interactions: [],
  _source: { fixture: fixPath, generator: 'scripts/prototypes/crt-from-engine.mjs' },
};

// ── report ──
console.log(`\nProfil: ${fixPath}  (${raw.join(', ') || 'bez diagnóz'})`);
console.log(`Mapováno na uzly: ${clinicalHistory.diagnoses.map(x => x.id).join(', ') || '—'}`);
const unmapped = raw.filter(r => !mapDiagnosis(r));
if (unmapped.length) console.log(`Bez uzlu v modelu enginu: ${unmapped.join(', ')}`);
console.log(`\nUzly (${graphNodes.length}):`);
for (const n of graphNodes) console.log(`  L${n.level} ${n.id.padEnd(28)} ${n.type.padEnd(10)} ${n.state}${n._inferred ? ' (předpoklad)' : ''}${n.risk ? ' risk=' + n.risk : ''}`);
console.log(`\nHrany (${graphEdges.length}):`);
for (const e of graphEdges) console.log(`  ${e.from} ${e.relation === 'RISK_MARKER_FOR' ? '··ukazatel··>' : '──>'} ${e.to}`);
if (outPath) { writeFileSync(outPath, JSON.stringify(graph, null, 2)); console.log(`\nZapsáno: ${outPath}`); }
