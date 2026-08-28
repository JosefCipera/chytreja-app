// ── Lehkost Onboarding — 3-screen flow ───────────────────────────────────────
// Screen 1: Identita  — co chceš získat?
// Screen 2: Blocker   — co tě nejvíc brzdí?
// Screen 3: Směr      — trajektorie (číslo nebo kvalitativní cíl)
//
// Saves to: user_profiles (lh_identity, lh_blocker, lh_target_kg, lh_target_note)
// Trigger:  call showLehkostOnboarding(userId, onComplete) when lh_identity is null

import { authFetch } from './authFetch.js';

const IDENTITY_OPTIONS = [
  { id: 'energie',     label: 'Více energie',    icon: '⚡' },
  { id: 'zhubnout',   label: 'Zhubnout',        icon: '⚖️' },
  { id: 'kondice',    label: 'Lepší kondici',   icon: '🏃' },
  { id: 'jidlo',      label: 'Míň řešit jídlo', icon: '🍽️' },
  { id: 'spanek',     label: 'Lépe spát',       icon: '😴' },
  { id: 'pohoda',     label: 'Cítit se líp',    icon: '🌤️' },
];

const BLOCKER_OPTIONS = [
  { id: 'vecery',  label: 'Večery a jídlo po večeři', icon: '🌙' },
  { id: 'sladke',  label: 'Sladké a snacky',          icon: '🍬' },
  { id: 'vikendy', label: 'Víkendy bez kontroly',     icon: '📅' },
  { id: 'pohyb',   label: 'Nedostatek pohybu',        icon: '🚶' },
  { id: 'unava',   label: 'Únava a málo spánku',      icon: '😴' },
  { id: 'chaos',   label: 'Chaos a nepravidelnost',   icon: '🌀' },
];

let _userId = null;
let _onComplete = null;
let _answers = { identity: null, blocker: null, targetKg: null, targetNote: null };
let _currentScreen = 1;

// ── Public API ─────────────────────────────────────────────────────────────

export async function checkLehkostOnboarding(userId) {
  // Returns true if onboarding is needed (lh_identity not set)
  // Falls back to false on any error (API/DB not ready) — never blocks the user
  try {
    const res = await authFetch(`/api/user?action=profile&userId=${userId}`);
    if (!res.ok) return false; // migrace ještě neproběhla → pustit dál
    const data = await res.json();
    return !data?.lh_identity;
  } catch {
    return false;
  }
}

export function showLehkostOnboarding(userId, onComplete) {
  _userId = userId;
  _onComplete = onComplete;
  _answers = { identity: null, blocker: null, targetKg: null, targetNote: null };
  _currentScreen = 1;
  _render();
}

// ── Renderer ───────────────────────────────────────────────────────────────

function _render() {
  _removeExisting();
  const overlay = document.createElement('div');
  overlay.id = 'lh-onboarding-overlay';
  overlay.innerHTML = _overlayHTML();
  document.body.appendChild(overlay);
  _bindEvents(overlay);
}

function _removeExisting() {
  document.getElementById('lh-onboarding-overlay')?.remove();
}

function _overlayHTML() {
  const screens = {
    1: _screen1HTML(),
    2: _screen2HTML(),
    3: _screen3HTML(),
  };
  return `
<div style="
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(10, 15, 26, 0.96);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
">
  <div style="
    width: 100%; max-width: 420px;
    background: #0f172a;
    border: 1px solid rgba(6,182,212,0.2);
    border-radius: 20px;
    padding: 28px 24px 24px;
    box-shadow: 0 0 60px rgba(6,182,212,0.08);
  ">
    ${_progressHTML()}
    ${screens[_currentScreen]}
  </div>
</div>`;
}

function _progressHTML() {
  return `
<div style="display: flex; gap: 6px; margin-bottom: 28px;">
  ${[1,2,3].map(i => `
    <div style="
      flex: 1; height: 3px; border-radius: 2px;
      background: ${i <= _currentScreen ? 'rgba(6,182,212,0.8)' : 'rgba(255,255,255,0.08)'};
      transition: background 0.3s;
    "></div>
  `).join('')}
</div>`;
}

function _screen1HTML() {
  return `
<div>
  <div style="font-family: monospace; font-size: 11px; letter-spacing: 0.15em; color: #475569; margin-bottom: 8px;">
    INICIALIZACE SYSTÉMU · 1/3
  </div>
  <div style="font-size: 22px; font-weight: 500; color: #e2e8f0; margin-bottom: 6px; line-height: 1.3;">
    Co chceš získat?
  </div>
  <div style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
    Vyber jeden hlavní cíl. Řídí celý systém.
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
    ${IDENTITY_OPTIONS.map(o => `
      <button class="lh-card" data-screen="1" data-value="${o.id}" style="
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px; padding: 14px 12px;
        text-align: left; cursor: pointer;
        transition: all 0.15s;
        ${_answers.identity === o.id ? 'border-color: rgba(6,182,212,0.6); background: rgba(6,182,212,0.08);' : ''}
      ">
        <div style="font-size: 22px; margin-bottom: 6px;">${o.icon}</div>
        <div style="font-size: 13px; color: #cbd5e1; font-weight: 500; line-height: 1.3;">${o.label}</div>
      </button>
    `).join('')}
  </div>
  <button id="lh-next-1" style="
    width: 100%; margin-top: 20px; padding: 14px;
    background: ${_answers.identity ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)'};
    border: 1px solid ${_answers.identity ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.06)'};
    border-radius: 12px; color: ${_answers.identity ? '#67e8f9' : '#475569'};
    font-size: 14px; font-weight: 500; cursor: ${_answers.identity ? 'pointer' : 'default'};
    letter-spacing: 0.05em; transition: all 0.15s;
  ">POKRAČOVAT →</button>
</div>`;
}

function _screen2HTML() {
  return `
<div>
  <div style="font-family: monospace; font-size: 11px; letter-spacing: 0.15em; color: #475569; margin-bottom: 8px;">
    DETEKCE OMEZENÍ · 2/3
  </div>
  <div style="font-size: 22px; font-weight: 500; color: #e2e8f0; margin-bottom: 6px; line-height: 1.3;">
    Co tě nejvíc brzdí?
  </div>
  <div style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
    Systém se zaměří na tvůj největší blocker.
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
    ${BLOCKER_OPTIONS.map(o => `
      <button class="lh-card" data-screen="2" data-value="${o.id}" style="
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px; padding: 14px 12px;
        text-align: left; cursor: pointer;
        transition: all 0.15s;
        ${_answers.blocker === o.id ? 'border-color: rgba(6,182,212,0.6); background: rgba(6,182,212,0.08);' : ''}
      ">
        <div style="font-size: 22px; margin-bottom: 6px;">${o.icon}</div>
        <div style="font-size: 13px; color: #cbd5e1; font-weight: 500; line-height: 1.3;">${o.label}</div>
      </button>
    `).join('')}
  </div>
  <div style="display: flex; gap: 10px; margin-top: 20px;">
    <button id="lh-back-2" style="
      padding: 14px 20px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px; color: #475569;
      font-size: 14px; cursor: pointer;
    ">←</button>
    <button id="lh-next-2" style="
      flex: 1; padding: 14px;
      background: ${_answers.blocker ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)'};
      border: 1px solid ${_answers.blocker ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.06)'};
      border-radius: 12px; color: ${_answers.blocker ? '#67e8f9' : '#475569'};
      font-size: 14px; font-weight: 500; cursor: ${_answers.blocker ? 'pointer' : 'default'};
      letter-spacing: 0.05em; transition: all 0.15s;
    ">POKRAČOVAT →</button>
  </div>
</div>`;
}

function _screen3HTML() {
  return `
<div>
  <div style="font-family: monospace; font-size: 11px; letter-spacing: 0.15em; color: #475569; margin-bottom: 8px;">
    NASTAVENÍ TRAJEKTORIE · 3/3
  </div>
  <div style="font-size: 22px; font-weight: 500; color: #e2e8f0; margin-bottom: 6px; line-height: 1.3;">
    Jaký je tvůj směr?
  </div>
  <div style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
    Nemusíš znát přesné číslo. Směr stačí.
  </div>

  <div style="margin-bottom: 16px;">
    <label style="font-size: 12px; color: #64748b; letter-spacing: 0.08em; display: block; margin-bottom: 8px;">
      CÍLOVÁ VÁHA (volitelné)
    </label>
    <div style="display: flex; align-items: center; gap: 10px;">
      <input id="lh-target-kg" type="number" min="30" max="200" step="0.5"
        placeholder="např. 72"
        value="${_answers.targetKg || ''}"
        style="
          flex: 1; padding: 12px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: #e2e8f0;
          font-size: 16px; outline: none;
        "
      />
      <span style="color: #64748b; font-size: 14px;">kg</span>
    </div>
  </div>

  <div style="margin-bottom: 24px;">
    <label style="font-size: 12px; color: #64748b; letter-spacing: 0.08em; display: block; margin-bottom: 8px;">
      NEBO POPIŠ SVŮJ SMĚR
    </label>
    <textarea id="lh-target-note"
      placeholder="Např. cítit se lehčeji každý den"
      maxlength="120"
      style="
        width: 100%; padding: 12px 16px; box-sizing: border-box;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px; color: #e2e8f0;
        font-size: 14px; outline: none; resize: none;
        height: 72px; line-height: 1.5;
        font-family: system-ui, sans-serif;
      "
    >${_answers.targetNote || ''}</textarea>
  </div>

  <div style="display: flex; gap: 10px;">
    <button id="lh-back-3" style="
      padding: 14px 20px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px; color: #475569;
      font-size: 14px; cursor: pointer;
    ">←</button>
    <button id="lh-finish" style="
      flex: 1; padding: 14px;
      background: rgba(6,182,212,0.15);
      border: 1px solid rgba(6,182,212,0.4);
      border-radius: 12px; color: #67e8f9;
      font-size: 14px; font-weight: 500; cursor: pointer;
      letter-spacing: 0.05em;
    ">SPUSTIT SYSTÉM ▶</button>
  </div>
</div>`;
}

// ── Event binding ──────────────────────────────────────────────────────────

function _bindEvents(overlay) {
  // Card selection
  overlay.querySelectorAll('.lh-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      const value  = btn.dataset.value;
      if (screen === '1') _answers.identity = value;
      if (screen === '2') _answers.blocker  = value;
      _render();
    });
  });

  // Navigation
  overlay.querySelector('#lh-next-1')?.addEventListener('click', () => {
    if (!_answers.identity) return;
    _currentScreen = 2;
    _render();
  });
  overlay.querySelector('#lh-back-2')?.addEventListener('click', () => {
    _currentScreen = 1; _render();
  });
  overlay.querySelector('#lh-next-2')?.addEventListener('click', () => {
    if (!_answers.blocker) return;
    _currentScreen = 3;
    _render();
  });
  overlay.querySelector('#lh-back-3')?.addEventListener('click', () => {
    _currentScreen = 2; _render();
  });
  overlay.querySelector('#lh-finish')?.addEventListener('click', _finish);
}

async function _finish() {
  const kgInput   = document.getElementById('lh-target-kg');
  const noteInput = document.getElementById('lh-target-note');
  _answers.targetKg   = kgInput?.value   ? parseFloat(kgInput.value)   : null;
  _answers.targetNote = noteInput?.value?.trim() || null;

  // Show loading state
  const btn = document.getElementById('lh-finish');
  if (btn) { btn.textContent = 'Ukládám…'; btn.style.opacity = '0.6'; }

  try {
    const res = await authFetch(`/api/user?action=lehkost-onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:     _userId,
        identity:   _answers.identity,
        blocker:    _answers.blocker,
        targetKg:   _answers.targetKg,
        targetNote: _answers.targetNote,
      }),
    });
    if (!res.ok) throw new Error('save failed');
    _removeExisting();
    _onComplete?.(_answers);
  } catch (err) {
    console.error('[lh-onboarding] save error', err);
    if (btn) { btn.textContent = 'Chyba — zkus znovu'; btn.style.opacity = '1'; }
  }
}
