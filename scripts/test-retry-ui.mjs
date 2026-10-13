import assert from 'node:assert/strict';
import { createLauncherHarness } from './ai-tester/launcher-render-harness.mjs';

const input = 'Jsem nejistý při chůzi.';
const initial = { current_action_assignment: { action_id: 'old', intervention_id: 'old-intervention', label: 'Old exercise' },
  pending_question: { text: 'Original question', evidence_type: 'gait_stability', type: 'GENERAL' }, question_budget_remaining: 2 };
const ui = createLauncherHarness({ requestFlow: true });
ui.configure({ session: initial, response: { error: new Error('Simulated network failure') } });
let state = await ui.submit(input);
let saved = ui.storage();
assert.equal(state.draft, input);
assert.equal(saved.session.pending_ai_retry.text, input);
assert.deepEqual(saved.session.pending_ai_retry.context.pending_question, initial.pending_question);
assert.equal(saved.session.current_action_assignment, null);
assert.equal(saved.session.last_domain_response, null);
assert.equal(saved.session.question_budget_remaining, 2);
assert.equal(saved.requests[0].text, input);
assert.deepEqual(state.chips, ['Zkusit znovu']);
assert.ok(state.input_enabled && state.send_enabled && state.microphone_enabled);
const restored = createLauncherHarness({ requestFlow: true });
restored.configure({ session: saved.session });
assert.equal(restored.render(saved.response).draft, input);
assert.deepEqual(restored.storage().session.pending_ai_retry, saved.session.pending_ai_retry);
ui.configure({ response: { status: 200, body: { mode: 'ASK', text: 'New question', buttons: [], expects_reply: true,
  session_updates: { pending_ai_retry: null, pending_question: { text: 'New question' }, current_action_assignment: null } } } });
state = await ui.clickRequest('Zkusit znovu');
saved = ui.storage();
assert.equal(saved.requests[1].text, 'Zkusit znovu');
assert.equal(saved.requests[1].session.pending_ai_retry.text, input);
assert.equal(saved.session.pending_ai_retry, null);
assert.equal(state.draft, '');

// A non-200 HTTP reply retains the request exactly, including after a second failure.
ui.configure({ session: initial, response: { status: 502, body: { error: 'Upstream unavailable' } } });
state = await ui.submit(input);
assert.equal(state.draft, input);
state = await ui.clickRequest('Zkusit znovu');
assert.equal(ui.storage().session.pending_ai_retry.text, input);
assert.equal(state.draft, input);

// A server-side classifier error uses the same visible retry/draft flow.
const retry = ui.storage().session.pending_ai_retry;
ui.configure({ response: { status: 200, body: { mode: 'HOLD', text: 'Processing unavailable', draft_text: input,
  buttons: ['Zkusit znovu'], expects_reply: true, session_updates: { pending_ai_retry: retry, current_action_assignment: null } } } });
assert.equal((await ui.submit(input)).draft, input);

// A later unsent draft is retained when the original request succeeds through its chip.
ui.render({ mode: 'HOLD', text: 'Waiting', draft_text: 'Další nová informace', buttons: ['Zkusit znovu'], expects_reply: true });
ui.configure({ response: { status: 200, body: { mode: 'HOLD', text: 'Processed', buttons: [], expects_reply: true, session_updates: { pending_ai_retry: null } } } });
state = await ui.clickRequest('Zkusit znovu');
assert.equal(state.draft, 'Další nová informace');
console.log('PASS: actual launcher request handler retains original input, clears stale action, persists retry, restores draft, handles HTTP/transport/classifier failures and preserves later drafts.');
