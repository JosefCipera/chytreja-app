import {pathToFileURL} from 'node:url';
const ORIGIN='https://dev.iting.cz';
const counts=['pending','runnable','leased','expired_leases','retrying','repeated_failures','external_review','overdue_accounts','oldest_pending_hours','oldest_external_review_hours','review_alert_hours'];
const fail=code=>Object.assign(new Error(code),{code});
export async function runRecovery({enabled=process.env.CHJ_PRIVACY_RECOVERY_ENABLED,workerToken=process.env.PRIVACY_DEV_WORKER_TOKEN,monitorToken=process.env.PRIVACY_DEV_MONITOR_TOKEN,origin=ORIGIN,fetchImpl=globalThis.fetch,maxJobs=4}={}) {
 if(enabled!=='1')return {skipped:true,reason:'RECOVERY_DISABLED'};
 if(origin!==ORIGIN||!workerToken||!monitorToken||!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>4)throw fail('RECOVERY_CONFIGURATION_REQUIRED');
 let processed=0,workerError=null;
 for(let i=0;i<maxJobs;i++){
  try{
   const response=await fetchImpl(ORIGIN+'/api/privacy-worker',{method:'POST',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+workerToken},signal:AbortSignal.timeout(125000)});
   if(!response.ok)throw fail('WORKER_UNAVAILABLE');
   const data=await response.json();
   if(data.stage==='busy')break;
   if(data.stage!=='external_review')throw fail('ERASURE_PENDING');
   processed++;
  }catch(error){workerError=['ERASURE_PENDING','WORKER_UNAVAILABLE'].includes(error.code)?error.code:'WORKER_UNAVAILABLE';break;}
 }
 let report;
 try{
  const response=await fetchImpl(ORIGIN+'/api/privacy-monitor',{method:'GET',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+monitorToken},signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(data.schema_version!=='privacy-queue-v1')throw Error();
  const summary={};
  for(const key of counts){if(!Number.isSafeInteger(data[key])||data[key]<0)throw Error();summary[key]=data[key];}
  if(summary.review_alert_hours<1||summary.review_alert_hours>720)throw Error();
  if(![200,503].includes(response.status)||![ 'PRIVACY_QUEUE_SUMMARY','PRIVACY_QUEUE_ATTENTION'].includes(data.code))throw Error();
  report={processed,counts:summary};
  if(summary.repeated_failures>0||summary.overdue_accounts>0||summary.oldest_pending_hours>=summary.review_alert_hours||response.status===503)throw fail('PRIVACY_QUEUE_ATTENTION');
 }catch(error){
  if(error.code==='PRIVACY_QUEUE_ATTENTION')throw Object.assign(fail(error.code),{summary:report});
  throw fail('MONITOR_UNAVAILABLE');
 }
 if(workerError)throw Object.assign(fail(workerError),{summary:report});
 return report;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 try{console.log(JSON.stringify(await runRecovery()));}
 catch(error){if(error.summary)console.log(JSON.stringify(error.summary));console.error(['RECOVERY_CONFIGURATION_REQUIRED','WORKER_UNAVAILABLE','ERASURE_PENDING','MONITOR_UNAVAILABLE','PRIVACY_QUEUE_ATTENTION'].includes(error.code)?error.code:'RECOVERY_FAILED');process.exitCode=1;}
}
