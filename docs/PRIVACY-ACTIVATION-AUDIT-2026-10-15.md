# PR #81 — read-only activation audit for an environment with connected services

Status 2026-10-15: implementation and isolated tests exist; activation is NOT approved by this report. Do not apply the migration or change service settings as part of this audit.

## Task to give Claude

> Open JosefCipera/chytreja-app PR #81, branch feat/privacy-lifecycle. Read docs/PRIVACY-LIFECYCLE-2026-10-15.md and scripts/privacy-preflight.sql.
>
> Audit the actual connected environment ONLY ON READ. Do not invoke runEngine, arbitrary app code, privacy APIs with mutations, migrations, resets or delete operations. Do not set CHJ_PRIVACY_READY and do not publish/merge. Do not send a form or an email.
>
> 1. Run the exact schema metadata queries in scripts/privacy-preflight.sql through the existing read-only SQL connection. If that tool does not permit an explicit read-only transaction, run individual SELECT statements only. No user rows, profiles, health texts, auth records, tokens or keys in the report.
> 2. Return user-owned tables, owner columns, indirect ownership and FK edges; classify each as health, account, shared or unresolved. Highlight mixed user_profiles data and health-to-account dependencies. Do not guess a cascade deletion rule. Compare with the migration registry and flag unregistered schemas/tables/ownership layouts.
> 3. Through existing authorized dashboard or service tools, inventory Supabase Storage bucket classifications and ownership path patterns. Return only bucket metadata and generalized patterns; no real object keys, UIDs, filenames or file content. Confirm whether Firebase Storage holds user files; a configured bucket name or no upload call in git is not evidence that it is empty.
> 4. Compare the backend configuration of dev/test/production locally and report only SAME / SEPARATE / UNKNOWN. Do not print secret values. Report which environment would be affected by a dev migration.
> 5. Read configured region, actual backup retention, restore/exclusion procedure and provider retention/deletion settings for services actually used. For an inaccessible setting, return UNKNOWN with the missing source; do not fill a default from a pricing page or claim zero retention.
> 6. Verify the presence (not values) and sufficient permissions of the privacy worker secret, Firebase Admin identity operations, storage manifest and retry scheduling/monitoring. Do not run a job to test permissions. A missing cron schedule or unmonitored external_review queue is a blocker.
> 7. Check current published privacy/terms against the draft purposes, recipients, retention and withdrawal consequences. Return factual gaps; do not silently publish draft legal text from PR #79 or overwrite PR #80's document navigation.
>
> Return one concise report using the table below. No accounts need to be created, changed or removed. Do not ask to run the engine; that is unrelated to this audit. If any setting requires a new permission or a service is not connected, state the exact missing read-only access and continue the independent checks.

## Required return format

| Area | Verified result | Source / checked at | Required change | Blocks activation? |
|---|---|---|---|---|
| dev/test/prod backend separation | SAME / SEPARATE / UNKNOWN | settings source, no values | … | yes/no |
| Row ownership, indirect relations, mixed scope | … | schema query section | … | yes/no |
| Supabase object ownership | … | bucket metadata / generalized paths | … | yes/no |
| Firebase Storage in use | YES / NO / UNKNOWN | actual inventory source | … | yes/no |
| Worker retries and monitoring | … | configuration source, not secret | … | yes/no |
| Backup retention and restores | … | actual account setting/contract | … | yes/no |
| Provider copies and deletion | … | actual account setting/contract | … | yes/no |
| Published notices / consent versions | … | current documents | … | yes/no |

Conclude with exactly one status: BLOCKED (list concrete gaps), or READY FOR ISOLATED REAL-SCHEMA REHEARSAL. A read-only audit alone never means READY TO ENABLE LIVE ERASURE.

## Handoff back to implementation

The report is input for adjusting registry/storage adapters, worker scheduling and public notices. After that, rehearse on an isolated copy of the actual schema with synthetic data, then coordinate the dev deployment. Keep PR #81 draft until those blockers are resolved. Do not tick a checklist merely because isolated fixture tests passed.

All code, audit instructions and results should stay in the repository. Do not include health data or credentials in a commit or PR comment.
