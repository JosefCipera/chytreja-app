# Recovery and queue monitoring — PR #81

Status: prepared in the draft only. No schedule, environment flag, live worker or notification delivery has been activated. Backend isolation and mixed-profile handling remain blocking audit findings.

## Separate switches

CHJ_PRIVACY_READY controls new protected processing/consent collection. CHJ_PRIVACY_ERASURE_READY separately controls execution of destructive erasure jobs. Missing means OFF. runPrivacyJob checks the latter before claiming a job, including user-driven continuation from /soukromi; privacy-worker checks it before instantiating database/Firebase clients. Withdrawal and deletion requests can still be recorded and access revoked while execution is off.

Do not enable CHJ_PRIVACY_ERASURE_READY to bypass unresolved mixed profile scope, unknown storage, shared environments or provider review. This switch does not resolve those findings.

## Monitor

GET /api/privacy-monitor accepts only a distinct PRIVACY_MONITOR_SECRET bearer credential, not the worker's CRON_SECRET or a Firebase user token. It reads the service-role-only aggregate chj_privacy_monitor RPC. The response is explicitly whitelisted: counts, age in hours, fixed warnings and attention state. No UID, receipt, job ID, health text, file path, raw database error or provider body is returned.

Operational warning: external_review backlog, retries and expired leases. HTTP 503 / PRIVACY_QUEUE_ATTENTION: repeated failure (3+ attempts), any account request still unfinished after the agreed 30-day operational deadline, or the oldest pending request reaching the review interval. HTTP 503 / PRIVACY_UNAVAILABLE is an unavailable/invalid monitor, never an empty healthy queue.

PRIVACY_REVIEW_ALERT_HOURS defaults to 24, configurable 1–720. This is an operator attention threshold, NOT a new retention/deletion promise. It includes pending health withdrawal and external review, so they cannot sit indefinitely with a green monitor. Before activation choose the operational interval and responsible operator. A backup waiting for documented expiry may legitimately need continued review; attention must not be cleared by falsely certifying external erasure.

## Prepared schedule

.github/workflows/privacy-recovery.yml:
- Runs from main at minute 17 each hour, with optional manual dispatch.
- Skips unless the repository variable CHJ_PRIVACY_RECOVERY_ENABLED is exactly 1.
- Uses environment privacy-dev and only its PRIVACY_DEV_WORKER_TOKEN / PRIVACY_DEV_MONITOR_TOKEN secrets (must match the dev server's CRON_SECRET / PRIVACY_MONITOR_SECRET).
- Fixed target https://dev.iting.cz only; refuses another origin, redirect following, absent credentials or an invalid batch limit.
- Up to four already-requested jobs per run; it never creates a deletion request or skips external_review.
- The aggregate monitor is called even after a failed worker attempt. A failed worker or attention/unavailable monitor makes the workflow fail with a fixed error code. Logs contain only sanitized operational counts.
- Concurrent runs do not cancel each other; server leases still arbitrate individual jobs. A new attempt is idempotent, not permission to mark external copies removed.

GitHub scheduled workflows may be delayed, and schedule execution depends on the workflow being on the default branch. This is prepared best-effort recovery, not a delivery-time guarantee. The batch limit gives a nominal ceiling of four jobs per hourly run; verify capacity against the actual queue and runtime before activation. For stricter service operation choose an appropriate independent scheduler/monitor after reviewing backend separation and the hosting plan.

## Activation (not performed)

1. Complete the read-only backend/storage/schema audit and mixed-profile fix first.
2. Apply/rehearse the SQL migration with an isolated actual-schema copy; monitor permissions must reject anon/authenticated access.
3. Deploy the worker/monitor on dev with both execution/schedule switches still OFF.
4. Configure the distinct secrets through the service/GitHub settings, not in chat, source or command arguments. Verify access restrictions for the privacy-dev environment and the actual deployed project.
5. Check the monitor read-only and configure an operator and failure-notification routing. Enabling notifications, adding recipients and verifying delivery are separate operational actions; this code did none of them.
6. Authorize/rehearse processing of one disposable synthetic deletion request, verify that Firebase/data removal and external_review are reported truthfully, then enable the execution switch on dev.
7. Set the repository schedule flag after the prior checks. Observe a scheduled run and a controlled failure notification before relying on it.
8. Add an independent heartbeat check for missing/skipped/stopped scheduled runs. A scheduler cannot alert from its own workflow if it stops running. Until verified, scheduling and alert delivery remain NOT operationally proven.

Turning off erasure execution does not restore deleted data, un-revoke consent or cancel requests. Turning off only collection does not stop an already-authorized recovery worker. Keep that distinction in the incident procedure.

## Tests

Actual queue/worker/monitor modules and the scheduler runner are exercised with synthetic DB/auth/fetch fixtures: default execution off, no pre-auth access to clients, separate monitor token, private-field stripping, unavailable DB, old/repeated/external queues, dev-only target, redirect refusal, bounded progress and post-failure monitoring. PostgreSQL fixture tests execute the aggregate RPC and its role restrictions; no live data is touched.
