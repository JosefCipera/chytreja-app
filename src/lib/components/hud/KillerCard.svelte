<script>
  let { label, energyDrain } = $props();
</script>

<div class="rounded-lg p-4" style="
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-left: 3px solid rgba(239, 68, 68, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: inset 3px 0 24px rgba(239, 68, 68, 0.05), 0 0 24px rgba(239, 68, 68, 0.06);
">
  <div class="hud-mono font-bold" style="font-size: 18px; letter-spacing: 0.04em; color: #e2e8f0; margin-bottom: 10px;">
    THREAT_ACTIVE: <span style="color: #f87171; text-shadow: 0 0 14px rgba(239,68,68,0.9), 0 0 28px rgba(239,68,68,0.4);">{label}</span>
  </div>
  <div class="flex items-center gap-2">
    <span style="font-size: 20px; color: #f87171; text-shadow: 0 0 10px rgba(239,68,68,0.9);">⚠</span>
    <span class="hud-mono font-bold" style="font-size: 18px; letter-spacing: 0.03em; color: #f87171; text-shadow: 0 0 10px rgba(239,68,68,0.6);">{energyDrain}% ENERGY DRAIN</span>
  </div>
</div>
