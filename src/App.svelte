<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import HudPanel from './lib/components/HudPanel.svelte';
  import CheckIn from './lib/components/CheckIn.svelte';
  import { loadHudData, patchHudData, nodeData, rawData, loading, error } from './lib/stores/hudData.js';
  import { calcVitality } from './lib/utils/vitality.js';

  // ── URL PARAMS ─────────────────────────────────────────
  const params   = new URLSearchParams(window.location.search);
  const userId   = params.get('userId');
  const devMode  = params.get('dev') === '1';   // ?dev=1 → test data

  // nodeId is reactive — updated via postMessage chj:navigate (no iframe reload)
  let nodeId = $state(params.get('nodeId') || 'dlouhovekost');

  // ── CHECK-IN GATE ──────────────────────────────────────
  let readinessChecked = $state(false);   // has the check completed?
  let needsCheckIn     = $state(false);   // should we show check-in screen?

  // ── SECOND ACTION OFFER ────────────────────────────────
  // null = no offer, 'pending' = showing offer, 'declined' = user said Ne
  let secondOffer     = $state(null);
  let secondOfferText = $state('Chceš jít dál?');

  // ── AGENT ACTION (overrides DB action when available) ──
  let agentAction      = $state(null);
  let agentLoading     = $state(false); // PREPARING shown only when data.action is also null
  let panelReady       = $state(false); // panel mounts only when we have data + agentLoading state — universe shows through until then

  // ── SECOND ACTION STATE ────────────────────────────────
  let currentDiscipline = $state(null);  // discipline chosen by orchestrator
  let currentAgentType  = $state(null);  // agent type for current discipline
  let lastCompletedId   = $state(null);  // action_id of just-completed action

  const BODY_DISCIPLINES   = ['sila', 'kardio', 'stabilita'];
  const MYSL_DISCIPLINES   = ['spanek', 'kognitivni', 'emocni', 'smysl'];
  const ZDRAVI_DISCIPLINES = ['prevence', 'metabolismus'];
  const VYZIVA_DISCIPLINES = ['vyziva'];

  const VALID_DISCIPLINES = [
    'sila','kardio','stabilita','spanek','kognitivni','emocni','smysl',
    'prevence','metabolismus','vyziva',
  ];

  function normalizeAgentAction(a, nid) {
    return {
      id:       a.action_id,
      label:    a.label,
      // 'counter' → 'habit' (label already encodes sets×reps, single HOTOVO button)
      // 'distance' → 'habit' (user marks done when finished)
      type:     a.type === 'timed' ? 'timed' : 'habit',
      duration: a.duration_s ?? 60,
      reps:     a.reps ?? null,
      sets:     a.sets ?? null,
      status:   'READY',
      tier:     a.tier ?? 1,
      node_id:  nid,
      guide_search: a.guide_search ?? null,
      guide_label:  a.guide_label  ?? null,
    };
  }

  function shouldOfferSecond(data) {
    const percent = data?.life_battery?.percent ?? 50;
    const trend   = data?.life_battery?.trend ?? 'stable';   // 'up' | 'down' | 'stable'
    const streak  = data?.streak ?? 0;

    const state = percent <= 40 ? 'RED' : percent <= 70 ? 'YELLOW' : 'GREEN';

    // Always offer — text varies by state
    if (streak >= 3)                           return { offer: true, text: 'Jedeš dobře. Přidáš krok?' };
    if (state === 'RED'   && trend === 'down') return { offer: true, text: 'Můžeš to ještě posílit.' };
    if (state === 'GREEN' && trend === 'up')   return { offer: true, text: 'Držíš to. Dnes stačí, nebo přidáš?' };
    return { offer: true, text: 'Chceš jít dál?' };
  }

  // ── FALLBACK TEST DATA (dev=1 or no userId) ───────────
  const childIndices = { telo: 27, zdravi: 35, mysl: 90, vyziva: 90 };
  const testNode = {
    node_id:      nodeId,
    node_label:   nodeId === 'dlouhovekost' ? 'Hra o život' : 'Tělo',
    node_version: 'v0.2',
    life_battery: {
      percent:     nodeId === 'dlouhovekost' ? calcVitality(childIndices) : 27,
      trend:       'down',
      trend_label: 'DOWN',
      cell_vitality: 27,
    },
    metrics: { spanek: 30, vyziva: 90 },
    killer: { label: 'SRDCE', energy_drain: -8, description: 'Srdce potřebuje pohyb.' },
    action: {
      id: 'plank_60s', label: 'Drž plank 60 sekund', icon: '🏋️',
      type: 'timed', duration: 60, status: 'READY', tier: 1,
    },
    sources: [
      { med_id: 104, type: 'STUDY', title: 'Resistance Training and Cardiovascular Health', journal: 'Nature Medicine', year: 2023, status: 'VERIFIED' },
      { med_id: 88, type: 'REVIEW', title: 'Cortisol Regulation via Breathwork', journal: 'Journal of Neuroscience', year: 2024, status: 'AUTHENTICATED' },
    ],
    verdict: 'Tělo ztrácí sílu.',
    today_count: 0,
    streak: 0,
  };

  // ── LOAD REAL DATA ─────────────────────────────────────
  // ── NAVIGATE to a new node (called on postMessage or initial load) ──────────
  async function navigateTo(nid, prefetchedData = null) {
    nodeId = nid;
    agentAction = null;
    secondOffer = null;
    panelReady  = false;

    if (prefetchedData) {
      // Universe already fetched this — apply directly, no HTTP call needed
      rawData.set(prefetchedData);
      const hasCache = prefetchedData?.action?.from_agent_cache === true && prefetchedData?.verdict;
      if (!hasCache) triggerOrchestrator(userId, nid);
      panelReady = true;
    } else {
      await Promise.all([checkReadiness(), loadHudData(userId, nid)]);
      const currentData = get(rawData);
      const hasCache = currentData?.action?.from_agent_cache === true && currentData?.verdict;
      if (!hasCache) triggerOrchestrator(userId, nid);
      panelReady = true;
    }
  }

  onMount(async () => {
    if (userId && !devMode) {
      // Listen for node-switch navigation from Universe (postMessage)
      window.addEventListener('message', (e) => {
        if (e.data?.type === 'chj:navigate' && e.data.nodeId) {
          navigateTo(e.data.nodeId, e.data.data || null);
        }
      });

      // ── Day-boundary detection ─────────────────────────────────────────────
      // PWA users rarely close the app — re-check readiness whenever the app
      // returns to the foreground on a new calendar day.
      let _lastCheckedDate = new Date().toISOString().slice(0, 10);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const today = new Date().toISOString().slice(0, 10);
        if (today !== _lastCheckedDate) {
          _lastCheckedDate = today;
          checkReadiness();
        }
      });

      // ── First-open optimisation ────────────────────────────────────────────
      // The parent window calls prefetchHudNodes(userId, [nodeId]) just before
      // setting iframe.src, so the API fetch races against our own JS load.
      // We wait up to 600 ms for the parent cache to fill before falling back
      // to our own fetch — in most cases it's already there and we skip the
      // duplicate request entirely.
      let prefetchedData = null;
      try {
        const parentCache = (window.parent !== window) ? window.parent._hudCache : null;
        if (parentCache) {
          if (parentCache[nodeId]) {
            prefetchedData = parentCache[nodeId];          // already warm
          } else {
            const deadline = Date.now() + 600;
            while (Date.now() < deadline) {
              await new Promise(r => requestAnimationFrame(r)); // ~16 ms ticks
              if (parentCache[nodeId]) {
                prefetchedData = parentCache[nodeId];
                break;
              }
            }
          }
        }
      } catch { /* cross-origin guard — fall through to own fetch */ }

      await navigateTo(nodeId, prefetchedData);
    } else {
      panelReady = true;
      readinessChecked = true;
    }
  });

  async function checkReadiness() {
    try {
      const res  = await fetch(`/api/readiness?userId=${userId}`);
      const json = await res.json();
      needsCheckIn = !json.exists;
    } catch {
      needsCheckIn = false;
    } finally {
      readinessChecked = true;
    }
  }

  function onCheckInComplete() {
    needsCheckIn = false;
    // Refresh HUD data + re-run orchestrator with fresh readiness
    loadHudData(userId, nodeId);
    triggerOrchestrator(userId, nodeId);
  }

  // Volá orchestrátor → uloží rozhodnutí do orchestrator_log.
  // Pokud je disciplína tělesná → zavolá Tělo Agenta pro konkrétní akci.
  async function triggerOrchestrator(uid, nid) {
    // Only show PREPARING if we have no action yet — otherwise update silently
    // Use rawData (writable source) — get(nodeData) may be stale right after loadHudData resolves
    const currentRaw = get(rawData);
    const hasAction = !!currentRaw?.action;
    // If agent already cached an action today, don't replace it — only fetch verdict
    const hasCachedAction = currentRaw?.action?.from_agent_cache === true;
    agentLoading = !hasAction;
    try {
      const orchRes = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Co mám dnes dělat?', nodeId: nid, userId: uid }),
      });
      const orchData = await orchRes.json();

      // Orchestrator resolves discipline from DB (longevity_nodes.discipline)
      // including parent traversal — no hardcoded map needed here
      const rawDiscipline = orchData.discipline_id;
      const discipline = VALID_DISCIPLINES.includes(rawDiscipline)
        ? rawDiscipline
        : rawDiscipline; // pass through — orchestrator already resolved via DB

      const agentType = BODY_DISCIPLINES.includes(discipline)   ? 'telo'
                      : MYSL_DISCIPLINES.includes(discipline)   ? 'mysl'
                      : ZDRAVI_DISCIPLINES.includes(discipline) ? 'zdravi'
                      : VYZIVA_DISCIPLINES.includes(discipline) ? 'vyziva'
                      : null;

      // Store for second action reuse
      currentDiscipline = discipline;
      currentAgentType  = agentType;

      // Only call agent if we don't already have a cached action for today.
      // A cached action (from_agent_cache) means agent already ran today → keep it,
      // just refresh verdict/feedback without replacing the action the user sees.
      if (agentType && !hasCachedAction) {
        try {
          const agentRes = await fetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: agentType, userId: uid, discipline, nodeId: nid }),
          });
          const agentData = await agentRes.json();
          if (agentData.action_id) {
            agentAction = normalizeAgentAction(agentData, nid);
          }
        } catch (e) {
          console.warn(`[CHJ] ${agentType} Agent call failed:`, e);
        }
      }

      // Patch verdict/feedback in-place — no reload flicker
      patchHudData({
        verdict:             orchData.verdict             || null,
        completion_feedback: orchData.completion_feedback || null,
        weekly_hint:         orchData.weekly_hint         || null,
      });
    } catch (e) {
      console.warn('[CHJ] orchestrator background call failed:', e);
    } finally {
      agentLoading = false;
    }
  }

  // Active data: real store or test fallback + agent action override
  let displayData = $derived((() => {
    const base = (userId && !devMode && $nodeData) ? $nodeData : testNode;
    if (agentAction && userId && !devMode) {
      return {
        ...base,
        action: agentAction,
        completion_feedback: base.completion_feedback || null,
      };
    }
    return base;
  })());

  // ── GAME LOOP: called when user completes an action ──────
  async function handleActionComplete(actionId, actionType, actionNodeId) {
    if (!userId || devMode) return;

    const effectiveNodeId = actionNodeId || nodeId;

    // Snapshot today_count BEFORE game loop (0 = first action, 1 = second action)
    const wasCount = $nodeData?.today_count ?? 0;
    const snapData = $nodeData;

    try {
      await fetch('/api/mission-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, nodeId: effectiveNodeId, missionId: actionId, actionType }),
      });

      await fetch('/api/mission-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, nodeId: effectiveNodeId }),
      });

      if (wasCount === 0) {
        // First action just completed — remember it, offer second
        lastCompletedId = actionId;
        const result = shouldOfferSecond(snapData);
        if (result.offer) {
          secondOffer     = 'pending';
          secondOfferText = result.text;
          loadHudData(userId, nodeId); // refresh HUD in background
        } else {
          secondOffer = null;
          loadHudData(userId, nodeId);
        }
      } else {
        // Second (or more) action just completed — no more offers
        secondOffer = null;
        loadHudData(userId, nodeId);
      }

      setTimeout(() => {
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'chj:universe:refresh' }, '*');
        }
      }, 400);
    } catch (e) {
      console.error('[CHJ] game loop error:', e);
    }
  }

  async function acceptSecondAction() {
    secondOffer = null;

    // If we know the discipline + agent type, fetch a fresh second action
    if (!userId || devMode || !currentAgentType || !currentDiscipline) return;

    agentLoading = true;
    try {
      const agentRes = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: currentAgentType,
          userId,
          discipline: currentDiscipline,
          nodeId,
          force: true,                        // bypass cache
          excludeActionId: lastCompletedId,   // avoid repeating first action
        }),
      });
      const agentData = await agentRes.json();
      if (agentData.action_id) {
        agentAction = normalizeAgentAction(agentData, nodeId);
      }
    } catch (e) {
      console.warn('[CHJ] second action agent call failed:', e);
    } finally {
      agentLoading = false;
    }
  }

  function declineSecondAction() {
    secondOffer = 'declined'; // Show completion state instead
  }
</script>

{#if panelReady || !userId || devMode}
  <!-- Panel wrapper — only mounted when data is ready; universe shows through until then -->
  <div class="min-h-screen" style="background: transparent; display: flex; justify-content: flex-end;">
    <div class="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none"></div>

    {#if userId && !devMode && $error && !$rawData}
      <div class="hud-mono text-red-400/60 text-xs tracking-widest">
        ERR: {$error}
      </div>
    {:else}
      <div class="hud-panel-enter">
        <HudPanel
          data={displayData}
          userId={userId && !devMode ? userId : null}
          agentLoading={agentLoading && userId && !devMode}
          onActionComplete={handleActionComplete}
          secondOffer={secondOffer}
          secondOfferText={secondOfferText}
          onAcceptSecond={acceptSecondAction}
          onDeclineSecond={declineSecondAction}
          onDataRefresh={() => { loadHudData(userId, nodeId); triggerOrchestrator(userId, nodeId); }}
        />
      </div>
    {/if}

    {#if devMode}
      <div class="hud-mono text-[9px] text-slate-700 tracking-widest">
        DEV_MODE · test data · ?userId=xxx to connect
      </div>
    {/if}
  </div>
{/if}

<!-- Check-in modal — independent of panel, always available after readiness check -->
{#if userId && !devMode && needsCheckIn && readinessChecked}
  <CheckIn {userId} onComplete={onCheckInComplete} />
{/if}
