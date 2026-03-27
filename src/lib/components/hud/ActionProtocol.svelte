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
    status === 'ACTIVE' ? '#BED255' :
    '#86C46A'
  );
  let statusNeon = $derived(
    status === 'READY'  ? 'neon-cyan' :
    status === 'ACTIVE' ? 'neon-yellow' :
    'neon-green'
  );

  // Protocol label from DB field, fallback to type-based default
  let protocolLabel = $derived(
    action.protocol_type || 'TRAINING_PROTOKOL'
  );
</script>

<div class="rounded-lg px-4 py-3 {status === 'ACTIVE' ? 'glow-pulse' : ''}" style="
  background: rgba(6, 182, 212, 0.03);
  border: 1px solid rgba(255,255,255,0.07);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
">
  <!-- ACTION: + [STATUS] na stejném řádku, PROTOKOL pod -->
  <div class="hud-mono mb-2" style="letter-spacing: 0.04em; font-weight: 300; line-height: 1.5;">
    <div class="flex items-center justify-between" style="font-size: 20px;">
      <span style="color: #c8d4df;">ACTION:</span>
      <span style="color: {statusColor};">[{status}]</span>
    </div>
    <div style="font-size: 20px; color: #94a3b8;">{protocolLabel}</div>
  </div>

  <!-- Action description: [ ] prefix, bez ikony -->
  <div class="font-sans mb-3" style="font-size: 17px; color: #e2e8f0; line-height: 1.3;">
    [ ] {action.label}
  </div>

  {#if status === 'ACTIVE'}
    <div class="text-center mb-3">
      <span class="hud-mono tabular-nums neon-cyan"
        style="font-size: 2.2rem; font-weight: 400; color: #e2e8f0; text-shadow: 0 0 16px rgba(6,182,212,0.45);">
        {formatTime(timer)}
      </span>
    </div>
    <button onclick={stop} class="w-full rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] hud-mono tracking-wider hover:bg-yellow-500/[0.12] transition-all cursor-pointer neon-yellow"
      style="padding: 14px; font-size: 16px; color: #BED255;">
      ⏹ STOP
    </button>

  {:else}
    <button onclick={start} class="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] hud-mono tracking-wider hover:bg-cyan-500/[0.12] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all cursor-pointer"
      style="padding: 14px; font-size: 16px; color: #22d3ee;">
      ▶ START PROTOCOL
    </button>
  {/if}
</div>
