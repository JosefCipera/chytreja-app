// =====================================================
// SKILL: PREVENCE (Zdraví)
// Pokrývá: zdravi, imunitni, obnova, biomarkery
// =====================================================

const EXERCISES = {
  // === POHYB / IMUNITA ===
  prochazka10:  { id: 'proch_10',    label: 'Vyjdi ven a projdi se aspoň 10 minut', icon: '🚶', area: 'imunitni', avoid: [], tier: 1, type: 'timed' },
  prochazka20:  { id: 'proch_20',    label: 'Vyjdi ven a jdi svižně 20 minut', icon: '🚶', area: 'imunitni', avoid: [], tier: 2, type: 'timed' },
  slunce:       { id: 'slunce',      label: 'Hned ráno jdi ven na denní světlo', icon: '☀️', area: 'imunitni', avoid: [], tier: 1, type: 'timed' },

  // === STUDENÁ EXPOZICE ===
  studenaSprcha:{ id: 'cold_30',     label: 'Na konci sprchy otoč na studenou a vydrž', icon: '🚿', area: 'imunitni', avoid: [], tier: 1, type: 'timed' },
  studenaSprcha2:{ id: 'cold_60',    label: 'Celou minutu pod studenou sprchou', icon: '🚿', area: 'imunitni', avoid: [], tier: 2, type: 'timed' },

  // === REGENERACE ===
  spanekCas:    { id: 'spanek_cas',  label: 'Dnes si lehni před 23:00', icon: '🛏️', area: 'obnova',   avoid: [], tier: 1, type: 'habit' },
  zadneModre:   { id: 'no_blue',     label: 'Hodinu před spaním odlož telefon a vypni TV', icon: '📵', area: 'obnova', avoid: [], tier: 1, type: 'habit' },
  power_nap:    { id: 'power_nap',   label: 'Dej si 20 minut spánku přes den', icon: '😴', area: 'obnova', avoid: [], tier: 2, type: 'timed' },

  // === PREVENCE ===
  kontrolaTepu: { id: 'tep_check',   label: 'Sedni si, zklidni se a změř si tep', icon: '❤️', area: 'biomarkery', avoid: [], tier: 1, type: 'habit' },
  teplotaRano:  { id: 'teplota',     label: 'Hned po probuzení si změř teplotu', icon: '🌡️', area: 'biomarkery', avoid: [], tier: 2, type: 'habit' },
  hygienaDychani:{ id: 'hyg_dych',   label: 'Celý den dýchej jen nosem, ne ústy', icon: '👃', area: 'imunitni', avoid: [], tier: 2, type: 'habit' },
};

const BASE_VALUES = {
  proch_10:   { sec: 600 },
  proch_20:   { sec: 1200 },
  slunce:     { sec: 600 },
  cold_30:    { sec: 30 },
  cold_60:    { sec: 60 },
  spanek_cas: {},
  no_blue:    {},
  power_nap:  { sec: 1200 },
  tep_check:  {},
  teplota:    {},
  hyg_dych:   {},
};

const NODE_AREAS = {
  zdravi:     ['imunitni', 'obnova', 'biomarkery'],
  imunitni:   ['imunitni'],
  obnova:     ['obnova'],
  biomarkery: ['biomarkery'],
};

function getLevel(streak) {
  if (streak >= 14) return { maxTier: 3, multiplier: 1.5, name: 'strážce zdraví' };
  if (streak >= 7)  return { maxTier: 3, multiplier: 1.3, name: 'ostřílený' };
  if (streak >= 3)  return { maxTier: 2, multiplier: 1.0, name: 'nováček+' };
  return                    { maxTier: 1, multiplier: 1.0, name: 'začátečník' };
}

const MOTIVATIONS = {
  RED: [
    'Prevence začíná dnes. Ne zítra.',
    'Malý krok pro obranu těla.',
    'Imunita se buduje každý den.',
    'Tělo potřebuje pozornost. Teď.',
  ],
  YELLOW: [
    'Obrana drží. Posiluj ji.',
    'Každý dobrý návyk je štít.',
    'Pokračuj. Tělo to ocení.',
    'Pravidelnost je nejlepší lék.',
  ],
  GREEN: [
    'Obrana funguje. Nepolevuj.',
    'Dobrá forma vyžaduje údržbu.',
    'Prevence je investice. Drž ji.',
    'Zdraví se neudržuje samo.',
  ],
};

export function execute(ctx) {
  const { nodeId, state = 'YELLOW', streak = 0, constraints = [] } = ctx;
  const level = getLevel(streak);
  const areas = NODE_AREAS[nodeId] || ['imunitni', 'obnova'];

  const candidates = Object.values(EXERCISES).filter(ex => {
    if (!areas.includes(ex.area)) return false;
    if (ex.tier > level.maxTier) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const exercise = candidates[dayOfYear % candidates.length];

  const base = BASE_VALUES[exercise.id] || {};
  const mission = {
    id: `${exercise.id}_s${streak}`,
    label: exercise.label,
    icon: exercise.icon,
    action_type: exercise.type,
  };

  if (exercise.type === 'timed') {
    mission.duration_sec = Math.round((base.sec || 60) * level.multiplier);
  }
  if (exercise.type === 'count') {
    mission.target = Math.round((base.count || 3) * level.multiplier);
  }

  const arr = MOTIVATIONS[state] || MOTIVATIONS.YELLOW;
  return { mission, motivation: arr[dayOfYear % arr.length], level: { name: level.name, streak, tier: level.maxTier } };
}

export const SKILL_META = {
  id: 'prevence',
  name: 'Prevence',
  icon: '🛡️',
  covers: ['zdravi', 'imunitni', 'obnova', 'biomarkery'],
};
