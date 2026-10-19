import assert from 'node:assert/strict';
import {assertGaitScope} from './gait-why-contract.mjs';
for(const statement of [
 'Zaměření na tuk nevysvětluje příčinu nejistoty při chůzi.',
 'Vycházím z hmotnosti. Příčinu nejistoty při chůzi tím neposuzuji.',
 'Zaměření na tuk nenahrazuje posouzení nejistoty při chůzi.',
])assertGaitScope(statement);
assert.throws(()=>assertGaitScope('Uvádíš nejistotu při chůzi. Proto se zaměřujeme na tuk.'));
assert.throws(()=>assertGaitScope('Tuk je hlavní příčinou nejistoty při chůzi.'));
assert.throws(()=>assertGaitScope('Příčinu nejistoty při chůzi neposuzuji.'));
console.log('PASS: Czech first/third-person negation accepted; missing boundary, unsupported causal certainty and missing selected focus rejected.');
