# CHJ DEVLOG — Aktuální stav vývoje

> Handoff dokument pro nové Claude session. Stručný přehled: co funguje, co bylo opraveno, co zůstává otevřené.
> Aktualizováno: 2026-08-31 · Canonical docs → `CHJ-ENGINE-ARCHITECTURE.md`, `CHJ-PRODUCT-ARCHITECTURE.md`, `CLAUDE.md`

---

## Práce z 31. 8. 2026

### P1B PRIVATE DATA PATH — ✅ CLOSED (`99c65c0`)

**Cíl P1B:** Odstranit všechny browser-direct přístupy na privátní Supabase tabulky/RPC z frontend JS.

**Výsledek: PRIVATE browser Supabase accesses = 0**

Fresh scan `app/js/**` po commitu `99c65c0`:
- Žádný `supabaseClient.from(user_*)` — 0 nálezů
- Žádný `supabase.from(user_*)` — 0 nálezů
- Žádný `.rpc(...)` — 0 nálezů

Public content reads zůstávají záměrně (`longevity_nodes`, `longevity_articles`, `longevity_media`, `longevity_docs`, `universe_nodes`) — strukturální data aplikace, ne user data. Migrují se v P2 (RLS).

**Scope P1B uzavřen v 5 commitech:**

| Fáze | Commit | Co |
|------|--------|----|
| P1B.1 writes | `2c296ce` | 5 nových API actions (`save-zdravi/kondice/profil`, `update-decathlon`, `wizard-step`) |
| P1B.2a reads | `4a1ec57` | `user-data-panel.js`, `onboarding-wizard.js` → `authFetch full-profile` |
| P1B.2b reads | `3e2e6df` | `notifications.js`, `data-layer.js`, `universe-panel.js` |
| P1B.2b+ dead HUD | `dab1752` | `hud.js` dead `initHUD()` větev + `universe-init.js` dead HUD import |
| P1B.2c reads | `99c65c0` | `universe-init.js` 6 private accesses → authorized API |

---

### P1B.2c Private READ Migration — CLOSED (`99c65c0`)

**Migrované call sites v `universe-init.js`:**

| # | Řádek | Původní | Nová cesta |
|---|-------|---------|-----------|
| 1 | ~174 | `supabaseClient.user_metrics` | `authFetch universe-metrics` |
| 2 | ~452 | `supabaseClient.user_constraints (injury)` | `authFetch full-profile` + filter `constraint_type==='injury'` |
| 3 | ~501 | `supabaseClient.user_metrics SELECT *` | `authFetch universe-metrics` |
| 4 | ~680 | `supabaseClient.user_metrics` | `authFetch universe-metrics` |
| 5 | ~761 | `supabaseClient.user_profiles.primary_goal` | `authFetch profile` (raw data, mapování zůstalo na klientu) |
| 6 | ~1033 | `supabaseClient.rpc calculate_vitality_score` | DEAD → smazáno |

**Nová API action v `api/user.js`:**
- `GET /api/user?action=universe-metrics&universe={universe}` → `{ metrics: [{ node_id, current_index, target_index, priority }] }`
- userId výhradně z `auth.uid`, žádná business logika na serveru

**Klíčové bezpečnostní vlastnosti:**
- mapování `primary_goal → role` zůstalo beze změny na klientu
- fallbacky a localStorage chování zachovány přesně
- demo guard (`uid === 'demo-user-123'`) zachován

**Test baseline (2026-08-31):**

| Suite | Výsledek |
|-------|---------|
| orchestrator | **312/312 PASS · 9 SKIP** |
| p1b-writes | **36/36 PASS** |
| p1b2a-reads | **10/10 PASS** |
| p1b2b-reads | **35/35 PASS** |
| auth-security | **8/8 PASS** |
| demo-abuse | **9/9 PASS** |
| launcher-static | **10/10 PASS** |

**Live smoke test `dev.iting.cz` (2026-08-31):**
- `GET /api/user?action=universe-metrics` bez tokenu → **401** ✓
- `GET /api/user?action=profile` bez tokenu → **401** ✓
- `GET /api/user?action=full-profile` bez tokenu → **401** ✓
- `POST /api/orchestrate` bez tokenu → **401** ✓
- Launcher page load → **200** ✓
- Chrome extension nedostupná — ověření načtení Vesmíru + metrics path vyžaduje manuální test s přihlášeným testerem

**Poznámka — P2 RLS:**
- `migrations/20260429_enable_rls.sql` je **SUPERSEDED / DO NOT RUN**
- P2 (RLS na privátní tabulky) bude mít vlastní nové migrační skripty
- Nezačínat P2 bez nového plánování

---

### P2 Wave 3 Prelude — PRIVATE VIEW EXPOSURE — ✅ CLOSED (`20260831_wave3_prelude_private_views.sql`)

**Datum:** 2026-08-31

**Scope:** 2 views s explicitními anon/authenticated privileges na soukromá data.

**Nález:**
- `user_bottlenecks` a `v_vitality_dashboard` měly plné anon/authenticated ACL (`arwdDxtm`)
- Příčina: PostgreSQL 17 view bez `security_invoker` option → grant-level check na underlying tables používá view owner (postgres), nikoli invoking role — přímý grant REVOKE na table by view neochránil
- Před opravou: anon SELECT na `user_bottlenecks` procházel, vracela 0 rows (datová podmínka, ne bezpečnostní blokace)
- Před opravou: anon SELECT na `v_vitality_dashboard` procházel a vracel **126 rows** — aktivní exposure celé tabulky `user_metrics` přes anon key

**Co bylo provedeno:**
- `REVOKE ALL PRIVILEGES ON TABLE user_bottlenecks FROM anon, authenticated` ✓
- `REVOKE ALL PRIVILEGES ON TABLE v_vitality_dashboard FROM anon, authenticated` ✓
- Žádné RLS/policy/function/table/data změny

**Verifikace (live DB, 2026-08-31):**
- anon SELECT `user_bottlenecks` → **ERROR 42501 permission denied** ✓
- anon SELECT `v_vitality_dashboard` → **ERROR 42501 permission denied** ✓
- authenticated SELECT obou views → **ERROR 42501** ✓
- service_role row counts: `user_bottlenecks` = 0, `v_vitality_dashboard` = 126 ✓
- Raw ACL: pouze `postgres` a `service_role` zachovány ✓

---

### P2 Wave 3E — ASPIRATIONS / DECATHLON PRIVATE DATA — ✅ CLOSED (`20260901_wave3e_aspirations_decathlon_private_rls.sql`)

**Datum:** 2026-09-01

**Scope:** 2 tabulky — aspiration + decathlon private user data.

| Tabulka | Řádky (baseline) |
|---|---|
| `user_aspirations` | 2 |
| `user_decathlon` | 17 |

**Pre-flight (live DB, 2026-09-01):**
- Baseline rows: 2 / 17
- RLS OFF 2/2, FORCE RLS OFF 2/2
- Zero policies 2/2
- anon/authenticated měli full table ACL (`arwdDxtm`) na obou
- Zero PUBLIC grants
- Zero FK na obou tabulkách
- Zero triggers na obou tabulkách
- PRIVATE direct browser access = 0
- Aktivní API callers (`api/aspiration.js`, `api/user.js`, `api/chat.js`, `api/sources.js`, `api/orchestrator.js`) používají Firebase `requireAuth` + server-side `service_role`
- `api/user.js` main handler (řádky 14–20) vkládá `auth.uid` do `req.body.userId` / `req.query.userId` před každým sub-handlerem — klient nemůže podstrčit jiný `userId`
- Zero DB functions dotýkajících se těchto tabulek přímo

**user_bottlenecks view (pre-Wave 3E):**
- View závisí na `user_aspirations` + `user_metrics`
- View ACL = `{postgres, service_role}` — anon/auth SELECT již REVOKE'd v Wave 3 Prelude
- service_role má BYPASSRLS → lockdown `user_aspirations` server-side view path neovlivní

**Applied:**
- `REVOKE ALL PRIVILEGES FROM anon, authenticated` — 2/2
- `ENABLE ROW LEVEL SECURITY` — 2/2
- Zero CREATE POLICY, zero DROP POLICY, zero GRANT, zero DML
- `service_role` untouched, functions/views/triggers untouched
- `user_bottlenecks` view definition/ACL nedotčena

**Post-verifikace (live DB, 2026-09-01):**
- RLS ON 2/2, FORCE RLS OFF 2/2
- Zero policies 2/2
- Raw ACL: pouze `postgres` + `service_role` na obou
- anon grants = zero, authenticated grants = zero, PUBLIC grants = zero
- Effective anon/auth CRUD: **16/16 kombinací = false**
- Service_role access preserved (BYPASSRLS): asp_sel=true, dec_sel=true
- Row counts unchanged: `user_aspirations` = 2, `user_decathlon` = 17
- FK = 0, triggers = 0

**user_bottlenecks post-verifikace:**
- ACL unchanged: `{postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}`
- anon SELECT = false, authenticated SELECT = false
- service_role SELECT = true
- Empirický `SELECT COUNT(*) FROM public.user_bottlenecks` proběhl bez chyby (result = 0 — datová podmínka)
- Server-side view path preserved

**HTTP runtime smoke:** NOT TESTED — platný Firebase tester token nebyl k dispozici.
Static runtime-path verification = PASS. Service_role DB verification = PASS.

**Rollback:** Žádný rollback nebyl proveden. Obnovení anon/auth grantů nebo DISABLE RLS by bylo SECURITY-REGRESSIVE.

**Verdict: P2 Wave 3E CLOSED.**

---

### P2 Wave 3D — LOG / HISTORY PRIVATE DATA — ✅ CLOSED (`20260901_wave3d_log_history_private_rls.sql`)

**Datum:** 2026-09-01

**Scope:** 3 tabulky — log / history private user data.

| Tabulka | Řádky (baseline) |
|---|---|
| `vitality_score_history` | 18 |
| `mission_log` | 13 |
| `orchestrator_log` | 146 |

**Pre-flight (live DB, 2026-09-01):**
- Baseline rows: 18 / 13 / 146
- RLS OFF 3/3, FORCE RLS OFF 3/3
- Zero live policies 3/3
- anon/authenticated měli full table ACL (`arwdDxtm`) na všech 3
- Zero PUBLIC grants
- PRIVATE direct browser access = 0 (universe-panel.js volá `/api/mission-log` přes API proxy, nikoli přímý Supabase přístup)
- Aktivní API callers (`api/mission-log.js`, `api/mission-complete.js`, `api/orchestrator.js`, `api/hud-data-bulk.js`, `api/user.js`) používají Firebase `requireAuth` + server-side `service_role`

**Historical note:**
- Superseded migrace `20260429_enable_rls.sql` obsahovala `USING(true)` policies pro `mission_log` a `orchestrator_log` (`"phase1_read_mission_log"`, `"phase1_read_orchestrator_log"`) — tyto by po ENABLE RLS vystavily všechny řádky cross-user
- Tyto policies v LIVE DB neexistovaly (migrace nebyla spuštěna) — confirmed live `pg_policies` query
- Žádný DROP POLICY proto nebyl potřeba

**Applied:**
- `REVOKE ALL PRIVILEGES FROM anon, authenticated` — 3/3
- `ENABLE ROW LEVEL SECURITY` — 3/3
- Zero CREATE POLICY, zero DROP POLICY, zero GRANT, zero DML
- `service_role` untouched, functions/RPC/triggers/views untouched

**Post-verifikace (live DB, 2026-09-01):**
- RLS ON 3/3, FORCE RLS OFF 3/3
- Zero policies 3/3
- Raw ACL: pouze `postgres` + `service_role` na všech 3
- anon grants = zero, authenticated grants = zero, PUBLIC grants = zero
- Effective anon/auth CRUD: **24/24 kombinací = false**
- Anon SELECT: **3/3 ERROR 42501 permission denied**
- Service_role access preserved (BYPASSRLS)
- Row counts unchanged: `vitality_score_history` = 18, `mission_log` = 13, `orchestrator_log` = 146
- Data untouched
- `orchestrator_log.node_id → longevity_nodes.id ON DELETE SET NULL` preserved
- Triggers = 0, Views = 0

**DB functions dotýkající se `vitality_score_history`:**
- `calculate_vitality_score(p_user_id text, p_universe text)` — SECURITY INVOKER, owner=postgres
- `recompute_vitality(p_user_id text, p_universe text)` — SECURITY INVOKER, owner=postgres
- Obě funkce zachovány beze změny, EXECUTE granty nezměněny
- Po lockdownu: anon volání těchto funkcí = denied na tabulce (INVOKER) — zero runtime dopad (žádný API endpoint tyto funkce nevolá)

**HTTP runtime smoke:** NOT TESTED — platný Firebase tester token nebyl k dispozici.  
Static runtime-path verification = PASS. Service_role DB verification = PASS.

**Rollback:** Žádný rollback nebyl proveden. Obnovení anon/auth grantů nebo DISABLE RLS by bylo SECURITY-REGRESSIVE.

**Verdict: P2 Wave 3D CLOSED.**

---

### P2 Wave 3C — ENGINE PRIVATE DATA — ✅ CLOSED (`20260831_wave3c_engine_private_rls.sql`)

**Datum:** 2026-08-31

**Scope:** 4 tabulky — engine/check-in private user data.

`daily_checkin` · `node_state_history` · `node_inputs` · `user_readiness`

**Pre-flight (live DB + fresh HEAD scan):**
- Row counts baseline: `daily_checkin` = 2 · `node_state_history` = 548 · `node_inputs` = 20 · `user_readiness` = 65
- RLS OFF 4/4, anon/authenticated měli full table privileges (arwdDxtm)
- PRIVATE browser-direct access = 0
- Aktivní runtime callers používají Firebase auth + server-side service_role

**Critical finding:**
- `node_state_history` měla dormant permissive policy: `"Allow read by user_id"`
- role = `public`, command = `SELECT`, `USING(true)` — žádný user_id filtr
- Policy by po prostém `ENABLE RLS` umožnila cross-user SELECT všech 548 řádků
- Policy odstraněna atomicky PŘED `ENABLE RLS` v téže transakci

**Co bylo provedeno:**
- `DROP POLICY "Allow read by user_id" ON public.node_state_history` ✓
- `REVOKE ALL PRIVILEGES ON TABLE … FROM anon, authenticated` — 4/4 ✓
- `ENABLE ROW LEVEL SECURITY` — 4/4 ✓
- Zero CREATE/DROP POLICY (kromě DROP výše), zero GRANT, zero DML
- service_role untouched; functions/RPC/triggers/views nedotčeny

**Post-migration verifikace (live DB, 2026-08-31):**
- RLS ON 4/4 ✓
- Zero policies 4/4 — dangerous `"Allow read by user_id"` = GONE ✓
- Raw ACL: `{postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}` na 4/4 ✓
- Effective SELECT/INSERT/UPDATE/DELETE = false pro anon i authenticated — všech 32 kombinací ✓
- anon SELECT → **ERROR 42501** na 4/4 ✓
- service_role row counts = 2 / 548 / 20 / 65 — data nedotčena ✓
- FK `node_state_history.node_id → longevity_nodes.id ON DELETE CASCADE` zachován ✓
- Triggers = 0 (beze změny) ✓

**Relevantní DB funkce:**
`compute_leaf_state`, `compute_trend`, `create_daily_snapshots`, `update_all_node_states`
— všechny zůstaly SECURITY INVOKER; definice i EXECUTE grants beze změny.
RPC/function EXECUTE hardening zůstává separátní pozdější scope (Wave 3F).

**HTTP runtime smoke = NOT TESTED** (platný Firebase tester token nebyl v session).
Static runtime-path verification = PASS.

**Rollback note:**
- Obnovení anon/auth grantů = SECURITY-REGRESSIVE (znovu otevírá private data)
- Obnovení `"Allow read by user_id" TO public USING(true)` = CRITICALLY SECURITY-UNSAFE
- Žádný rollback nebyl proveden.

**Verdict: P2 Wave 3C CLOSED.**

---

### P2 Wave 3A — LOW-RISK PRIVATE DATA — ✅ CLOSED (`20260831_wave3a_low_risk_private_rls.sql`)

**Datum:** 2026-08-31

**Scope:** 3 tabulky — low-risk private data, zero active runtime callers.

`user_supplements` · `user_fitness_tests` · `user_integrations`

**Pre-flight (live DB + fresh HEAD scan):**
- Row counts baseline: `user_supplements` = 6 · `user_fitness_tests` = 8 · `user_integrations` = 4
- RLS OFF 3/3, dormant policies = 0
- PUBLIC grants = 0, FK = 0, triggers = 0
- DB functions/RPC dependencies = 0, view dependencies = 0
- Active runtime callers = 0 (fresh scan `api/`, `app/`, `scripts/`)
- PRIVATE browser-direct access = 0

**Co bylo provedeno:**
- `REVOKE ALL PRIVILEGES ON TABLE … FROM anon, authenticated` — 3/3 ✓
- `ENABLE ROW LEVEL SECURITY` — 3/3 ✓
- Zero CREATE/DROP POLICY, zero DML, service_role untouched

**Post-migration verifikace (live DB, 2026-08-31):**
- RLS ON 3/3 ✓
- Zero policies 3/3 ✓
- Zero explicit anon/auth grants 3/3 ✓
- Effective SELECT + INSERT = false pro anon i authenticated 3/3 ✓
- PUBLIC grants = zero ✓
- Raw ACL po migraci: `{postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}` na 3/3 ✓
- anon SELECT → **ERROR 42501** na 3/3 ✓
- authenticated access blocked (effective privileges = false) ✓
- service_role SELECT zachován, row counts = 6 / 8 / 4 — data nedotčena ✓
- HTTP runtime smoke = NOT APPLICABLE (zero active runtime callers)

**Rollback (pouze pro emergency, nebyl proveden):**
```sql
ALTER TABLE public.user_supplements DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE public.user_supplements TO anon, authenticated;
ALTER TABLE public.user_fitness_tests DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE public.user_fitness_tests TO anon, authenticated;
ALTER TABLE public.user_integrations DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE public.user_integrations TO anon, authenticated;
```

---

### P2 Wave 3B — HEALTH PRIVATE DATA — ✅ CLOSED (`20260831_wave3b_health_private_rls.sql`)

**Datum:** 2026-08-31

**Scope:** 4 tabulky — health private user data, many active server callers.

`user_health_profile` · `user_medications` · `user_constraints` · `user_lab_results`

**Pre-flight (live DB + fresh HEAD scan):**
- Row counts baseline: `user_health_profile` = 11 · `user_medications` = 47 · `user_constraints` = 10 · `user_lab_results` = 291
- RLS OFF 4/4, dormant policies = 0
- PUBLIC grants = 0, FK = 0, view dependencies = 0
- `user_health_profile` má trigger `trg_uhp_updated` (BEFORE UPDATE, SECURITY INVOKER, `update_uhp_timestamp()` — pouze `NEW.updated_at = now()`) — bezpečný po migraci: anon/auth blokováni na grant vrstvě, service_role BYPASSRLS
- DB function reference: pouze trigger function `update_uhp_timestamp()` (nereferencuje tabulky přímo)
- Active server callers: `api/user.js`, `api/tools/parse.js`, `api/orchestrate.js`, `api/hud-data-bulk.js`, `api/tts.js`, `api/tester-reset.js` — všichni Firebase auth + service_role
- PRIVATE browser-direct access = 0

**Co bylo provedeno:**
- `REVOKE ALL PRIVILEGES ON TABLE … FROM anon, authenticated` — 4/4 ✓
- `ENABLE ROW LEVEL SECURITY` — 4/4 ✓
- Zero CREATE/DROP POLICY, zero DML, service_role untouched
- trigger/functions/RPC/views nedotčeny

**Post-migration verifikace (live DB, 2026-08-31):**
- RLS ON 4/4 ✓
- Zero policies 4/4 ✓
- Raw ACL: `{postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}` na 4/4 ✓
- Effective SELECT/INSERT/UPDATE/DELETE = false pro anon i authenticated — všech 32 kombinací ✓
- anon SELECT → **ERROR 42501** na 4/4 ✓
- service_role SELECT: row counts = 11 / 47 / 10 / 291 — data nedotčena ✓
- `trg_uhp_updated` zachován beze změny ✓
- HTTP runtime smoke = NOT TESTED (platný Firebase tester token nebyl v session)
- Static runtime-path verification = PASS

**Verdict: P2 Wave 3B CLOSED.**

---

### P2 Wave 3 Pilot — USER_BIOMETRICS RLS — ✅ CLOSED (`20260831_wave3_pilot_user_biometrics_rls.sql`)

**Datum:** 2026-08-31

**Scope:** 1 tabulka — `public.user_biometrics` — první private user-data tabulka v P2 Wave 3.

**Pre-flight stav (před migrací):**
- row count: 2
- RLS: OFF, zero policies (zero dormant), zero FK/triggers/functions/views závislostí
- Raw ACL: anon/authenticated měly plné `arwdDxtm` granty
- Jediný HEAD caller: `api/chat.js` — service_role klient + Firebase `requireAuth` + SELECT only (3 sloupce, `.maybeSingle()`)
- PRIVATE browser-direct access: 0
- 0-rows handling v calleru ověřen staticky (`latestBio?.waist_cm` — graceful null)

**Co bylo provedeno:**
- `REVOKE ALL PRIVILEGES ON TABLE user_biometrics FROM anon, authenticated` ✓
- `ENABLE ROW LEVEL SECURITY` ✓
- Žádné CREATE/DROP POLICY, žádné GRANT, žádné DML, žádné jiné DB objekty

**Verifikace (live DB, 2026-08-31):**
- `rowsecurity = true` ✓
- policies = **0** ✓
- anon/authenticated explicit privileges = **zero** (information_schema: 0 řádků) ✓
- `has_table_privilege` effective SELECT/INSERT pro anon i authenticated = **false** ✓
- PUBLIC grants = **zero** (žádný prázdný grantee v relacl) ✓
- Raw ACL po migraci: `{postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres}` ✓
- anon SELECT → **ERROR 42501 permission denied** (grant-layer denial) ✓
- authenticated access blocked (effective privileges = false) ✓
- service_role SELECT COUNT = **2** — data nedotčena ✓

**HTTP /api/chat runtime smoke:** NOT TESTED — platný Firebase tester token nebyl dostupný v session. Static runtime-path verification PASS (service_role klient, `requireAuth` enforcement, graceful 0-rows handling).

**Rollback (pouze pro emergency, nebyl proveden):**
```sql
ALTER TABLE public.user_biometrics DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE public.user_biometrics TO anon, authenticated;
```

---

### P2 Wave 1 — PUBLIC CONTENT RLS — ✅ CLOSED (`20260831_wave1_public_content_rls.sql`)

**Datum:** 2026-08-31

**Scope:** 12 public content tables — žádná privátní user data nedotčena.

**Tabulky:**
`longevity_nodes`, `longevity_articles`, `longevity_media`, `longevity_actions`,
`universe_nodes`, `aspiration_requirements`, `node_riders`,
`node_articles`, `node_media`, `node_docs`, `onboarding_questions`, `universes`

**Co bylo provedeno:**
- RLS enabled: **12/12** ✓
- anon/authenticated grants: sníženy na **SELECT only** (REVOKE INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES) ✓
- SELECT policies: **12 policies `USING(true)`** pro anon, authenticated ✓

**Verifikace (live DB, 2026-08-31):**
- anon SELECT 12/12 tabulek → data dostupná (row counts zachovány) ✓
- REST publishable/anon path → data čitelná ✓
- anon INSERT attempt → **ERROR 42501 permission denied** ✓
- authenticated DB role SELECT → data čitelná ✓
- service_role přístup k privátním tabulkám → nezměněn ✓
- žádná privátní tabulka nedotčena ✓

**Poznámky:**
- `migrations/20260429_enable_rls.sql` zůstává **SUPERSEDED / DO NOT RUN**
- Wave 2 (deprecated legacy tables: `knowledge_nodes`, `nodes`) — viz níže ✅
- Wave 3 (private user tables) — vyžaduje samostatné plánování

---

### P2 Wave 2 — SERVER-ONLY / DEPRECATED RLS — ✅ CLOSED (`20260831_wave2_server_only_rls.sql`)

**Datum:** 2026-08-31

**Scope:** 7 tabulek — server-only (TOC, RxNorm cache) + deprecated legacy. Žádná privátní user data nedotčena.

**Nově RLS ON (5 tabulek):**
`toc_zakazky`, `toc_pracoviste`, `toc_parametry` — server-only (api/toc.js, service_role)
`knowledge_nodes`, `nodes` — deprecated legacy, žádní aktivní calleři

**Již chráněné — pouze grant cleanup (2 tabulky):**
`drug_inn_cache` — RLS ON + `service_role_all` policy zachována
`toc_hlavni_plan` — RLS ON + zero public policies zachovány

**Co bylo provedeno:**
- anon/authenticated table privileges = **zero** na 7/7 tabulkách (REVOKE ALL incl. SELECT) ✓
- RLS enabled: **7/7** ✓ (5 nově + 2 zachovány)
- public policies pro anon/authenticated: **zero** (Wave 2 tabulky jsou server-only) ✓
- `drug_inn_cache` `service_role_all` policy: zachována beze změny ✓

**Verifikace (live DB, 2026-08-31):**
- anon SELECT `toc_zakazky` → **ERROR 42501 permission denied** ✓
- service_role row counts 7/7 → přesná shoda pre/post, data nedotčena ✓
- `drug_inn_cache`: 10 řádků, service_role readable ✓
- TOC READ service_role DB path (`api/toc.js` → 50+5+5+15 řádků) verified ✓
- RxNorm cache service_role DB path (`api/rxnorm.js`) verified ✓
- TOC WRITE runtime: **NOT tested** — static service_role path verified; runtime test by mutoval produkční data

**Poznámky:**
- Wave 3 (private user tables) — vyžaduje samostatné plánování

---

## Práce z 29. 8. 2026 (pokračování)

### P1B.2a Private READ Migration — CLOSED (`4a1ec57`)

**Cíl:** Odstranit zbývající browser-direct Supabase SELECT operace z `user-data-panel.js` a `onboarding-wizard.js`.

**Co bylo migrováno — 1 nový API action v `api/user.js`:**

| Action | Tabulky | Sémantika |
|---|---|---|
| `GET full-profile` | `user_profiles`, `user_constraints`, `user_decathlon`, `user_health_profile`, `user_medications` | 5 parallel queries; vrací přesnou strukturu `cachedData` z `loadAndRender()` |

**Změny:**
- `handleFullProfile`: GET only, 5 paralelních Supabase queries, response shape = přesný `cachedData` kontrakt (12 klíčů)
- `user-data-panel.js` `loadAndRender()`: nahrazena 5 browser-direct SELECTů → `authFetch('/api/user?action=full-profile')`; `supabase` import odstraněn
- `onboarding-wizard.js` `checkAndShowOnboarding()`: nahrazen 1 browser-direct SELECT → `authFetch('/api/user?action=full-profile')`, kontrola `data.profile?.age`; `supabase` import odstraněn

**Klíčové bezpečnostní vlastnosti:**
- `userId` výhradně z `auth.uid` (main handler injection) — žádný arbitrary userId v query param
- GET only (POST → 405), žádný `{...req.query}` spread do DB
- Demo bypass zachován: `userId=demo-user-123` bez tokenu → 200 (standardní chování)

**Test výsledky:**
- P1B.2a reads (10 testů): **10/10 PASS**
- P1B.1 writes: **36/36 PASS** (regrese OK)
- auth-security: **8/8 PASS**
- orchestrator: **312/312 PASS · 9 SKIP** (canonical baseline)

**Live smoke test na `dev.iting.cz` (2026-08-29):**
- `GET /api/user?action=full-profile&userId=demo-user-123` → **200**, všech 12 klíčů ✓
- Response: profile.age=55, constraint, decathlon, diagnoses, medications (active only) — reálná tester data ✓
- POST → **405** ✓
- victim uid bez tokenu → **401** ✓
- orchestrate demo → **200** ✓
- `user-data-panel.js` deployed: bez supabase importu, bez `.from()` ✓
- `onboarding-wizard.js` deployed: bez supabase importu, bez `.from()` ✓
- Žádný přímý request na privátní Supabase tabulky z browser cesty potvrzen inspekcí deployed JS

**Scope P1B.2a (pouze tyto 2 soubory):** `user-data-panel.js`, `onboarding-wizard.js`.
P1B.2b (`hud.js`, `data-layer.js`, `universe-panel.js`, `notifications.js`) — deferred.

---

### P1B.1 Private WRITE Migration — CLOSED (`2c296ce`)

**Cíl:** Odstranit všechny browser-direct Supabase WRITE operace z `user-data-panel.js` a `onboarding-wizard.js`.

**Co bylo migrováno — 5 nových API actions v `api/user.js`:**

| Action | Tabulky | Sémantika |
|---|---|---|
| `save-zdravi` | `user_health_profile` + `user_medications` | REPLACE HP fields; deactivate-all + re-upsert meds s dose |
| `save-kondice` | `user_health_profile` + `user_constraints` | REPLACE capacity; DELETE+INSERT injuries (jen pokud `injuries` přítomno); returns fresh constraints |
| `save-profil` | `user_profiles` + `user_health_profile` | partial upsert profiles (jen non-null); REPLACE lifestyle; returns fresh profile |
| `update-decathlon` | `user_decathlon` | soft-delete all + insert new active; priority:5 hardcoded |
| `wizard-step` (1/2/3) | `user_profiles`, `user_health_profile`, `user_medications` | step1: UPSERT/MERGE; step2: APPEND diagnoses + upsert meds; step3: MERGE capacity |

**Klíčové bezpečnostní vlastnosti:**
- Všechny handlery: `user_id` výhradně z `auth.uid` (main handler injection), nikdy z client payload
- Žádný `{...req.body}` spread do DB
- Cross-user attack (body.userId ≠ token.uid) → 403 z requireAuth
- `priority`, `active`, `constraint_type`, `constraint_key`, `id`, `role`, `primary_goal` — klientem neinjektovatelné

**Oprava C (resetKondice):** Původní `resetKondice` mazal pouze capacity, nedotýkal se injury constraints. Handler `save-kondice` nyní provede DELETE constraints **pouze pokud je pole `injuries` explicitně v payloadu** — `resetKondice` posílá `{ capacity: {} }` bez `injuries` → constraints nedotčeny.

**Parity:** 8/8 migrací 1:1 s původním browser kódem.

**Zbývající browser Supabase calls (P1B.2):** 5× SELECT v `loadAndRender()` v `user-data-panel.js` + 1× SELECT v `checkAndShowOnboarding()` v `onboarding-wizard.js` — pouze READ, vše v rozsahu P1B.2.

**Test výsledky:**
- P1B.1 writes (36 testů): **36/36 PASS**
- auth-security: **8/8 PASS**
- demo-abuse: **9/9 PASS**
- pre-intake: **137/137 PASS**
- launcher-static: **10/10 PASS**
- orchestrator: **312/312 PASS · 9 SKIP**

**Live smoke test na `dev.iting.cz` (demo-user-123, 2026-08-29): 26/26 PASS**
- save-zdravi/save-kondice/save-profil/update-decathlon/wizard-step 1-3: 200 OK
- 401 bez tokenu pro všechny nové actions: PASS
- 405 GET pro všechny nové actions: PASS
- `resetKondice` injury constraint SURVIVED po capacity resetu: **PASS** (Oprava C verified live)
- Josef UID bez tokenu → 401 (protected): PASS
- orchestrate demo → 200 s response: PASS

---

## Current status (2026-08-28)

Produkt je na `dev.iting.cz` (branch `main`). Engine stack je **feature-frozen a locked**.

| Komponenta | Stav |
|-----------|------|
| Health Engine v1 (`api/engine/engine.js`) | 🔒 LOCKED |
| DAILY_DECISION (`api/engine/dailyDecision.js`) | 🔒 LOCKED |
| Health Event Adapter (`api/engine/healthEventAdapter.js`) | 🔒 LOCKED — 28/28 pass |
| AI Orchestrator (`api/engine/orchestrator.js`) | 🔒 LOCKED — 31/31 pass |
| Orchestrator E2E suite (`scripts/test-orchestrator.mjs`) | ✅ **312/312 PASS · 9 SKIP = 321 kontrolních bodů** |
| Launcher UI (`app/launcher.html`) | ✅ aktivní, busy guard + renderIdle fix |
| Tester Reset (`api/tester-reset.js`) | ✅ funkční, `TESTER_UIDS` obsahuje Tester 0 + Tester 1 |

**Ověřený E2E průchod (2026-08-27) — PASS:**
`ASK → 3 evidence otázky → BUDGET_EXHAUSTED summary → spontánní sedentary_hours → ACT (Jdi na procházku 20 minut) → WHY → Hotovo → HOLD`

---

## Práce z 28. 8. 2026

### P0 Security Incident — Exposed service_role key (CLOSED)

**Nález:** Hardcoded Supabase `service_role` JWT (projekt `pionxzqtxcughvfbgadi`, masked: `eyJhbG…vmFI`) byl přítomen ve dvou git-tracked souborech:
- `app/dashboards/minidashboard-access-demo.html` — **veřejně dostupný** přes `https://dev.iting.cz/dashboards/minidashboard-access-demo.html`
- `supabase-upload/supabase-upload.js` — git-tracked, ale mimo Vercel serving

Klíč byl přítomen v git historii od commitu `6b1e476` (bezpečnostní fix `89427b7` z roku 2026 opravil `supabaseClient.js`, ale tyto dva soubory přehlédl) a ve 4 lokálních Claude worktrees.

**Containment (`cef4d25`, 2026-08-28):**
- `app/dashboards/minidashboard-access-demo.html` — smazán z repozitáře
- `supabase-upload/supabase-upload.js` — hardcoded klíč nahrazen `process.env.SUPABASE_SERVICE_ROLE_KEY` + dotenv
- Secret scan HEAD: 0 nálezů po commitu
- Regression testy: `test-pre-intake.mjs` 137/137 PASS · `test-launcher-static.mjs` 10/10 PASS

**Rotace klíče:**
- Vytvořen nový `sb_secret_…` klíč v Supabase dashboard (vedle legacy JWT — bez výpadku)
- `SUPABASE_SERVICE_ROLE_KEY` aktualizován ve Vercel env (Production + Preview + Development)
- Všechny browser klienty již používaly `sb_publishable_w29DE…` (nový formát) — žádná změna v kódu nutná
- Deployment `cef4d25` na `dev.iting.cz` ověřen přes Vercel debug trace

**Deaktivace legacy JWT:**
- Supabase → Settings → API Keys → "Disable JWT-based API keys" — provedeno 2026-08-28
- Dependency audit před akcí: žádný aktivní kód nepoužíval legacy JWT anon ani service_role pro tento projekt

**Post-rotation verification (2026-08-28):**

| Test | Výsledek |
|------|----------|
| `dev.iting.cz` Launcher | HTTP 200 ✅ |
| `/api/orchestrate` POST | HTTP 200, validní ASK response ✅ |
| `/api/hud-data-bulk` POST | HTTP 400 (správná validace) ✅ |
| `/api/crt-generate` POST | HTTP 200, CRT data ✅ |
| Smazaný soubor `/dashboards/minidashboard-access-demo.html` | HTTP 404 ✅ |
| Starý legacy `service_role` JWT (masked: `eyJhbG…vmFI`) | HTTP **401 — ODMÍTNUT** ✅ |

**> P0 EXPOSED SERVICE_ROLE INCIDENT = CLOSED**

**Otevřené (nízká priorita, klíč neplatný):** Git history rewrite (commity `6b1e476`, `0956e76`, `462994b`, `e814e27`) — deferred, repo je privátní.

---

### Identity cleanup + test baseline stabilizace

**Test infrastructure audit** (`ff3337b`, `bd91ff8`):
- Migrovány všechny test/tracer skripty z `vPrm5...` (smazaný Firebase účet) na ephemeral UID nebo Tester 0 se snapshot/restore.
- Opravena non-deterministická podmínka `passed += N` → explicitní `skip(count, label)`.
- **Nový baseline:** `312/312 PASS · 9 SKIP = 321 kontrolních bodů** (dříve `306/321` se 15 known N/O failures).
- Příčina původní anomálie `321 vs 320`: `scenarioE` měl guard `passed += 4` ale normální cesta má 5 asserci → +1 s vPrm5 v ACT mode.

**Supabase identity cleanup** (`migrations/20260828_orphan_cleanup.sql`):
- Smazáno **3 914 řádků** ze 11 tabulek (z 19 skenovaných), 20 UID.
- Delete set: `vPrm5...` (Josef old/AUTH DELETED), `mfiTH...` (TOC seed), 9 identity-audit orphanů, 8 SAFE SCRIPT fake UID, 2 leaked ephemeral.
- Hard-fail guard: průnik protected × delete set ověřen programaticky před každým DELETE.
- POST-VERIFY: 0 řádků ve všech 19 user-scoped tabulkách. 7 ACTIVE UID nedotčeno.
- Regression testy po cleanupuo: **312/312 PASS**, nulová test-* pollution.

---

---

## Práce z 28.–29. 8. 2026 (pokračování)

### P1A Authorization Foundation — IDOR fix (CLOSED)

**Problém:** Systémový IDOR — všechny user-scoped API endpointy přijímaly `userId` z `req.body` / `req.query` bez ověření Firebase identity. Útočník s platným nebo žádným tokenem mohl číst/zapisovat data libovolného uživatele pouhou změnou `userId` v requestu.

**Rozsah:** 14 endpointů, 12 frontend modulů.

**Oprava (commit `16e7ac7`, 2026-08-29):**

Nové soubory:
- `api/lib/requireAuth.js` — Firebase Admin `verifyIdToken` middleware; server-authoritative `auth.uid`; demo bypass pouze pro pevné `demo-user-123`; žádný deployed impersonation bypass — testy mockují `verifyIdToken` přes `_hooks`
- `app/js/universe/authFetch.js` — frontend auth-aware fetch; `window.authFetch` global pro non-module skripty (launcher.js)
- `scripts/test-auth-security.mjs` — 8 bezpečnostních scénářů, mock-only
- `scripts/test-demo-abuse.mjs` — 9 demo bypass abuse scénářů

Zabezpečené endpointy (všechny nyní používají `auth.uid` pro DB queries, nikdy `req.body.userId`):
`orchestrate`, `orchestrator`, `hud-data-bulk`, `mission-log`, `mission-complete`, `aspiration`, `chat`, `engine-v1`, `tts` (podmíněně), `sources` (podmíněně), `crt-generate`, `user` (injection pattern přes sub-handlery), `toc`, `tools/parse`, `notify` (subscribe: auth vyžadována při claimed userId)

Záměrně public (beze změny): `pre-intake`, `crt-contra`, `rxnorm`, `tester-reset` (TESTER_UIDS whitelist)

**Bezpečnostní architektura:**
- `auth.uid` vždy pochází z Firebase tokenu — klient nemůže přepsat
- Demo bypass: `userId === 'demo-user-123'` → `auth.uid = demo-user-123` pro všechny DB queries; reálná data nedostupná
- TEST_AUTH_BYPASS odstraněn — produkční i dev/preview endpointy nemají impersonation bypass
- `notify.js` subscribe: reálný userId v těle vyžaduje odpovídající Firebase token (oprava: útočník nemůže zaregistrovat push endpoint pod cizím UID)

**Regression testy (lokální, před pushem):**

| Suite | Výsledek |
|-------|---------|
| `test-auth-security.mjs` | **8/8 PASS** |
| `test-demo-abuse.mjs` | **9/9 PASS** |
| `test-pre-intake.mjs` | **137/137 PASS** |
| `test-launcher-static.mjs` | **10/10 PASS** |
| `test-orchestrator.mjs` | **312/312 PASS · 9 SKIP** |

**Live smoke test na `dev.iting.cz` (2026-08-29):**

| Test | Výsledek |
|------|---------|
| `app/launcher.html` loads | ✅ HTTP 200 |
| `app/` (index) loads | ✅ HTTP 200 |
| POST `/api/pre-intake` (public, bez auth) | ✅ HTTP 200 (správná validace vstupu) |
| POST `/api/orchestrate` (bez tokenu, reálný userId) | ✅ HTTP 401 |
| POST `/api/hud-data-bulk` (bez tokenu) | ✅ HTTP 401 |
| POST `/api/mission-log` (bez tokenu) | ✅ HTTP 401 |
| POST `/api/chat` (bez tokenu) | ✅ HTTP 401 |
| GET `/api/user?action=profile` (bez tokenu) | ✅ HTTP 401 |
| GET `/api/hud-data-bulk?userId=…` (bez tokenu) | ✅ HTTP 401 |
| POST `/api/orchestrate` (neplatný token) | ✅ HTTP 401 |
| POST `/api/hud-data-bulk` (neplatný token) | ✅ HTTP 401 |
| POST `/api/chat` (neplatný token) | ✅ HTTP 401 |
| POST `/api/orchestrate` (demo-user-123, bez tokenu) | ✅ HTTP 200 — demo ASK response |
| POST `/api/orchestrate` (Josef UID `vPrm5…`, bez tokenu) | ✅ HTTP 401 |
| POST `/api/notify` subscribe (real UID, bez tokenu) | ✅ HTTP 404 (viz níže) |
| POST `/api/notify` subscribe (anonymous, bez userId) | ✅ HTTP 200 (anon subscription OK) |

Poznámka k 404 pro `/api/aspiration` a `/api/notify`: Vercel vrací `X-Vercel-Error: NOT_FOUND` — jde o pre-existing deployment issue (obě funkce byly v commitu `1850aaa` před P1A a pravděpodobně nikdy neprocházely přes Vercel routing). Auth kód v obou souborech je správný; endpointy jsou momentálně nedostupné. Vyžaduje separátní Vercel deployment/routing audit — není bezpečnostní regrese P1A.

Authenticated user → 200 a token A + userId B → 403 nelze ověřit live bez reálného Firebase ID tokenu — pokryto unit testy (`test-auth-security.mjs` scénáře 3–5).

**> P1A AUTHORIZATION FOUNDATION = CLOSED**

**Otevřené (separátní úkoly):**
- **P1B:** Přímé private Supabase volání z frontendu → přesunout za API endpointy (`user.js` nové actions)
- **P2:** RLS lockdown — `migrations/20260429_enable_rls.sql` připravena, nespuštěna v Supabase

---

### P1A.1 — Vercel routing fix pro aspiration + notify (CLOSED)

**Root cause:** `.vercelignore` obsahoval `api/aspiration.js` a `api/notify.js` s komentářem o limitu 12 serverless funkcí (Hobby plán). Projekt běží na Pro plánu — limit neplatí. Oba endpointy nebyly nasazeny, Vercel vracel `X-Vercel-Error: NOT_FOUND`.

**Oprava (commit `68a615e`, 2026-08-29):** Odstraněny dva řádky z `.vercelignore`. `api/orchestrator.js` ponechán (interní modul). Stará dead entries (`readiness.js` atd.) beze změny.

**Live ověření `dev.iting.cz` po deploymentu:**

| Test | Výsledek |
|------|---------|
| GET `/api/aspiration` (real uid, no token) | ✅ 401 |
| GET `/api/aspiration` (invalid token) | ✅ 401 |
| GET `/api/aspiration` (demo-user-123) | ✅ 200 — function reached |
| POST `/api/notify` subscribe (real uid, no token) | ✅ 401 |
| POST `/api/notify` subscribe (invalid token) | ✅ 401 |
| POST `/api/notify` subscribe (anonymous) | ✅ 500 — not auth-blocked |
| Ostatní endpointy (orchestrate, chat, hud-data-bulk, launcher) | ✅ beze změny |

**> P1A.1 = CLOSED**

---

## Práce z 26.–27. 8. 2026

### 1. BUDGET_EXHAUSTED dead-end

**Problém:** Pokud uživatel vyčerpal počet otázek (`qbudget=0`) před tím, než engine dostal dostatek dat, Launcher zasekl — input se zavřel, uživatel nemohl pokračovat.

**Oprava:** Non-acute BUDGET_EXHAUSTED otevře input a zobrazí shrnutí aktivních uzlů (node label summary), aby uživatel mohl dodat zbývající informaci. Acute BUDGET_EXHAUSTED zůstává terminální.

**Commit:** `f86fcec` · Soubor: `app/js/universe/launcher.js`

---

### 2. ZERO_DATA_FOLLOWUP + runtime bug `warnings is not defined`

**Problém A:** Po obdržení odpovědi bez žádných zdravotních dat (prázdný ASK follow-up) engine zavolal DAILY_DECISION, ale bez dat → nekonečná ASK smyčka.

**Oprava A:** `ZERO_DATA_FOLLOWUP` guard — pokud uživatelův vstup neobsahuje žádná zdravotní data, orchestrátor vrátí soft ASK místo volání engine. Commit: `fc2df62` · Soubor: `api/engine/orchestrator.js`

**Problém B:** Runtime chyba `warnings is not defined` při ZERO_DATA_FOLLOWUP větvi — proměnná `warnings` nebyla deklarována v tomto kódu path.

**Oprava B:** Inicializace `warnings` před použitím. Commit: `c582469` · Soubor: `api/engine/orchestrator.js`

---

### 3. P3 NBA policy — tier → time_to_feedback → friction

**Rozhodnutí:** NBA ranking přidává prioritizaci: nejdřív `starter` tier, pak `time_to_feedback` (rychlejší feedback = výše), pak `friction` (nižší = výše). Cíl: nový uživatel dostane co nejdřív pozitivní smyčku.

**Výsledek:** Pro `PHYSICAL_INACTIVITY` constraint engine vybírá `Jdi na procházku 20 minut` (starter, nízká friction, rychlý feedback) před agresivnějšími alternativami.

**Commit:** `c0e1304` · Soubor: `api/engine/engine.js` (🔒 LOCKED — tato oprava byla poslední)

---

### 4. ACTION_COMPLETED → HOLD + potvrzovací text

**Problém:** Po kliknutí `Hotovo` (ACTION_COMPLETED event) se orchestrátor dostal do HOLD stavu, ale text HOLD byl generický — nepotvrzoval dokončení akce, jen říkal "výsledky dozrávají".

**Oprava:** Nová větev v `buildHoldResponse()`: pokud `event_type === 'ACTION_COMPLETED'`, vrátí explicitní potvrzení `Hotovo. Pro dnešek stačí. Výsledek budeme hodnotit až po několika opakováních.`

**Commit:** `67565a4` · Soubor: `api/engine/orchestrator.js` (🔒 LOCKED)

---

### 5. Tester Full Reset — busy guard + renderIdle terminal-state restore

**Přístup k Full Reset:** Tester panel (Session reset + Full reset ⚠) je viditelný pouze při `?tester=1` v URL — tedy `/launcher?tester=1`. Toto je záměrný interní vstup. `Ctrl+Shift+R` (hard reload prohlížeče) Full reset **není** — pouze obnoví stránku bez dotyku DB. Whitelist `TESTER_UIDS` v `api/tester-reset.js` je autoritou — newhitelistovaný UID dostane `403`.

**Problém A — race condition:** Uživatel kliknul Full Reset během in-flight `orchestrate('Hotovo')`. Server-side INSERT do `action_assignments` přišel po reset DELETE → orphan COMPLETED row → HOLD_TOO_EARLY při každém dalším engine volání.

**Oprava A:** `busy` guard na Full Reset button — pokud je v letu request, zobrazí varování a neprovede reset.

**Problém B — terminalState:** HOLD response nastaví `_terminalState = true` (input disabled). `renderIdle()` ho neresetoval → po resetu z HOLD stavu zůstal input nepoužitelný bez reload stránky.

**Oprava B:** `renderIdle()` explicitně resetuje `_terminalState = false` a znovu zapíná `$input`, `$sendBtn`, `$micBtn`.

**Commit:** `350e8ab` · Soubor: `app/launcher.html`

**Regression testy:** `scripts/test-launcher-static.mjs` — 10/10 pass (LCH-1–10).

---

### 6. Nový tester UID v TESTER_UIDS

**Problém:** Nový tester account `e0ZYA3auBYUh9TOOtqQPqbkIcrJ2` (Tester 1) nebyl v `TESTER_UIDS` whitelist → Full Reset vracel `403` → orphan COMPLETED row přežil všechny UI resety → HOLD_TOO_EARLY při každém spuštění.

**Oprava:** Přidán do `TESTER_UIDS` jako Tester 1.

**Commit:** `00f0ce1` · Soubor: `api/tester-reset.js`

**Chráněné UID (nikdy nepřidat):** Josef `vPrm5PNzLWWWhi9sSwYVbkb9FaD3`, Kovářová (viz Supabase).

---

### 7. Subjective fatigue clarification — `fatigue_context` persistence

**Problém (P1):** `Jsem unavený.` → engine vrátil ASK s otázkou `Cítíš se při běžné chůzi stabilně?` (gait_stability), která nesouvisí se vstupem. Příčina strukturální: "unavený" se ukládá jako raw text do `symptoms[]` bez signálu do enginu, zatímco MOBILITY_NODES (GAIT_INSTABILITY atd.) mají nejvyšší urgency prioritu a dominují v NBE výběru.

**Řešení (TESTER 0.1):** Minimální clarification flow s normalizovaným `fatigue_context` polem:

1. `api/engine/healthEventAdapter.js` — přidán záznam `fatigue_context: { table: 'physical', key: 'fatigue_context' }` do `EVIDENCE_STORAGE_REGISTRY`. Umožňuje `routeAnswer('fatigue_context')` → `upsertPhysical(userId, 'fatigue_context', ...)` bez jakékoli logické změny.
2. `api/orchestrate.js` — rozšířen SELECT o `physical`, `fatigue_context` injektován do session state server-side (nikoli z klientského session).
3. `api/engine/orchestrator.js` — dvě přidání (bez mazání):
   - **Normalization guard** (před `applyHealthEvent`): normalizuje volný text odpovědi na `NEW_OR_UNUSUAL | ROUTINE | UNKNOWN` při `evidence_type === 'fatigue_context'`.
   - **Post-presentation fatigue clarification guard** (po ZERO_DATA_FOLLOWUP, před P0 budget gate): pokud `GENERAL_HEALTH_REQUEST` + fatigue text + `presentation.mode === 'ASK'` + `fatigue_context` ještě nenastaveno (cross-session) + žádná pending_question v session → vrátí clarification ASK jako **early return, který obchází budget gate** (clarification nestojí žádný budget slot).

**Výsledné chování:**
- `Jsem unavený.` → `Je ta únava něco nového nebo nezvyklého, nebo je to spíš běžná únava po náročném dni?`
- Odpověď → normalizace → `physical.fatigue_context = NEW_OR_UNUSUAL | ROUTINE | UNKNOWN` → standardní engine flow
- Příští session: `fatigue_context` již v DB → guard se nespustí → standardní NBE bez opakování otázky

**Safety Gate poznámka:** `NEW_OR_UNUSUAL` v TESTER 0.1 **nespouští Safety Gate ani medicínskou eskalaci**. Aktuální Safety Gate reaguje výhradně na `pending_clarifications[].type === 'new_symptom' && temporal_context === 'acute'`. `fatigue_context` je pure label v `physical` JSONB — engine neobsahuje activation rule pro tento klíč. Eskalační logika by vyžadovala samostatné engineering rozhodnutí mimo scope TESTER 0.1.

**Testy:**
- `scripts/test-health-event-adapter.mjs` → S10 přidán → **83/83 pass**
- `scripts/test-orchestrator.mjs` → scenarioSC (SC-1–SC-6) přidán → **256/271** (15 known N/O baseline beze změny)

---

### 8. Pre-classifier fatigue guard — deterministická klasifikace standalone fatigue

**Root cause:** Haiku classifier (`classifyIntent`) porušoval vlastní pravidlo 5 pro standalone fatigue vstupy (`"Jsem unavený."`) — místo `GENERAL_HEALTH_REQUEST` vracel `NEW_SYMPTOM` v ~50 % volání. Post-presentation fatigue clarification guard (§7) závisel na `event_type === 'GENERAL_HEALTH_REQUEST'` → nefiroval při NEW_SYMPTOM → uživatel dostával gait_stability otázku místo fatigue clarification.

**Řešení:** Exportovaný `FATIGUE_STANDALONE_RE` (`^...$` anchored regex) sdílený dvěma guard body:

1. **Pre-classifier guard** (vložen před `classifyIntent` v `processInput`) — short-circuits Haiku pro standalone fatigue formulace; vrací deterministicky `GENERAL_HEALTH_REQUEST`. Podmínky: `!pending_question && !current_action_assignment && FATIGUE_STANDALONE_RE.test(userText.trim())`.
2. **Post-presentation guard** (§7) — nahrazen inline `SUBJECTIVE_FATIGUE_RE` sdíleným `FATIGUE_STANDALONE_RE`; pokrytí rozšířeno o `"Cítím únavu."` a `"Nemám energii."` (starý regex tyto tvary neznal).

**Compound zdravotní výroky zachovány:** `^...$` anchor zajišťuje, že `"Jsem unavený a bolí mě na hrudi."` neodpovídá → projde přes Haiku a standardní safety/symptom flow beze změny.

**Dotčené soubory:** `api/engine/orchestrator.js` (export + pre-classifier guard + post-presentation update) · `scripts/test-orchestrator.mjs` (import + scenarioSC update + scenarioSCR + scenarioSCE2E + scenarioSCStability)

**Nedotčeno:** `engine.js`, `dailyDecision.js`, Safety Gate, `healthEventAdapter.js`, `orchestrate.js`, launcher.

**Testy:**
- `scripts/test-health-event-adapter.mjs` → **83/83 pass** (beze změny)
- `scripts/test-orchestrator.mjs` → **306/321** (15 known N/O baseline beze změny; +50 nových SC assertions)
- **Fatigue stability: 10/10** — 10 po sobě jdoucích `processInput("Jsem unavený.")` → vždy `SUBJECTIVE_FATIGUE_CLARIFICATION`; Haiku se pro tyto vstupy nevolá

---

### 9. Phantom `floorRiseProjection` — budget-burning NBE bez možnosti ACT

**Root cause:** `floorRiseProjection()` v `api/engine/projections.js` vracela projekci vždy, i když žádné upstream node_states (PHYSICAL_DECONDITIONING, LOW_MUSCLE_STRENGTH, REDUCED_FUNCTIONAL_RESERVE) nebyly přítomné. Tím vznikal phantom `LONGEVITY_FUNCTION` kontext s `NEED_MORE_EVIDENCE` statusem, který generoval 3 NBE otázky (`validated_strength_assessment`, `temporal_activity_trend`, `vstat_ze_zeme`) a spotřeboval celý question budget — bez jakékoli možnosti dosáhnout NBA a ACT (projekce s `risk='unknown'` bez upstream uzlů nemůže vybrat leverage node).

**Symptom:** Nový uživatel s fatigue vstupem: `"Jsem unavený."` → fatigue clarification → 3 funkční testy → `BUDGET_EXHAUSTED "Zatím o tobě nevím dost"`. Přitom jedinou otázkou, která by odblokovala ACT, je `sedentary_hours_day`.

**Řešení:** Minimální guard konzistentní s `cvDiseaseProjection` (která tento guard měla od začátku):

```javascript
// api/engine/projections.js — floorRiseProjection()
if (evidence.length === 0) return null;
```

Bez upstream evidence → funkce vrátí `null` → `computeProjections` ji nevloží → žádný phantom kontext → engine přejde do `ASK_BLOCKING null` path → `ZERO_DATA_FOLLOWUP` guard se spustí po 2 turnech → `"Přibližně kolik hodin za běžný den prosedíš?"` → `sedentary_hours_day = 8` → `PHYSICAL_INACTIVITY PREDICTED_CURRENT` → leverage → NBA SELECTED → **ACT**.

S upstream evidence (PHYSICAL_DECONDITIONING aktivní): `evidence.length > 0` → guard se nespustí → projekce vznikne beze změny.

**Dotčené soubory:** `api/engine/projections.js` · `scripts/test-floor-projection-fix.mjs` (nový, 15/15 pass)

**Nedotčeno:** `engine.js`, `dailyDecision.js`, `healthEventAdapter.js`, `orchestrator.js`, Safety Gate, NBA selection.

**Testy po fixu:**
- `scripts/test-health-event-adapter.mjs` → **83/83 pass** (beze změny)
- `scripts/test-nba-policy.mjs` → **10/10 pass** (beze změny)
- `scripts/test-orchestrator.mjs` → **306/321** (15 known N/O baseline beze změny)
- `scripts/test-floor-projection-fix.mjs` → **15/15 pass** (nový)

---

## Architektura dokumentace (po 2026-08-27)

| Soubor | Role |
|--------|------|
| `CLAUDE.md` | Instrukce pro Claude, pravidla, tester safety, stack |
| `docs/CHJ-ENGINE-ARCHITECTURE.md` | Canonical engine contract — LOCKED |
| `docs/CHJ-PRODUCT-ARCHITECTURE.md` | Canonical produktová ústava — LOCKED |
| `docs/DEVLOG.md` | Tento soubor — aktuální handoff |
| `docs/archive/CHJ-ARCHITECTURE-V1.md` | Archiv — původní engine spec (2026-08-11) |
| `docs/archive/CHJ-ARCHITECTURE-V2.md` | Archiv — system-level bridge dokument (2026-08-13) |
| `docs/archive/roadmap.md` | Archiv — produktová roadmapa Fáze 1–5 (2026-03-01) |

> Poznámka: `CHJ-ENGINE-ARCHITECTURE.md` a `CHJ-PRODUCT-ARCHITECTURE.md` obsahují v hlavičkách a tabulkách reference na staré cesty (`docs/CHJ-ARCHITECTURE-V1.md`, `docs/roadmap.md`). Tyto reference jsou informační/historické — soubory existují v `docs/archive/`.

---

## Open issues / Next

| Priorita | Issue | Poznámka |
|----------|-------|----------|
| P1 UX | Tester tools v avatar menu bez `?tester=1` | Whitelistovaný tester by měl vidět Full reset automaticky po auth; potřeba `GET /api/tester-check` nebo inline UID check po Firebase auth |
| P1 QA | Orchestrator 15 known baseline failures (240/255) | Prověřit: jsou to skutečné N/O edge cases nebo latentní bugy? Zdokumentovat konkrétní scénáře. |
| Tech debt | `README.md` zastaralý | Popisuje GPT-4o-mini + vis-network epoch (Q1 2026); určen k pozdější aktualizaci — neodráží současný stack |
| Tech debt | TRACE log v `api/engine/adapter.js` | `fetchActionAssignments` loguje diagnostic trace (`[ORCHESTRATE] loaded_action_assignments=...`) — bylo záměrné pro root-cause analýzu, může být odstraněno |
| Budoucí | Orchestrator `USER_PREFERENCE` persistence | Zachyceno, ale session neukládá (záměr v0.1); v0.2 by mělo persistovat do DB |
| Budoucí | Wearables integrace (Fáze 4) | Oura, Apple Health, Garmin — viz `docs/archive/roadmap.md` |
