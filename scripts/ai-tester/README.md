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

The subsequent blocking-evidence fix replaces the generic injury question with the actual gait-stability question/key, forwarded from Safety Gate through NBA and DD to existing orchestrator persistence. The weight-loss endpoint suite now has 16 scenarios: three additional isolated journeys answer the gait question with Ano, Ne and Nevím and verify persistence, no invented walking clearance, no completion writes and no repeated ASK on return. Exact Ano/Ne/Nevím replies use deterministic typed routing; other inputs reaching classification use live Haiku in CI; exact weight wishes still use the server parser. `node scripts/test-blocking-evidence.mjs` verifies typed questions, availability and positive/negative replies, regional severity keys and unchanged ordinary walking without an active gait finding.

Dialogue resolution does not establish clinical suitability: if the instability remains active and no viable alternative exists, existing safety presentation stops prescribing unaided walking pending individual assessment. This is a conservative product policy, not a diagnosis or dose validation. The earlier generic-question wording limitation is addressed for gait and region severity; other question and clinical-validation limitations remain.

The initial live run reproduced Nevím being classified as SCOPE_UNCLEAR and not persisted. Exact Ano/Ne/Nevím answers now route only while a GENERAL gait_stability question is pending, after existing medical/safety guards. Nevím is preserved as raw uncertainty, not a false negative or clearance.


## Adiposity entry intensity

The source review in [docs/QA-ACTION-REVIEW-2026-10-08.md](../../docs/QA-ACTION-REVIEW-2026-10-08.md) reproduced a tier-1 VIGOROUS uphill walk being selected for a weight-loss request despite no documented vigorous-training readiness. The adiposity aerobic bridge now admits explicit LIGHT/MODERATE catalog intensity. `node scripts/test-adiposity-entry-intensity.mjs` checks vigorous/HIIT/missing/invalid metadata deferral, permitted intensities, safety precedence, skip and unchanged other targets. The endpoint matrix verifies the existing moderate 20-minute conversational-effort alternative for its overweight fixtures. This does not individually validate that duration, balance dosing or clinical readiness; unresolved review findings are recorded in the audit.


## Conversation controls and actual onboarding handlers (2026-10-12)

Every turn of the gait and weight-loss matrices now executes the production launcher render/loading functions in an isolated DOM model. Non-critical responses must retain text, send and microphone controls. The tester143-shaped synthetic journey uses the actual onboarding pill handlers and request serialization, then the real orchestration endpoint with mocked Firebase and in-memory records: reported gait uncertainty → stability question → Ne → blocked → clickable Proč? → read-only safety explanation → Co dál? → still blocked, no prescription. The profile dimensions are a synthetic fixture, not a read of tester143's live records.

`node scripts/test-launcher-hold-input.mjs` checks busy controls, restored older block responses without buttons, HOLD, ASK, ACT, EXPLAIN, NOOP, and the existing buttonless critical terminal. The original renderer fails this regression on SAFETY_BLOCKED. `node scripts/test-onboarding-combinations.mjs` traverses all 32 combinations of the five actual physical-answer pills, unanswered fields, and physical-save/completion-save failures. Wizard API requests are mocked and no account is created or changed.

These checks run automatically in the existing CI workflow alongside real Haiku classification and the full-catalog engine matrices. Local snapshot run: gait 25 PASS, endpoint 24 PASS; all turns checked through the production renderer. This is behavior-level integration against a DOM model, not browser layout, real authentication, microphone recording or a complete end-to-end registration test. It does not approve medical protocols, remove safety gates or validate exercise dose. Further real failures should be added as reproducible isolated journeys rather than requiring repeated manual account creation.



## CRT combinatorial journeys (2026-10-12)

`node --experimental-vm-modules scripts/ai-tester/run-gait-matrix.mjs --crt-combinations` traverses all 32 binary physical-answer combinations at two fixed weight/waist profiles, with weight-loss and gait requests, Ano/Ne/Nevím gait answers, and completion/skip branches: 768 journeys over 64 profiles. Some branches coincide when no question or action is reached. This mode explicitly rejects `--live`: it injects deterministic intentions and makes no classifier API requests. The separate live matrices still test language interpretation.

The real wizard handlers, orchestration endpoint, whole engine, public catalog and production render/loading functions execute against isolated profile/API/DOM models. Contracts are declared in `crt-combination-contracts.mjs`: preserve actual answers and provenance, don't convert wishes into measurements or self-reports into confirmed diagnoses, require real model edges/goal paths and the correct action bridge, keep WHY/trajectory/mechanism read-only and tied to the selected branch, prevent duplicate completion and equivalent/escalated same-intervention skips, preserve safety blocks, and retain conversation controls. Unknown measurements/clinical answers are not invented just to force an action; pending evidence is reported for review. `test-crt-contract-mutations.mjs` proves the oracle rejects invented measurements, source evidence, edges and goal paths.

`node scripts/ai-tester/summarize-crt-combinations.mjs report.json` separates product-review items from software PASS. CI retains the JSON, exact public snapshot and readable summary as artifacts and puts the summary on the workflow page. The first local snapshot run found 62 walking-only benefit explanations for a walking-or-cycling action; the aerobic intervention subject now says “Tato aktivita”. Provenance notes now reflect the actual 5 kg / second-floor and small-child questions rather than old third-floor / 10+ kg descriptions. Decision/ranking/safety/dose logic is unchanged.

See [the review](../../docs/QA-CRT-COMBINATIONS-2026-10-12.md) for observed branch differences and remaining product questions. Graph consistency is not evidence that the graph, selected priority, exercise protocol or starting dose is clinically correct. Registrations, real authentication, browser layout and microphone recording remain outside this suite.



## Available action branch after primary safety block (2026-10-12)

The original systemic priority remains in `engine.system_leverage`. When its exact Daily Decision is SAFETY_BLOCKED, `findAvailableLeverage` evaluates other already-evidenced, modeled leverage candidates in the existing alternative order. Each uses the unchanged NBA with the same person facts, constraints, all node states, evidence, response history and today's skips. There is no fallback before a required answer, for missing models/candidates, after primary ACT/HOLD, or under a critical safety override. An unavailable alternative is not prescribed. A completed/skipped alternative stops the branch search for today instead of hopping to another intervention.

`action_leverage` records the branch actually supporting the day's action; `action_fallback` retains the primary blocked decision and ordered attempts. Cached WHY, causal/goal paths, mechanism and assigned leverage refer to that actual branch, while `system_priority` keeps the global priority visible. WHY explains why its action is unavailable. Safety gates, dose, catalog and systemic ranking are not relaxed.

`node scripts/test-leverage-fallback.mjs` verifies eligibility/order, all-unavailable behavior and critical/evidence/skip/completion precedence. The endpoint suite now has 25 journeys, requiring the reported tester143-shaped case to keep the primary walking block while offering a checked alternative, and requiring a subsequent syncope report to stop the conversation's exercise offer even after a new goal. Combination journeys additionally validate the actual branch after clarification against real model edges, supported intervention and the current NBA. Onboarding fixture profiles now serialize their supplied demographic/body inputs rather than a fixed default, with explicit parity checks.

Local snapshot: 768 combination, 25 endpoint and 25 gait journeys PASS. 322 combination journeys used a checked alternative, representing 54 profile/request pairs (49 functional-strength branches and five gait branches); three profile/request pairs still await clinical-context answers outside the current synthetic fixture. These are software results, not clinical approval of individual catalog protocols. See [the policy and validation review](../../docs/QA-AVAILABLE-LEVERAGE-2026-10-12.md).



## Clinical/discovery continuation (2026-10-13)

The 768 CRT journeys now provide explicit synthetic negative clinical-context answers, aerobic days, dyspnea, blood pressure availability and sitting time when requested. Empty stored records are not treated as medical clearance. The existing parsers route numeric answers; typed storage and classifier bypass are checked.

Run `node --experimental-vm-modules scripts/ai-tester/run-gait-matrix.mjs --clinical-discovery` for five additional endpoint journeys: no positive signal, active/unknown pressure, active/known pressure, higher reported pressure and reported dyspnea. These tests verify question resolution, observational WHY, preserved HOLD on return, no invented diagnosis/prescription and handling a new syncope statement. This suite uses injected classification and synthetic records, not clinical validation. CI saves `clinical-discovery.json` alongside the other reports.


## Blood-pressure reply contracts (2026-10-13)

`node --experimental-vm-modules scripts/ai-tester/run-gait-matrix.mjs --blood-pressure` exercises nine isolated endpoint journeys: current upper pressure (120, 120/80, 150), unknown/unmeasured answers, invalid data followed by a valid value, and three approximate-discovery replies. Checks cover numeric persistence, availability-only unknowns, late value entry, no repeated resolved question, no invented hypertension, and unchanged medical scope guards. Reports are saved as `blood-pressure.json` in CI.

The 768 combination journeys now explicitly answer missing current pressure with an unavailable marker. A self-reported reading has estimated confidence and no fabricated measurement date. Recording an answer does not remove the model's unmet evidence needs or authorize exercise: a repeated pressure ASK becomes an honest HOLD while keeping the conversation open. Live language suites remain separate; these journeys use injected classification and synthetic profiles.


## Conversation changes (2026-10-13)

`run-gait-matrix.mjs --conversation-changes` runs five isolated endpoint journeys: weight → gait topic change, explicit floor-rise answer correction, new syncope statement during an action, a new report after completion, and topic change after skipping. `--live` uses the real classifier for messages reaching it; exact navigation and supported goals still use server parsers. CI executes the live suite and creates `conversation-review.md` with `summarize-conversations.mjs`, also included in the workflow summary.

Checks cover persisted new/corrected facts, removed obsolete strength evidence, cleared stale assignment, current safe action, explanatory reads, preserved completion/skip records and medical refusal that remains active within the same conversation. The saved `docs/QA-CONVERSATION-REVIEW-2026-10-13.md` is the local injected-classifier snapshot with exact app responses. CI's live-classifier report is a separate artifact.

Software PASS is separate from product/clinical review: `REOPENED_DAY_AFTER_NEW_FACT` flags another intervention offered after “today is finished”; balance exercise wording, support, dose and closing the eyes need professional review. No browser login/logout, real speech transcription or clinical suitability is established by these tests.


## Approved completed-day policy (2026-10-13)

Josef approved: after Hotovo, no additional exercise that day, including another intervention selected after new health input. New facts and corrections are still stored, blocking questions may still be asked, and safety/unsupported-medical rules remain higher priority. Daily decisions now use any recorded completed intervention for HOLD_DONE_TODAY, rather than only the newly selected intervention. The next day is evaluated normally using the existing UTC assignment-day convention.

The five-conversation suite now checks this policy, a restored stale assignment, empty client state, and a simulated next day with a controlled VM clock. Stale sequential completion requests do not write another completion. The read-before-write persistence guard is not an atomic database uniqueness guarantee for simultaneous requests. Real login/logout and clinical exercise suitability remain outside these software checks.

The earlier REOPENED_DAY_AFTER_NEW_FACT product flag is resolved. The review snapshot is updated with exact new responses and labels for simulated day changes. Balance protocol wording/support/dose/closing eyes remains pending professional review; no protocol change or clinical approval is made by this patch.


## Eyes-open balance entry and source check (2026-10-13)

Remove automatic progression to closed eyes from current and legacy localized safety text. With active gait instability, known closed-eye and unstable-surface tasks (and newly named variants matching those characteristics) require individual assessment. Supported entry tasks retain stable support, eyes open and a stop condition. Catalogue durations/ranking/exposure remain unchanged; the legacy 30-second prescription is not clinically certified by this patch.

Primary sources checked:
- HSE, NHS-adapted balance guidance: https://www2.hse.ie/living-well/exercise/exercise-at-home/balance-exercises/ — stable support and a one-leg hold of 5–10 seconds, three on each leg. This differs from the existing catalogue's single 30-second hold; it does not validate that dose.
- NICE NG249: https://www.nice.org.uk/guidance/ng249/chapter/Recommendations/ and https://www.nice.org.uk/guidance/ng249/chapter/Rationale-and-impact — falls exercise programmes should be based on assessment, individualised and delivered by appropriately trained professionals. Population guidance does not establish suitability for an individual.

`test-action-copy.mjs` now verifies current/legacy eye instructions and assessment gates for known and new advanced variants. It is wired into CI. Its pre-existing WHY fallback expectation was updated to the wording introduced in PR59. All ACT transcripts are checked for the removed auto-eye-closing instruction; the five-conversation snapshot is refreshed. Professional review of individual suitability/dose remains a separate requirement, not a missing software test.


## Classifier and transport outage recovery (2026-10-13)

Provider errors/malformed classifier responses now return a technical HOLD with Zkusit znovu, rather than SCOPE_UNCLEAR. Preserve original input and pending question/budget in the existing per-user client conversation state; clear stale action/explanation. Until that request is processed, navigation/completion/new goals do not revive old exercise. Explicit unsupported medical topics still take precedence and clear retry.

The retry wrapper replays the original text and only the original temporal question/assignment context; server-owned health fields remain fresh. Successful processing clears retry; another failure retains it. The launcher retains input for 200 technical responses and transport/non-200 errors, persists its failure response for restoration, and preserves later unsent drafts. No new server-side health-data queue is created; recovery is local to that browser conversation, not across devices or discarded client storage.

Run `run-gait-matrix.mjs --classifier-outage` for six injected fault/recovery/scope journeys without provider calls. Real live-provider failures remain BLOCKED in the separate live suites. The tests also cover repeated skip after a lost response and a prior-day action confirmation, which must not become a new completion. Sequential duplicate skips are suppressed with read-before-write; this is not a database-atomic concurrency guarantee.

`test-retry-ui.mjs` executes the production launcher request handler with mocked authFetch/storage/DOM: transport error, HTTP error, server technical response, chip wiring, restored request and draft retention. This is not real browser, authentication or microphone/ASR testing. CI now runs both suites. Medical eligibility and exercise protocols are unchanged.
