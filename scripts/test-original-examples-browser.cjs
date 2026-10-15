const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const snapshot = JSON.parse(read('test/snapshots/kovarova.json'));
const example = JSON.parse(read('app/assets/examples/crt-kovarova.json'));
assert.deepEqual(example.nodes.map(n=>n.id), snapshot.nodeIds);
assert.deepEqual(example.edges.map(e=>e.from+'→'+e.to), snapshot.edges);
for (const n of example.nodes) {
  assert.equal(n.level,snapshot.levels[n.id]); assert.equal(n.branch,snapshot.branches[n.id]);
}
assert.ok(!JSON.stringify(example).includes('user_id'));
assert.ok(read('app/home-v2.html').includes('/crt.html?vzor=kovarova'));
assert.ok(read('app/zakladatele.html').includes('vzor=dlouhovekost&amp;z=zakladatele'));
const routes = JSON.parse(read('vercel.json')).rewrites;
(async()=>{
 const out = path.resolve(process.env.AI_TESTER_BROWSER_OUT || 'original-example-results');
 fs.mkdirSync(out,{recursive:true});
 const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://fixture');
  let pathname = routes.find(r=>r.source===url.pathname)?.destination || url.pathname;
  let file = path.resolve(root,'.'+pathname);
  if (!fs.existsSync(file) && !pathname.startsWith('/app/')) file = path.resolve(root,'app'+pathname);
  if (!file.startsWith(root+path.sep)) {res.writeHead(403);return res.end();}
  const ext = path.extname(file);
  res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[ext] || 'text/html');
  try {res.end(fs.readFileSync(file));} catch {res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin = 'http://127.0.0.1:'+server.address().port;
 let browser;
 try {
  browser = await chromium.launch({headless:true});
  for (const width of [1280,390]) {
   const context = await browser.newContext({viewport:{width,height:844}});
   // A previously signed-in browser must still open the public fixture, without reading or changing its profile.
   await context.addInitScript(()=>{
    localStorage.setItem('chj_uid','existing-account-must-not-be-used');
    localStorage.setItem('currentModel','toc');
    localStorage.setItem('userRole','dekatlon');
    localStorage.setItem('crt_idx_FALL_RISK','3');
    window.__initialStorage = JSON.stringify({...localStorage});
    window.__storageReads=[];window.__storageWrites=[];
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
    Storage.prototype.getItem=function(k){window.__storageReads.push(k);return get.call(this,k);};
    Storage.prototype.setItem=function(k,v){window.__storageWrites.push(k);return set.call(this,k,v);};
    Storage.prototype.removeItem=function(k){window.__storageWrites.push(k);return remove.call(this,k);};
    Storage.prototype.clear=function(){window.__storageWrites.push('*');return clear.call(this);};
   });
   const forbidden=[],errors=[];
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if (request.method()!=='GET' || (url.origin===origin&&url.pathname.startsWith('/api/')) || /supabase.co$|firebaseio.com$|googleapis.com$/.test(url.hostname)&&!url.hostname.startsWith('fonts.') || /gstatic.com/.test(url.hostname)&&url.pathname.includes('firebasejs')) {
     forbidden.push(request.method()+' '+url.origin+url.pathname);return route.abort();
    }
    return route.continue();
   });
   const page = await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
   await page.goto(origin+'/');
   await page.locator('#ukazky a[href="/crt.html?vzor=kovarova"]').click();
   await page.waitForFunction(()=>window._crtExampleCy?.nodes().length===14,{},{timeout:30000});
   assert.ok(page.url().includes('/crt.html?vzor=kovarova'));
   assert.equal(await page.evaluate(()=>window._crtExampleCy.edges().length),14);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.waitForTimeout(700);
   await page.screenshot({path:path.join(out,'original-crt-'+width+'.png')});
   // Trigger the original Cytoscape tap handler, then inspect the original CRT panel.
   await page.evaluate(()=>window._crtExampleCy.getElementById('FALL_RISK').emit('tap'));
   await page.locator('#crtNodePanel.open').waitFor();
   assert.ok((await page.locator('#cnpData').textContent()).includes('Hrozba pádu'));
   assert.equal(await page.locator('button:has-text("SPLNĚNO")').count(),0);
   await page.evaluate(()=>{window.completeCrtAction('FALL_RISK','test',false);window.acceptCrtSecond('FALL_RISK');window.declineCrtSecond('FALL_RISK');window.regenCRT();});
   assert.deepEqual(await page.evaluate(()=>window.__storageReads),[]);
   assert.deepEqual(await page.evaluate(()=>window.__storageWrites),[]);
   await page.getByRole('button',{name:'Zavřít',exact:true}).click();
   await page.getByRole('button',{name:'Expert',exact:true}).click();
   assert.ok(await page.evaluate(()=>window._crtExampleCy.getElementById('FALL_RISK').data('label').includes('Riziko')));
   await page.locator('[data-example-return]').click();await page.waitForURL(origin+'/');
   await page.locator('#ukazky a[href="/app/?vzor=dlouhovekost"]').click();
   await page.waitForFunction(()=>window._exampleViewState?.().nodes.some(n=>n.id==='dlouhovekost'),{},{timeout:30000});
   assert.equal(await page.evaluate(()=>window.CURRENT_MODEL),'longevity');
   assert.equal(await page.locator('#nodeTitle').textContent(),'Dlouhověkost');
   await page.getByRole('button',{name:'Otevřít oblast Dlouhověkost',exact:true}).click();
   await page.evaluate(()=>window._openExampleArea('telo'));
   assert.equal(await page.evaluate(()=>window._exampleViewState().centerId),'telo');
   assert.ok((await page.evaluate(()=>window._exampleViewState().nodes.map(n=>n.id))).includes('sila'));
   await page.waitForTimeout(700);
   await page.screenshot({path:path.join(out,'original-universe-'+width+'.png')});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(await page.evaluate(()=>window.__storageReads),[]);
   assert.deepEqual(await page.evaluate(()=>window.__storageWrites),[]);
   assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage})===window.__initialStorage),true);
   // Direct URL survives reload and ignores an unrelated saved universe/UID.
   await page.reload();await page.waitForFunction(()=>window._exampleViewState?.().nodes.some(n=>n.id==='dlouhovekost'));
   await page.goto(origin+'/zakladatele/');
   await page.locator('.model-demo-links a').filter({hasText:'CRT Kovářové'}).click();
   await page.waitForFunction(()=>window._crtExampleCy?.nodes().length===14);
   await page.locator('.example-toolbar a').filter({hasText:'Vesmír'}).click();
   await page.waitForFunction(()=>window._exampleViewState?.().nodes.some(n=>n.id==='dlouhovekost'));
   assert.ok((await page.locator('[data-example-return]').getAttribute('href')).includes('/zakladatele/'));
   assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS original renderers: stored Kovářová snapshot, Cytoscape taps/panel/labels, vis-network areas, mobile/desktop, no account/API access or storage writes and founder return.');
 } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
