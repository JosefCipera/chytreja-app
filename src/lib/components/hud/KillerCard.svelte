<script>
  let { label, energyDrain } = $props();
</script>

<div class="rounded-lg px-4 py-3" style="
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-left: 3px solid rgba(239, 68, 68, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
">
  <div class="hud-mono" style="font-size: 16px; font-weight: 300; letter-spacing: 0.04em; color: #c8d4df; line-height: 1.3; margin-bottom: 6px;">
    KILLER: <span style="color: #c8d4df;">{label}</span>
  </div>
  <div class="flex items-center gap-2" style="line-height: 1.3;">
    <span style="font-size: 15px; color: #ef4444;">{@html '\u26A0\uFE0E'}</span>
    <span class="hud-mono" style="font-size: 14px; font-weight: 300; letter-spacing: 0.03em; color: #f87171;">{energyDrain}% ENERGY DRAIN</span>
  </div>
</div>
