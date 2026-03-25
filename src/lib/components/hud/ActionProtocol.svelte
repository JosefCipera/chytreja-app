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
      if (timer <= 0) {
        clearInterval(interval);
        status = 'COMPLETE';
      }
    }, 1000);
  }

  function stop() {
    clearInterval(interval);
    status = 'COMPLETE';
  }

  let statusColor = $derived(
    status === 'READY'    ? '#22d3ee' :
    status === 'ACTIVE'   ? '#facc15' :
    '#4ade80'
  );
  let statusNeon = $derived(
    status === 'READY'    ? 'neon-cyan' :
    status === 'ACTIVE'   ? 'neon-yellow' :
    'neon-green'
  );
</script>

<div class="rounded-lg p-4 {status === 'ACTIVE' ? 'glow-pulse' : ''}" style="
  background: rgba(6, 182, 212, 0.04);
  border: 1px solid rgba(255,255,255,0.07);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 0 30px rgba(6,182,212,0.05);
">
  <!-- Label row -->
  <div class="flex items-center justify-between mb-3">
    <span class="hud-mono tracking-wider font-bold" style="font-size: 17px; color: #94a3b8;">
      ACTION: <span style="color: #22d3ee;">{action.id?.toUpperCase()}</span>
    </span>
    <span class="hud-mono {statusNeon} tracking-wider font-bold" style="font-size: 17px; color: {statusColor};">[{status}]</span>
  </div>

  <!-- Action description -->
  <div class="font-sans mb-4" style="font-size: 22px; color: #e2e8f0; line-height: 1.3;">
    {action.icon} {action.label}
  </div>

  {#if status === 'ACTIVE'}
    <div class="text-center mb-4">
      <span class="hud-mono font-semibold tabular-nums neon-cyan"
        style="font-size: 3rem; color: #e2e8f0; text-shadow: 0 0 20px rgba(6,182,212,0.5), 0 0 40px rgba(6,182,212,0.2);">
        {formatTime(timer)}
      </span>
    </div>
    <button
      onclick={stop}
      class="w-full rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] hud-mono tracking-wider hover:bg-yellow-500/[0.12] hover:border-yellow-500/30 transition-all cursor-pointer neon-yellow"
      style="padding: 16px; font-size: 17px; color: #facc15;"
    >⏹ STOP</button>

  {:else if status === 'COMPLETE'}
    <div class="text-center py-4">
      <span class="hud-mono tracking-wider neon-green font-bold" style="font-size: 18px; color: #4ade80;">✔ PROTOCOL COMPLETE</span>
    </div>

  {:else}
    <button
      onclick={start}
      class="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] hud-mono tracking-wider hover:bg-cyan-500/[0.12] hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all cursor-pointer"
      style="padding: 16px; font-size: 17px; color: #22d3ee;"
    >▶ START PROTOCOL</button>
  {/if}
</div>
