// Four isolated conversation flows. Real activation, inference, DAILY_DECISION and response builders.
// Database persistence and NBA selection are fixtures, not live end-to-end verification.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import {activation} from '../api/engine/activation.js';
import {inference} from '../api/engine/inference.js';
import {computeDailyDecision} from '../api/engine/dailyDecision.js';
const context=vm.createContext({console,process,crypto,Date,Set,Map,JSON});
async function isolated(file,mocks){
 const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;}});
 await mod.link(spec=>{
  const values=mocks[spec];assert.ok(values,spec);
  return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context});
 });await mod.evaluate();return mod.namespace;
}
const adapter=await isolated(new URL('../api/engine/healthEventAdapter.js',import.meta.url),{
 '@supabase/supabase-js':{createClient(){throw Error('No DB');}},
 './engine.js':{runEngine(){throw Error('No engine call');}},
 './dailyDecision.js':{computeDailyDecision},
 './adapter.js':{mapDiagnosis(){throw Error('No parsing');}},
});
let engineResult, completed=false, engineCalls=0, classifierCalls=0;
class AI {messages={create:async()=>{classifierCalls++;return {content:[{type:'tool_use',input:{event_type:'GENERAL_HEALTH_REQUEST',payload:{}}}]};}};}
const presentation=await isolated(new URL('../api/engine/orchestrator.js',import.meta.url),{
 '@anthropic-ai/sdk':{default:AI},
 './healthEventAdapter.js':{applyHealthEvent:async(_user,event)=>{
  engineCalls++;
  if(event.event_type==='ACTION_COMPLETED')completed=true;
  engineResult.intervention_exposure=completed?[{intervention_id:engineResult.next_best_action.selected.intervention_id,completed_days:[new Date().toISOString().slice(0,10)]}]:[];
  return {persistence_status:'ok',engine_called:true,warnings:[],domain_response:adapter._buildDomainResponse_test(engineResult)};
 }},
 './nextBestEvidence.js':{selectNextBestEvidence:()=>null},
 './decisionGate.js':{synthesizePathDiscovery:()=>null},fs,url,path,
});
const scenarios=[
 {node:'GAIT_INSTABILITY',input:'Jsem při chůzi nejistý.',physical:{vstat_ze_zeme:true,zvednout_vnouce:true,vynest_nakup:true,recent_falls:false,rovnovaha_zavrene_oci:false},observations:[{obs_type:'weight_kg',value:72}],type:'BALANCE_TRAINING',targets:['GAIT_INSTABILITY','FALL_RISK','LOW_MUSCLE_STRENGTH'],why:'neudržíš stoj na jedné noze se zavřenýma očima'},
 {node:'LOW_MUSCLE_STRENGTH',input:'Hůř vstávám ze země.',physical:{vstat_ze_zeme:false},observations:[{obs_type:'weight_kg',value:72}],type:'FUNCTIONAL_STRENGTH_TRAINING',targets:['LOW_MUSCLE_STRENGTH','REDUCED_FUNCTIONAL_RESERVE'],why:'nevstaneš ze země bez opory rukou'},
 {node:'PHYSICAL_INACTIVITY',input:'Celý den sedím.',physical:{sedentary_hours_day:9},observations:[{obs_type:'weight_kg',value:72},{obs_type:'sedentary_hours_day',value:9}],type:'BREAK_UP_SEDENTARY_TIME',targets:['PHYSICAL_INACTIVITY','INSULIN_RESISTANCE'],why:'prosedíš 9 hodin denně'},
 {node:'EXCESS_ADIPOSITY',input:'Přibral jsem.',physical:{},observations:[{obs_type:'weight_kg',value:95}],type:'AEROBIC_TRAINING',targets:['EXCESS_ADIPOSITY','PHYSICAL_INACTIVITY','HYPERTENSION','INSULIN_RESISTANCE'],why:'ze zadané výšky a hmotnosti'},
];
for(const f of scenarios){
 completed=false;
 const person={birth_year:1956,sex:'male',height_cm:175};
 const history={diagnoses:[],onboarding_inputs:f.physical,lifestyle:{},evidence_availability:{}};
 const activated=activation(person,history,f.observations);
 const nodes=[...activated,...inference(activated,person,history,f.observations)];
 assert.ok(nodes.some(n=>n.node_id===f.node),'Actual activation/inference must generate fixture node');
 const action={action_id:'fixture-'+f.node,label:'Testovací cvik',intervention_id:f.type,mechanism_targets:f.targets,goal_impact:{branches:['FUNCTIONAL_INDEPENDENCE','SURVIVAL_HEALTHSPAN']},safety:{level:'SAFE',modifications_suggested:[]}};
 engineResult={node_states:nodes,system_leverage:{selected:{node_id:f.node},selection_basis:{causal_reach:{affected_nodes:['TEST_CAUSAL_STEP']}}},system_constraint:{selected:null,candidates:[]},next_best_action:{status:'SELECTED',selected:action,all_candidates:[action]},decision_gate:{context_gates:[]}};
 let session={};
 const send=async(text)=>{const r=await presentation.processInput('isolated',text,session);session={...session,...r.session_updates};return r;};
 assert.equal((await send(f.input)).mode,'ACT');
 const reason=await send('Proč?');assert.ok(reason.text.includes(f.why),reason.text);
 assert.equal((await send('Kam směřuješ?')).mode,'EXPLAIN');
 const benefit=await send('Co tím změníš?');
 assert.ok(benefit.text.includes('při pravidelném opakování může pomoci'));
 assert.doesNotMatch(benefit.text,/zlepšit riziko|zlepšit krevní tlak|podpořit několik oblastí/);
 if(f.node==='GAIT_INSTABILITY')assert.equal(benefit.text,'Cvičení rovnováhy ti při pravidelném opakování může pomoci zlepšit jistotu při chůzi, snížit riziko pádu a posílit svalovou sílu.');
 const done=await send('Hotovo');assert.equal(done.mode,'HOLD');assert.equal(done.debug.reason_code,'HOLD_DONE_TODAY');
 for(const text of ['Co dál?','co dal?','Co teď?','co ted?']){
  const aiBefore=classifierCalls;
  const next=await send(text);
  assert.equal(classifierCalls,aiBefore,'Follow-up must bypass classifier: '+text);
  assert.equal(next.debug.reason_code,'HOLD_DONE_TODAY',next.text);
  assert.match(next.text,/Pro dnešek stačí/);
 }
 // Recover sessions already damaged by the earlier ambiguous-input response.
 session={...session,last_daily_decision:{mode:'HOLD',reason_code:'SCOPE_UNCLEAR'},unsupported_request:{kind:'general'}};
 assert.equal((await send('co dal?')).debug.reason_code,'HOLD_DONE_TODAY');
 // Missing or positive evidence must never be reported as a negative answer.
 const base={last_domain_response:{explanation_context:{system_leverage:{node_id:f.node},action_context:{selected:action},leverage_evidence:{direct:[{source:'ONBOARDING',question_id:'rovnovaha_zavrene_oci',value:true}]}}}};
 assert.doesNotMatch(presentation._buildWhyResponse_test(base).text,/neudržíš/);
 console.log('PASS: '+f.node+' — actual evidence → ACT → WHY → trajectory → benefit → completion → accented/plain follow-ups → recovery.');
}
