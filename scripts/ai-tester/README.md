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

`run-gait-matrix.mjs --live` runs 25 synthetic scenarios (including two repeats of intermittent staggering) through the actual orchestrator, event adapter and complete engine. Six clean spoken formulations, stable/negated/third-person/historical/hypothetical/uncertain statements, the tester137 profile shape, recent falls, low strength, three knee severities, a combined profile and unsupported syncope are covered. Separate journeys verify Hotovo, same-day return, duplicate completion prevention, Přeskočit, an alternative assignment and its completion. No audio transcription or browser/authentication flow is tested.

```sh
node --experimental-vm-modules scripts/ai-tester/run-gait-matrix.mjs --live
```

The runner reads only public `longevity_actions` via the existing browser publishable key. It selects every active row with pagination, including the exact engine columns. Profiles, constraints, action assignments and all writes are isolated in memory; it never requests private user tables from Supabase. Catalog failure or classifier outage is BLOCKED, not a pass. Reports include catalog count, capture time and SHA-256; `AI_TESTER_CATALOG_OUT` saves the public snapshot alongside results in CI. Credentials are never included. A provided plain-array snapshot can be used with `--catalog=/path/catalog.json`; without `--live` the classifier is injected, which is not evidence of language understanding.

CI runs on relevant pull requests and main pushes. Superseded runs on the same branch are cancelled. Reports expire after seven days; scripts, requirements and app fixes remain in git. Missing Anthropic secrets (including external-fork PRs) produce BLOCKED, not a live result.

The live classifier also intermittently misclassified a staggered-walking description as a pain symptom; the semantic gait rule now explicitly distinguishes these and the matrix repeats that sentence.

The matrix reproduced missing joint-load protection for STABILITY_PROTOKOL, balance safety masking stricter knee conditions, and post-skip assignment loss. A second journey assertion reproduced reoffering the same 30-second single-leg stand under another catalog ID. The reviewed skip-equivalence group in `data/engine/action-equivalents.json` contains only those two known rows; it does not infer exercise equivalence or merge doses using AI.

Passing means these explicit interpretation, decision/presentation and persistence contracts hold. It does not establish clinical efficacy, dose suitability, all possible dialogue branches, or readiness for external testers. The repeated-skip journey reproduced escalation to an unstable surface, longer stance and closed eyes, followed by an irrelevant assessment loop. It now checks the explicit product rule that skipping cannot raise catalog tier, rejects repeated equivalent exercises, checks bounded same-day exhaustion, inactive controls after HOLD and expiry of prior-day skips. This tier policy is not a clinical assessment of each exercise.


## Skip progression regression

`node scripts/test-skip-progression.mjs` verifies same/lower-tier alternatives, intervention-local ceilings, unknown tier handling, exhaustion with nonviable candidates remaining, next-day reavailability and preservation of safety/necessary-evidence priority. It needs no network or API credential and runs before AI tests in CI.

The policy is a conservative CHJ eligibility rule: skipping is not evidence of capability. [NICE NG249, falls-prevention exercise recommendations](https://www.nice.org.uk/guidance/ng249/chapter/Recommendations) describe individually tailored progression; they do not prescribe this software tier ceiling or validate the catalog's individual exercises. Catalog metadata and clinical appropriateness remain separate from passing this regression.


`node --experimental-vm-modules scripts/test-why-control.mjs` verifies that exact WHY controls read cached explanations without an AI/engine call, including a classifier outage. Medical scope rejection retains precedence. This regression was added after a real workflow misclassified `Proč?` as SCOPE_CLARIFICATION while the full 25-scenario matrix passed.


# Weight-loss endpoint matrix

`node --experimental-vm-modules scripts/ai-tester/run-gait-matrix.mjs --live --weight-loss` reuses the isolated full-engine/catalog driver for 13 scenarios: normal BMI, overweight, a woman's explicit wish, the tester136 profile shape, low strength, reported gait instability, three knee severities, combined limitations, a mixed syncope request, and separate completion/skip journeys.

This mode calls the actual `api/orchestrate.js` endpoint, with Firebase authentication mocked to the fixture UID. Its real server hydration, exact-goal parser, persistent goal writes, orchestrator and engine execute. Checks cover canonical goal storage without invented symptoms/diagnoses, authoritative UID, read-only WHY, server restoration after a forged client goal, acknowledgement of weight loss and explanation when another priority is selected, known tester136 strength/action selection, decision/presentation consistency and existing safety/persistence contracts. Normal BMI is not turned into measured excess adiposity merely because the user wishes to lose weight. No private account is read or altered.

Exact recognized wishes intentionally bypass Haiku in the actual server; a live run is not evidence of arbitrary weight-loss language understanding. Only inputs that reach the existing classifier use the real model. Microphone, real authentication and clinical exercise/dose validation are not tested. `review_required` explicitly flags the observed fixed 5 kg overhead press selected for some weight-loss profiles. Software PASS does not approve its relevance or dose. Ranking and catalog remain unchanged by this QA addition.


## Target-specific resistance bridge regression

The weight-loss matrix now rejects resistance candidates on the adiposity path while its reviewed `allowed_action_ids` list is empty. The original report's fixed 5 kg overhead-press choice is deferred in model data, not replaced through presentation or a priority override. Functional strength, other targets and the catalog are unchanged. `node scripts/test-action-bridge.mjs` verifies absent/empty/nonempty list semantics, safety precedence, and rejection of the two overhead presses and step-down on the unreviewed adiposity bridge. Unknown knee conditions still ask; moderate knee conditions retain existing modifications; severe knee conditions use the existing safety result. Gait without a viable action remains assessment-blocked; this bridge patch did not solve the pre-existing generic NBA assessment question wording or certify clinical readiness.


## Typed blocking evidence and gait answer journeys

The subsequent blocking-evidence fix replaces the generic injury question with the actual gait-stability question/key, forwarded from Safety Gate through NBA and DD to existing orchestrator persistence. The weight-loss endpoint suite now has 16 scenarios: three additional isolated journeys answer the gait question with Ano, Ne and Nevím and verify persistence, no invented walking clearance, no completion writes and no repeated ASK on return. These use live Haiku for answers in CI; exact weight wishes still use the server parser. `node scripts/test-blocking-evidence.mjs` verifies typed questions, availability and positive/negative replies, regional severity keys and unchanged ordinary walking without an active gait finding.

Dialogue resolution does not establish clinical suitability: if the instability remains active and no viable alternative exists, existing safety presentation stops prescribing unaided walking pending individual assessment. This is a conservative product policy, not a diagnosis or dose validation. The earlier generic-question wording limitation is addressed for gait and region severity; other question and clinical-validation limitations remain.
