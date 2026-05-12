// === LEHKOST-CHECKIN.JS ===
// Ranní check-in modal pro vesmír "Hra o lehkost"
// ~15 sekund, 6 vstupů, uloží do /api/lehkost?action=checkin

export function showCheckinModal(userId, onComplete) {
  // Nezobrazuj pokud dnes už proběhl
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('lh_checkin_date') === today) {
    onComplete?.();
    return;
  }

  const modal = _buildModal();
  document.body.appendChild(modal);

  // Animace
  requestAnimationFrame(() => modal.classList.add('lh-modal--visible'));

  modal.querySelector('#lh-submit').addEventListener('click', async () => {
    const data = _collectData(modal);
    if (!data) return;

    const btn = modal.querySelector('#lh-submit');
    btn.disabled = true;
    btn.textContent = 'Ukládám…';

    try {
      const res = await fetch('/api/user?action=checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chyba');

      localStorage.setItem('lh_checkin_date', today);

      // Ulož BODY FLOW do window pro HUD
      if (json.body_flow) window.LH_BODY_FLOW = json.body_flow;

      _closeModal(modal);
      onComplete?.(json.body_flow);
    } catch (err) {
      console.error('Checkin error:', err);
      btn.disabled = false;
      btn.textContent = 'Uložit';
    }
  });

  modal.querySelector('#lh-skip').addEventListener('click', () => {
    _closeModal(modal);
    onComplete?.();
  });
}

function _collectData(modal) {
  return {
    weight_kg:      _numOrNull(modal.querySelector('#lh-weight').value),
    energy:         _intOrNull(modal.querySelector('#lh-energy').value),
    sleep_hours:    _numOrNull(modal.querySelector('#lh-sleep').value),
    binge:          modal.querySelector('#lh-binge').value === 'yes' ? true
                  : modal.querySelector('#lh-binge').value === 'no'  ? false
                  : null,
    movement_level: modal.querySelector('#lh-movement').value || null,
    stress:         _intOrNull(modal.querySelector('#lh-stress').value),
  };
}

function _numOrNull(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function _intOrNull(v)  { const n = parseInt(v);   return isNaN(n) ? null : n; }

function _closeModal(modal) {
  modal.classList.remove('lh-modal--visible');
  setTimeout(() => modal.remove(), 300);
}

function _buildModal() {
  const el = document.createElement('div');
  el.className = 'lh-modal';
  el.innerHTML = `
    <div class="lh-modal__box">
      <div class="lh-modal__header">
        <span class="lh-modal__icon">⚡</span>
        <span class="lh-modal__title">RANNÍ CHECK-IN</span>
        <span class="lh-modal__sub">Hra o lehkost · 15 sekund</span>
      </div>

      <div class="lh-modal__fields">

        <label class="lh-field">
          <span class="lh-field__label">Váha <em>(volitelně)</em></span>
          <input id="lh-weight" type="number" step="0.1" min="40" max="200"
                 placeholder="kg" class="lh-field__input lh-field__input--short">
        </label>

        <label class="lh-field">
          <span class="lh-field__label">Energie dnes</span>
          <div class="lh-scale" data-field="lh-energy">
            ${[1,2,3,4,5].map(n => `<button class="lh-scale__btn" data-val="${n}">${n}</button>`).join('')}
          </div>
          <input id="lh-energy" type="hidden">
        </label>

        <label class="lh-field">
          <span class="lh-field__label">Spánek včera</span>
          <div class="lh-scale" data-field="lh-sleep-q">
            <button class="lh-scale__btn lh-scale__btn--text" data-val="5.5">málo</button>
            <button class="lh-scale__btn lh-scale__btn--text" data-val="7">ok</button>
            <button class="lh-scale__btn lh-scale__btn--text" data-val="8">skvěle</button>
          </div>
          <input id="lh-sleep" type="hidden">
        </label>

        <label class="lh-field">
          <span class="lh-field__label">Přejedl ses včera večer?</span>
          <div class="lh-scale" data-field="lh-binge">
            <button class="lh-scale__btn lh-scale__btn--text" data-val="no">Ne</button>
            <button class="lh-scale__btn lh-scale__btn--text" data-val="yes">Ano</button>
          </div>
          <input id="lh-binge" type="hidden">
        </label>

        <label class="lh-field">
          <span class="lh-field__label">Pohyb včera</span>
          <div class="lh-scale" data-field="lh-movement">
            <button class="lh-scale__btn lh-scale__btn--text" data-val="low">Málo</button>
            <button class="lh-scale__btn lh-scale__btn--text" data-val="medium">Střed</button>
            <button class="lh-scale__btn lh-scale__btn--text" data-val="high">Hodně</button>
          </div>
          <input id="lh-movement" type="hidden">
        </label>

        <label class="lh-field">
          <span class="lh-field__label">Stres včera</span>
          <div class="lh-scale" data-field="lh-stress">
            ${[1,2,3,4,5].map(n => `<button class="lh-scale__btn" data-val="${n}">${n}</button>`).join('')}
          </div>
          <input id="lh-stress" type="hidden">
        </label>

      </div>

      <div class="lh-modal__actions">
        <button id="lh-skip"   class="lh-btn lh-btn--ghost">Přeskočit</button>
        <button id="lh-submit" class="lh-btn lh-btn--primary">Uložit</button>
      </div>
    </div>
  `;

  // Scale button logic — highlight vybraného + zapsat do hidden input
  el.querySelectorAll('.lh-scale').forEach(scale => {
    const fieldId = scale.dataset.field;
    const hidden  = el.querySelector(`#${fieldId}`) ||
                    el.querySelector(`#${fieldId.replace('-q', '')}`);
    scale.querySelectorAll('.lh-scale__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        scale.querySelectorAll('.lh-scale__btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (hidden) hidden.value = btn.dataset.val;
      });
    });
  });

  // CSS
  if (!document.getElementById('lh-checkin-style')) {
    const s = document.createElement('style');
    s.id = 'lh-checkin-style';
    s.textContent = `
      .lh-modal {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.25s;
      }
      .lh-modal--visible { opacity: 1; }
      .lh-modal__box {
        background: #0f172a; border: 1px solid rgba(245,158,11,0.3);
        border-radius: 16px; padding: 24px; width: 340px; max-width: 95vw;
        box-shadow: 0 0 40px rgba(245,158,11,0.15);
      }
      .lh-modal__header { text-align: center; margin-bottom: 20px; }
      .lh-modal__icon   { font-size: 28px; display: block; }
      .lh-modal__title  { font-family: monospace; color: #f59e0b; font-size: 13px;
                          letter-spacing: 2px; display: block; margin-top: 6px; }
      .lh-modal__sub    { color: #64748b; font-size: 11px; display: block; margin-top: 2px; }

      .lh-field { display: block; margin-bottom: 14px; }
      .lh-field__label { font-size: 11px; color: #94a3b8; font-family: monospace;
                         letter-spacing: 1px; text-transform: uppercase; display: block;
                         margin-bottom: 6px; }
      .lh-field__label em { text-transform: none; font-style: normal; color: #475569; }
      .lh-field__input {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; color: #e2e8f0; padding: 8px 12px; font-size: 14px; width: 100%;
      }
      .lh-field__input--short { width: 100px; }

      .lh-scale { display: flex; gap: 6px; flex-wrap: wrap; }
      .lh-scale__btn {
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; color: #94a3b8; padding: 6px 12px; font-size: 13px;
        cursor: pointer; transition: all 0.15s; min-width: 36px;
      }
      .lh-scale__btn--text { min-width: 60px; }
      .lh-scale__btn:hover { border-color: #f59e0b; color: #f59e0b; }
      .lh-scale__btn.active {
        background: rgba(245,158,11,0.15); border-color: #f59e0b; color: #f59e0b;
      }

      .lh-modal__actions { display: flex; gap: 10px; margin-top: 20px; }
      .lh-btn { flex: 1; padding: 10px; border-radius: 10px; font-size: 14px;
                cursor: pointer; border: none; transition: all 0.15s; }
      .lh-btn--ghost   { background: transparent; border: 1px solid #334155; color: #64748b; }
      .lh-btn--ghost:hover { border-color: #64748b; color: #94a3b8; }
      .lh-btn--primary { background: #f59e0b; color: #0f172a; font-weight: 700; }
      .lh-btn--primary:hover { background: #fbbf24; }
      .lh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    `;
    document.head.appendChild(s);
  }

  return el;
}
