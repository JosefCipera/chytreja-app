import {privacyDb,privacyRpc} from './lib/privacyStore.js';
import {allowedWorker} from './lib/privacyWorkerAuth.js';
const countFields=['pending','runnable','leased','expired_leases','retrying','repeated_failures','external_review','overdue_accounts'];
const hourFields=['oldest_pending_hours','oldest_external_review_hours'];
export function sanitizeQueueSummary(raw,{reviewHours=24}={}) {
 if(!Number.isSafeInteger(reviewHours)||reviewHours<1||reviewHours>720)throw Error('Invalid review interval');
 if(!raw||raw.schema_version!=='privacy-queue-v1')throw Error('Invalid queue summary');
 const safe={schema_version:'privacy-queue-v1'};
 for(const key of [...countFields,...hourFields]){
  if(typeof raw[key]!=='number'||!Number.isFinite(raw[key])||raw[key]<0||!Number.isSafeInteger(raw[key]))throw Error('Invalid queue metric');
  safe[key]=raw[key];
 }
 safe.review_alert_hours=reviewHours;
 safe.attention=safe.repeated_failures>0||safe.overdue_accounts>0||safe.oldest_pending_hours>=reviewHours;
 safe.warnings=[];
 if(safe.external_review>0)safe.warnings.push('EXTERNAL_REVIEW_PENDING');
 if(safe.retrying>0)safe.warnings.push('RETRY_PENDING');
 if(safe.expired_leases>0)safe.warnings.push('EXPIRED_LEASES');
 return safe;
}
export function makePrivacyMonitor({db=privacyDb,secret=()=>process.env.PRIVACY_MONITOR_SECRET,rpc=privacyRpc,reviewHours=()=>Number(process.env.PRIVACY_REVIEW_ALERT_HOURS||24)}={}) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  if(!allowedWorker(req.headers?.authorization,secret()))return res.status(401).json({code:'MONITOR_AUTH_REQUIRED'});
  try{
   const safe=sanitizeQueueSummary(await rpc('chj_privacy_monitor',{},db()),{reviewHours:reviewHours()});
   return res.status(safe.attention?503:200).json({...safe,code:safe.attention?'PRIVACY_QUEUE_ATTENTION':'PRIVACY_QUEUE_SUMMARY'});
  }catch{return res.status(503).json({code:'PRIVACY_UNAVAILABLE'});}
 };
}
export default makePrivacyMonitor();
