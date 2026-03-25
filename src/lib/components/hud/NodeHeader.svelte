<script>
  let { label, version, onClose } = $props();
</script>

<div class="flex items-center justify-between px-4 py-3" style="
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(6, 12, 28, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
">
  <h2 class="hud-mono tracking-widest" style="font-size: 14px;">
    <span style="color: #e2e8f0;">LONGEVITY NODE</span>
    <span style="color: #22d3ee; text-shadow: 0 0 8px rgba(34,211,238,0.6);" class="ml-1">[{label}]</span>
  </h2>
  <button
    onclick={onClose}
    style="color: #94a3b8; font-size: 1.3rem; line-height: 1; background: none; border: none; cursor: pointer; padding: 4px; font-family: inherit;"
    onmouseenter={(e) => e.target.style.color = '#22d3ee'}
    onmouseleave={(e) => e.target.style.color = '#94a3b8'}
  >
    ✕
  </button>
</div>
