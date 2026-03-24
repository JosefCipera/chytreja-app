// =====================================================
// SKILL: VÝŽIVA (Nutrition)
// Pokrývá: vyziva, protein, hydratace, mikronutrienty, casovani_jidel
// =====================================================

const EXERCISES = {
  // === SLEDOVÁNÍ STRAVY ===
  fotObeda:     { id: 'fot_obed',     label: 'Vyfoť si dnešní oběd',    icon: '📸', area: 'vyziva',    avoid: [], tier: 1, type: 'photo' },
  zapisJidla:   { id: 'zapis_jidla',  label: 'Zapiš si co jsi dnes snědl — 3 jídla', icon: '📝', area: 'vyziva', avoid: [], tier: 1, type: 'count' },
  zelenina:     { id: 'zelenina',     label: 'Ke každému jídlu přidej porci zeleniny', icon: '🥦', area: 'vyziva', avoid: [], tier: 2, type: 'count' },

  // === PROTEIN ===
  proteinSnid:  { id: 'protein_sn',   label: 'Dej si ke snídani vajíčka, tvaroh nebo jogurt', icon: '🥚', area: 'protein', avoid: [], tier: 1, type: 'habit' },
  protein30:    { id: 'protein_30',   label: 'Sněz 3 dávky bílkovin dnes (snídaně, oběd, večeře)', icon: '🍗', area: 'protein', avoid: [], tier: 2, type: 'count' },

  // === HYDRATACE ===
  voda1:        { id: 'voda_1',       label: 'Teď hned si dej sklenici vody', icon: '💧', area: 'hydratace', avoid: [], tier: 1, type: 'habit' },
  voda8:        { id: 'voda_8',       label: 'Vypij dnes aspoň 8 sklenic vody', icon: '💧', area: 'hydratace', avoid: [], tier: 2, type: 'count' },
  vodaRano:     { id: 'voda_rano',    label: 'Hned po probuzení vypij sklenici vody', icon: '🌅', area: 'hydratace', avoid: [], tier: 1, type: 'habit' },

  // === CUKR / ZPRACOVANÉ ===
  zadnyCukr:    { id: 'zadny_cukr',   label: 'Dnes nejez nic s přidaným cukrem', icon: '🚫', area: 'vyziva', avoid: [], tier: 1, type: 'habit' },
  bezUltra:     { id: 'bez_ultra',    label: 'Dnes nejez nic z krabice nebo sáčku', icon: '🏭', area: 'vyziva', avoid: [], tier: 2, type: 'habit' },

  // === ČASOVÁNÍ ===
  oknoJidla:    { id: 'okno_jidla',   label: 'Jez jen mezi 9:00 a 19:00',  icon: '⏰', area: 'casovani', avoid: [], tier: 2, type: 'habit' },
  poslednJidlo: { id: 'posl_jidlo',   label: 'Poslední jídlo aspoň 3 hodiny před spaním', icon: '🌙', area: 'casovani', avoid: [], tier: 1, type: 'habit' },
};

const BASE_VALUES = {
  fot_obed:     {},
  zapis_jidla:  { count: 3 },
  zelenina:     { count: 3 },
  protein_sn:   {},
  protein_30:   { count: 3 },
  voda_1:       {},
  voda_8:       { count: 8 },
  voda_rano:    {},
  zadny_cukr:   {},
  bez_ultra:    {},
  okno_jidla:   {},
  posl_jidlo:   {},
};

const NODE_AREAS = {
  vyziva:          ['vyziva', 'protein', 'hydratace'],
  protein:         ['protein'],
  hydratace:       ['hydratace'],
  mikronutrienty:  ['vyziva'],
  casovani_jidel:  ['casovani'],
};

function getLevel(streak) {
  if (streak >= 14) return { maxTier: 3, multiplier: 1.5, name: 'guru výživy' };
  if (streak >= 7)  return { maxTier: 3, multiplier: 1.3, name: 'ostřílený' };
  if (streak >= 3)  return { maxTier: 2, multiplier: 1.0, name: 'nováček+' };
  return                    { maxTier: 1, multiplier: 1.0, name: 'začátečník' };
}

const MOTIVATIONS = {
  RED: [
    'Jídlo je informace. Pošli tělu správnou zprávu.',
    'Jedna lepší volba. Dneska stačí jedna.',
    'Tělo se opravuje z toho, co mu dáš.',
    'Nekrmíš jen žaludek. Krmíš buňky.',
  ],
  YELLOW: [
    'Dobrý základ. Přidej detail.',
    'Strava drží. Posuň ji o kus.',
    'Víš co jíst. Teď to dodržuj.',
    'Konzistence je víc než dokonalost.',
  ],
  GREEN: [
    'Drž tuhle úroveň. Funguje.',
    'Strava v normě. Nepolevuj.',
    'Tělo dostává co potřebuje. Pokračuj.',
    'Dobré návyky se udržují opakováním.',
  ],
};

export function execute(ctx) {
  const { nodeId, state = 'YELLOW', streak = 0, constraints = [], dayOffset = 0 } = ctx;
  const level = getLevel(streak);
  const areas = NODE_AREAS[nodeId] || ['vyziva', 'protein', 'hydratace'];

  const candidates = Object.values(EXERCISES).filter(ex => {
    if (!areas.includes(ex.area)) return false;
    if (ex.tier > level.maxTier) return false;
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
    mission.duration_sec = Math.round((base.sec || 60) * level.multiplier);
  }
  if (exercise.type === 'count') {
    mission.target = Math.round((base.count || 3) * level.multiplier);
  }

  const arr = MOTIVATIONS[state] || MOTIVATIONS.YELLOW;
  return { mission, motivation: arr[dayOfYear % arr.length], level: { name: level.name, streak, tier: level.maxTier } };
}

export const SKILL_META = {
  id: 'vyziva',
  name: 'Výživa',
  icon: '🍎',
  covers: ['vyziva', 'protein', 'hydratace', 'mikronutrienty', 'casovani_jidel'],
};
