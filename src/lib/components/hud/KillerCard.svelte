<script>
  let { label, energyDrain, description } = $props();
</script>

<div class="rounded-lg p-4" style="
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-left: 3px solid rgba(239, 68, 68, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: inset 3px 0 24px rgba(239, 68, 68, 0.05), 0 0 24px rgba(239, 68, 68, 0.06);
">
  <div class="flex items-center justify-between mb-2">
    <span class="hud-mono tracking-wider font-bold" style="font-size: 17px; color: #94a3b8;">
      KILLER: <span style="color: #f87171; text-shadow: 0 0 14px rgba(239,68,68,0.9), 0 0 28px rgba(239,68,68,0.4);">{label}</span>
    </span>
    <span class="hud-mono tracking-widest" style="font-size: 13px; color: rgba(239,68,68,0.6); text-shadow: 0 0 10px rgba(239,68,68,0.4);">THREAT_ACTIVE</span>
  </div>
  <div class="flex items-center gap-2 mb-2">
    <span style="font-size: 20px; color: #f87171; text-shadow: 0 0 10px rgba(239,68,68,0.9);">⚠</span>
    <span class="hud-mono font-bold" style="font-size: 17px; color: #f87171; text-shadow: 0 0 10px rgba(239,68,68,0.6);">{energyDrain}% ENERGY DRAIN</span>
  </div>
  <p class="font-sans" style="font-size: 16px; color: #94a3b8; line-height: 1.4;">{description}</p>
</div>
