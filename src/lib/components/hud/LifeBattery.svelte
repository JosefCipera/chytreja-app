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
    universe = 'longevity',
  } = $props();


  const TOTAL_SEGMENTS = 12;
  let filledSegments = $derived(Math.round((percent / 100) * TOTAL_SEGMENTS));

  let fillColor = $derived(
    percent > 70 ? 'rgba(134, 196, 106, 0.72)' :
    percent > 40 ? 'rgba(190, 210, 85, 0.72)' :
    'rgba(201, 114, 114, 0.72)'
  );

  let glowColor = $derived(
    percent > 70 ? 'rgba(134, 196, 106, 0.45)' :
    percent > 40 ? 'rgba(190, 210, 85, 0.45)' :
    'rgba(201, 114, 114, 0.45)'
  );

  let barGlow = $derived(
    percent > 70 ? '0 0 28px rgba(134, 196, 106, 0.28), 0 0 55px rgba(134, 196, 106, 0.10)' :
    percent > 40 ? '0 0 28px rgba(190, 210, 85, 0.28), 0 0 55px rgba(190, 210, 85, 0.10)' :
    '0 0 28px rgba(201, 114, 114, 0.32), 0 0 55px rgba(201, 114, 114, 0.12)'
  );

  let textNeon = $derived('');

  let textColor = $derived(
    percent > 70 ? '#86C46A' :
    percent > 40 ? '#BED255' :
    '#C97272'
  );

  $effect(() => { console.log('[LifeBattery] universe=', universe, 'percent=', percent); });

  let watermark = $derived(
    universe === 'toc'
      ? (percent <= 40 ? 'FLOW_DECAY' : percent <= 70 ? 'FLOW_STABLE' : 'FLOW_OPTIMAL')
      : (percent <= 40 ? 'CELL_DECAY' : percent <= 70 ? 'CELL_STABLE' : 'CELL_OPTIMAL')
  );

  // Watermark uses semafor color — matches battery state
  let watermarkColor = $derived(textColor);

  let trendArrow = $derived(
    trend === 'UP'     ? '▲' :
    trend === 'STABLE' ? '–' :
    '▼'
  );
  let trendWord = $derived(
    trend === 'UP'     ? 'ROSTE' :
    trend === 'STABLE' ? 'STABILNÍ' :
    'KLESÁ'
  );

  // BIO_AGE
  let bioAge = $derived(
    assessBioAge({ vitalityPercent: percent, chronoAge, availableKeys: bioAvailableKeys, biomarkers })
  );
  let bioAgeSign    = $derived(bioAge.delta <= 0 ? '' : '+');
  let bioAgeColor   = $derived(
    bioAge.label.color === 'green'  ? '#86C46A' :
    bioAge.label.color === 'yellow' ? '#BED255' :
    '#94a3b8'
  );
  let confidencePct = $derived(Math.round(bioAge.confidence * 100));
</script>

<div class="hud-glass rounded-lg p-4 hud-c4">
  <span class="hc hc-tl"></span><span class="hc hc-tr"></span>
  <!-- Header row: LIFE-BATTERY + percent + trend -->
  <div class="flex items-center justify-between mb-1">
    <span class="hud-mono" style="font-size: 20px; letter-spacing: 0.04em; color: #c8d4df; font-weight: 300;">{universe === 'toc' ? 'FLOW-RATE' : 'LIFE-BATTERY'}</span>
    <div class="flex items-center gap-0">
      <span class="hud-mono" style="font-size: 14px; font-weight: 300; color: {textColor};">{percent}%</span>
      <span class="hud-mono mx-1" style="font-size: 14px; color: #334155;">|</span>
      <span class="hud-mono" style="font-size: 11px; color: {textColor}; margin-right: 3px;">{trendArrow}</span><span class="hud-mono" style="font-size: 13px; font-weight: 400; color: {textColor};">{trendWord}</span>
    </div>
  </div>

  {#if universe === 'toc'}
    <!-- Pipe/tube visualization for TOC universe — solid color, no fill semantics -->
    <div class="mb-2" style="filter: drop-shadow(0 0 10px {glowColor});">
      <svg width="100%" viewBox="0 0 300 58" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <defs>
          <linearGradient id="pipeDepth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="rgba(255,255,255,0.30)"/>
            <stop offset="38%"  stop-color="rgba(255,255,255,0.04)"/>
            <stop offset="100%" stop-color="rgba(0,0,0,0.38)"/>
          </linearGradient>
        </defs>
        <!-- Body -->
        <rect x="22" y="7" width="256" height="44" fill={fillColor} opacity="0.9" rx="2"/>
        <!-- Left flange -->
        <ellipse cx="22"  cy="29" rx="16" ry="25" fill={fillColor} opacity="0.95"/>
        <ellipse cx="22"  cy="29" rx="16" ry="25" fill="url(#pipeDepth)"/>
        <!-- Right flange -->
        <ellipse cx="278" cy="29" rx="16" ry="25" fill={fillColor} opacity="0.95"/>
        <ellipse cx="278" cy="29" rx="16" ry="25" fill="url(#pipeDepth)"/>
        <!-- Top highlight overlay on body -->
        <rect x="22" y="7" width="256" height="44" fill="url(#pipeDepth)" rx="2"/>
      </svg>
    </div>
    <!-- State label below pipe -->
    <div class="text-center mb-1">
      <span class="hud-mono" style="font-size: 10px; letter-spacing: 3px; color: {watermarkColor}; opacity: 0.55;">{watermark}</span>
    </div>
  {:else}
    <!-- Battery shape for longevity universe -->
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
              letter-spacing: 0.02em;
              color: {watermarkColor};
              text-shadow: 0 0 18px {watermarkColor}, 0 1px 3px rgba(0,0,0,0.9);
              background: rgba(0,0,0,0.55);
              padding: 4px 16px;
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

    <!-- EST_BIO_AGE — placeholder, data v0.4+ -->
    <div class="flex items-center justify-between mt-3">
      <span class="hud-mono" style="font-size: 13px; color: #475569;">
        EST_BIO_AGE: <span style="color: #334155;">—</span>
      </span>
    </div>
  {/if}

</div>
