// Real copy defect, no mutation: actual buildWhyResponse over synthetic evidence.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import url from 'node:url';import path from 'node:path';import crypto from 'node:crypto';
import {assertGaitScope} from './gait-why-contract.mjs';
let calls=0;
const mocks={'@anthropic-ai/sdk':{default:class{}},'./healthEventAdapter.js':{applyHealthEvent(){calls++;throw Error('No engine call allowed');}},'./nextBestEvidence.js':{selectNextBestEvidence(){}},'./decisionGate.js':{synthesizePathDiscovery(){}},fs,url,path};
const file=new URL('../../api/engine/orchestrator.js',import.meta.url),context=vm.createContext({console,process,crypto,Date,Set,Map,JSON});
const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(m){m.url=file.href;}});
await mod.link(s=>{const v=mocks[s];assert.ok(v,s);return new vm.SyntheticModule(Object.keys(v),function(){for(const[k,x]of Object.entries(v))this.setExport(k,x);},{context});});await mod.evaluate();
const why=mod.namespace._buildWhyResponse_test;
const base={last_daily_decision:{mode:'ASK'},last_domain_response:{explanation_context:{system_leverage:{node_id:'EXCESS_ADIPOSITY'},system_constraint:{node_id:'EXCESS_ADIPOSITY'},leverage_evidence:{direct:[{obs_type:'weight_kg',value:88,height_cm:178}]},reported_gait_evidence:{direct:[{question_id:'gait_instability_reported',value:true}]},action_context:{selected:null}}}};
const results=[];
for(const fact of [{question_id:'gait_instability_reported',value:true},{question_id:'gait_stability',value:false},{question_id:'gait_stability',value:' NE '}]){
 const s=structuredClone(base);s.last_domain_response.explanation_context.reported_gait_evidence={direct:[fact]};const before=JSON.stringify(s),r=why(s);
 assertGaitScope(r.text);assert.equal(r.mode,'EXPLAIN');assert.equal(r.buttons.length,0);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(r.session_updates),'{}');
 results.push({fact,text:r.text});
}
for(const fact of [{question_id:'gait_instability_reported',value:false},{question_id:'gait_stability',value:true},{question_id:'rovnovaha_zavrene_oci',value:false}]){
 const s=structuredClone(base);s.last_domain_response.explanation_context.reported_gait_evidence={direct:[fact]};const r=why(s);
 assert.equal(r.text,'Vycházím ze zadané výšky a hmotnosti. Proto se dnes zaměřujeme na množství tělesného tuku. Cílem je podpořit tvůj aktuální zdravotní stav.','Non-reports/proxies retain original explanation');
}
const gait=structuredClone(base);const ctx=gait.last_domain_response.explanation_context;ctx.system_leverage={node_id:'GAIT_INSTABILITY'};ctx.system_constraint={node_id:'GAIT_INSTABILITY'};ctx.leverage_evidence=ctx.reported_gait_evidence;
assert.equal(why(gait).text,'Uvádíš nejistotu při chůzi. Proto se dnes zaměřujeme na jistotu při chůzi. Cílem je podpořit tvůj aktuální zdravotní stav.');
const done=structuredClone(base);done.last_daily_decision={mode:'HOLD',reason_code:'HOLD_DONE_TODAY'};
assert.equal(why(done).text,'Uvádíš nejistotu při chůzi. Dnešní akci už máš hotovou. Nové údaje beru v úvahu při dalším vyhodnocení; další cvik dnes nenabízím.');
assert.equal(why({}).debug.source,'no_cached_context');assert.equal(calls,0);
console.log(JSON.stringify({status:'PASS',reported_cases:results,controls:6,engine_calls:calls}));
