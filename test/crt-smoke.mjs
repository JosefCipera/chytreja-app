/**
 * Smoke test: buildDeterministicCRT musí produkovat stabilní výstup pro referenční profily.
 *
 * Spuštění: npm run test:crt
 * Obnova snapshotu: npm run test:crt -- --update
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const _dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(_dir, '..');
const UPDATE = process.argv.includes('--update');

// Import testované funkce (Windows vyžaduje file:// URL pro ESM dynamic import)
const { buildDeterministicCRT } = await import(new URL('file://' + join(ROOT, 'api/crt-generate.js').replace(/\\/g, '/')));

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadFixture(name) {
  return JSON.parse(readFileSync(join(_dir, 'fixtures', `${name}.json`), 'utf8'));
}

function loadSnapshot(name) {
  const path = join(_dir, 'snapshots', `${name}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function saveSnapshot(name, data) {
  writeFileSync(join(_dir, 'snapshots', `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
}

function extractSnapshot(crt) {
  // Dedup: root může být i v crt.nodes (buildDeterministicCRT to vrací před outer post-processingem)
  const seen = new Set();
  const allNodes = [];
  for (const n of [
    ...(crt.nodes || []),
    ...(crt.root ? [typeof crt.root === 'string' ? { id: crt.root } : crt.root] : []),
  ]) {
    if (n?.id && !seen.has(n.id)) { seen.add(n.id); allNodes.push(n); }
  }
  return {
    nodeIds: allNodes.map(n => n.id).sort(),
    branches: Object.fromEntries(allNodes.map(n => [n.id, n.branch]).sort()),
    levels:   Object.fromEntries(allNodes.map(n => [n.id, n.level]).sort()),
    edges: (crt.edges || []).map(e => `${e.from}→${e.to}`).sort(),
  };
}

function diff(expected, actual, label) {
  const errors = [];

  const missingIds = expected.nodeIds.filter(id => !actual.nodeIds.includes(id));
  const extraIds   = actual.nodeIds.filter(id => !expected.nodeIds.includes(id));
  if (missingIds.length) errors.push(`  CHYBÍ uzly: ${missingIds.join(', ')}`);
  if (extraIds.length)   errors.push(`  NAVÍC uzly: ${extraIds.join(', ')}`);

  for (const id of expected.nodeIds) {
    if (!actual.nodeIds.includes(id)) continue;
    if (expected.branches[id] !== actual.branches[id])
      errors.push(`  ${id}: branch ${expected.branches[id]} ≠ ${actual.branches[id]}`);
    if (expected.levels[id] !== actual.levels[id])
      errors.push(`  ${id}: level ${expected.levels[id]} ≠ ${actual.levels[id]}`);
  }

  const missingEdges = expected.edges.filter(e => !actual.edges.includes(e));
  const extraEdges   = actual.edges.filter(e => !expected.edges.includes(e));
  if (missingEdges.length) errors.push(`  CHYBÍ hrany: ${missingEdges.join(', ')}`);
  if (extraEdges.length)   errors.push(`  NAVÍC hrany: ${extraEdges.join(', ')}`);

  if (errors.length) {
    console.error(`\n❌ ${label}:\n${errors.join('\n')}`);
  } else {
    console.log(`✅ ${label}: OK (${actual.nodeIds.length} uzlů, ${actual.edges.length} hran)`);
  }
  return errors.length === 0;
}

// ── Testy ────────────────────────────────────────────────────────────────────

let allPassed = true;

async function runTest(name, profile, metrics = []) {
  const crt  = await buildDeterministicCRT(profile, metrics);
  const snap = extractSnapshot(crt);

  if (UPDATE || !loadSnapshot(name)) {
    saveSnapshot(name, snap);
    console.log(`📸 ${name}: snapshot uložen (${snap.nodeIds.length} uzlů)`);
    return;
  }

  const expected = loadSnapshot(name);
  const ok = diff(expected, snap, name);
  if (!ok) allPassed = false;
}

// Josef: FaP + ED, bez doctor_notes, magnesium suplementy
await runTest('josef', loadFixture('josef'));

// Kovářová: geriatrická, INFLAMMAGING root, hypothyreóza, periferní neuropatie
await runTest('kovarova', loadFixture('kovarova'));

// ── Výsledek ─────────────────────────────────────────────────────────────────

if (!UPDATE) {
  if (allPassed) {
    console.log('\n✅ Všechny CRT smoke testy prošly.');
    process.exit(0);
  } else {
    console.error('\n❌ Smoke test selhal. Spusť --update pro obnovu snapshotu pokud je změna záměrná.');
    process.exit(1);
  }
}
