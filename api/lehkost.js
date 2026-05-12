// POST /api/lehkost?action=checkin  — save daily check-in
// GET  /api/lehkost?action=body-flow&userId=...  — compute BODY FLOW score + FLOW KILLER
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { action } = req.query;

  if (action === 'checkin')    return handleCheckin(req, res, sb);
  if (action === 'body-flow')  return handleBodyFlow(req, res, sb);

  return res.status(400).json({ error: 'action required: checkin | body-flow' });
}


// ── POST ?action=checkin ──────────────────────────────────────────
async function handleCheckin(req, res, sb) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { userId, weight_kg, energy, sleep_hours, binge, movement_level, stress } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await sb.from('daily_checkin').upsert({
    user_id: userId,
    date: today,
    universe: 'lehkost',
    weight_kg:      weight_kg      ?? null,
    energy:         energy         ?? null,
    sleep_hours:    sleep_hours    ?? null,
    binge:          binge          ?? null,
    movement_level: movement_level ?? null,
    stress:         stress         ?? null,
  }, { onConflict: 'user_id,date,universe' });

  if (error) return res.status(500).json({ error: error.message });

  // Po check-inu ihned přepočítej BODY FLOW a ulož do user_metrics
  const bf = await computeBodyFlow(userId, sb);
  await sb.from('user_metrics').upsert({
    user_id: userId,
    node_id: 'lh_main',
    universe: 'lehkost',
    current_index: bf.score,
    state: bf.score <= 40 ? 'RED' : bf.score <= 70 ? 'YELLOW' : 'GREEN',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,node_id,universe' });

  return res.json({ ok: true, body_flow: bf });
}


// ── GET ?action=body-flow ─────────────────────────────────────────
async function handleBodyFlow(req, res, sb) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const bf = await computeBodyFlow(userId, sb);
  return res.json(bf);
}


// ── BODY FLOW VÝPOČET ─────────────────────────────────────────────
// BODY FLOW = adherence*0.4 + movement*0.2 + sleep*0.2 + signals*0.2
// Rozsah 0–100, základ 14 dní check-inů + mission_log
async function computeBodyFlow(userId, sb) {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceStr = since.toISOString().slice(0, 10);

  // Načti check-iny posledních 14 dní
  const { data: checkins } = await sb
    .from('daily_checkin')
    .select('date, energy, sleep_hours, binge, movement_level, stress, weight_kg')
    .eq('user_id', userId)
    .eq('universe', 'lehkost')
    .gte('date', sinceStr)
    .order('date', { ascending: false });

  // Načti splněné akce (lh_ prefix) posledních 14 dní
  const { data: missions } = await sb
    .from('mission_log')
    .select('date, action_id')
    .eq('user_id', userId)
    .like('action_id', 'lh_%')
    .gte('date', sinceStr);

  const rows = checkins || [];
  const logs = missions || [];

  // ── 1. ADHERENCE (40%) ──
  // Kolik dní měl uživatel aspoň 1 splněnou akci z posledních 14
  const daysWithAction = new Set(logs.map(l => l.date)).size;
  const adherencePct = Math.min(100, Math.round((daysWithAction / 14) * 100));

  // ── 2. POHYB (20%) ──
  const movScores = { high: 100, medium: 60, low: 20 };
  const movVals = rows.filter(r => r.movement_level).map(r => movScores[r.movement_level] || 50);
  const movementPct = movVals.length ? Math.round(movVals.reduce((a, b) => a + b, 0) / movVals.length) : 50;

  // ── 3. SPÁNEK (20%) ──
  // < 6h = 20, 6–7 = 55, 7–8 = 80, 8+ = 100
  const sleepVals = rows.filter(r => r.sleep_hours != null).map(r => {
    const h = parseFloat(r.sleep_hours);
    if (h >= 8)   return 100;
    if (h >= 7)   return 80;
    if (h >= 6)   return 55;
    return 20;
  });
  const sleepPct = sleepVals.length ? Math.round(sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length) : 50;

  // ── 4. SIGNÁLY — váha + binge (20%) ──
  const bingeCount  = rows.filter(r => r.binge === true).length;
  const bingeScore  = Math.max(0, 100 - bingeCount * 15);   // každý binge -15

  // Váhový trend (posledních 7 dní): pokles = bonus, stagnace = neutrální, růst = mínus
  const withWeight = rows.filter(r => r.weight_kg != null).slice(0, 7);
  let trendBonus = 0;
  if (withWeight.length >= 2) {
    const oldest = parseFloat(withWeight[withWeight.length - 1].weight_kg);
    const newest = parseFloat(withWeight[0].weight_kg);
    const delta  = oldest - newest;   // kladné = zhublý
    trendBonus = Math.max(-20, Math.min(20, Math.round(delta * 10)));
  }
  const signalsPct = Math.max(0, Math.min(100, bingeScore + trendBonus));

  // ── VÝSLEDNÉ SKÓRE ──
  const score = Math.round(
    adherencePct * 0.4 +
    movementPct  * 0.2 +
    sleepPct     * 0.2 +
    signalsPct   * 0.2
  );

  // ── FLOW KILLER DETEKCE ──
  const killers = detectKillers(rows, logs);

  return {
    score,
    components: {
      adherence: adherencePct,
      movement:  movementPct,
      sleep:     sleepPct,
      signals:   signalsPct,
    },
    killers,  // seřazeno od nejvyššího score
    top_killer: killers[0] || null,
  };
}


// ── FLOW KILLER DETEKCE ───────────────────────────────────────────
// Každý killer má "signature" v datech. Vrátí seřazený scoreboard.
function detectKillers(rows, _logs) {
  const recent7 = rows.slice(0, 7);   // posledních 7 check-inů
  const scores  = [];

  // 1. Večerní přejídání
  {
    const bingeCount = recent7.filter(r => r.binge === true).length;
    const avgStress  = avg(recent7.map(r => r.stress).filter(Boolean));
    let s = bingeCount * 18;                     // každý binge +18
    if (avgStress >= 3) s += 10;
    scores.push({ id: 'evening_overeating', label: 'VEČERNÍ PŘEJÍDÁNÍ', score: Math.min(100, s) });
  }

  // 2. Nízký pohyb (NEAT)
  {
    const lowDays = recent7.filter(r => r.movement_level === 'low').length;
    const avgEner = avg(recent7.map(r => r.energy).filter(Boolean));
    let s = lowDays * 15;
    if (avgEner && avgEner < 3) s += 10;
    scores.push({ id: 'low_movement', label: 'NULOVÝ POHYB', score: Math.min(100, s) });
  }

  // 3. Spánkový deficit
  {
    const badSleep = recent7.filter(r => r.sleep_hours != null && parseFloat(r.sleep_hours) < 6.5).length;
    const highBinge = recent7.filter(r => r.binge === true).length;
    let s = badSleep * 14;
    if (highBinge > 0) s += 8;   // spánkový deficit zvyšuje chuť na jídlo
    scores.push({ id: 'sleep_deficit', label: 'SPÁNKOVÝ DEFICIT', score: Math.min(100, s) });
  }

  // 4. Stresové jedení
  {
    const highStress = recent7.filter(r => r.stress != null && r.stress >= 4).length;
    const bingePlus  = recent7.filter(r => r.binge === true && r.stress >= 4).length;
    let s = highStress * 8 + bingePlus * 15;
    scores.push({ id: 'stress_eating', label: 'STRESOVÉ JEDENÍ', score: Math.min(100, s) });
  }

  // 5. Víkendové přestřelení
  {
    const weekendBinge = recent7.filter(r => {
      const day = new Date(r.date).getDay();   // 0 = Ne, 6 = So
      return (day === 0 || day === 6) && r.binge === true;
    }).length;
    let s = weekendBinge * 35;
    scores.push({ id: 'weekend_rebound', label: 'VÍKENDOVÉ PŘESTŘELENÍ', score: Math.min(100, s) });
  }

  // Seřaď od nejvyššího
  return scores.sort((a, b) => b.score - a.score);
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
