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

  // Pipe SVG for TOC universe
  const PIPE_VW = 360, PIPE_VH = 82, PIPE_CY = PIPE_VH / 2;
  const PIPE_RX = 16;
  const PIPE_SEGS = 12;

  function pipePath() {
    const lx = PIPE_RX, rx = PIPE_VW - PIPE_RX;
    return `M ${lx},0 L ${rx},0 A ${PIPE_RX},${PIPE_CY} 0 0 1 ${rx},${PIPE_VH} L ${lx},${PIPE_VH} A ${PIPE_RX},${PIPE_CY} 0 0 1 ${lx},0 Z`;
  }

  function pipeSvg(pct) {
    const uid = 'lb';
    const filled = Math.round((pct / 100) * PIPE_SEGS);
    const segFill   = pct > 70 ? 'rgba(134,196,106,0.75)' : pct > 40 ? 'rgba(190,210,85,0.75)'  : 'rgba(201,114,114,0.75)';
    const segGlow   = pct > 70 ? 'rgba(134,196,106,0.55)' : pct > 40 ? 'rgba(190,210,85,0.55)'  : 'rgba(201,114,114,0.55)';
    const border    = pct > 70 ? 'rgba(134,196,106,0.45)' : pct > 40 ? 'rgba(190,210,85,0.45)'  : 'rgba(201,114,114,0.45)';
    const glow      = pct > 70 ? 'rgba(134,196,106,0.25)' : pct > 40 ? 'rgba(190,210,85,0.25)'  : 'rgba(201,114,114,0.25)';
    const wmColor   = pct > 70 ? '#86C46A'                : pct > 40 ? '#BED255'                 : '#C97272';
    const wm        = pct > 70 ? 'FLOW_STABLE'            : pct > 40 ? 'FLOW_WARN'               : 'FLOW_LOW';

    const path = pipePath();
    const SEG_PAD_X = 4;
    const SEG_X0 = PIPE_RX + SEG_PAD_X;
    const SEG_X1 = PIPE_VW - PIPE_RX - SEG_PAD_X;
    const SEG_TOTAL_W = SEG_X1 - SEG_X0;
    const GAP = 3;
    const SEG_W = (SEG_TOTAL_W - GAP * (PIPE_SEGS - 1)) / PIPE_SEGS;
    const SEG_Y = 9, SEG_H = PIPE_VH - 18;

    let segs = '';
    for (let i = 0; i < PIPE_SEGS; i++) {
      const x = SEG_X0 + i * (SEG_W + GAP);
      segs += i < filled
        ? `<rect x="${x.toFixed(1)}" y="${SEG_Y}" width="${SEG_W.toFixed(1)}" height="${SEG_H}" rx="2" fill="${segFill}" filter="url(#gf${uid})"/>`
        : `<rect x="${x.toFixed(1)}" y="${SEG_Y}" width="${SEG_W.toFixed(1)}" height="${SEG_H}" rx="2" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>`;
    }

    const wmCX = (SEG_X0 + SEG_X1) / 2;
    const wmW = 148, wmH = 26;

    return `<svg viewBox="0 0 ${PIPE_VW} ${PIPE_VH}" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;display:block;filter:drop-shadow(0 0 12px ${glow}) drop-shadow(0 0 4px ${glow});">
      <defs>
        <clipPath id="cp${uid}"><path d="${path}"/></clipPath>
        <filter id="gf${uid}" x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="hi${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(255,255,255,0.14)"/>
          <stop offset="38%"  stop-color="rgba(255,255,255,0.02)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </linearGradient>
        <linearGradient id="sh${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.28)"/>
        </linearGradient>
        <linearGradient id="bg${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${border}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="${border}" stop-opacity="0.3"/>
        </linearGradient>
        <radialGradient id="hole${uid}" cx="50%" cy="44%" r="55%">
          <stop offset="0%"   stop-color="rgba(0,0,0,0.92)"/>
          <stop offset="85%"  stop-color="rgba(0,0,0,0.72)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.20)"/>
        </radialGradient>
        <linearGradient id="ch${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(255,255,255,0.20)"/>
          <stop offset="50%"  stop-color="rgba(255,255,255,0.0)"/>
        </linearGradient>
      </defs>
      <path d="${path}" fill="rgba(0,0,0,0.58)" clip-path="url(#cp${uid})"/>
      <g clip-path="url(#cp${uid})">${segs}</g>
      <rect x="0" y="0" width="${PIPE_VW}" height="${PIPE_VH}" fill="url(#hi${uid})" clip-path="url(#cp${uid})"/>
      <rect x="0" y="0" width="${PIPE_VW}" height="${PIPE_VH}" fill="url(#sh${uid})" clip-path="url(#cp${uid})"/>
      <path d="${path}" fill="none" stroke="url(#bg${uid})" stroke-width="1.5"/>
      <g clip-path="url(#cp${uid})">
        <rect x="${wmCX - wmW/2}" y="${PIPE_CY - wmH/2}" width="${wmW}" height="${wmH}" fill="rgba(0,0,0,0.65)" rx="3"/>
        <text x="${wmCX}" y="${PIPE_CY + 1}" text-anchor="middle" dominant-baseline="middle"
          font-family="JetBrains Mono, monospace" font-size="17" font-weight="700"
          letter-spacing="1.5" fill="${wmColor}">${wm}</text>
      </g>
      <ellipse cx="${PIPE_RX}" cy="${PIPE_CY}" rx="${PIPE_RX}" ry="${PIPE_CY}" fill="url(#hole${uid})"/>
      <ellipse cx="${PIPE_RX}" cy="${PIPE_CY}" rx="${PIPE_RX}" ry="${PIPE_CY}" fill="url(#ch${uid})"/>
      <ellipse cx="${PIPE_RX}" cy="${PIPE_CY}" rx="${PIPE_RX}" ry="${PIPE_CY}" fill="none" stroke="url(#bg${uid})" stroke-width="1.5"/>
    </svg>`;
  }

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
    <!-- Pipe visualization v6 — SVG segments + ellipse cap in foreground -->
    <div class="mb-2">
      {@html pipeSvg(percent)}
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
