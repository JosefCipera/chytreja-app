import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
let classification,events=[];
class AI{messages={create:async()=>({content:[{type:'tool_use',input:classification}]})};}
const mocks={
 '@anthropic-ai/sdk':{default:AI},
 './healthEventAdapter.js':{applyHealthEvent:async(_uid,event)=>{events.push(event);return {persistence_status:'ok',warnings:[],domain_response:{daily_decision:{mode:'HOLD'},explanation_context:{}}};}},
 './nextBestEvidence.js':{selectNextBestEvidence:()=>null},'./decisionGate.js':{synthesizePathDiscovery:()=>null},fs,url,path,
};
const file=new URL('../api/engine/orchestrator.js',import.meta.url),context=vm.createContext({console,process,crypto,Date,Set,Map,JSON});
const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;}});
await m.link(s=>{const v=mocks[s];assert.ok(v,s);return new vm.SyntheticModule(Object.keys(v),function(){for(const [k,x]of Object.entries(v))this.setExport(k,x);},{context});});await m.evaluate();
for(const location of ['Ze židle.','Ze země.']){
 events=[];
 classification={event_type:'FUNCTIONAL_CLARIFICATION',payload:{clarification_kind:'chair_or_floor'}};
 const first=await m.namespace.processInput('fixture','Špatně se mi vstává.',{current_action_assignment:{action_id:'stale'}});
 assert.equal(first.mode,'ASK');assert.match(first.text,/židle.*země/);assert.equal(events.length,0);
 assert.equal(first.session_updates.current_action_assignment,null);
 classification={event_type:'FUNCTIONAL_CLARIFICATION',payload:{clarification_kind:'floor_rise_ability'}};
 const second=await m.namespace.processInput('fixture',location,first.session_updates);
 assert.equal(second.mode,'ASK');assert.match(second.text,/ze země bez opory rukou/);assert.equal(events.length,0);
 assert.equal(second.session_updates.pending_question.evidence_type,'vstat_ze_zeme');
 classification={event_type:'ANSWER_TO_EVIDENCE_QUESTION',payload:{evidence_type:'vstat_ze_zeme',value:false}};
 const third=await m.namespace.processInput('fixture','Ne',second.session_updates);
 assert.equal(events.length,1);assert.equal(events[0].event_type,'ANSWER_TO_EVIDENCE_QUESTION');
 assert.equal(events[0].payload.evidence_type,'vstat_ze_zeme');assert.equal(events[0].payload.value,false);
}
classification={event_type:'FUNCTIONAL_CLARIFICATION',payload:{clarification_kind:'chair_or_floor'}};events=[];
const exhausted=await m.namespace.processInput('fixture','Špatně se mi vstává.',{question_budget_remaining:0});
assert.equal(exhausted.mode,'HOLD');assert.equal(events.length,0);
const medical=await m.namespace.processInput('fixture','Mám synkopu a špatně se mi vstává.',{});
assert.equal(medical.debug.reason_code,'UNSUPPORTED_REQUEST');assert.equal(events.length,0);
console.log('PASS: ambiguity → chair/floor → explicit ability question → factual answer; no premature writes, stale action cleared, budget and medical scope preserved.');
