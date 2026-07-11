// === LONGEVITY-CHECKIN.JS ===
// Morning readiness check-in modal for the Longevity / Decathlon universe.
// Mirrors the pattern of lehkost-checkin.js but for user_readiness data.
// API: GET/POST /api/user?action=readiness

export async function showReadinessModal(userId, onComplete, force = false) {
  // Skip for demo user
  if (!userId || userId === 'demo-user-123') { onComplete?.(); return; }

  // Skip if already submitted today — unless force=true (manual trigger from menu)
  const today = new Date().toISOString().slice(0, 10);
  const lsKey = `lng_readiness_${userId}`;
  if (!force && localStorage.getItem(lsKey) === today) { onComplete?.(); return; }

  // Check server — skip when force=true (manual menu trigger should always show modal)
  if (!force) {
    try {
      const res  = await fetch(`/api/user?action=readiness&userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (json.exists) {
        localStorage.setItem(lsKey, today); // warm local cache
        onComplete?.();
        return;
      }
    } catch { /* network error — show modal anyway */ }
  }

  const modal = _buildModal();
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('lng-modal--visible'));

  modal.querySelector('#lng-submit').addEventListener('click', async () => {
    const data = _collectData(modal);
    if (!data) return;

    const btn = modal.querySelector('#lng-submit');
    btn.disabled = true;
    btn.textContent = 'Ukládám…';

    try {
      const res = await fetch('/api/user?action=readiness', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, ...data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chyba uložení');

      localStorage.setItem(lsKey, today);

      // Invalidate CRT cache on background — data changed, map should reflect it
      const uid = userId;
      fetch('/api/user?action=crt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, force: true }),
      }).catch(() => {});

      // Success flash then close
      const actionsEl = modal.querySelector('.lng-modal__actions');
      actionsEl.innerHTML = `
        <div class="lng-success">
          <span class="lng-success__icon">✓</span>
          <span class="lng-success__text">Check-in uložen · dobrý den</span>
        </div>
      `;
      setTimeout(() => { _closeModal(modal); onComplete?.(json); }, 1600);

    } catch (err) {
      console.error('[ReadinessCheckin] save error:', err);
      btn.disabled  = false;
      btn.textContent = 'Uložit';
    }
  });

  modal.querySelector('#lng-skip').addEventListener('click', () => {
    _closeModal(modal);
    onComplete?.();
  });
}

function _collectData(modal) {
  return {
    energie:    _intOrNull(modal.querySelector('#lng-energy').value),
    spanek_hod: _numOrNull(modal.querySelector('#lng-sleep').value),
    hrv:        _intOrNull(modal.querySelector('#lng-hrv').value) || null,
  };
}

function _numOrNull(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function _intOrNull(v)  { const n = parseInt(v);   return isNaN(n) ? null : n;  }

function _closeModal(modal) {
  modal.classList.remove('lng-modal--visible');
  setTimeout(() => modal.remove(), 300);
}

function _buildModal() {
  const el = document.createElement('div');
  el.className = 'lng-modal';
  el.innerHTML = `
    <div class="lng-modal__box">
      <div class="lng-modal__header">
        <span class="lng-modal__icon">🧬</span>
        <span class="lng-modal__title">MORNING_CHECK-IN</span>
        <span class="lng-modal__sub">Hra o život</span>
      </div>

      <div class="lng-modal__fields">

        <label class="lng-field">
          <span class="lng-field__label">Energie dnes</span>
          <div class="lng-scale" data-hidden="lng-energy">
            ${[1,2,3,4,5].map(n => `<button class="lng-scale__btn" data-val="${n}">${n}</button>`).join('')}
          </div>
          <input id="lng-energy" type="hidden">
          <div class="lng-energy-label" id="lng-energy-label"> </div>
        </label>

        <label class="lng-field">
          <span class="lng-field__label">Spánek včera</span>
          <div class="lng-scale" data-hidden="lng-sleep">
            <button class="lng-scale__btn lng-scale__btn--text" data-val="5">málo</button>
            <button class="lng-scale__btn lng-scale__btn--text" data-val="7">ok</button>
            <button class="lng-scale__btn lng-scale__btn--text" data-val="8">skvěle</button>
          </div>
          <input id="lng-sleep" type="hidden">
        </label>

        <label class="lng-field">
          <span class="lng-field__label">HRV <em>(ms · volitelně)</em></span>
          <input id="lng-hrv" type="number" min="0" max="200" step="1"
                 placeholder="—" class="lng-field__input lng-field__input--short">
        </label>

      </div>

      <div class="lng-modal__actions">
        <button id="lng-skip"   class="lng-btn lng-btn--ghost">Přeskočit</button>
        <button id="lng-submit" class="lng-btn lng-btn--primary">Uložit</button>
      </div>
    </div>
  `;

  // Scale button interaction
  const ENERGY_LABELS = ['', 'vyčerpaný', 'unavený', 'ujde to', 'dobrý', 'nabitý'];
  el.querySelectorAll('.lng-scale').forEach(scale => {
    const hiddenId = scale.dataset.hidden;
    const hidden   = el.querySelector(`#${hiddenId}`);
    scale.querySelectorAll('.lng-scale__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        scale.querySelectorAll('.lng-scale__btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (hidden) hidden.value = btn.dataset.val;
        if (hiddenId === 'lng-energy') {
          const lbl = el.querySelector('#lng-energy-label');
          if (lbl) lbl.textContent = ENERGY_LABELS[btn.dataset.val] || '';
        }
      });
    });
  });

  // Inject CSS once
  if (!document.getElementById('lng-checkin-style')) {
    const s = document.createElement('style');
    s.id = 'lng-checkin-style';
    s.textContent = `
      .lng-modal {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.25s;
      }
      .lng-modal--visible { opacity: 1; }
      .lng-modal__box {
        background: #0a1020; border: 1px solid rgba(6,182,212,0.25);
        border-radius: 16px; padding: 24px; width: 340px; max-width: 95vw;
        box-shadow: 0 0 40px rgba(6,182,212,0.12);
      }
      .lng-modal__header { text-align: center; margin-bottom: 20px; }
      .lng-modal__icon   { font-size: 28px; display: block; }
      .lng-modal__title  { font-family: monospace; color: #06b6d4; font-size: 12px;
                           letter-spacing: 2px; display: block; margin-top: 6px; }
      .lng-modal__sub    { color: #475569; font-size: 11px; display: block; margin-top: 2px; }

      .lng-field { display: block; margin-bottom: 16px; }
      .lng-field__label { font-size: 11px; color: #64748b; font-family: monospace;
                          letter-spacing: 1px; text-transform: uppercase; display: block;
                          margin-bottom: 8px; }
      .lng-field__label em { text-transform: none; font-style: normal; color: #334155; }
      .lng-field__input {
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; color: #e2e8f0; padding: 8px 12px; font-size: 14px;
      }
      .lng-field__input--short { width: 100px; }

      .lng-scale { display: flex; gap: 6px; flex-wrap: wrap; }
      .lng-scale__btn {
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px; color: #64748b; padding: 6px 12px; font-size: 13px;
        cursor: pointer; transition: all 0.15s; min-width: 36px;
      }
      .lng-scale__btn--text { min-width: 64px; }
      .lng-scale__btn:hover { border-color: #06b6d4; color: #22d3ee; }
      .lng-scale__btn.active {
        background: rgba(6,182,212,0.12); border-color: #06b6d4; color: #22d3ee;
      }
      .lng-energy-label {
        font-size: 12px; color: #06b6d4; font-family: monospace;
        min-height: 16px; margin-top: 4px; letter-spacing: 0.05em;
      }

      .lng-modal__actions { display: flex; gap: 10px; margin-top: 20px; }
      .lng-btn { flex: 1; padding: 10px; border-radius: 10px; font-size: 14px;
                 cursor: pointer; border: none; transition: all 0.15s; }
      .lng-btn--ghost   { background: transparent; border: 1px solid #1e293b; color: #475569; }
      .lng-btn--ghost:hover { border-color: #334155; color: #64748b; }
      .lng-btn--primary { background: rgba(6,182,212,0.12); border: 1px solid rgba(6,182,212,0.4);
                          color: #22d3ee; font-weight: 600; font-family: monospace; letter-spacing: 0.08em; }
      .lng-btn--primary:hover { background: rgba(6,182,212,0.2); }
      .lng-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .lng-success { display: flex; align-items: center; gap: 12px; width: 100%;
                     background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25);
                     border-radius: 10px; padding: 12px 16px; }
      .lng-success__icon { font-size: 20px; color: #22c55e; }
      .lng-success__text { color: #e2e8f0; font-size: 14px; }
    `;
    document.head.appendChild(s);
  }

  return el;
}
