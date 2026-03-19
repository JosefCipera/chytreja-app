// =====================================================
// SKILL ROUTER — maps node → skill, calls execute()
// =====================================================
// CHJ orchestrátor: dostane uzel, zjistí skill, zavolá ho.
//
// Přidání nového skillu:
//   1. Vytvoř soubor skills/nazev.js s execute() + SKILL_META
//   2. Importuj sem a přidej do SKILLS[]
//   3. Hotovo — router namapuje automaticky z SKILL_META.covers

import * as cviceni from './skills/cviceni.js';
import * as mindset from './skills/mindset.js';
import * as vyziva from './skills/vyziva.js';
import * as prevence from './skills/prevence.js';
import * as metabol from './skills/metabol.js';

// ── Registered skills ──────────────────────────────────
const SKILLS = [
  cviceni,
  mindset,
  vyziva,
  prevence,
  metabol,
];

// ── Auto-build NODE → SKILL map from SKILL_META.covers ─
const NODE_SKILL_MAP = {};
for (const skill of SKILLS) {
  if (skill.SKILL_META?.covers) {
    for (const nodeId of skill.SKILL_META.covers) {
      NODE_SKILL_MAP[nodeId] = skill;
    }
  }
}

/**
 * Get skill for a node (or null if no skill covers it).
 * @param {string} nodeId
 * @returns {{ execute: Function, SKILL_META: Object } | null}
 */
export function getSkillForNode(nodeId) {
  return NODE_SKILL_MAP[nodeId] || null;
}

/**
 * Execute skill for a node with full context.
 * @param {Object} ctx
 * @param {string} ctx.nodeId
 * @param {string} ctx.state     – RED/YELLOW/GREEN
 * @param {number} ctx.streak    – consecutive days
 * @param {string[]} ctx.constraints – ['koleno', 'zada_akutni', ...]
 * @returns {{ mission, motivation, level } | null}
 */
export function runSkill(ctx) {
  const skill = NODE_SKILL_MAP[ctx.nodeId];
  if (!skill) return null;
  return skill.execute(ctx);
}

/**
 * Check if a node has a skill assigned.
 */
export function hasSkill(nodeId) {
  return !!NODE_SKILL_MAP[nodeId];
}

/**
 * List all registered skills with metadata.
 */
export function listSkills() {
  return SKILLS.map(s => s.SKILL_META);
}
