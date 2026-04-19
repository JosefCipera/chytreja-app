<script>
  import { onMount } from 'svelte';
  import HudPanel from './lib/components/HudPanel.svelte';
  import CheckIn from './lib/components/CheckIn.svelte';
  import { loadHudData, nodeData, loading, error } from './lib/stores/hudData.js';
  import { calcVitality } from './lib/utils/vitality.js';
  import SecondAction from './lib/components/hud/SecondAction.svelte';

  // ── URL PARAMS ─────────────────────────────────────────
  const params   = new URLSearchParams(window.location.search);
  const userId   = params.get('userId');
  const nodeId   = params.get('nodeId') || 'dlouhovekost';
  const devMode  = params.get('dev') === '1';   // ?dev=1 → test data

  // ── CHECK-IN GATE ──────────────────────────────────────
  let readinessChecked = $state(false);   // has the check completed?
  let needsCheckIn     = $state(false);   // should we show check-in screen?

  // ── SECOND ACTION OFFER ────────────────────────────────
  // null = no offer, 'pending' = showing offer, 'declined' = user said Ne
  let secondOffer     = $state(null);
  let secondOfferText = $state('Chceš jít dál?');

  function shouldOfferSecond(data) {
    const percent = data?.life_battery?.percent ?? 50;
    const trend   = data?.life_battery?.trend ?? 'stable';   // 'up' | 'down' | 'stable'
    const streak  = data?.streak ?? 0;

    const state = percent <= 40 ? 'RED' : percent <= 70 ? 'YELLOW' : 'GREEN';

    if (streak >= 3)                              return { offer: true, text: 'Jedeš dobře. Přidáš krok?' };
    if (state === 'RED'   && trend === 'down')    return { offer: true, text: 'Můžeš to ještě posílit.' };
    if (state === 'YELLOW' && trend === 'stable') return { offer: Math.random() < 0.5, text: 'Chceš jít dál?' };
    return { offer: false };
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
  onMount(async () => {
    if (userId && !devMode) {
      await checkReadiness();
      loadHudData(userId, nodeId);
      triggerOrchestrator(userId, nodeId);
    } else {
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

  // Volá orchestrátor na pozadí — uloží rozhodnutí do orchestrator_log.
  // Při příštím loadHudData ho hud-data.js najde a použije verdikt.
  async function triggerOrchestrator(uid, nid) {
    try {
      await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Co mám dnes dělat?', nodeId: nid, userId: uid }),
      });
      // Refresh HUD data so new verdict from orchestrator_log is picked up
      loadHudData(uid, nid);
    } catch (e) {
      console.warn('[CHJ] orchestrator background call failed:', e);
    }
  }

  // Active data: real store or test fallback
  let displayData = $derived(
    (userId && !devMode && $nodeData) ? $nodeData : testNode
  );

  // ── GAME LOOP: called when user completes an action ──────
  async function handleActionComplete(actionId, actionType, actionNodeId) {
    if (!userId || devMode) return;

    const effectiveNodeId = actionNodeId || nodeId;

    // Snapshot current data BEFORE game loop changes today_count
    const snapshot = $nodeData;

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

      // Check if already did 2 actions today — no offer if both done
      const todayCount = snapshot?.today_count ?? 0;
      if (todayCount < 1) {
        // First action just completed — check if we should offer second
        const result = shouldOfferSecond(snapshot);
        if (result.offer) {
          secondOffer     = 'pending';
          secondOfferText = result.text;
          loadHudData(userId, nodeId); // load in background — second action ready
        } else {
          secondOffer = null;
          loadHudData(userId, nodeId);
        }
      } else {
        // Second action just completed
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

  function acceptSecondAction() {
    secondOffer = null; // HUD data already loaded, second action shows
  }

  function declineSecondAction() {
    secondOffer = 'declined'; // Show completion state instead
  }
</script>

<div class="min-h-screen" style="background: transparent; display: flex; justify-content: flex-end;">
  <!-- Ambient glow — only when standalone (not overlay) -->
  <div class="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none"></div>

  {#if userId && !devMode && $loading}
    <!-- Loading state -->
    <div class="hud-mono text-cyan-400/60 text-xs tracking-widest animate-pulse">
      LOADING_NODE_DATA…
    </div>

  {:else if userId && !devMode && $error}
    <!-- Error state -->
    <div class="hud-mono text-red-400/60 text-xs tracking-widest">
      ERR: {$error}
    </div>

  {:else}
    <HudPanel
      data={displayData}
      onActionComplete={handleActionComplete}
      secondOffer={secondOffer}
    >
      {#if secondOffer === 'pending'}
        <div class="px-4 pb-2">
          <SecondAction
            offerText={secondOfferText}
            onAccept={acceptSecondAction}
            onDecline={declineSecondAction}
          />
        </div>
      {/if}
    </HudPanel>

    {#if devMode}
      <!-- Dev mode badge -->
      <div class="hud-mono text-[9px] text-slate-700 tracking-widest">
        DEV_MODE · test data · ?userId=xxx to connect
      </div>
    {/if}
  {/if}

  <!-- Check-in modal overlay — shown when today's readiness is missing -->
  {#if userId && !devMode && needsCheckIn && readinessChecked}
    <CheckIn {userId} onComplete={onCheckInComplete} />
  {/if}
</div>
