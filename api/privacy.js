import { randomBytes,createHash } from 'node:crypto';
import { getAdminAuth } from './lib/firebaseAdmin.js';
import { configured,privacyDb,privacyRpc,privacyStatus,publicStatus,HEALTH_VERSION,TERMS_VERSION,POLICY_VERSION } from './lib/privacyStore.js';
import { runPrivacyJob,storageManifest } from './lib/privacyQueue.js';
export const config={maxDuration:120};
const digest=value=>createHash('sha256').update(value).digest('hex');
export function makePrivacyHandler({auth=getAdminAuth,db=privacyDb,ready=configured,now=()=>Date.now(),runJob=runPrivacyJob,manifest=storageManifest}={}) {
 return async function handler(req,res) {
  res.setHeader?.('Cache-Control','no-store');
  const action=req.method==='GET'?'status':req.body?.action;
  if(!['GET','POST'].includes(req.method))return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  const store=db();
  // Receipt grants status-only access, never data access, even after identity deletion.
  if(action==='deletion-status'||action==='continue-delete') {
   const receipt=req.body?.receipt;
   if(typeof receipt!=='string'||!/^[a-f0-9]{64}$/.test(receipt))return res.status(400).json({code:'INVALID_RECEIPT'});
   const {data,error}=await store.from('chj_privacy_jobs').select('id,uid,stage,kind,requested_at,last_error_code').eq('receipt_hash',digest(receipt)).eq('kind','account').maybeSingle();
   if(error)return res.status(503).json({code:'PRIVACY_UNAVAILABLE'});
   if(!data)return res.status(404).json({code:'RECEIPT_NOT_FOUND'});
   if(action==='continue-delete'&&!['external_review','complete'].includes(data.stage)) {
    const result=await runJob({db:store,identity:auth(),jobId:data.id,manifest:manifest()});
    return res.json(result);
   }
   return res.json({stage:data.stage,requested_at:data.requested_at,needs_review:data.stage==='external_review',error_code:data.last_error_code??null});
  }
  const bearer=req.headers?.authorization;
  if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))return res.status(401).json({code:'AUTH_REQUIRED'});
  let actor;
  try{actor=await auth().verifyIdToken(bearer.slice(7),true);if(!actor.uid)throw Error();}catch{return res.status(401).json({code:'AUTH_REQUIRED'});}
  const uid=actor.uid;
  // Reject impersonation, including legacy spellings. UID is never taken from input.
  for(const claimed of [req.body?.userId,req.body?.user_id,req.query?.userId,req.query?.user_id])if(claimed!=null&&claimed!==uid)return res.status(403).json({code:'UID_MISMATCH'});
  try{
   const state=await privacyStatus(uid,store);
   if(action==='status')return res.json({...publicStatus(state),ready:ready(),versions:{health:HEALTH_VERSION,terms:TERMS_VERSION,policy:POLICY_VERSION}});
   if(action==='continue-health') {
    const {data,error}=await store.from('chj_privacy_jobs').select('id').eq('uid',uid).eq('kind','health').neq('stage','complete').maybeSingle();
    if(error)return res.status(503).json({code:'PRIVACY_UNAVAILABLE'});
    if(!data)return res.json({stage:'complete'});
    return res.json(await runJob({db:store,identity:auth(),jobId:data.id,manifest:manifest()}));
   }
   if(action==='grant') {
    if(!ready())return res.status(503).json({code:'PRIVACY_NOT_READY'});
    const b=req.body??{};
    if(b.health!==true||b.terms!==true||b.adult!==true||b.health_version!==HEALTH_VERSION||b.terms_version!==TERMS_VERSION||b.policy_version!==POLICY_VERSION)return res.status(400).json({code:'EXPLICIT_CONSENT_REQUIRED'});
    const changed=await privacyRpc('chj_privacy_change',{p_uid:uid,p_action:'grant',p_health:HEALTH_VERSION,p_terms:TERMS_VERSION,p_policy:POLICY_VERSION,p_adult:true},store);
    return res.json(publicStatus(changed));
   }
   if(action==='withdraw') {
    const changed=await privacyRpc('chj_privacy_change',{p_uid:uid,p_action:'withdraw'},store);
    return res.status(202).json({...publicStatus(changed),cleanup_requested:true});
   }
   if(action==='delete') {
    if(req.body?.confirmation!=='SMAZAT')return res.status(400).json({code:'CONFIRM_DELETE_REQUIRED'});
    const age=Math.floor(now()/1000)-Number(actor.auth_time);
    if(!Number.isFinite(age)||age<0||age>300)return res.status(401).json({code:'RECENT_LOGIN_REQUIRED'});
    const receipt=randomBytes(32).toString('hex');
    const changed=await privacyRpc('chj_privacy_change',{p_uid:uid,p_action:'delete',p_receipt_hash:digest(receipt)},store);
    return res.status(202).json({status:'deleting',receipt,job_id:changed.job_id});
   }
   return res.status(400).json({code:'INVALID_ACTION'});
  }catch{return res.status(503).json({code:'PRIVACY_UNAVAILABLE',error:'Požadavek teď nelze dokončit. Zkus to znovu.'});}
 };
}
export default makePrivacyHandler();
