# Health consent, withdrawal and account erasure — implementation checkpoint

Status: draft implementation in PR #81, branch feat/privacy-lifecycle. No live database migration, environment changes, account deletion, production or test deployment was performed in this task. Do not merge as an ordinary frontend change: the default collection gate is closed.

## User flow

- The Launcher menu adds “Soukromí a účet”, opening /soukromi.
- Before protected app content or restored Launcher health state, verify the authenticated user's server-side consent status.
- Three separate, initially unchecked choices: age 18+, terms, explicit health-data consent. Terms acceptance alone is insufficient.
- Grant records exact health, terms and privacy notice versions. Existing accounts never acquire retrospective consent.
- Withdrawal is available independently of collection readiness. It revokes health access and increments an epoch before enqueueing health-data cleanup; the Firebase login is retained.
- Account erasure is separate, requires the exact word SMAZAT and Firebase authentication within five minutes (password or Google reauthentication). Passwords go only to Firebase.
- Deletion blocks health and account-scoped processing, purges reviewed operational rows and storage, revokes Firebase sessions and removes the Firebase identity.
- A random receipt supports status/continuation after sign-out; only its SHA-256 digest is stored server-side. The receipt is a private capability: never log or email it.
- Local live-data removal is not proof that every provider copy or backup is gone. Both health withdrawal cleanup and account erasure remain at external_review until an operator has actual supporting evidence.
- The implementation does not silently switch these states to “complete” or invent backup retention periods.

## Technical boundaries

Server APIs require a revoked-token check, authoritative Firebase UID, current consent versions and a per-request epoch. AsyncLocalStorage supplies UID/epoch/scope at Supabase transport time, including cached clients; concurrent users do not share actor state. A final epoch check suppresses stale responses even after a subsequent new grant. The TTS text header is cleared on blocked output.

The migration adds private control-plane tables and RPCs. It registers public user_id tables; attaches a write guard; restricts direct anon/authenticated access; and checks dependencies before purge. Deletion is transactionally verified across registered rows and detects cross-owner FK references. Unknown dependencies, newly unregistered ownership tables and stale worker leases fail explicitly.

Registry discovery is a starting inventory, NOT proof of a complete live schema. Alternate ownership columns, JSON payloads, views, indirect references, other schemas/databases and external systems require review. Review the scope of mixed tables such as user_profiles: health withdrawal currently purges their entire health-scoped row, not selected columns. TOC tables default to account scope. Resolve health-to-account FK dependencies before activation.

Storage uses a reviewed manifest. Every actual Supabase bucket needs a classification. Owned-object support currently requires the exact UID/ prefix; shared objects are retained. Unknown buckets, ownership layouts or Firebase Storage use stop automatic completion. The adapter does not infer that a Firebase Storage bucket is unused from the absence of known calls.

The recovery worker processes one leased job, uses CRON_SECRET, and exposes no health content. UI continuations are not sufficient operational recovery on their own. No cron tariff or schedule was assumed or enabled.

Application logging of raw inputs/profiles/AI output was suppressed in the changed API modules. Previously recorded platform logs are not retroactively erased by this code. Historical unguarded clients/direct database paths are restricted by the migration and may require separate feature repairs.

Browser cleanup targets reviewed current Launcher keys for the current UID and its question budget. Cross-tab events clear the current Launcher view and block health screens. This is not remote erasure of every historical browser cache, device, downloaded document or independent copy.

## Before enabling on dev

1. Obtain a read-only inventory of the actual Supabase schema, ownership and FK graph, Storage buckets/object layouts, Firebase Storage use, and all deployed API/client entry points. No real-user data is needed in the report. Verify which environments share a backend.
2. Reconcile the registry and reviewed storage rules with that inventory. Review legacy Supabase project configuration separately. Do not guess ownership or cascade deletes.
3. Review actual provider contracts/settings, regions, logs, mailboxes, backup retention/restore exclusion and erasure procedures for Firebase, Supabase, Vercel, Anthropic, OpenAI and ElevenLabs where used. Establish who completes external_review and what evidence is required.
4. Finish public privacy/terms information, controller details, purposes, recipients, transfers, retention and withdrawal consequences. Use PR #79 as a draft source only; preserve the newer document appearance/return navigation from PR #80. The old public notice alone does not support the new version labels.
5. Plan a coordinated maintenance rollout: this migration changes RLS and write behavior immediately. Old clients cannot continue writing with no consent headers. Do not simply revert frontend code after applying the migration.
6. After review, apply migrations to an isolated copy of the real schema and run synthetic accounts end-to-end. Only then schedule the real dev migration and application deployment. No historical consent backfill.
7. Configure CHJ_PRIVACY_STORAGE_MANIFEST server-side and verify service-role/Firebase privileges. Example shape ONLY, not an actual inventory:
   {"reviewed":true,"firebase":"not-used","buckets":[{"name":"reviewed-example","scope":"health","prefix":"{uid}/"}]}
   Empty buckets or firebase:not-used are valid only after real verification. Firebase Storage in use requires an implemented, tested adapter before activation.
8. Configure and monitor authenticated privacy-worker retries. Alert on failures, jobs older than the approved operational deadline and external_review backlog. The agreed live operational-data deadline is 30 days after termination; a pending UI does not discharge it.
9. Set CHJ_PRIVACY_READY=1 only after the preceding checks. Missing configuration intentionally disables protected processing and new consent collection.
10. Run one disposable synthetic end-to-end account on the actual dev stack: declined consent, affirmative grant, reopen app, withdrawal, stopped late request, deletion confirmation, Firebase removal, row/object checks and retained status. Never use real patient data or reset an existing user's account for this.

## External review and completion

The service-only chj_privacy_finish_external_review(job UUID, verified boolean) is an operator operation, not a browser endpoint. Passing true is an assertion supported by the actual provider/backup review; it must never be an automatic shortcut. It rechecks operational rows before completing.

For account requests, it removes the consent events/control row and related jobs; the final receipt row loses its UID and remains status-only. The proposed 30-day status-receipt retention is an implementation choice to review, not an already approved general retention policy. Worker claims clean expired anonymous receipts. Health withdrawal retains the login and minimal consent control/audit data; establish the necessity and actual retention period before activation.

Backups may require restore exclusions and expiry rather than immediate physical deletion. Describe the actual arrangement truthfully in the notice and user status; do not certify that every copy was erased if it was not. Any lawfully retained record needs a defined purpose and retention period, not an unqualified “complete erasure” promise.

The earlier 24-month inactivity notice + 30-day response rule is recorded in the legal checkpoint; an inactivity scheduler is not implemented here.

## Verification and reproducibility

- scripts/test-privacy.mjs executes actual middleware/API/transport/worker modules with injected synthetic identity and storage. It includes revoked/obsolete/missing consent, setup outage, mixed UID aliases, late response/regrant fences, concurrent clients, explicit consent and recent-login deletion.
- scripts/test-privacy-database.py applies only this migration to an isolated PostgreSQL 17 privacy_fixture database. It refuses other database names/markers and tests RLS, function privileges, epochs, row ownership, unknown FK dependencies, transaction rollback and stale leases.
- scripts/test-privacy-browser.cjs serves the actual privacy page/CSS/modules in Chromium with synthetic Firebase and an intercepted API; no messages, profiles or deletion reach a real service. It covers unchecked choices, setup disabled, grant, withdrawal across tabs, UID-local cleanup, confirmation, reauthentication and honest pending status on mobile/desktop.
- Existing engine unit fixtures deliberately replace the wrapper with a pass-through, so those tests still isolate decision logic. The separate privacy tests exercise the real wrapper. Existing landing/Launcher fixture tests exclude only the networked guard and use a readiness stub.
- CI screenshots are retained for seven days; tests and this checkpoint remain in git.

Next activation work belongs to the real schema/storage/provider/public-notice review above. Automated isolated PASS does not prove complete erasure on the live service.
