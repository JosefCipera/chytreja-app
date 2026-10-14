// Real pages and redirect code; auth/profile are offline fixtures. No live account or writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const authFixture=`
const initializeApp=()=>({});
const getAuth=()=>({currentUser:sessionStorage.getItem('fixture-signed-in')?{uid:'return-fixture',displayName:'Fixture'}:null});
const onAuthStateChanged=(auth,cb)=>queueMicrotask(()=>cb(auth.currentUser));
const signOut=async()=>{throw new Error('Return navigation must not sign out');};
const authFetch=async(url,init)=>{if(init?.method&&init.method!=='GET')throw new Error('Unexpected fixture write');return {ok:true,json:async()=>({profile:{onboarding_completed:!sessionStorage.getItem('fixture-onboarding')}})};};
`;
const wizard=read('app/js/universe/onboarding-wizard.js').replace(/^import .*;\r?\n/gm,'').replace('export async function','async function');
const launcher=read('app/launcher.html').replace(/^  import .*;\r?\n/gm,'').replace('<script type="module">','<script type="module">\n'+authFixture+'\n'+wizard);
const login=read('app/login.html').replace(/    import[\s\S]*?from 'https:\/\/www.gstatic.com\/firebasejs\/[^']+';\r?\n/g,'').replace('<script type="module">','<script type="module">\n'+authFixture+`
const GoogleAuthProvider=class{};
const signInWithPopup=async()=>{},signInWithEmailAndPassword=async()=>{},createUserWithEmailAndPassword=async()=>{};
`);
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://fixture').pathname;
 if(pathname==='/launcher'||pathname==='/login'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(pathname==='/launcher'?launcher:login);return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/app/home-v2.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const data=fs.readFileSync(file),ext=path.extname(file);res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'}[ext]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});
 for(const size of [{width:1280,height:800},{width:390,height:844}]){
  const context=await browser.newContext({viewport:size,reducedMotion:'reduce'});let posts=0;
  await context.route('**/*',r=>{if(r.request().method()==='POST')posts++;return r.request().url().startsWith(base)?r.continue():r.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const atHome=async()=>{await page.waitForURL(base+'/#top');await page.waitForFunction(()=>scrollY<2);};
  await page.goto(base+'/');
  assert.equal(await page.locator('.footer-top').count(),0);
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  await page.locator('.home-header .logo').click();await atHome();
  // Guest can leave login, registration, and app auth gate, without any auth API.
  for(const route of ['/login','/login#register']){
   await page.goto(base+route);await page.locator('.back-to-web').click();await atHome();
  }
  await page.goto(base+'/launcher');await page.locator('.auth-back').click();await atHome();
  // Signed-in transition replaces login in history. Both explicit return and Back work.
  await page.evaluate(()=>{sessionStorage.setItem('fixture-signed-in','1');localStorage.setItem('chj_last_response_v1:return-fixture',JSON.stringify({mode:'ACT',text:'Saved fixture action',buttons:[]}));});
  await page.locator('.top-try a').click();await page.waitForURL(base+'/launcher');
  await page.waitForFunction(()=>window.__chj_userId==='return-fixture');
  assert.equal(await page.locator('#stage-text').textContent(),'Saved fixture action');
  await page.locator('header .back-to-web').click();await atHome();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('fixture-signed-in')),'1');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chj_last_response_v1:return-fixture')).text),'Saved fixture action');
  // Simulate a new visit to the application, then browser Back.
  await page.locator('.top-try a').click();await page.waitForURL(base+'/launcher');
  await page.goBack();await page.waitForURL(url=>url.pathname==='/'&&url.hash==='#top');
  await page.waitForFunction(()=>document.querySelector('.home-header'));
  // Onboarding itself must offer an exit rather than covering the app return link.
  await page.evaluate(()=>sessionStorage.setItem('fixture-onboarding','1'));
  await page.locator('.top-try a').click();await page.waitForURL(base+'/launcher');
  await page.locator('#onb-overlay .onb-home').click();await atHome();
  assert.equal(posts,0);assert.deepEqual(errors,[]);
  console.log('PASS web/app return '+JSON.stringify({size,topLinks:true,guestExit:true,signedInExit:true,backSkipsLogin:true,sessionRetained:true,onboardingExit:true,posts}));
  await context.close();
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
