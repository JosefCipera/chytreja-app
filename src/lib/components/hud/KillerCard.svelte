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
    <span class="hud-mono text-xs text-slate-500 tracking-wider">
      KILLER: <span class="text-red-400 font-bold" style="text-shadow: 0 0 12px rgba(239,68,68,0.8), 0 0 24px rgba(239,68,68,0.4);">{label}</span>
    </span>
    <span class="hud-mono text-[9px] text-red-900/60 tracking-widest">THREAT_ACTIVE</span>
  </div>
  <div class="mt-2 flex items-center gap-2">
    <span class="text-red-400 text-sm" style="text-shadow: 0 0 8px rgba(239,68,68,0.9);">⚠</span>
    <span class="hud-mono text-xs font-bold" style="color: rgba(239,68,68,0.85); text-shadow: 0 0 8px rgba(239,68,68,0.5);">{energyDrain}% ENERGY DRAIN</span>
  </div>
  <p class="mt-2 text-sm text-slate-400 font-sans">{description}</p>
</div>
