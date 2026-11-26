import assert from 'node:assert/strict';
import fs from 'node:fs';

const onboarding = fs.readFileSync(new URL('../app/js/universe/onboarding-wizard.js', import.meta.url), 'utf8');
assert.match(onboarding, /document\.body\.classList\.add\('onboarding-open'\)/,
  'Opening onboarding marks the document');
assert.match(onboarding, /document\.body\.classList\.remove\('onboarding-open'\)/,
  'Completing onboarding restores the launcher');
assert.match(onboarding, /body\.onboarding-open footer\s*\{\s*display:none!important\s*\}/,
  'Launcher text/voice footer is hidden behind onboarding');

const crt = fs.readFileSync(new URL('../app/crt.html', import.meta.url), 'utf8');
const renderStart = crt.indexOf('function renderTree(data)');
const renderEnd = crt.indexOf('\nfunction ', renderStart + 1);
assert.ok(renderStart >= 0, 'CRT renderTree exists');
const renderTree = crt.slice(renderStart, renderEnd < 0 ? undefined : renderEnd);
for (const state of ['GRAY', 'RED', 'YELLOW', 'GREEN']) {
  assert.match(renderTree, new RegExp(`n\\._state === '${state}'`), `CRT renders ${state} explicitly`);
}
assert.match(renderTree, /n\._state === 'GRAY'[\s\S]*?bg = '#1a1d26'/,
  'Unconfirmed nodes use the gray palette');
assert.match(renderTree, /else \{\s*bg = '#1a1d26'/,
  'Nodes without a state default to gray, not blue');
assert.doesNotMatch(renderTree, /bg = '#1a2d40'/,
  'The former blue default is absent');

console.log('PASS: onboarding hides the inactive launcher footer; CRT respects state colors and defaults unconfirmed nodes to gray.');
