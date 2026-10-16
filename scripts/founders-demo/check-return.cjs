const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../app/assets/landing/demo-navigation.js'),'utf8');
function run(path,{referrer='',shell=false,embedded=false}={}){
 const events={},created=[],assigned=[],sent=[],frame={contentWindow:{}},footer={},logo={},links=[{href:'https://dev.iting.cz/ukazka/#josef'}];
 const header={insertBefore:link=>created.push(link)};
 const context={URL,URLSearchParams,Set,location:{origin:'https://dev.iting.cz',pathname:path.split('?')[0],search:path.includes('?')?'?'+path.split('?')[1]:'',href:'https://dev.iting.cz'+path,assign:url=>assigned.push(url)},document:{referrer,querySelectorAll:()=>links,documentElement:{classList:{add(){}}},querySelector:selector=>selector.startsWith('iframe')?(shell?frame:null):selector==='header .demo-logo'?logo:(selector==='header'||selector==='.crt-header'||selector==='#appHeader')?header:footer,createElement:()=>({style:{},setAttribute(){},addEventListener(){}}),body:{appendChild:link=>created.push(link)}},addEventListener:(name,fn)=>events[name]=fn};
 context.window=context;context.parent=embedded?{postMessage:(...args)=>sent.push(args)}:context;
 vm.runInNewContext(source,context);
 return {events,created,assigned,sent,links,frame,context,footer,logo};
}
for(const view of ['kovarova','josef','vesmir']){
 const target='/home-intro-preview.html#ukazky';
 const r=run('/ukazka/?returnTo='+encodeURIComponent(target),{shell:true});
 assert.equal(r.logo.href,target,view+' header return');assert.equal(r.footer.href,target);
 r.events.message({origin:'https://evil.invalid',source:r.frame.contentWindow,data:{archiveReturn:true}});assert.equal(r.assigned.length,0);
 r.events.message({origin:'https://dev.iting.cz',source:{},data:{archiveReturn:true}});assert.equal(r.assigned.length,0);
 r.events.message({origin:'https://dev.iting.cz',source:r.frame.contentWindow,data:{archiveReturn:true}});assert.deepEqual(r.assigned,[target]);
}
const founder=run('/zakladatele/');assert.equal(new URL(founder.links[0].href).searchParams.get('returnTo'),'/zakladatele/#pod-povrch');
const preview=run('/home-intro-preview.html');assert.equal(new URL(preview.links[0].href).searchParams.get('returnTo'),'/home-intro-preview.html#ukazky');
for(const bad of ['https://evil.invalid/','javascript:alert(1)','//evil.invalid/','/login','/ukazka/']){
 const r=run('/ukazka/?returnTo='+encodeURIComponent(bad),{shell:true});assert.equal(r.logo.href,'/');
}
const fallback=run('/ukazka/',{shell:true,referrer:'https://dev.iting.cz/zakladatele/#pod-povrch'});assert.equal(fallback.logo.href,'/zakladatele/#pod-povrch');
for(const page of ['crt-kovarova.html','crt-josef.html','vesmir.html']){
 const nested=run('/ukazka/'+page,{embedded:true});nested.context.goBack();assert.equal(nested.sent[0][0].archiveReturn,true);
 const direct=run('/ukazka/'+page+'?returnTo=%2Fhome-v2%23ukazky');direct.context.goBack();assert.deepEqual(direct.assigned,['/home-v2#ukazky']);
}
console.log('PASS: caller sections, all three graph returns, direct/reloaded URLs, fallback and hostile target/message rejection');

assert.ok(fs.readFileSync(require('node:path').join(__dirname,'../../app/ukazka/index.html'),'utf8').includes("location.pathname+location.search+'#'+view"),'Graph switching preserves returnTo despite base href');
