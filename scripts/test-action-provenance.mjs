// Real normalization and assignment insert; DB and post-event engine result are fixtures.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const context=vm.createContext({console,process,crypto,Date,Set,Map,JSON});
async function isolated(file,mocks){
 const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;}});
 await m.link(spec=>{const v=mocks[spec];assert.ok(v,spec);return new vm.SyntheticModule(Object.keys(v),function(){for(const [k,x]of Object.entries(v))this.setExport(k,x);},{context});});
 await m.evaluate();return m.namespace;
}
let rows=[];
const adapter=await isolated(new URL('../api/engine/healthEventAdapter.js',import.meta.url),{
 '@supabase/supabase-js':{createClient:()=>({from(table){assert.equal(table,'action_assignments');return {insert:async row=>{rows.push(row);return {error:null};}};}})},
 './engine.js':{runEngine:async()=>({})},'./dailyDecision.js':{computeDailyDecision:()=>({mode:'HOLD',reason_code:'HOLD_DONE_TODAY'})},'./adapter.js':{mapDiagnosis:()=>null},
});
class AI{messages={create(){throw Error('Completion chips must bypass AI');}};}
const presentation=await isolated(new URL('../api/engine/orchestrator.js',import.meta.url),{
 '@anthropic-ai/sdk':{default:AI},'./healthEventAdapter.js':{applyHealthEvent:adapter.applyHealthEvent},
 './nextBestEvidence.js':{selectNextBestEvidence:()=>null},'./decisionGate.js':{synthesizePathDiscovery:()=>null},fs,url,path,
});
const action={action_id:'sit_to_stand_supported',intervention_id:'FUNCTIONAL_STRENGTH_TRAINING',label:'Testovací cvik'};
const dr={engine_version:'fixture',daily_decision:{mode:'ACT',primary_item:action},explanation_context:{system_leverage:{node_id:'LOW_MUSCLE_STRENGTH'},action_context:{selected:action}}};
const fresh=presentation._buildSessionUpdates_test('DOMAIN_REQUEST',{}, {domain_response:dr});
assert.equal(fresh.current_action_assignment.selected_leverage_node,'LOW_MUSCLE_STRENGTH');
const legacy={...fresh,current_action_assignment:{...action}};
const mismatch={...legacy,last_domain_response:{...dr,explanation_context:{...dr.explanation_context,system_leverage:{node_id:'GAIT_INSTABILITY'},action_context:{selected:{...action,action_id:'different'}}}}};
const explicit={...mismatch,current_action_assignment:{...action,selected_leverage_node:'LOW_MUSCLE_STRENGTH'}};
for(const [state,expected]of [[fresh,'LOW_MUSCLE_STRENGTH'],[legacy,'LOW_MUSCLE_STRENGTH'],[mismatch,'UNKNOWN'],[explicit,'LOW_MUSCLE_STRENGTH']]){
 for(const [text,status]of [['Hotovo','COMPLETED'],['Přeskočit','SKIPPED']]){
  rows=[];await presentation.processInput('fixture',text,state);
  assert.equal(rows.length,1);assert.equal(rows[0].status,status);
  assert.equal(rows[0].action_id,action.action_id);assert.equal(rows[0].intervention_id,action.intervention_id);
  assert.equal(rows[0].selected_leverage_node,expected);
 }
}
console.log('PASS: ACT metadata → completed/skipped insert; matching legacy recovery; mismatched context stays UNKNOWN; assignment metadata takes precedence.');
