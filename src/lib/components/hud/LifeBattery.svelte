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
  let repairRate = $derived(
    Math.round((spanekIndex * 0.6 + vyzivaIndex * 0.4) / 100 * 10 + 5) / 10
  );

  const TOTAL_SEGMENTS = 12;
  let filledSegments = $derived(Math.round((percent / 100) * TOTAL_SEGMENTS));

  let fillColor = $derived(
    percent > 70 ? 'rgba(34, 197, 94, 0.75)' :
    percent > 40 ? 'rgba(234, 179, 8, 0.75)' :
    'rgba(239, 68, 68, 0.75)'
  );

  let glowColor = $derived(
    percent > 70 ? 'rgba(34, 197, 94, 0.6)' :
    percent > 40 ? 'rgba(234, 179, 8, 0.6)' :
    'rgba(239, 68, 68, 0.6)'
  );

  let barGlow = $derived(
    percent > 70 ? '0 0 30px rgba(34, 197, 94, 0.35), 0 0 60px rgba(34, 197, 94, 0.12)' :
    percent > 40 ? '0 0 30px rgba(234, 179, 8, 0.35), 0 0 60px rgba(234, 179, 8, 0.12)' :
    '0 0 30px rgba(239, 68, 68, 0.35), 0 0 60px rgba(239, 68, 68, 0.12)'
  );

  let textNeon = $derived(
    percent > 70 ? 'neon-green' :
    percent > 40 ? 'neon-yellow' :
    'neon-red'
  );

  let textColor = $derived(
    percent > 70 ? '#4ade80' :
    percent > 40 ? '#facc15' :
    '#f87171'
  );

  let watermark = $derived(
    percent <= 40 ? 'CELL_DECAY' :
    percent <= 70 ? 'CELL_STABLE' :
    'CELL_OPTIMAL'
  );

  let watermarkColor = $derived(
    percent <= 40 ? 'rgba(239,68,68,0.65)' :
    percent <= 70 ? 'rgba(234,179,8,0.60)' :
    'rgba(34,197,94,0.60)'
  );

  let trendLabel = $derived(
    trend === 'UP' ? 'UP' :
    trend === 'STABLE' ? 'STABLE' :
    'DOWN'
  );

  // BIO_AGE
  let bioAge = $derived(
    assessBioAge({ vitalityPercent: percent, chronoAge, availableKeys: bioAvailableKeys, biomarkers })
  );
  let bioAgeSign    = $derived(bioAge.delta <= 0 ? '' : '+');
  let bioAgeColor   = $derived(
    bioAge.label.color === 'green'  ? '#4ade80' :
    bioAge.label.color === 'yellow' ? '#facc15' :
    '#94a3b8'
  );
  let confidencePct = $derived(Math.round(bioAge.confidence * 100));
</script>

<div class="hud-glass rounded-lg p-4 hud-corners">
  <!-- Header row: LIFE-BATTERY + percent + trend -->
  <div class="flex items-center justify-between mb-3">
    <span class="hud-mono font-bold" style="font-size: 17px; letter-spacing: 0.04em; color: #e2e8f0;">LIFE-BATTERY</span>
    <div class="flex items-center gap-0">
      <span class="hud-mono font-bold" style="font-size: 17px; color: {textColor};">{percent}%</span>
      <span class="hud-mono mx-2" style="font-size: 17px; color: #334155;">|</span>
      <span class="hud-mono font-bold {textNeon}" style="font-size: 17px; color: {textColor};">{trendLabel}</span>
    </div>
  </div>

  <!-- Battery shape -->
  <div class="flex items-center gap-0 mb-3">
    <!-- Main battery body -->
    <div
      class="relative flex-1 rounded-l-md rounded-r-none {percent <= 40 ? 'battery-pulse' : ''}"
      style="
        background: rgba(0, 0, 0, 0.55);
        border: 2px solid rgba(255,255,255,0.07);
        border-right: none;
        box-shadow: {barGlow}, inset 0 2px 12px rgba(0,0,0,0.6);
        padding: 5px;
      "
    >
      <!-- Segments -->
      <div class="relative flex gap-[4px]" style="z-index: 1;">
        {#each Array(TOTAL_SEGMENTS) as _, i}
          <div
            class="flex-1 rounded-[2px] transition-all duration-500"
            style="height: 100px; {i < filledSegments
              ? `background: ${fillColor}; box-shadow: 0 0 8px ${glowColor}, inset 0 -2px 4px rgba(0,0,0,0.2);`
              : 'background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.015);'}"
          ></div>
        {/each}
      </div>

      <!-- Watermark -->
      <div
        class="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        style="z-index: 3;"
      >
        <span
          class="hud-mono font-black uppercase"
          style="
            font-size: 26px;
            letter-spacing: 0.04em;
            color: {watermarkColor};
            text-shadow: 0 0 16px {watermarkColor}, 0 0 35px {watermarkColor};
            background: rgba(0,0,0,0.45);
            padding: 4px 14px;
            border-radius: 4px;
          "
        >{watermark}</span>
      </div>
    </div>

    <!-- Battery terminal (nub) -->
    <div
      class="rounded-r-sm"
      style="width: 12px; height: 58px; background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.06); border-left: none; box-shadow: 0 0 8px {glowColor};"
    ></div>
  </div>

  <!-- Sub-metrics row — single line -->
  <div class="flex items-center justify-between">
    <span class="hud-mono" style="font-size: 13px; color: #475569;">
      REPAIR_RATE: <span style="color: #94a3b8;">{repairRate}x</span>
    </span>
    <span class="hud-mono" style="font-size: 13px; color: #475569;">
      {bioAge.label.key}: <span style="color: {bioAgeColor}; font-weight: 700;">{bioAgeSign}{bioAge.delta} YRS</span>
    </span>
  </div>
</div>
