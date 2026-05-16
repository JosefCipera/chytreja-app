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
    nodeId = null,
    spark = null,
  } = $props();

  // ── Longevity / TOC battery ────────────────────────────
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

  let textColor = $derived(
    percent > 70 ? '#86C46A' :
    percent > 40 ? '#BED255' :
    '#C97272'
  );

  let watermark = $derived(
    universe === 'toc'
      ? (percent <= 40 ? 'FLOW_DECAY' : percent <= 70 ? 'FLOW_STABLE' : 'FLOW_OPTIMAL')
      : (percent <= 40 ? 'CELL_DECAY' : percent <= 70 ? 'CELL_STABLE' : 'CELL_OPTIMAL')
  );

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

  // ── Lehkost sparkline ──────────────────────────────────
  const LH_SPARK_LABELS = {
    lh_main:       'Váha za posledních 14 dní',
    lh_pohyb:      'Posledních 14 dní',
    lh_vyziva:     'Posledních 14 dní',
    lh_mysl:       'Posledních 14 dní',
    lh_regenerace: 'Posledních 14 dní',
  };

  let sparkLabel = $derived(LH_SPARK_LABELS[nodeId] ?? 'Posledních 14 dní');

  let sparkCanvas = $state(null);

  function linearForecast(vals, steps = 4) {
    const n = Math.min(5, vals.length);
    const slice = vals.slice(-n);
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i; sumY += slice[i]; sumXY += i * slice[i]; sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;
    const fc = [];
    for (let s = 1; s <= steps; s++) fc.push(intercept + slope * ((n - 1) + s));
    return fc;
  }

  function drawSpark(canvas, data, dotColor) {
    if (!canvas || !data?.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Filter out leading nulls
    const validData = data.filter(v => v != null);
    if (validData.length < 2) return;

    const forecast = linearForecast(validData, 4);
    const allVals = [...validData, ...forecast];
    const mx = 12, my = 12;
    const min = Math.min(...allVals), max = Math.max(...allVals);
    const rng = Math.max(0.001, max - min);

    const realPts = validData.map((v, i) => ({
      x: mx + (i / (allVals.length - 1)) * (w - mx * 2),
      y: h - my - ((v - min) / rng) * (h - my * 2),
    }));
    const fcPts = forecast.map((v, i) => ({
      x: mx + ((validData.length + i) / (allVals.length - 1)) * (w - mx * 2),
      y: h - my - ((v - min) / rng) * (h - my * 2),
    }));

    // Area fill — under full width including forecast
    const lastFc = fcPts.at(-1);
    ctx.beginPath();
    ctx.moveTo(realPts[0].x, h);
    realPts.forEach(p => ctx.lineTo(p.x, p.y));
    fcPts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(lastFc.x, h);
    ctx.closePath();
    ctx.fillStyle = dotColor + '14';
    ctx.fill();

    // Main line — bezier
    ctx.beginPath();
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = dotColor + 'dd';
    ctx.moveTo(realPts[0].x, realPts[0].y);
    for (let i = 1; i < realPts.length - 2; i++) {
      const xc = (realPts[i].x + realPts[i+1].x) / 2;
      const yc = (realPts[i].y + realPts[i+1].y) / 2;
      ctx.quadraticCurveTo(realPts[i].x, realPts[i].y, xc, yc);
    }
    const last = realPts.at(-1), pre = realPts.at(-2);
    const endX = pre.x + (last.x - pre.x) * 0.88;
    const endY = pre.y + (last.y - pre.y) * 0.88;
    ctx.quadraticCurveTo(pre.x, pre.y, endX, endY);
    ctx.stroke();

    // Dashed forecast — only with enough data
    if (validData.length >= 5) {
      ctx.beginPath();
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = dotColor + '40';
      ctx.moveTo(endX, endY);
      fcPts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Dot
    ctx.beginPath();
    ctx.arc(endX, endY, 9, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();
  }

  const sparkColor = $derived(
    spark?.status_color === '#22c55e' ? '#22c55e' :
    spark?.status_color === '#f59e0b' ? '#f59e0b' :
    spark?.status_color === '#ef4444' ? '#ef4444' :
    '#64748b'
  );

  $effect(() => {
    if (universe === 'lehkost' && sparkCanvas && spark?.data) {
      // rAF so canvas has layout dimensions
      requestAnimationFrame(() => drawSpark(sparkCanvas, spark.data, sparkColor ?? '#60a5fa'));
    }
  });
</script>

{#if universe === 'lehkost'}
<!-- ── LEHKOST: sparkline sekce ── -->
<div style="background: #1e293b; border-radius: 12px; padding: 16px 16px 18px;">
  <!-- Label nad grafem -->
  <div style="font-size: 15px; font-weight: 400; color: #94a3b8; margin-bottom: 10px;">
    {sparkLabel}
  </div>

  <!-- Canvas -->
  <canvas
    bind:this={sparkCanvas}
    style="width: 100%; height: 68px; display: block; margin-bottom: 14px;"
  ></canvas>

  {#if spark}
    <!-- Velké číslo -->
    <div style="font-size: 32px; font-weight: 400; color: #f1f5f9; line-height: 1; margin-bottom: 6px;">
      {spark.value}{#if spark.unit}<span style="font-size: 16px; font-weight: 400; color: #94a3b8; margin-left: 4px;">{spark.unit}</span>{/if}
    </div>

    <!-- Status s tečkou -->
    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #94a3b8; margin-bottom: 4px;">
      <span style="width: 8px; height: 8px; border-radius: 50%; background: {spark.status_color}; flex-shrink: 0; display: inline-block;"></span>
      {spark.status_text}
    </div>

    <!-- Rozmezí -->
    {#if spark.range}
      <div style="font-size: 13px; color: #94a3b8;">{spark.range}</div>
    {/if}

    <!-- Trajectory — jen pro lh_main -->
    {#if spark.trajectory}
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
        <div style="font-family: monospace; font-size: 10px; letter-spacing: 0.12em; color: #475569; margin-bottom: 5px;">TRAJECTORY</div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <span style="font-size: 15px; font-weight: 500; color: #e2e8f0;">{spark.trajectory.delta}</span>
          <span style="font-family: monospace; font-size: 11px; color: {spark.trajectory.color}; letter-spacing: 0.08em;">{spark.trajectory.label}</span>
        </div>
        {#if spark.trajectory.to_target}
          <div style="font-size: 12px; color: #64748b;">{spark.trajectory.to_target}</div>
        {/if}
      </div>
    {/if}
  {:else}
    <!-- Fallback pokud spark data ještě nejsou -->
    <div style="font-size: 13px; color: #475569; font-family: monospace;">Vyplň check-in pro data</div>
  {/if}
</div>

{:else}
<!-- ── LONGEVITY / TOC: původní baterie ── -->
<div class="hud-glass rounded-lg p-4 hud-c4">
  <span class="hc hc-tl"></span><span class="hc hc-tr"></span>
  <div class="flex items-center justify-between mb-1">
    <span class="hud-mono" style="font-size: 20px; letter-spacing: 0.04em; color: #c8d4df; font-weight: 300;">{universe === 'toc' ? 'FLOW-RATE' : 'LIFE-BATTERY'}</span>
    <div class="flex items-center gap-0" style="flex-shrink: 0;">
      <span class="hud-mono" style="font-size: 14px; font-weight: 300; color: {textColor};">{percent}%</span>
      <span class="hud-mono mx-1" style="font-size: 14px; color: #334155;">|</span>
      <span class="hud-mono" style="font-size: 11px; color: {textColor}; margin-right: 3px;">{trendArrow}</span><span class="hud-mono" style="font-size: 13px; font-weight: 400; color: {textColor}; white-space: nowrap;">{trendWord}</span>
    </div>
  </div>

  <div class="flex items-center gap-0 mb-3">
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

    <div
      class="rounded-r-sm"
      style="width: 12px; height: 58px; background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.06); border-left: none; box-shadow: 0 0 8px {glowColor};"
    ></div>
  </div>

  {#if universe !== 'toc'}
  <div class="flex items-center justify-between mt-3">
    <span class="hud-mono" style="font-size: 13px; color: #475569;">
      EST_BIO_AGE: <span style="color: #334155;">—</span>
    </span>
  </div>
  {/if}
</div>
{/if}
