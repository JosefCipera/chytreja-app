<script>
  let { label, version, onClose } = $props();
</script>

<div class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid rgba(6,182,212,0.18); background: rgba(6,182,212,0.04);">
  <h2 class="hud-mono text-xs tracking-widest">
    <span class="text-slate-400">LONGEVITY NODE</span>
    <span class="text-cyan-400 neon-cyan ml-1">[{label}]</span>
  </h2>
  <button
    onclick={onClose}
    class="text-slate-400 hover:text-cyan-400 transition-colors text-base leading-none hud-mono"
  >
    ✕
  </button>
</div>
