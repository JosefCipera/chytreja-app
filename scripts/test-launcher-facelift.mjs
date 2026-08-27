// scripts/test-launcher-facelift.mjs
// Static regression suite for launcher.html facelift.
// Verifies that all DOM IDs / classes required by JS and tester flow exist.
// No JSDOM — plain string matching on raw HTML.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const html  = readFileSync(resolve(__dir, '../app/launcher.html'), 'utf8');

let passed = 0, failed = 0;

function check(id, label, condition) {
  const ok = condition(html);
  if (ok) {
    console.log(`  ✓ ${id}: ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${id}: ${label}`);
    failed++;
  }
}

console.log('\n── Launcher facelift static regression ─────────────────────────────\n');

// ── Core functional DOM IDs (JS uses these) ──────────────────────────────────
check('LCF-01', '#text-input exists',             h => h.includes('id="text-input"'));
check('LCF-02', '#mic-btn exists',                h => h.includes('id="mic-btn"'));
check('LCF-03', '#send-btn exists',               h => h.includes('id="send-btn"'));
check('LCF-04', '#chips exists',                  h => h.includes('id="chips"'));
check('LCF-05', '#avatar-btn exists',             h => h.includes('id="avatar-btn"'));
check('LCF-06', '#profile-dropdown exists',       h => h.includes('id="profile-dropdown"'));
check('LCF-07', '#logout-btn exists',             h => h.includes('id="logout-btn"'));
check('LCF-08', '#stage-text exists',             h => h.includes('id="stage-text"'));
check('LCF-09', '#mode-badge exists',             h => h.includes('id="mode-badge"'));
check('LCF-10', '#debug-panel exists',            h => h.includes('id="debug-panel"'));
check('LCF-11', '#auth-overlay exists',           h => h.includes('id="auth-overlay"'));
check('LCF-12', '#app exists',                    h => h.includes('id="app"'));

// ── Tester ghost panel (JS attaches handlers here) ───────────────────────────
check('LCF-13', '#tester-panel exists (ghost)',   h => h.includes('id="tester-panel"'));
check('LCF-14', '#btn-session-reset exists',      h => h.includes('id="btn-session-reset"'));
check('LCF-15', '#btn-full-reset exists',         h => h.includes('id="btn-full-reset"'));
check('LCF-16', '#tester-status exists',          h => h.includes('id="tester-status"'));

// ── New facelift elements ─────────────────────────────────────────────────────
check('LCF-17', '#orb exists',                    h => h.includes('id="orb"'));
check('LCF-18', '#stage-label exists',            h => h.includes('id="stage-label"'));
check('LCF-19', '#tester-pill exists',            h => h.includes('id="tester-pill"'));
check('LCF-20', '#tester-modal exists',           h => h.includes('id="tester-modal"'));
check('LCF-21', '#tester-modal-status exists',    h => h.includes('id="tester-modal-status"'));
check('LCF-22', '#menu-tester-item exists',       h => h.includes('id="menu-tester-item"'));
check('LCF-23', '#menu-tester-btn exists',        h => h.includes('id="menu-tester-btn"'));
check('LCF-24', '#btn-modal-full-reset exists',   h => h.includes('id="btn-modal-full-reset"'));
check('LCF-25', '#btn-modal-close exists',        h => h.includes('id="btn-modal-close"'));

// ── CSS classes required by JS ────────────────────────────────────────────────
check('LCF-26', '.hidden class defined',          h => h.includes('.hidden'));
check('LCF-27', '.fade-in class defined',         h => h.includes('.fade-in'));
check('LCF-28', '.chip class defined',            h => h.includes('.chip'));
check('LCF-29', '.icon-btn class defined',        h => h.includes('.icon-btn'));
check('LCF-30', '.profile-dropdown.open defined', h => h.includes('.profile-dropdown.open'));
check('LCF-31', 'mode-badge.act defined',         h => h.includes('.mode-badge.act'));
check('LCF-32', 'mode-badge.hold defined',        h => h.includes('.mode-badge.hold'));

// ── Fonts & visual DNA ────────────────────────────────────────────────────────
check('LCF-33', 'Poppins font linked',            h => h.includes('Poppins'));
check('LCF-34', 'Deep navy background',           h => h.includes('#060d1a'));
check('LCF-35', 'Star field (radial-gradient)',   h => h.includes('radial-gradient(circle 1px'));

// ── Tester ghost hidden via CSS (not JS only) ─────────────────────────────────
check('LCF-36', '#tester-panel display:none !important in CSS', h =>
  h.includes('#tester-panel') && h.includes('display: none !important'));

// ── Mobile / accessibility ────────────────────────────────────────────────────
check('LCF-37', 'dvh viewport unit used',         h => h.includes('100dvh'));
check('LCF-38', 'safe-area-inset respected',      h => h.includes('env(safe-area-inset'));
check('LCF-39', 'min-height 48px+ on chips',      h => h.includes('min-height: 48px'));
check('LCF-40', 'aria-label on mic-btn',          h => h.includes('aria-label="Mikrofon"'));
check('LCF-41', 'aria-label on send-btn',         h => h.includes('aria-label="Odeslat"'));

// ── Orb animation ─────────────────────────────────────────────────────────────
check('LCF-42', 'orbPulse keyframe defined',      h => h.includes('orbPulse'));

// ── Input order: mic before input (mobile-first) ──────────────────────────────
check('LCF-43', 'mic-btn before text-input in DOM', h => {
  const micPos   = h.indexOf('id="mic-btn"');
  const inputPos = h.indexOf('id="text-input"');
  return micPos > -1 && inputPos > -1 && micPos < inputPos;
});

// ── Input hint text ───────────────────────────────────────────────────────────
check('LCF-44', '"Můžeš mluvit nebo psát." hint present', h =>
  h.includes('Můžeš mluvit nebo psát.'));

console.log(`\n── Result: ${passed} passed, ${failed} failed ────────────────────────────\n`);

if (failed > 0) process.exit(1);
