<script>
  let { label, version, onClose } = $props();
</script>

<div style="
  padding: 18px 20px 16px;
  border-bottom: 1px solid rgba(6,182,212,0.2);
  background: rgba(6,182,212,0.05);
">
  <div class="flex items-start justify-between gap-3">
    <h2 class="hud-mono leading-tight" style="font-size: 11px; letter-spacing: 0.18em; color: rgba(148,163,184,0.5);">
      LONGEVITY NODE
    </h2>
    <button
      onclick={onClose}
      style="color: #475569; font-size: 1.2rem; line-height: 1; background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; flex-shrink: 0; margin-top: 2px;"
      onmouseenter={(e) => e.target.style.color = '#22d3ee'}
      onmouseleave={(e) => e.target.style.color = '#475569'}
    >✕</button>
  </div>
  <div class="hud-mono font-bold" style="
    font-size: 22px;
    letter-spacing: 0.02em;
    color: #22d3ee;
    text-shadow: 0 0 18px rgba(34,211,238,0.6), 0 0 40px rgba(34,211,238,0.2);
    margin-top: 4px;
    line-height: 1.1;
  ">[{label.toUpperCase()}]</div>
</div>
