<script>
  let { label, energyDrain } = $props();
</script>

<div class="rounded-lg px-4 py-3" style="
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-left: 3px solid rgba(239, 68, 68, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: inset 3px 0 24px rgba(239, 68, 68, 0.05), 0 0 24px rgba(239, 68, 68, 0.06);
">
  <div class="hud-mono" style="font-size: 16px; letter-spacing: 0.03em; color: #94a3b8; line-height: 1.3; margin-bottom: 6px;">
    THREAT_ACTIVE: <span style="font-weight: 700; color: #f87171; text-shadow: 0 0 12px rgba(239,68,68,0.8);">{label}</span>
  </div>
  <div class="flex items-center gap-2" style="line-height: 1.3;">
    <span style="font-size: 17px; color: #f87171; text-shadow: 0 0 10px rgba(239,68,68,0.9);">⚠</span>
    <span class="hud-mono font-bold" style="font-size: 16px; letter-spacing: 0.03em; color: #f87171; text-shadow: 0 0 10px rgba(239,68,68,0.5);">{energyDrain}% ENERGY DRAIN</span>
  </div>
</div>
