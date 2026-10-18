import { computeNextBestAction } from '../api/engine/nextBestAction.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const context = vm.createContext({console, process: {...process, exit(code) {assert.equal(code,0);}}, crypto, Date, Set, Map, JSON});
const mocks={'@anthropic-ai/sdk': {default:class {}}, './healthEventAdapter.js': {applyHealthEvent(){throw Error('DB must not run');}}, './nextBestEvidence.js': {selectNextBestEvidence(){}}, './decisionGate.js':{synthesizePathDiscovery(){}}, fs,url,path};
const file=new URL('../api/engine/orchestrator.js',import.meta.url);
const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file.href,initializeImportMeta(meta){meta.url=file.href;}});
await mod.link(spec=>{const values=mocks[spec]; assert.ok(values,spec);return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});});
await mod.evaluate();
for(const name of ['test-why-response-subject.mjs','test-dnes-trajectory-mechanism.mjs']){
 const test=new vm.SourceTextModule(fs.readFileSync(new URL(name,import.meta.url),'utf8'),{context});
 await test.link(()=>mod); await test.evaluate();
}
const {_buildActResponse_test:act,_buildWhyResponse_test:why,_buildMechanismResponse_test:mechanism,_localizeMod_test:localize}=mod.namespace;
const mods=['Use stable wall or chair support for all single-leg variants','Keep eyes open throughout','Stop if pain, dizziness, or loss of balance occurs','Supervised or near-support setting for first sessions'];
const action={label:'Stůj 30 sekund na jedné noze.',intervention_id:'BALANCE_TRAINING',mechanism_targets:['GAIT_INSTABILITY','FALL_RISK'],goal_impact:{branches:['FUNCTIONAL_INDEPENDENCE','SURVIVAL_HEALTHSPAN']},safety:{level:'SAFE_WITH_MODIFICATION',modifications_suggested:[...mods,mods[0]]}};
const r=act({primary_item:action},{},{},[]);
assert.ok(r.text.startsWith(action.label+' '));
assert.ok(!r.text.includes('..')&&!r.text.includes('Úprava:'));
for(const m of mods)assert.ok(r.text.includes(localize(m)));
assert.equal(r.text.split(localize(mods[0])).length,2);
assert.ok(!/Oči zavři/.test(r.text), 'Entry balance instructions must not prescribe closing eyes');
const legacy = act({ primary_item: { ...action, safety: { level: 'SAFE_WITH_MODIFICATION', modifications_suggested: ['Begin with eyes-open only; progress to eyes-closed only when stable'] } } }, {}, {}, []);
assert.ok(!/Oči zavři/.test(legacy.text), 'Legacy cached instruction must not prescribe closing eyes');
assert.ok(/oči otevřené/.test(legacy.text));
assert.equal(r.mode,'ACT');assert.equal(r.buttons.join(','),'Hotovo,Přeskočit');
assert.ok(r.text.length < 265, 'Mobile entry instruction retains four safety conditions concisely');
const session={current_action_assignment:{action_id:'test'},last_domain_response:{explanation_context:{system_leverage:{node_id:'GAIT_INSTABILITY'},action_context:{selected:action}}}};
const reason=why(session);
assert.ok(reason.text.includes('jistotu při chůzi'));
assert.ok(!reason.text.includes('nejvíc')&&!reason.text.includes('opěradla')&&!reason.text.includes('Úprava'));
const proxySession = structuredClone(session);
proxySession.person_goal = 'WEIGHT_LOSS';
const proxyContext = proxySession.last_domain_response.explanation_context;
proxyContext.system_priority = { node_id: 'EXCESS_ADIPOSITY' };
proxyContext.action_fallback = { status: 'SELECTED' };
proxyContext.leverage_evidence = { direct: [], inferred_from_nodes: [
  { node_id: 'LOW_MUSCLE_STRENGTH', current_state: 'MEASURED' },
  { source: 'ONBOARDING', question_id: 'rovnovaha_zavrene_oci', value: false },
] };
const proxyWhy = why(proxySession);
assert.ok(/Údaje o síle a rovnováze/.test(proxyWhy.text));
assert.ok(/Samy nepotvrzují nejistotu při běžné chůzi/.test(proxyWhy.text));
assert.ok(!/Uvádíš nejistotu|Proto.*jistotu při chůzi/.test(proxyWhy.text));
assert.match(proxyWhy.text, /Aktivita zaměřená na množství tělesného tuku teď nesplňuje bezpečnostní podmínky/);
assert.doesNotMatch(proxyWhy.text, /Chceš zhubnout|hlavní prioritu/);
assert.ok(/Samotné hubnutí tento krok neřeší/.test(proxyWhy.text));
assert.ok(proxyWhy.text.length < 350, 'Concise fallback preserves reason and scope');
for (const report of [
  { question_id: 'gait_instability_reported', value: true },
  { question_id: 'gait_stability', value: ' NE ' },
]) {
  const adverse = structuredClone(proxySession);
  adverse.last_domain_response.explanation_context.leverage_evidence.inferred_from_nodes.push(report);
  assert.ok(!why(adverse).text.includes('Samy nepotvrzují'), 'An actual adverse report is not denied');
  assert.ok(why(adverse).text.includes('Uvádíš nejistotu při chůzi.'), 'Use actual walking report before eyes-closed proxy');
  assert.ok(!why(adverse).text.includes('se zavřenýma očima'), 'Do not substitute a different balance task for the walking report');
}
const confirmed = structuredClone(proxySession);
confirmed.last_domain_response.explanation_context.leverage_evidence.direct.push({ obs_type: 'gait_assessment', value: 'abnormal' });
assert.ok(!why(confirmed).text.includes('Samy nepotvrzují'), 'Direct gait assessment is not denied');
console.log('PASS: inferred balance WHY exposes combined sources, remains conditional and concise, retains actual adverse reports and direct findings.');
assert.ok(mechanism(session).text.includes('při pravidelném opakování může pomoci'));
assert.equal(localize('Avoid Valsalva (breath-holding during exertion)'),'Nezadržuj dech při cvičení');
console.log('PASS: balance dose unchanged, all safety conditions once, no duplicate WHY instructions, conditional repeated benefit.');

const chairCopy = JSON.parse(fs.readFileSync(new URL('../data/engine/action-instructions.json', import.meta.url), 'utf8')).sit_to_stand_supported.label;
const chairSession = label => ({
  current_action_assignment: {action_id:'sit_to_stand_supported'},
  last_domain_response: {explanation_context:{action_context:{selected:{
    label, intervention_id:'FUNCTIONAL_STRENGTH_TRAINING',
    mechanism_targets:['LOW_MUSCLE_STRENGTH','REDUCED_FUNCTIONAL_RESERVE'],
  }}}},
});
const expectedBenefit = 'Cvičení ti při pravidelném opakování může pomoci zvýšit svalovou sílu a zlepšit schopnost zvládat běžné fyzické úkony.';
for(const label of [chairCopy,'5× pomalu vstaň ze židle','Pomalu vstaň ze židle','Vstávání ze židle']){
  assert.equal(mechanism(chairSession(label)).text, expectedBenefit);
}
const unknownInstruction = chairSession(chairCopy);
unknownInstruction.last_domain_response.explanation_context.action_context.selected.intervention_id='UNKNOWN_TYPE';
assert.ok(mechanism(unknownInstruction).text.startsWith('Tato akce ti '));
assert.ok(!mechanism(unknownInstruction).text.includes(chairCopy));
console.log('PASS: actual catalog instruction (numeric, multi-sentence) never becomes an explanation subject; known type independent of label, unknown instruction falls back safely.');


const balanceMappings = JSON.parse(fs.readFileSync(new URL('../data/engine/intervention-map.json', import.meta.url))).mappings.GAIT_INSTABILITY.interventions;
const baseAction = { id: 'supported-balance-fixture', label: 'Stůj na jedné noze 30 sekund', protocol_type: 'BALANCE_PROTOKOL', type: 'timed', duration: 30, reps: null, tier: 1, intensity: 'LIGHT', tags: [], constraint_exclude: [] };
const advanced = [
  { id: '85b4146c-13ae-45ee-b7c7-0f0d253282cf', label: 'Stand eyes closed' },
  { id: 'rovnovaha_stoj_2', label: 'Stůj se zavřenýma očima' },
  { id: '0a6f4105-4861-4250-b988-c148e8143513', label: 'Stoj na nestabilní podložce' },
  { id: 'future-unreviewed-variant', label: 'Stůj na jedné noze se zavřenýma očima' },
].map(a => ({ ...baseAction, ...a }));
const result = computeNextBestAction({ leverageNodeId: 'GAIT_INSTABILITY', interventions: balanceMappings,
  actionPool: [baseAction, ...advanced], personConstraints: [],
  clinicalHistory: { clinical_history_documented: true, onboarding_inputs: { gait_stability: false } },
  decisionGate: { context_gates: [] }, node_states: [{ node_id: 'GAIT_INSTABILITY', current_state: 'PREDICTED_CURRENT' }], engineVersion: '1.0.0' });
assert.equal(result.selected.action_id, baseAction.id);
for (const a of advanced) {
  const matches = result.all_candidates.filter(c => c.action_id === a.id);
  assert.ok(matches.length > 0);
  assert.ok(matches.every(c => c.safety.level === 'NEEDS_CLINICAL_CLEARANCE'));
}
assert.ok(result.selected.safety.modifications_suggested.includes('Keep eyes open throughout'));
assert.ok(!result.selected.safety.modifications_suggested.some(m => /progress to eyes-closed/.test(m)));
console.log('PASS: closed-eye and unstable-surface variants require assessment; entry instructions keep eyes open.');

// Relevant joint-load advice must also survive SAFE presentation. Eligibility,
// hard exclusions and the severity grid remain unchanged.
const activityFixtures = [
 { id: 'walking-joint-fixture', label: 'Svižná chůze nebo kolo', protocol_type: 'KARDIO_PROTOKOL', tags: ['kardio'], aerobic: true },
 { id: 'chair-joint-fixture', label: 'Vstaň ze židle', protocol_type: 'FUNKCNI_SILOVY_PROTOKOL', tags: ['nohy'], aerobic: false },
 { id: 'balance-joint-fixture', label: 'Stůj na jedné noze', protocol_type: 'BALANCE_PROTOKOL', tags: [], aerobic: false },
 { id: 'cycling-joint-fixture', label: 'Jízda na kole', protocol_type: 'KARDIO_PROTOKOL', tags: ['kardio'], aerobic: false },
 { id: 'daily-walk-joint-fixture', label: 'Jdi na procházku', protocol_type: 'TRAINING_PROTOKOL', tags: ['kardio'], aerobic: true },
 { id: 'trunk-joint-fixture', label: 'Trunk exercise', protocol_type: 'TRAINING_PROTOKOL', tags: ['sila','nohy'], aerobic: false },
];
function jointCandidate(a, severity, intensity = 'LIGHT', more = []) {
 const fixture = { ...baseAction, ...a, intensity };
 const interventionId = fixture.protocol_type === 'TRAINING_PROTOKOL'
   ? (fixture.tags.includes('kardio') ? 'DAILY_MOVEMENT' : 'RESISTANCE_TRAINING') : 'JOINT_TEXT_FIXTURE';
 const r = computeNextBestAction({ leverageNodeId:'LOW_MUSCLE_STRENGTH',
  interventions:[{id:interventionId,protocol_types:[fixture.protocol_type],mechanism_targets:['LOW_MUSCLE_STRENGTH'],goal_branches:[]}],
  actionPool:[fixture], personConstraints:[{constraint_value:'kotník',severity},...more],
  clinicalHistory:{clinical_history_documented:true,onboarding_inputs:{}}, decisionGate:{context_gates:[]}, node_states:[],engineVersion:'1.0.0' });
 return r.all_candidates[0];
}
for (const fixture of activityFixtures) {
 for (const [severity,intensity,level] of [
  ['mild','LIGHT','SAFE'],['mild','MODERATE','SAFE'],['mild','VIGOROUS','SAFE_WITH_MODIFICATION'],
  ['moderate','LIGHT','SAFE_WITH_MODIFICATION'],['moderate','VIGOROUS','NEEDS_CLINICAL_CLEARANCE'],
  ['severe','LIGHT','NEEDS_CLINICAL_CLEARANCE'],[null,'LIGHT','NEEDS_MORE_EVIDENCE'],
 ]) {
  const candidate = jointCandidate(fixture,severity,intensity);
  assert.equal(candidate.safety.level,level, 'Text changes cannot relax the severity grid');
  if (severity === 'mild') {
   const advice = candidate.safety.modifications_suggested.join(' ');
   assert.equal(/cycling/.test(advice),fixture.aerobic, 'Cycling examples belong only to locomotor aerobic activities');
   const shown = act({primary_item:candidate},{},{},[]).text;
   assert.ok(shown.includes(intensity === 'VIGOROUS' ? 'Přestaň, pokud bolest zesílí' : 'Přestaň, pokud nepříjemný pocit zesílí'));
   assert.ok(!/Prefer |Stop if/.test(shown), 'Advice is localized');
   if(!fixture.aerobic) assert.ok(!/kole|běhu/.test(shown.slice(shown.indexOf('.')+1)), 'No unrelated cycling/running instruction');
  }
 }
 assert.equal(jointCandidate(fixture,'mild','LIGHT',[{constraint_value:'kotník',severity:'severe'}]).safety.level,'NEEDS_CLINICAL_CLEARANCE');
 assert.equal(jointCandidate({...fixture,constraint_exclude:['ankle_foot']},'mild').safety.level,'CONTRAINDICATED');
}
const safeAdvice = act({primary_item:{label:'Testovací aktivita',safety:{level:'SAFE',modifications_suggested:['Stop if discomfort increases','Stop if discomfort increases']}}},{},{},[]);
assert.equal(safeAdvice.text.split('Přestaň, pokud nepříjemný pocit zesílí').length,2,'SAFE advice is rendered once');
console.log('PASS: SAFE advice visible once, locomotor examples relevant, mild/moderate/severe/unknown and combined constraints retain safety levels.');

// The actual reported walking scenario: WHY must name the unavailable focus,
// retain the user's evidence, and never claim the fallback is a weight-loss plan.
const reported = structuredClone(proxySession);
reported.last_domain_response.explanation_context.leverage_evidence = {direct:[{question_id:'gait_instability_reported',value:true}]};
const reportedWhy = why(reported).text;
assert.match(reportedWhy, /množství tělesného tuku/);
assert.match(reportedWhy, /Uvádíš nejistotu při chůzi/);
assert.match(reportedWhy, /Samotné hubnutí tento krok neřeší/);
const normalWeight = structuredClone(reported);
normalWeight.last_domain_response.explanation_context.system_leverage = {node_id:'EXCESS_ADIPOSITY'};
normalWeight.last_domain_response.explanation_context.action_fallback = null;
assert.doesNotMatch(why(normalWeight).text, /Chceš zhubnout|bezpečnostní podmínky/);

// Tomorrow navigation is deterministic, but compound health/unsupported inputs
// must remain outside the exact navigation guard.
for (const text of ['Co mám dělat zítra?', 'Co mam delat zitra?', 'Co zítra?', 'Co zitra?', 'Co mám udělat zítra?']) {
  assert.ok(mod.namespace.DOMAIN_REQUEST_NAV_RE.test(text), text);
}
for (const text of ['Co mám dělat zítra, bolí mě na hrudi.', 'Co zítra s angličtinou?', 'Co zítra, mám synkopu.']) {
  assert.ok(!mod.namespace.DOMAIN_REQUEST_NAV_RE.test(text), text);
}
