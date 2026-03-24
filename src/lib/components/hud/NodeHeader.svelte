<script>
  let { label, version, onClose } = $props();
</script>

<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
  <h2 class="hud-mono text-sm tracking-wider">
    <span class="text-slate-600">LONGEVITY NODE</span>
    <span class="text-cyan-400 neon-cyan ml-1">[{label}]</span>
  </h2>
  <button
    onclick={onClose}
    class="text-slate-600 hover:text-slate-300 transition-colors text-lg leading-none"
  >
    ✕
  </button>
</div>
