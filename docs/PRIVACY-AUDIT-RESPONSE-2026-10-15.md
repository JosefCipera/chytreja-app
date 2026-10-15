# Audit response — 2026-10-15

Source: Claude's partial read-only audit, branch audit/privacy-readonly-2026-10-15, commit 5d67ed6f, docs/PRIVACY-ACTIVATION-AUDIT-RESULT-2026-10-15.md. Preserve the original audit; it is not a full SQL inventory.

Status: BLOCKED. No migration, live data change or deployment authorized by this note. No production isolation, unused Firebase Storage or provider retention is inferred from a missing connection, a 404 response or an empty code search.

## Immediate correction in PR #81

user_profiles mixes contact/account and health data. The previous default whole-row health purge was wrong for the actual reported model. Added explicit withdrawal_mode review to the registry: user_profiles is marked review on discovery/refresh, and a health purge stops before ANY row deletion while a health table has unresolved withdrawal scope. This keeps the request pending and access revoked; it does NOT claim that health cleanup has finished.

Do not work around this by setting the real mixed profile's withdrawal_mode to delete. The synthetic database fixture has only user_id/value and explicitly opts into deletion solely for exercising the generic purge; it does not model or authorize deletion of a real mixed profile.

Required implementation after verified column metadata: preserve minimal necessary account fields and erase health/body/goal fields, or separate account and health rows. Review nullability, constraints, defaults, all JSON payloads and views, and update application onboarding behavior. Unknown columns or account dependencies must stop completion rather than being guessed. Decide what onboarding_completed means after removal of health answers; keeping a flag must not cause the app to skip required re-entry after renewed consent.

## What the report establishes / does not establish

- OpenAPI metadata covers exposed public relations only. It cannot certify RLS, triggers, FK delete rules, other schemas or view security.
- Browser clients apparently share configured backends; deployed server config for test/production is unknown. Treat a dev migration as potentially affecting all environments until proved otherwise.
- sokrates-content can be proposed as shared based on the observed inventory, but the complete storage manifest cannot be marked reviewed until Firebase Storage and other possible stores (meal photo URLs) are resolved.
- 21 relations absent from repository migrations are schema reproducibility gaps, not proof of a runtime error. Two code-referenced missing relations require feature-usage review; do not create tables blindly to match grep.
- Full account erasure also requires an inventory of integration credentials, indirect ownership, views and history, plus actual backup/provider handling.

## Bounded next work

1. Read-only SQL metadata: ownership, column types/nullability/defaults (without secret-valued defaults), constraints/FK actions, RLS/policies, views and other schemas. No user rows, tokens, filenames or object content.
2. Verify deployed backend linkage and actual Storage use with the connected consoles; repair gcloud certificate validation rather than disabling it.
3. Implement the mixed-profile policy and reconcile registry/schema on an isolated copy. Finish recovery scheduling and monitoring before enabling real requests.
4. Obtain actual backup/provider settings and an operator procedure, then finish the public notices and matching consent versions.

Keep PR #81 draft and CHJ_PRIVACY_READY closed. No additional human tester is needed for these infrastructure checks.
