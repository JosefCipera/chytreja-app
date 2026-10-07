// Run from repo root: node --experimental-vm-modules scripts/ai-tester/run-floor-rise.mjs --probe
// --live uses the actual app classifier and Anthropic SDK; only the DB/engine are fixtures.
// No Supabase client, credentials, live accounts, or application deployment are used.
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const live=process.argv.includes('--live');
const probe=process.argv.includes('--probe');
if(live===probe)throw Error('Choose exactly one: --live or --probe');
const spec=JSON.parse(fs.readFileSync(new URL('./floor-rise.json',import.meta.url),'utf8'));
let ActualAI;
if(live){
 if(!process.env.ANTHROPIC_API_KEY){
  console.log(JSON.stringify({mode:'live',cases:spec.cases.map(c=>({id:c.id,status:'BLOCKED',reason:'ANTHROPIC_API_KEY unavailable; no classifier call made'}))},null,2));
  process.exit(2);
 }
 ActualAI=(await import('@anthropic-ai/sdk')).default;
}
const context=vm.createContext({console,process,crypto,Date,Set,Map,JSON});
async function isolated(file,mocks){
 const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;}});
 await m.link(s=>{const v=mocks[s];if(!v)throw Error('Unexpected dependency: '+s);return new vm.SyntheticModule(Object.keys(v),function(){for(const [k,x]of Object.entries(v))this.setExport(k,x);},{context});});
 await m.evaluate();return m.namespace;
}
let health,writes,observedEvent,classification,currentInput,classifierError,engineCalls;
const db={from(table){if(table!=='user_health_profile')throw Error('Unexpected table: '+table);const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:health,error:null}),upsert:async row=>{writes.push(row);health={...health,...row};return {error:null};}};return q;}};
const adapter=await isolated(new URL('../../api/engine/healthEventAdapter.js',import.meta.url),{
 '@supabase/supabase-js':{createClient:()=>db},'./engine.js':{runEngine:async()=>{engineCalls++;return {}; }},
 './dailyDecision.js':{computeDailyDecision:()=>({mode:'HOLD',reason_code:'FIXTURE_ENGINE'})},'./adapter.js':{mapDiagnosis:()=>null},
});
class InstrumentedAI{
 messages={create:async args=>{
  if(probe){classification={event_type:'GENERAL_HEALTH_REQUEST',payload:{text:currentInput}};return {content:[{type:'tool_use',input:classification}]};}
  try{const response=await new ActualAI().messages.create(args);classification=response.content.find(c=>c.type==='tool_use')?.input ?? null;return response;}
  catch(error){classifierError=error?.status ?? 'API_ERROR';throw error;}
 }};
}
const orchestrator=await isolated(new URL('../../api/engine/orchestrator.js',import.meta.url),{
 '@anthropic-ai/sdk':{default:InstrumentedAI},'./healthEventAdapter.js':{applyHealthEvent:async(uid,event)=>{observedEvent=event;return adapter.applyHealthEvent(uid,event);}},
 './nextBestEvidence.js':{selectNextBestEvidence:()=>null},'./decisionGate.js':{synthesizePathDiscovery:()=>null},fs,url,path,
});
const results=[];
for(const c of spec.cases){
 health={physical:{},symptoms:[],diagnoses:[]};writes=[];observedEvent=null;classification=null;classifierError=null;engineCalls=0;currentInput=c.input;
 const response=await orchestrator.processInput('isolated-ai-tester',c.input,{});
 let status,reason;
 if(classifierError){status='BLOCKED';reason='Classifier API unavailable: '+classifierError;}
 else if(c.expected.physical){
  const actual=health.physical?.vstat_ze_zeme;
  status=actual===c.expected.physical.vstat_ze_zeme?'PASS':'FAIL';
  reason=status==='PASS'?'Expected structured fact persisted':'Expected structured floor-rise fact absent or incorrect';
 }else if(probe){status='BLOCKED';reason='Clarification requires real classifier; probe does not test language understanding';}
 else{
  const clarify=response.mode==='ASK' && /(?:židl|zidl)/i.test(response.text) && /zem/i.test(response.text);
  const noPhysical=writes.every(w=>!Object.hasOwn(w,'physical'));
  status=clarify&&noPhysical?'PASS':'FAIL';reason=status==='PASS'?'Chair/floor clarification without fact write':'Missing targeted clarification or premature fact write';
 }
 results.push({id:c.id,input:c.input,status,reason,classification,event_type:observedEvent?.event_type ?? null,physical:health.physical,raw_symptoms:health.symptoms,response:{mode:response.mode,text:response.text},engine_fixture_calls:engineCalls});
}
console.log(JSON.stringify({mode:live?'live_classifier':'adapter_probe',limitations:['DB and downstream engine are fixtures','Probe injects GENERAL_HEALTH_REQUEST and does not validate AI interpretation','No voice recognition, action selection or live account verification'],cases:results},null,2));
process.exitCode=results.some(r=>r.status==='FAIL')?1:results.some(r=>r.status==='BLOCKED')?2:0;
