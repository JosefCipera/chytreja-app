const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const svg=$('demo-map'),small=()=>matchMedia('(max-width:760px)').matches;
let payload,view,selected,center='dlouhovekost',trail=[],scene=[],links=[],box,positions=new Map();
const palette={C:'#7899ba',LC:'#91a5a3',RC:'#9c93b0',R:'#8fa3b9',L:'#849aaa'};
function element(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function camera(next){box=next;svg.setAttribute('viewBox',[box.x,box.y,box.w,box.h].join(' '));}
function fit(){const all=[...positions.values()];const margin=view==='crt'?115:62;const xs=all.map(p=>p.x),ys=all.map(p=>p.y);camera({x:Math.min(...xs)-margin,y:Math.min(...ys)-margin,w:Math.max(...xs)-Math.min(...xs)+2*margin,h:Math.max(...ys)-Math.min(...ys)+2*margin});}
function focusNode(){const p=positions.get(selected);if(!p)return;const w=view==='crt'?(small()?470:700):(small()?290:360),h=w*1.2;let x=p.x-w/2,y=p.y-h/2;if(view==='crt'){const all=[...positions.values()],left=Math.min(...all.map(n=>n.x))-115,right=Math.max(...all.map(n=>n.x))+115,top=Math.min(...all.map(n=>n.y))-65,bottom=Math.max(...all.map(n=>n.y))+65;x=w<right-left?Math.max(left,Math.min(x,right-w)):(left+right-w)/2;y=h<bottom-top?Math.max(top,Math.min(y,bottom-h)):(top+bottom-h)/2;}camera({x,y,w,h});}
function zoom(factor){const w=Math.max(140,Math.min(2200,box.w*factor)),h=box.h*w/box.w;camera({x:box.x+(box.w-w)/2,y:box.y+(box.h-h)/2,w,h});}
function wrap(text,max){const lines=[];let line='';for(const word of text.split(/\s+/)){if(line&&line.length+word.length+1>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
function getChildren(id){const ids=new Set(payload.universe.filter(n=>n.parent===id).map(n=>n.id));for(const key of payload.universe.find(n=>n.id===id)?.related??[])if(payload.universe.some(n=>n.id===key))ids.add(key);ids.delete(id);return [...ids].map(key=>payload.universe.find(n=>n.id===key));}
function button(node,fn){const b=document.createElement('button');b.type='button';b.textContent=node.label;b.addEventListener('click',fn);return b;}
function relationGroup(title,nodes){const host=$('demo-relations');if(!nodes.length)return;const h=document.createElement('h3');h.textContent=title;host.append(h);for(const n of nodes)host.append(button(n,()=>{select(n.id);focusNode();}));}
function select(id){selected=id;const all=view==='crt'?payload.crt.nodes:payload.universe,node=all.find(n=>n.id===id);if(!node)return;
 svg.querySelectorAll('[data-node]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.node===id)));
 svg.querySelectorAll('[data-from]').forEach(e=>e.classList.toggle('active',e.dataset.from===id||e.dataset.to===id));
 $('demo-node-title').textContent=node.label;$('demo-selection').textContent='Vybráno: '+node.label;$('demo-relations').replaceChildren();
 if(view==='crt'){
  $('demo-node-copy').textContent='Vybraný uzel v modelovém stromu Kovářové. Procházej návaznosti mezi příčinami a důsledky.';
  relationGroup('Ve stromu předchází',payload.crt.edges.filter(e=>e.to===id).map(e=>all.find(n=>n.id===e.from)));
  relationGroup('Ve stromu navazuje',payload.crt.edges.filter(e=>e.from===id).map(e=>all.find(n=>n.id===e.to)));
 }else{
  $('demo-node-copy').textContent=node.definition;
  relationGroup('Souvislosti v této mapě',scene.filter(n=>n.id!==id&&(n.id===center||id===center)));
 }
 const expandable=view==='vesmir'&&getChildren(id).length>0&&id!==center;
 $('demo-open').hidden=!expandable;$('demo-open').textContent='Otevřít oblast '+node.label;
 $('demo-up').hidden=view!=='vesmir'||trail.length===0;
}
function render(){
 svg.replaceChildren();positions=new Map();
 if(view==='crt'){scene=payload.crt.nodes;links=payload.crt.edges;const columns={L:0,LC:1,C:2,RC:3,R:4};for(const n of scene)positions.set(n.id,{x:130+(columns[n.branch]??2)*235,y:70+n.level*100});}
 else{const root=payload.universe.find(n=>n.id===center),children=getChildren(center);scene=[root,...children];links=children.map(n=>({from:center,to:n.id}));positions.set(center,{x:235,y:235});children.forEach((n,i)=>{const angle=-Math.PI*.75+i*Math.PI*2/children.length;positions.set(n.id,{x:235+170*Math.cos(angle),y:235+170*Math.sin(angle)});});}
 const defs=element('defs'),marker=element('marker',{id:'demo-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(element('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:'#8caac3'}));defs.append(marker);svg.append(defs);
 for(const edge of links){const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;let d;if(view==='crt'){if(b.y===a.y){const sign=Math.sign(b.x-a.x);d='M'+(a.x+sign*101)+' '+a.y+' L'+(b.x-sign*106)+' '+b.y;}else{const y1=a.y+42,y2=b.y-49;d='M'+a.x+' '+y1+' C'+a.x+' '+(y1+y2)/2+' '+b.x+' '+(y1+y2)/2+' '+b.x+' '+y2;}}else d='M'+a.x+' '+a.y+' L'+b.x+' '+b.y;const path=element('path',{d,class:'demo-edge','data-from':edge.from,'data-to':edge.to});if(view==='crt')path.setAttribute('marker-end','url(#demo-arrow)');svg.append(path);}
 for(const n of scene){const p=positions.get(n.id),g=element('g',{class:'demo-node',transform:'translate('+p.x+' '+p.y+')','data-node':n.id,role:'button',tabindex:0,'aria-label':n.label,'aria-pressed':'false'});
  if(view==='crt')g.append(element('rect',{x:-101,y:-42,width:202,height:84,rx:13,style:'stroke:'+(palette[n.branch]??'#7899ba')}));
  else g.append(element('circle',{r:n.id===center?59:46,style:'stroke:'+(n.color??'#7899ba')}));
  const lines=wrap(n.label,view==='crt'?23:13),text=element('text',{'text-anchor':'middle'});lines.forEach((line,i)=>text.append(element('tspan',{x:0,y:(i-(lines.length-1)/2)*19+5},line)));g.append(text);
  g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.id);}});svg.append(g);
 }
 $('demo-list').replaceChildren(...scene.map(n=>button(n,()=>{select(n.id);focusNode();})));
 fit();select(selected&&scene.some(n=>n.id===selected)?selected:scene[0].id);
}
function switchView(next,replace=true){view=next==='vesmir'?'vesmir':'crt';center='dlouhovekost';trail=[];selected=view==='crt'?'FALL_RISK':center;
 $('demo-title').textContent=view==='crt'?payload.crt.title:'Vesmír Dlouhověkosti';
 $('demo-intro').textContent=view==='crt'?'Začni u rizika pádu a sleduj souvislosti zpět k příčinám.':'Otevři jednotlivé oblasti a prozkoumej, jak do sebe zapadají.';
 $('demo-detail-kind').textContent=view==='crt'?'VYBRANÝ UZEL':'VYBRANÁ OBLAST';document.title=$('demo-title').textContent+' | Chytré já';
 document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(replace)history.replaceState(history.state,'','/ukazka/'+view);
 render();if(small()&&view==='crt')focusNode();
}
$('demo-fit').addEventListener('click',fit);$('demo-focus').addEventListener('click',focusNode);$('demo-zoom-in').addEventListener('click',()=>zoom(.8));$('demo-zoom-out').addEventListener('click',()=>zoom(1.25));
$('demo-open').addEventListener('click',()=>{trail.push(center);center=selected;render();$('demo-node-title').focus();});
$('demo-up').addEventListener('click',()=>{center=trail.pop()??'dlouhovekost';selected=center;render();});
let drag=null;
svg.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,box:{...box},node:e.target.closest('[data-node]')?.dataset.node,moved:false};svg.setPointerCapture(e.pointerId);});
svg.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){const rect=svg.getBoundingClientRect(),scale=Math.max(drag.box.w/rect.width,drag.box.h/rect.height);camera({...drag.box,x:drag.box.x-dx*scale,y:drag.box.y-dy*scale});}});
svg.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const done=drag;drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(!done.moved&&done.node)select(done.node);});
svg.addEventListener('pointercancel',()=>drag=null);
svg.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15);},{passive:false});
const back=$('demo-return');
try{const ref=new URL(document.referrer);if(ref.origin===location.origin&&['/','/home-v2','/zakladatele','/zakladatele/'].includes(ref.pathname)){$('demo-return').href=ref.pathname+(ref.pathname.includes('zakladatele')?'#pod-povrch':'#ukazky');back.addEventListener('click',e=>{if(history.length>1){e.preventDefault();history.back();}});}}catch{}
try{
 const response=await fetch('/app/assets/landing/model-demo-data.json');if(!response.ok)throw Error();
 payload=await response.json();if(!payload.crt?.nodes?.length||!payload.universe?.length)throw Error();
 $('demo-content').hidden=false;$('demo-loading').hidden=true;
 document.querySelectorAll('[data-view]').forEach(a=>a.addEventListener('click',e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&e.button===0){e.preventDefault();switchView(a.dataset.view);}}));
 switchView(location.pathname.replace(/\/+$/,'').endsWith('/vesmir')||new URLSearchParams(location.search).get('view')==='vesmir'?'vesmir':'crt',false);
}catch{$('demo-loading').textContent='Ukázku se nepodařilo načíst. Zkus obnovit stránku.';}
