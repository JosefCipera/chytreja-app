// =====================================================
// SKILL: CVIČENÍ (Exercise)
// Pokrývá: tělo, síla, stabilita, kardio, vo2max, mobilita
// =====================================================
// Vstup: { nodeId, state, streak, constraints[] }
// Výstup: { mission, motivation, level }

// ── EXERCISE LIBRARY ──────────────────────────────────
// Grouped by body area + difficulty tier (1=easy, 2=medium, 3=hard)
// Each exercise can have `avoid` tags — matched against user constraints.

const EXERCISES = {
  // === SÍLA (strength) ===
  drepy:       { id: 'drepy',       label: 'Udělej dřepy',       icon: '🦵', area: 'sila',      avoid: ['koleno'], tier: 1, type: 'count' },
  kliky:       { id: 'kliky',       label: 'Udělej kliky',       icon: '💪', area: 'sila',      avoid: ['rameno', 'zapesti'], tier: 2, type: 'count' },
  plank:       { id: 'plank',       label: 'Drž plank — nehýbej se',  icon: '💪', area: 'sila',  avoid: ['zada_akutni'], tier: 1, type: 'timed' },
  výpady:      { id: 'vypady',      label: 'Střídavé výpady vpřed',   icon: '🦵', area: 'sila',  avoid: ['koleno'], tier: 2, type: 'count' },
  mrtvyTah:    { id: 'mrtvy_tah',   label: 'Předklon a zpět s rovnými zády', icon: '🏋️', area: 'sila', avoid: ['zada_akutni'], tier: 3, type: 'count' },
  sedyNaZidli: { id: 'sedy_zidli',  label: 'Sedni si a vstaň ze židle', icon: '🪑', area: 'sila', avoid: [], tier: 1, type: 'count' },

  // === STABILITA (balance) ===
  stojNaJedne: { id: 'stoj_1noha', label: 'Stůj na jedné noze, druhou zvedni', icon: '🦩', area: 'stabilita', avoid: ['kotnik'], tier: 1, type: 'timed' },
  tandemStoj:  { id: 'tandem',     label: 'Postav patu těsně před špičku a drž rovnováhu', icon: '🦩', area: 'stabilita', avoid: [], tier: 2, type: 'timed' },
  dreySBalance:{ id: 'drep_bal',   label: 'Dřep dolů a vydrž dole',  icon: '🧘', area: 'stabilita', avoid: ['koleno'], tier: 2, type: 'timed' },

  // === KARDIO (cardio) ===
  rychlaChůze: { id: 'rychla_chuze', label: 'Vyjdi ven a jdi svižně', icon: '🚶', area: 'kardio', avoid: [], tier: 1, type: 'timed' },
  schody:      { id: 'schody',       label: 'Najdi schody a běž nahoru/dolů', icon: '🪜', area: 'kardio', avoid: ['koleno'], tier: 2, type: 'timed' },
  jumpingJack: { id: 'jumping',      label: 'Skákej s rozpažením a spažením', icon: '⭐', area: 'kardio', avoid: ['koleno', 'kotnik'], tier: 2, type: 'count' },
  burpees:     { id: 'burpees',      label: 'Dřep → plank → výskok', icon: '🔥', area: 'kardio', avoid: ['koleno', 'zada_akutni', 'rameno'], tier: 3, type: 'count' },

  // === VO2MAX (endurance) ===
  beh3min:     { id: 'beh_3',       label: 'Běž na místě, zvedej kolena', icon: '🏃', area: 'vo2max', avoid: ['koleno', 'kotnik'], tier: 1, type: 'timed' },
  intervaly:   { id: 'intervaly',   label: 'Sprint 30s → odpočinek 30s, opakuj', icon: '⏱️', area: 'vo2max', avoid: ['koleno'], tier: 3, type: 'timed' },

  // === MOBILITA (mobility) ===
  protazeniZad:{ id: 'protaz_zada', label: 'Lehni si a protáhni záda do oblouku', icon: '🧘', area: 'mobilita', avoid: [], tier: 1, type: 'timed' },
  kycelRotace: { id: 'kycel_rot',   label: 'Kruhy kyčlemi — pomalu na obě strany', icon: '🔄', area: 'mobilita', avoid: [], tier: 1, type: 'timed' },
  hrudnikOpen: { id: 'hrudnik',     label: 'Rozpaž ruce a otevři hrudník dozadu', icon: '🫁', area: 'mobilita', avoid: [], tier: 1, type: 'timed' },
};

// ── DIFFICULTY SCALING ─────────────────────────────────
// Streak drives reps/duration up, tier unlocks harder exercises
//
//  streak 0–2   → tier 1 only,  base reps
//  streak 3–6   → tier 1+2,     +50% reps
//  streak 7–13  → tier 1+2+3,   +100% reps
//  streak 14+   → all tiers,    +150% reps

function getLevel(streak) {
  if (streak >= 14) return { maxTier: 3, multiplier: 2.5, name: 'veterán' };
  if (streak >= 7)  return { maxTier: 3, multiplier: 2.0, name: 'bojovník' };
  if (streak >= 3)  return { maxTier: 2, multiplier: 1.5, name: 'nováček+' };
  return                    { maxTier: 1, multiplier: 1.0, name: 'začátečník' };
}

// Base values per exercise (at multiplier 1.0)
const BASE_VALUES = {
  drepy:        { count: 10 },
  kliky:        { count: 8  },
  plank:        { sec: 30   },
  vypady:       { count: 10 },
  mrtvy_tah:    { count: 8  },
  sedy_zidli:   { count: 12 },
  stoj_1noha:   { sec: 30   },
  tandem:       { sec: 45   },
  drep_bal:     { sec: 20   },
  rychla_chuze: { sec: 300  },
  schody:       { sec: 180  },
  jumping:      { count: 20 },
  burpees:      { count: 5  },
  beh_3:        { sec: 180  },
  intervaly:    { sec: 300  },
  protaz_zada:  { sec: 120  },
  kycel_rot:    { sec: 60   },
  hrudnik:      { sec: 60   },
};

// ── NODE → preferred exercise areas ────────────────────
const NODE_AREAS = {
  telo:      ['sila', 'kardio'],
  sila:      ['sila'],
  stabilita: ['stabilita'],
  kardio:    ['kardio'],
  vo2max:    ['vo2max', 'kardio'],
  mobilita:  ['mobilita'],
};

// ── MOTIVATION TEMPLATES ───────────────────────────────
const MOTIVATIONS = {
  RED: [
    'Každý pohyb se počítá. Začni teď.',
    'Stačí tohle. Nic složitého.',
    'Malý krok. Ale tvůj.',
    'Tohle zvládneš. Jdi do toho.',
  ],
  YELLOW: [
    'Drž tempo. Nezastavuj.',
    'Jsi na cestě. Pokračuj.',
    'Tohle tě posune dál.',
    'Dneska o kus líp než včera.',
  ],
  GREEN: [
    'Udržuj, co máš. Nepouštěj.',
    'Síla se drží pohybem.',
    'Dobrá forma se nezíská. Udržuje se.',
    'Jedeš. Nepolevuj.',
  ],
};

function pickMotivation(state, dayOfYear) {
  const arr = MOTIVATIONS[state] || MOTIVATIONS.YELLOW;
  return arr[dayOfYear % arr.length];
}

// ── MAIN SKILL FUNCTION ────────────────────────────────
/**
 * @param {Object} ctx
 * @param {string} ctx.nodeId   – e.g. 'telo', 'sila', 'kardio'
 * @param {string} ctx.state    – 'RED' | 'YELLOW' | 'GREEN'
 * @param {number} ctx.streak   – consecutive days
 * @param {string[]} ctx.constraints – e.g. ['koleno', 'zada_akutni']
 * @returns {{ mission: Object, motivation: string, level: Object } | null}
 */
export function execute(ctx) {
  const { nodeId, state = 'YELLOW', streak = 0, constraints = [], dayOffset = 0 } = ctx;

  const level = getLevel(streak);
  const areas = NODE_AREAS[nodeId] || ['sila'];

  // Filter exercises: right area, right tier, no constraint conflicts
  const candidates = Object.values(EXERCISES).filter(ex => {
    if (!areas.includes(ex.area)) return false;
    if (ex.tier > level.maxTier) return false;
    if (constraints.some(c => ex.avoid.includes(c))) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Pick exercise based on day rotation (+offset for 2nd action)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const exercise = candidates[(dayOfYear + dayOffset) % candidates.length];

  // Calculate target values
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
    mission.target = Math.round((base.count || 10) * level.multiplier);
  }

  const motivation = pickMotivation(state, dayOfYear);

  return {
    mission,
    motivation,
    level: { name: level.name, streak, tier: level.maxTier },
  };
}

// Metadata for skill router
export const SKILL_META = {
  id: 'cviceni',
  name: 'Cvičení',
  icon: '🏋️',
  covers: ['telo', 'sila', 'stabilita', 'kardio', 'vo2max', 'mobilita'],
};
