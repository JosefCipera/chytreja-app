<script>
  let { label, version, onClose } = $props();
</script>

<div class="flex items-center justify-between px-4 py-3" style="
  border-bottom: 1px solid rgba(6,182,212,0.35);
  background: rgba(6,182,212,0.12);
  box-shadow: 0 1px 0 rgba(6,182,212,0.12);
">
  <h2 class="hud-mono text-xs tracking-widest">
    <span style="color: #e2e8f0;">LONGEVITY NODE</span>
    <span style="color: #22d3ee; text-shadow: 0 0 8px rgba(34,211,238,0.6);" class="ml-1">[{label}]</span>
  </h2>
  <button
    onclick={onClose}
    style="color: #94a3b8; font-size: 1rem; line-height: 1; background: none; border: none; cursor: pointer; padding: 0; font-family: inherit;"
    onmouseenter={(e) => e.target.style.color = '#22d3ee'}
    onmouseleave={(e) => e.target.style.color = '#94a3b8'}
  >
    ✕
  </button>
</div>
