// Render the real landing HTML/CSS. No sign-in, private account or real form submit.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://fixture').pathname);
 const routes={'/':'/app/home-v2.html','/obchodni-podminky':'/app/obchodni-podminky.html','/ochrana-osobnich-udaju':'/app/ochrana-osobnich-udaju.html','/cookies':'/app/cookies.html'};
 const file=path.resolve(root,'.'+(routes[pathname]||pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const data=fs.readFileSync(file),ext=path.extname(file);
 res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'}[ext]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({reducedMotion:'reduce'});let posts=0;
 await context.route('**/*',r=>{if(r.request().method()==='POST')posts++;return r.request().url().startsWith(base)?r.continue():r.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const out=process.env.AI_TESTER_BROWSER_OUT||'/tmp/chj-landing-alignment';fs.mkdirSync(out,{recursive:true});
 for(const size of [{width:1920,height:1080},{width:1280,height:800},{width:1024,height:800},{width:768,height:1024},{width:390,height:844}]){
  await page.setViewportSize(size);await page.goto(base+'/');await page.evaluate(()=>document.fonts.ready);
  const toggle=page.locator('.home-menu-toggle'),nav=page.locator('.home-nav');
  const mobile=size.width<=1050;
  assert.equal(await toggle.isVisible(),mobile);
  assert.equal(await nav.locator('a').allTextContents().then(x=>x.join('|')),'Jak to funguje|Proč Chytré já|Zakladatelé|Časté otázky|Kontakt|Přihlásit se');
  assert.equal(await page.locator('.home-login').getAttribute('href'),'/login');
  if(mobile){
   assert.equal(await nav.isVisible(),false);
   await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   assert.equal(await toggle.evaluate(e=>document.activeElement===e),true);
  }else{
   assert.ok(await page.locator('.home-login').evaluate(e=>parseFloat(getComputedStyle(e).marginLeft))>=32);
  }
  for(const id of ['jak-to-funguje','o-mne','zakladatele','faq','kontakt']){
   if(mobile)await toggle.click();
   await nav.locator('a[href="#'+id+'"]').click();
   if(mobile)assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   const target=await page.locator('#'+id).evaluate(e=>({top:e.getBoundingClientRect().top,headerBottom:document.querySelector('.home-header').getBoundingClientRect().bottom}));
   assert.ok(target.top>=target.headerBottom-1,'Anchor visible below sticky header '+JSON.stringify({size,id,target}));
   assert.ok(Math.abs(await page.locator('.home-header').evaluate(e=>e.getBoundingClientRect().top))<1);
  }
  await page.screenshot({path:path.join(out,'navigation-'+size.width+'.png')});
  const layout=await page.evaluate(()=>{
   const selectors={origin:'.origin-story>h2',faq:'#faq-nadpis',directory:'#kontakty-nadpis',form:'#kontakt-nadpis',input:'#contact-name',button:'#contact-submit',list:'.faq-list',details:'.contact-directory dl',formBody:'#contact-form'};
   const rect=s=>document.querySelector(s).getBoundingClientRect();
   return{gapAboveContacts:rect('#kontakty-nadpis').top-rect('.faq-list').bottom,gapAfterContacts:rect('#kontakt-nadpis').top-rect('.contact-directory dl').bottom,referenceWidth:document.querySelector('.origin-story>h2').getBoundingClientRect().width,bodyWidth:document.querySelector('.faq-list').getBoundingClientRect().width,positions:Object.fromEntries(Object.entries(selectors).map(([k,s])=>[k,document.querySelector(s).getBoundingClientRect().left])),overflow:document.documentElement.scrollWidth-innerWidth,footer:getComputedStyle(document.querySelector('.site-footer')).textAlign};
  });
  for(const key of ['origin','faq','directory','form','formBody','input','button'])assert.ok(Math.abs(layout.positions[key]-layout.positions.origin)<2,'Section heading edge '+JSON.stringify({size,key,layout}));
  for(const key of ['list','details'])assert.ok(Math.abs(layout.positions[key]-layout.positions.list)<2,'Inset body edge '+JSON.stringify({size,key,layout}));
  assert.ok(layout.gapAboveContacts>=(size.width<=700?140:220),'Whitespace above contacts '+JSON.stringify(layout));
  assert.ok(layout.gapAfterContacts>=(size.width<=520?96:140),'Whitespace before form '+JSON.stringify(layout));
  assert.equal(await page.locator('.contact-directory a[href^="tel:"]').count(),0);
  for(const phone of ['+420 724 166 988','+420 723 999 152'])assert.ok((await page.locator('.contact-directory').innerText()).includes(phone));
  assert.ok(layout.bodyWidth<=721,'Narrow content column');
  assert.ok(Math.abs(layout.positions.list+layout.bodyWidth/2-layout.positions.origin-layout.referenceWidth/2)<2,'Bodies centered within wider heading section');
  if(size.width>=1100)assert.ok(layout.positions.list>layout.positions.origin+100,'Desktop bodies visibly inset from headings');
  assert.ok(layout.overflow<=1,'No horizontal overflow '+JSON.stringify({size,layout}));
  assert.equal(layout.footer,'center');
  const faq=page.locator('#faq-q1');await faq.focus();await faq.press('Enter');assert.equal(await faq.getAttribute('aria-expanded'),'true');assert.equal(await page.locator('#faq-a1').isVisible(),true);
  await faq.press('ArrowDown');assert.equal(await page.locator('#faq-q2').evaluate(e=>document.activeElement===e),true);
  await page.locator('#faq-q2').press('Space');assert.equal(await page.locator('#faq-q1').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#faq-q2').getAttribute('aria-expanded'),'true');
  for(const address of ['info','podpora','obchod','uctarna'])assert.equal(await page.locator('.contact-directory a[href="mailto:'+address+'@iting.cz"]').count(),1);
  await page.locator('.contact-directory').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'contacts-'+size.width+'.png')});
  await page.locator('#kontakt-nadpis').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'form-'+size.width+'.png')});
  console.log('PASS landing layout '+JSON.stringify({size,...layout}));
 }
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:844});
  for(const route of ['/obchodni-podminky','/ochrana-osobnich-udaju']){
   const response=await page.goto(base+route);assert.equal(response.status(),200);
   await page.locator('h1').waitFor();
   assert.ok((await page.title()).includes('Chytré já'));
   assert.equal(await page.locator('.draft-notice').count(),1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Legal page must fit viewport');
   for(const link of await page.locator('.legal-toc a').all()){
    const hash=await link.getAttribute('href');await link.click();
    const position=await page.locator(hash).evaluate(e=>({top:e.getBoundingClientRect().top,header:document.querySelector('.legal-header').getBoundingClientRect().bottom}));
    assert.ok(position.top>=position.header-1,'Legal anchor visible '+JSON.stringify({route,width,hash,position}));
   }
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:path.join(out,'legal-'+route.slice(1)+'-'+width+'.png')});
   for(const href of await page.locator('.legal-footer a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))){
    assert.equal((await page.request.get(base+href.split('#')[0])).status(),200,'Legal navigation '+href);
   }
   await page.locator('.legal-header .brand').click();await page.waitForURL(base+'/#top');
  }
 }
 assert.equal(posts,0);assert.deepEqual(errors,[]);
 console.log('PASS: draft legal pages fit mobile/desktop; table scrolling contained; anchors below header; return and policy links resolve. Rendering checks do not validate legal sufficiency.');
 console.log('PASS: actual Chromium geometry at 1920/1280/390px; section headings share outer left edge; FAQ/directory bodies remain inset; whole form shares heading left edge; contacts have whitespace above and below; phones are plain text; FAQ keyboard works; no overflow; footer centered; no form submissions.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
