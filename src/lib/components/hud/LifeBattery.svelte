<script>
  import { assessBioAge } from '../../utils/bioAge.js';

  let {
    percent,
    trend,
    spanekIndex = 50,
    vyzivaIndex = 50,
    chronoAge = 40,
    bioAvailableKeys = [],
    biomarkers = {},
  } = $props();

  // REPAIR_RATE: anabolism from sleep + nutrition (Attia)
  // Scale: raw 0-1 → displayed 0.5x–1.5x
  let repairRate = $derived(
    Math.round((spanekIndex * 0.6 + vyzivaIndex * 0.4) / 100 * 10 + 5) / 10
  );

  const TOTAL_SEGMENTS = 12; // fewer, chunkier segments
  let filledSegments = $derived(Math.round((percent / 100) * TOTAL_SEGMENTS));

  let fillColor = $derived(
    percent > 70 ? 'rgba(34, 197, 94, 0.55)' :
    percent > 40 ? 'rgba(234, 179, 8, 0.55)' :
    'rgba(239, 68, 68, 0.55)'
  );

  let glowColor = $derived(
    percent > 70 ? 'rgba(34, 197, 94, 0.5)' :
    percent > 40 ? 'rgba(234, 179, 8, 0.5)' :
    'rgba(239, 68, 68, 0.5)'
  );

  let barGlow = $derived(
    percent > 70 ? '0 0 25px rgba(34, 197, 94, 0.3), 0 0 50px rgba(34, 197, 94, 0.1)' :
    percent > 40 ? '0 0 25px rgba(234, 179, 8, 0.3), 0 0 50px rgba(234, 179, 8, 0.1)' :
    '0 0 25px rgba(239, 68, 68, 0.3), 0 0 50px rgba(239, 68, 68, 0.1)'
  );

  let textNeon = $derived(
    percent > 70 ? 'neon-green' :
    percent > 40 ? 'neon-yellow' :
    'neon-red'
  );

  let textColor = $derived(
    percent > 70 ? 'text-green-400' :
    percent > 40 ? 'text-yellow-400' :
    'text-red-400'
  );

  let watermark = $derived(
    percent <= 40 ? 'CELL_DECAY' :
    percent <= 70 ? 'CELL_STABLE' :
    'CELL_OPTIMAL'
  );

  let watermarkColor = $derived(
    percent <= 40 ? 'rgba(239,68,68,0.55)' :
    percent <= 70 ? 'rgba(234,179,8,0.50)' :
    'rgba(34,197,94,0.50)'
  );

  let trendColor = $derived(
    trend === 'UP' ? 'text-green-400 neon-green' :
    trend === 'STABLE' ? 'text-yellow-400 neon-yellow' :
    'text-red-400 neon-red'
  );

  // BIO_AGE — derived from vitality + available biomarkers
  let bioAge = $derived(
    assessBioAge({ vitalityPercent: percent, chronoAge, availableKeys: bioAvailableKeys, biomarkers })
  );

  let bioAgeSign      = $derived(bioAge.delta <= 0 ? '' : '+');
  let bioAgeColor     = $derived(
    bioAge.label.color === 'green'  ? 'text-green-400' :
    bioAge.label.color === 'yellow' ? 'text-yellow-400' :
    'text-slate-400'
  );
  let bioAgeNeon      = $derived(
    bioAge.label.color === 'green'  ? 'neon-green' :
    bioAge.label.color === 'yellow' ? 'neon-yellow' :
    ''
  );
  let confidencePct   = $derived(Math.round(bioAge.confidence * 100));
</script>

<div class="hud-glass rounded-lg p-4 hud-corners">
  <div class="flex items-center justify-between mb-2">
    <span class="hud-mono tracking-wider" style="font-size: 15px; color: rgba(34,211,238,0.7);">LIFE-BATTERY</span>
    <div class="flex items-center gap-0">
      <span class="hud-mono {textColor}" style="font-size: 15px;">{percent}%</span>
      <span class="hud-mono mx-1.5" style="font-size: 15px; color: #475569;">|</span>
      <span class="hud-mono {trendColor}" style="font-size: 15px;">{trend}</span>
    </div>
  </div>

  <!-- Battery shape: thick body + terminal nub -->
  <div class="flex items-center gap-0 mb-2">
    <!-- Main battery body -->
    <div
      class="relative flex-1 rounded-l-md rounded-r-none {percent <= 40 ? 'battery-pulse' : ''}"
      style="background: rgba(0, 0, 0, 0.5); border: 2px solid rgba(255,255,255,0.06); border-right: none; box-shadow: {barGlow}, inset 0 2px 10px rgba(0,0,0,0.6); padding: 5px;"
    >
      <!-- Segments -->
      <div class="relative flex gap-[4px]" style="z-index: 1;">
        {#each Array(TOTAL_SEGMENTS) as _, i}
          <div
            class="flex-1 rounded-[2px] transition-all duration-500"
            style="height: 88px; {i < filledSegments
              ? `background: ${fillColor}; box-shadow: 0 0 6px ${glowColor}, inset 0 -2px 4px rgba(0,0,0,0.2);`
              : 'background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.015);'}"
          ></div>
        {/each}
      </div>

      <!-- Watermark — on top of segments -->
      <div
        class="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style="z-index: 3;"
      >
        <span
          class="hud-mono font-black uppercase"
          style="font-size: 20px; letter-spacing: 0.4em; color: {watermarkColor}; text-shadow: 0 0 12px {watermarkColor}, 0 0 30px {watermarkColor};"
        >{watermark}</span>
      </div>

    </div>

    <!-- Battery terminal (nub) -->
    <div
      class="rounded-r-sm"
      style="width: 12px; height: 50px; background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.06); border-left: none; box-shadow: 0 0 8px {glowColor};"
    ></div>
  </div>

  <!-- Sub-metrics row -->
  <div class="flex items-baseline justify-between">
    <div class="flex gap-4">
      <span class="hud-mono" style="font-size: 13px; color: #475569;">
        REPAIR_RATE: <span style="color: #94a3b8;">{repairRate}x</span>
      </span>

      <!-- BIO_AGE block -->
      <div class="flex flex-col items-end gap-0.5">
        <span class="hud-mono" style="font-size: 13px; color: #475569;">
          {bioAge.label.key}:
          <span class="font-bold {bioAgeColor} {bioAgeNeon}">
            {bioAgeSign}{bioAge.delta} YRS
          </span>
        </span>
        <!-- Confidence bar -->
        <div class="flex items-center gap-1">
          <div class="w-16 h-[4px] rounded-full bg-white/[0.06] overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-700"
              style="width: {confidencePct}%; background: {
                bioAge.label.color === 'green'  ? 'rgba(34,197,94,0.7)' :
                bioAge.label.color === 'yellow' ? 'rgba(234,179,8,0.7)' :
                'rgba(100,116,139,0.5)'
              };"
            ></div>
          </div>
          <span class="hud-mono" style="font-size: 12px; color: #334155;">{bioAge.label.shortLabel} {confidencePct}%</span>
        </div>
      </div>
    </div>
  </div>
</div>
