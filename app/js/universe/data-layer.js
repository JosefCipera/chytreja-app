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

  const mx = 15, my = 10;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = Math.max(1e-6, max - min);
  const pts = data.map((v, i) => ({
    x: mx + (i / (data.length - 1)) * (w - mx * 2),
    y: h - ((v - min) / rng) * (h - my * 2) - my
  }));

  // Barevná křivka trendu
  ctx.beginPath();
  ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = (color || '#22d3ee') + 'e0';
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 2; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  const last = pts.at(-1), pre = pts.at(-2);
  const endX = pre.x + (last.x - pre.x) * 0.9;
  const endY = pre.y + (last.y - pre.y) * 0.9;
  ctx.quadraticCurveTo(pre.x, pre.y, endX, endY);
  ctx.stroke();

  // Šedý "forecast" ocas
  ctx.beginPath();
  ctx.moveTo(endX + 6, endY);
  ctx.lineTo(Math.min(w - 8, endX + 220), endY);
  ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.strokeStyle = '#94a3b844';
  ctx.stroke();

  // Tečka na konci křivky
  ctx.beginPath();
  ctx.arc(endX, endY, 9, 0, Math.PI * 2);
  ctx.fillStyle = color || '#22d3ee';
  ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff';
  ctx.stroke();
}

export async function fetchTrend(userId, nodeId, nodeState) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

  console.log('📈 fetchTrend params:', { userId, nodeId, dateFilter, clientOk: !!window.supabaseClient });

  const { data: testData, error: testError } = await window.supabaseClient
    .from('node_state_history')
    .select('user_id, node_id, date, state')
    .limit(3);
  console.log('📈 test (no filter):', { testData, testError });

  const { data, error } = await window.supabaseClient
    .from('node_state_history')
    .select('date, state')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .gte('date', dateFilter)
    .order('date', { ascending: true });

  console.log('📈 filtered result:', { data, error, rowCount: data?.length });

  if (error) console.error('Trend error:', error);

  if (!data || data.length === 0) {
    return {
      html: '<div style="color:#64748b; font-size:13px; padding:16px 0;">Zatím není trend</div>',
      text: 'Stabilní', numeric: [], lineColor: '#64748b',
      trendColor: '#64748b', arrow: '→', dataLength: 0
    };
  }

  // Numerická data pro canvas (GREEN=3, YELLOW=2, RED=1)
  const numeric = data.map(d => d.state === 'GREEN' ? 3 : d.state === 'YELLOW' ? 2 : 1);

  const recent = data.slice(-7);
  const recentGreen = recent.filter(d => d.state === 'GREEN').length;
  const recentRed   = recent.filter(d => d.state === 'RED').length;

  let arrow = '→', trendText = 'Stabilní', trendColor = '#eab308';
  if (recentGreen > recentRed + 2)  { arrow = '↗️'; trendText = 'Zlepšení'; trendColor = '#22c55e'; }
  else if (recentRed > recentGreen + 2) { arrow = '↘️'; trendText = 'Zhoršení'; trendColor = '#ef4444'; }

  const lineColor = nodeState === 'GREEN' ? '#22c55e'
    : nodeState === 'YELLOW' ? '#eab308'
    : nodeState === 'RED'    ? '#ef4444'
    : '#64748b';

  return { text: trendText, numeric, lineColor, trendColor, arrow, dataLength: data.length };
}
