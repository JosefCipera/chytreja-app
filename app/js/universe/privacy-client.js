import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import {getAuth,signOut,EmailAuthProvider,reauthenticateWithCredential,reauthenticateWithPopup,GoogleAuthProvider} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
const privacyApp=getApps().length?getApp():initializeApp({
      apiKey:        "AIzaSyAKREZsoBZkA1xOQ5ff3XDmiJ88nwSjeOk",
      authDomain:    "chytre-ja-app.firebaseapp.com",
      projectId:     "chytre-ja-app",
      storageBucket: "chytre-ja-app.firebasestorage.app",
      messagingSenderId: '65882611642',
      appId:         "1:65882611642:web:53d82914aa07d6677d4783",
    });
window.chjFirebaseApp=privacyApp;
export const privacyAuth=getAuth(privacyApp);
export const receiptKey='chj_privacy_erasure_receipt';
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('chj-privacy'):null;
export function clearHealthLocal(uid) {
 if(!uid)return;
 for(const key of Object.keys(localStorage))if(key==='chj_session_v1:'+uid||key==='chj_last_response_v1:'+uid)localStorage.removeItem(key);
 sessionStorage.removeItem('chj_qbudget');
}
export function blockHealth(uid,broadcast=true) {
 clearHealthLocal(uid);
 window.dispatchEvent(new CustomEvent('chj-privacy-blocked',{detail:{uid}}));
 if(broadcast)channel?.postMessage({uid,event:'blocked'});
}
channel?.addEventListener('message',event=>{if(event.data?.event==='blocked'&&event.data.uid===privacyAuth.currentUser?.uid)blockHealth(event.data.uid,false);});
export async function privacyRequest(action,body={},user=privacyAuth.currentUser) {
 const receiptAction=['deletion-status','continue-delete'].includes(action);
 const headers={'Content-Type':'application/json'};
 if(!receiptAction){if(!user)throw Object.assign(Error('Přihlas se ke svému účtu.'),{code:'AUTH_REQUIRED'});headers.Authorization='Bearer '+await user.getIdToken();}
 const res=await fetch('/api/privacy',{method:action==='status'?'GET':'POST',headers,cache:'no-store',...(action==='status'?{}:{body:JSON.stringify({action,...body})})});
 const data=await res.json().catch(()=>({code:'PRIVACY_UNAVAILABLE'}));
 if(!res.ok)throw Object.assign(Error(data.error||'Požadavek se nepodařilo dokončit.'),{code:data.code});
 return data;
}
export function validHealth(state) {
 return state.ready===true&&state.status==='active'&&state.adult===true&&state.health_version===state.versions?.health&&state.terms_version===state.versions?.terms&&state.policy_version===state.versions?.policy;
}
export async function ensureHealthPrivacy(user=privacyAuth.currentUser) {
 if(!user){location.replace('/login');return false;}
 try{
  const state=await privacyRequest('status',{},user);
  if(validHealth(state))return true;
 }catch{/* No profile fetch or cached health view while status is unknown. */}
 blockHealth(user.uid);
 try{sessionStorage.setItem('chj_privacy_return:'+user.uid,location.pathname+location.search+location.hash);}catch{}
 location.replace('/soukromi');
 return false;
}
export async function freshIdentity(password='') {
 const user=privacyAuth.currentUser;if(!user)throw Object.assign(Error('Přihlas se znovu.'),{code:'AUTH_REQUIRED'});
 const result=await user.getIdTokenResult(true);
 const age=Date.now()/1000-Number(result.claims.auth_time);
 if(Number.isFinite(age)&&age>=0&&age<=300)return;
 if(user.providerData.some(p=>p.providerId==='google.com'))await reauthenticateWithPopup(user,new GoogleAuthProvider());
 else{
  if(!password)throw Object.assign(Error('Potvrď své heslo.'),{code:'PASSWORD_REQUIRED'});
  await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
 }
 await user.getIdToken(true);
}
export {signOut};
