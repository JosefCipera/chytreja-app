import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const context = vm.createContext({console, process: {...process, exit(code) {assert.equal(code,0);}}, crypto, Date, Set, Map, JSON});
const mocks={'@anthropic-ai/sdk': {default:class {}}, './healthEventAdapter.js': {applyHealthEvent(){throw Error('DB must not run');}}, './nextBestEvidence.js': {selectNextBestEvidence(){}}, './decisionGate.js':{synthesizePathDiscovery(){}}, fs,url,path};
const file=new URL('../api/engine/orchestrator.js',import.meta.url);
const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;}});
await mod.link(spec=>{const values=mocks[spec]; assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});
await mod.evaluate();
for(const name of ['test-why-response-subject.mjs','test-dnes-trajectory-mechanism.mjs']){
 const test=new vm.SourceTextModule(fs.readFileSync(new URL(name,import.meta.url),'utf8'),{context});
 await test.link(()=>mod); await test.evaluate();
}
const {_buildActResponse_test:act,_buildWhyResponse_test:why,_buildMechanismResponse_test:mechanism,_localizeMod_test:localize}=mod.namespace;
const mods=['Use stable wall or chair support for all single-leg variants','Begin with eyes-open only; progress to eyes-closed only when stable','Supervised or near-support setting for first sessions'];
const action={label:'Stůj 30 sekund na jedné noze.',intervention_id:'BALANCE_TRAINING',mechanism_targets:['GAIT_INSTABILITY','FALL_RISK'],goal_impact:{branches:['FUNCTIONAL_INDEPENDENCE','SURVIVAL_HEALTHSPAN']},safety:{level:'SAFE_WITH_MODIFICATION',modifications_suggested:[...mods,mods[0]]}};
const r=act({primary_item:action},{},{},[]);
assert.ok(r.text.startsWith(action.label+' '));
assert.ok(!r.text.includes('..')&&!r.text.includes('Úprava:'));
for(const m of mods)assert.ok(r.text.includes(localize(m)));
assert.equal(r.text.split(localize(mods[0])).length,2);
assert.equal(r.mode,'ACT');assert.equal(r.buttons.join(','),'Hotovo,Přeskočit');
const session={current_action_assignment:{action_id:'test'},last_domain_response:{explanation_context:{system_leverage:{node_id:'GAIT_INSTABILITY'},action_context:{selected:action}}}};
const reason=why(session);
assert.ok(reason.text.includes('jistotu při chůzi'));
assert.ok(!reason.text.includes('nejvíc')&&!reason.text.includes('opěradla')&&!reason.text.includes('Úprava'));
assert.ok(mechanism(session).text.includes('při pravidelném opakování může pomoci'));
assert.equal(localize('Avoid Valsalva (breath-holding during exertion)'),'Nezadržuj dech při cvičení');
console.log('PASS: balance dose unchanged, all three safety conditions once, no duplicate WHY instructions, conditional repeated benefit.');

const chairCopy = JSON.parse(fs.readFileSync(new URL('../data/engine/action-instructions.json', import.meta.url), 'utf8')).sit_to_stand_supported.label;
const chairSession = label => ({
  current_action_assignment: {action_id:'sit_to_stand_supported'},
  last_domain_response: {explanation_context:{action_context:{selected:{
    label, intervention_id:'FUNCTIONAL_STRENGTH_TRAINING',
    mechanism_targets:['LOW_MUSCLE_STRENGTH','REDUCED_FUNCTIONAL_RESERVE'],
  }}}},
});
const expectedBenefit = 'Cvičení ti při pravidelném opakování může pomoci zvýšit svalovou sílu a zlepšit schopnost zvládat běžné fyzické úkony.';
for(const label of [chairCopy,'5× pomalu vstaň ze židle','Pomalu vstaň ze židle','Vstávání ze židle']){
  assert.equal(mechanism(chairSession(label)).text, expectedBenefit);
}
const unknownInstruction = chairSession(chairCopy);
unknownInstruction.last_domain_response.explanation_context.action_context.selected.intervention_id='UNKNOWN_TYPE';
assert.ok(mechanism(unknownInstruction).text.startsWith('Tato akce ti '));
assert.ok(!mechanism(unknownInstruction).text.includes(chairCopy));
console.log('PASS: actual catalog instruction (numeric, multi-sentence) never becomes an explanation subject; known type independent of label, unknown instruction falls back safely.');
