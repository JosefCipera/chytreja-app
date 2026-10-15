import { createClient } from '@supabase/supabase-js';
let client;
export const HEALTH_VERSION = 'health-2026-10-15-v1';
export const TERMS_VERSION = 'terms-2026-10-15-v1';
export const POLICY_VERSION = 'privacy-2026-10-15-v1';
export function privacyDb() {
 if(!client)client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 return client;
}
export async function privacyRpc(name, args, db = privacyDb()) {
 const {data,error}=await db.rpc(name,args);
 if(error)throw Object.assign(new Error('Privacy service unavailable'),{code:'PRIVACY_UNAVAILABLE'});
 return data;
}
export function configured() {
 return process.env.CHJ_PRIVACY_READY==='1';
}
export async function privacyStatus(uid, db) {
 return privacyRpc('chj_privacy_status',{p_uid:uid},db);
}
export function permitted(state, scope='health') {
 if(!state || ['deleting','deleted'].includes(state.status))return false;
 if(scope==='account')return true;
 return state.status==='active'&&state.health_version===HEALTH_VERSION&&state.terms_version===TERMS_VERSION&&state.policy_version===POLICY_VERSION&&state.adult===true;
}
export function publicStatus(state) {
 return {status:state.status,epoch:state.epoch,health_version:state.health_version,terms_version:state.terms_version,
 policy_version:state.policy_version,adult:state.adult,cleanup_pending:state.cleanup_pending===true};
}
