// Onboarding wizard — 3-step modal pro nové uživatele
// Ukáže se pokud user_profiles.age není vyplněno.
// Uloží data do user_profiles + user_health_profile (diagnoses, capacity, lifestyle)
// přes Supabase anon client (RLS pending).

import { supabase } from './supabaseClient.js';
import { authFetch } from './authFetch.js';

export async function checkAndShowOnboarding(userId) {
  if (!userId) return;
  const { data } = await supabase
    .from('user_profiles')
    .select('age')
    .eq('user_id', userId)
    .maybeSingle();
  if (data?.age) return;
  _showWizard(userId);
}

function _showWizard(userId) {
  const overlay = document.createElement('div');
  overlay.id = 'onb-overlay';
  overlay.innerHTML = _html();
  document.body.appendChild(overlay);

  // state
  const state = { step: 1, cap: {}, gender: 'male' };

  const dots   = [null, overlay.querySelector('#onb-dot1'), overlay.querySelector('#onb-dot2'), overlay.querySelector('#onb-dot3')];
  const lines  = [null, overlay.querySelector('#onb-line1'), overlay.querySelector('#onb-line2')];
  const panels = [null, overlay.querySelector('#onb-s1'), overlay.querySelector('#onb-s2'), overlay.querySelector('#onb-s3')];
  const nextBtn = overlay.querySelector('#onb-next');
  const skipBtn = overlay.querySelector('#onb-skip');

  // gender pills
  overlay.querySelectorAll('[data-gender]').forEach(el => {
    el.addEventListener('click', () => {
      overlay.querySelectorAll('[data-gender]').forEach(x => x.classList.remove('onb-active'));
      el.classList.add('onb-active');
      state.gender = el.dataset.gender;
    });
  });

  // capacity pills
  overlay.querySelectorAll('[data-cap]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.cap;
      const val = el.dataset.val === 'true';
      overlay.querySelectorAll(`[data-cap="${key}"]`).forEach(x => x.classList.remove('onb-yes', 'onb-no'));
      el.classList.add(val ? 'onb-yes' : 'onb-no');
      state.cap[key] = val;
    });
  });

  skipBtn.addEventListener('click', () => _advance(true));
  nextBtn.addEventListener('click', () => _advance(false));

  function _advance(skip) {
    if (state.step === 3 || skip) {
      if (!skip) _save();
      else if (state.step < 3) { goTo(state.step + 1); return; }
      else _save();
      return;
    }
    _save_partial(state.step);
    goTo(state.step + 1);
  }

  function goTo(n) {
    panels[state.step].classList.remove('onb-active');
    dots[state.step].classList.replace('onb-dot-active', 'onb-dot-done');
    dots[state.step].innerHTML = '<i class="ti ti-check" style="font-size:13px"></i>';
    lines[state.step]?.classList.add('onb-line-done');
    state.step = n;
    panels[n].classList.add('onb-active');
    dots[n].classList.replace('onb-dot-future', 'onb-dot-active');
    if (n === 3) {
      nextBtn.textContent = 'Zobrazit mou mapu →';
      skipBtn.style.display = 'none';
    }
  }

  async function _save_partial(step) {
    if (step === 1) {
      const age    = parseInt(overlay.querySelector('#onb-age')?.value) || null;
      const height = parseInt(overlay.querySelector('#onb-height')?.value) || null;
      const weight = parseFloat(overlay.querySelector('#onb-weight')?.value) || null;
      const waist  = parseFloat(overlay.querySelector('#onb-waist')?.value) || null;
      if (age || height || weight || waist) {
        await authFetch('/api/user?action=wizard-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 1, age, height, weight, gender: state.gender, waist }),
        });
      }
    }
    if (step === 2) {
      const dx   = overlay.querySelector('#onb-diagnoses')?.value.split('\n').map(s => s.trim()).filter(Boolean) || [];
      const meds = overlay.querySelector('#onb-meds')?.value.split('\n').map(s => s.trim()).filter(Boolean) || [];
      if (dx.length || meds.length) {
        await authFetch('/api/user?action=wizard-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 2, diagnoses: dx, medications: meds }),
        });
      }
    }
  }

  async function _save() {
    if (Object.keys(state.cap).length) {
      await authFetch('/api/user?action=wizard-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 3, capacity: state.cap }),
      });
    }
    overlay.remove();
    if (typeof window.loadCRT === 'function') window.loadCRT(true);
    else window.location.reload();
  }
}

function _html() {
  return `
<style>
#onb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem}
#onb-box{background:#0f1117;border:0.5px solid #1e293b;border-radius:14px;padding:2rem;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;color:#e2e8f0;font-family:inherit}
.onb-progress{display:flex;align-items:center;gap:8px;margin-bottom:2rem}
.onb-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0}
.onb-dot-active{background:#0f3460;color:#60a5fa;border:1.5px solid #3b82f6}
.onb-dot-done{background:#3b82f6;color:#fff}
.onb-dot-future{background:#1e293b;color:#475569;border:0.5px solid #334155}
.onb-line{flex:1;height:1px;background:#1e293b}
.onb-line-done{background:#3b82f6}
.onb-eyebrow{font-size:11px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#475569;margin-bottom:.3rem}
.onb-title{font-size:20px;font-weight:500;color:#f1f5f9;margin-bottom:.3rem}
.onb-sub{font-size:13px;color:#64748b;margin-bottom:1.5rem;line-height:1.5}
.onb-field{margin-bottom:.9rem}
.onb-field label{display:block;font-size:13px;color:#94a3b8;margin-bottom:.3rem}
.onb-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.onb-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.onb-input{width:100%;height:36px;background:#1e293b;border:0.5px solid #334155;border-radius:6px;padding:0 10px;font-size:14px;color:#e2e8f0;outline:none}
.onb-input:focus{border-color:#3b82f6}
.onb-textarea{width:100%;background:#1e293b;border:0.5px solid #334155;border-radius:6px;padding:8px 10px;font-size:14px;color:#e2e8f0;resize:vertical;outline:none;font-family:inherit}
.onb-textarea:focus{border-color:#3b82f6}
.onb-gender-pills,.onb-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:.4rem}
.onb-gpill,.onb-pill{padding:6px 14px;border-radius:20px;border:0.5px solid #334155;background:#1e293b;font-size:13px;color:#94a3b8;cursor:pointer;transition:all .15s}
.onb-gpill.onb-active{border-color:#3b82f6;background:#0f3460;color:#93c5fd}
.onb-pill.onb-yes{border-color:#22c55e;background:#052e16;color:#86efac}
.onb-pill.onb-no{border-color:#ef4444;background:#2d0a0a;color:#fca5a5}
.onb-qa{margin-bottom:1.1rem}
.onb-q{font-size:14px;color:#cbd5e1;margin-bottom:.5rem;line-height:1.4}
.onb-hint{font-size:11px;color:#475569;margin-top:.3rem}
.onb-footer{display:flex;justify-content:space-between;align-items:center;margin-top:1.5rem}
.onb-skip{font-size:13px;color:#475569;background:none;border:none;cursor:pointer;padding:6px 0}
.onb-skip:hover{color:#94a3b8}
.onb-next{padding:8px 20px;border-radius:6px;border:0.5px solid #334155;background:#1e293b;color:#e2e8f0;font-size:14px;cursor:pointer;transition:background .15s}
.onb-next:hover{background:#273549}
.onb-panel{display:none}
.onb-active{display:block}
</style>
<div id="onb-box">
  <div class="onb-progress">
    <div class="onb-dot onb-dot-active" id="onb-dot1">1</div>
    <div class="onb-line" id="onb-line1"></div>
    <div class="onb-dot onb-dot-future" id="onb-dot2">2</div>
    <div class="onb-line" id="onb-line2"></div>
    <div class="onb-dot onb-dot-future" id="onb-dot3">3</div>
  </div>

  <div class="onb-panel onb-active" id="onb-s1">
    <div class="onb-eyebrow">Krok 1 ze 3</div>
    <div class="onb-title">Kdo jsi?</div>
    <p class="onb-sub">Základní údaje pro výpočet tvého profilu.</p>
    <div class="onb-row3">
      <div class="onb-field"><label>Věk</label><input id="onb-age" type="number" class="onb-input" placeholder="45" min="18" max="99"></div>
      <div class="onb-field"><label>Výška (cm)</label><input id="onb-height" type="number" class="onb-input" placeholder="178"></div>
      <div class="onb-field"><label>Váha (kg)</label><input id="onb-weight" type="number" class="onb-input" placeholder="88" step="0.1"></div>
    </div>
    <div class="onb-field">
      <label>Pohlaví</label>
      <div class="onb-gender-pills">
        <div class="onb-gpill onb-active" data-gender="male">Muž</div>
        <div class="onb-gpill" data-gender="female">Žena</div>
      </div>
    </div>
    <div class="onb-field">
      <label>Obvod pasu (cm) <span style="color:#475569;font-weight:400">— volitelné</span></label>
      <input id="onb-waist" type="number" class="onb-input" placeholder="94">
      <p class="onb-hint">Spolu s výškou určuje metabolické riziko</p>
    </div>
  </div>

  <div class="onb-panel" id="onb-s2">
    <div class="onb-eyebrow">Krok 2 ze 3</div>
    <div class="onb-title">Zdravotní situace</div>
    <p class="onb-sub">Co řekl lékař, co bereš. Cokoliv přeskočíš, doplníš kdykoliv.</p>
    <div class="onb-field">
      <label>Diagnózy (každá na nový řádek)</label>
      <textarea id="onb-diagnoses" rows="3" class="onb-textarea" placeholder="např. Hypertenze&#10;Vysoký LDL&#10;Fibrilace síní"></textarea>
    </div>
    <div class="onb-field">
      <label>Léky (každý na nový řádek)</label>
      <textarea id="onb-meds" rows="3" class="onb-textarea" placeholder="např. Atorvastatin 20 mg&#10;Pradaxa 110 mg&#10;Prestarium Neo"></textarea>
    </div>
  </div>

  <div class="onb-panel" id="onb-s3">
    <div class="onb-eyebrow">Krok 3 ze 3</div>
    <div class="onb-title">Jak na tom jsi fyzicky?</div>
    <p class="onb-sub">Odpovídej jak jsi na tom teď — ne jak chceš být.</p>

    <div class="onb-qa">
      <div class="onb-q">Vyjedeš čtyři patra bez zadýchání?</div>
      <div class="onb-pills">
        <div class="onb-pill" data-cap="climb_4_floors" data-val="true">Ano</div>
        <div class="onb-pill" data-cap="climb_4_floors" data-val="false">Ne</div>
      </div>
    </div>
    <div class="onb-qa">
      <div class="onb-q">Ujdeš 2 km rychlou chůzí bez zastávky?</div>
      <div class="onb-pills">
        <div class="onb-pill" data-cap="fast_walk_2km" data-val="true">Ano</div>
        <div class="onb-pill" data-cap="fast_walk_2km" data-val="false">Ne</div>
      </div>
    </div>
    <div class="onb-qa">
      <div class="onb-q">Zvedneš 20 kg ze země bez problémů?</div>
      <div class="onb-pills">
        <div class="onb-pill" data-cap="lift_20kg" data-val="true">Ano</div>
        <div class="onb-pill" data-cap="lift_20kg" data-val="false">Ne</div>
      </div>
    </div>
    <div class="onb-qa">
      <div class="onb-q">Vstaneš ze země bez opory rukou?</div>
      <div class="onb-pills">
        <div class="onb-pill" data-cap="rise_from_floor" data-val="true">Ano</div>
        <div class="onb-pill" data-cap="rise_from_floor" data-val="false">Ne</div>
      </div>
    </div>
    <div class="onb-qa">
      <div class="onb-q">Vydržíš stát na jedné noze 10 sekund se zavřenýma očima?</div>
      <div class="onb-pills">
        <div class="onb-pill" data-cap="balance_eyes_closed" data-val="true">Ano</div>
        <div class="onb-pill" data-cap="balance_eyes_closed" data-val="false">Ne</div>
      </div>
    </div>
    <div class="onb-qa">
      <div class="onb-q">Zadržíš dech na 20 sekund bez potíží?</div>
      <div class="onb-pills">
        <div class="onb-pill" data-cap="breath_20s" data-val="true">Ano</div>
        <div class="onb-pill" data-cap="breath_20s" data-val="false">Ne</div>
      </div>
    </div>
  </div>

  <div class="onb-footer">
    <button class="onb-skip" id="onb-skip">Přeskočit →</button>
    <button class="onb-next" id="onb-next">Dál →</button>
  </div>
</div>`;
}
