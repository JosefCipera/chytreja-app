// GET /api/hud-data-bulk?userId=xxx&nodes=telo,mysl,zdravi,vyziva
// Returns HUD data for multiple nodes in one request, sharing one Supabase connection.
// Used by Universe prefetch so HUD panel can open instantly from cache.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// ── Shared constants from hud-data.js ─────────────────
const NODE_KILLERS = {
  telo:         { label: 'SRDCE',        description: 'Každý rok bez pohybu ti bere roky života.' },
  mysl:         { label: 'MOZEK',        description: 'Mozek, který se nezatěžuje, odumírá.' },
  vyziva:       { label: 'METABOLISMUS', description: 'Špatná strava ničí tělo dřív než ho stačíš opravit.' },
  zdravi:       { label: 'IMUNITA',      description: 'Tělo bez obrany prohrává tiše a pomalu.' },
  metabolicke:  { label: 'METABOLISMUS', description: 'Metabolismus bez rytmu tě ničí zevnitř.' },
  sila:         { label: 'SRDCE',        description: 'Bez svalů srdce nemá co pohánět.' },
  stabilita:    { label: 'MOZEK',        description: 'První pád. Pak druhý. Pak konec pohybu.' },
  kardio:       { label: 'SRDCE',        description: 'Srdce bez zátěže odejde dřív než čekáš.' },
  spanek:       { label: 'MOZEK',        description: 'Bez spánku mozek ničí sám sebe.' },
  dlouhovekost: { label: 'SRDCE',        description: 'Každý rok bez pohybu ti bere roky života.' },
};

const NODE_LABELS = {
  dlouhovekost: 'Hra o život', telo: 'Tělo', mysl: 'Mysl',
  vyziva: 'Výživa', zdravi: 'Zdraví', metabolicke: 'Metabolismus',
  sila: 'Síla', stabilita: 'Stabilita', kardio: 'Kardio',
  spanek: 'Spánek', vo2max: 'VO₂max', mobilita: 'Mobilita',
};

const VERDICT_TEXTS = {
  telo:        { RED: 'Tělo ztrácí sílu.',      YELLOW: 'Tělo drží, ale sotva.',   GREEN: 'Tělo je v kondici.' },
  mysl:        { RED: 'Hlava zpomaluje.',        YELLOW: 'Hlava drží, přidej.',     GREEN: 'Hlava je v pohodě.' },
  vyziva:      { RED: 'Strava nestačí.',         YELLOW: 'Strava ujde, dá se líp.', GREEN: 'Strava je v pořádku.' },
  zdravi:      { RED: 'Prevence chybí.',         YELLOW: 'Prevence má mezery.',     GREEN: 'Prevence funguje.' },
  metabolicke: { RED: 'Metabolismus klesá.',     YELLOW: 'Metabolismus kolísá.',    GREEN: 'Metabolismus v normě.' },
  dlouhovekost:{ RED: 'Tělo a zdraví brzdí.',    YELLOW: 'Potenciál čeká.',         GREEN: 'Na správné cestě.' },
};

const CHILDREN = {
  dlouhovekost: ['telo','zdravi','mysl','vyziva'],
  telo:         ['vo2max','sila','kardio','stabilita','rovnovaha','vytrvalost','mobilita','dychani'],
  zdravi:       ['imunitni','metabolicke','nervovy_system','obnova','spanek'],
  mysl:         ['emoce','klid','meditace','smysl','soustredeni','stres','vdecnost'],
  vyziva:       ['bilkoviny','casovani_jidel','glukoza_vyziva','hydratace','mikronutrienty','pust'],
};

const DISCIPLINE_PROTOCOLS = {
  sila: ['SILOVY_PROTOKOL','TRAINING_PROTOKOL'], kardio: ['KARDIO_PROTOKOL','VYTRVALOST_PROTOKOL'],
  stabilita: ['STABILITY_PROTOKOL','MOBILITY_PROTOKOL','BALANCE_PROTOKOL'], spanek: ['SLEEP_PROTOKOL'],
  vyziva: ['NUTRITION_PROTOKOL'], metabolismus: ['METABOL_PROTOKOL','PREVENTION_PROTOKOL'],
  kognitivni: ['NEURO_PROTOKOL','MEDITATION_PROTOKOL'], emocni: ['MEDITATION_PROTOKOL','STRESS_PROTOKOL'],
  prevence: ['PREVENTION_PROTOKOL'], smysl: ['MEDITATION_PROTOKOL'],
};

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

// Valid metric = not GRAY and has real data (index > 0).
// current_index === 0 means "no data yet" — treat as GRAY (same guard as universe-init.js canvas).
function validMetric(m) {
  return m && m.state !== 'GRAY' && m.current_index != null && m.current_index > 0;
}

function worstChild(nodeId, metricsMap) {
  const children = CHILDREN[nodeId] || [];
  const childMetrics = children.map(id => metricsMap.get(id)).filter(validMetric);
  if (!childMetrics.length) return null;
  return childMetrics.reduce((worst, m) =>
    (m.current_index ?? 50) < (worst.current_index ?? 50) ? m : worst
  );
}

// Two-level cascade matching canvas universe-init.js behaviour.
// For nodes whose direct children are intermediate aggregates (e.g. telo, zdravi),
// their stored current_index may be stale. We prefer the leaf-level nodes
// (grandchildren) which are written directly by onboarding/game-loop.
// Falls back to direct children when no grandchild data is available.
function worstLeaf(nodeId, metricsMap) {
  const directChildren = CHILDREN[nodeId] || [];
  const leaves = [];
  let hasGrandchildren = false;
  for (const childId of directChildren) {
    const grandchildren = CHILDREN[childId] || [];
    if (grandchildren.length > 0) {
      hasGrandchildren = true;
      leaves.push(...grandchildren);
    } else {
      leaves.push(childId);
    }
  }
  if (!hasGrandchildren) return worstChild(nodeId, metricsMap);
  const valid = leaves.map(id => metricsMap.get(id)).filter(validMetric);
  if (!valid.length) return worstChild(nodeId, metricsMap); // fallback
  return valid.reduce((worst, m) =>
    (m.current_index ?? 50) < (worst.current_index ?? 50) ? m : worst
  );
}

const DAY_ROTATION = ['STIMUL','PODPORA','STIMUL','PODPORA','STIMUL','PODPORA','REGENERACE'];
function getDayType() {
  return DAY_ROTATION[Math.floor(Date.now() / 86400000) % 7];
}

// ── Per-node data fetch (runs in parallel for all requested nodes) ──
async function fetchOneNode(sb, userId, nodeId, shared) {
  const { metricsMap, orchLogs, today, constraints, spanekIndex, vyzivaIndex, isDekatlon } = shared;
  const dayType = getDayType();

  const nodeMeta    = metricsMap.get(nodeId) || { current_index: 50, state: 'YELLOW' };
  const current_index = nodeMeta.current_index ?? 50;
  const state       = indexToState(current_index);
  const hasChildren = !!CHILDREN[nodeId]?.length;
  const worst       = hasChildren ? worstLeaf(nodeId, metricsMap) : null;
  const batteryPercent = worst ? (worst.current_index ?? 50) : current_index;
  const batteryState   = worst ? indexToState(worst.current_index ?? 50) : state;

  // Orchestrator decision for this node (from shared pre-fetch)
  const orchLog = orchLogs.find(r => r.node_id === nodeId);

  // Only use orchLog pillar for action selection if it belongs to this node's domain.
  // Otherwise the orchestrator might assign e.g. kognitivni to telo (wrong actions).
  const NODE_VALID_DISCIPLINES = {
    telo:         ['sila','kardio','stabilita'],
    zdravi:       ['prevence','metabolismus'],
    mysl:         ['kognitivni','emocni','smysl','spanek'],
    vyziva:       ['vyziva'],
    metabolicke:  ['metabolismus'],
    dlouhovekost: ['sila','kardio','stabilita','kognitivni','prevence','vyziva'],
  };
  const validForNode = NODE_VALID_DISCIPLINES[nodeId];
  const disciplineId = (orchLog?.pillar && (!validForNode || validForNode.includes(orchLog.pillar)))
    ? orchLog.pillar : null;
  const disciplineProtocols = disciplineId ? DISCIPLINE_PROTOCOLS[disciplineId] : null;

  // actionNodeId — for parent nodes, use first child as action target
  const actionNodeId = hasChildren ? (CHILDREN[nodeId][0]) : nodeId;

  // All per-node queries in parallel
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const [historyRes, missionRes, agentRes, streakRes] = await Promise.all([
    sb.from('node_state_history').select('current_index, date')
      .eq('user_id', userId).eq('node_id', nodeId).gte('date', since)
      .order('date', { ascending: true }),
    sb.from('mission_log').select('id, mission_id').eq('user_id', userId)
      .eq('node_id', actionNodeId).eq('date', today),
    sb.from('agent_log').select('action_id, label, type, duration_s, reps, sets, guide_search, guide_label')
      .eq('user_id', userId).eq('node_id', nodeId).eq('date', today)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('mission_log').select('date').eq('user_id', userId)
      .eq('node_id', actionNodeId).order('date', { ascending: false }).limit(30),
  ]);

  const trend      = calcTrend(historyRes.data);
  const todayCount = missionRes.data?.length ?? 0;

  // Streak
  let streak = 0;
  if (streakRes.data?.length > 0) {
    const dates = [...new Set(streakRes.data.map(r => r.date))].sort().reverse();
    let check = today;
    for (const d of dates) {
      if (d === check) { streak++; check = new Date(new Date(d).getTime() - 86400000).toISOString().slice(0, 10); }
      else break;
    }
  }

  // Action: agent cache first, then DB
  let action = null;
  if (agentRes.data?.action_id) {
    const a = agentRes.data;
    action = {
      id: a.action_id, label: a.label, icon: '🏋️',
      type: a.type === 'timed' ? 'timed' : 'habit',
      duration: a.duration_s ?? null, reps: a.reps ?? null,
      status: 'READY', tier: 1, node_id: actionNodeId,
      from_agent_cache: true,
      guide_search: a.guide_search ?? null,
      guide_label:  a.guide_label  ?? null,
    };
  }

  if (!action && todayCount < 2) {
    let q = sb.from('longevity_actions').select('*').eq('active', true);
    if (disciplineProtocols) q = q.in('protocol_type', disciplineProtocols);
    else q = q.eq('node_id', actionNodeId);
    if (dayType === 'REGENERACE') q = q.eq('type', 'habit');
    const { data: candidates } = await q.order('tier').limit(10);
    const doneIds = (missionRes.data || []).map(m => m.mission_id).filter(Boolean);
    const available = (candidates || []).filter(a =>
      !doneIds.includes(a.id) &&
      !a.constraint_exclude?.some(c => constraints.includes(c))
    );
    const picked = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : null;
    if (picked) {
      action = {
        id: picked.id, label: picked.label, icon: picked.icon || '🏋️',
        type: picked.type, duration: picked.duration, reps: picked.reps,
        status: 'READY', tier: picked.tier, node_id: actionNodeId,
      };
    }
  }

  // Sources (2 max)
  const { data: sourcesRaw } = await sb.from('longevity_sources')
    .select('id, title, url, type, summary, journal, year, med_id, script_cz')
    .eq('node_id', nodeId).eq('active', true).limit(4);
  const sources = (sourcesRaw || []).slice(0, 2).map((s, i) => ({
    med_id: s.med_id || s.id, type: s.type || 'article', title: s.title,
    journal: s.journal || null, year: s.year || null,
    status: i === 0 ? 'VERIFIED' : 'AUTHENTICATED',
    url: s.url, lang: s.script_cz ? 'cs' : 'en',
    script_cz: s.script_cz || null, summary: s.summary || null,
  }));

  const killer = NODE_KILLERS[nodeId] || NODE_KILLERS.telo;
  const verdictMap = VERDICT_TEXTS[nodeId] || VERDICT_TEXTS.telo;
  const deterministicVerdict = verdictMap[batteryState] || verdictMap.YELLOW;

  const nodeLabel = (nodeId === 'dlouhovekost' && isDekatlon)
    ? 'Stoletý desetibojař'
    : (NODE_LABELS[nodeId] || nodeId);

  return {
    node: { id: nodeId, label: nodeLabel, version: 'v0.2' },
    battery: {
      percent: batteryPercent, state: batteryState,
      trend_label: trend.label, trend_direction: trend.direction,
      spanek_index: spanekIndex, vyziva_index: vyzivaIndex,
    },
    killer, action,
    day_type: disciplineId || dayType,
    sources,
    verdict: orchLog?.verdict || deterministicVerdict,
    completion_feedback: orchLog?.completion_feedback || null,
    weekly_hint: orchLog?.weekly_hint || null,
    today_count: todayCount,
    all_done_today: todayCount >= 2,
    streak,
  };
}

// ── HANDLER ───────────────────────────────────────────
export default async function handler(req, res) {
  // Always return JSON — never let Vercel's HTML error page reach the client
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
  const { userId, nodes: nodesParam = 'telo,mysl,zdravi,vyziva', role } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const nodeIds = nodesParam.split(',').map(n => n.trim()).filter(Boolean).slice(0, 8);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[hud-data-bulk] Missing Supabase env vars');
    return res.status(500).json({ error: 'Server misconfiguration', details: 'Missing env vars' });
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  // ── Shared queries — run once for all nodes ──────────
  const [metricsRes, orchRes, constraintsRes, profileRes] = await Promise.all([
    sb.from('user_metrics').select('node_id, current_index, state')
      .eq('user_id', userId).eq('universe', 'longevity'),
    sb.from('orchestrator_log')
      .select('node_id, pillar, verdict, completion_feedback, weekly_hint')
      .eq('user_id', userId).eq('date', today).in('node_id', nodeIds),
    sb.from('user_constraints').select('constraint_key, constraint_value')
      .eq('user_id', userId).eq('constraint_type', 'injury'),
    sb.from('user_profiles').select('primary_goal')
      .eq('user_id', userId).maybeSingle(),
  ]);

  const isDekatlon = profileRes.data?.primary_goal === 'dekatlon' || role === 'dekatlon';

  const metricsMap = new Map((metricsRes.data || []).map(m => [m.node_id, m]));
  const orchLogs   = orchRes.data || [];
  const spanekIndex = metricsRes.data?.find(m => m.node_id === 'spanek')?.current_index ?? 50;
  const vyzivaIndex = metricsRes.data?.find(m => m.node_id === 'vyziva')?.current_index ?? 50;

  // Parse constraints
  const constraints = [];
  const CONSTRAINT_KEYWORDS = {
    knee: ['koleno','kolena','kolenní'], hip: ['kyčle','kyčel','kyčelní'],
    ankle_foot: ['nárt','kotník','chodidlo'], lower_back: ['záda','kříž','bederní'],
    elbow: ['loket','loketní'], shoulder: ['rameno','ramenní'],
  };
  for (const row of constraintsRes.data || []) {
    try {
      const val = JSON.parse(row.constraint_value);
      const loc = (val.location || '').toLowerCase();
      for (const [category, keywords] of Object.entries(CONSTRAINT_KEYWORDS)) {
        if (keywords.some(k => loc.includes(k)) && !constraints.includes(category))
          constraints.push(category);
      }
    } catch { /* ignore */ }
  }

  const shared = { metricsMap, orchLogs, today, constraints, spanekIndex, vyzivaIndex, isDekatlon };

  // ── Per-node in parallel ─────────────────────────────
  const results = await Promise.all(
    nodeIds.map(nodeId => fetchOneNode(sb, userId, nodeId, shared))
  );

  const response = {};
  nodeIds.forEach((nodeId, i) => { response[nodeId] = results[i]; });

  return res.json(response);

  } catch (err) {
    console.error('[hud-data-bulk] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal error', message: err.message, stack: err.stack });
  }
}
