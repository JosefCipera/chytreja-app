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

  let statusNeon = $derived(
    status === 'READY' ? 'neon-cyan' :
    status === 'ACTIVE' ? 'neon-yellow' :
    'neon-green'
  );

  let statusColor = $derived(
    status === 'READY' ? 'text-cyan-400' :
    status === 'ACTIVE' ? 'text-yellow-400' :
    'text-green-400'
  );
</script>

<div class="rounded-lg p-4 {status === 'ACTIVE' ? 'glow-pulse' : ''}" style="
  background: rgba(6, 182, 212, 0.03);
  border: 1px solid rgba(255,255,255,0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 0 30px rgba(6,182,212,0.04);
">
  <div class="flex items-center justify-between mb-3">
    <span class="hud-mono text-xs text-slate-500 tracking-wider">
      ACTION: <span class="text-cyan-400">{action.id?.toUpperCase()}</span>
    </span>
    <span class="hud-mono text-xs {statusColor} {statusNeon} tracking-wider">[{status}]</span>
  </div>

  <div class="text-base text-slate-200 font-sans mb-4">
    {action.icon} {action.label}
  </div>

  {#if status === 'ACTIVE'}
    <div class="text-center mb-4">
      <span class="hud-mono text-4xl font-semibold text-slate-100 tabular-nums neon-cyan"
        style="text-shadow: 0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2);">
        {formatTime(timer)}
      </span>
    </div>
    <button
      onclick={stop}
      class="w-full py-3 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.07] text-yellow-400 hud-mono text-sm tracking-wider hover:bg-yellow-500/[0.12] hover:border-yellow-500/30 transition-all cursor-pointer neon-yellow"
    >
      ⏹ STOP
    </button>

  {:else if status === 'COMPLETE'}
    <div class="text-center py-3">
      <span class="text-green-400 hud-mono text-sm tracking-wider neon-green">✔ PROTOCOL COMPLETE</span>
    </div>

  {:else}
    <button
      onclick={start}
      class="w-full py-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-400 hud-mono text-sm tracking-wider hover:bg-cyan-500/[0.12] hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all cursor-pointer"
    >
      ▶ START PROTOCOL
    </button>
  {/if}
</div>
