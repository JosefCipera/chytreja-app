<script>
  let { label, version, onClose, stateColor = '#94a3b8' } = $props();
</script>

<div class="flex items-center justify-between px-4 py-3" style="
  border-bottom: 1px solid rgba(255,255,255,0.05);
">
  <h2 class="hud-mono tracking-widest" style="font-size: 14px;">
    <span style="color: {stateColor}; text-shadow: 0 0 10px {stateColor}66;">LONGEVITY NODE</span>
    <span style="color: rgba(148,163,184,0.55);" class="ml-1">[{label}]</span>
  </h2>
  <button
    onclick={onClose}
    style="color: #475569; font-size: 1.3rem; line-height: 1; background: none; border: none; cursor: pointer; padding: 4px; font-family: inherit;"
    onmouseenter={(e) => e.target.style.color = stateColor}
    onmouseleave={(e) => e.target.style.color = '#475569'}
  >
    ✕
  </button>
</div>
