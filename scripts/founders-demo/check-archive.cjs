const path=require('node:path');process.chdir(__dirname);
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class DataSet {
 constructor(items=[]){this.items=items.map(x=>({...x}));}
 get(id){return id==null?this.items:Array.isArray(id)?this.items.filter(x=>id.includes(x.id)):this.items.find(x=>x.id===id);}
 getIds(){return this.items.map(x=>x.id);}
 add(items){this.items.push(...(Array.isArray(items)?items:[items]));}
 update(items){for(const x of Array.isArray(items)?items:[items]){const n=this.get(x.id);n?Object.assign(n,x):this.add(x);}}
 remove(ids){this.items=this.items.filter(x=>!(Array.isArray(ids)?ids:[ids]).includes(x.id));}
 forEach(fn){this.items.forEach(fn);}
}
const noop=()=>{};
async function check(file,width){
 const errors=[],networks=[],elements=new Map(),drawnTexts=[],stops=[],timers=new Map(),windowEvents={},orientationEvents={};let timerId=0;
 const flush=()=>{for(let i=0;timers.size&&i<20;i++){const batch=[...timers.values()];timers.clear();batch.forEach(fn=>fn());}};
 const gradient={addColorStop:(at,color)=>stops.push(color)};
 const ctx=new Proxy({canvas:{width:1280,height:800},createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,measureText:s=>({width:s.length*8}),fillText:s=>drawnTexts.push(s)},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
 const element=id=>{
  if(elements.has(id))return elements.get(id);
  const classes=new Set();const children=[];
  const e={id,children,contentWindow:{},showModal(){this.open=true},close(){this.open=false},style:{},textContent:'',innerHTML:'',classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:noop,contains:x=>classes.has(x)},appendChild:x=>children.push(x),append:(...xs)=>children.push(...xs),remove:noop,replaceChildren:()=>children.splice(0),addEventListener:noop,setAttribute:noop,getAttribute:()=>null,querySelectorAll:()=>[],querySelector:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:width,height:800}),getContext:()=>ctx,offsetWidth:width,offsetHeight:800};
  elements.set(id,e);return e;
 };
 class Network {
  constructor(el,data,options){this.body={data,nodes:{}};this.options=options;this.events={};networks.push(this);}
  on(name,fn){(this.events[name]||=[]).push(fn);} off(){} once(){} fit(){} redraw(){} destroy(){} setOptions(){} moveTo(){} selectNodes(){} unselectAll(){}
  getPositions(ids){return Object.fromEntries(this.body.data.nodes.get().filter(n=>!ids||ids.includes(n.id)).map(n=>[n.id,{x:n.x||0,y:n.y||0}]));}
  canvasToDOM(p){return p;} DOMtoCanvas(p){return p;} getScale(){return 1;} getViewPosition(){return{x:0,y:0};}
 }
 const sandbox={console:{log:noop,warn:noop,error:(...s)=>errors.push(s.join(' '))},URLSearchParams,URL,structuredClone,Map,Set,JSON,Date,Math,Promise,Blob,
  document:{getElementById:element,createElement:tag=>element('new-'+tag+'-'+Math.random()),querySelectorAll:()=>[],addEventListener:noop,body:element('body'),head:element('head')},
  navigator:{userAgent:'archive-contract-test'},screen:{width,height:800,orientation:{addEventListener:(type,fn)=>(orientationEvents[type]||=[]).push(fn)}},
  location:{search:'?opus=1',origin:'https://archive.invalid',href:'https://archive.invalid/ukazka/vesmir.html'},history:{back:noop},parent:{postMessage:noop},
  localStorage:{getItem(){throw Error('Unexpected localStorage read');},setItem(){throw Error('Unexpected localStorage write');}},
  sessionStorage:{setItem(){throw Error('Unexpected sessionStorage write');}},
  fetch(){throw Error('Unexpected network request');},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>0,cancelAnimationFrame:noop,addEventListener:(type,fn)=>(windowEvents[type]||=[]).push(fn),innerWidth:width,innerHeight:800,vis:{Network,DataSet}};
 sandbox.window=sandbox;
 const context=vm.createContext(sandbox);
 const html=fs.readFileSync('../../app/ukazka/'+file,'utf8');
 for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
  if(m[1].includes('src='))continue;
  if(m[1].includes('module')){const module=new vm.SourceTextModule(m[2],{context});await module.link(()=>{throw Error('Unexpected module import');});await module.evaluate();}
  else new vm.Script(m[2]).runInContext(context);
 }
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.deepEqual(errors,[],file+' runtime errors');
 assert.ok(networks.length>0,file+' must call the historical vis renderer');
 for(const fn of networks[0].events.afterDrawing||[])fn(ctx);
 const nodes=networks[0].body.data.nodes.get();
 const expected=file.includes('kovarova')?19:file.includes('josef')?14:5;
 assert.ok(nodes.length>=expected,file+' nodes');
 if(file!=='vesmir.html'){
  assert.equal(drawnTexts.length,file.includes('kovarova')?16:8,'Original medicine drawer must draw the archived medicines');
  const old=fs.readFileSync('archive-originals/'+file,'utf8');
  for(const m of old.matchAll(/<style>([\s\S]*?)<\/style>/g))assert.ok(html.includes(m[0]),'Original CRT style block changed');
  const start=old.indexOf('function renderTree(data) {');
  const tail=old.slice(start),end=tail.slice(10).search(/^function /m)+10;
  assert.ok(end>10);
  let expectedRenderer=tail.slice(0,end)
   .replace("_savedEdgeColors = ed.get().map(e => ({ id: e.id, color: e.color, width: e.width }))", "_savedEdgeColors = ed.get().map(e => ({ id: e.id, color: structuredClone(e.color), width: Number.isFinite(e.width) ? e.width : 2 }))")
   .replace("color: { color: '#2a4a68', highlight: '#2a4a68', hover: '#4a7aa8' },", "color: { color: '#4a8aaa', highlight: '#7ab8d8', hover: '#6aacc8', inherit: false, opacity: 1 },");
  expectedRenderer=expectedRenderer.replace('arrows: { to: { enabled: true, scaleFactor: 0.9 } },',"arrows: { to: { enabled: true, scaleFactor: 1.6, type: 'arrow' } },");
  expectedRenderer=expectedRenderer.replace("color: { color: '#2a4a68', highlight: '#5a8ab8', hover: '#4a7aa8' },","color: { color: '#4a8aaa', highlight: '#7ab8d8', hover: '#6aacc8', inherit: false },");
  expectedRenderer=expectedRenderer.replace('smooth: { enabled: false },\n        width: 1.5,','smooth: { enabled: false },\n        width: 2,');
  assert.ok(html.includes(expectedRenderer),'Historical renderer changed beyond reviewed hover fix');
  assert.equal(networks[0].options.edges.width,2,'Both CRTs use same edge width');
  assert.equal(networks[0].options.edges.arrows.to.scaleFactor,1.6,'Both CRTs use same arrow size');
  assert.equal(networks[0].options.edges.color.color,'#4a8aaa','Both CRTs use same edge color');
  if(file==='crt-josef.html'){
   const edges=networks[0].body.data.edges;
   const baseline=JSON.stringify(edges.get().map(e=>({id:e.id,color:e.color,width:e.width??2})));
   for(let pass=0;pass<5;pass++){
    for(const fn of networks[0].events.hoverNode||[])fn({node:'OBESITY'});
    for(const fn of networks[0].events.blurNode||[])fn();
    assert.equal(JSON.stringify(edges.get().map(e=>({id:e.id,color:e.color,width:e.width}))),baseline,'Hover/leave restores exact edge colors and explicit widths');
   }
  }
 }
 if(file==='vesmir.html'){
  const fire=(net,event,ids)=>{for(const fn of net.events[event]||[])fn({nodes:ids});flush();};
  flush();
  const root=networks[0],panel=element('sidePanel');
  fire(root,'click',['zdravi']);
  assert.equal(element('hud-overlay').style.display,'flex','Original HUD overlay opens');
  assert.equal(element('hud-panel-wrap').style.transform,'translateX(0)');
  assert.equal(element('hud-iframe').src,'hud.html?dev=1&nodeId=zdravi&nodeLabel='+encodeURIComponent('Zdraví'));
  assert.equal(sandbox._hudOverlayOpen,true);
  assert.ok(element('headerNodeLabel').textContent.includes('ukázka modelu'));
  const hud=fs.readFileSync('../../app/ukazka/hud.html','utf8');
  for(const name of ['hud-DNhFxP-v.js','hud-Bs1_vt3L.css']){
   assert.equal(fs.readFileSync('../../app/ukazka/assets/'+name,'utf8'),fs.readFileSync('archive-originals/'+name,'utf8'),'Historical compiled HUD asset must be unchanged');
   assert.ok(hud.includes('assets/'+(name.endsWith('.js')?'hud-archive.js':name)));
  }
  const originalBundle=fs.readFileSync('../../app/ukazka/assets/hud-DNhFxP-v.js','utf8');
  const bundle=fs.readFileSync('../../app/ukazka/assets/hud-archive.js','utf8');new vm.Script(bundle);
  const oldData='let e=c&&!l&&n()?n():oe;';
  const newData='let e=c&&!l&&n()?n():(window.ARCHIVE_HUD_DATA[K(u)]||window.ARCHIVE_HUD_DATA.dlouhovekost);';
  assert.equal(bundle,originalBundle.replace(oldData,newData).replace('`KILLER:`','`OBLAST:`').replace('SYSTEM_ONLINE','UKÁZKA MODELU').replace('DATA_ENCRYPTED','ULOŽENÁ DATA'),'Only archive data/labels may change in native HUD bundle');
  const dataScript=hud.match(/<script>window.ARCHIVE_HUD_DATA=([\s\S]*?);<\/script>/)[1];
  const perNode=JSON.parse(dataScript);
  const actions=new Set();let count=0;
  for(const node of sandbox.ARCHIVE_UNIVERSE){
   const data=perNode[node.id];assert.equal(data.node_label,node.label);
   assert.equal(data.killer.description,node.definition||'');
   for(const source of data.sources){assert.equal(source.status,'ARCHIV');assert.ok(source.url.startsWith('sources/'));assert.ok(fs.existsSync('../../app/ukazka/'+source.url));}
   if(data.action_origin){count++;} for(const action of data.catalogue){actions.add(action.id);const original=action.source.split('/').at(-1);assert.ok(fs.readFileSync('archive-originals/'+original,'utf8').includes(action.label),'Action text must be verbatim in historical catalogue');}
   if(!data.action_origin)assert.equal(data.action.id,'unavailable');
   assert.ok(data.action.id!=='plank_60s','No shared test plank');
  }
  assert.equal(count,29);assert.equal(actions.size,70);assert.equal(Object.values(perNode).reduce((sum,n)=>sum+n.sources.length,0),73);
  const catalogueScript=[...hud.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('new MutationObserver(install)'));
  assert.ok(catalogueScript);
  for(const data of Object.values(perNode)){
   const children=[];const host={append:el=>children.push(el)};
   const create=()=>({children:[],style:{},append(...xs){this.children.push(...xs)}});
   vm.runInNewContext(catalogueScript,{URLSearchParams,location:{search:'?nodeId='+encodeURIComponent(data.node_id)},window:{ARCHIVE_HUD_DATA:perNode},document:{querySelector:()=>host,createElement:create},MutationObserver:class{observe(){}disconnect(){}}});
   assert.equal(children.length,data.catalogue.length>1?1:0,'Additional actions only when present');
   if(children.length)assert.equal(children[0].children[1].children.length,data.catalogue.length-1);
  }

  assert.ok(hud.includes('.hud-shell .p-4.space-y-4>div:first-child{display:none}'),'No fake personal metrics');
  assert.ok(hud.includes('.hud-shell .hud-c4 button{display:none!important}'),'Catalogue actions cannot be completed');
  assert.ok(hud.includes("connect-src 'none'"),'HUD API remains disconnected');
  element('closePanel').onclick();
  assert.equal(element('hud-overlay').style.display,'none');assert.equal(sandbox._hudOverlayOpen,false);
  for(const node of sandbox.ARCHIVE_UNIVERSE.filter(n=>nodes.some(x=>x.id===n.id))){
   const rgb=[1,3,5].map(i=>parseInt(node.color.slice(i,i+2),16)).join(',');
   assert.ok(stops.includes('rgb('+rgb+')'),'Sphere overlay must retain category color: '+node.id);
  }
  fire(root,'doubleClick',['zdravi']);
  assert.ok(networks.at(-1).body.data.nodes.getIds().includes('biomarkery'),'Sub-universe navigation');
  fire(networks.at(-1),'click',['biomarkery']);
  assert.equal(element('hud-iframe').src,'hud.html?dev=1&nodeId=biomarkery&nodeLabel='+encodeURIComponent('Biomarkery'));assert.equal(sandbox._hudOverlayOpen,true);
  fire(networks.at(-1),'click',[]);assert.equal(sandbox._hudOverlayOpen,false);
  fire(networks.at(-1),'click',[]);assert.ok(networks.at(-1).body.data.nodes.getIds().includes('dlouhovekost'),'Return to root');
  const source=perNode.stabilita.sources[0];
  const send=(data,frame)=>{for(const fn of windowEvents.message||[])fn({origin:'https://archive.invalid',source:element(frame).contentWindow,data});};
  send({type:'chj:source:open',source},'hud-iframe');
  assert.equal(element('archive-source').open,true);assert.ok(element('archive-source-frame').src.endsWith(source.url));
  send({type:'archive:source:close'},'archive-source-frame');assert.equal(element('archive-source').open,false);
  send({type:'chj:source:open',source:{url:'https://evil.invalid/'}},'hud-iframe');assert.equal(element('archive-source').open,false);
  assert.match(fs.readFileSync('../../app/ukazka/universe-core.css','utf8'),/#sidePanel\.visible\s*\{[^}]*opacity:\s*1/s);
 }
 if(file==='vesmir.html'){
  for(const fn of networks.at(-1).events.doubleClick||[])fn({nodes:['telo']});flush();
  assert.ok(networks.at(-1).body.data.nodes.getIds().includes('sila'));
 }
 const beforeRotation=networks.length;
 sandbox.innerWidth=844;sandbox.innerHeight=390;
 for(const fn of orientationEvents.change||[])fn();flush();
 assert.ok(networks.length>beforeRotation,file+' must rebuild on orientation change');
 assert.deepEqual(errors,[],file+' rotation runtime errors');
 const beforeResize=networks.length;
 sandbox.innerWidth=390;sandbox.innerHeight=844;
 for(const fn of windowEvents.resize||[])fn();flush();
 assert.ok(networks.length>beforeResize,file+' must rebuild on viewport resize');
 if(file==='vesmir.html'){assert.ok(networks.at(-1).body.data.nodes.getIds().includes('sila'),'Preserve current sub-universe across rotation');assert.ok(!networks.at(-1).body.data.nodes.getIds().includes('dlouhovekost'));}
 console.log('PASS',file,width,'historical renderer,',nodes.length,'render records,',drawnTexts.length,'drawn texts, no network/account storage');
}
(async()=>{for(const width of [1280,390])for(const file of ['crt-kovarova.html','crt-josef.html','vesmir.html'])await check(file,width);})().catch(e=>{console.error(e);process.exitCode=1;});
