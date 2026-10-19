// Exercise the same phase controller as live CI, without model/network/Docker.
// Deliberately wrong implementation must get reserved feedback and cannot pass
// by a model's submit/ACCEPT claim alone.
import assert from 'node:assert/strict';
import {runPhasedRepair,validateDiagnosis} from './phases.mjs';
const task={goal:'repair fixture behaviour',readable:['fixture.js'],editable:['fixture.js'],prohibited:[],limits:{worker_calls:12,repair_rounds:3}};
const tools=['inspect','diagnose','replace','edit_lines','submit'].map(name=>({name}));
const use=(name,input={})=>({type:'tool_use',id:'tool-'+Math.random(),name,input});
const diagnosis={cause:'The inspected fixture violates its requested behaviour.',plan:'Change the relevant expression, preserving unrelated behaviour.',evidence_refs:['fixture.js:1']};
assert.throws(()=>validateDiagnosis({...diagnosis,evidence_refs:['unseen.js:1']},new Set(['fixture.js:1'])));
async function experiment({reviewVerdict='ACCEPT',unfixable=false,wandering=false}={}){
 const requests=[],events=[];let patched='none',reviews=0,inspects=0,snapshots=0,validation=0;
 const result=await runPhasedRepair({task,tools,
  request:async p=>{
   requests.push(p);const n=requests.filter(x=>x.phase===p.phase).length;
   if(p.phase==='diagnosis'){
    if(wandering&&n<4)return {content:[use('inspect',{path:'fixture.js',start:n})]};
    if(!wandering&&n===1)return {content:[use('inspect',{path:'fixture.js'})]};
    return {content:[use('diagnose',diagnosis)]};
   }
   if(p.phase==='implementation')return {content:[use('replace',{value:'wrong'})]};
   return {content:[use('replace',{value:unfixable?'wrong':'fixed'}),use('submit',{explanation:'Candidate for controller verification'})]};
  },
  invoke:async(name,args)=>{if(name==='inspect'){inspects++;return 'FILE_SHA256 fixture\n1: fixture source';}patched=args.value;return {status:'EDITED'};},
  snapshot:async()=>{snapshots++;},
  verify:async()=>{validation++;return {status:patched==='fixed'?'PASS':'FAIL',failure:patched==='fixed'?null:'Fixture still wrong'};},
  review:async()=>{reviews++;return {verdict:reviewVerdict,reason:'independent'};},
  log:(name,detail)=>events.push({name,...detail}),
 });
 return {result,requests,events,reviews,inspects,snapshots,validation};
}
const a=await experiment({wandering:true});
assert.equal(a.result.status,'REPAIR_CANDIDATE');
assert.equal(a.requests.filter(x=>x.phase==='diagnosis').length,4);
assert.deepEqual(a.requests.filter(x=>x.phase==='diagnosis').at(-1).tool_choice,{type:'tool',name:'diagnose'});
assert.equal(a.result.rounds[0].validation.status,'FAIL');
assert.equal(a.result.rounds[0].review.verdict,'NOT_RUN');
assert.equal(a.reviews,1);assert.equal(a.validation,2);
assert.ok(a.requests.some(x=>x.phase==='feedback'));
assert.ok(a.requests.filter(x=>x.phase!=='diagnosis').every(x=>!x.tools.some(t=>['inspect','diagnose'].includes(t.name))));
assert.ok(a.result.calls<=12);assert.ok(a.snapshots>0);
assert.equal((await experiment({unfixable:true})).result.status,'NEEDS_REPAIR');
assert.equal((await experiment({reviewVerdict:'BLOCKED'})).result.status,'BLOCKED_REVIEW');
assert.equal((await experiment({reviewVerdict:'RETURN'})).result.status,'NEEDS_REPAIR');
console.log('PASS: diagnosis cap, forced grounded handoff, reserved real edits/feedback, automatic sealed verification, no review on failures, no false approval, snapshots and overall limits.');
