// Render the real landing HTML/CSS. No sign-in, private account or real form submit.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://fixture').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/app/home-v2.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const data=fs.readFileSync(file),ext=path.extname(file);
 res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'}[ext]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});const context=await browser.newContext();let posts=0;
 await context.route('**/*',r=>{if(r.request().method()==='POST')posts++;return r.request().url().startsWith(base)?r.continue():r.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const out=process.env.AI_TESTER_BROWSER_OUT||'/tmp/chj-landing-alignment';fs.mkdirSync(out,{recursive:true});
 for(const size of [{width:1920,height:1080},{width:1280,height:800},{width:390,height:844}]){
  await page.setViewportSize(size);await page.goto(base+'/');await page.evaluate(()=>document.fonts.ready);
  const layout=await page.evaluate(()=>{
   const selectors={origin:'.origin-story>h2',faq:'#faq-nadpis',directory:'#kontakty-nadpis',form:'#kontakt-nadpis',input:'#contact-name',button:'#contact-submit'};
   return{positions:Object.fromEntries(Object.entries(selectors).map(([k,s])=>[k,document.querySelector(s).getBoundingClientRect().left])),overflow:document.documentElement.scrollWidth-innerWidth,footer:getComputedStyle(document.querySelector('.site-footer')).textAlign};
  });
  for(const [key,x] of Object.entries(layout.positions))assert.ok(Math.abs(x-layout.positions.origin)<2,'Shared content edge '+JSON.stringify({size,key,layout}));
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
 assert.equal(posts,0);assert.deepEqual(errors,[]);
 console.log('PASS: actual Chromium geometry at 1920/1280/390px; origin/FAQ/directory/form/button share left edge; FAQ keyboard works; no overflow; footer centered; no form submissions.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
