import { timingSafeEqual } from 'node:crypto';
import { getAdminAuth } from './lib/firebaseAdmin.js';
import { privacyDb } from './lib/privacyStore.js';
import { runPrivacyJob,storageManifest } from './lib/privacyQueue.js';
export const config={maxDuration:120};
function allowed(value,expected){if(!expected||typeof value!=='string')return false;const a=Buffer.from(value),b=Buffer.from('Bearer '+expected);return a.length===b.length&&timingSafeEqual(a,b);}
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({code:'METHOD_NOT_ALLOWED'});
 if(!allowed(req.headers?.authorization,process.env.CRON_SECRET))return res.status(401).json({code:'WORKER_AUTH_REQUIRED'});
 try{return res.json(await runPrivacyJob({db:privacyDb(),identity:getAdminAuth(),manifest:storageManifest()}));}
 catch{return res.status(503).json({code:'PRIVACY_UNAVAILABLE'});}
}
