(() => {
 const header=document.querySelector('.home-header');
 if(!header)return;
 const button=header.querySelector('.home-menu-toggle'),nav=header.querySelector('.home-nav');
 const close=()=>{button.setAttribute('aria-expanded','false');nav.classList.remove('is-open');button.setAttribute('aria-label','Otevřít menu');};
 button.addEventListener('click',()=>{
  const open=button.getAttribute('aria-expanded')!=='true';
  button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Zavřít menu':'Otevřít menu');nav.classList.toggle('is-open',open);
 });
 nav.addEventListener('click',event=>{if(event.target.closest('a'))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){close();button.focus();}});
 document.addEventListener('click',event=>{if(!header.contains(event.target))close();});
 header.addEventListener('focusout',event=>{if(!header.contains(event.relatedTarget))close();});
 matchMedia('(max-width:1050px)').addEventListener('change',close);
})();
