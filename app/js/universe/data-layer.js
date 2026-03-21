// === DATA LAYER — Supabase queries, trend fetching, chart drawing ===
// Extracted from universe-panel.js during refactoring

// =====================================================
// DATA FETCHING
// =====================================================

export async function fetchAspiration(userId, nodeId) {
  if (nodeId === 'dlouhovekost') return null;
  try {
    const res = await fetch(`/api/aspiration?userId=${encodeURIComponent(userId)}&nodeId=${encodeURIComponent(nodeId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.aspiration || null;
  } catch {
    return null;
  }
}

export async function fetchLearningSteps(nodeId) {
  try {
    const { data, error } = await window.supabaseClient
      .from('universe_nodes')
      .select('*')
      .eq('id', nodeId)
      .eq('universe_id', 'longevity')
      .maybeSingle();

    if (error) {
      console.warn(`⚠️ fetchLearningSteps(${nodeId}):`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('⚠️ fetchLearningSteps exception:', err);
    return null;
  }
}

// =====================================================
// WEATHER-STYLE MINI TREND (canvas)
// =====================================================

export function drawMiniTrend(ctx, data, color) {
  if (!ctx || !data || data.length < 2) return;
  const c   = ctx.canvas;
  const w   = c.clientWidth  || c.offsetWidth  || 240;
  const h   = c.clientHeight || c.offsetHeight || 55;
  const dpr = window.devicePixelRatio || 1;
  c.width   = w * dpr;
  c.height  = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Dynamic scale: data range + 20% padding (min 10 units)
  const mx = 15, my = 12;
  const rawMin = Math.min(...data), rawMax = Math.max(...data);
  const rawRng = rawMax - rawMin;
  const pad = Math.max(10, rawRng * 0.3);
  const scaleMin = Math.max(0, rawMin - pad);
  const scaleMax = Math.min(100, rawMax + pad);
  const rng = Math.max(1, scaleMax - scaleMin);

  const pts = data.map((v, i) => ({
    x: mx + (i / (data.length - 1)) * (w - mx * 2),
    y: h - ((v - scaleMin) / rng) * (h - my * 2) - my
  }));
  pts.forEach(p => { p.y = Math.max(my, Math.min(h - my, p.y)); });

  // Smooth spline path builder
  function buildSpline() {
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
      return;
    }
    for (let i = 1; i < pts.length - 2; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    const pre = pts.at(-2), last = pts.at(-1);
    ctx.quadraticCurveTo(pre.x, pre.y, last.x, last.y);
  }

  // Main trend line (original thick style)
  ctx.beginPath();
  ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = (color || '#22d3ee') + 'e0';
  buildSpline();
  ctx.stroke();

  const endX = pts.at(-1).x;
  const endY = pts.at(-1).y;

  // Trend projection — linear regression on last 7 points
  const projLen = 40;
  if (data.length >= 3) {
    const recent = data.slice(-7);
    const n = recent.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += recent[i]; sxy += i * recent[i]; sx2 += i * i; }
    const denom = n * sx2 - sx * sx;
    const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;

    const slopeY = -(slope / rng) * (h - my * 2);
    const projEndX = Math.min(w - 8, endX + projLen);
    const projEndY = Math.max(my, Math.min(h - my, endY + slopeY * (projLen / 15)));

    ctx.beginPath();
    ctx.setLineDash([4, 6]);
    ctx.moveTo(endX + 4, endY);
    ctx.lineTo(projEndX, projEndY);
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.strokeStyle = (color || '#22d3ee') + '55';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // End dot (original size)
  ctx.beginPath();
  ctx.arc(endX, endY, 9, 0, Math.PI * 2);
  ctx.fillStyle = color || '#22d3ee';
  ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff';
  ctx.stroke();
}

/** Draw current_index label next to the sparkline dot */
export function drawIndexLabel(ctx, index, color) {
  if (!ctx || index === undefined || index === null) return;
  const c = ctx.canvas;
  const w = c.clientWidth || c.offsetWidth || 240;
  const h = c.clientHeight || c.offsetHeight || 55;
  const dpr = window.devicePixelRatio || 1;
  // Don't re-init canvas, just draw on top
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillStyle = color || '#94a3b8';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(Math.round(index), w - 8, 4);
}

export async function fetchTrend(userId, nodeId, nodeState) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

  const { data, error } = await window.supabaseClient
    .from('node_state_history')
    .select('date, state, current_index')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .gte('date', dateFilter)
    .order('date', { ascending: true });

  if (error) console.error('Trend error:', error);

  if (!data || data.length === 0) {
    return {
      text: 'Stabilní', numeric: [], lineColor: '#64748b',
      trendColor: '#64748b', arrow: '→', dataLength: 0
    };
  }

  // Use current_index if available, fallback to state mapping
  const numeric = data.map(d =>
    d.current_index != null ? d.current_index
    : d.state === 'GREEN' ? 80 : d.state === 'YELLOW' ? 50 : 30
  );

  // Trend direction from last 7 index values
  const recent = numeric.slice(-7);
  const first = recent[0], last = recent.at(-1);
  const delta = last - first;

  let arrow = '→', trendText = 'Stabilní', trendColor = '#eab308';
  if (delta > 5)       { arrow = '↗️'; trendText = 'Zlepšení'; trendColor = '#22c55e'; }
  else if (delta < -5) { arrow = '↘️'; trendText = 'Zhoršení'; trendColor = '#ef4444'; }

  const lineColor = nodeState === 'GREEN' ? '#22c55e'
    : nodeState === 'YELLOW' ? '#eab308'
    : nodeState === 'RED'    ? '#ef4444'
    : '#64748b';

  return { text: trendText, numeric, lineColor, trendColor, arrow, dataLength: data.length };
}
