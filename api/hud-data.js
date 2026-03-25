// GET /api/hud-data?userId=xxx&nodeId=telo
// Returns complete HUD payload for a given node + user.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

import { execute as cviceni }  from '../app/js/universe/skills/cviceni.js';
import { execute as prevence } from '../app/js/universe/skills/prevence.js';
import { execute as metabol }  from '../app/js/universe/skills/metabol.js';
import { execute as vyziva }   from '../app/js/universe/skills/vyziva.js';
import { execute as mindset }  from '../app/js/universe/skills/mindset.js';

// ── CONSTANTS ─────────────────────────────────────────

const ATTIA_WEIGHTS = { telo: 0.50, zdravi: 0.25, mysl: 0.15, vyziva: 0.10 };
const CHILD_NODES   = ['telo', 'zdravi', 'mysl', 'vyziva'];

const NODE_LABELS = {
  dlouhovekost: 'Hra o život', telo: 'Tělo', mysl: 'Mysl',
  vyziva: 'Výživa', zdravi: 'Zdraví', metabolicke: 'Metabolismus',
  sila: 'Síla', stabilita: 'Stabilita', kardio: 'Kardio',
  vo2max: 'VO₂max', mobilita: 'Mobilita', spanek: 'Spánek',
};

const NODE_KILLERS = {
  telo: { label: 'SRDCE', energy_drain: -8, description: 'Srdce potřebuje pohyb.' },
  mysl: { label: 'MOZEK', energy_drain: -7, description: 'Myšlení slábne bez zátěže.' },
  vyziva: { label: 'METABOLISMUS', energy_drain: -6, description: 'Tělo ztrácí rovnováhu.' },
  zdravi: { label: 'IMUNITA', energy_drain: -7, description: 'Imunita potřebuje posilu.' },
  metabolicke: { label: 'METABOLISMUS', energy_drain: -6, description: 'Tělo ztrácí rovnováhu.' },
  sila: { label: 'SRDCE', energy_drain: -8, description: 'Srdce potřebuje pohyb.' },
  stabilita: { label: 'MOZEK', energy_drain: -5, description: 'Rovnováha chrání mozek.' },
  kardio: { label: 'SRDCE', energy_drain: -9, description: 'Srdce potřebuje pohyb.' },
  vo2max: { label: 'SRDCE', energy_drain: -8, description: 'Kondice chrání srdce.' },
  spanek: { label: 'MOZEK', energy_drain: -7, description: 'Spánek opravuje mozek.' },
  dlouhovekost: { label: 'SRDCE', energy_drain: -8, description: 'Srdce potřebuje pohyb.' },
};

const VERDICT_TEXTS = {
  telo:        { RED: 'Tělo ztrácí sílu.',           YELLOW: 'Tělo drží, ale sotva.',      GREEN: 'Tělo je v kondici.' },
  mysl:        { RED: 'Hlava zpomaluje.',             YELLOW: 'Hlava drží, přidej.',        GREEN: 'Hlava je v pohodě.' },
  vyziva:      { RED: 'Strava nestačí.',              YELLOW: 'Strava ujde, dá se líp.',    GREEN: 'Strava je v pořádku.' },
  zdravi:      { RED: 'Prevence chybí.',              YELLOW: 'Prevence má mezery.',         GREEN: 'Prevence funguje.' },
  metabolicke: { RED: 'Metabolismus klesá.',          YELLOW: 'Metabolismus kolísá.',        GREEN: 'Metabolismus v normě.' },
  dlouhovekost:{ RED: 'Tělo a zdraví brzdí.',         YELLOW: 'Potenciál čeká.',             GREEN: 'Na správné cestě.' },
};

// ── SKILL ROUTING ──────────────────────────────────────

function getSkill(nodeId) {
  if (['telo','sila','stabilita','kardio','vo2max','mobilita'].includes(nodeId)) return cviceni;
  if (['zdravi','imunitni','obnova','spanek'].includes(nodeId)) return prevence;
  if (['metabolicke','glukoza','pust'].includes(nodeId)) return metabol;
  if (['vyziva','protein','hydratace','casovani_jidel','mikronutrienty'].includes(nodeId)) return vyziva;
  if (['mysl','meditace','soustredeni','emoce','vdecnost','stres'].includes(nodeId)) return mindset;
  return cviceni; // fallback
}

// ── HELPERS ────────────────────────────────────────────

function indexToState(i) {
  if (i <= 40) return 'RED';
  if (i <= 70) return 'YELLOW';
  return 'GREEN';
}

function calcTrend(history) {
  if (!history || history.length < 2) return { label: 'STABLE', direction: 'stable' };
  const recent = history.slice(-3).map(h => h.current_index);
  const delta = recent[recent.length - 1] - recent[0];
  if (delta > 3)  return { label: 'UP',     direction: 'up' };
  if (delta < -3) return { label: 'DOWN',   direction: 'down' };
  return             { label: 'STABLE', direction: 'stable' };
}

function calcParentBattery(metrics) {
  let total = 0, weightSum = 0;
  for (const [nodeId, weight] of Object.entries(ATTIA_WEIGHTS)) {
    const m = metrics.find(m => m.node_id === nodeId);
    if (m) { total += m.current_index * weight; weightSum += weight; }
  }
  return weightSum > 0 ? Math.round(total / weightSum) : 50;
}

function worstChildState(metrics) {
  const states = metrics
    .filter(m => CHILD_NODES.includes(m.node_id))
    .map(m => m.state || indexToState(m.current_index));
  if (states.includes('RED'))    return 'RED';
  if (states.includes('YELLOW')) return 'YELLOW';
  return 'GREEN';
}

// ── HANDLER ────────────────────────────────────────────

export default async function handler(req, res) {
  const { userId, nodeId = 'telo' } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // 1. Fetch all relevant metrics in one query
  const nodesToFetch = [...new Set([nodeId, ...CHILD_NODES, 'spanek'])];
  // Try longevity universe first, fall back to any universe
  let { data: metricsRaw } = await supabase
    .from('user_metrics')
    .select('node_id, current_index, state')
    .eq('user_id', userId)
    .eq('universe', 'longevity')
    .in('node_id', nodesToFetch);

  if (!metricsRaw || metricsRaw.length === 0) {
    const { data: fallback } = await supabase
      .from('user_metrics')
      .select('node_id, current_index, state')
      .eq('user_id', userId)
      .in('node_id', nodesToFetch);
    metricsRaw = fallback;
  }

  const metrics = metricsRaw || [];

  // Find current node metric
  const nodeMeta = metrics.find(m => m.node_id === nodeId) || { current_index: 50, state: 'YELLOW' };
  const current_index = nodeMeta.current_index ?? 50;
  const state = nodeMeta.state || indexToState(current_index);

  // Battery: parent uses weighted avg + worst-child color; leaf uses own index
  const isParent = nodeId === 'dlouhovekost';
  const batteryPercent = isParent ? calcParentBattery(metrics) : current_index;
  const batteryState   = isParent ? worstChildState(metrics) : state;

  // REPAIR_RATE inputs
  const spanekIndex  = metrics.find(m => m.node_id === 'spanek')?.current_index ?? 50;
  const vyzivaIndex  = metrics.find(m => m.node_id === 'vyziva')?.current_index ?? 50;

  // 2. Fetch trend history (last 14 days)
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data: historyRaw } = await supabase
    .from('node_state_history')
    .select('current_index, date')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .gte('date', since)
    .order('date', { ascending: true });

  const trend = calcTrend(historyRaw);

  // 3. Today's mission count
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayMissions } = await supabase
    .from('mission_log')
    .select('id')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .eq('date', today);

  const todayCount = todayMissions?.length ?? 0;

  // 4. Streak
  const { data: streakRows } = await supabase
    .from('mission_log')
    .select('date')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .order('date', { ascending: false })
    .limit(30);

  let streak = 0;
  if (streakRows?.length > 0) {
    const dates = [...new Set(streakRows.map(r => r.date))].sort().reverse();
    let check = today;
    for (const d of dates) {
      if (d === check) { streak++; check = new Date(new Date(d).getTime() - 86400000).toISOString().slice(0, 10); }
      else break;
    }
  }

  // 5. Constraints
  const { data: constraintRows } = await supabase
    .from('user_constraints')
    .select('constraint_type')
    .eq('user_id', userId);

  const constraints = constraintRows?.map(r => r.constraint_type) ?? [];

  // 6. Action via skill
  let action = null;
  if (todayCount < 2) {
    const skill = getSkill(nodeId);
    const result = skill({ nodeId, state, streak, constraints, dayOffset: todayCount });
    if (result) {
      action = {
        id: result.mission.id,
        label: result.mission.label,
        icon: result.mission.icon,
        type: result.mission.action_type,
        duration: result.mission.duration_sec,
        target: result.mission.target,
        status: 'READY',
        tier: result.level.tier,
        motivation: result.motivation,
      };
    }
  }

  // 7. Sources (up to 2)
  const { data: articles } = await supabase
    .from('longevity_articles')
    .select('id, title, url, summary')
    .eq('node_id', nodeId)
    .limit(2);

  const sources = (articles || []).map((a, i) => ({
    med_id: a.id,
    type: i === 0 ? 'STUDY' : 'REVIEW',
    title: a.title,
    journal: 'PubMed',
    year: 2024,
    status: i === 0 ? 'VERIFIED' : 'AUTHENTICATED',
    url: a.url,
  }));

  // 8. Killer + verdict
  const killer = NODE_KILLERS[nodeId] || NODE_KILLERS.telo;
  const verdictMap = VERDICT_TEXTS[nodeId] || VERDICT_TEXTS.telo;
  const verdict = verdictMap[batteryState] || verdictMap.YELLOW;

  // 9. Build response
  res.json({
    node: {
      id: nodeId,
      label: NODE_LABELS[nodeId] || nodeId,
      version: 'v0.2',
    },
    battery: {
      percent: batteryPercent,
      state: batteryState,
      trend_label: trend.label,
      trend_direction: trend.direction,
      spanek_index: spanekIndex,
      vyziva_index: vyzivaIndex,
    },
    killer,
    action,
    sources,
    verdict,
    today_count: todayCount,
    streak,
  });
}
