import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import {privacyAuth,privacyRequest,validHealth,clearHealthLocal,blockHealth,freshIdentity,signOut,receiptKey} from './privacy-client.js';
const $=id=>document.getElementById(id);
let state=null,busy=false;
function message(text,error=false){$('privacy-status').textContent=text;$('privacy-status').classList.toggle('error',error);}
function loading(on){busy=on;for(const b of document.querySelectorAll('button'))b.disabled=on;if(!on&&state)$('grant-consent').disabled=!state.ready||state.cleanup_pending;}
function returnUrl(){
 let raw;try{raw=sessionStorage.getItem('chj_privacy_return:'+privacyAuth.currentUser?.uid);}catch{}
 try{const u=new URL(raw||'/launcher',location.origin);if(u.origin===location.origin&&!/^\/(api|login|soukromi)(\/|$)/.test(u.pathname))return u.pathname+u.search+u.hash;}catch{}
 return '/launcher';
}
function show(current){
 if(!state||state.epoch!==current.epoch||state.status!==current.status)for(const id of ['adult-check','terms-check','health-check'])$(id).checked=false;
 state=current;$('privacy-login').hidden=true;$('privacy-controls').hidden=false;
 $('privacy-summary').textContent=validHealth(current)?'Zdravotní personalizace je zapnutá.':current.status==='deleting'?'Účet čeká na výmaz. Přístup k osobním datům je zablokovaný.':'Zdravotní personalizace je vypnutá.';
 $('consent-panel').hidden=validHealth(current)||current.status==='deleting';
 $('withdraw-consent').hidden=!validHealth(current);
 $('continue-app').hidden=!validHealth(current);$('continue-app').href=returnUrl();
 $('grant-consent').disabled=!current.ready||current.cleanup_pending;
 $('setup-notice').hidden=current.ready===true;
 $('cleanup-notice').hidden=!current.cleanup_pending;
}
async function refresh(){
 const uid=privacyAuth.currentUser?.uid;
 if(!uid||sessionStorage.getItem(receiptKey))return;
 try{
  const current=await privacyRequest('status');
  if(privacyAuth.currentUser?.uid!==uid||sessionStorage.getItem(receiptKey))return;
  show(current);
 }catch(error){message('Nastavení soukromí teď nelze načíst. Zkus to znovu.',true);}
}
async function deletionStatus(run=false){
 const receipt=sessionStorage.getItem(receiptKey);if(!receipt)return false;
 $('privacy-controls').hidden=true;$('privacy-login').hidden=true;$('deletion-panel').hidden=false;
 try{
  const data=await privacyRequest(run?'continue-delete':'deletion-status',{receipt});
  const text=data.stage==='complete'?'Výmaz byl dokončen včetně ověření navázaných kopií.':data.stage==='external_review'?'Účet a jeho provozní data byly odstraněny. Ještě ověřujeme zálohy a kopie u poskytovatelů; úplný výmaz zatím nepotvrzujeme.':'Žádost o výmaz je uložená a přístup k datům je zablokovaný. Dokončení ještě probíhá.';
  $('deletion-status').textContent=text;
  if(data.error_code)$('deletion-status').textContent+=' Dokončení vyžaduje kontrolu provozovatele.';
 }catch{$('deletion-status').textContent='Stav žádosti teď nelze ověřit. Žádost tím není zrušená. Zkus kontrolu znovu nebo napiš na info@iting.cz.';}
 return true;
}
$('grant-consent').addEventListener('click',async()=>{
 if(busy||!state?.ready)return;
 if(!['adult-check','terms-check','health-check'].every(id=>$(id).checked)){message('Potvrď jednotlivé volby. Zdravotní souhlas není součástí obchodních podmínek.',true);return;}
 loading(true);
 try{
  await privacyRequest('grant',{adult:true,terms:true,health:true,health_version:state.versions.health,terms_version:state.versions.terms,policy_version:state.versions.policy});
  location.replace(returnUrl());
 }catch{message('Souhlas se nepodařilo uložit. Zdravotní personalizace se tím nezapnula.',true);}
 finally{loading(false);}
});
$('withdraw-consent').addEventListener('click',async()=>{
 if(busy)return;loading(true);
 try{
  await privacyRequest('withdraw');blockHealth(privacyAuth.currentUser.uid);
  message('Souhlas je odvolaný. Zdravotní personalizace je vypnutá; odstraňujeme její uložená data.');
  await privacyRequest('continue-health').catch(()=>{});await refresh();
 }catch{message('Odvolání se nepodařilo potvrdit. Zkus to znovu.',true);}
 finally{loading(false);if(state)show(state);}
});
$('retry-health').addEventListener('click',async()=>{if(busy)return;loading(true);try{await privacyRequest('continue-health');await refresh();}catch{message('Výmaz zdravotních dat zatím čeká na dokončení.',true);}finally{loading(false);if(state)show(state);}});
$('show-delete').addEventListener('click',()=>{$('delete-confirmation').hidden=false;$('delete-word').focus();});
$('cancel-delete').addEventListener('click',()=>{$('delete-confirmation').hidden=true;$('delete-word').value='';$('delete-password').value='';});
$('delete-account').addEventListener('click',async()=>{
 if(busy)return;if($('delete-word').value!=='SMAZAT'){message('Pro výmaz účtu napiš SMAZAT.',true);return;}
 loading(true);
 try{
  await freshIdentity($('delete-password').value);$('delete-password').value='';
  const result=await privacyRequest('delete',{confirmation:'SMAZAT'});
  sessionStorage.setItem(receiptKey,result.receipt);
  const uid=privacyAuth.currentUser.uid;clearHealthLocal(uid);blockHealth(uid);
  await signOut(privacyAuth).catch(()=>{});
  await deletionStatus(true);
 }catch(error){message(error.code==='PASSWORD_REQUIRED'?'Potvrď své heslo; heslo se neposílá do CHJ.':'Výmaz se nepodařilo potvrdit. Účet nepovažuj za smazaný.',true);}
 finally{loading(false);$('delete-password').value='';}
});
$('retry-deletion').addEventListener('click',()=>deletionStatus(true));
$('privacy-reload').addEventListener('click',refresh);
onAuthStateChanged(privacyAuth,async user=>{
 if(await deletionStatus())return;
 if(!user){$('privacy-controls').hidden=true;$('privacy-login').hidden=false;return;}
 await refresh();
});

window.addEventListener('chj-privacy-blocked',()=>refresh());
