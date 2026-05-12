<script>
  let { label, description, universe = 'longevity' } = $props();
</script>

<div class="rounded-lg px-4 py-3" style="
  background: transparent;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
">
  {#if universe === 'toc'}
    <div class="hud-mono" style="font-size: 20px; font-weight: 300; letter-spacing: 0.04em; color: #c8d4df; line-height: 1.3; margin-bottom: 6px;">
      PROBL\u00C9M
    </div>
    <div class="flex items-start gap-2" style="line-height: 1.4;">
      <span style="font-size: 15px; color: #ef4444; flex-shrink: 0; margin-top: 1px;">{@html '\u26A0\uFE0E'}</span>
      <span style="font-size: 14px; color: #f87171;">{description}</span>
    </div>
  {:else if universe === 'lehkost'}
    <div class="hud-mono" style="font-size: 20px; font-weight: 300; letter-spacing: 0.04em; color: #c8d4df; line-height: 1.3; margin-bottom: 6px;">
      FLOW KILLER: <span style="color: #c8d4df;">{label}</span>
    </div>
    <div class="flex items-center gap-2" style="line-height: 1.3;">
      <span style="font-size: 15px; color: #ef4444;">{@html '\u26A0\uFE0E'}</span>
      <span style="font-size: 14px; color: #f87171;">{description}</span>
    </div>
  {:else}
    <div class="hud-mono" style="font-size: 20px; font-weight: 300; letter-spacing: 0.04em; color: #c8d4df; line-height: 1.3; margin-bottom: 6px;">
      KILLER: <span style="color: #c8d4df;">{label}</span>
    </div>
    <div class="flex items-center gap-2" style="line-height: 1.3;">
      <span style="font-size: 15px; color: #ef4444;">{@html '\u26A0\uFE0E'}</span>
      <span style="font-size: 14px; color: #f87171;">{description}</span>
    </div>
  {/if}
</div>
