const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const publicData=JSON.parse(read('app/assets/landing/model-demo-data.json')),snapshot=JSON.parse(read('test/snapshots/kovarova.json'));
const catalog=new Map(JSON.parse(read('data/crt/longevity-states.json')).map(n=>[n.id,n]));
assert.deepEqual(publicData.crt.nodes,snapshot.nodeIds.map(id=>({id,label:catalog.get(id).label_layman||catalog.get(id).label,level:snapshot.levels[id],branch:snapshot.branches[id],type:catalog.get(id).type})));
assert.deepEqual(publicData.crt.edges,snapshot.edges.map(e=>{const[from,to]=e.split('→');return{from,to};}));
assert.deepEqual(publicData.universe,JSON.parse(read('data/universes/longevity/models/longevity.json')).map(n=>({id:n.id,label:n.label,definition:n.definition??'',color:n.color??'#79a3d1',...(n.parent?{parent:n.parent}:{}),related:n.related??[]})));
const routes=JSON.parse(read('vercel.json')).rewrites;
for(const route of ['/ukazka/crt','/ukazka/crt/','/ukazka/vesmir','/ukazka/vesmir/'])assert.equal(routes.find(r=>r.source===route)?.destination,'/app/ukazka.html');
assert.equal(read('app/home-v2.html').includes('href="/ukazka/crt"'),true);
assert.equal(read('app/zakladatele.html').includes('href="/ukazka/vesmir"'),true);
(async()=>{
 const outputs=path.resolve(process.env.AI_TESTER_BROWSER_OUT||'model-demo-results');fs.mkdirSync(outputs,{recursive:true});
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture');
  const route=routes.find(r=>r.source===u.pathname);
  const pathname=route?.destination??u.pathname;
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{browser=await chromium.launch({headless:true});}catch(error){await new Promise(r=>server.close(r));throw error;}
 const context=await browser.newContext(),errors=[],violations=[];
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==origin||u.pathname.startsWith('/api/')||r.method()!=='GET'){violations.push(r.method()+' '+u.pathname);return route.abort();}return route.continue();});
 try{
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:width===390?844:920});
   await page.goto(origin+'/');
   await page.locator('#ukazky a[href="/ukazka/crt"]').click();
   await page.locator('#demo-content').waitFor({state:'visible'});
   assert.equal(await page.locator('svg [data-node]').count(),snapshot.nodeIds.length);
   assert.equal(await page.locator('#demo-node-title').textContent(),catalog.get('FALL_RISK').label_layman);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('svg [data-from]').count(),snapshot.edges.length);
   await page.screenshot({path:path.join(outputs,'model-crt-'+width+'.png'),fullPage:true});
   const camera=await page.locator('#demo-map').getAttribute('viewBox');await page.getByRole('button',{name:'Přiblížit mapu',exact:true}).click();
   assert.notEqual(await page.locator('#demo-map').getAttribute('viewBox'),camera);
   await page.locator('.demo-node-list summary').click();
   await page.locator('#demo-list button').filter({hasText:'Obezita'}).click();
   assert.equal(await page.locator('#demo-node-title').textContent(),'Obezita');
   await page.locator('svg [data-node="OBESITY"]').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('svg [data-node="OBESITY"]').getAttribute('aria-pressed'),'true');
   await page.getByRole('link',{name:'Vesmír Dlouhověkosti',exact:true}).click();
   assert.ok(page.url().endsWith('/ukazka/vesmir'));
   assert.equal(await page.locator('#demo-node-title').textContent(),'Dlouhověkost');
   await page.locator('svg [data-node="telo"]').click();
   await page.getByRole('button',{name:'Otevřít oblast Tělo',exact:true}).click();
   assert.equal(await page.locator('#demo-node-title').textContent(),'Tělo');
   assert.equal(await page.locator('svg [data-node="sila"]').count(),1);
   await page.locator('svg [data-node="sila"]').click();assert.equal(await page.locator('#demo-node-title').textContent(),'Síla');
   await page.screenshot({path:path.join(outputs,'model-universe-'+width+'.png'),fullPage:true});
   await page.getByRole('button',{name:'O úroveň výš',exact:false}).click();
   assert.equal(await page.locator('#demo-node-title').textContent(),'Dlouhověkost');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#demo-return').click();await page.waitForURL(origin+'/');
  }
  await page.goto(origin+'/ukazka/crt/?userId=fixture-unused-private-id');
  await page.locator('#demo-content').waitFor({state:'visible'});
  assert.equal((await page.locator('body').textContent()).includes('fixture-unused-private-id'),false);
  await page.goto(origin+'/ukazka/vesmir/');await page.locator('#demo-content').waitFor({state:'visible'});
  assert.equal(await page.locator('#demo-node-title').textContent(),'Dlouhověkost');
  await page.goto(origin+'/zakladatele/');
  await page.locator('.model-demo-links a[href="/ukazka/vesmir"]').click();await page.locator('#demo-content').waitFor({state:'visible'});
  await page.locator('#demo-return').click();await page.waitForURL(origin+'/zakladatele/');
  await page.route('**/model-demo-data.json',r=>r.fulfill({status:503,body:'unavailable'}));
  await page.goto(origin+'/ukazka/crt');
  await page.waitForFunction(()=>document.getElementById('demo-loading').textContent.includes('nepodařilo'));
  assert.equal(await page.locator('#demo-content').isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
  console.log('PASS trial CRT/universe: exact source models, no profile/API/auth/network writes, mobile/desktop, labels, keyboard, zoom, drilldown, returns and load error.');
 }finally{await context.close();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
