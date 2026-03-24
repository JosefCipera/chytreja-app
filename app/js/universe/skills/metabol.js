// =====================================================
// SKILL: METABOLISMUS
// Pokrývá: metabolicke, glukoza, pust
// =====================================================

const EXERCISES = {
  // === CHŮZE PO JÍDLE ===
  chuze2:       { id: 'chuze_2',     label: 'Po jídle se projdi aspoň 2 minuty', icon: '🚶', area: 'metabolicke', avoid: [], tier: 1, type: 'timed' },
  chuze5:       { id: 'chuze_5',     label: 'Po jídle se projdi svižně 5 minut', icon: '🚶', area: 'metabolicke', avoid: [], tier: 2, type: 'timed' },

  // === CUKR / INZULÍN ===
  zadnyCukr:    { id: 'met_cukr',    label: 'Dnes nejez nic s přidaným cukrem', icon: '🚫', area: 'metabolicke', avoid: [], tier: 1, type: 'habit' },
  zeleninaFirst:{ id: 'zel_first',   label: 'Začni jídlo zeleninou, pak zbytek', icon: '🥗', area: 'glukoza', avoid: [], tier: 1, type: 'habit' },
  ocet:         { id: 'ocet',        label: 'Před jídlem vypij lžíci octa ve vodě', icon: '🍶', area: 'glukoza', avoid: [], tier: 2, type: 'habit' },

  // === PŮST ===
  okno12:       { id: 'okno_12',     label: 'Jez jen mezi 8:00 a 20:00', icon: '⏰', area: 'pust', avoid: [], tier: 1, type: 'habit' },
  okno10:       { id: 'okno_10',     label: 'Jez jen mezi 9:00 a 19:00', icon: '⏰', area: 'pust', avoid: [], tier: 2, type: 'habit' },
  ranniPust:    { id: 'ranni_pust',  label: 'Posuň snídani o hodinu později než obvykle', icon: '🌅', area: 'pust', avoid: [], tier: 1, type: 'habit' },

  // === POHYB PRO METABOLISMUS ===
  dreySaJidlem: { id: 'drep_jidlo',  label: 'Po jídle udělej dřepy', icon: '🦵', area: 'metabolicke', avoid: ['koleno'], tier: 2, type: 'count' },
  schody:       { id: 'met_schody',  label: 'Dnes vezmi schody místo výtahu', icon: '🪜', area: 'metabolicke', avoid: ['koleno'], tier: 1, type: 'habit' },

  // === MONITORING ===
  tepPoJidle:   { id: 'tep_jidlo',   label: 'Půl hodiny po jídle si změř tep', icon: '❤️', area: 'glukoza', avoid: [], tier: 2, type: 'habit' },
};

const BASE_VALUES = {
  chuze_2:     { sec: 120 },
  chuze_5:     { sec: 300 },
  met_cukr:    {},
  zel_first:   {},
  ocet:        {},
  okno_12:     {},
  okno_10:     {},
  ranni_pust:  {},
  drep_jidlo:  { count: 15 },
  met_schody:  {},
  tep_jidlo:   {},
};

const NODE_AREAS = {
  metabolicke: ['metabolicke', 'glukoza', 'pust'],
  glukoza:     ['glukoza', 'metabolicke'],
  pust:        ['pust'],
};

function getLevel(streak) {
  if (streak >= 14) return { maxTier: 3, multiplier: 1.5, name: 'metabolický mistr' };
  if (streak >= 7)  return { maxTier: 3, multiplier: 1.3, name: 'ostřílený' };
  if (streak >= 3)  return { maxTier: 2, multiplier: 1.0, name: 'nováček+' };
  return                    { maxTier: 1, multiplier: 1.0, name: 'začátečník' };
}

const MOTIVATIONS = {
  RED: [
    'Cukr v krvi se dá zkrotit. Začni dnes.',
    'Jeden krok pro metabolismus. Teď.',
    'Tělo volá po změně. Poslechni ho.',
    'Malá změna, velký dopad na inzulín.',
  ],
  YELLOW: [
    'Metabolismus drží. Posuň ho dál.',
    'Dobrý směr. Přidej konzistenci.',
    'Každý den bez cukru je výhra.',
    'Tělo se učí. Pomoz mu.',
  ],
  GREEN: [
    'Metabolismus v normě. Drž to.',
    'Stabilní hladiny. Nepolevuj.',
    'Funguje to. Pokračuj.',
    'Dobrá práce. Opakuj.',
  ],
};

export function execute(ctx) {
  const { nodeId, state = 'YELLOW', streak = 0, constraints = [], dayOffset = 0 } = ctx;
  const level = getLevel(streak);
  const areas = NODE_AREAS[nodeId] || ['metabolicke', 'glukoza'];

  const candidates = Object.values(EXERCISES).filter(ex => {
    if (!areas.includes(ex.area)) return false;
    if (ex.tier > level.maxTier) return false;
    if (constraints.some(c => ex.avoid.includes(c))) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const exercise = candidates[(dayOfYear + dayOffset) % candidates.length];

  const base = BASE_VALUES[exercise.id] || {};
  const mission = {
    id: `${exercise.id}_s${streak}`,
    label: exercise.label,
    icon: exercise.icon,
    action_type: exercise.type,
  };

  if (exercise.type === 'timed') {
    mission.duration_sec = Math.round((base.sec || 120) * level.multiplier);
  }
  if (exercise.type === 'count') {
    mission.target = Math.round((base.count || 10) * level.multiplier);
  }

  const arr = MOTIVATIONS[state] || MOTIVATIONS.YELLOW;
  return { mission, motivation: arr[dayOfYear % arr.length], level: { name: level.name, streak, tier: level.maxTier } };
}

export const SKILL_META = {
  id: 'metabol',
  name: 'Metabolismus',
  icon: '⚡',
  covers: ['metabolicke', 'glukoza', 'pust'],
};
