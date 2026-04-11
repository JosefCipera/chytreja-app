// GET /api/hud-data?userId=xxx&nodeId=telo
// Returns complete HUD payload for a given node + user.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Actions now loaded from longevity_actions table in Supabase

// ── CONSTANTS ─────────────────────────────────────────

const ATTIA_WEIGHTS = { telo: 0.50, zdravi: 0.25, mysl: 0.15, vyziva: 0.10 };
const CHILD_NODES   = ['telo', 'zdravi', 'mysl', 'vyziva'];

const NODE_LABELS = {
  dlouhovekost: 'Hra o život', telo: 'Tělo', mysl: 'Mysl',
  vyziva: 'Výživa', zdravi: 'Zdraví', metabolicke: 'Metabolismus',
  sila: 'Síla', stabilita: 'Stabilita', kardio: 'Kardio',
  vo2max: 'VO₂max', mobilita: 'Mobilita', spanek: 'Spánek',
  imunitni: 'Imunita', nervovy_system: 'Nervový systém',
  rovnovaha: 'Rovnováha', obnova: 'Obnova', vytrvalost: 'Výdrž',
  dychani: 'Dýchání', stres: 'Stres', mysl_emoce: 'Emoce',
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

// ── TIER SELECTION ─────────────────────────────────────

function pickTier(state, streak) {
  let tier = state === 'GREEN' ? 2 : 1;
  if (streak >= 3) tier = Math.min(tier + 1, 3);
  return tier;
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
  const state = indexToState(current_index); // always derive from index, never trust stored state

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

  // 6. Action from longevity_actions DB
  let action = null;
  let actionTags = null; // used by step 7 for source matching
  if (todayCount < 2) {
    const tier = pickTier(state, streak);

    // Get already-done action IDs today to avoid repeats
    const doneIds = (todayMissions || []).map(m => m.action_id).filter(Boolean);

    // Try preferred tier first, fall back to tier 1
    let { data: candidates } = await supabase
      .from('longevity_actions')
      .select('*')
      .eq('node_id', nodeId)
      .eq('active', true)
      .eq('tier', tier);

    if (!candidates || candidates.length === 0) {
      const { data: fallback } = await supabase
        .from('longevity_actions')
        .select('*')
        .eq('node_id', nodeId)
        .eq('active', true)
        .order('tier')
        .limit(10);
      candidates = fallback || [];
    }

    // Exclude already done today
    const available = candidates.filter(a => !doneIds.includes(a.id));
    const pool = available.length > 0 ? available : candidates;
    const picked = pool[Math.floor(Math.random() * pool.length)];

    if (picked) {
      action = {
        id:            picked.id,
        label:         picked.label,
        icon:          picked.icon || '🏋️',
        type:          picked.type,
        duration:      picked.duration,
        reps:          picked.reps,
        protocol_type: picked.protocol_type,
        status:        'READY',
        tier:          picked.tier,
      };
      // Capture tags for source matching (step 7)
      if (Array.isArray(picked.tags) && picked.tags.length > 0) {
        actionTags = picked.tags;
      }
    }
  }

  // 7. Sources (up to 2) — prefer tag-based match for current action, fallback to node_id

  let sourcesRaw = null;

  // Helper: sort candidates — Czech sources (script_cz) first, then shuffle the rest
  function sortSources(arr) {
    const cz = arr.filter(s => s.script_cz);
    const en = arr.filter(s => !s.script_cz).sort(() => Math.random() - 0.5);
    return [...cz, ...en];
  }

  if (actionTags) {
    // Primary: articles whose tags overlap with the action's tags
    const { data: tagMatched } = await supabase
      .from('longevity_sources')
      .select('id, title, url, type, summary, journal, year, med_id, script_cz')
      .eq('active', true)
      .overlaps('tags', actionTags)
      .limit(8);

    if (tagMatched && tagMatched.length > 0) {
      sourcesRaw = sortSources(tagMatched).slice(0, 2);
    }
  }

  // Fallback: node_id based (original behaviour)
  if (!sourcesRaw || sourcesRaw.length < 2) {
    const { data: nodeFallback } = await supabase
      .from('longevity_sources')
      .select('id, title, url, type, summary, journal, year, med_id, script_cz')
      .eq('node_id', nodeId)
      .eq('active', true)
      .limit(8);

    const sorted = sortSources(nodeFallback || []);
    const extra = sorted.filter(s => !sourcesRaw?.some(r => r.id === s.id));
    sourcesRaw = [...(sourcesRaw || []), ...extra].slice(0, 2);
  }

  const sources = (sourcesRaw || []).map((s, i) => ({
    med_id:    s.med_id || s.id,
    type:      s.type || 'article',
    title:     s.title,
    journal:   s.journal || null,
    year:      s.year || null,
    status:    i === 0 ? 'VERIFIED' : 'AUTHENTICATED',
    url:       s.url,
    lang:      s.script_cz ? 'cs' : 'en',
    script_cz: s.script_cz || null,
    summary:   s.summary || null,
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
