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
 const authMock=String.raw