// =====================================================
// HUD.JS — Main screen overlay: show/hide HUD element
// =====================================================

// ── ELEMENTS ────────────────────────────────────────────
let els = {};

function getEls() {
  if (els._cached) return els;
  els = {
    hud: document.getElementById('chj-hud'),
    bioAge: document.getElementById('chj-bio-age'),
    streak: document.getElementById('chj-streak-badge'),
    killer: document.getElementById('chj-hud-killer'),
    subtitle: document.getElementById('chj-subtitle'),
    missionBox: document.getElementById('chj-hud-mission'),
    missionText: document.getElementById('chj-hud-mission-text'),
    _cached: true,
  };
  return els;
}

// ── HIDE/SHOW HUD ───────────────────────────────────────
export function hideHUD() {
  const e = getEls();
  if (e.hud) e.hud.style.display = 'none';
}

export function showHUD() {
  const e = getEls();
  if (e.hud) e.hud.style.display = 'flex';
}
