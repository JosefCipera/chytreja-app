<script>
  let { action, killer = null } = $props();

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
    status === 'READY'    ? '#22d3ee' :
    status === 'ACTIVE'   ? '#BED255' :
    '#86C46A'
  );

  let protocolLabel = $derived(
    action.protocol_type || 'TRAINING_PROTOKOL'
  );
</script>

<div class="rounded-lg {status === 'ACTIVE' ? 'glow-pulse' : ''}" style="
  background: rgba(201, 114, 114, 0.05);
  border: 1px solid rgba(201, 114, 114, 0.20);
  border-left: 3px solid rgba(201, 114, 114, 0.55);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
">
  <!-- KILLER sekce (červená) -->
  {#if killer}
    <div class="px-4 pt-3 pb-2">
      <div class="hud-mono" style="font-size: 20px; font-weight: 300; letter-spacing: 0.04em; color: #c8d4df; margin-bottom: 4px;">
        KILLER: <span>{killer.label}</span>
      </div>
      <div class="flex items-center gap-2">
        <span style="font-size: 17px; color: #C97272;">{@html '\u26A0\uFE0E'}</span>
        <span class="hud-mono" style="font-size: 17px; font-weight: 300; letter-spacing: 0.03em; color: #C97272;">{killer.energy_drain}% ENERGY DRAIN</span>
      </div>
    </div>
    <!-- Tenký oddělovač — odsazený od krajů (šířka textu) -->
    <div style="margin: 0 16px; border-top: 1px solid rgba(255,255,255,0.09);"></div>
  {/if}

  <!-- ACTION sekce -->
  <div class="px-4 pt-2 pb-3">
    <!-- ACTION: + [STATUS] na stejném řádku vpravo, PROTOKOL pod -->
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
      <button onclick={stop} class="w-full rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] hud-mono tracking-wider hover:bg-yellow-500/[0.12] transition-all cursor-pointer"
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
</div>
