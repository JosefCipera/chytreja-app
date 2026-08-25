// scripts/test-post-handoff.mjs — Package 8: post-handoff first decision
//
// Static analysis of launcher.html and landing.html.
// All tests are structural — no browser, no Firebase, no network required.
//
// Run: node scripts/test-post-handoff.mjs

import { readFileSync, existsSync } from 'fs';

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

const LAUNCHER_PATH = 'app/launcher.html';
const LANDING_PATH  = 'app/landing.html';

const launcher = existsSync(LAUNCHER_PATH) ? readFileSync(LAUNCHER_PATH, 'utf-8') : '';
const landing  = existsSync(LANDING_PATH)  ? readFileSync(LANDING_PATH,  'utf-8') : '';

// Positions for order checks — index-based, no brace-counting regex.
const phStart   = launcher.indexOf('if (_isPostHandoff)');
const replacePos = launcher.indexOf("replaceState({}, '', '/launcher')", phStart);
const orchPos    = launcher.indexOf("orchestrate('Co mám dnes dělat?')", phStart);
const returnPos  = launcher.indexOf('return;', phStart);
// "Rough end of the handoff branch" — 700 chars after the if keyword.
// Branch now includes budget-reading code (chj_qbudget) so it's ~600 chars; 700 is generous
// without crossing the normal-flow block that follows.
const phEnd = phStart + 700;

// ── T1: landing.html emits /launcher?handoff=1 after successful handoff ────────

section('T1 — landing.html: post-handoff redirect includes ?handoff=1');
check(
  landing.includes("window.location.href = '/launcher?handoff=1'"),
  "redirect uses '/launcher?handoff=1' (not bare '/launcher')",
);
const allRedirects = [...landing.matchAll(/window\.location\.href\s*=\s*'\/launcher([^']*)'/g)];
for (const m of allRedirects) {
  const suffix = m[1];
  check(
    suffix === '' || suffix === '?handoff=1',
    `launcher redirect suffix "${suffix}" is empty or exactly ?handoff=1`,
  );
  check(
    !/userId|uid|session|fact|token|health/i.test(m[0]),
    `redirect "${m[0].slice(0, 60)}" contains no sensitive keys`,
  );
}
check(allRedirects.length >= 1, 'at least one /launcher redirect found in landing.html');

// ── T2: launcher.html declares _isPostHandoff constant ────────────────────────

section('T2 — launcher.html: _isPostHandoff constant declared');
check(launcher.includes('const _isPostHandoff'),         '_isPostHandoff constant declared');
check(launcher.includes(".get('handoff') === '1'"),       "_isPostHandoff reads ?handoff === '1'");
const paramBlock = launcher.match(/const _debugMode[\s\S]{0,200}/)?.[0] ?? '';
check(paramBlock.includes('_isPostHandoff'), '_isPostHandoff declared alongside _debugMode / _testerMode');

// ── T3: post-handoff branch structure ─────────────────────────────────────────

section('T3 — launcher.html: if (_isPostHandoff) branch in start()');
check(phStart !== -1, 'if (_isPostHandoff) block found in launcher');

// Each key statement must exist within 400 chars of the if keyword
check(replacePos !== -1 && replacePos < phEnd, 'history.replaceState call in handoff branch');
check(orchPos    !== -1 && orchPos    < phEnd, 'orchestrate() call in handoff branch');
check(returnPos  !== -1 && returnPos  < phEnd, 'return; in handoff branch (early exit)');

// Order: replaceState THEN orchestrate
check(
  replacePos !== -1 && orchPos !== -1 && replacePos < orchPos,
  'history.replaceState fires BEFORE orchestrate()',
);

// replaceState target must be bare /launcher
check(
  launcher.includes("replaceState({}, '', '/launcher')"),
  "replaceState target is '/launcher' (URL param cleared)",
);

// ── T4: orchestrate call text ─────────────────────────────────────────────────

section('T4 — launcher.html: post-handoff orchestrate text is a navigation request');
check(
  launcher.includes("orchestrate('Co mám dnes dělat?')"),
  "orchestrate('Co mám dnes dělat?') present",
);
// Text must classify as DOMAIN_REQUEST (rule 7: "co mám dělat / co teď / poraď / co dál")
check(
  !/\d+\s*(kg|mg|mmol|bpm|cm)/i.test('Co mám dnes dělat?'),
  'orchestrate text: no measurement values',
);
check(
  !/diagnóz|lék|symptom|bolest|medikac/i.test('Co mám dnes dělat?'),
  'orchestrate text: no health content keywords',
);

// ── T5: post-handoff branch returns early — normal path unaffected ────────────

section('T5 — launcher.html: return; in handoff branch skips normal init');
// Extract start() body — from function declaration to closing of its outer braces.
// We look for renderIdle() AFTER the return; in the same function.
const startFnMatch = launcher.match(/function start\(userId\)\s*\{([\s\S]+?)\n  \}/);
const startBody    = startFnMatch?.[1] ?? '';
const retInStart   = startBody.indexOf('return;');
const idleInStart  = startBody.lastIndexOf('renderIdle()');
check(retInStart  !== -1, 'return; found in start() body');
check(idleInStart !== -1, 'renderIdle() found in start() body');
check(
  retInStart < idleInStart,
  'return; comes before renderIdle() → normal flow still reachable when _isPostHandoff is false',
);

// ── T6: error recovery ────────────────────────────────────────────────────────

section('T6 — launcher.html: orchestrate() failure shows retry chip');
check(launcher.includes("'Nastala chyba. Zkus to znovu.'"), "catch block sets error text");
check(
  launcher.includes("orchestrate('Co mám dnes dělat?')") && launcher.includes("'Zkusit znovu'"),
  "retry chip reuses same orchestrate text (DOMAIN_REQUEST)",
);

// ── T7: no-repeat guarantee — URL param is cleared ────────────────────────────

section('T7 — launcher.html: ?handoff=1 removed from URL before engine call');
// history.replaceState must target '/launcher' (no params) so refresh has no signal
check(
  launcher.includes("replaceState({}, '', '/launcher')"),
  "replaceState target '/launcher' (no params) → refresh has no ?handoff",
);
// _isPostHandoff is read from URLSearchParams once at module init (const)
// After replaceState the DOM URL changes but _isPostHandoff is already evaluated
check(
  launcher.match(/const _isPostHandoff/) !== null,
  '_isPostHandoff is a const — evaluated once at module init, not re-read after replaceState',
);

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${passed + failed} assertions — ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n${failed} assertion(s) FAILED.`);
  process.exit(1);
} else {
  console.log('\nAll assertions passed.');
}
