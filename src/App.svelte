<script>
  import { onMount } from 'svelte';
  import HudPanel from './lib/components/HudPanel.svelte';
  import CheckIn from './lib/components/CheckIn.svelte';
  import { loadHudData, nodeData, loading, error } from './lib/stores/hudData.js';
  import { calcVitality } from './lib/utils/vitality.js';

  // ── URL PARAMS ─────────────────────────────────────────
  const params   = new URLSearchParams(window.location.search);
  const userId   = params.get('userId');
  const nodeId   = params.get('nodeId') || 'dlouhovekost';
  const devMode  = params.get('dev') === '1';   // ?dev=1 → test data

  // ── CHECK-IN GATE ──────────────────────────────────────
  let readinessChecked = $state(false);   // has the check completed?
  let needsCheckIn     = $state(false);   // should we show check-in screen?

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

    // Use actionNodeId when action comes from bottleneck (e.g. dlouhovekost panel)
    const effectiveNodeId = actionNodeId || nodeId;

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

      // Prefetch new HUD data immediately in background (parallel with HOTOVO display)
      // Panel updates as soon as data arrives — no artificial wait
      loadHudData(userId, nodeId);

      // Notify canvas after short delay (user sees ✔ HOTOVO)
      setTimeout(() => {
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'chj:universe:refresh' }, '*');
        }
      }, 400);
    } catch (e) {
      console.error('[CHJ] game loop error:', e);
    }
  }
</script>

<div class="min-h-screen" style="background: transparent; display: flex; justify-content: flex-end;">
  <!-- Ambient glow — only when standalone (not overlay) -->
  <div class="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none"></div>

  {#if userId && !devMode && needsCheckIn && readinessChecked}
    <CheckIn {userId} onComplete={onCheckInComplete} />

  {:else if userId && !devMode && $loading}
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
    <HudPanel data={displayData} onActionComplete={handleActionComplete} />

    {#if devMode}
      <!-- Dev mode badge -->
      <div class="hud-mono text-[9px] text-slate-700 tracking-widest">
        DEV_MODE · test data · ?userId=xxx to connect
      </div>
    {/if}
  {/if}
</div>
