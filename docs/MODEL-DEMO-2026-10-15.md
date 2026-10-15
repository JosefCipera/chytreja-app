# Trial public links — CRT and longevity universe

Scope: a small provisional entry below the homepage try button and next to the existing founder model demo. Header menu, subtitle, five steps, account flow and paid offer are unchanged. Privacy PR #81 remains paused and unmerged.

Routes: /ukazka/crt and /ukazka/vesmir (including trailing slash). Both open app/ukazka.html. Tabs switch between the same two static views without adding history entries; back returns to the originating web page when present.

CRT uses the existing Kovářová test baseline, not a database account:
- topology/levels/branches: test/snapshots/kovarova.json
- public labels/types: data/crt/longevity-states.json
- 14 nodes and 14 edges, with no new inferred connections.
The existing script scripts/test-nba-kovarova.mjs states that this fixture has no real DB account. The raw health fixture is not copied into the public demo dataset. Josef's profile is not published.

Universe uses data/universes/longevity/models/longevity.json, whitelisted to id, label, definition, color, parent and related. It does not show personal readiness scores or imply an evaluated health state.

Generated public data: app/assets/landing/model-demo-data.json. Browser checks compare this projection against those source files to detect accidental new/missing edges or profile fields.

The viewer is a separate, small SVG browser preview of those existing models. It does not replace or modify the signed-in CRT/Cytoscape or Universe/vis-network application. No Firebase initialization, Supabase/AI request, profile lookup, localStorage, health input or payment is performed by this preview. No medications/measurements/UIDs from test/fixtures are included.

This is provisional exploration, not a Mafia Offer, a personalized analysis or a clinical validation of the underlying model. Existing app/login paths and the paused privacy work remain separate.
