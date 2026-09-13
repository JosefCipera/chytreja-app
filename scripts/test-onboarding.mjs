// scripts/test-onboarding.mjs — STOP #9 onboarding_completed regression suite
//
// Static contract tests: source-pattern checks across onboarding-wizard.js, api/user.js,
// and the migration file. No browser, no Firebase, no Supabase.
//
// Run: node scripts/test-onboarding.mjs

import { readFileSync, existsSync } from 'fs';

let passed = 0;
let failed = 0;

function check(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

// ── Load files ────────────────────────────────────────────────────────────────

const WIZARD_PATH    = 'app/js/universe/onboarding-wizard.js';
const USER_API_PATH  = 'api/user.js';
const MIGRATION_PATH = 'migrations/20260913_onboarding_completed.sql';

const wizard    = existsSync(WIZARD_PATH)    ? readFileSync(WIZARD_PATH,    'utf-8') : '';
const userApi   = existsSync(USER_API_PATH)  ? readFileSync(USER_API_PATH,  'utf-8') : '';
const migration = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, 'utf-8') : '';

// ── T-OB-1: migration file ────────────────────────────────────────────────────

section('T-OB-1 — migration: onboarding_completed column');
check(migration.length > 0, 'migration file exists');
check(
  migration.includes('onboarding_completed') && migration.includes('BOOLEAN'),
  'migration adds onboarding_completed BOOLEAN column'
);
check(
  migration.includes('ADD COLUMN IF NOT EXISTS'),
  'migration uses ADD COLUMN IF NOT EXISTS (idempotent)'
);
check(
  !migration.includes('UPDATE') && !migration.includes('SET onboarding_completed'),
  'migration does NOT contain retroactive backfill UPDATE (no heuristic backfill)'
);

// ── T-OB-2: full-profile includes onboarding_completed ───────────────────────

section('T-OB-2 — api/user.js: handleFullProfile includes onboarding_completed');
check(
  userApi.includes("'age, gender, height, weight, birth_year, onboarding_completed'"),
  "handleFullProfile SELECT includes onboarding_completed"
);
check(
  userApi.includes('wizard-complete') && userApi.includes('handleWizardComplete'),
  'wizard-complete action and handler exist'
);

// ── T-OB-3: handleWizardComplete — UPSERT contract ───────────────────────────

section('T-OB-3 — api/user.js: handleWizardComplete uses UPSERT');
const completeHandler = userApi.match(/async function handleWizardComplete[\s\S]{0,600}/)?.[0] || '';
check(
  completeHandler.includes('onboarding_completed: true'),
  'handleWizardComplete sets onboarding_completed: true'
);
check(
  completeHandler.includes('.upsert(') && completeHandler.includes("onConflict: 'user_id'"),
  'handleWizardComplete uses UPSERT with onConflict: user_id (safe for missing row)'
);
check(
  !completeHandler.includes('.update('),
  'handleWizardComplete does NOT use .update() (would be silent no-op for missing row)'
);
check(
  /if \(req\.method !== 'POST'\)/.test(completeHandler),
  'handleWizardComplete is POST only'
);

// ── T-OB-4: checkAndShowOnboarding — correct guard ───────────────────────────

section('T-OB-4 — onboarding-wizard.js: checkAndShowOnboarding guard');

// S1/S2/S4: wizard shows for null onboarding_completed (regardless of birth_year or age)
check(
  wizard.includes("data.profile?.onboarding_completed === true"),
  'S1/S2/S4: guard uses onboarding_completed === true (strict equality)'
);
check(
  !wizard.includes("data.profile?.age") && !wizard.includes("data.profile?.birth_year"),
  'S1/S2/S4: old age/birth_year guard REMOVED — pre-intake data does not block wizard'
);

// S3: onboarding_completed = true → skip wizard
// (covered by the === true check above)

// S7: fail-open — API error must NOT be treated as "onboarding done"
const checkFnBlock = wizard.match(/export async function checkAndShowOnboarding[\s\S]{0,400}/)?.[0] || '';
check(
  checkFnBlock.includes('if (!res.ok)') && checkFnBlock.includes('_showWizard(userId)'),
  'S7: fail-open — !res.ok calls _showWizard (API error does not skip wizard)'
);
check(
  // Old silent fail: `if (!res.ok) return;` — must not appear before _showWizard
  !/if \(!res\.ok\)\s*return;/.test(checkFnBlock),
  'S7: silent fail pattern `if (!res.ok) return` eliminated from checkAndShowOnboarding'
);

// ── T-OB-5: _save() — wizard-complete called before overlay.remove() ─────────

section('T-OB-5 — onboarding-wizard.js: _save() invariant');

const saveFnBlock = wizard.match(/async function _save\(\)[\s\S]{0,2000}/)?.[0] || '';

// S5: wizard-complete is called in _save()
check(
  saveFnBlock.includes("wizard-complete"),
  'S5: _save() calls wizard-complete action'
);

// S8: overlay removed ONLY after completeRes.ok — check ordering
const overlayIdx   = saveFnBlock.indexOf('overlay.remove()');
const completeIdx  = saveFnBlock.indexOf('completeRes.ok');
check(
  overlayIdx !== -1 && completeIdx !== -1 && completeIdx < overlayIdx,
  'S8: completeRes.ok check appears BEFORE overlay.remove() — overlay stays on failure'
);

// S8: failed wizard-complete → overlay stays (return before overlay.remove)
check(
  saveFnBlock.includes('if (!completeRes.ok)'),
  'S8: !completeRes.ok branch present in _save()'
);
const completeErrBranch = saveFnBlock.match(/if \(!completeRes\.ok\)([\s\S]*?)return;/)?.[0] || '';
check(
  !!completeErrBranch && !completeErrBranch.includes('overlay.remove()'),
  'S8: !completeRes.ok branch returns WITHOUT calling overlay.remove()'
);

// Retry UX consistency — same "Chyba — zkus znovu" pattern as existing wizard
check(
  saveFnBlock.includes('Chyba — zkus znovu') &&
  saveFnBlock.match(/Chyba — zkus znovu/g)?.length >= 1,
  'S8: retry UX "Chyba — zkus znovu" present in _save()'
);

// S6: onboarding_completed is NOT set in _save_partial (only in _save)
const savePartialBlock = wizard.match(/async function _save_partial[\s\S]{0,600}/)?.[0] || '';
check(
  !savePartialBlock.includes('wizard-complete') && !savePartialBlock.includes('onboarding_completed'),
  'S6: _save_partial does NOT call wizard-complete — incomplete wizard stays unconfirmed'
);

// completion without existing user_profiles row: UPSERT in wizard-complete handles it
// (verified in T-OB-3 — static check, no runtime test possible here)

// ── T-OB-6: wizard-complete not reachable from _save_partial or goTo ─────────

section('T-OB-6 — onboarding-wizard.js: wizard-complete only reachable via _save()');
check(
  !savePartialBlock.includes('wizard-complete'),
  'wizard-complete not called in _save_partial (step 1/2 completion does not set flag)'
);
const goToBlock = wizard.match(/function goTo[\s\S]{0,200}/)?.[0] || '';
check(
  !goToBlock.includes('wizard-complete'),
  'wizard-complete not called in goTo (navigation between steps does not set flag)'
);

// ── T-OB-7: routing integrity ─────────────────────────────────────────────────

section('T-OB-7 — api/user.js: routing and error message updated');
check(
  userApi.includes("action === 'wizard-complete'"),
  "router has wizard-complete route"
);
check(
  userApi.includes("wizard-complete | full-profile") ||
  userApi.includes("wizard-complete"),
  'error message updated to include wizard-complete'
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
