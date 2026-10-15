import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import {privacyAuth,ensureHealthPrivacy,blockHealth} from './privacy-client.js';
const originalFetch=globalThis.fetch.bind(globalThis);
let resolveAuth;const authenticated=new Promise(resolve=>resolveAuth=resolve);
onAuthStateChanged(privacyAuth,user=>resolveAuth(user));
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
 const privateApi=url.origin===location.origin&&url.pathname.startsWith('/api/')&&!['/api/privacy','/api/privacy-worker'].includes(url.pathname);
 if(!privateApi)return originalFetch(input,init);
 const user=privacyAuth.currentUser??await authenticated;
 const headers=new Headers(init.headers??(input instanceof Request?input.headers:undefined));
 if(user)headers.set('Authorization','Bearer '+await user.getIdToken());
 const response=await originalFetch(input,{...init,headers});
 if([401,403,503].includes(response.status)){
  const body=await response.clone().json().catch(()=>({}));
  if(['PRIVACY_REQUIRED','PRIVACY_NOT_READY','PRIVACY_UNAVAILABLE'].includes(body.code)){
   if(user)blockHealth(user.uid);
   document.documentElement.removeAttribute('data-chj-privacy-ready');
   location.replace('/soukromi');
  }
 }
 return response;
};
let sequence=0;
async function check(){
 const token=++sequence;
 const user=privacyAuth.currentUser;
 if(!await ensureHealthPrivacy(user))return;
 if(token===sequence)document.documentElement.setAttribute('data-chj-privacy-ready','true');
}
onAuthStateChanged(privacyAuth,()=>{document.documentElement.removeAttribute('data-chj-privacy-ready');check();});
addEventListener('pageshow',()=>{if(privacyAuth.currentUser)check();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&privacyAuth.currentUser)check();});
addEventListener('chj-privacy-blocked',()=>{document.documentElement.removeAttribute('data-chj-privacy-ready');location.replace('/soukromi');});
