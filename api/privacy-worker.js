import {getAdminAuth} from './lib/firebaseAdmin.js';
import {privacyDb} from './lib/privacyStore.js';
import {allowedWorker,erasureReady} from './lib/privacyWorkerAuth.js';
import {runPrivacyJob,storageManifest} from './lib/privacyQueue.js';
export const config={maxDuration:120};
export function makePrivacyWorker({db=privacyDb,identity=getAdminAuth,run=runPrivacyJob,manifest=storageManifest,ready=erasureReady,secret=()=>process.env.CRON_SECRET}={}) {
 return async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
  if(!allowedWorker(req.headers?.authorization,secret()))return res.status(401).json({code:'WORKER_AUTH_REQUIRED'});
  // Separately gated from collection: withdrawing/queueing requests remains possible.
  if(!ready())return res.status(503).json({code:'ERASURE_NOT_READY'});
  try{return res.json(await run({db:db(),identity:identity(),manifest:manifest()}));}
  catch{return res.status(503).json({code:'PRIVACY_UNAVAILABLE'});}
 };
}
export default makePrivacyWorker();
