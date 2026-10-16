/* Public examples only: no account data or storage. */
(() => {
 const origin=location.origin;
 const allowed=new Set(['/','/home-v2','/home-v2.html','/home-intro-preview.html','/app/home-v2.html','/app/home-intro-preview.html','/zakladatele','/zakladatele/','/zakladatele.html','/app/zakladatele.html']);
 function safeReturn(value){
  if(!value)return null;
  try{const url=new URL(value,origin);return url.origin===origin&&allowed.has(url.pathname)?url.pathname+url.search+url.hash:null;}catch{return null;}
 }
 const inExample=/^\/(?:app\/)?ukazka(?:\/|$)/.test(location.pathname);
 if(!inExample){
  const anchor=location.pathname.includes('zakladatele')?'pod-povrch':'ukazky';
  const from=location.pathname+location.search+'#'+anchor;
  document.querySelectorAll('a[href]').forEach(link=>{
   const url=new URL(link.href,location.href);
   if(url.origin===origin&&/^\/ukazka\/?$/.test(url.pathname)){
    url.searchParams.set('returnTo',from);link.href=url.href;
   }
  });
  return;
 }
 const returnTo=safeReturn(new URLSearchParams(location.search).get('returnTo'))||safeReturn(document.referrer)||'/';
 const back=()=>{location.assign(returnTo);};
 window.goBack=()=>{
  if(window.parent!==window)parent.postMessage({archiveReturn:true},origin);
  else back();
 };
 const frame=document.querySelector('iframe[title="Historická aplikace"]');
 if(frame){
  const header=document.querySelector('header');
  const link=document.createElement('a');link.href=returnTo;link.textContent='← Zpět';link.setAttribute('aria-label','Zpět na stránku, odkud byla ukázka otevřena');
  link.style.cssText='color:#c8e4fa;text-decoration:none;border:1px solid #405875;border-radius:7px;padding:8px 12px;white-space:nowrap;';
  header.insertBefore(link,header.firstChild);
  const footer=document.querySelector('footer a');if(footer){footer.href=returnTo;footer.textContent='← Zpět';}
  window.addEventListener('message',event=>{if(event.origin===origin&&event.source===frame.contentWindow&&event.data?.archiveReturn===true)back();});
 }else if(window.parent===window){
  const link=document.createElement('a');link.href=returnTo;link.textContent='← Zpět';link.style.cssText='position:fixed;top:10px;left:10px;z-index:100000;color:#c8e4fa;background:#101e30;border:1px solid #405875;border-radius:7px;padding:10px 14px;text-decoration:none;font:14px system-ui;';document.body.appendChild(link);
 }
})();
