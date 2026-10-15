import { randomUUID } from 'node:crypto';
import { privacyRpc } from './privacyStore.js';
import { eraseJob,makeStorageAdapter } from './privacyErasure.js';
export async function runPrivacyJob({db,identity,jobId=null,manifest=null}) {
 const lease=randomUUID(),job=await privacyRpc('chj_privacy_claim_job',{p_lease:lease,p_job:jobId},db);
 if(!job)return {stage:'busy'};
 const advance=async(j,l,stage)=>privacyRpc('chj_privacy_job_step',{p_job:j.id,p_lease:l,p_stage:stage},db);
 try{
  return await eraseJob(job,{db,lease,identity,storage:makeStorageAdapter({db,manifest}),advance});
 }catch(error){
  const code=['STORAGE_REVIEW_REQUIRED','STORAGE_UNAVAILABLE'].includes(error.code)?error.code:'ERASURE_RETRY_REQUIRED';
  await privacyRpc('chj_privacy_job_error',{p_job:job.id,p_lease:lease,p_code:code},db).catch(()=>{});
  return {stage:'pending',error_code:code};
 }
}
export function storageManifest() {
 try{return JSON.parse(process.env.CHJ_PRIVACY_STORAGE_MANIFEST??'null');}catch{return null;}
}
