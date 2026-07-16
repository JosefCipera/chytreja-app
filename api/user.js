// /api/user — user-profile, onboarding, readiness, snapshot, lehkost, dialog, health-profile, crt-context
// Route: ?action=profile | onboarding | lehkost-onboarding | readiness | snapshot | body-flow | checkin | lehkost-agent | dialog | health-profile | crt-context

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

function sb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  const action = req.query.action;

  if (action === 'profile')             return handleProfile(req, res);
  if (action === 'onboarding')          return handleOnboarding(req, res);
  if (action === 'lehkost-onboarding')  return handleLehkostOnboarding(req, res);
  if (action === 'readiness')           return handleReadiness(req, res);
  if (action === 'snapshot')            return handleSnapshot(req, res);
  if (action === 'checkin')             return handleCheckin(req, res);
  if (action === 'body-flow')           return handleBodyFlow(req, res);
  if (action === 'lehkost-agent')       return handleLehkostAgent(req, res);
  if (action === 'dialog')              return handleDialog(req, res);
  if (action === 'health-profile')      return handleHealthProfile(req, res);
  if (action === 'crt-context')         return handleCrtContext(req, res);

  return res.status(400).json({ error: 'action required: profile | onboarding | readiness | snapshot | checkin | body-flow | lehkost-agent | dialog | health-profile | crt-context' });
}


// ── GET/POST ?action=profile ──────────────────────────────────────
async function handleProfile(req, res) {
  const userId = req.body?.userId || req.query?.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  if (req.method === 'GET') {
    const { data, error } = await sb().from('user_profiles')
      .select('primary_goal, lh_identity, lh_blocker, lh_target_kg, lh_target_note, lh_started_at')
      .eq('user_id', userId).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || {});
  }

  const { primaryGoal } = req.body || {};
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
      })), { onConflict: 'user_id,node_id,universe' });
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


// ── POST ?action=lehkost-onboarding ──────────────────────────────
async function handleLehkostOnboarding(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { userId, identity, blocker, targetKg, targetNote } = req.body || {};
  if (!userId || !identity || !blocker) {
    return res.status(400).json({ error: 'userId, identity and blocker required' });
  }

  const update = {
    user_id:        userId,
    lh_identity:    identity,
    lh_blocker:     blocker,
    lh_target_kg:   targetKg   ?? null,
    lh_target_note: targetNote ?? null,
    lh_started_at:  new Date().toISOString(),
  };

  const { error } = await sb().from('user_profiles').upsert(update, { onConflict: 'user_id' });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
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

  // Fetch 14-day slots (same as calcLehkostIndex in hud-data-bulk)
  const since14Str = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data: rows14 } = await db.from('daily_checkin')
    .select('date,movement_level,binge,stress,sleep_hours')
    .eq('user_id', userId).eq('universe', 'lehkost')
    .gte('date', since14Str).order('date', { ascending: false });

  const slots = rows14 || [];

  // Compute indices matching calcLehkostIndex in hud-data-bulk.js exactly
  function lhIndex(nodeId) {
    const valid = slots.filter(s => s != null);
    if (!valid.length) return 50; // default fallback

    switch (nodeId) {
      case 'kardio': {
        const withData = valid.filter(s => s.movement_level != null);
        if (!withData.length) return 50;
        const active = withData.filter(s => ['medium','high'].includes(s.movement_level)).length;
        return Math.round(active / withData.length * 100);
      }
      case 'vyziva': {
        const withData = valid.filter(s => s.binge != null);
        if (!withData.length) return 50;
        const clean = withData.filter(s => !s.binge).length;
        return Math.round(clean / withData.length * 100);
      }
      case 'mysl': {
        const withData = valid.filter(s => s.stress != null);
        if (!withData.length) return 50;
        const avg = withData.reduce((a, s) => a + s.stress, 0) / withData.length;
        return Math.round(Math.max(0, (5 - avg) / 4 * 100));
      }
      case 'spanek': {
        const withData = valid.filter(s => s.sleep_hours != null).map(s => parseFloat(s.sleep_hours));
        if (!withData.length) return 50;
        const scores = withData.map(h => {
          if (h >= 7 && h <= 9) return Math.round(100 - Math.abs(h - 8) * 15);
          if (h >= 6) return 40;
          return 15;
        });
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
      default: return 50;
    }
  }

  const pohybIdx  = lhIndex('kardio');
  const vyzivaIdx = lhIndex('vyziva');
  const myslIdx   = lhIndex('mysl');
  const regenIdx  = lhIndex('spanek');
  // lh_main = worst child (same as parent rule in Longevity)
  const mainIdx   = Math.min(pohybIdx, vyzivaIdx, myslIdx, regenIdx);

  const toState = i => i <= 40 ? 'RED' : i <= 70 ? 'YELLOW' : 'GREEN';
  const now = new Date().toISOString();

  // Hubnutí (lehkost) → zapisuje do longevity uzlů
  // Mapování: lh_pohyb→kardio, lh_vyziva→vyziva, lh_mysl→mysl, lh_regenerace→spanek
  // dlouhovekost = worst child (hlavní uzel)
  await db.from('user_metrics').upsert([
    { user_id: userId, node_id: 'dlouhovekost', universe: 'longevity', current_index: mainIdx,   state: toState(mainIdx),   updated_at: now },
    { user_id: userId, node_id: 'vyziva',       universe: 'longevity', current_index: vyzivaIdx, state: toState(vyzivaIdx), updated_at: now },
    { user_id: userId, node_id: 'kardio',       universe: 'longevity', current_index: pohybIdx,  state: toState(pohybIdx),  updated_at: now },
    { user_id: userId, node_id: 'spanek',       universe: 'longevity', current_index: regenIdx,  state: toState(regenIdx),  updated_at: now },
    { user_id: userId, node_id: 'mysl',         universe: 'longevity', current_index: myslIdx,   state: toState(myslIdx),   updated_at: now },
  ], { onConflict: 'user_id,node_id,universe' });

  return res.json({ ok: true, body_flow: bf, indices: { main: mainIdx, pohyb: pohybIdx, vyziva: vyzivaIdx, mysl: myslIdx, regenerace: regenIdx } });
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
    { id: 'low_movement', label: 'MALÝ POHYB',
      score: Math.min(100, r7.filter(r=>r.movement_level==='low').length*15 + (avg(r7.map(r=>r.energy).filter(Boolean))<3?10:0)) },
    { id: 'sleep_deficit', label: 'SPÁNKOVÝ DEFICIT',
      score: Math.min(100, r7.filter(r=>r.sleep_hours!=null&&parseFloat(r.sleep_hours)<6.5).length*14 + (r7.filter(r=>r.binge).length>0?8:0)) },
    { id: 'stress_eating', label: 'JEDENÍ ZE STRESU',
      score: Math.min(100, r7.filter(r=>r.stress>=4).length*8 + r7.filter(r=>r.binge&&r.stress>=4).length*15) },
    { id: 'weekend_rebound', label: 'VÍKENDOVÉ PŘEJÍDÁNÍ',
      score: Math.min(100, r7.filter(r=>{const d=new Date(r.date).getDay();return(d===0||d===6)&&r.binge}).length*35) },
  ];
  return scores.sort((a,b)=>b.score-a.score);
}

function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null; }

// ── LEHKOST AGENT (přesunuto z agents.js kvůli limitu 12 Vercel functions) ──

const LH_MODEL = 'claude-sonnet-4-6';

const LEHKOST_SYSTEM = `Jsi Lehkost Agent CHJ — vybíráš konkrétní návykovou akci pro dnešní den na základě dat z check-inu.

FLOW KILLERS (co uživatele nejvíc brzdí):
- evening_overeating: jídlo po 20h, přejídání večer
- low_movement: málo pohybu, sedavý den
- sleep_deficit: spánek pod 6,5h
- stress_eating: jí ze stresu, kortizol
- weekend_rebound: víkend ruinuje týdenní pokrok

AKCE podle killeru:
evening_overeating:
  - "Dnes zakonči jídlo před 20:00 — nastav si budík"
  - "Připrav si zdravou svačinu před 19h, ať nemáš důvod sahat do lednice později"
  - "Po večeři jdi na krátkou procházku — přeruší chuť na jídlo"

low_movement:
  - "10 minut chůze teď — vyjdi ven nebo po schodech"
  - "Každou hodinu vstát a 2 minuty se projít — nastav připomínku"
  - "Při telefonátu stůj nebo choď — žádné sezení"

sleep_deficit:
  - "Dnes ulehni před 22:30 — nastav alarm jako připomínku"
  - "Vypni obrazovky hodinu před spaním — zhasni, dej si knihu"
  - "Vyvětrej ložnici na 18°C před spánkem"

stress_eating:
  - "Při stresu počkej 10 minut před jídlem — chuť přejde"
  - "5 minut pomalého dýchání před dalším jídlem — 4 sekundy nádech, 6 výdech"
  - "Napiš 3 věci za které jsi dnes vděčný — resetuje kortizol"

weekend_rebound:
  - "Připrav si jídlo na víkend dopředu — co budeš mít doma, to sníš"
  - "Víkendová procházka 30 minut — udrží metabolismus"
  - "Snídaně s proteinem i o víkendu — stabilizuje den"

PRAVIDLA:
- Nikdy neopakuj yesterdayAction
- Vyber JEDNU konkrétní akci — ne výčet možností
- Česky, tykej, klidný motivační tón
- type: "habit" (jednorázové HOTOVO) | "timed" (s dobou v sekundách)

ODPOVĚZ POUZE JSON (bez markdown):
{"action_id":"...","label":"...","type":"habit|timed","duration_s":null}`;

const LEHKOST_FALLBACKS = {
  evening_overeating: { action_id: 'lh_cutoff_20',     label: 'Dnes zakonči jídlo před 20:00 — nastav si budík',    type: 'habit', duration_s: null },
  low_movement:       { action_id: 'lh_walk_10',        label: '10 minut chůze teď — vyjdi ven',                     type: 'timed', duration_s: 600  },
  sleep_deficit:      { action_id: 'lh_sleep_2230',     label: 'Dnes ulehni před 22:30 — nastav si budík',           type: 'habit', duration_s: null },
  stress_eating:      { action_id: 'lh_breath_premeal', label: '5 minut pomalého dýchání před dalším jídlem',        type: 'timed', duration_s: 300  },
  weekend_rebound:    { action_id: 'lh_prep_food',      label: 'Připrav si zdravou svačinu na víkend dopředu',       type: 'habit', duration_s: null },
};

async function lehkostAgentCore(supabase, { userId, nodeId = 'lh_main', force = false, excludeActionId = null }) {
  const today = new Date().toISOString().split('T')[0];

  // Cache check
  if (!force) {
    const { data: cached } = await supabase.from('agent_log')
      .select('action_id, label, type, duration_s')
      .eq('user_id', userId).eq('node_id', nodeId).eq('date', today)
      .maybeSingle();
    if (cached?.action_id) return { ...cached, cached: true };
  }

  const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [checkinsRes, missionRes, metricsRes] = await Promise.all([
    supabase.from('daily_checkin')
      .select('date,binge,movement_level,sleep_hours,stress,weight_kg,energy')
      .eq('user_id', userId).eq('universe', 'lehkost').gte('date', since7)
      .order('date', { ascending: false }),
    supabase.from('mission_log').select('action_id').eq('user_id', userId).eq('node_id', nodeId)
      .gte('date', new Date(Date.now() - 86400000).toISOString().slice(0, 10))
      .order('date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('user_metrics').select('current_index')
      .eq('user_id', userId).eq('node_id', nodeId).eq('universe', 'lehkost').maybeSingle(),
  ]);

  const rows = checkinsRes.data || [];
  const yesterdayAction = missionRes.data?.action_id ?? null;
  const bodyFlow = metricsRes.data?.current_index ?? 50;

  // Detect top FLOW KILLER
  const LH_KILLER_DEFS = {
    evening_overeating: 'Večerní přejídání', low_movement: 'Nulový pohyb',
    sleep_deficit: 'Spánkový deficit',       stress_eating: 'Jedení ze stresu',
    weekend_rebound: 'Víkendové přestřelení',
  };
  let killerId = 'low_movement';
  if (rows.length > 0) {
    const r7 = rows.slice(0, 7);
    const avgS = (() => { const v = r7.map(r => r.stress).filter(Boolean); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0; })();
    const scores = [
      { id: 'evening_overeating', score: r7.filter(r=>r.binge).length*18 + (avgS>=3?10:0) },
      { id: 'low_movement',       score: r7.filter(r=>r.movement_level==='low').length*15 },
      { id: 'sleep_deficit',      score: r7.filter(r=>r.sleep_hours!=null&&parseFloat(r.sleep_hours)<6.5).length*14 },
      { id: 'stress_eating',      score: r7.filter(r=>r.stress>=4).length*8 + r7.filter(r=>r.binge&&r.stress>=4).length*15 },
      { id: 'weekend_rebound',    score: r7.filter(r=>{const d=new Date(r.date).getDay();return(d===0||d===6)&&r.binge}).length*35 },
    ];
    killerId = scores.sort((a,b)=>b.score-a.score)[0]?.id || 'low_movement';
  }

  const r3 = rows.slice(0, 3);
  const avgSleep = r3.length ? (r3.map(r=>parseFloat(r.sleep_hours||0)).reduce((a,b)=>a+b,0)/r3.length).toFixed(1) : null;
  const avgStress3 = r3.length ? (r3.map(r=>r.stress||0).reduce((a,b)=>a+b,0)/r3.length).toFixed(1) : null;
  const bingeCount = r3.filter(r=>r.binge).length;
  const todayRow = rows[0]?.date === today ? rows[0] : null;

  const contextMsg = `FLOW KILLER: ${killerId} (${LH_KILLER_DEFS[killerId] || killerId})
BODY FLOW: ${bodyFlow}/100
POSLEDNÍCH 3 DNÍ: spánek ${avgSleep ?? '?'}h průměr, stres ${avgStress3 ?? '?'}/5, přejídání ${bingeCount}× z 3
${todayRow ? `DNEŠNÍ CHECK-IN: energie ${todayRow.energy}/5, pohyb ${todayRow.movement_level}` : 'DNEŠNÍ CHECK-IN: chybí'}
VČEREJŠÍ AKCE: ${yesterdayAction ?? 'žádná'}
${excludeActionId ? `VYHNOUT SE: ${excludeActionId}` : ''}
${force ? 'DRUHÁ AKCE: Vyber jinou variantu.' : ''}

Vyber jednu konkrétní akci pro dnešek a přidej krátkou motivaci.`;

  let action = null;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: LH_MODEL, max_tokens: 200,
      system: LEHKOST_SYSTEM,
      messages: [{ role: 'user', content: contextMsg }],
    });
    const text = response.content.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) action = JSON.parse(match[0]);
  } catch (e) {
    console.warn('Lehkost Agent Haiku failed:', e.message);
  }

  if (!action?.action_id) {
    action = LEHKOST_FALLBACKS[killerId] || LEHKOST_FALLBACKS.low_movement;
  }

  // Save to agent_log (fire-and-forget)
  supabase.from('agent_log').insert({
    user_id: userId, node_id: nodeId, discipline: killerId, date: today, tier: 1,
    action_id: action.action_id, label: action.label, type: action.type,
    duration_s: action.duration_s ?? null, guide_search: null, guide_label: null,
  }).then(({ error }) => { if (error) console.warn('agent_log insert failed:', error.message); });

  return action;
}

async function handleLehkostAgent(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { userId, nodeId, force, excludeActionId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    return res.json(await lehkostAgentCore(supabase, { userId, nodeId, force, excludeActionId }));
  } catch (e) {
    console.error('lehkost-agent error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// ── Dialog — constraint finding ───────────────────────────────────────────────
async function handleDialog(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { userId, role = 'longevity', messages = [] } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Načti kontext
  const [metricsRes, profileRes] = await Promise.all([
    supabase.from('user_metrics').select('node_id, state').eq('user_id', userId).in('state', ['RED','YELLOW']).order('current_index', { ascending: true }).limit(4),
    supabase.from('user_health_profile').select('diagnoses, labs, goal_text, crt_cache').eq('user_id', userId).maybeSingle(),
  ]);

  const profile = profileRes.data || {};
  const contextBlock = [
    (metricsRes.data||[]).length && `Nejslabší uzly: ${(metricsRes.data||[]).map(n=>`${n.node_id}(${n.state})`).join(', ')}`,
    profile.diagnoses?.length   && `Diagnózy: ${profile.diagnoses.join(', ')}`,
    profile.labs?.LDL           && `LDL ${profile.labs.LDL}`,
    profile.goal_text           && `Cíl: ${profile.goal_text}`,
    profile.crt_cache?.nodes?.find(n=>n.type==='root')?.label && `CRT kořen: ${profile.crt_cache.nodes.find(n=>n.type==='root').label}`,
  ].filter(Boolean).join('\n');

  const systemPrompt = `Jsi CHJ. Vedeš krátký ranní rozhovor — zjisti co dnes uživatele nejvíc limituje.

Kontext:
${contextBlock}

Pravidla:
- Ptej se dokud nemáš jasno. Pak rozhodni — klidně po 2 otázkách, klidně po 5.
- Každá otázka: přirozená čeština, tykání, max 8 slov.
- Ptej se jako člověk, ne jako formulář. Reaguj na předchozí odpověď.
- Příklady: "Spal jsi dobře?" / "Jak se cítíš?" / "Bolí tě něco?"
- Když máš dost info, vrať POUZE tento JSON bez dalšího textu:
  {"done":true,"text":"konkrétní akce max 8 slov","constraint":"název","node_id":"node_id"}
- node_id: spanek | mysl | kardio | vyziva | regenerace
- Nikdy neříkej "řekni co dál" ani podobné výzvy — to řeší UI`;

  const reqMessages = messages.length === 0
    ? [{ role: 'user', content: '(začni dialog)' }]
    : messages;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' });

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 150, system: systemPrompt, messages: reqMessages }),
  });

  if (!aiRes.ok) return res.status(502).json({ error: 'Claude error', detail: await aiRes.text() });

  const raw = (await aiRes.json()).content?.[0]?.text?.trim() ?? '';

  try {
    const m = raw.match(/\{.*"done"\s*:\s*true.*\}/s);
    if (m) {
      const result = JSON.parse(m[0]);
      if (result.node_id) {
        const today = new Date().toISOString().slice(0,10);
        await supabase.from('daily_checkin').upsert(
          { user_id: userId, date: today, universe: 'longevity', constraint_node_id: result.node_id, constraint_label: result.constraint },
          { onConflict: 'user_id,date,universe' }
        );
      }
      return res.json({ text: result.text, done: true, constraint: result.constraint, node_id: result.node_id });
    }
  } catch(_) {}

  return res.json({ text: raw, done: false });
}

// ── Health profile — GET/POST ─────────────────────────────────────────────────
async function handleHealthProfile(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const { data, error } = await supabase.from('user_health_profile').select('*').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.json(data || { user_id: userId });
  }

  if (req.method === 'POST') {
    const { userId, ...patch } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const { data: existing } = await supabase.from('user_health_profile').select('*').eq('user_id', userId).single();
    const merged = { user_id: userId, ...(existing||{}), ...patch };
    if (patch.diagnoses && existing?.diagnoses) merged.diagnoses = [...new Set([...existing.diagnoses, ...patch.diagnoses])];
    if (patch.medications && existing?.medications) {
      const map = {}; [...(existing.medications||[]),...(patch.medications||[])].forEach(m=>{ map[m.name]=m; });
      merged.medications = Object.values(map);
    }
    if (patch.labs && existing?.labs) merged.labs = { ...existing.labs, ...patch.labs };
    if (patch.doctor_notes && existing?.doctor_notes) merged.doctor_notes = existing.doctor_notes + '\n\n---\n\n' + patch.doctor_notes;
    const { data, error } = await supabase.from('user_health_profile').upsert(merged, { onConflict: 'user_id' }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, profile: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


// ── GET ?action=crt-context ───────────────────────────────────────────────────
const DIAG_MAP = [
  // Kardiovaskulární
  [/fibrilace\s*síní\s*(paroxysmální|fap|\(fap\))/i,                  'FIBRILACE_SINI_PAROXYSMALNI'],
  [/fibrilace\s*síní/i,                                                'FIBRILACE_SINI'],
  [/arteriální\s*hypertenze|hypertenze|vysoký\s*(krevní\s*)?tlak/i,   'HYPERTENZE'],
  [/ateroskleróz[ae]/i,                                                'ATEROSKLEROZA'],
  [/extrasystol[ye]|předčasné\s*stahy/i,                               'EXTRASYSTOLY'],
  [/bušení\s*srdce|palpitace/i,                                        'BUSENI_SRDCE'],
  [/chronický\s*stres/i,                                               'CHRONICKY_STRES'],
  // Metabolické
  [/diabetes\s*(mellitus\s*)?(2\.\s*typu|typ\s*2|ii)/i,               'DIABETES_2_TYPU'],
  [/diabetes/i,                                                         'DIABETES_2_TYPU'],
  [/prediabetes|hraniční\s*glykémie/i,                                 'PREDIABETES'],
  [/inzulínová\s*rezistence/i,                                         'INZULINOVA_REZISTENCE'],
  [/metabolický\s*syndrom/i,                                           'METABOLICKY_SYNDROM'],
  // Hormonální
  [/hypothyreóz[ae]|hypotyreóz[ae]|snížená\s*funkce\s*štítné/i,      'HYPOTHYREOZA'],
  [/hyperthyreóz[ae]/i,                                                'HYPERTHYREOZA'],
  // Pohybový aparát
  [/stenóza\s*páteřního\s*kanálu|spinální\s*stenóz[ae]/i,             'STENOZA_PATERE'],
  [/spondylóz[ae]|spondylartróz[ae]/i,                                 'SPONDYLOZA'],
  [/degenerativní\s*(změny|onemocnění)\s*(páteře|plotének)/i,          'DEGENERATIVNI_ZMENY_PATERE'],
  [/výhřez\s*(meziobratlové\s*)?ploténky|hernie\s*disku/i,             'HERNIATED_DISC'],
  [/osteoporóz[ae]/i,                                                  'OSTEOPOROZA'],
  [/osteopéni[ae]/i,                                                   'OSTEOPENIE'],
  [/periferní\s*neuropati[ae]/i,                                       'PERIEFERNI_NEUROPATIE'],
  // Neurologické / psychické
  [/depres[ei]/i,                                                       'DEPRESE'],
  [/úzkost(ná\s*porucha)?|anxióz[aní]/i,                               'UZKOST'],
  [/esenciální\s*tremor/i,                                             'ESENCIALNI_TREMOR'],
  [/st\.?\s*p\.?\s*(i?CMP|cévní\s*mozk\w+\s*příhod\w+|stroke|TIA)/i, 'STAV_PO_CMP'],
  [/mild\s*(kognitivní|cognitive)\s*(impairment|porucha)|MCI|lehká\s*kognitivní\s*porucha/i, 'MILD_KOGN_IMPAIRMENT'],
  // Symptomy
  [/bolest\s*(v\s*)?(noh|dolních\s*končetin)/i,                        'BOLEST_NOHOU'],
  [/slabost\s*(noh|dolních\s*končetin)/i,                              'SLABOST_NOHOU'],
  [/nestabilní\s*(chůze|chůzi)/i,                                      'NESTABILITA_CHUZE'],
  // Vaskulární / sexuální zdraví
  [/erektilní\s*dysfunkc[ei]|erektilní\s*poruch[ay]|impotence/i,        'ERECTILNI_DYSFUNKCE'],
];
const LAB_KEY_MAP = {
  ldl:'ldl', ldl_cholesterol:'ldl',
  systolic_bp:'systolic_bp', systolický_tlak:'systolic_bp', tk_sys:'systolic_bp',
  diastolic_bp:'diastolic_bp',
  k:'k', kalium:'k', draslík:'k',
  crp:'crp', glucose:'glucose', glukóza:'glucose', hba1c:'hba1c',
  tsh:'tsh', ft4:'ft4',
  'vitamin_d':'vitamin_d', 'vit_d':'vitamin_d', 'calcidiol':'vitamin_d',
  b12:'b12', 'vitamin_b12':'b12',
  calcium:'calcium', vápník:'calcium',
  kreatinin:'kreatinin', creatinine:'kreatinin',
  alt:'alt', ast:'ast',
};
function normDiag(d) {
  for (const [re, code] of DIAG_MAP) if (re.test(d)) return code;
  return d.toUpperCase().replace(/\s+/g,'_').replace(/[^A-Z0-9_]/g,'');
}
function normLabs(raw) {
  if (!raw) return {};
  const out = {};
  Object.entries(raw).forEach(([k,v]) => {
    const nk = LAB_KEY_MAP[k.toLowerCase().replace(/\s+/g,'_')] || k.toLowerCase();
    out[nk] = typeof v === 'string' ? (isNaN(v) ? v : parseFloat(v)) : v;
  });
  return out;
}

async function handleCrtContext(req, res) {
  const userId = req.query.userId || req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const supabase = sb();
  const [{ data: prof }, { data: meds }, { data: chk }, { data: rdns }] = await Promise.all([
    supabase.from('user_health_profile').select('diagnoses,symptoms,labs,supplements,medications').eq('user_id', userId).single(),
    supabase.from('user_medications').select('name').eq('user_id', userId).eq('active', true),
    supabase.from('daily_checkin').select('stress,sleep_hours,movement_level,energy').eq('user_id', userId).order('date',{ascending:false}).limit(3),
    supabase.from('user_readiness').select('hrv').eq('user_id', userId).order('created_at',{ascending:false}).limit(1),
  ]);

  const avg = (arr, key) => { const vs=(arr||[]).map(c=>c[key]).filter(v=>v!=null); return vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null; };
  const mode = (arr, key) => { const vs=(arr||[]).map(c=>c[key]).filter(Boolean); if(!vs.length) return null; const f={}; vs.forEach(v=>f[v]=(f[v]||0)+1); return Object.entries(f).sort((a,b)=>b[1]-a[1])[0][0]; };

  const ctx = {
    labs: normLabs(prof?.labs),
    checkin: { stress:avg(chk,'stress'), sleep_hours:avg(chk,'sleep_hours'), movement_level:mode(chk,'movement_level'), energy:avg(chk,'energy'), hrv:rdns?.[0]?.hrv??null },
    diagnoses: (prof?.diagnoses||[]).map(normDiag),
    symptoms:  (prof?.symptoms ||[]).map(normDiag),
    meds: [
      ...(meds||[]).map(m=>m.name),
      ...(prof?.medications||[]).map(m=>typeof m==='string'?m:m.name).filter(Boolean),
    ],
    supps: (prof?.supplements||[]).map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean),
  };

  res.setHeader('Cache-Control','no-store');
  res.json(ctx);
}
