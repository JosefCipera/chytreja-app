import assert from 'node:assert/strict';
import { createLauncherHarness } from './ai-tester/launcher-render-harness.mjs';
const ui = createLauncherHarness();
const enabled = (state, expected, label) => {
  for (const key of ['input_enabled', 'send_enabled', 'microphone_enabled'])
    assert.equal(state[key], expected, label + ': ' + key);
};
for (const [response, expected] of [
  [{ mode: 'HOLD', debug: { reason_code: 'HOLD_DONE_TODAY' } }, false],
  [{ mode: 'HOLD', debug: { reason_code: 'HOLD_SKIPPED_TODAY' } }, true],
  [{ mode: 'SAFETY_BLOCKED' }, true], // Persisted response from before the fix has no buttons.
  [{ mode: 'SAFETY_BLOCKED', buttons: ['Proč?'], expects_reply: true }, true],
  [{ mode: 'EXPLAIN' }, true], // No current action is not a reason to disable questions.
  [{ mode: 'NOOP' }, true],
  [{ mode: 'ASK', expects_reply: true }, true],
  [{ mode: 'ACT', buttons: ['Hotovo', 'Přeskočit'] }, true],
]) {
  const state = ui.render({ text: 'Test', buttons: [], expects_reply: false, ...response });
  enabled(state, expected, response.mode);
  assert.equal(state.label, response.debug?.reason_code === 'HOLD_DONE_TODAY' ? '✓' : response.mode === 'ACT' ? 'DNES' : '');
  enabled(ui.loading(true), false, 'request in progress');
  enabled(ui.loading(false), expected, 'request finished');
}
assert.equal(ui.render({ mode: 'SAFETY_BLOCKED', text: 'Test', buttons: ['Proč?'], expects_reply: true }).chips.includes('Proč?'), true);
assert.equal(ui.click('Proč?'), 'Proč?');
enabled(ui.render({ mode: 'SAFETY_CRITICAL', text: 'Test', buttons: [], expects_reply: false }), false, 'critical terminal unchanged');
enabled(ui.render({ mode: 'SAFETY_BLOCKED', text: 'Restored', buttons: [], expects_reply: false }), true, 'restored legacy block unlocks terminal');
console.log('PASS: completed-today and critical visits stay closed; skipped, blocked, explain, noop, ask and act remain available; WHY chip submits.');

