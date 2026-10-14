// Use the browser's real history so URL fragment, scroll and caller UI are retained.
// No account data, storage, API requests or arbitrary return-URL parameter.
(() => {
 const scrollKey='chjDocumentScroll';
 const rememberScroll=()=>{
  try{history.replaceState({...history.state,[scrollKey]:{x:scrollX,y:scrollY}},'');}
  catch{/* Navigation still works if history state is unavailable. */}
 };
 const restoreScroll=()=>{
  const position=history.state?.[scrollKey];
  if(!Number.isFinite(position?.x)||!Number.isFinite(position?.y))return;
  // Apply after the browser restores focus and its own saved scroll position.
  requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo(position.x,position.y)));
 };
 addEventListener('pagehide',rememberScroll);
 addEventListener('pageshow',restoreScroll);
 const back=document.querySelector('[data-document-back]');
 if(!back)return;
 let previous=null;
 try{
  const candidate=new URL(document.referrer);
  if(candidate.origin===location.origin&&candidate.href!==location.href)previous=candidate;
 }catch{/* A direct visit has no caller. */}
 if(!previous)return; // The ordinary homepage link is the safe direct-visit fallback.
 back.href=previous.href;
 back.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  if(history.length>1){history.back();return;}
  // Legal links in registration/contact open a separate tab. Closing that tab
  // returns to the caller without reloading it or losing a filled form.
  try{window.opener?.focus();}catch{/* noopener is supported. */}
  window.close();
  // Some browsers disallow closing a user-created tab; still provide a way out.
  setTimeout(()=>location.assign(previous.href),150);
 });
})();
