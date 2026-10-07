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
