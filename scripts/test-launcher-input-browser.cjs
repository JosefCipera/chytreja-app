// Actual Launcher DOM/module/CSS; auth, Speech provider and API are offline fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const prelude=`
const ensureHealthPrivacy=async()=>true;
const initializeApp=()=>({});
const getAuth=()=>({currentUser:sessionStorage.getItem('fixture-signed-out')?null:{uid:'fixture-a',displayName:'Fixture'}});
function onAuthStateChanged(auth,cb){window.__switchUser=uid=>{auth.currentUser=uid?{uid,displayName:'Fixture'}:null;cb(auth.currentUser);};queueMicrotask(()=>cb(auth.currentUser));}
const signOut=async()=>{sessionStorage.setItem('fixture-signed-out','1');window.__switchUser(null);},checkAndShowOnboarding=async()=>{};
window.__requests=[];window.__hold=false;
window.__reply={mode:'ACT',text:'5× pomalu vstaň ze židle a zase si sedni. Podle potřeby si pomáhej rukama o područky. Použij pevnou židli, která neklouže. Při bolesti, závrati nebo nejistotě přestaň.',buttons:['Hotovo','Přeskočit'],expects_reply:false};
const authFetch=async(_url,init)=>{window.__requests.push(JSON.parse(init.body));if(window.__hold)await new Promise(resolve=>window.__release=resolve);return{ok:true,json:async()=>structuredClone(window.__reply)};};
window.__recognizers=[];
window.SpeechRecognition=class{constructor(){window.__recognizers.push(this);}start(){}stop(){this.onend?.();}abort(){this.onend?.();}};
window.__voice=async text=>{const r=window.__recognizers.at(-1),p=r.onresult({results:[[{transcript:text}]]});r.onend();await p;};
`;
const html=fs.readFileSync(path.join(__dirname,'../app/launcher.html'),'utf8').replace("<style>html:not([data-chj-privacy-ready]) body{visibility:hidden}</style><script type=\"module\" src=\"/app/js/universe/privacy-guard.js?v=1\"></script>",'').replace(/^  import .*;\r?\n/gm,'').replace('<script type="module">','<script type="module">\n'+prelude);
const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);});
(async()=>{
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});const context=await browser.newContext();
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const out=process.env.AI_TESTER_BROWSER_OUT||'/tmp/chj-input-echo-browser';fs.mkdirSync(out,{recursive:true});
  await page.goto(base+'/launcher');await page.waitForFunction(()=>document.getElementById('stage-text').textContent==='Co chceš řešit?');
  for(const size of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]){
   await page.setViewportSize(size);await page.click('#mic-btn');await page.evaluate(()=>window.__voice('Chci zhubnout.'));
   await page.waitForFunction(()=>document.getElementById('stage-label').textContent==='DNES');
   assert.equal(await page.locator('#input-echo-text').textContent(),'Chci zhubnout.');
   assert.equal(await page.locator('#input-echo-label').textContent(),'Přepis hlasu');
   assert.equal(await page.locator('#text-input').inputValue(),'');
   const layout=await page.evaluate(()=>{
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};},m=document.querySelector('main').getBoundingClientRect();
    return{width:innerWidth,height:innerHeight,echo:rect('input-echo'),input:rect('text-input'),send:rect('send-btn'),chips:rect('chips'),main:{top:m.top,bottom:m.bottom}};
   });
   for(const key of ['echo','input','send'])assert.ok(layout[key].left>=0&&layout[key].right<=layout.width+1&&layout[key].top>=0&&layout[key].bottom<=layout.height+1,JSON.stringify({size,key,layout}));
   assert.ok(layout.chips.top>=layout.main.top-1&&layout.chips.bottom<=layout.main.bottom+1,'Action chips must fit visible main');
   await page.screenshot({path:path.join(out,'echo-'+size.width+'.png')});
  }
  assert.equal(await page.evaluate(()=>window.__requests[0].text),'Chci zhubnout.');
  assert.equal(await page.evaluate(()=>'input_echo' in window.__requests[0]),false);
  await page.evaluate(()=>window.__reply={mode:'EXPLAIN',text:'Důvod zvoleného kroku',buttons:['Hotovo','Přeskočit']});
  await page.getByRole('button',{name:'Proč?',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('stage-text').textContent==='Důvod zvoleného kroku');
  assert.equal(await page.locator('#input-echo-text').textContent(),'Chci zhubnout.');
  await page.reload();await page.waitForFunction(()=>document.getElementById('input-echo-text').textContent==='Chci zhubnout.');
  assert.equal(await page.locator('#input-echo-label').textContent(),'Přepis hlasu');
  const literal='<img src=x onerror="window.__injected=true">';
  await page.fill('#text-input',literal);await page.click('#send-btn');
  await page.waitForFunction(t=>document.getElementById('input-echo-text').textContent===t,literal);
  assert.equal(await page.locator('#input-echo-text img').count(),0);assert.equal(await page.evaluate(()=>window.__injected),undefined);
  const long='Delší věta s diakritikou. '.repeat(80);
  await page.fill('#text-input',long);await page.click('#send-btn');
  await page.waitForFunction(t=>document.getElementById('input-echo-text').textContent===t,long.trim());
  assert.ok(await page.evaluate(()=>{const e=document.getElementById('input-echo-text');return e.scrollHeight>e.clientHeight;}));
  await page.screenshot({path:path.join(out,'echo-long.png')});
  await page.evaluate(()=>window.__hold=true);await page.click('#mic-btn');
  await page.evaluate(()=>{const r=window.__recognizers.at(-1);window.__oldRecording=r;r.onresult({results:[[{transcript:'Old account request'}]]});});
  await page.waitForFunction(()=>typeof window.__release==='function');
  await page.evaluate(()=>window.__switchUser('fixture-b'));
  assert.equal(await page.locator('#input-echo').isVisible(),false);
  await page.evaluate(()=>{window.__hold=false;window.__release();window.__oldRecording.onresult({results:[[{transcript:'Stale input'}]]});});
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#input-echo-text').textContent(),'');
  assert.ok(!await page.evaluate(()=>window.__requests.some(r=>r.text==='Stale input')));
  await page.click('#mic-btn');await page.evaluate(()=>window.__voice('Nová zpráva'));
  await page.waitForFunction(()=>document.getElementById('input-echo-text').textContent==='Nová zpráva');
  assert.equal(await page.evaluate(()=>window.__requests.at(-1).userId),'fixture-b');
  await page.reload();await page.waitForFunction(()=>window.__chj_userId==='fixture-a');
  await page.evaluate(()=>window.__switchUser('fixture-b'));await page.waitForFunction(()=>document.getElementById('input-echo-text').textContent==='Nová zpráva');
  await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'Odhlásit se',exact:true}).click();
  await page.waitForURL(base+'/');
  await page.waitForFunction(()=>!document.getElementById('auth-overlay').classList.contains('hidden'));
  assert.equal(await page.locator('#input-echo-text').textContent(),'');
  assert.equal(await page.evaluate(()=>localStorage.getItem('chj_last_response_v1:fixture-b')),null);
  assert.deepEqual(errors,[]);
  console.log('PASS: actual Launcher module/DOM at 320/390/1280px; echo survives reply/nav/reload; text literal/scrollable; account switch drops stale speech/reply; logout clears scoped echo. Auth/voice/network fixtures, not physical-phone ASR.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

