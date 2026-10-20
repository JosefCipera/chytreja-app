// Sealed acceptance probe: exact navigation, generalisation and health boundaries.
// No DB, model API or environment credentials. Run inside the restricted container.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
let classifierCalls=0,engineCalls=0;
const mocks={
  '@anthropic-ai/sdk':{default:class {messages={create(){classifierCalls++;throw Error('Classifier called for navigation');}};}},
  './healthEventAdapter.js':{applyHealthEvent(){engineCalls++;throw Error('Unexpected engine write');}},
  './nextBestEvidence.js':{selectNextBestEvidence(){}}, './decisionGate.js':{synthesizePathDiscovery(){}},fs,url,path,
};
const file=new URL('../../api/engine/orchestrator.js',import.meta.url);
const context=vm.createContext({console,process,crypto,Date,Set,Map,JSON});
const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(m){m.url=file.href;}});
await mod.link(spec=>{const v=mocks[spec];assert.ok(v,spec);return new vm.SyntheticModule(Object.keys(v),function(){for(const[k,x]of Object.entries(v))this.setExport(k,x);},{context});});
await mod.evaluate();
const nav=mod.namespace.DOMAIN_REQUEST_NAV_RE;
const positive=['Co mám dělat zítra?','Co mam delat zitra?','Co zítra?', 'Co zitra?', '  CO MÁM UDĚLAT ZÍTRA!  ', 'co mam udelat zitra.', 'Co teď?', 'Poraď mi.'];
const negative=['Co zítra, mám synkopu.','Co mám dělat zítra, bolí mě na hrudi.','Co zítra s angličtinou?','Můj otec má zítra vyšetření.','Zítra mám synkopu.'];
for(const t of positive)assert.ok(nav.test(t.trim()),`Navigation not recognised: ${t}`);
for(const t of negative)assert.ok(!nav.test(t.trim()),`Compound medical/unsupported input swallowed: ${t}`);
// This branch exercises actual processInput without providing a classifier result.
for(const text of positive.slice(0,6)){
  const r=await mod.namespace.processInput('isolated-repair',text,{reported_medical_limitation:true,unsupported_request:{kind:'medical'}});
  assert.equal(r.debug?.reason_code,'SCOPE_HELP',text);
  assert.equal(r.expects_reply,true);
  assert.ok(!r.buttons?.includes('Hotovo'));
}
assert.equal(classifierCalls,0);assert.equal(engineCalls,0);
console.log(JSON.stringify({status:'PASS',positive:positive.length,negative:negative.length,processInput:6,classifierCalls,engineCalls}));
