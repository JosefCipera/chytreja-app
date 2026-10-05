import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../app/launcher.html', import.meta.url), 'utf8');
const render = html.slice(html.indexOf('  function render(response)'), html.indexOf('  // ── Orchestrate'));
const loading = html.slice(html.indexOf('  function setLoading(on)'), html.indexOf('  function setLoading(on)') + 1000);
// Extract the actual function, respecting nested braces.
function functionBody(source) {
  let depth = 0; let seen = false;
  for(let i=0;i<source.length;i++) { if(source[i]==='{') { depth++; seen=true; } else if(source[i]==='}' && --depth===0 && seen) return source.slice(0,i+1); }
  throw new Error('Missing function');
}
const element = () => ({disabled: false, classList:{add(){},remove(){}},focus(){},appendChild(){},addEventListener(){}});
const nodes = Object.fromEntries(['$orb','$stageSub','$stageLabel','$stage','$chips','$input','$sendBtn','$micBtn'].map(k=>[k,element()]));
const ctx = vm.createContext({...nodes, _terminalState:false, _debugMode:false, setBadge(){}, document:{createElement:element}});
vm.runInContext(render + '\n' + functionBody(loading),ctx);
for (const reason of ['HOLD_DONE_TODAY','HOLD_SKIPPED_TODAY']) {
  ctx.response={mode:'HOLD',text:'Test',buttons:[],expects_reply:false,debug:{reason_code:reason}};
  vm.runInContext('render(response); setLoading(false);',ctx);
  for(const name of ['$input','$sendBtn','$micBtn']) assert.equal(nodes[name].disabled,false,name+' locked after '+reason);
  assert.equal(nodes.$stageLabel.textContent,reason==='HOLD_DONE_TODAY'?'✓':'');
  vm.runInContext('setLoading(true);',ctx);
  assert.equal(nodes.$input.disabled,true,'Input must lock during request');
  vm.runInContext('setLoading(false);',ctx);
  assert.equal(nodes.$input.disabled,false,'Input must unlock after request');
}
ctx.response={mode:'SAFETY_CRITICAL',text:'Test',buttons:[],expects_reply:false};
vm.runInContext('render(response); setLoading(false);',ctx);
assert.equal(nodes.$input.disabled,true,'Safety terminal behavior unchanged');
console.log('PASS: actual launcher render/loading functions; HOLD input unlocked, busy locked, skipped checkmark removed, safety unchanged.');
