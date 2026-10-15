import { privacyRpc } from './privacyStore.js';
// Stages are resumable. A failure never gets converted into "fully erased".
export async function eraseJob(job,{db,identity,storage,lease,advance,finishHealth}) {
 await privacyRpc('chj_privacy_purge_rows',{p_uid:job.uid,p_kind:job.kind},db);
 await storage.erase(job.uid,job.kind);
 if(job.kind==='health') {
  await finishHealth(job,lease);
  return {stage:'complete'};
 }
 await advance(job,lease,'identity');
 try{await identity.revokeRefreshTokens(job.uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
 try{await identity.deleteUser(job.uid);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
 // Provider history, backups, mailbox and prior logs must be reviewed separately.
 await advance(job,lease,'external_review');
 return {stage:'external_review',live_identity_deleted:true,all_copies_erased:false};
}
export function makeStorageAdapter({db,manifest}) {
 return {async erase(uid,kind='account') {
  if(!manifest||manifest.reviewed!==true||!Array.isArray(manifest.buckets)||manifest.firebase!=='not-used')throw Object.assign(Error('Storage not reviewed'),{code:'STORAGE_REVIEW_REQUIRED'});
  const {data:buckets,error}=await db.storage.listBuckets();if(error)throw Object.assign(Error('Storage inventory unavailable'),{code:'STORAGE_UNAVAILABLE'});
  const known=new Map(manifest.buckets.map(b=>[b.name,b]));
  for(const bucket of buckets??[]){
   const rule=known.get(bucket.name);if(!rule)throw Object.assign(Error('Unknown bucket'),{code:'STORAGE_REVIEW_REQUIRED'});
   if(rule.scope==='shared'||(kind==='health'&&rule.scope==='account'))continue;
   if(!['health','account'].includes(rule.scope)||rule.prefix!=='{uid}/')throw Object.assign(Error('Unknown ownership rule'),{code:'STORAGE_REVIEW_REQUIRED'});
   const root=encodeURIComponent(uid)+'/';let count=0;
   async function removeTree(prefix) {
    for(;;){
     const {data:rows,error:listing}=await db.storage.from(bucket.name).list(prefix,{limit:100,offset:0});
     if(listing)throw Object.assign(Error('Storage listing failed'),{code:'STORAGE_UNAVAILABLE'});
     if(!rows?.length)return;
     const files=[];
     for(const row of rows) {
      if(typeof row.name!=='string'||row.name.includes('/')||row.name==='.'||row.name==='..')throw Object.assign(Error('Invalid storage entry'),{code:'STORAGE_REVIEW_REQUIRED'});
      const name=prefix.replace(/\/$/,'')+'/'+row.name;
      if(!name.startsWith(root))throw Error('Invalid storage prefix');
      if(row.id)files.push(name);else await removeTree(name);
     }
     if(files.length){const {error:deleting}=await db.storage.from(bucket.name).remove(files);if(deleting)throw Object.assign(Error('Storage deletion failed'),{code:'STORAGE_UNAVAILABLE'});}
     count+=rows.length;if(count>100000)throw Object.assign(Error('Storage requires manual continuation'),{code:'STORAGE_REVIEW_REQUIRED'});
     // Some storage APIs return empty directory markers. Re-listing must progress.

    }
   }
   await removeTree(root);
  }
 }};
}
