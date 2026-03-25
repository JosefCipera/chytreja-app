<script>
  let { label, version, onClose } = $props();
</script>

<div class="flex items-center justify-between px-4 py-3" style="
  border-bottom: 1px solid rgba(6,182,212,0.25);
  background: rgba(6,182,212,0.08);
  box-shadow: 0 1px 0 rgba(6,182,212,0.08);
">
  <h2 class="hud-mono text-xs tracking-widest">
    <span class="text-slate-300">LONGEVITY NODE</span>
    <span class="text-cyan-400 neon-cyan ml-1">[{label}_{version}]</span>
  </h2>
  <button
    onclick={onClose}
    class="text-slate-400 hover:text-cyan-300 transition-colors text-base leading-none hud-mono"
    style="text-shadow: none;"
  >
    ✕
  </button>
</div>
