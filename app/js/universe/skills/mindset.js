// =====================================================
// SKILL: MINDSET (Mysl)
// Pokrývá: mysl, meditace, soustredeni, emoce, vdecnost, stres
// =====================================================

const EXERCISES = {
  // === DÝCHÁNÍ / MEDITACE ===
  dychani2:     { id: 'dychani_2',    label: 'Dýchání 4-7-8',        icon: '🫁', area: 'dychani',    avoid: [], tier: 1, type: 'timed' },
  meditace3:    { id: 'meditace_3',   label: 'Tichá meditace',       icon: '🧘', area: 'meditace',   avoid: [], tier: 1, type: 'timed' },
  meditace5:    { id: 'meditace_5',   label: 'Řízená meditace',      icon: '🧘', area: 'meditace',   avoid: [], tier: 2, type: 'timed' },
  bodyScan:     { id: 'body_scan',    label: 'Body scan',            icon: '🔍', area: 'meditace',   avoid: [], tier: 2, type: 'timed' },

  // === FOCUS ===
  bezTelefonu:  { id: 'bez_tel',      label: 'Bez telefonu',         icon: '📵', area: 'soustredeni', avoid: [], tier: 1, type: 'timed' },
  deepWork:     { id: 'deep_work',    label: 'Deep work blok',       icon: '🎯', area: 'soustredeni', avoid: [], tier: 2, type: 'timed' },
  jednaVec:     { id: 'jedna_vec',    label: 'Jedna věc naplno',     icon: '🔬', area: 'soustredeni', avoid: [], tier: 1, type: 'habit' },

  // === EMOCE / VDĚČNOST ===
  vdecnost3:    { id: 'vdecnost_3',   label: 'Zapiš 3 věci za které jsi vděčný', icon: '🙏', area: 'vdecnost', avoid: [], tier: 1, type: 'count' },
  reflexe:      { id: 'reflexe',      label: 'Večerní reflexe dne',  icon: '📝', area: 'emoce',      avoid: [], tier: 1, type: 'habit' },
  nalada:       { id: 'nalada',       label: 'Zaznamenej svou náladu', icon: '🎭', area: 'emoce',     avoid: [], tier: 1, type: 'habit' },

  // === STRES ===
  coldExposure: { id: 'cold_face',    label: 'Studená voda na obličej', icon: '🧊', area: 'stres',   avoid: [], tier: 1, type: 'habit' },
  boxBreath:    { id: 'box_breath',   label: 'Box breathing 4×4',    icon: '📦', area: 'stres',      avoid: [], tier: 2, type: 'timed' },
  smich:        { id: 'smich',        label: 'Najdi něco k smíchu',  icon: '😄', area: 'stres',      avoid: [], tier: 1, type: 'habit' },
};

const BASE_VALUES = {
  dychani_2:    { sec: 120 },
  meditace_3:   { sec: 180 },
  meditace_5:   { sec: 300 },
  body_scan:    { sec: 300 },
  bez_tel:      { sec: 300 },
  deep_work:    { sec: 1500 },
  jedna_vec:    {},
  vdecnost_3:   { count: 3 },
  reflexe:      {},
  nalada:       {},
  cold_face:    {},
  box_breath:   { sec: 240 },
  smich:        {},
};

const NODE_AREAS = {
  mysl:         ['dychani', 'meditace', 'soustredeni', 'stres'],
  meditace:     ['meditace', 'dychani'],
  soustredeni:  ['soustredeni'],
  emoce:        ['emoce', 'vdecnost'],
  vdecnost:     ['vdecnost'],
  stres:        ['stres', 'dychani'],
};

function getLevel(streak) {
  if (streak >= 14) return { maxTier: 3, multiplier: 2.0, name: 'mistr klidu' };
  if (streak >= 7)  return { maxTier: 3, multiplier: 1.5, name: 'ostřílený' };
  if (streak >= 3)  return { maxTier: 2, multiplier: 1.3, name: 'nováček+' };
  return                    { maxTier: 1, multiplier: 1.0, name: 'začátečník' };
}

const MOTIVATIONS = {
  RED: [
    'Klid v hlavě začíná jedním nádechem.',
    'Dvě minuty ticha změní celý den.',
    'Hlava potřebuje pauzu. Teď.',
    'Zastav se. Jenom na chvíli.',
  ],
  YELLOW: [
    'Mysl se trénuje jako sval.',
    'Pokaždé o trochu hlubší klid.',
    'Dneska si dej víc prostoru.',
    'Soustředění je superschopnost.',
  ],
  GREEN: [
    'Udržuj ostrost. Každý den.',
    'Klid je síla. Nepouštěj ho.',
    'Čistá hlava = lepší rozhodnutí.',
    'Drž disciplínu i v dobrých dnech.',
  ],
};

export function execute(ctx) {
  const { nodeId, state = 'YELLOW', streak = 0, constraints = [] } = ctx;
  const level = getLevel(streak);
  const areas = NODE_AREAS[nodeId] || ['dychani', 'meditace'];

  const candidates = Object.values(EXERCISES).filter(ex => {
    if (!areas.includes(ex.area)) return false;
    if (ex.tier > level.maxTier) return false;
    if (constraints.some(c => ex.avoid.includes(c))) return false;
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
    mission.duration_sec = Math.round((base.sec || 120) * level.multiplier);
  }
  if (exercise.type === 'count') {
    mission.target = Math.round((base.count || 3) * level.multiplier);
  }

  const arr = MOTIVATIONS[state] || MOTIVATIONS.YELLOW;
  const motivation = arr[dayOfYear % arr.length];

  return { mission, motivation, level: { name: level.name, streak, tier: level.maxTier } };
}

export const SKILL_META = {
  id: 'mindset',
  name: 'Mindset',
  icon: '🧘',
  covers: ['mysl', 'meditace', 'soustredeni', 'emoce', 'vdecnost', 'stres'],
};
