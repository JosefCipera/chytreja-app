import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
export function safeFile(root,name,allowed){
  if(typeof name!=='string'||!allowed.includes(name))throw Error('File outside allowlist');
  const target=path.resolve(root,name);
  if(!target.startsWith(path.resolve(root)+path.sep)||fs.lstatSync(target).isSymbolicLink())throw Error('Unsafe path');
  return target;
}
export function replaceUnique(root,args,task,state){
  const file=safeFile(root,args.path,task.editable);
  if(state.edits>=task.limits.edits)throw Error('Edit budget exhausted');
  if(typeof args.old!=='string'||!args.old.length||args.old.length>6000||typeof args.new!=='string'||args.new.length>6000)throw Error('Invalid edit');
  const before=fs.readFileSync(file,'utf8');
  if(before.split(args.old).length!==2)throw Error('Old text must match exactly once');
  if(args.new===args.old)throw Error('Empty edit');
  fs.writeFileSync(file,before.replace(args.old,()=>args.new));state.edits++;
  return {status:'EDITED',sha256:sha(fs.readFileSync(file)),edits:state.edits};
}
export function inspectFile(root,args,task){
  const file=safeFile(root,args.path,task.readable);
  const lines=fs.readFileSync(file,'utf8').split('\n');
  if(typeof args.query==='string'&&args.query.length){
    if(args.query.length>200)throw Error('Query too long');
    return lines.flatMap((s,i)=>s.toLowerCase().includes(args.query.toLowerCase())?[`${i+1}: ${s}`]:[]).slice(0,24).join('\n').slice(0,18000);
  }
  const start=args.start??1,count=args.count??60;
  if(!Number.isInteger(start)||start<1||!Number.isInteger(count)||count<1||count>80)throw Error('Invalid line range');
  return lines.slice(start-1,start-1+count).map((s,i)=>`${start+i}: ${s}`).join('\n').slice(0,18000);
}
export function validateVerdict(input){
  if(!input||!['ACCEPT','RETURN','BLOCKED'].includes(input.verdict)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>2500)throw Error('Invalid independent review');
  return input;
}
