import {timingSafeEqual} from 'node:crypto';
export function allowedWorker(value,secret) {
 if(!secret||typeof value!=='string')return false;
 const actual=Buffer.from(value),expected=Buffer.from('Bearer '+secret);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export const erasureReady=()=>process.env.CHJ_PRIVACY_ERASURE_READY==='1';
