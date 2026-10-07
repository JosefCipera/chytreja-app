// Actual classifier + complete engine pipeline. Only database and catalog are fixtures.
// Catalog fixture contains confirmed fields from tester137 investigation; unknown columns stay null.
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const live=process.argv.includes('--live');
if(live&&!process.env.ANTHROPIC_API_KEY){console.log(JSON.stringify({status:'BLOCKED',reason:'ANTHROPIC_API_KEY unavailable'}));process.exit(2);}
const ActualAI=live?(await import('@anthropic-ai/sdk')).default:null;
const traceConsole={...console,log:(...args)=>console.error(...args)};
const context=vm.createContext({console:traceConsole,process,crypto,Date,Set,Map,JSON,URL});
const cache=new Map();let classification,engineResult;
const profile={birth_year:1959,gender:'male',height:178,weight:88};
let health={diagnoses:[],symptoms:[],medications:[],supplements:[],labs:{},lifestyle:{waist_cm:99},capacity:{},physical:{recent_falls:false,vynest_nakup:true,vstat_ze_zeme:true,zvednout_vnouce:true,rovnovaha_zavrene_oci:false}};
const stepDown={id:'step_down',node_id:'plyometrie',label:'Kontrolovaný sestup z bedny — 1 noha',protocol_type:'SILOVY_PROTOKOL',tags:['sila','plyometrie','kosti','dopad','dekatlon'],constraint_exclude:['knee','ankle_foot'],type:null,tier:null,duration:null,reps:null,intensity:null,modality:null,support_sides:null,stability_support:null,upper_body_demand:null,load_distribution:null};
const db={from(table){let allowedProtocols;const result=()=>({data:table==='user_profiles'?profile:table==='user_health_profile'?health:table==='longevity_actions'?[stepDown].filter(a=>!allowedProtocols||allowedProtocols.includes(a.protocol_type)):[],error:null});const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},gte(){return q;},in(key,values){if(key==='protocol_type')allowedProtocols=values;return q;},maybeSingle:async()=>result(),upsert:async row=>{if(table!=='user_health_profile')throw Error('Unexpected write');health={...health,...row};return {error:null};},then(resolve){return Promise.resolve(result()).then(resolve);}};return q;}};
class AI{messages={create:async args=>{if(!live){classification={event_type:'GENERAL_HEALTH_REQUEST',payload:{text:'Jsem nejistý při chůzi.'}};return {content:[{type:'tool_use',input:classification}]};}const r=await new ActualAI().messages.create(args);classification=r.content.find(c=>c.type==='tool_use')?.input;return r;}};}
const mocks={'@anthropic-ai/sdk':{default:AI},'@supabase/supabase-js':{createClient:()=>db},fs,url,path};
function moduleFor(file){if(cache.has(file.href))return cache.get(file.href);const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;}});cache.set(file.href,m);return m;}
function link(spec,ref){const alias=spec.replace(/^node:/,'');if(mocks[alias]){const key='mock:'+alias;if(!cache.has(key)){const values=mocks[alias];cache.set(key,new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context}));}return cache.get(key);}if(!spec.startsWith('.'))throw Error('Unexpected dependency: '+spec);return moduleFor(new URL(spec,ref.identifier));}
const entry=moduleFor(new URL('../../api/engine/orchestrator.js',import.meta.url));await entry.link(link);await entry.evaluate();
const response=await entry.namespace.processInput('isolated-tester137','Jsem nejistý při chůzi.',{});
const inputClassification=classification;
const engine=cache.get(new URL('../../api/engine/engine.js',import.meta.url).href).namespace;
engineResult=await engine.runEngine('isolated-tester137');
const why=await entry.namespace.processInput('isolated-tester137','Proč?',response.session_updates);
const gait=engineResult.node_states.find(n=>n.node_id==='GAIT_INSTABILITY');
const candidate=engineResult.next_best_action.all_candidates?.find(c=>c.action_id==='step_down');
const recorded=health.physical.gait_stability===false||health.physical.gait_instability_reported===true;
const reasons=gait?.evidence;
const cases=[
 {id:'spoken-gait-fact',status:recorded?'PASS':'FAIL',expected:'Current instability reaches a structured functional field without diagnosis',actual:{classification:inputClassification,physical:health.physical,symptoms:health.symptoms,gait_evidence:reasons}},
 {id:'step-down-safety',status:!candidate?'BLOCKED':candidate.safety.level==='SAFE'?'FAIL':'PASS',expected:'Single-leg step-down with predicted gait instability is not unconditionally SAFE',actual:candidate?.safety??'Candidate absent'},
 {id:'priority-explanation',status:engineResult.system_leverage.selected?.node_id==='GAIT_INSTABILITY'||/nejist|chůz|chuz/i.test(why.text)?'PASS':'FAIL',expected:'If a different priority is selected, acknowledge the expressed gait problem',actual:why.text},
];
console.log(JSON.stringify({mode:live?'live_classifier_real_engine':'injected_classifier_real_engine',limitations:['Fixture database; no live account accessed','Restricted catalog fixture, not full production action ranking','Unknown catalog fields kept null; unconditional safety classification can still be checked','No clinical efficacy or exercise dose validation'],profile,health,engine:{nodes:engineResult.node_states,leverage:engineResult.system_leverage,constraint:engineResult.system_constraint,decision_gate:engineResult.decision_gate,nba:engineResult.next_best_action},response:{mode:response.mode,text:response.text},cases},null,2));
process.exitCode=cases.some(c=>c.status==='FAIL')?1:cases.some(c=>c.status==='BLOCKED')?2:0;
