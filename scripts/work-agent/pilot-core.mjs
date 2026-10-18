import crypto from 'node:crypto';
export const MATRIX = {
  gait:{suite:'gait',flag:null,minCases:25},
  weight:{suite:'weight_loss_endpoint',flag:'--weight-loss',minCases:25},
  conversation:{suite:'conversation_changes_endpoint',flag:'--conversation-changes',minCases:10},
  outage:{suite:'classifier_outage_endpoint',flag:'--classifier-outage',minCases:6},
};
export const UNIT = {
  'pilot-evidence':'scripts/work-agent/test-pilot.mjs',
  'personal-goal':'scripts/test-personal-goal.mjs', why:'scripts/test-why-control.mjs',
  copy:'scripts/test-action-copy.mjs', medical:'scripts/test-medical-scope-session.mjs',
  launcher:'scripts/test-launcher-hold-input.mjs', onboarding:'scripts/test-onboarding-combinations.mjs',
  skip:'scripts/test-skip-progression.mjs', exhaustion:'scripts/test-skipped-exhaustion.mjs',
  fallback:'scripts/test-leverage-fallback.mjs', mutation:'scripts/test-crt-contract-mutations.mjs',
};
export function inspectMatrix(report, definition) {
  if (!report || report.suite!==definition.suite || !Array.isArray(report.results)
      || report.results.length<definition.minCases || new Set(report.results.map(c=>c.id)).size!==report.results.length)
    return {status:'BLOCKED',reason:'Missing, truncated or wrong suite'};
  const counts={PASS:0,FAIL:0,BLOCKED:0};
  for(const c of report.results){
    if(!Object.hasOwn(counts,c.status)) return {status:'BLOCKED',reason:'Invalid case status'};
    counts[c.status]++;
    if(c.status==='PASS' && (!Array.isArray(c.checks)||!c.checks.length||c.checks.some(x=>x.status!=='PASS')))
      return {status:'FAIL',reason:'PASS case contradicts its checks'};
  }
  if(JSON.stringify(counts)!==JSON.stringify({PASS:report.counts?.PASS,FAIL:report.counts?.FAIL,BLOCKED:report.counts?.BLOCKED}))
    return {status:'FAIL',reason:'Case counts disagree'};
  return {status:counts.FAIL?'FAIL':counts.BLOCKED?'BLOCKED':'PASS',counts,mode:report.mode,
    catalog_sha256:report.catalog?.sha256??null};
}
export function digest(value){return crypto.createHash('sha256').update(value).digest('hex');}
export function deliveryStatus({checks,live,decisions,review}){
  if(Object.values(checks).some(x=>x.status==='FAIL'))return 'NEEDS_REPAIR';
  if(Object.values(checks).some(x=>x.status!=='PASS')||live.status!=='PASS')return 'BLOCKED_EVIDENCE';
  if(!review||review.verdict==='BLOCKED')return 'AWAITING_INDEPENDENT_REVIEW';
  const unresolved=(review.findings??[]).filter(f=>f.severity!=='MINOR');
  if(review.verdict==='RETURN'||unresolved.length)return unresolved.some(f=>['code_change','more_evidence'].includes(f.resolution))?'NEEDS_REPAIR':'NEEDS_DECISION';
  if(decisions.some(x=>x.status==='OPEN'))return 'NEEDS_DECISION';
  return 'CANDIDATE_FOR_JOSEF';
}

export function validateReview(value, {acceptanceIds,evidenceRefs}) {
  if(!value || !['ACCEPT','RETURN','BLOCKED'].includes(value.verdict) || !Array.isArray(value.findings) || typeof value.summary!=='string') throw Error('Malformed review');
  for(const f of value.findings){
    if(!['BLOCKER','MAJOR','MINOR'].includes(f.severity)||!['code_change','product_decision','clinical_decision','more_evidence'].includes(f.resolution)
      || !acceptanceIds.includes(f.acceptance_id)||!evidenceRefs.includes(f.evidence_ref)||typeof f.explanation!=='string'||!f.explanation.trim())throw Error('Unverifiable review finding');
  }
  if(value.verdict==='ACCEPT'&&value.findings.some(f=>f.severity!=='MINOR'&&['code_change','more_evidence'].includes(f.resolution)))throw Error('ACCEPT contradicts unresolved findings');
  if(value.verdict==='RETURN'&&!value.findings.length)throw Error('RETURN without a concrete finding');
  return value;
}
