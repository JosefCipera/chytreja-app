import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withPrivacy} from '../api/lib/withPrivacy.js';
import {privacyContext} from '../api/lib/privacyContext.js';
import {createClient} from '../api/lib/privacySupabase.js';
import {HEALTH_VERSION,TERMS_VERSION,POLICY_VERSION} from '../api/lib/privacyStore.js';
import {makePrivacyHandler} from '../api/privacy.js';
import {eraseJob,makeStorageAdapter} from '../api/lib/privacyErasure.js';
const active=()=>({status:'active',epoch:1,adult:true,health_version:HEALTH_VERSION,terms_version:TERMS_VERSION,policy_version:POLICY_VERSION,cleanup_pending:false});
const res=()=>({code:200,body:null,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;},end(){return this;}});
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const identity=async()=>({uid:'fixture-a'}),request={headers:{},body:{},query:{}};
await test('health API rejects missing, withdrawn and obsolete consent before handler',async()=>{
 for(const state of [{status:'pending',epoch:0},{...active(),status:'withdrawn'},{...active(),health_version:'old'}]){
  let touched=false;const reply=res();await withPrivacy(async()=>{touched=true;},{identify:identity,status:async()=>state,ready:()=>true})(request,reply);
  assert.equal(touched,false);assert.equal(reply.code,403);
 }
});
await test('setup and control-plane outages fail closed',async()=>{
 for(const options of [{ready:()=>false},{ready:()=>true,status:async()=>{throw Error('offline');}}]){
  let called=false;const reply=res();await withPrivacy(async()=>{called=true;},{identify:identity,status:async()=>active(),...options})(request,reply);
  assert.equal(called,false);assert.equal(reply.code,503);
 }
});
await test('demo and mixed body/query impersonation are rejected',async()=>{
 for(const [who,req] of [[{uid:'demo-user-123',demo:true},request],[{uid:'fixture-a'},{...request,body:{userId:'fixture-a'},query:{userId:'fixture-b'}}]]){
  const reply=res();let touched=false;await withPrivacy(async()=>{touched=true;},{identify:async()=>who,status:async()=>active(),ready:()=>true})(req,reply);
  assert.equal(touched,false);assert.ok([401,403].includes(reply.code));
 }
});
await test('withdrawal fences an already running response',async()=>{
 let state=active(),release,entered;
 const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r),reply=res();
 const running=withPrivacy(async(_req,r)=>{entered();await hold;return r.json({private:'synthetic health output'});},{identify:identity,status:async()=>state,ready:()=>true})(request,reply);
 await started;state={...state,status:'withdrawn',epoch:2};release();await running;
 assert.equal(reply.code,403);assert.equal(JSON.stringify(reply.body).includes('synthetic health'),false);
});
await test('old response remains fenced after withdrawal and a new grant',async()=>{
 let state=active(),release,entered;
 const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r),reply=res();
 const running=withPrivacy(async(_req,r)=>{entered();await hold;return r.json({late:true});},{identify:identity,status:async()=>state,ready:()=>true})(request,reply);
 await started;state={...active(),epoch:3};release();await running;assert.equal(reply.code,403);
});
await test('cached Supabase client uses concurrent request context at fetch time',async()=>{
 const seen=[];const db=createClient('https://fixture.invalid','synthetic-fixture-key',{global:{fetch:async(_url,init)=>{await Promise.resolve();seen.push(Object.fromEntries(init.headers));return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});}}});
 await Promise.all(['fixture-a','fixture-b'].map((uid,i)=>privacyContext.run({uid,epoch:i+7,scope:'health'},async()=>{await Promise.resolve();await db.from('user_profiles').select('user_id');})));
 assert.deepEqual(seen.map(h=>[h['x-chj-privacy-uid'],h['x-chj-privacy-epoch']]).sort(),[['fixture-a','7'],['fixture-b','8']]);
});
function fixtureApi({age=0,ready=true}={}){
 let state=active(),rpcCalls=[],job=null;
 const store={rpc:async(name,args)=>{rpcCalls.push({name,args});
  if(name==='chj_privacy_status')return {data:state};
  if(name==='chj_privacy_change'){
   if(args.p_action==='grant')state={...active(),epoch:state.epoch+1};
   else if(args.p_action==='withdraw')state={...state,status:'withdrawn',epoch:state.epoch+1};
   else{state={...state,status:'deleting',epoch:state.epoch+1};job={id:'fixture-job',uid:args.p_uid,stage:'queued',kind:'account',hash:args.p_receipt_hash};}
   return {data:{...state,job_id:job?.id}};
  }throw Error(name);
 },from:()=>{const filters={};return {select(){return this;},eq(k,v){filters[k]=v;return this;},neq(){return this;},async maybeSingle(){return {data:job&&(!filters.receipt_hash||filters.receipt_hash===job.hash)?job:null};}};}};
 const auth={verifyIdToken:async(token,revoked)=>{assert.equal(revoked,true);if(token!=='fixture-token')throw Error();return {uid:'fixture-a',auth_time:1000-age};}};
 return {handler:makePrivacyHandler({auth:()=>auth,db:()=>store,ready:()=>ready,now:()=>1000000,runJob:async()=>({stage:'external_review'}),manifest:()=>null}),rpcCalls,getJob:()=>job};
}
const req=(action,body={})=>({method:'POST',headers:{authorization:'Bearer fixture-token'},query:{},body:{action,...body}});
await test('grant requires separate affirmative checks and exact versions',async()=>{
 const f=fixtureApi();
 for(const patch of [{health:false},{terms:false},{adult:false},{health_version:'old'}]){
  const r=res();await f.handler(req('grant',{health:true,terms:true,adult:true,health_version:HEALTH_VERSION,terms_version:TERMS_VERSION,policy_version:POLICY_VERSION,...patch}),r);
  assert.equal(r.code,400);
 }
 assert.equal(f.rpcCalls.some(c=>c.name==='chj_privacy_change'),false);
 const r=res();await f.handler(req('grant',{health:true,terms:true,adult:true,health_version:HEALTH_VERSION,terms_version:TERMS_VERSION,policy_version:POLICY_VERSION}),r);assert.equal(r.code,200);
});
await test('withdrawal works even while new collection is not ready',async()=>{
 const f=fixtureApi({ready:false}),r=res();await f.handler(req('withdraw'),r);assert.equal(r.code,202);assert.equal(r.body.status,'withdrawn');
});
await test('delete requires recent identity and typed confirmation',async()=>{
 const f=fixtureApi({age:301}),r=res();await f.handler(req('delete',{confirmation:'SMAZAT'}),r);assert.equal(r.code,401);assert.equal(f.getJob(),null);
 const g=fixtureApi(),s=res();await g.handler(req('delete',{confirmation:'ano'}),s);assert.equal(s.code,400);assert.equal(g.getJob(),null);
});
await test('delete uses token UID; receipt is hashed and status never leaks identity',async()=>{
 const f=fixtureApi(),bad=res();await f.handler(req('delete',{confirmation:'SMAZAT',userId:'fixture-b'}),bad);assert.equal(bad.code,403);assert.equal(f.getJob(),null);
 const r=res();await f.handler(req('delete',{confirmation:'SMAZAT'}),r);assert.equal(r.code,202);
 assert.equal(f.getJob().hash,createHash('sha256').update(r.body.receipt).digest('hex'));
 const s=res();await f.handler({method:'POST',headers:{},body:{action:'deletion-status',receipt:r.body.receipt}},s);assert.equal(s.code,200);assert.equal('uid' in s.body,false);assert.equal('receipt_hash' in s.body,false);
});
await test('unreviewed storage blocks completion rather than reporting full erasure',async()=>{
 await assert.rejects(()=>makeStorageAdapter({db:{},manifest:null}).erase('fixture-a'),{code:'STORAGE_REVIEW_REQUIRED'});
 let identityDeleted=false;
 await assert.rejects(()=>eraseJob({id:'job',uid:'fixture-a',kind:'account'},{db:{rpc:async()=>({data:{}})},lease:'fixture-lease',storage:{erase:async()=>{throw Error('pending review');}},identity:{deleteUser:async()=>identityDeleted=true},advance:async()=>{}}));
 assert.equal(identityDeleted,false);
});
await test('erasure preserves external review; Firebase not-found is idempotent',async()=>{
 const steps=[];
 const result=await eraseJob({id:'job',uid:'fixture-a',kind:'account'},{db:{rpc:async()=>({data:{}})},lease:'fixture-lease',storage:{erase:async()=>{}},identity:{revokeRefreshTokens:async()=>{throw {code:'auth/user-not-found'};},deleteUser:async()=>{throw {code:'auth/user-not-found'};}},advance:async(_j,_l,s)=>steps.push(s)});
 assert.equal(result.stage,'external_review');assert.equal(result.all_copies_erased,false);assert.deepEqual(steps,['identity','external_review']);
});
await test('withdrawal keeps external copies pending and preserves identity',async()=>{
 const steps=[];
 const result=await eraseJob({id:'job',uid:'fixture-a',kind:'health'},{db:{rpc:async()=>({data:{}})},lease:'fixture-lease',storage:{erase:async()=>{}},identity:{deleteUser:async()=>{throw Error('must preserve account');}},advance:async(_j,_l,s)=>steps.push(s)});
 assert.equal(result.stage,'external_review');assert.equal(result.all_copies_erased,false);assert.deepEqual(steps,['external_review']);
});
console.log('PASS privacy unit/integration boundaries: '+passed+' cases; no real accounts or network calls.');
