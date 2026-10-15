import { requireAuth } from './requireAuth.js';
import { privacyContext } from './privacyContext.js';
import { configured, permitted, privacyStatus } from './privacyStore.js';
const safeError={error:'Nejdřív nastav soukromí svého účtu.',code:'PRIVACY_REQUIRED'};
export function withPrivacy(handler,{scope='health',identify=requireAuth,status=privacyStatus,ready=configured}={}) {
 return async function privacyProtected(req,res) {
  res.setHeader?.('Cache-Control','no-store');
  if(!ready())return res.status(503).json({error:'Nastavení soukromí se připravuje.',code:'PRIVACY_NOT_READY'});
  const identity=await identify(req,res);
  if(!identity)return;
  // The historical public demo cannot stand in for real consent or a real identity.
  if(identity.demo)return res.status(401).json({error:'Přihlas se ke svému účtu.',code:'AUTH_REQUIRED'});
  for(const claimed of [req.body?.userId,req.body?.user_id,req.query?.userId,req.query?.user_id])if(claimed!=null&&claimed!==identity.uid)return res.status(403).json({error:'UID mismatch',code:'UID_MISMATCH'});
  let state;
  try{state=await status(identity.uid);}catch{return res.status(503).json({error:'Soukromí teď nelze ověřit.',code:'PRIVACY_UNAVAILABLE'});}
  if(!permitted(state,scope))return res.status(403).json(safeError);
  const actor={uid:identity.uid,epoch:Number(state.epoch),scope};
  let sending=false,pending;
  const originals=Object.fromEntries(['json','send','end'].filter(k=>typeof res[k]==='function').map(k=>[k,res[k].bind(res)]));
  for(const [method,original] of Object.entries(originals))res[method]=(...args)=>{
   if(sending)return original(...args);
   pending=(async()=>{
    let current;
    try{current=await status(actor.uid);}catch{
     sending=true;try{res.status(503);return originals.json?originals.json({error:'Soukromí teď nelze ověřit.',code:'PRIVACY_UNAVAILABLE'}):originals.end();}finally{sending=false;}
    }
    sending=true;
    try{
     if(!permitted(current,scope)||Number(current.epoch)!==actor.epoch){
      res.status(403);return originals.json?originals.json(safeError):originals.end();
     }
     return original(...args);
    }finally{sending=false;}
   })();
   return pending;
  };
  try{
   await privacyContext.run(actor,()=>handler(req,res));
   if(pending)await pending;
  }finally{for(const [method,original] of Object.entries(originals))res[method]=original;}
 };
}
