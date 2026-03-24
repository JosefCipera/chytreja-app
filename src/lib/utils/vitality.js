/**
 * Attia's longevity weights — single source of truth
 * Metabolismus is child of Zdraví, not counted here
 */
export const ATTIA_WEIGHTS = {
  telo:    0.50,
  zdravi:  0.25,
  mysl:    0.15,
  vyziva:  0.10,
};

/**
 * Calculate weighted vitality for parent node (Hra o život)
 * @param {Object} children — { telo: 27, zdravi: 35, mysl: 90, vyziva: 90 }
 * @returns {number} 0-100
 */
export function calcVitality(children) {
  let total = 0;
  let weightSum = 0;
  for (const [id, weight] of Object.entries(ATTIA_WEIGHTS)) {
    const idx = children[id];
    if (idx != null) {
      total += idx * weight;
      weightSum += weight;
    }
  }
  if (weightSum === 0) return 0;
  // Normalize in case some nodes missing
  return Math.round(total / weightSum);
}

/**
 * Derive state from index — single source of truth
 */
export function indexToState(index) {
  if (index <= 40) return 'RED';
  if (index <= 70) return 'YELLOW';
  return 'GREEN';
}

/**
 * Worst child state for parent node coloring
 * @param {string[]} states — ['RED', 'GREEN', 'YELLOW']
 */
export function worstState(states) {
  if (states.includes('RED'))    return 'RED';
  if (states.includes('YELLOW')) return 'YELLOW';
  return 'GREEN';
}
