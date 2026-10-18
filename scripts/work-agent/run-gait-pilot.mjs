// Controlled checks for one frozen work item. No arbitrary shell, private DB,
// auto-merge, runtime changes or AI calls. AI review is a separate bounded step.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {MATRIX,UNIT,inspectMatrix,digest,deliveryStatus} from './pilot-core.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const option=name=>process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
const catalogPath=option('--catalog'), out=path.resolve(option('--out')??'/tmp/chj-gait-pilot');
const reportsPath=option('--reports');
fs.mkdirSync(out,{recursive:true});
const contract=JSON.parse(fs.readFileSync(path.join(root,'work-items/gait-v1/contract.json'),'utf8'));
if(!catalogPath){console.error('Provide an explicit frozen public --catalog=...');process.exit(2);}
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const actions=Array.isArray(catalog)?catalog:catalog.actions;
if(!Array.isArray(actions)||!actions.length)throw Error('Catalog has no actions');
const normalized=path.join(out,'catalog.json');fs.writeFileSync(normalized,JSON.stringify(actions));
const checks={},raw={},evidence={contract,transcripts:{},source:{}};
function command(id,args){
 const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:12*1024*1024,
   env:{PATH:process.env.PATH??'',LANG:'C.UTF-8',TZ:'UTC'}});
 fs.writeFileSync(path.join(out,id+'.log'),(r.stdout??'')+'\n'+(r.stderr??''));
 return r;
}
for(const[id,file]of Object.entries(UNIT)){
 const r=command(id,['--experimental-vm-modules',file]);
 checks[id]={status:r.status===0?'PASS':r.error?'BLOCKED':'FAIL',exit_code:r.status,reason:r.error?.message??null};
}
for(const[id,def]of Object.entries(MATRIX)){
 if(reportsPath){
  const names={gait:'gait-matrix.json',weight:'weight-loss.json',conversation:'conversation-changes.json',outage:'classifier-outage.json'};
  try{raw[id]=JSON.parse(fs.readFileSync(path.join(reportsPath,names[id]),'utf8'));}catch{}
 }else{
  const r=command(id,['--experimental-vm-modules','scripts/ai-tester/run-gait-matrix.mjs',...(def.flag?[def.flag]:[]),'--catalog='+normalized]);
  try{raw[id]=JSON.parse(r.stdout);}catch{}
 }
 checks[id]=inspectMatrix(raw[id],def);
 if(checks[id].catalog_sha256 && checks[id].catalog_sha256!==digest(JSON.stringify(actions)))checks[id]={status:'FAIL',reason:'Catalog drift'};
 if(raw[id])fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(raw[id],null,2));
}
const liveChecks=['gait','conversation'].map(id=>raw[id]?.mode==='live_classifier_full_engine_public_catalog'&&checks[id].status==='PASS');
const live={status:'BLOCKED',reason:'Injected classifications or historical reports do not prove current language understanding'};
const sourcePaths=spawnSync('git',['ls-files','api/engine','api/orchestrate.js','data/engine','app/launcher.html','app/js/universe/onboarding-wizard.js'],{cwd:root,encoding:'utf8'}).stdout.trim().split('\n').filter(Boolean).sort();
for(const p of sourcePaths)evidence.source[p]={sha256:digest(fs.readFileSync(path.join(root,p)))};
const source_sha256=digest(JSON.stringify(evidence.source));
const sha=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
if(reportsPath && liveChecks.every(Boolean) && process.env.GITHUB_ACTIONS==='true' && process.env.GITHUB_SHA===sha){live.status='PASS';live.reason=null;}
const dirty=spawnSync('git',['status','--porcelain','--','api','app','data','scripts','work-items'],{cwd:root,encoding:'utf8'}).stdout.trim().length>0;
const selected={gait:new Set(['spoken-1','third-person','historical','hypothetical','tester137-profile','low-strength','recent-fall','knee-unknown','knee-severe','combined','journey-repeat']),conversation:new Set(['stable-gait-correction','medical-conversation-open','medical-session-after-skip','return-after-done','unsupported-topic-return'])};
for(const id of ['gait','conversation']){
 evidence.transcripts[id]=(raw[id]?.results??[]).filter(c=>selected[id].has(c.id)).map(c=>({id:c.id,status:c.status,profile:c.profile,physical:c.physical,constraints:c.constraints,classification:c.classification,candidate_safety:c.candidate_safety,leverage:c.leverage,review:c.product_review,
  turns:(c.turns??[]).map(t=>({input:t.input,mode:t.mode,text:t.text,reason:t.debug?.reason_code}))}));
}
const report={task:contract.id,contract_version:contract.version,created_at:new Date().toISOString(),commit:sha,dirty,
 source_sha256,origin:reportsPath?{kind:'current_github_job',run_id:process.env.GITHUB_RUN_ID??null,verified:live.status==='PASS'}:{kind:'local_injected',verified:false},catalog_sha256:digest(JSON.stringify(actions)),checks,live,
 open_decisions:contract.open_decisions,review:null,
 delivery_status:deliveryStatus({checks,live,decisions:contract.open_decisions}),
 limitations:['Synthetic users and writes; actual auth is mocked','No phone/ASR/independent human acceptance','No clinical approval or proof of every possible input','CLI coordinates existing checks; Codex still performs repairs; this is not a self-running general coding service']};
evidence.report=report;
// Small, explicit source bundle for independent content review; no credentials,
// user records, environment files or arbitrary repository upload.
const sources=['scripts/work-agent/pilot-core.mjs','work-items/gait-v1/contract.json','docs/FOUR-ENTRY-ACTIONS-CLINICAL-REVIEW-2026-10-14.md'];
for(const p of sources)evidence.source[p]={text:fs.readFileSync(path.join(root,p),'utf8')};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'review-bundle.json'),JSON.stringify(evidence));
const lines=['# Pilot: nejistota při chůzi',`Stav: **${report.delivery_status}**`, `Commit: ${sha}; pracovní změny: ${dirty}`,`Jazyková evidence: ${live.status}`,'',
 ...Object.entries(checks).map(([id,c])=>`- ${id}: ${c.status}${c.counts?' '+JSON.stringify(c.counts):''}`),'','## Rozhodnutí',...contract.open_decisions.map(d=>`- ${d.id} (${d.status}): ${d.question}`),'','Žádné nové nasazení ani úpravy účtů tímto během neproběhly.'];
fs.writeFileSync(path.join(out,'summary.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({status:report.delivery_status,out,checks:Object.fromEntries(Object.entries(checks).map(([k,v])=>[k,v.status])),live:live.status}));
// NEEDS_DECISION is a completed assessment, not a product release approval.
process.exitCode=Object.values(checks).some(c=>c.status==='FAIL')?1:live.status!=='PASS'?2:0;
