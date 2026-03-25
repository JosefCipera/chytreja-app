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
  <div class="hud-mono" style="font-size: 16px; letter-spacing: 0.03em; color: #94a3b8; line-height: 1.3; margin-bottom: 6px;">
    THREAT_ACTIVE: <span style="color: #94a3b8;">{label}</span>
  </div>
  <div class="flex items-center gap-2" style="line-height: 1.3;">
    <span style="font-size: 17px; color: #f87171;">⚠</span>
    <span class="hud-mono" style="font-size: 16px; letter-spacing: 0.03em; color: #f87171;">{energyDrain}% ENERGY DRAIN</span>
  </div>
</div>
