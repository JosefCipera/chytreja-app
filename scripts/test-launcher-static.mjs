// test-launcher-static.mjs — static regression tests for app/launcher.html
// Reads the HTML source and asserts structural invariants that guard against
// known regressions. No browser, no network — pure text analysis.
//
// Run: node scripts/test-launcher-static.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const _dir = dirname(fileURLToPath(import.meta.url));
const src  = readFileSync(join(_dir, '../app/launcher.html'), 'utf8');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.log(`  ❌  ${label}${detail ? `\n      detail: ${detail}` : ''}`);
    failed++;
  }
}

console.log('LAUNCHER STATIC REGRESSION TESTS\n');

// ── Full reset busy guard ──────────────────────────────────────────────────────
// Regression: reset button must refuse to fire while an orchestrate request is
// in flight. Without the guard, a concurrent ACTION_COMPLETED INSERT can land
// AFTER the reset DELETE, leaving an orphan COMPLETED row that causes HOLD_TOO_EARLY.

console.log('── Full reset busy guard ─────────────────────────────────────────');

// Strategy: locate the btn-full-reset handler by anchoring on the comment directly
// above it, then search forward for the busy guard and tester-reset fetch.
const handlerAnchorIdx = src.indexOf("// Tester full reset: API call + localStorage clear");
const handlerEndIdx    = src.indexOf('\n  }', src.indexOf('btn-full-reset', handlerAnchorIdx) + 50) + 4;
const handlerBody      = handlerAnchorIdx !== -1 ? src.slice(handlerAnchorIdx, handlerEndIdx) : '';

const busyGuardIdx   = handlerBody.indexOf('if (busy)');
const testerFetchIdx = handlerBody.indexOf("fetch('/api/tester-reset'");

check(
  'LCH-1 busy guard exists in full-reset handler',
  busyGuardIdx !== -1,
  'Expected: if (busy) { testerStatus(...); return; } inside btn-full-reset handler'
);

check(
  'LCH-2 busy guard precedes tester-reset fetch',
  busyGuardIdx !== -1 && testerFetchIdx !== -1 && busyGuardIdx < testerFetchIdx,
  `busy guard at ${busyGuardIdx}, fetch at ${testerFetchIdx} — guard must come first`
);

check(
  'LCH-3 busy guard contains return statement',
  busyGuardIdx !== -1 && handlerBody.slice(busyGuardIdx, busyGuardIdx + 120).includes('return'),
  'Guard must early-return, not just set status'
);

// ── renderIdle terminal state reset ───────────────────────────────────────────
// Regression: after a HOLD response (expects_reply=false, buttons=[]), _terminalState=true
// and inputs are disabled. renderIdle() must restore usable state so that after a reset
// (which calls renderIdle) the user can interact without reloading the page.

console.log('\n── renderIdle terminal state reset ──────────────────────────────');

const renderIdleMatch = src.match(/function renderIdle\(\)\s*\{([\s\S]*?)\n\s*\}/);
const idleBody = renderIdleMatch?.[1] ?? '';

check(
  'LCH-4 renderIdle resets _terminalState to false',
  idleBody.includes('_terminalState = false'),
  'Expected: _terminalState = false; inside renderIdle()'
);

check(
  'LCH-5 renderIdle re-enables $input',
  idleBody.includes('$input.disabled') && idleBody.includes('false'),
  'Expected: $input.disabled = false; inside renderIdle()'
);

check(
  'LCH-6 renderIdle re-enables $sendBtn',
  idleBody.includes('$sendBtn.disabled') && idleBody.includes('false'),
  'Expected: $sendBtn.disabled = false; inside renderIdle()'
);

check(
  'LCH-7 renderIdle re-enables $micBtn',
  idleBody.includes('$micBtn.disabled') && idleBody.includes('false'),
  'Expected: $micBtn.disabled = false; inside renderIdle()'
);

check(
  'LCH-8 _terminalState reset precedes stage/chips mutation',
  idleBody.indexOf('_terminalState = false') < idleBody.indexOf('$stage.className'),
  '_terminalState must be cleared before DOM mutations'
);

// ── Epoch guard still present ─────────────────────────────────────────────────
// Non-regression: epoch guard on orchestrate responses must not have been removed.
console.log('\n── Epoch guard non-regression ───────────────────────────────────');

check(
  'LCH-9 epoch guard present in orchestrate response path',
  src.includes('if (myEpoch !== requestEpoch) return;'),
  'Epoch guard must remain in orchestrate() response handler'
);

check(
  'LCH-10 invalidateRequests increments requestEpoch',
  src.includes('requestEpoch++'),
  'invalidateRequests() must increment epoch'
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n── RESULT: ${passed}/${passed + failed} passed${failed > 0 ? ` — ${failed} FAILED` : ' — all clear'} ──`);
process.exit(failed > 0 ? 1 : 0);
