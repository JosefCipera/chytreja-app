# First CRT-based tester: floor rise

Three approved clean voice transcripts trace back from `LOSS_OF_FLOOR_RISE_ABILITY`. This first suite checks interpretation and structured fact persistence, not clinical decisions or exercise safety.

Run from the repository root:

```sh
node --experimental-vm-modules scripts/ai-tester/run-floor-rise.mjs --probe
node --experimental-vm-modules scripts/ai-tester/run-floor-rise.mjs --live
```

`--probe` injects a `GENERAL_HEALTH_REQUEST` classification and exercises the actual orchestrator and health-event adapter. It answers only whether this event path preserves the expected structured fact. It does not measure how Haiku classifies the sentence. Clarification is explicitly BLOCKED in this mode.

`--live` requires the project's installed Anthropic SDK and an already authorized `ANTHROPIC_API_KEY` in the process environment. It uses the application's unchanged classifier prompt, tool schema and model. Do not put credentials into the script, command text, reports or commits. This suite makes at most three classifier requests. No Supabase credentials are needed or used; database reads/writes and the downstream engine are isolated fixtures. User UID is a fixture string, not a real account.

Output is JSON containing PASS, FAIL or BLOCKED per case. Exit codes: 0 = all pass, 1 = failures, 2 = blocked without failures. A missing API key is BLOCKED before any request. Never describe a probe result as a live language-understanding result. Fixture engine responses are not findings about actual recommendation selection.

Baseline on 2026-10-07, main `9f3e6dc`: two structured facts absent when injected as GENERAL_HEALTH_REQUEST; ambiguous clarification blocked. Live classifier evaluation was not performed because the local environment had no Anthropic key. No app behavior was changed by this suite.


# Full-catalog gait matrix

`run-gait-matrix.mjs --live` runs 24 synthetic scenarios (including two repeats of intermittent staggering) through the actual orchestrator, event adapter and complete engine. Six clean spoken formulations, stable/negated/third-person/historical/hypothetical/uncertain statements, the tester137 profile shape, recent falls, low strength, three knee severities, a combined profile and unsupported syncope are covered. Separate journeys verify Hotovo, same-day return, duplicate completion prevention, Přeskočit, an alternative assignment and its completion. No audio transcription or browser/authentication flow is tested.

```sh
node --experimental-vm-modules scripts/ai-tester/run-gait-matrix.mjs --live
```

The runner reads only public `longevity_actions` via the existing browser publishable key. It selects every active row with pagination, including the exact engine columns. Profiles, constraints, action assignments and all writes are isolated in memory; it never requests private user tables from Supabase. Catalog failure or classifier outage is BLOCKED, not a pass. Reports include catalog count, capture time and SHA-256; `AI_TESTER_CATALOG_OUT` saves the public snapshot alongside results in CI. Credentials are never included. A provided plain-array snapshot can be used with `--catalog=/path/catalog.json`; without `--live` the classifier is injected, which is not evidence of language understanding.

CI runs on relevant pull requests and main pushes. Superseded runs on the same branch are cancelled. Reports expire after seven days; scripts, requirements and app fixes remain in git. Missing Anthropic secrets (including external-fork PRs) produce BLOCKED, not a live result.

The live classifier also intermittently misclassified a staggered-walking description as a pain symptom; the semantic gait rule now explicitly distinguishes these and the matrix repeats that sentence.

The matrix reproduced missing joint-load protection for STABILITY_PROTOKOL, balance safety masking stricter knee conditions, and post-skip assignment loss. A second journey assertion reproduced reoffering the same 30-second single-leg stand under another catalog ID. The reviewed skip-equivalence group in `data/engine/action-equivalents.json` contains only those two known rows; it does not infer exercise equivalence or merge doses using AI.

Passing means these explicit interpretation, decision/presentation and persistence contracts hold. It does not establish clinical efficacy, dose suitability, all possible dialogue branches, or readiness for external testers. The public catalog currently includes a more challenging unstable-surface exercise after skipping the initial balance action; clinical suitability of that progression is outside these assertions and remains a review item.
