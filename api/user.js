// /api/user — user-profile, onboarding-save, readiness, snapshot-nodes + lehkost body-flow
// Route: ?action=profile | onboarding | readiness | snapshot | body-flow | checkin
//
// Dřívější soubory: user-profile.js, onboarding-save.js, readiness.js, snapshot-nodes.js
// + lehkost.js (checkin + body-flow)

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  const action = req.query.action;

  if (action === 'profile')    return handleProfile(req, res);
  if (action === 'onboarding') return handleOnboarding(req, res);
  if (action === 'readiness')  return handleReadiness(req, res);
  if (action === 'snapshot')   return handleSnapshot(req, res);
  if (action === 'checkin')    return handleCheckin(req, res);
  if (action === 'body-flow')  return handleBodyFlow(req, res);

  return res.status(400).json({ error: 'action required: profile | onboarding | readiness | snapshot | checkin | body-flow' });
}


// ── POST ?action=profile ──────────────────────────────────────────
async function handleProfile(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { userId, primaryGoal } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const update = { user_id: userId };
  if (primaryGoal !== undefined) update.primary_goal = primaryGoal;

  const { error } = await sb().from('user_profiles').upsert(update, { onConflict: 'user_id' });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
}


// ── POST ?action=onboarding ───────────────────────────────────────
async function handleOnboarding(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { userId, nodes, primaryGoal } = req.body || {};
  if (!userId || !Array.isArray(nodes)) return res.status(400).json({ error: 'userId and nodes[] required' });

  const db    = sb();
  const today = new Date().toISOString().slice(0, 10);

  try {
    if (nodes.length) {
      await db.from('node_inputs').insert(nodes.map(n => ({
        user_id: userId, node_id: n.nodeId, source: 'onboarding', state: n.state, value_numeric: n.currentIndex,
      })));
      await db.from('user_metrics').upsert(nodes.map(n => ({
        user_id: userId, node_id: n.nodeId, universe: 'longevity', current_index: n.currentIndex, state: n.state,
      })), { onConflict: 'user_id,node_id' });
      await db.from('node_state_history').insert(nodes.map(n => ({
        user_id: userId, node_id: n.nodeId, date: today, state: n.state, current_index: n.currentIndex,
      })));
    }
    if (primaryGoal) {
      await db.from('user_profiles').upsert({ user_id: userId, primary_goal: primaryGoal }, { onConflict: 'user_id' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[user/onboarding]', err);
    return res.status(500).json({ error: err.message });
  }
}


// ── POST/GET ?action=readiness ────────────────────────────────────
async function handleReadiness(req, res) {
  if (req.method === 'POST') {
    const db = sb();
    try {
      const { userId, energie, spanek_hod, hrv } = req.body || {};
      if (!userId || energie == null || spanek_hod == null)
        return res.status(400).json({ error: 'Missing required fields' });
      const today = new Date().toISOString().split('T')[0];
      const { error } = await db.from('user_readiness').upsert({
        user_id: userId, date: today,
        energy_level: Number(energie), sleep_hours: Number(spanek_hod),
        hrv_ms: hrv != null ? Number(hrv) : null, source: 'manual',
      }, { onConflict: 'user_id,date' });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true, date: today });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method === 'GET') {
    const db = sb();
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const today = new Date().toISOString().split('T')[0];
      const { data } = await db.from('user_readiness')
        .select('energy_level, sleep_hours, hrv_ms, source').eq('user_id', userId).eq('date', today).maybeSingle();
      return res.json({ exists: !!data, data: data || null });
    } catch (e) {
      return res.json({ exists: false, data: null });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}


// ── POST ?action=snapshot ─────────────────────────────────────────
async function handleSnapshot(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { userId, rows } = req.body || {};
  if (!userId || !Array.isArray(rows) || !rows.length)
    return res.status(400).json({ error: 'userId and rows[] required' });
  const safe = rows.map(r => ({ ...r, user_id: userId }));
  const { error } = await sb().from('node_state_history')
    .upsert(safe, { onConflict: 'user_id,node_id,date', ignoreDuplicates: true });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, saved: safe.length });
}


// ── POST ?action=checkin ─────────────────────────────────────────
// Lehkost: ranní check-in
async function handleCheckin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { userId, weight_kg, energy, sleep_hours, binge, movement_level, stress } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const db    = sb();
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await db.from('daily_checkin').upsert({
    user_id: userId, date: today, universe: 'lehkost',
    weight_kg:      weight_kg      ?? null,
    energy:         energy         ?? null,
    sleep_hours:    sleep_hours    ?? null,
    binge:          binge          ?? null,
    movement_level: movement_level ?? null,
    stress:         stress         ?? null,
  }, { onConflict: 'user_id,date,universe' });

  if (error) return res.status(500).json({ error: error.message });

  const bf = await computeBodyFlow(userId, db);

  // lh_vyziva: binge=true→nižší, null→50
  const vyzivaIdx = binge === true ? 38 : binge === false ? 62 : 50;
  // lh_pohyb: high→80, medium→55, low→30, null→50
  const pohybIdx  = movement_level === 'high' ? 80 : movement_level === 'medium' ? 55 : movement_level === 'low' ? 30 : 50;
  // lh_regenerace: sleep ≥8→80, ≥7→65, ≥6→48, <6→30, null→50
  const regenIdx  = sleep_hours == null ? 50 : parseFloat(sleep_hours) >= 8 ? 80 : parseFloat(sleep_hours) >= 7 ? 65 : parseFloat(sleep_hours) >= 6 ? 48 : 30;
  // lh_mysl: stress 1-2→75, 3→55, 4-5→35, null→50
  const myslIdx   = stress == null ? 50 : stress <= 2 ? 75 : stress === 3 ? 55 : 35;

  const toState = i => i <= 40 ? 'RED' : i <= 70 ? 'YELLOW' : 'GREEN';
  const now = new Date().toISOString();

  await db.from('user_metrics').upsert([
    { user_id: userId, node_id: 'lh_main',       universe: 'lehkost', current_index: bf.score,  state: toState(bf.score),  updated_at: now },
    { user_id: userId, node_id: 'lh_vyziva',     universe: 'lehkost', current_index: vyzivaIdx, state: toState(vyzivaIdx), updated_at: now },
    { user_id: userId, node_id: 'lh_pohyb',      universe: 'lehkost', current_index: pohybIdx,  state: toState(pohybIdx),  updated_at: now },
    { user_id: userId, node_id: 'lh_regenerace', universe: 'lehkost', current_index: regenIdx,  state: toState(regenIdx),  updated_at: now },
    { user_id: userId, node_id: 'lh_mysl',       universe: 'lehkost', current_index: myslIdx,   state: toState(myslIdx),   updated_at: now },
  ], { onConflict: 'user_id,node_id,universe' });

  return res.json({ ok: true, body_flow: bf });
}


// ── GET ?action=body-flow&userId=... ─────────────────────────────
async function handleBodyFlow(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const bf = await computeBodyFlow(userId, sb());
  return res.json(bf);
}


// ── BODY FLOW výpočet + killer detekce ───────────────────────────
async function computeBodyFlow(userId, db) {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceStr = since.toISOString().slice(0, 10);

  const [{ data: checkins }, { data: missions }] = await Promise.all([
    db.from('daily_checkin').select('date,energy,sleep_hours,binge,movement_level,stress,weight_kg')
      .eq('user_id', userId).eq('universe', 'lehkost').gte('date', sinceStr).order('date', { ascending: false }),
    db.from('mission_log').select('date,action_id').eq('user_id', userId)
      .like('action_id', 'lh_%').gte('date', sinceStr),
  ]);

  const rows = checkins || [];
  const logs = missions || [];

  const adherencePct = Math.min(100, Math.round((new Set(logs.map(l => l.date)).size / 14) * 100));

  const movScores = { high: 100, medium: 60, low: 20 };
  const movVals   = rows.filter(r => r.movement_level).map(r => movScores[r.movement_level] || 50);
  const movementPct = movVals.length ? Math.round(movVals.reduce((a,b)=>a+b,0)/movVals.length) : 50;

  const sleepVals = rows.filter(r => r.sleep_hours != null).map(r => {
    const h = parseFloat(r.sleep_hours);
    return h >= 8 ? 100 : h >= 7 ? 80 : h >= 6 ? 55 : 20;
  });
  const sleepPct = sleepVals.length ? Math.round(sleepVals.reduce((a,b)=>a+b,0)/sleepVals.length) : 50;

  const bingeCount  = rows.filter(r => r.binge === true).length;
  const withWeight  = rows.filter(r => r.weight_kg != null).slice(0, 7);
  let trendBonus = 0;
  if (withWeight.length >= 2) {
    const delta = parseFloat(withWeight[withWeight.length-1].weight_kg) - parseFloat(withWeight[0].weight_kg);
    trendBonus = Math.max(-20, Math.min(20, Math.round(delta * 10)));
  }
  const signalsPct = Math.max(0, Math.min(100, Math.max(0, 100 - bingeCount * 15) + trendBonus));

  const score = Math.round(adherencePct*0.4 + movementPct*0.2 + sleepPct*0.2 + signalsPct*0.2);
  const killers = detectKillers(rows);

  return { score, components: { adherence: adherencePct, movement: movementPct, sleep: sleepPct, signals: signalsPct }, killers, top_killer: killers[0] || null };
}

function detectKillers(rows) {
  const r7 = rows.slice(0, 7);
  const avgStress = avg(r7.map(r => r.stress).filter(Boolean));
  const scores = [
    { id: 'evening_overeating', label: 'VEČERNÍ PŘEJÍDÁNÍ',
      score: Math.min(100, r7.filter(r=>r.binge).length*18 + (avgStress>=3?10:0)) },
    { id: 'low_movement', label: 'NULOVÝ POHYB',
      score: Math.min(100, r7.filter(r=>r.movement_level==='low').length*15 + (avg(r7.map(r=>r.energy).filter(Boolean))<3?10:0)) },
    { id: 'sleep_deficit', label: 'SPÁNKOVÝ DEFICIT',
      score: Math.min(100, r7.filter(r=>r.sleep_hours!=null&&parseFloat(r.sleep_hours)<6.5).length*14 + (r7.filter(r=>r.binge).length>0?8:0)) },
    { id: 'stress_eating', label: 'STRESOVÉ JEDENÍ',
      score: Math.min(100, r7.filter(r=>r.stress>=4).length*8 + r7.filter(r=>r.binge&&r.stress>=4).length*15) },
    { id: 'weekend_rebound', label: 'VÍKENDOVÉ PŘESTŘELENÍ',
      score: Math.min(100, r7.filter(r=>{const d=new Date(r.date).getDay();return(d===0||d===6)&&r.binge}).length*35) },
  ];
  return scores.sort((a,b)=>b.score-a.score);
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }
