<script>
  let { action } = $props();

  let status = $state(action.status || 'READY');
  let timer = $state(action.duration || 60);
  let interval = $state(null);

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function start() {
    status = 'ACTIVE';
    interval = setInterval(() => {
      timer--;
      if (timer <= 0) { clearInterval(interval); status = 'COMPLETE'; }
    }, 1000);
  }

  function stop() {
    clearInterval(interval);
    status = 'COMPLETE';
  }

  let statusColor = $derived(
    status === 'READY'  ? '#22d3ee' :
    status === 'ACTIVE' ? '#facc15' :
    '#4ade80'
  );
  let statusNeon = $derived(
    status === 'READY'  ? 'neon-cyan' :
    status === 'ACTIVE' ? 'neon-yellow' :
    'neon-green'
  );

  // Protocol type label from action type
  let protocolLabel = $derived(
    action.type === 'timed'   ? 'TIMING_PROTOKOL' :
    action.type === 'reps'    ? 'TRAINING_PROTOKOL' :
    action.type === 'counter' ? 'TRAINING_PROTOKOL' :
    'TRAINING_PROTOKOL'
  );
</script>

<div class="rounded-lg px-4 py-3 {status === 'ACTIVE' ? 'glow-pulse' : ''}" style="
  background: rgba(6, 182, 212, 0.03);
  border: 1px solid rgba(255,255,255,0.07);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
">
  <!-- ACTION: [PROTOKOL] [STATUS] -->
  <div class="hud-mono mb-3" style="font-size: 16px; letter-spacing: 0.03em; color: #94a3b8; line-height: 1.3;">
    ACTION: <span style="color: #94a3b8;">[{protocolLabel}]</span>
    <span class="{statusNeon}" style="color: {statusColor};"> [{status}]</span>
  </div>

  <!-- Action description -->
  <div class="font-sans mb-3" style="font-size: 20px; color: #e2e8f0; line-height: 1.3;">
    {action.icon} {action.label}
  </div>

  {#if status === 'ACTIVE'}
    <div class="text-center mb-3">
      <span class="hud-mono font-semibold tabular-nums neon-cyan"
        style="font-size: 2.8rem; color: #e2e8f0; text-shadow: 0 0 20px rgba(6,182,212,0.5);">
        {formatTime(timer)}
      </span>
    </div>
    <button onclick={stop} class="w-full rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] hud-mono tracking-wider hover:bg-yellow-500/[0.12] transition-all cursor-pointer neon-yellow"
      style="padding: 14px; font-size: 16px; color: #facc15;">
      ⏹ STOP
    </button>

  {:else if status === 'COMPLETE'}
    <div class="text-center py-3">
      <span class="hud-mono tracking-wider neon-green font-bold" style="font-size: 17px; color: #4ade80;">✔ PROTOCOL COMPLETE</span>
    </div>

  {:else}
    <button onclick={start} class="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] hud-mono tracking-wider hover:bg-cyan-500/[0.12] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all cursor-pointer"
      style="padding: 14px; font-size: 16px; color: #22d3ee;">
      ▶ START PROTOCOL
    </button>
  {/if}
</div>
