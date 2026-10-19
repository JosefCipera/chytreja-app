// Existing actual orchestrator + engine journey, synthetic profiles/DB writes.
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {assertGaitScope} from './gait-why-contract.mjs';
const catalog=process.argv.find(s=>s.startsWith('--catalog='));assert.ok(catalog,'Explicit offline public catalog required');
const run=spawnSync(process.execPath,['--experimental-vm-modules','scripts/ai-tester/run-gait-matrix.mjs',catalog],{encoding:'utf8',timeout:45000,maxBuffer:5000000,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
assert.equal(run.status,0,run.stderr.slice(-1500));const report=JSON.parse(run.stdout);
const example=report.results.find(s=>s.id==='tester137-profile');assert.ok(example);
assert.equal(example.leverage.node_id,'EXCESS_ADIPOSITY','Do not change engine ranking to make the explanation easier');
assert.equal(example.turns[0].mode,'ASK','Do not manufacture an exercise while asking for evidence');
const explanation=example.turns.find(t=>t.input==='Proč?');assertGaitScope(explanation.text);
assert.equal(example.assignments.length,0);
console.log(JSON.stringify({status:'PASS',case:'tester137-profile',profile:example.profile,physical:example.physical,leverage:example.leverage,turns:example.turns,counts:report.counts,assignments:example.assignments}));
