// Actual document HTML/CSS/return script, offline Firebase fixture for registration.
// No private account, API writes or real form submission.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const login=read('app/login.html').replace(/    import[\s\S]*?from 'https:\/\/www.gstatic.com\/firebasejs\/[^']+';\r?\n/g,'').replace('<script type="module">','<script type="module">\n'+`
const initializeApp=()=>({}),getAuth=()=>({currentUser:null}),GoogleAuthProvider=class{};
const onAuthStateChanged=(_auth,cb)=>queueMicrotask(()=>cb(null));
const signInWithPopup=async()=>{},signInWithEmailAndPassword=async()=>{},createUserWithEmailAndPassword=async()=>{};
`);
const routes={'/':'app/home-v2.html','/login':'app/login.html','/cookies':'app/cookies.html','/ochrana-osobnich-udaju':'app/ochrana-osobnich-udaju.html','/obchodni-podminky':'app/obchodni-podminky.html'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://fixture').pathname;
 const file=path.resolve(root,routes[pathname]||'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const data=pathname==='/login'?login:fs.readFileSync(file),ext=path.extname(file);
 res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'}[ext]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});
 const out=process.env.AI_TESTER_BROWSER_OUT||'/tmp/chj-document-return';fs.mkdirSync(out,{recursive:true});
 for(const size of [{width:1280,height:800},{width:390,height:844}]){
  const context=await browser.newContext({viewport:size,reducedMotion:'reduce'});let posts=0;const errors=[];
  await context.route('**/*',r=>{if(r.request().method()==='POST')posts++;return r.request().url().startsWith(base)?r.continue():r.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/cookies','/ochrana-osobnich-udaju','/obchodni-podminky']){
   await page.goto(base+'/');await page.locator('.footer-links a[href="'+route+'"]').scrollIntoViewIfNeeded();
   const source=await page.evaluate(()=>({url:location.href,y:scrollY}));
   await page.locator('.footer-links a[href="'+route+'"]').click();await page.waitForURL(base+route);
   assert.equal(await page.locator('[data-document-back]').textContent(),'← Zpět');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(out,'document-'+route.slice(1)+'-'+size.width+'.png')});
   if(route==='/cookies')await page.reload();
   await page.locator('[data-document-back]').click();await page.waitForURL(source.url);
   await page.waitForFunction(y=>Math.abs(scrollY-y)<3,source.y);
  }
  // A document opened by another document returns to that immediate caller.
  await page.locator('.footer-links a[href="/cookies"]').click();await page.waitForURL(base+'/cookies');
  await page.locator('main a[href="/ochrana-osobnich-udaju"]').scrollIntoViewIfNeeded();
  await page.locator('main a[href="/ochrana-osobnich-udaju"]').evaluate(link=>link.addEventListener('click',()=>sessionStorage.setItem('fixture-cookie-click-y',String(scrollY)),{once:true}));
  await page.locator('main a[href="/ochrana-osobnich-udaju"]').click();await page.waitForURL(base+'/ochrana-osobnich-udaju');
  const cookieY=await page.evaluate(()=>Number(sessionStorage.getItem('fixture-cookie-click-y')));
  await page.locator('[data-document-back]').click();await page.waitForURL(base+'/cookies');
  console.log('Nested document scroll '+JSON.stringify({size,expected:cookieY,actual:await page.evaluate(()=>scrollY)}));
  await page.waitForFunction(y=>Math.abs(scrollY-y)<3,cookieY);
  await page.locator('[data-document-back]').click();await page.waitForURL(base+'/');
  // New tabs with noopener close to the untouched caller (form state survives).
  await page.locator('#contact-name').fill('Offline fixture');
  const popupPromise=page.waitForEvent('popup');
  await page.locator('.contact-note a[href="/ochrana-osobnich-udaju"]').click();
  const contactDoc=await popupPromise;await contactDoc.waitForLoadState();const closed=contactDoc.waitForEvent('close');
  await contactDoc.locator('[data-document-back]').click();await closed;
  assert.equal(await page.locator('#contact-name').inputValue(),'Offline fixture');
  await page.goto(base+'/login#register');
  await page.locator('#regEmail').fill('fixture@example.test');await page.locator('#regPass').fill('fixture-password');
  for(const route of ['/obchodni-podminky','/ochrana-osobnich-udaju']){
   const popup=page.waitForEvent('popup');await page.locator('#registerPanel a[href="'+route+'"]').click();
   const doc=await popup;await doc.waitForLoadState();const closing=doc.waitForEvent('close');await doc.locator('[data-document-back]').click();await closing;
   assert.equal(page.url(),base+'/login#register');
   assert.equal(await page.locator('#registerPanel').isVisible(),true);
   assert.equal(await page.locator('#regEmail').inputValue(),'fixture@example.test');
   assert.equal(await page.locator('#regPass').inputValue(),'fixture-password');
  }
  // No known caller or an external referrer falls back to the homepage safely.
  for(const referer of [undefined,'https://example.org/']){
   const direct=await context.newPage();
   await direct.goto(base+'/cookies',referer?{referer}:undefined);
   assert.equal(await direct.locator('[data-document-back]').getAttribute('href'),'/#top');
   await direct.locator('[data-document-back]').focus();await direct.keyboard.press('Enter');
   await direct.waitForURL(base+'/#top');await direct.close();
  }
  assert.equal(posts,0);assert.deepEqual(errors,[]);await context.close();
  console.log('PASS document return '+JSON.stringify({size,sameTab:true,scrollRestored:true,reload:true,nestedDocuments:true,newTabCloses:true,registrationPreserved:true,externalFallback:true,posts}));
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
