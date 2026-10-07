// Personal intent storage and authoritative endpoint hydration; no live account writes.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const context=vm.createContext({console,process,Date,Set,Map,JSON});
async function isolated(file,mocks){
 const m=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context});
 await m.link(spec=>{const v=mocks[spec];assert.ok(v,spec);return new vm.SyntheticModule(Object.keys(v),function(){for(const [k,x]of Object.entries(v))this.setExport(k,x);},{context});});
 await m.evaluate();return m.namespace;
}
let writes=[],failWrite=false,engineCalls=0,profile={physical:{},goal_text:null,symptoms:['chci zhubnout']},captured;
const db={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},maybeSingle(){return Promise.resolve({data:table==='user_profiles'?{birth_year:1958,gender:'female'}:profile});},upsert(row){writes.push({table,row});return Promise.resolve({error:failWrite?{message:'simulated failure'}:null});},then(resolve){return Promise.resolve({data:[]}).then(resolve);}};return q;}};
const adapter=await isolated(new URL('../api/engine/healthEventAdapter.js',import.meta.url),{
 '@supabase/supabase-js':{createClient:()=>db},'./engine.js':{runEngine:async()=>{engineCalls++;return {}; }},
 './dailyDecision.js':{computeDailyDecision:()=>({mode:'HOLD'})},'./adapter.js':{mapDiagnosis:()=>null},
});
for(const text of ['chci zhubnout','Chci zhubnout.','Chtěla bych snížit váhu'])assert.equal(adapter.parseSupportedGoal(text),'WEIGHT_LOSS');
for(const text of ['nechci zhubnout','chci zhubnout a mám synkopu','přibral jsem','říkala: chci zhubnout','chci zlepšit kondici'])assert.equal(adapter.parseSupportedGoal(text),null);
let r=await adapter.applyHealthEvent('fixture',{event_type:'GENERAL_HEALTH_REQUEST',payload:{text:'chci zhubnout'}});
assert.equal(r.persistence_status,'ok');assert.equal(engineCalls,1);
assert.equal(writes.length,1);assert.equal(writes[0].table,'user_health_profile');
assert.deepEqual(Object.keys(writes[0].row).sort(),['goal_text','user_id']);
assert.equal(writes[0].row.goal_text,'chci zhubnout');
failWrite=true;
r=await adapter.applyHealthEvent('fixture',{event_type:'GENERAL_HEALTH_REQUEST',payload:{text:'chci zhubnout'}});
assert.equal(r.persistence_status,'error');assert.equal(engineCalls,1,'Failed persistence must not report success or call engine');
failWrite=false;writes=[];
const endpoint=await isolated(new URL('../api/orchestrate.js',import.meta.url),{
 dotenv:{default:{config(){}}},'@supabase/supabase-js':{createClient:()=>db},
 './engine/healthEventAdapter.js':{parseSupportedGoal:adapter.parseSupportedGoal},
 './engine/orchestrator.js':{processInput:async(uid,text,state)=>{captured={uid,text,state};return {mode:'HOLD',debug:{}};}},
 './lib/requireAuth.js':{requireAuth:async()=>({uid:'fixture'})},
});
const res={status(code){assert.equal(code,200);return res;},json(value){return value;}};
async function request(text){await endpoint.default({method:'POST',body:{text,session:{person_goal:'FORGED'}}},res);return captured.state.person_goal;}
assert.equal(await request('Proč?'),'WEIGHT_LOSS','Existing tester goal must survive reload without writes');
assert.equal(writes.length,0);
profile={physical:{},goal_text:'Chci zlepšit kondici',symptoms:['chci zhubnout']};
assert.equal(await request('Proč?'),null,'Explicit stored goal takes precedence over legacy symptoms');
assert.equal(await request('chci zhubnout'),'WEIGHT_LOSS','Current request acknowledged before persistence');
assert.equal(captured.state.explicit_goal_request,true);
profile={physical:{},goal_text:null,symptoms:[]};
assert.equal(await request('Proč?'),null,'Client cannot forge personal goal');
assert.equal(captured.state.explicit_goal_request,false);
console.log('PASS: exact intent, negation/mixed-input rejection, canonical storage, failed write, read-only legacy hydration and server authority.');
