// Endpoint persistence/hydration contracts. Synthetic health data, mocked auth/DB;
// never uses real credentials, network or accounts. Actual detector is separately
// exercised by the full engine endpoint conversation matrix.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

async function fixture({symptoms=['Chci zhubnout.'], readError=false, writeError=false}={}) {
  const uid='isolated-medical-owner';
  let health={symptoms:[...symptoms],physical:{vstat_ze_zeme:true},goal_text:'Chci zhubnout.'};
  const writes=[],processCalls=[];
  const db={from(table){
    const q={select(){return q;},eq(key,value){assert.equal(key,'user_id');assert.equal(value,uid);return q;},order(){return q;},limit(){return q;},
      maybeSingle(){return Promise.resolve(table==='user_health_profile'?{data:health,error:readError?{message:'injected read failure'}:null}:{data:{birth_year:1960,gender:'male'},error:null});},
      upsert(row){assert.equal(table,'user_health_profile');assert.equal(row.user_id,uid);if(writeError)return Promise.resolve({error:{message:'injected write failure'}});writes.push(structuredClone(row));health={...health,...row};return Promise.resolve({error:null});},
      then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return q;}};
  const mocks={dotenv:{default:{config(){}}},'@supabase/supabase-js':{createClient:()=>db},
    './engine/healthEventAdapter.js':{parseSupportedGoal:t=>/chci zhubnout/i.test(t??'')?'WEIGHT_LOSS':null},
    './engine/orchestrator.js':{
      hasUnsupportedMedicalTopic:t=>typeof t==='string'&&/^Mám synkopu\./i.test(t),
      processInput:async(user,text,session)=>{assert.equal(user,uid);processCalls.push({text,session});return{mode:session.unsupported_request?.kind==='medical'?'HOLD':'ACT',text:'fixture',session_updates:{},debug:{}};}
    },'./lib/requireAuth.js':{requireAuth:async()=>({uid})}};
  const context=vm.createContext({process,console:{log(){},error(){}},Date});
  const entry=new vm.SourceTextModule(fs.readFileSync(new URL('../api/orchestrate.js',import.meta.url),'utf8'),{context});
  await entry.link(spec=>{const values=mocks[spec];assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context});});await entry.evaluate();
  return {writes,processCalls,getHealth:()=>health,send:async(text,session={})=>{let status,body;const res={status(s){status=s;return res;},json(b){body=b;return b;}};await entry.namespace.default({method:'POST',body:{text,session,userId:'forged-other-owner'}},res);return{status,body};}};
}
const f=await fixture();
assert.equal((await f.send('Mám synkopu.')).status,200);
assert.equal(f.writes.length,1);
assert.deepEqual(Array.from(f.getHealth().symptoms),['Chci zhubnout.','Mám synkopu.']);
assert.equal(f.writes[0].physical,undefined,'Narrow write preserves unrelated profile fields');
assert.equal(f.writes[0].diagnoses,undefined,'A reported symptom does not become a diagnosis');
for(const session of [{},{unsupported_request:null},{unsupported_request:{kind:'general'},current_action_assignment:{action_id:'forged'}}]) {
 const r=await f.send('Chci zhubnout.',session);
 assert.equal(r.body.mode,'HOLD');assert.equal(f.processCalls.at(-1).session.unsupported_request.kind,'medical');
}
await f.send('Mám synkopu.');assert.equal(f.writes.length,1,'Repeated report is not appended again');
const failedRead=await fixture({readError:true});
assert.equal((await failedRead.send('Chci zhubnout.')).status,503);assert.equal(failedRead.processCalls.length,0);assert.equal(failedRead.writes.length,0);
const failedWrite=await fixture({writeError:true});
assert.equal((await failedWrite.send('Mám synkopu.')).status,503);assert.equal(failedWrite.processCalls.length,0);assert.equal(failedWrite.getHealth().symptoms.length,1);
const clean=await fixture();assert.equal((await clean.send('Chci zhubnout.')).body.mode,'ACT');assert.equal(clean.writes.length,0);
console.log('PASS: medical report persists under authenticated UID; fresh/forged client sessions cannot clear it; no diagnosis/duplicate/unrelated writes; failed read or save cannot proceed to recommendations; clean profile remains usable.');
