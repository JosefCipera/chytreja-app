// Offline browser fixture: real UI modules, synthetic identity, mocked privacy API.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const versions={health:'health-2026-10-15-v1',terms:'terms-2026-10-15-v1',policy:'privacy-2026-10-15-v1'};
 let state={ready:false,status:'pending',adult:false,epoch:0,versions,cleanup_pending:false},calls=[];
 const root=process.cwd(),out=path.join(root,'privacy-browser-results');fs.mkdirSync(out,{recursive:true});
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://fixture');
  if(u.pathname==='/launcher'){res.setHeader('Content-Type','text/html');return res.end('<h1>Fixture launcher</h1>');}
  const file=path.join(root,u.pathname==='/soukromi'?'app/soukromi.html':decodeURIComponent(u.pathname).replace(/^\/+/,''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844}});
 const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const appMock="export function initializeApp(){return {}};export function getApps(){return [{}]};export function getApp(){return {}};";
 const authMock="\n const listeners=[];const user={uid:'fixture-ui-a',email:'fixture@example.invalid',providerData:[{providerId:'password'}],getIdToken:async()=> 'fixture-token',getIdTokenResult:async()=>({claims:{auth_time:Date.now()/1000-(window.fixtureAuthAge||0)}})};\n const auth={currentUser:user};\n export function getAuth(){return auth;}\n export function onAuthStateChanged(a,fn){listeners.push(fn);queueMicrotask(()=>fn(a.currentUser));return ()=>{};}\n export async function signOut(a){a.currentUser=null;for(const fn of listeners)fn(null);}\n export const EmailAuthProvider={credential:(email,password)=>({email,password})};\n export async function reauthenticateWithCredential(){window.fixtureAuthAge=0;}\n export async function reauthenticateWithPopup(){window.fixtureAuthAge=0;}\n export class GoogleAuthProvider{}\n";

 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.hostname==='www.gstatic.com')return route.fulfill({status:200,contentType:'text/javascript',body:url.pathname.includes('firebase-app')?appMock:authMock});
  if(url.origin!==origin)throw Error('Unexpected external request: '+url.origin);
  if(url.pathname!=='/api/privacy')return route.continue();
  const body=request.postDataJSON()||{},action=request.method()==='GET'?'status':body.action;
  calls.push({action,body,authorization:request.headers().authorization});
  let data=state;
  if(action==='grant'){assert.equal(body.health,true);assert.equal(body.terms,true);assert.equal(body.adult,true);state={...state,status:'active',epoch:state.epoch+1,adult:true,health_version:versions.health,terms_version:versions.terms,policy_version:versions.policy};data=state;}
  if(action==='withdraw'){state={...state,status:'withdrawn',epoch:state.epoch+1,cleanup_pending:true};data=state;}
  if(action==='continue-health')data={stage:'external_review'};
  if(action==='delete'){state={...state,status:'deleting',epoch:state.epoch+1};data={receipt:'a'.repeat(64)};}
  if(action==='continue-delete'||action==='deletion-status')data={stage:'external_review',requested_at:'2026-10-15T00:00:00Z'};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 try{
  const page=await context.newPage();await page.goto(origin+'/soukromi');
  await page.locator('#setup-notice').waitFor({state:'visible'});
  assert.equal(await page.locator('#grant-consent').isDisabled(),true);
  state={...state,ready:true};await page.reload();await page.locator('#grant-consent:enabled').waitFor();
  assert.equal(await page.locator('input:checked').count(),0);
  await page.locator('#grant-consent').click();await page.waitForFunction(()=>document.getElementById('privacy-status').textContent.includes('Potvrď'));
  assert.equal(calls.filter(c=>c.action==='grant').length,0);
  for(const id of ['adult-check','terms-check','health-check'])await page.locator('#'+id).check();
  await page.screenshot({path:path.join(out,'consent-mobile.png'),fullPage:true});
  await page.locator('#grant-consent').click();await page.waitForURL('**/launcher');
  assert.equal(calls.filter(c=>c.action==='grant').length,1);
  await page.goto(origin+'/soukromi');await page.locator('#withdraw-consent').waitFor({state:'visible'});
  const other=await context.newPage();await other.goto(origin+'/soukromi');await other.locator('#withdraw-consent').waitFor({state:'visible'});
  await other.evaluate(()=>{window.fixtureBlocked=0;window.addEventListener('chj-privacy-blocked',()=>window.fixtureBlocked++);localStorage.setItem('chj_session_v1:fixture-ui-a','private');localStorage.setItem('chj_session_v1:fixture-ui-b','other');});
  await page.locator('#withdraw-consent').click();await page.locator('#cleanup-notice').waitFor({state:'visible'});
  await other.waitForFunction(()=>window.fixtureBlocked>0);
  assert.equal(await other.evaluate(()=>localStorage.getItem('chj_session_v1:fixture-ui-a')),null);
  assert.equal(await other.evaluate(()=>localStorage.getItem('chj_session_v1:fixture-ui-b')),'other');
  assert.equal(await page.locator('#grant-consent').isDisabled(),true);
  assert.equal(await page.locator('#health-check').isChecked(),false);
  await page.screenshot({path:path.join(out,'withdrawn-mobile.png'),fullPage:true});
  await other.close();
  await page.locator('#show-delete').click();
  await page.locator('#delete-word').fill('NO');await page.locator('#delete-account').click();
  await page.waitForFunction(()=>document.getElementById('privacy-status').textContent.includes('SMAZAT'));
  assert.equal(calls.filter(c=>c.action==='delete').length,0);
  await page.evaluate(()=>window.fixtureAuthAge=3600);
  await page.locator('#delete-word').fill('SMAZAT');await page.locator('#delete-account').click();
  await page.waitForFunction(()=>document.getElementById('privacy-status').textContent.includes('Potvrď své heslo'));
  assert.equal(calls.filter(c=>c.action==='delete').length,0);
  await page.locator('#delete-password').fill('fixture-password-only');await page.locator('#delete-account').click();
  await page.waitForFunction(()=>document.getElementById('deletion-status').textContent.includes('úplný výmaz zatím nepotvrzujeme'));
  assert.equal(calls.filter(c=>c.action==='delete').length,1);
  assert.ok(!JSON.stringify(calls).includes('fixture-password-only'));
  assert.equal(await page.locator('#privacy-controls').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(out,'erasure-pending-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(out,'erasure-pending-desktop.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS offline Chromium: separate unchecked consent, disabled setup, exact grant, cross-tab withdrawal, scoped local cleanup, recent identity, typed erasure and honest pending status; no real accounts or messages.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
