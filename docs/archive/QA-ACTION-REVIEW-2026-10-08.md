# CHJ action and dose review — 2026-10-08

Base: main `455028a1375e2fb1d107acbb155bdb236f13bf28`. Public active catalog fetched read-only on 2026-10-08: 152 rows. Snapshot fingerprint (Python JSON with sorted keys): fd9365df37f7cd82db055a9bdc0baed16007ed6a42ef83e23cbefe1f743553bf.

Scope: actions actually selected in the 25 gait/16 weight-loss scenarios plus same-intervention alternatives reachable through skipping. This is a source comparison and software eligibility review, not clinical clearance of the full 152-row catalog, individual users or doses.

## Findings

| Action / family | Source comparison | CHJ finding / disposition |
|---|---|---|
| Supported chair rise, 5 repetitions | NHS Strength exercises includes 5 slow sit-to-stands. Its preferred ascent uses legs; hands may guide descent. | Exercise family and 5-repetition example have support. CHJ permits armrests for assistance: an adaptation, not an identical NHS protocol. Keep stop conditions and sturdy chair. It is not a stand-alone weight-loss plan, nor an individualized clearance for knee pain or falls. |
| Single-leg stand, 30 seconds (two catalog IDs) | NHS Balance exercises starts with wall support, 5–10 seconds, 3 repetitions each side. | CHJ 30-second initial dose differs. Public guidance does not prove 30 seconds unsafe; it also does not validate this automatic dose for reported gait instability. Clinical review or a reviewed lower-dose catalog action is still required before endorsing this route for unsupervised gait-impaired users. No silent label/dose rewrite. |
| Single-leg stand, 60 seconds / closed eyes / unstable surface | NHS cited beginner routine does not establish these progressions for this user group. | Tier ceiling prevents automatic progression after skip, but tier alone does not validate capability or dose. Defer endorsement pending specific exercise/progression review. |
| Floor rise without hands, including repeated lie-and-rise | No reviewed patient-specific floor-transfer protocol in the consulted sources. | Currently reachable after skipping balance. A same-tier label is not proof of equal difficulty. Review before endorsing for gait-impaired users; do not present as clinically cleared. |
| Tandem walk 10 steps | NHS heel-to-toe routine describes at least 5 steps and wall support if needed. | Family has support, but exact CHJ dose and applicability remain conditional. Generic single-leg safety wording on this different exercise is a presentation debt, not validation. |
| Generic balance habit | No concrete dose or execution in the catalog label. | Not a fully specified exercise prescription. Must not be counted as a dose-validated alternative. |
| Fast uphill walk, 20 minutes | Catalog intensity is VIGOROUS despite tier 1. CDC older-adult guidance advises discussion with a doctor before vigorous activity when inactive, overweight or concerned. | Reproduced as default weight-loss action with an empty-but-existing health-profile row. Fix the automatic adiposity bridge to admit explicit LIGHT/MODERATE intensity only; vigorous/HIIT/missing intensity are deferred, not medically contraindicated by software. |
| Brisk walking or cycling, 20 minutes, conversational effort | CDC uses moderate-intensity activity and relative effort/talk test; activity should suit ability and health. Weekly recommendations can be split into smaller periods. | Existing moderate catalog alternative replaces the vigorous default in tested weight profiles. Twenty minutes is not certified as an individualized starting dose. Inactivity, symptoms, joint constraints and gait still require existing safety checks; cycling must not be treated as universally safe for instability. |
| Fixed 5/10 kg overhead presses and step-down on adiposity path | Intervention-level resistance evidence is not an approved exercise-specific bridge. | Already deferred by the empty adiposity resistance allowlist in PR46. No catalog/database changes. |

## What this review does and does not establish

The exercise family, catalog dose, safety conditions, user's capacity and expected effect are separate checks. A software PASS verifies only its explicit contracts. Normal BMI must not become adiposity merely because of a wish to lose weight, and a daily strength action must not be sold as a complete weight-loss plan. CDC also describes food intake as relevant to weight loss; nutrition is outside current CHJ support.

The immediate code change is limited to the automatic adiposity aerobic bridge. It does not approve the remaining balance doses or other targets. External unsupervised testing with gait impairment is not signed off by this report. The remaining balance-dose/progression review is a concrete open item, along with a real mobile/authentication/onboarding and next-day return check.

## Sources consulted (2026-10-08)

- [NHS: Strength exercises](https://www.nhs.uk/live-well/exercise/strength-exercises/) — reviewed 2024-02-28.
- [NHS: Balance exercises](https://www.nhs.uk/live-well/exercise/balance-exercises/) — reviewed 2023-11-07.
- [CDC: What counts as physical activity for adults](https://www.cdc.gov/physical-activity-basics/adding-adults/what-counts.html) — dated 2023-12-06.
- [CDC: Older adults, adding activity recommendations](https://www.cdc.gov/physical-activity-basics/adding-older-adults/index.html) — dated 2025-12-04.
- NICE NG249 was attempted but blocked/time-out during this review; no new claim is attributed to an unread page.
