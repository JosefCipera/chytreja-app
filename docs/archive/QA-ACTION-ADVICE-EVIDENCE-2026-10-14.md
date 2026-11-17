# Audit corrections: activity advice and evidence scope — 2026-10-14

The confirmed joint-load text defect and inaccurate evidence claims are corrected in this change. Catalog doses, intensity limits, hard exclusions, severity levels, node activation rules, intervention order, target/goal mappings, response directions and every numeric exposure/horizon remain unchanged.

## User-visible advice

`evaluateJointLoad` limits cycling-over-running examples to locomotor aerobic actions. Strength, chair, balance and cycling-only tasks receive activity-relative lower-load wording instead. Existing stopping/reduced-intensity conditions remain. ACT now displays already-computed advisory modifications under SAFE as well as SAFE_WITH_MODIFICATION, localized and deduplicated. This exposes existing advice; it neither grants clinical clearance nor downgrades a safety level.

New regression cases cover four activity families, mild/moderate/severe/unknown limits at different intensities, the most restrictive combined constraint, hard exclusions, localized SAFE advice and duplicate suppression. Synthetic fixtures test code contracts, not individual exercise suitability.

## Evidence metadata

Six response rules now carry `horizon_basis=INTERNAL_UNVALIDATED`, `minimum_exposure_rule.basis=INTERNAL_UNVALIDATED` and `evidence_scope=GENERAL_INTERVENTION_ONLY`. They retain every existing numerical value and ranking grade. These are audit metadata, not a new runtime evaluator: they do not make the thresholds valid and do not change when the engine evaluates a response. Their rationale no longer claims that 5/7 days, 10 sessions, or 3–6 weeks were established by the referenced studies. A baseline projection fingerprint freezes all decision fields and numbers at main `1a0103a79f2cb99884d261ab3a6039811e4f297b`.

Leverage rationales no longer call the five-chair-rise task a minimum safe dose, the onboarding answer a confirmed diagnosis, the balance option universal treatment for gait instability, or a device a guarantee of safe movement. Unverified subgroup, NEAT percentage and sarcopenia/diet claims are removed from these descriptions. This is not a review or change of all modeled causal edges.

Incorrect NICE NG147 and NG194 references are removed. NICE NG249 is retained only for individualized falls-prevention programmes; a device assessment after any reported fall is explicitly an internal conservative CHJ policy, not a NICE mandate. Likewise the FALL_RISK CONFIRMED label is an internal model rule. No safety gate is loosened. TUG missing-evidence notes no longer claim that NICE validates that named test.

Bibliographic corrections were checked against primary records:

- Whelton et al., Ann Intern Med 2002: https://pubmed.ncbi.nlm.nih.gov/11926784/
- Ross & Janssen, Med Sci Sports Exerc 2001: https://pubmed.ncbi.nlm.nih.gov/11427779/
- Willis et al., J Appl Physiol 2012: https://pubmed.ncbi.nlm.nih.gov/23019316/
- Jones, Rikli & Beam, chair-stand assessment test: https://pubmed.ncbi.nlm.nih.gov/10380242/ . Test validation is not evidence for five training repetitions.
- Bateni & Maki, Arch Phys Med Rehabil 2005: https://pubmed.ncbi.nlm.nih.gov/15641004/
- Sherrington et al., Cochrane 2019: https://pubmed.ncbi.nlm.nih.gov/30703272/
- NICE individualized programme guidance: https://www.nice.org.uk/guidance/ng249/chapter/Recommendations/ (1.3.9–1.3.10).

The unverified Hunter reference is removed, not replaced by a guessed paper. General intervention references remaining in the map do not approve individual catalog actions or the feedback thresholds. No exercise dose or public database catalog row was edited; no private profile was accessed or reset. The source audit in ENTRY-ACTIONS-AUDIT-ACCEPTANCE-2026-10-14.md and individual dose questions remain distinct from these completed software corrections.
