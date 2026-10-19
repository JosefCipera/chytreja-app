// Phase controller: model output never controls budgets, tools or acceptance.
export const PHASE_BUDGETS=Object.freeze({diagnosis:4,implementation:3,feedback:2});
const text=value=>typeof value==='string'?value:JSON.stringify(value);
export function validateDiagnosis(input,refs){
  if(!input||typeof input.cause!=='string'||input.cause.trim().length<15||input.cause.length>1800
      ||typeof input.plan!=='string'||input.plan.trim().length<15||input.plan.length>1800
      ||!Array.isArray(input.evidence_refs)||!input.evidence_refs.length||input.evidence_refs.length>6
      ||input.evidence_refs.some(r=>!refs.has(r)))throw Error('Diagnosis must cite inspected source lines and include cause and repair plan');
  return input;
}
export async function runPhasedRepair({task,request,tools,invoke,verify,review,snapshot,log}){
  let calls=0;const phases=[],evidence=[],refs=new Set(),seenReads=new Set();
  const emit=(kind,detail)=>log(kind,detail);
  async function phase(name,limit,context){
    const phaseRecord={name,limit,calls:0,inspections:0};phases.push(phaseRecord);emit('phase_started',phaseRecord);
    const messages=[{role:'user',content:JSON.stringify(context)}];
    let completed=null,edits=0;
    const allowed=name==='diagnosis'?['inspect','diagnose']:['replace','edit_lines','submit'];
    for(let n=0;n<limit&&!completed;n++){
      if(calls>=task.limits.worker_calls)throw Error('Overall worker call budget exhausted');
      const last=n===limit-1;
      // The final diagnosis request must explain the observed failure. During
      // implementation source browsing is unavailable; edit/submit only.
      const available=tools.filter(t=>allowed.includes(t.name));
      const choice=name==='diagnosis'&&last?{type:'tool',name:'diagnose'}:{type:'any'};
      phaseRecord.calls++;calls++;
      const response=await request({phase:name,messages:[...messages,{role:'user',content:`Phase ${name}; requests left in this phase: ${limit-n}. Diagnosis must cite observed lines. Implementation must make a concrete scoped edit, not request more reading. After an edit the controller runs sealed verification automatically.`}],tools:available,tool_choice:choice});
      messages.push({role:'assistant',content:response.content});
      const toolCalls=response.content?.filter(c=>c.type==='tool_use')??[];
      if(!toolCalls.length||toolCalls.length>4)throw Error('Invalid phase tool batch');
      const outputs=[];
      for(const call of toolCalls){
        let value;
        try{
          if(completed)throw Error('Phase already completed');
          if(!allowed.includes(call.name))throw Error('Tool unavailable in current phase');
          if(call.name==='diagnose'){
            value=validateDiagnosis(call.input,refs);completed=value;
            emit('diagnosis',{value});
          }else if(call.name==='submit'){
            if(!edits)throw Error('No edit in this phase; cannot submit');
            if(typeof call.input.explanation!=='string'||!call.input.explanation.trim())throw Error('Submission explanation required');
            completed={explanation:call.input.explanation.slice(0,2000)};value={status:'SUBMITTED'};
          }else{
            if(call.name==='inspect'){
              // Charge/reject repeated reads and excessive batches independently
              // of the model request count; they cannot consume reserved edit calls.
              const key=JSON.stringify(call.input);
              if(seenReads.has(key))throw Error('This exact source request was already returned; use that evidence');
              if(phaseRecord.inspections>=6)throw Error('Diagnosis inspection budget exhausted');
              seenReads.add(key);phaseRecord.inspections++;
            }
            value=await invoke(call.name,call.input);
            if(call.name==='inspect'){
              evidence.push({path:call.input.path,text:String(value)});
              for(const match of String(value).matchAll(/^(\d+): /gm))refs.add(call.input.path+':'+match[1]);
            }else{edits++;await snapshot();}
            emit('worker_tool',{phase:name,name:call.name,input:call.input,result:value});
          }
          outputs.push({type:'tool_result',tool_use_id:call.id,content:text(value)});
        }catch(error){
          emit('tool_rejected',{phase:name,name:call.name,input:call.input,reason:error.message});
          outputs.push({type:'tool_result',tool_use_id:call.id,is_error:true,content:JSON.stringify({error:error.message})});
        }
      }
      messages.push({role:'user',content:outputs});
    }
    // No submission ceremony may waste a real patch: the controller verifies it
    // when the edit budget ends, even if the model failed to call submit.
    if(!completed&&name!=='diagnosis'&&edits)completed={explanation:'Phase budget ended after an actual edit; automatic sealed verification'};
    emit('phase_finished',{...phaseRecord,completed:Boolean(completed),edits});
    if(!completed)throw Error(name==='diagnosis'?'Diagnosis budget exhausted without grounded diagnosis':'Implementation budget exhausted without an edit');
    return completed;
  }
  const common={goal:task.goal,files:task.readable,editable:task.editable,prohibited:task.prohibited};
  const diagnosis=await phase('diagnosis',PHASE_BUDGETS.diagnosis,{...common,initial_failure:task.initial_failure,instruction:'Find the concrete software cause using targeted literal searches, then call diagnose with cause, plan and exact path:line references returned by inspect. Do not read the whole file. No patch is prescribed.'});
  const focused=evidence.filter(e=>diagnosis.evidence_refs.some(r=>r.startsWith(e.path+':')));
  let feedback=null;const rounds=[];
  for(let round=1;round<=task.limits.repair_rounds;round++){
    const name=round===1?'implementation':'feedback';
    await phase(name,round===1?PHASE_BUDGETS.implementation:PHASE_BUDGETS.feedback,{...common,diagnosis,inspected_source:focused,feedback,round,instruction:'Implement your own repair from the supplied inspected source. Only navigation recognition may change. Available tools edit source or submit; no browsing or manual check. The controller tests automatically, and returns exact failures for a reserved feedback phase. Keep the declaration format intact.'});
    await snapshot();
    const validation=await verify(round);let independent={verdict:'NOT_RUN',reason:'Sealed checks or scope failed'};
    if(validation.status==='PASS')independent=await review(validation,round);
    const result={round,validation,review:independent};rounds.push(result);emit('round_finished',result);
    if(validation.status==='PASS'&&independent.verdict==='ACCEPT')return {status:'REPAIR_CANDIDATE',diagnosis,phases,rounds,calls};
    if(independent.verdict==='BLOCKED')return {status:'BLOCKED_REVIEW',diagnosis,phases,rounds,calls};
    feedback={validation,independent_review:independent,instruction:'Repair this concrete failure. Passing other tests does not override it. Your original diagnosis may need correction; do not assume it was true.'};
  }
  return {status:'NEEDS_REPAIR',diagnosis,phases,rounds,calls};
}
