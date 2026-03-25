<script>
  let { label, energyDrain, description } = $props();
</script>

<div class="rounded-lg p-4" style="
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.12);
  border-left: 2px solid rgba(239, 68, 68, 0.5);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: inset 3px 0 20px rgba(239, 68, 68, 0.04), 0 0 20px rgba(239, 68, 68, 0.05);
">
  <div class="flex items-center justify-between">
    <span class="hud-mono tracking-wider" style="font-size: 15px; color: #64748b;">
      KILLER: <span class="font-bold" style="color: #f87171; text-shadow: 0 0 12px rgba(239,68,68,0.8), 0 0 24px rgba(239,68,68,0.4);">{label}</span>
    </span>
    <span class="hud-mono tracking-widest" style="font-size: 12px; color: rgba(239,68,68,0.45); text-shadow: 0 0 8px rgba(239,68,68,0.3);">THREAT_ACTIVE</span>
  </div>
  <div class="mt-2 flex items-center gap-2">
    <span style="font-size: 18px; color: #f87171; text-shadow: 0 0 8px rgba(239,68,68,0.9);">⚠</span>
    <span class="hud-mono font-bold" style="font-size: 15px; color: rgba(239,68,68,0.85); text-shadow: 0 0 8px rgba(239,68,68,0.5);">{energyDrain}% ENERGY DRAIN</span>
  </div>
  <p class="mt-2 font-sans" style="font-size: 16px; color: #94a3b8;">{description}</p>
</div>
