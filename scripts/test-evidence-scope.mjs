// Metadata-only audit correction: freeze pre-change decision fields and numeric policy.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const map = JSON.parse(fs.readFileSync(new URL('../data/engine/intervention-map.json', import.meta.url), 'utf8'));
const descriptive = new Set(['rationale','evidence_refs','evidence_scope','horizon_basis','basis']);
function controls(v) {
 if(Array.isArray(v)) return v.map(controls);
 if(v && typeof v==='object') return Object.fromEntries(Object.keys(v).filter(k=>!descriptive.has(k)).sort().map(k=>[k,controls(v[k])]));
 return v;
}
// Baseline is main 1a0103a79f2cb99884d261ab3a6039811e4f297b, before audit edits.
// This guards IDs, target/protocol/tag/allow lists, ranking grades, mechanisms,
// goals, response directions and every numerical exposure/horizon field.
assert.equal(crypto.createHash('sha256').update(JSON.stringify(controls(map))).digest('hex'),'90d7c85ae2c11eaaf8359f8f6832319d144753f8da685099df04259feb76daf1');
const interventions=Object.values(map.mappings).flatMap(v=>v.interventions);
const responses=interventions.flatMap(i=>i.expected_responses);
assert.equal(responses.length,6);
for(const r of responses) {
 assert.equal(r.minimum_exposure_rule.basis,'INTERNAL_UNVALIDATED');
 assert.equal(r.horizon_basis,'INTERNAL_UNVALIDATED');
 assert.equal(r.evidence_scope,'GENERAL_INTERVENTION_ONLY');
 assert.match(r.minimum_exposure_rule.rationale,/Interní CHJ práh/);
}
const text=JSON.stringify(map);
assert.ok(!/NG147|NG194|Hunter et al., Am J Clin Nutr 2000|nejnižší bezpečná dávka|kratší expozice neprodukuje/.test(text));
assert.ok(text.includes('PMID 11926784')&&text.includes('PMID 11427779')&&text.includes('PMID 23019316')&&text.includes('PMID 10380242')&&text.includes('PMID 15641004'));
for(const path of ['activation.js','inference.js','nextBestAction.js']) assert.ok(!fs.readFileSync(new URL('../api/engine/'+path,import.meta.url),'utf8').includes('NG147'));
console.log('PASS: decision fields and numeric thresholds unchanged; six feedback rules explicitly internal, unsupported dose claims removed and corrected reference IDs retained.');
