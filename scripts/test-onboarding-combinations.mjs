import assert from 'node:assert/strict';
import { runOnboardingFixture } from './ai-tester/onboarding-harness.mjs';
const keys = ['vstat_ze_zeme', 'zvednout_vnouce', 'vynest_nakup', 'recent_falls', 'rovnovaha_zavrene_oci'];
for (let mask = 0; mask < 32; mask++) {
  const expected = Object.fromEntries(keys.map((key, i) => [key, Boolean(mask & (1 << i))]));
  const r = await runOnboardingFixture(expected);
  assert.deepEqual(r.physical, expected, 'Actual pill values serialize correctly: ' + mask);
  assert.equal(r.removed && r.reloaded, true, 'Successful completion releases wizard');
  assert.equal(r.requests.at(-1).url, '/api/user?action=wizard-complete');
}
const empty = await runOnboardingFixture({});
for (const person of [{ age: 67, height: 178, weight: 72, gender: 'male', waist: 84 }, { age: 69, height: 165, weight: 71, gender: 'female', waist: 81 }]) {
  const r = await runOnboardingFixture({}, null, person);
  assert.deepEqual(r.profile, { step: 1, ...person }, 'Actual wizard saves the supplied profile, not a hard-coded default');
}
assert.equal(empty.physical, undefined, 'Unanswered questions are not fabricated');
assert.equal(empty.removed, true);
for (const failure of ['physical', 'complete']) {
  const r = await runOnboardingFixture({ vstat_ze_zeme: true }, failure);
  assert.equal(r.removed || r.reloaded, false, 'Failed save must retain wizard: ' + failure);
  if (failure === 'physical') assert.equal(r.requests.some(r => r.url.endsWith('wizard-complete')), false);
}
console.log('PASS: 32 physical-answer combinations, unanswered input and both save-failure branches through actual onboarding handlers; all requests isolated.');
