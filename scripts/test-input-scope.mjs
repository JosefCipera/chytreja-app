// Regression: scope must not substitute a previously available exercise.
// Run: node --experimental-vm-modules scripts/test-input-scope.mjs
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { applyActionInstructions } from '../api/engine/actionInstructions.js';
let calls = 0, classifierCalls = 0, classifierError = false;
let classification = {event_type:'GENERAL_HEALTH_REQUEST',payload:{}};
const action={action_id:'sit_to_stand_supported', intervention_id:'FUNCTIONAL_STRENGTH_TRAINING', label:'Previously available exercise', safety:{level:'SAFE'}};
class AI { messages={create:async () => {
  classifierCalls++; if(classifierError)throw Error('simulated classifier outage');
  return {content:[{type:'tool_use',input:classification}]};
}}; }
const mocks={
  '@anthropic-ai/sdk':{default:AI},
  './healthEventAdapter.js':{applyHealthEvent:async()=>{calls++;return {
    persistence_status:'ok',engine_called:true,warnings:[],
    domain_response:{daily_decision:{mode:'ACT',reason_code:'READY',primary_item:action},explanation_context:{}},
  };}},
  './nextBestEvidence.js':{selectNextBestEvidence:()=>null},
  './decisionGate.js':{synthesizePathDiscovery:()=>null},fs,url,path,
};
const file=new URL('../api/engine/orchestrator.js',import.meta.url);
const context=vm.createContext({console,process,crypto,Date,Set,Map,JSON});
const mod=new vm.SourceTextModule(fs.readFileSync(process.argv[2] ?? file,'utf8'),{
  context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;},
});
await mod.link(spec=>{
  const values=mocks[spec];assert.ok(values,spec);
  return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});
});
await mod.evaluate();
const {processInput}=mod.namespace;
const previous={
  current_action_assignment:{action_id:'old',intervention_id:'old',label:'Old action'},
  pending_question:{type:'GENERAL',evidence_type:'sedentary_hours_day',text:'Kolik hodin sedíš?'},
  last_daily_decision:{mode:'ACT',reason_code:'READY',primary_item:action},
  last_domain_response:{explanation_context:{system_leverage:{node_id:'LOW_MUSCLE_STRENGTH'},action_context:{selected:action}}},
};
let medical;
for(const text of ['Mám synkopu.','Mám srdce se symkopou.','Proč mám synkopu?','Mám nadváhu a včera jsem omdlel.','Ztratil jsem vědomí.','Mám fibrilaci síní.','Bolest na hrudi.']){
  const before=calls, aiBefore=classifierCalls;
  const r=await processInput('isolated',text,previous);
  assert.equal(calls,before,'Unsupported input must not run the engine: '+text);
  assert.equal(classifierCalls,aiBefore,'Explicit unsupported medical topic must bypass classifier');
  assert.equal(r.mode,'HOLD');assert.equal(r.debug.reason_code,'UNSUPPORTED_REQUEST');
  assert.match(r.text,/zatím neumím spolehlivě pomoci/);assert.match(r.text,/lékařem/);
  assert.equal(r.buttons.length,0);assert.equal(r.expects_reply,true);
  for(const key of ['pending_question','current_action_assignment','last_domain_response'])assert.equal(r.session_updates[key],null);
  medical={...previous,...r.session_updates};
}
for(const text of ['Co dál?','Proč?','Hotovo','Chci zlepšit kondici.']){
  const before=calls;
  const r=await processInput('isolated',text,medical);
  assert.equal(calls,before);assert.equal(r.mode,'HOLD');
  assert.equal(r.session_updates.unsupported_request.kind,'medical');
}
classification={event_type:'UNSUPPORTED_REQUEST',payload:{unsupported_kind:'general'}};
let general;
for(const text of ['Chci lépe spát.','Pomoz mi s výrobou.','Proč nespím?']){
  const before=calls;
  const r=await processInput('isolated',text,{});
  assert.equal(calls,before);assert.equal(r.mode,'HOLD');
  assert.doesNotMatch(r.text,/lékařem/);
  general=r.session_updates;
}
for(const text of ['Co dál?','Proč?','Hotovo','Kam směřuješ?','Co tím změníš?']){
  const before=calls, aiBefore=classifierCalls;
  const r=await processInput('isolated',text,general);
  assert.equal(calls,before);assert.equal(classifierCalls,aiBefore);
  assert.equal(r.debug.reason_code,'UNSUPPORTED_REQUEST');
}
classification={event_type:'GENERAL_HEALTH_REQUEST',payload:{}};
for(const text of ['Chci zlepšit kondici.','Nemám synkopu, chci více pohybu.']){
  const before=calls;
  const r=await processInput('isolated',text,general);
  assert.equal(calls,before+1);assert.equal(r.mode,'ACT');
  assert.equal(r.session_updates.unsupported_request,null);
}
for(const failure of ['error','invalid','unclear']){
  classifierError=failure==='error';
  classification={event_type:failure==='invalid'?'INVALID_EVENT':'SCOPE_CLARIFICATION',payload:{}};
  const before=calls;
  const r=await processInput('isolated','Něco nejasného',{});
  assert.equal(calls,before);assert.equal(r.debug.reason_code,'SCOPE_UNCLEAR');
  assert.match(r.text,/nerozumím/);assert.equal(r.expects_reply,true);
}
console.log('PASS: medical/syncope scope before old actions and pending answers; general scope, follow-ups, supported rescope, classifier failures.');

const original=JSON.parse(fs.readFileSync(new URL('../data/engine/action-instructions.json',import.meta.url),'utf8')).sit_to_stand_supported;
const row={id:'sit_to_stand_supported',node_id:'sila',label:original.source_label,protocol_type:'FUNKCNI_SILOVY_PROTOKOL',reps:5,intensity:'LIGHT',tier:1,tags:['sila','nohy','sit_to_stand'],constraint_exclude:[]};
const [updated]=applyActionInstructions([row]);
assert.equal(updated.label,original.label);
assert.match(updated.label,/5× pomalu vstaň/);
assert.match(updated.label,/židli, která neklouže/);
assert.match(updated.label,/Při bolesti, závrati nebo nejistotě přestaň/);
assert.doesNotMatch(updated.label,/u zdi/);
assert.deepEqual({...updated,label:row.label},row);
for(const altered of [{...row,reps:10},{...row,protocol_type:'OTHER'},{...row,label:'New DB instructions'},{...row,id:'other'}]){
  assert.equal(applyActionInstructions([altered])[0],altered,'Changed DB contract must not receive a stale label');
}
// Real adapter integration with a synthetic Supabase client; no database connection.
const adapterFile=new URL('../api/engine/adapter.js',import.meta.url);
const adapter=new vm.SourceTextModule(fs.readFileSync(adapterFile,'utf8'),{context,identifier:adapterFile.href});
await adapter.link(spec=>{
 const values=spec==='./actionInstructions.js'?{applyActionInstructions}:spec==='@supabase/supabase-js'?{createClient:()=>({
  from(table){assert.equal(table,'longevity_actions');return {
   select(){return this;},eq(key,value){assert.equal(key,'active');assert.equal(value,true);return this;},
   async in(key,protocols){assert.equal(key,'protocol_type');assert.deepEqual(protocols,['FUNKCNI_SILOVY_PROTOKOL']);return {data:[row],error:null};},
  };},
 })}:null;
 assert.ok(values,spec);
 return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});
});
await adapter.evaluate();
assert.deepEqual(await adapter.namespace.fetchActionPool(['FUNKCNI_SILOVY_PROTOKOL']),[updated]);
console.log('PASS: reviewed chair instruction enters the actual action pool; dose, safety metadata and unrelated/changed actions remain intact.');
