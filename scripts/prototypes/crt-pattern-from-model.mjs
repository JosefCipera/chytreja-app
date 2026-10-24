// crt-pattern-from-model.mjs — PROTOTYPE (read-only, offline): the pattern causal tree for ONE target node,
// built only from data/engine/master.json (no person data, no AI, no DB).
//
// Shows every modelled cause of the target (all ancestors over CAUSES/CONTRIBUTES_TO edges)
// plus what the target is a marker for. Person evidence can be overlaid with --confirmed.
//
// Usage: node scripts/prototypes/crt-pattern-from-model.mjs ERECTILE_DYSFUNCTION [--confirmed ID,ID] [--out file.json]

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const _dir   = dirname(fileURLToPath(import.meta.url));
const MASTER = JSON.parse(readFileSync(join(_dir, '../../data/engine/master.json'), 'utf8'));
const CAUSAL = new Set(['CAUSES', 'CONTRIBUTES_TO']);
const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
const opt = n => args.includes(n) ? args[args.indexOf(n) + 1] : null;
const confirmed = new Set((opt('--confirmed') || '').split(',').filter(Boolean));
const outPath = opt('--out');
const nodes = Object.fromEntries(MASTER.nodes.map(n => [n.id, n]));
if (!nodes[target]) { console.error('unknown node', target); process.exit(1); }

const parentsOf = id => MASTER.edges.filter(e => CAUSAL.has(e.relation) && e.to === id).map(e => e.from);
const include = new Set([target]);
const queue = [target];
while (queue.length) for (const p of parentsOf(queue.shift())) if (!include.has(p)) { include.add(p); queue.push(p); }
const consequences = MASTER.edges.filter(e => e.from === target).map(e => e.to);
consequences.forEach(c => include.add(c));

const depth = {};
const dep = id => depth[id] ??= parentsOf(id).length ? 1 + Math.max(...parentsOf(id).map(dep)) : 0;
MASTER.nodes.forEach(n => dep(n.id));

const BRANCH = { cardiovascular: 'RC', metabolic: 'C', lifestyle: 'C', functional: 'L', musculoskeletal: 'L', neurological: 'L' };
const edges = MASTER.edges.filter(e => include.has(e.from) && include.has(e.to));
const textFor = id => {
  const out = edges.filter(e => e.from === id);
  if (id === target) return 'Cílový stav tohoto stromu.';
  if (!out.length) return 'Nejhlubší příčina v modelu pro tento strom.';
  return out.map(e => `Vztah k „${nodes[e.to].label_cs}": ${e.relation === 'RISK_MARKER_FOR' ? 'jen ukazatel, ne příčina' : 'přispívá'}; síla ${e.strength}, kvalita důkazů ${e.evidence_quality}, horizont ${e.time_horizon}.`).join(' ');
};
const graph = {
  title: `Strom příčin: ${nodes[target].label_cs}`, subtitle: 'Vzorová cesta z modelu enginu, bez osobních údajů',
  nodes: [...include].map(id => {
    const n = nodes[id], isEnd = id === target || consequences.includes(id);
    return { id, label: n.label_cs, label_layman: n.label_cs,
      type: isEnd ? 'ude' : parentsOf(id).length ? 'cause' : 'golden_box',
      level: depth[id], branch: BRANCH[n.domain] ?? 'C',
      ...(confirmed.has(id) ? {} : { _inferred: true }),
      panel_text: (confirmed.has(id) ? 'Potvrzeno z údajů. ' : 'Možná příčina podle modelu, u tebe zatím neznámá. ') + textFor(id) };
  }).sort((a, b) => a.level - b.level),
  edges: edges.map(e => ({ from: e.from, to: e.to, relation: e.relation })),
  medications_map: [], interactions: [], _source: { generator: 'scripts/prototypes/crt-pattern-from-model.mjs', model: 'data/engine/master.json' },
};
console.log(`\nStrom pro ${target}: ${graph.nodes.length} uzlů, ${graph.edges.length} hran`);
for (const n of graph.nodes) console.log(`  L${n.level} ${n.id.padEnd(28)} ${n.type.padEnd(10)} ${n._inferred ? 'možné' : 'potvrzeno'}`);
for (const e of graph.edges) console.log(`  ${e.from} ${e.relation === 'RISK_MARKER_FOR' ? '··ukazatel··>' : '──>'} ${e.to}`);
if (outPath) { writeFileSync(outPath, JSON.stringify(graph, null, 2)); console.log(`Zapsáno: ${outPath}`); }
