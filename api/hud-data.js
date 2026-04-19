// GET /api/hud-data?userId=xxx&nodeId=telo
// Returns complete HUD payload for a given node + user.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Actions now loaded from longevity_actions table in Supabase

// ── DISCIPLINE → PROTOCOL_TYPE MAPPING ───────────────
// Maps 10 Decathlon disciplines to longevity_actions.protocol_type values
const DISCIPLINE_PROTOCOLS = {
  sila:         ['SILOVY_PROTOKOL', 'TRAINING_PROTOKOL'],
  kardio:       ['KARDIO_PROTOKOL', 'VYTRVALOST_PROTOKOL'],
  stabilita:    ['STABILITY_PROTOKOL', 'MOBILITY_PROTOKOL', 'BALANCE_PROTOKOL'],
  spanek:       ['SLEEP_PROTOKOL'],
  vyziva:       ['NUTRITION_PROTOKOL'],
  metabolismus: ['METABOL_PROTOKOL', 'PREVENTION_PROTOKOL'],
  kognitivni:   ['NEURO_PROTOKOL', 'MEDITATION_PROTOKOL'],
  emocni:       ['MEDITATION_PROTOKOL', 'STRESS_PROTOKOL'],
  prevence:     ['PREVENTION_PROTOKOL'],
  smysl:        ['MEDITATION_PROTOKOL'],
};

// ── CONSTANTS ─────────────────────────────────────────

const CHILD_NODES     = ['telo', 'zdravi', 'mysl', 'vyziva'];
const DECATHLON_NODES = ['vo2max','sila','kardio','stabilita','rovnovaha','vytrvalost','mobilita','dychani'];

// Attia priority weights — tiebreaker when two nodes have equal index
const NODE_WEIGHTS = {
  telo: 0.50, zdravi: 0.25, mysl: 0.15, vyziva: 0.10,
  vo2max: 0.22, sila: 0.22, kardio: 0.15, stabilita: 0.12,
  rovnovaha: 0.10, vytrvalost: 0.10, mobilita: 0.06, dychani: 0.03,
};

// Node hierarchy — children of each parent (for cascade bottleneck + TOC battery)
const CHILDREN = {
  dlouhovekost: ['telo','zdravi','mysl','vyziva'],
  telo:         DECATHLON_NODES,
  zdravi:       ['imunitni','metabolicke','nervovy_system','obnova','spanek'],
  mysl:         ['emoce','klid','meditace','smysl','soustredeni','stres','vdecnost'],
  vyziva:       ['bilkoviny','casovani_jidel','glukoza_vyziva','hydratace','mikronutrienty','pust'],
  sila:         ['dead_hang','farmer_carry','grip','hip_hinge'],
  stabilita:    ['floor_get_up'],
};

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
  telo:         { label: 'SRDCE',        description: 'Každý rok bez pohybu ti bere roky života.' },
  mysl:         { label: 'MOZEK',        description: 'Mozek, který se nezatěžuje, odumírá.' },
  vyziva:       { label: 'METABOLISMUS', description: 'Špatná strava ničí tělo dřív než ho stačíš opravit.' },
  zdravi:       { label: 'IMUNITA',      description: 'Tělo bez obrany prohrává tiše a pomalu.' },
  metabolicke:  { label: 'METABOLISMUS', description: 'Metabolismus bez rytmu tě ničí zevnitř.' },
  sila:         { label: 'SRDCE',        description: 'Bez svalů srdce nemá co pohánět.' },
  stabilita:    { label: 'MOZEK',        description: 'První pád. Pak druhý. Pak konec pohybu.' },
  kardio:       { label: 'SRDCE',        description: 'Srdce bez zátěže odejde dřív než čekáš.' },
  vo2max:       { label: 'SRDCE',        description: 'Nízký VO₂max zkracuje život měřitelně.' },
  spanek:       { label: 'MOZEK',        description: 'Bez spánku mozek ničí sám sebe.' },
  dychani:      { label: 'MOZEK',        description: 'Plytké dýchání drží tělo ve stresu.' },
  rovnovaha:    { label: 'MOZEK',        description: 'První pád. Pak druhý. Pak konec pohybu.' },
  vytrvalost:   { label: 'SRDCE',        description: 'Bez výdrže srdce vzdá dřív než ty.' },
  dlouhovekost: { label: 'SRDCE',        description: 'Každý rok bez pohybu ti bere roky života.' },
};

const VERDICT_TEXTS = {
  telo:        { RED: 'Tělo ztrácí sílu.',           YELLOW: 'Tělo drží, ale sotva.',      GREEN: 'Tělo je v kondici.' },
  mysl:        { RED: 'Hlava zpomaluje.',             YELLOW: 'Hlava drží, přidej.',        GREEN: 'Hlava je v pohodě.' },
  vyziva:      { RED: 'Strava nestačí.',              YELLOW: 'Strava ujde, dá se líp.',    GREEN: 'Strava je v pořádku.' },
  zdravi:      { RED: 'Prevence chybí.',              YELLOW: 'Prevence má mezery.',         GREEN: 'Prevence funguje.' },
  metabolicke: { RED: 'Metabolismus klesá.',          YELLOW: 'Metabolismus kolísá.',        GREEN: 'Metabolismus v normě.' },
  dlouhovekost:{ RED: 'Tělo a zdraví brzdí.',         YELLOW: 'Potenciál čeká.',             GREEN: 'Na správné cestě.' },
};

// ── DAY TYPE — SPSPSPR 7-day rotation ─────────────────
// S=STIMUL, P=PODPORA, R=REGENERACE
// Internal only — not shown in HUD, implied by action character
// v0.4+: replace with real-time inputs (wearables, voice, check-in)

const DAY_ROTATION = ['STIMUL','PODPORA','STIMUL','PODPORA','STIMUL','PODPORA','REGENERACE'];

function getDayType() {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000);
  return DAY_ROTATION[daysSinceEpoch % 7];
}

// ── TIER SELECTION ─────────────────────────────────────

function pickTier(state, streak, dayType) {
  if (dayType === 'REGENERACE') return 1;
  if (dayType === 'PODPORA')    return 1;
  // STIMUL: push harder
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

// TOC: battery + color = worst child (system is as strong as its weakest link)
function worstChild(parentId, metricsMap) {
  const children = CHILDREN[parentId] || [];
  // Skip GRAY nodes (no real data) — keep parent's onboarding value instead
  const childMetrics = children.map(id => metricsMap.get(id)).filter(m => m && m.state !== 'GRAY');
  if (!childMetrics.length) return null;
  return childMetrics.reduce((worst, m) =>
    (m.current_index ?? 50) < (worst.current_index ?? 50) ? m : worst
  );
}

// Cascade bottleneck: go down hierarchy until leaf node with actions
function cascadeBottleneck(nodeId, metricsMap, depth = 0) {
  if (depth > 5) return nodeId;
  const children = CHILDREN[nodeId];
  if (!children?.length) return nodeId;
  const childMetrics = children.map(id => metricsMap.get(id)).filter(m => m && m.state !== 'GRAY');
  if (!childMetrics.length) return nodeId;
  const worst = childMetrics.reduce((a, b) => {
    const idxA = a.current_index ?? 50;
    const idxB = b.current_index ?? 50;
    if (idxA !== idxB) return idxA < idxB ? a : b;
    // Tiebreaker: higher Attia weight = higher priority (more impactful bottleneck)
    return (NODE_WEIGHTS[a.node_id] || 0.01) >= (NODE_WEIGHTS[b.node_id] || 0.01) ? a : b;
  });
  return cascadeBottleneck(worst.node_id, metricsMap, depth + 1);
}

// ── HANDLER ────────────────────────────────────────────

export default async function handler(req, res) {
  const { userId, nodeId = 'telo' } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // 1. Fetch ALL user metrics — needed for cascade bottleneck across full hierarchy
  let { data: metricsRaw } = await supabase
    .from('user_metrics')
    .select('node_id, current_index, state')
    .eq('user_id', userId)
    .eq('universe', 'longevity');

  if (!metricsRaw || metricsRaw.length === 0) {
    const { data: fallback } = await supabase
      .from('user_metrics')
      .select('node_id, current_index, state')
      .eq('user_id', userId);
    metricsRaw = fallback;
  }

  const metrics = metricsRaw || [];
  const metricsMap = new Map(metrics.map(m => [m.node_id, m]));

  // Find current node metric
  const nodeMeta = metricsMap.get(nodeId) || { current_index: 50, state: 'YELLOW' };
  const current_index = nodeMeta.current_index ?? 50;
  const state = indexToState(current_index);

  // TOC battery + color: worst child for any parent, own index for leaves
  const hasChildren = !!CHILDREN[nodeId]?.length;
  const worst = hasChildren ? worstChild(nodeId, metricsMap) : null;
  const batteryPercent = worst ? (worst.current_index ?? 50) : current_index;
  const batteryState   = worst ? indexToState(worst.current_index ?? 50) : state;

  // Cascade bottleneck: for any parent, go down to deepest weak leaf with actions
  const actionNodeId = hasChildren
    ? cascadeBottleneck(nodeId, metricsMap)
    : nodeId;

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

  // 3. Today's mission count (for actionNodeId — bottleneck child if parent)
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayMissions } = await supabase
    .from('mission_log')
    .select('id, mission_id')
    .eq('user_id', userId)
    .eq('node_id', actionNodeId)
    .eq('date', today);

  const todayCount = todayMissions?.length ?? 0;

  // 4. Streak
  const { data: streakRows } = await supabase
    .from('mission_log')
    .select('date')
    .eq('user_id', userId)
    .eq('node_id', actionNodeId)
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

  // 5. Constraints — parse JSON location → normalized category tags
  const { data: constraintRows } = await supabase
    .from('user_constraints')
    .select('constraint_key, constraint_value')
    .eq('user_id', userId)
    .eq('constraint_type', 'injury');

  const CONSTRAINT_KEYWORDS = {
    knee:       ['koleno', 'kolena', 'kolenní'],
    hip:        ['kyčle', 'kyčel', 'kyčelní'],
    ankle_foot: ['nárt', 'kotník', 'chodidlo'],
    lower_back: ['záda', 'kříž', 'bederní'],
    elbow:      ['loket', 'loketní'],
    shoulder:   ['rameno', 'ramenní'],
  };

  const constraints = [];
  for (const row of constraintRows || []) {
    try {
      const val = JSON.parse(row.constraint_value);
      const loc = (val.location || '').toLowerCase();
      for (const [category, keywords] of Object.entries(CONSTRAINT_KEYWORDS)) {
        if (keywords.some(k => loc.includes(k)) && !constraints.includes(category)) {
          constraints.push(category);
        }
      }
    } catch { /* ignore unparseable rows */ }
  }

  // 6a. Read today's orchestrator decision FIRST — needed for discipline-based action selection
  // pillar column stores discipline_id (sila, kardio, stabilita...)
  let orchestratorDecision = null;
  const { data: orchLog } = await supabase
    .from('orchestrator_log')
    .select('pillar, verdict, completion_feedback, weekly_hint')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orchLog?.verdict) {
    orchestratorDecision = orchLog;
  }

  const disciplineId = orchestratorDecision?.pillar;
  const disciplineProtocols = disciplineId ? DISCIPLINE_PROTOCOLS[disciplineId] : null;

  // 6. Action from longevity_actions DB
  const dayType = getDayType();
  let action = null;
  let actionTags = null; // used by step 7 for source matching
  if (todayCount < 2) {
    const tier = pickTier(state, streak, dayType);

    // REGENERACE: habit-only actions (dech, mobilita, light movement)
    // PODPORA: tier 1, any type
    // STIMUL: tier 2-3, any type (default)

    // Get already-done action IDs today to avoid repeats
    const doneIds = (todayMissions || []).map(m => m.mission_id).filter(Boolean);

    // Try preferred tier first — filter by discipline protocol_type if orchestrator decided
    let query = supabase
      .from('longevity_actions')
      .select('*')
      .eq('active', true)
      .eq('tier', tier);

    if (disciplineProtocols) {
      // Orchestrator decided discipline → filter by protocol_type across all nodes
      query = query.in('protocol_type', disciplineProtocols);
    } else {
      // No orchestrator decision → original node-based selection
      query = query.eq('node_id', actionNodeId);
    }
    if (dayType === 'REGENERACE') query = query.eq('type', 'habit');
    let { data: candidates } = await query;

    if (!candidates || candidates.length === 0) {
      let fbQuery = supabase
        .from('longevity_actions')
        .select('*')
        .eq('active', true)
        .order('tier')
        .limit(10);
      if (disciplineProtocols) {
        fbQuery = fbQuery.in('protocol_type', disciplineProtocols);
      } else {
        fbQuery = fbQuery.eq('node_id', actionNodeId);
      }
      if (dayType === 'REGENERACE') fbQuery = fbQuery.eq('type', 'habit');
      const { data: fallback } = await fbQuery;
      candidates = fallback || [];
    }

    // Last resort for REGENERACE: drop type filter if no habits found
    if (dayType === 'REGENERACE' && (!candidates || candidates.length === 0)) {
      const { data: anyFallback } = await supabase
        .from('longevity_actions')
        .select('*')
        .eq('node_id', actionNodeId)
        .eq('active', true)
        .eq('tier', 1)
        .limit(5);
      candidates = anyFallback || [];
    }

    // Exclude actions incompatible with user constraints
    const safe = candidates.filter(a =>
      !a.constraint_exclude?.some(c => constraints.includes(c))
    );
    const safeCandidates = safe.length > 0 ? safe : candidates; // fallback if all excluded

    // Exclude already done today — NO fallback to done actions (avoids repeat)
    const available = safeCandidates.filter(a => !doneIds.includes(a.id));
    const picked = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : null;

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
        node_id:       actionNodeId, // bottleneck node — used for mission logging
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

  // 8. Killer + verdict (deterministic fallback)
  const killer = NODE_KILLERS[nodeId] || NODE_KILLERS.telo;
  const verdictMap = VERDICT_TEXTS[nodeId] || VERDICT_TEXTS.telo;
  const deterministicVerdict = verdictMap[batteryState] || verdictMap.YELLOW;

  // 10. Build response
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
    day_type: disciplineId || dayType,
    sources,
    verdict: orchestratorDecision?.verdict || deterministicVerdict,
    completion_feedback: orchestratorDecision?.completion_feedback || null,
    weekly_hint: orchestratorDecision?.weekly_hint || null,
    today_count: todayCount,
    all_done_today: todayCount >= 2,
    streak,
  });
}
