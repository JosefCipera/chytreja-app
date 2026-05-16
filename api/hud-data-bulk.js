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
  // ── Lehkost uzly — FLOW KILLERS ─────────────────────────────────────────────
  lh_main:       { label: 'MALÝ POHYB',         description: 'Každý den bez pohybu zpomaluje metabolismus.' },
  lh_vyziva:     { label: 'VEČERNÍ PŘEJÍDÁNÍ',  description: 'Jídlo po 20h zvyšuje tukovou zátěž.' },
  lh_pohyb:      { label: 'MALÝ POHYB',         description: 'Každý den bez pohybu zpomaluje metabolismus.' },
  lh_mysl:       { label: 'JEDENÍ ZE STRESU',    description: 'Stres zvyšuje kortizol a chuť na sladké.' },
  lh_regenerace: { label: 'SPÁNKOVÝ DEFICIT',   description: 'Bez spánku tělo neregeneruje a hromadí tuk.' },
  // ── TOC uzly — parent uzly (cascade z nejslabšího dítěte) ────────────────
  toc:          { label: 'OMEZENÍ', description: 'Každý systém má jedno místo, které brzdí vše ostatní.' },
  finance_toc:  { label: 'OMEZENÍ', description: 'Firma vydělává tolik, kolik dovolí její nejslabší článek.' },
  vyroba_toc:   { label: 'OMEZENÍ', description: 'Linka jede jen tak rychle jako její nejpomalejší pracoviště.' },
  ccpm:         { label: 'OMEZENÍ', description: 'Multitasking ničí projekty rychleji než technické problémy.' },
  strategie_toc:{ label: 'OMEZENÍ', description: 'Strategie bez identifikovaného omezení je jen seznam přání.' },
  marketing_toc:{ label: 'OMEZENÍ', description: 'Poptávka bez průtoku je jen slogan, který firma nezvládne.' },
  // ── TOC uzly — sub-uzly (specifický label, ne generické OMEZENÍ) ─────────
  // Výroba sub-uzly
  terminy_toc:  { label: 'TERMÍNY',        description: 'Nedodržení termínů = ztráta zákazníka i průtoku.' },
  kapacity_toc: { label: 'KAPACITY',       description: 'Přetížené kapacity blokují tok zakázek.' },
  material_toc: { label: 'MATERIÁL',       description: 'Chybějící materiál zastavuje výrobu.' },
  kvalita_toc:  { label: 'KVALITA',        description: 'Zmetky spotřebovávají kapacitu bez průtoku.' },
  opravy_toc:   { label: 'OPRAVY A ÚDRŽBA', description: 'Neplánované odstávky jsou nejdražší ztrátou průtoku.' },
  // Finance sub-uzly
  prutok_toc:   { label: 'HODNOCENÍ ZISKOVOSTI', description: 'Zakázka vypadá ziskově, ale blokuje omezení — čistá ztráta průtoku.' },
  zasoby_toc:   { label: 'ZÁSOBY',               description: 'Vázaný kapitál ve WIP a zásobách snižuje dostupné cash.' },
  naklady_toc:  { label: 'NÁKLADY',              description: 'Rostoucí OE bez růstu T = zhoršování zisku.' },
  cashflow_toc:  { label: 'CASH FLOW',   description: 'Špatný cash flow blokuje provoz i investice.' },
  investice_toc: { label: 'INVESTICE',   description: 'Investice bez ohledu na bottleneck — špatná návratnost.' },
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
  // Lehkost uzly
  lh_main:       { RED: 'Body flow klesá.',        YELLOW: 'Pokrok je blízko.',       GREEN: 'Jedete dobře.' },
  lh_vyziva:     { RED: 'Večerní jídlo brzdí.',    YELLOW: 'Výživa ujde, dá se líp.', GREEN: 'Výživa funguje.' },
  lh_pohyb:      { RED: 'Pohyb chybí.',            YELLOW: 'Pohyb drží, přidej.',     GREEN: 'Pohyb je v pořádku.' },
  lh_mysl:       { RED: 'Stres jí tě zevnitř.',    YELLOW: 'Mysl drží, ale sotva.',   GREEN: 'Hlava je v klidu.' },
  lh_regenerace: { RED: 'Spánek nestačí.',          YELLOW: 'Regenerace má mezery.',   GREEN: 'Regenerace funguje.' },
};

const CHILDREN = {
  dlouhovekost: ['telo','zdravi','mysl','vyziva'],
  telo:         ['vo2max','sila','kardio','stabilita','rovnovaha','vytrvalost','mobilita','plyometrie','dychani'],
  zdravi:       ['imunitni','metabolicke','nervovy_system','obnova','spanek'],
  mysl:         ['emoce','klid','meditace','smysl','soustredeni','stres','vdecnost'],
  vyziva:       ['bilkoviny','casovani_jidel','glukoza_vyziva','hydratace','mikronutrienty','pust'],
};

// TOC parent→children — cascade killer z nejslabšího dítěte
const TOC_CHILDREN = {
  toc:         ['vyroba_toc','finance_toc','ccpm','strategie_toc','marketing_toc'],
  vyroba_toc:  ['terminy_toc','kapacity_toc','material_toc','kvalita_toc','opravy_toc'],
  finance_toc: ['prutok_toc','zasoby_toc','naklady_toc','cashflow_toc','investice_toc'],
};

const DISCIPLINE_PROTOCOLS = {
  sila: ['SILOVY_PROTOKOL','TRAINING_PROTOKOL'], kardio: ['KARDIO_PROTOKOL','VYTRVALOST_PROTOKOL'],
  stabilita: ['STABILITY_PROTOKOL','MOBILITY_PROTOKOL','BALANCE_PROTOKOL'], spanek: ['SLEEP_PROTOKOL'],
  vyziva: ['NUTRITION_PROTOKOL'], metabolismus: ['METABOL_PROTOKOL','PREVENTION_PROTOKOL'],
  kognitivni: ['NEURO_PROTOKOL','MEDITATION_PROTOKOL'], emocni: ['MEDITATION_PROTOKOL','STRESS_PROTOKOL'],
  prevence: ['PREVENTION_PROTOKOL'], smysl: ['MEDITATION_PROTOKOL'],
};

const LH_KILLER_DEFS = {
  evening_overeating: { label: 'VEČERNÍ PŘEJÍDÁNÍ',    description: 'Jídlo po 20h zvyšuje tukovou zátěž.' },
  low_movement:       { label: 'MALÝ POHYB',            description: 'Každý den bez pohybu zpomaluje metabolismus.' },
  sleep_deficit:      { label: 'SPÁNKOVÝ DEFICIT',      description: 'Bez spánku tělo neregeneruje a hromadí tuk.' },
  stress_eating:      { label: 'JEDENÍ ZE STRESU',       description: 'Stres zvyšuje kortizol a chuť na sladké.' },
  weekend_rebound:    { label: 'VÍKENDOVÉ PŘEJÍDÁNÍ', description: 'Přejídání o víkendu maže to, co týden budoval.' },
};

// Fallback akce pro lh_ sub-uzly (nemají záznamy v longevity_actions)
const LH_NODE_ACTIONS = {
  lh_vyziva:     [
    { id: 'lhv_cutoff',    label: 'Dnes zakonči jídlo před 20:00',                type: 'habit',  duration: null, icon: '🍽️' },
    { id: 'lhv_protein',   label: 'Přidej bílkovinu ke každému jídlu dnes',       type: 'habit',  duration: null, icon: '🥚' },
    { id: 'lhv_water',     label: 'Vypij sklenici vody před každým jídlem',       type: 'habit',  duration: null, icon: '💧' },
  ],
  lh_pohyb:      [
    { id: 'lhp_walk10',    label: '10 minut chůze teď — vyjdi ven',              type: 'timed',  duration: 600,  icon: '🚶' },
    { id: 'lhp_stairs',    label: 'Dnes jen schody, žádný výtah',                type: 'habit',  duration: null, icon: '🪜' },
    { id: 'lhp_stand',     label: 'Každou hodinu vstát a 2 minuty se projít',    type: 'habit',  duration: null, icon: '🧍' },
  ],
  lh_mysl:       [
    { id: 'lhm_breath',    label: '5 minut klidného dýchání před jídlem',        type: 'timed',  duration: 300,  icon: '🌬️' },
    { id: 'lhm_pause',     label: 'Při stresu počkej 10 minut před jídlem',      type: 'habit',  duration: null, icon: '⏸️' },
    { id: 'lhm_journal',   label: 'Napiš 3 věci za které jsi dnes vděčný',       type: 'habit',  duration: null, icon: '📓' },
  ],
  lh_regenerace: [
    { id: 'lhr_sleep',     label: 'Dnes ulehni před 22:30',                      type: 'habit',  duration: null, icon: '😴' },
    { id: 'lhr_screen',    label: 'Vypni obrazovky hodinu před spaním',          type: 'habit',  duration: null, icon: '📵' },
    { id: 'lhr_temp',      label: 'Vyvětrej ložnici před spaním na 18 °C',       type: 'habit',  duration: null, icon: '🌡️' },
  ],
};

const LH_KILLER_ACTIONS = {
  evening_overeating: { id: 'lh_action_eating_cutoff',  label: 'Dnes zakonči jídlo před 20:00',              type: 'habit',  duration: null, icon: '🍽️' },
  low_movement:       { id: 'lh_action_walk_10',         label: '10 minut chůze teď — vyjdi ven',             type: 'timed',  duration: 600,  icon: '🚶' },
  sleep_deficit:      { id: 'lh_action_sleep_cutoff',    label: 'Dnes ulehni před 22:30',                     type: 'habit',  duration: null, icon: '😴' },
  stress_eating:      { id: 'lh_action_breath_premeal',  label: '5 minut klidného dýchání před dalším jídlem', type: 'timed',  duration: 300,  icon: '🌬️' },
  weekend_rebound:    { id: 'lh_action_snack_prep',      label: 'Připrav si zdravou svačinu před večeří',     type: 'habit',  duration: null, icon: '🥗' },
};

function detectFlowKiller(rows) {
  if (!rows.length) return { killerId: 'low_movement', ...LH_KILLER_DEFS.low_movement };
  const r7  = rows.slice(0, 7);
  const avgStress = (() => { const v = r7.map(r=>r.stress).filter(Boolean); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0; })();
  const scores = [
    { id: 'evening_overeating', score: Math.min(100, r7.filter(r=>r.binge).length*18 + (avgStress>=3?10:0)) },
    { id: 'low_movement',       score: Math.min(100, r7.filter(r=>r.movement_level==='low').length*15 + (avgStress<3?5:0)) },
    { id: 'sleep_deficit',      score: Math.min(100, r7.filter(r=>r.sleep_hours!=null&&parseFloat(r.sleep_hours)<6.5).length*14) },
    { id: 'stress_eating',      score: Math.min(100, r7.filter(r=>r.stress>=4).length*8 + r7.filter(r=>r.binge&&r.stress>=4).length*15) },
    { id: 'weekend_rebound',    score: Math.min(100, r7.filter(r=>{const d=new Date(r.date).getDay();return(d===0||d===6)&&r.binge}).length*35) },
  ];
  const top = scores.sort((a,b)=>b.score-a.score)[0];
  const killerId = top?.id || 'low_movement';
  return { killerId, ...(LH_KILLER_DEFS[killerId] || LH_KILLER_DEFS.low_movement) };
}

// ── Lehkost spark configs — per-node metric definition ──────────────────────
const LH_SPARK_CONFIGS = {
  lh_main: {
    unit: 'kg',
    range: null, // trend-based, no fixed range
    extract: r => r?.weight_kg != null ? parseFloat(r.weight_kg) : null,
    getValue(slots) {
      const vals = slots.map(r => r?.weight_kg != null ? parseFloat(r.weight_kg) : null).filter(v => v != null);
      return vals.length ? vals.at(-1).toFixed(1).replace('.', ',') : '—';
    },
    getStatus(slots) {
      const vals = slots.map(r => r?.weight_kg != null ? parseFloat(r.weight_kg) : null).filter(v => v != null);
      if (vals.length < 4) return { text: 'málo dat', color: '#64748b' };
      const half = Math.floor(vals.length / 2);
      const avg1 = vals.slice(0, half).reduce((a,b)=>a+b,0) / half;
      const avg2 = vals.slice(half).reduce((a,b)=>a+b,0) / (vals.length - half);
      if (avg2 < avg1 - 0.2) return { text: 'klesá', color: '#22c55e' };
      if (avg2 > avg1 + 0.2) return { text: 'roste', color: '#ef4444' };
      return { text: 'stabilní', color: '#64748b' };
    },
  },
  lh_pohyb: {
    unit: '%',
    range: 'Cíl: ≥ 70 %',
    extract: r => r?.movement_level ? (r.movement_level === 'high' ? 3 : r.movement_level === 'medium' ? 2 : 1) : null,
    getValue(slots) {
      const valid = slots.filter(r => r?.movement_level);
      if (!valid.length) return '—';
      const good = valid.filter(r => r.movement_level !== 'low').length;
      return String(Math.round((good / valid.length) * 100));
    },
    getStatus(slots) {
      const valid = slots.filter(r => r?.movement_level);
      if (!valid.length) return { text: '—', color: '#64748b' };
      const pct = Math.round(valid.filter(r => r.movement_level !== 'low').length / valid.length * 100);
      if (pct >= 70) return { text: 'v rozmezí', color: '#22c55e' };
      if (pct >= 50) return { text: 'těsně pod cílem', color: '#f59e0b' };
      return { text: 'mimo rozmezí', color: '#ef4444' };
    },
  },
  lh_vyziva: {
    unit: '%',
    range: 'Cíl: ≥ 80 %',
    extract: r => r?.binge != null ? (r.binge ? 0 : 1) : null,
    getValue(slots) {
      const valid = slots.filter(r => r?.binge != null);
      if (!valid.length) return '—';
      return String(Math.round(valid.filter(r => !r.binge).length / valid.length * 100));
    },
    getStatus(slots) {
      const valid = slots.filter(r => r?.binge != null);
      if (!valid.length) return { text: '—', color: '#64748b' };
      const pct = Math.round(valid.filter(r => !r.binge).length / valid.length * 100);
      if (pct >= 80) return { text: 'v rozmezí', color: '#22c55e' };
      if (pct >= 60) return { text: 'těsně pod cílem', color: '#f59e0b' };
      return { text: 'mimo rozmezí', color: '#ef4444' };
    },
  },
  lh_mysl: {
    unit: '',
    range: 'Cíl: stres ≤ 2',
    extract: r => r?.stress ?? null,
    getValue(slots) {
      const vals = slots.filter(r => r?.stress != null).map(r => r.stress);
      if (!vals.length) return '—';
      return (vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(1).replace('.', ',');
    },
    getStatus(slots) {
      const vals = slots.filter(r => r?.stress != null).map(r => r.stress);
      if (!vals.length) return { text: '—', color: '#64748b' };
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
      if (avg <= 2) return { text: 'v rozmezí', color: '#22c55e' };
      if (avg <= 3) return { text: 'těsně nad cílem', color: '#f59e0b' };
      return { text: 'mimo rozmezí', color: '#ef4444' };
    },
  },
  lh_regenerace: {
    unit: 'hod',
    range: 'Rozmezí: 7–9 hod',
    extract: r => r?.sleep_hours != null ? parseFloat(r.sleep_hours) : null,
    getValue(slots) {
      const vals = slots.filter(r => r?.sleep_hours != null).map(r => parseFloat(r.sleep_hours));
      if (!vals.length) return '—';
      return vals.at(-1).toFixed(1).replace('.', ',');
    },
    getStatus(slots) {
      const vals = slots.filter(r => r?.sleep_hours != null).map(r => parseFloat(r.sleep_hours));
      if (!vals.length) return { text: '—', color: '#64748b' };
      const last = vals.at(-1);
      if (last >= 7 && last <= 9) return { text: 'v rozmezí', color: '#22c55e' };
      if (last >= 6)              return { text: 'těsně pod cílem', color: '#f59e0b' };
      return { text: 'mimo rozmezí', color: '#ef4444' };
    },
  },
};

async function getLehkostSpark(nodeId, userId, sb) {
  const cfg = LH_SPARK_CONFIGS[nodeId];
  if (!cfg) return null;

  const since14 = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data: rows } = await sb.from('daily_checkin')
    .select('date, weight_kg, movement_level, binge, stress, sleep_hours')
    .eq('user_id', userId).eq('universe', 'lehkost')
    .gte('date', since14).order('date', { ascending: true });

  const byDate = {};
  (rows || []).forEach(r => { byDate[r.date] = r; });

  // 14-day slots, oldest first
  const slots = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    slots.push(byDate[d] || null);
  }

  // Raw values + forward-fill nulls
  const raw = slots.map(r => cfg.extract(r));
  let last = null;
  const filled = raw.map(v => { if (v != null) last = v; return v != null ? v : last; });

  const value   = cfg.getValue(slots);
  const status  = cfg.getStatus(slots);

  return {
    data:         filled,         // 14 numbers (or null if no data at all)
    value,                        // display string, e.g. "73,2"
    unit:         cfg.unit,
    range:        cfg.range,      // null for lh_main
    status_text:  status.text,
    status_color: status.color,
  };
}

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
    if (disciplineProtocols) {
      q = q.in('protocol_type', disciplineProtocols);
    } else if (hasChildren) {
      // Parent node: query the node itself + all its children
      // (first-child-only often has no actions in DB, e.g. vo2max for telo)
      const allNodeIds = [nodeId, ...(CHILDREN[nodeId] || [])];
      q = q.in('node_id', allNodeIds);
    } else {
      q = q.eq('node_id', actionNodeId);
    }
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

  // TOC cascade: parent zdědí killer z nejslabšího dítěte (má-li data)
  let killer = NODE_KILLERS[nodeId] || NODE_KILLERS.telo;

  // Lehkost sub-uzly: fallback akce pokud DB nemá nic
  if (!action && todayCount < 2 && LH_NODE_ACTIONS[nodeId]) {
    const pool = LH_NODE_ACTIONS[nodeId];
    const doneIds = (missionRes.data || []).map(m => m.mission_id).filter(Boolean);
    const available = pool.filter(a => !doneIds.includes(a.id));
    if (available.length > 0) {
      const picked = available[Math.floor(Math.random() * available.length)];
      action = { ...picked, status: 'READY', tier: 1, node_id: nodeId };
    }
  }

  // Lehkost main: dynamic FLOW KILLER + killer-derived action
  if (nodeId === 'lh_main') {
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const { data: lhCheckins } = await sb.from('daily_checkin')
      .select('date,binge,movement_level,sleep_hours,stress')
      .eq('user_id', userId).eq('universe', 'lehkost').gte('date', since7)
      .order('date', { ascending: false });
    killer = detectFlowKiller(lhCheckins || []);
    // Action derived from top FLOW KILLER (overrides DB lookup below)
    if (!action && todayCount < 2) {
      const killerAction = LH_KILLER_ACTIONS[killer.killerId] || LH_KILLER_ACTIONS.low_movement;
      action = { ...killerAction, status: 'READY', tier: 1, node_id: 'lh_main' };
    }
  }

  // Lehkost spark — 14-day metric trend replacing BODY FLOW battery
  const LH_IDS = ['lh_main','lh_pohyb','lh_vyziva','lh_mysl','lh_regenerace'];
  let spark = null;
  if (LH_IDS.includes(nodeId)) {
    spark = await getLehkostSpark(nodeId, userId, sb);
  }

  if (TOC_CHILDREN[nodeId]) {
    const tocKids = TOC_CHILDREN[nodeId].map(id => metricsMap.get(id)).filter(validMetric);
    if (tocKids.length) {
      const worstKid = tocKids.reduce((w, m) =>
        (m.current_index ?? 50) < (w.current_index ?? 50) ? m : w
      );
      killer = NODE_KILLERS[worstKid.node_id] || killer;
    }
  }
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
    spark,
  };
}

// ── HANDLER ───────────────────────────────────────────
export default async function handler(req, res) {
  // Always return JSON — never let Vercel's HTML error page reach the client
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
  const { userId, nodes: nodesParam = 'telo,mysl,zdravi,vyziva', role, universe: universeParam } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const nodeIds = nodesParam.split(',').map(n => n.trim()).filter(Boolean).slice(0, 8);
  const universe = universeParam || 'longevity';

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[hud-data-bulk] Missing Supabase env vars');
    return res.status(500).json({ error: 'Server misconfiguration', details: 'Missing env vars' });
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  // ── Shared queries — run once for all nodes ──────────
  const [metricsRes, orchRes, constraintsRes, profileRes] = await Promise.all([
    sb.from('user_metrics').select('node_id, current_index, state')
      .eq('user_id', userId).eq('universe', universe),
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
