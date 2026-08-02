// =====================================================
// USER DATA PANEL – Profil člověka (5 záložek)
// Zdraví | Kondice | Profil | Sen | Data
// =====================================================

import { supabase } from './supabaseClient.js';

// ─── State ────────────────────────────────────────
let activeTab  = 'zdravi';
let cachedData = null;
let userId     = null;

// ─── Open / Close ─────────────────────────────────
export function openUserDataPanel() {
  userId = window._chjUserId || window.firebaseAuth?.currentUser?.uid;
  if (!userId) return;
  const modal = document.getElementById('userDataModal');
  if (!modal) return;
  activeTab = 'zdravi';
  modal.classList.remove('udp-hidden');
  loadAndRender();
}

function closePanel() {
  document.getElementById('userDataModal')?.classList.add('udp-hidden');
}

window.openUserDataPanel = openUserDataPanel;
window.initUserDataPanel = initUserDataPanel;

// ─── Load all data ─────────────────────────────────
async function loadAndRender() {
  renderSkeleton();

  const [profileRes, constraintsRes, decathlonRes, healthRes, medsRes] = await Promise.all([
    supabase.from('user_profiles')
      .select('age, gender, height, weight, birth_year')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('user_constraints')
      .select('constraint_type, constraint_key, constraint_value, severity')
      .eq('user_id', userId),
    supabase.from('user_decathlon')
      .select('goal_key, label, target_age')
      .eq('user_id', userId).eq('active', true).maybeSingle(),
    supabase.from('user_health_profile')
      .select('diagnoses, symptoms, family_history, supplements, doctor_notes, lifestyle, capacity, labs')
      .eq('user_id', userId).maybeSingle(),
    supabase.from('user_medications')
      .select('name, dose, active')
      .eq('user_id', userId).eq('active', true),
  ]);

  const h = healthRes.data ?? {};
  cachedData = {
    profile:        profileRes.data   ?? {},
    constraints:    constraintsRes.data ?? [],
    decathlon:      decathlonRes.data ?? {},
    diagnoses:      h.diagnoses      ?? [],
    symptoms:       h.symptoms       ?? [],
    family_history: h.family_history ?? '',
    supplements:    h.supplements    ?? [],
    doctor_notes:   h.doctor_notes   ?? '',
    lifestyle:      h.lifestyle      ?? {},
    capacity:       h.capacity       ?? {},
    labs:           h.labs           ?? {},
    medications:    medsRes.data     ?? [],
  };

  renderTab(activeTab);
}

function renderSkeleton() {
  const body = document.getElementById('udp-body');
  if (body) body.innerHTML = `<div style="padding:32px;text-align:center;color:#475569;">Načítám…</div>`;
}

// ─── Tab switch ────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.udp-tab').forEach(t => {
    const active = t.dataset.tab === tab;
    t.style.borderBottom = active ? '2px solid #06b6d4' : '2px solid transparent';
    t.style.color         = active ? '#06b6d4' : '#64748b';
  });
  renderTab(tab);
}

function renderTab(tab) {
  const body = document.getElementById('udp-body');
  if (!body || !cachedData) return;
  switch (tab) {
    case 'zdravi':     body.innerHTML = renderZdraviTab();     break;
    case 'kondice':    body.innerHTML = renderKondiceTab();    break;
    case 'profile':    body.innerHTML = renderProfilTab();     break;
    case 'aspirations':body.innerHTML = renderAspirationsTab();break;
    case 'data':       body.innerHTML = renderDataTab();       break;
  }
  bindTabEvents(tab);
}

// ═══════════════════════════════════════════════════
// TAB: Zdraví — Diagnózy, Léky, Labs, Doctor notes
// ═══════════════════════════════════════════════════

const LAB_FIELDS = [
  { key: 'hba1c',           label: 'HbA1c',            unit: '%',      placeholder: '5.4'  },
  { key: 'fasting_glucose', label: 'Glukóza nalačno',  unit: 'mmol/L', placeholder: '5.1'  },
  { key: 'ldl',             label: 'LDL cholesterol',  unit: 'mmol/L', placeholder: '3.2'  },
  { key: 'hdl',             label: 'HDL cholesterol',  unit: 'mmol/L', placeholder: '1.2'  },
  { key: 'triglycerides',   label: 'Triglyceridy',     unit: 'mmol/L', placeholder: '1.5'  },
  { key: 'crp',             label: 'hs-CRP',           unit: 'mg/L',   placeholder: '0.8'  },
  { key: 'testosterone',    label: 'Testosteron',      unit: 'nmol/L', placeholder: '15.0' },
  { key: 'psa',             label: 'PSA',              unit: 'µg/L',   placeholder: '1.2'  },
];

function renderZdraviTab() {
  const diagnoses  = (cachedData.diagnoses ?? []).join('\n');
  const symptoms   = (cachedData.symptoms  ?? []).join('\n');
  const familyHist = cachedData.family_history ?? '';
  const meds       = cachedData.medications ?? [];
  const supps      = cachedData.supplements ?? [];
  const labs       = cachedData.labs ?? {};
  const docNotes   = cachedData.doctor_notes ?? '';

  const medRows  = meds.length  ? meds.map((m, i)  => renderMedRow(i, m)).join('')  : renderMedRow(0, {});
  const suppRows = supps.length ? supps.map((s, i) => renderSuppRow(i, s)).join('') : renderSuppRow(0, {});

  const labsHtml = LAB_FIELDS.map(f => `
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div class="udp-field-label">${f.label} <span style="color:#334155;">(${f.unit})</span></div>
      <input class="udp-input lab-field" data-key="${f.key}" type="number" step="0.1"
             placeholder="${f.placeholder}" value="${esc(labs[f.key] ?? '')}"
             style="width:100%;">
    </div>`).join('');

  return `
    <div class="udp-section">
      <div class="udp-section-label">Diagnózy</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Každá diagnóza na nový řádek. Neznáš přesný název? Napiš jak to popisuje lékař — AI doplní.
      </p>
      <textarea id="zdravi-diagnoses" rows="3" class="udp-input"
        style="width:100%;resize:vertical;font-family:inherit;"
        placeholder="např. Fibrilace síní&#10;Hypertenze&#10;Vysoký LDL">${esc(diagnoses)}</textarea>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Symptomy</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Co tě pravidelně trápí — bolest, únava, dušnost, závratě... Každý symptom na řádek.
      </p>
      <textarea id="zdravi-symptoms" rows="3" class="udp-input"
        style="width:100%;resize:vertical;font-family:inherit;"
        placeholder="např. Únava po obědě&#10;Noční pocení&#10;Bušení srdce">${esc(symptoms)}</textarea>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Rodinná anamnéza</div>
      <textarea id="zdravi-family" rows="3" class="udp-input"
        style="width:100%;resize:vertical;font-family:inherit;"
        placeholder="např. Otec: infarkt v 65, cukrovka 2. typu&#10;Matka: rakovina prsu">${esc(familyHist)}</textarea>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Léky</div>
      <div id="med-rows">${medRows}</div>
      <button id="btn-add-med" class="udp-add-btn">+ Přidat lék</button>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Doplňky stravy</div>
      <div id="supp-rows">${suppRows}</div>
      <button id="btn-add-supp" class="udp-add-btn">+ Přidat doplněk</button>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Laboratorní hodnoty</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 14px;line-height:1.5;">
        Zadej poslední naměřené hodnoty. Ovlivňují predikce v CRT grafu.
      </p>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        ${labsHtml}
      </div>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Zpráva od lékaře <span style="font-weight:400;color:#475569;">(volitelné)</span></div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Opis klíčové části zprávy — CHJ ji použije pro přesnější analýzu.
      </p>
      <textarea id="zdravi-doctor-notes" rows="4" class="udp-input"
        style="width:100%;resize:vertical;font-family:inherit;"
        placeholder="např. Holter 24h: fibrilace síní 8% času. Echo: EF 58%...">${esc(docNotes)}</textarea>
    </div>

    <div class="udp-save-row">
      <span id="udp-status-zdravi" class="udp-status"></span>
      <button id="btn-save-zdravi" class="udp-save-btn">Uložit</button>
    </div>`;
}

function bindZdraviEvents() {
  document.getElementById('btn-add-med')?.addEventListener('click', () => {
    const container = document.getElementById('med-rows');
    container.insertAdjacentHTML('beforeend', renderMedRow(container.querySelectorAll('.udp-injury-row').length));
    bindMedDelButtons();
  });
  document.getElementById('btn-add-supp')?.addEventListener('click', () => {
    const container = document.getElementById('supp-rows');
    container.insertAdjacentHTML('beforeend', renderSuppRow(container.querySelectorAll('.udp-injury-row').length));
    bindSuppDelButtons();
  });
  bindMedDelButtons();
  bindSuppDelButtons();
  document.getElementById('btn-save-zdravi')?.addEventListener('click', saveZdravi);
}

function bindMedDelButtons() {
  document.querySelectorAll('#med-rows .udp-del-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.udp-injury-row').remove());
  });
}

function bindSuppDelButtons() {
  document.querySelectorAll('#supp-rows .udp-del-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.udp-injury-row').remove());
  });
}

async function saveZdravi() {
  setStatus('udp-status-zdravi', 'saving');
  const diagnoses      = (document.getElementById('zdravi-diagnoses')?.value ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  const symptoms       = (document.getElementById('zdravi-symptoms')?.value   ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  const family_history = (document.getElementById('zdravi-family')?.value     ?? '').trim();
  const doctor_notes   = (document.getElementById('zdravi-doctor-notes')?.value ?? '').trim();

  const labs = {};
  document.querySelectorAll('.lab-field').forEach(inp => {
    const val = parseFloat(inp.value);
    if (!isNaN(val)) labs[inp.dataset.key] = val;
  });

  const medRows = document.querySelectorAll('#med-rows .udp-injury-row');
  const medications = [...medRows].map(row => ({
    name: row.querySelector('.med-name')?.value.trim(),
    dose: row.querySelector('.med-dose')?.value.trim() || null,
  })).filter(m => m.name);

  const suppRows = document.querySelectorAll('#supp-rows .udp-injury-row');
  const supplements = [...suppRows].map(row => ({
    name: row.querySelector('.supp-name')?.value.trim(),
    dose: row.querySelector('.supp-dose')?.value.trim() || null,
  })).filter(s => s.name);

  try {
    const { error: e1 } = await supabase.from('user_health_profile')
      .upsert({ user_id: userId, diagnoses, symptoms, family_history, supplements, doctor_notes, labs },
               { onConflict: 'user_id' });
    if (e1) throw e1;

    await supabase.from('user_medications').update({ active: false }).eq('user_id', userId);
    for (const med of medications) {
      await supabase.from('user_medications')
        .upsert({ user_id: userId, name: med.name, dose: med.dose, active: true },
                 { onConflict: 'user_id,name' });
    }

    cachedData = { ...cachedData, diagnoses, symptoms, family_history, supplements, doctor_notes, labs, medications };
    setStatus('udp-status-zdravi', 'ok');
    window.chjRefreshHealthData?.();
  } catch (e) {
    console.error('saveZdravi:', e?.message || e);
    setStatus('udp-status-zdravi', 'error');
  }
}

// ═══════════════════════════════════════════════════
// TAB: Kondice — Fyzický test + Omezení
// ═══════════════════════════════════════════════════

const CAPACITY_QUESTIONS = [
  { key: 'climb_4_floors',  label: 'Vyjít 4 patra bez zadýchání?',          hint: 'přibližně 80 schodů'   },
  { key: 'lift_20kg',       label: 'Zvednout a přenést 20 kg?',              hint: 'nákup, zavazadlo'      },
  { key: 'rise_from_floor', label: 'Vstát ze země bez opory?',               hint: 'z lehu na zemi'        },
  { key: 'stand_one_leg',   label: 'Stát na jedné noze 10 s (oči zavřené)?', hint: 'rovnováha'             },
  { key: 'fast_walk_2km',   label: 'Ujít 2 km rychlou chůzí?',              hint: 'bez zastávky'          },
  { key: 'breath_20s',      label: 'Zadržet dech 20 sekund?',                hint: 'vsedě, klidně'         },
];

function renderKondiceTab() {
  const cap = cachedData.capacity ?? {};

  const questionsHtml = CAPACITY_QUESTIONS.map(q => {
    const val = cap[q.key];
    const yes = val === true;
    const no  = val === false;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 0;border-bottom:1px solid #1e293b;">
        <div>
          <div style="color:#e2e8f0;font-size:14px;">${q.label}</div>
          <div style="color:#475569;font-size:12px;margin-top:2px;">${q.hint}</div>
        </div>
        <div class="udp-yn-row" data-key="${q.key}">
          <button class="udp-yn-btn ${yes ? 'udp-yn-yes' : ''}" data-val="true">Ano</button>
          <button class="udp-yn-btn ${no  ? 'udp-yn-no'  : ''}" data-val="false">Ne</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="udp-section">
      <div class="udp-section-label">Fyzický test</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 4px;line-height:1.5;">
        Odpovědi ovlivňují CRT graf — LOW_VO2MAX, MUSCLE_WEAKNESS, GAIT_INSTABILITY.
      </p>
      <div>${questionsHtml}</div>
    </div>

    <div class="udp-section" style="margin-top:28px;">
      <div class="udp-section-label">Fyzická omezení</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Zranění nebo chronické obtíže, které omezují pohyb.
      </p>
      <div id="injury-rows">${renderInjuriesHtml()}</div>
      <button id="btn-add-injury" class="udp-add-btn">+ Přidat omezení</button>
    </div>

    <div class="udp-save-row">
      <span id="udp-status-kondice" class="udp-status"></span>
      <button id="btn-save-kondice" class="udp-save-btn">Uložit</button>
    </div>`;
}

function renderInjuriesHtml() {
  const injuries = getInjuries();
  return injuries.length
    ? injuries.map((inj, i) => renderInjuryRow(i, inj)).join('')
    : `<p style="color:#475569;font-size:14px;padding:8px 0;">Žádné omezení.</p>`;
}

function bindKondiceEvents() {
  // Yes/No buttons
  document.querySelectorAll('.udp-yn-row').forEach(row => {
    row.querySelectorAll('.udp-yn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.udp-yn-btn').forEach(b => {
          b.classList.remove('udp-yn-yes', 'udp-yn-no');
        });
        const isYes = btn.dataset.val === 'true';
        btn.classList.add(isYes ? 'udp-yn-yes' : 'udp-yn-no');
      });
    });
  });

  document.getElementById('btn-add-injury')?.addEventListener('click', () => {
    const container = document.getElementById('injury-rows');
    const idx = container.querySelectorAll('.udp-injury-row').length;
    const emptyP = container.querySelector('p');
    if (emptyP) emptyP.remove();
    container.insertAdjacentHTML('beforeend', renderInjuryRow(idx));
    bindDelButtons();
  });
  bindDelButtons();
  document.getElementById('btn-save-kondice')?.addEventListener('click', saveKondice);
}

async function saveKondice() {
  setStatus('udp-status-kondice', 'saving');

  // Capacity from Yes/No buttons
  const capacity = {};
  document.querySelectorAll('.udp-yn-row').forEach(row => {
    const key = row.dataset.key;
    const activeBtn = row.querySelector('.udp-yn-yes, .udp-yn-no');
    if (activeBtn) capacity[key] = activeBtn.dataset.val === 'true';
  });

  // Injuries
  const rows = [...document.querySelectorAll('.udp-injury-row')].map(row => ({
    location:    row.querySelector('.inj-location')?.value.trim(),
    restriction: row.querySelector('.inj-restriction')?.value.trim(),
    severity:    row.querySelector('.inj-severity')?.value,
  })).filter(r => r.location || r.restriction);

  try {
    const { error: e1 } = await supabase.from('user_health_profile')
      .upsert({ user_id: userId, capacity }, { onConflict: 'user_id' });
    if (e1) throw e1;

    await supabase.from('user_constraints').delete()
      .eq('user_id', userId).eq('constraint_type', 'injury');
    for (let i = 0; i < rows.length; i++) {
      await supabase.from('user_constraints').insert({
        user_id: userId,
        constraint_type: 'injury',
        constraint_key:  `injury_${i}`,
        constraint_value: JSON.stringify({ location: rows[i].location, restriction: rows[i].restriction }),
        severity: rows[i].severity,
      });
    }

    const { data: freshConstraints } = await supabase.from('user_constraints')
      .select('*').eq('user_id', userId);
    cachedData.constraints = freshConstraints ?? [];
    cachedData.capacity = capacity;
    setStatus('udp-status-kondice', 'ok');
  } catch (e) {
    console.error('saveKondice:', e?.message || e);
    setStatus('udp-status-kondice', 'error');
  }
}

// Injury helpers (shared)
function getInjuries() {
  return (cachedData.constraints ?? [])
    .filter(c => c.constraint_type === 'injury' && c.constraint_key.startsWith('injury_'))
    .map(c => {
      let loc = '', res = '';
      try { const v = JSON.parse(c.constraint_value); loc = v.location ?? ''; res = v.restriction ?? ''; }
      catch { loc = c.constraint_value; }
      return { key: c.constraint_key, location: loc, restriction: res, severity: c.severity ?? 'moderate' };
    });
}

function renderInjuryRow(i, inj = {}) {
  return `
    <div class="udp-injury-row" data-idx="${i}">
      <input class="udp-input inj-location" placeholder="Lokalizace (např. Levý kotník)"
             value="${esc(inj.location ?? '')}" style="flex:2;">
      <input class="udp-input inj-restriction" placeholder="Omezení (např. Nesmím rotace)"
             value="${esc(inj.restriction ?? '')}" style="flex:2;">
      <select class="udp-select inj-severity">
        ${['mild','moderate','severe'].map(s =>
          `<option value="${s}"${inj.severity === s ? ' selected' : ''}>${severityLabel(s)}</option>`
        ).join('')}
      </select>
      <button class="udp-del-btn" data-idx="${i}" title="Odstranit">✕</button>
    </div>`;
}

function severityLabel(s) {
  return { mild: 'Mírné', moderate: 'Střední', severe: 'Závažné' }[s] ?? s;
}

function bindDelButtons() {
  document.querySelectorAll('.udp-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.udp-injury-row').remove();
      document.querySelectorAll('.udp-injury-row').forEach((row, i) => row.dataset.idx = i);
      if (!document.querySelector('.udp-injury-row')) {
        document.getElementById('injury-rows').innerHTML =
          `<p style="color:#475569;font-size:14px;padding:8px 0;">Žádné omezení.</p>`;
      }
    });
  });
}

// ═══════════════════════════════════════════════════
// TAB: Profil — Demografika + BMI + Lifestyle
// ═══════════════════════════════════════════════════

const LIFESTYLE_FLAGS = [
  { key: 'sedentary',  label: 'Sedavý životní styl',    desc: 'Méně než 30 min pohybu denně' },
  { key: 'smoker',     label: 'Kuřák',                  desc: 'Aktivní kuřák'                },
  { key: 'alcohol',    label: 'Pravidelný alkohol',      desc: '3+ drinky týdně'              },
  { key: 'stress_job', label: 'Vysoký pracovní stres',  desc: 'Chronický tlak v práci'       },
];

function calcBmi(height, weight) {
  if (!height || !weight || height < 100) return null;
  return weight / Math.pow(height / 100, 2);
}

function bmiLabel(bmi) {
  if (bmi < 18.5) return ['Podváha',       '#64748b'];
  if (bmi < 25)   return ['Normální váha', '#22c55e'];
  if (bmi < 30)   return ['Nadváha',       '#eab308'];
  return               ['Obezita',         '#ef4444'];
}

function renderProfilTab() {
  const p = cachedData.profile ?? {};
  const ls = cachedData.lifestyle ?? {};
  const birthYear = p.birth_year ?? '';
  const calcAge   = birthYear ? (new Date().getFullYear() - birthYear) : '';
  const bmi       = calcBmi(p.height, p.weight);
  const [bmiText, bmiColor] = bmi ? bmiLabel(bmi) : ['', '#64748b'];

  const bmiHtml = bmi ? `
    <div style="margin-top:12px;padding:10px 14px;border-radius:8px;
      background:rgba(255,255,255,0.04);border:1px solid #1e293b;">
      <span style="color:#64748b;font-size:13px;">BMI: </span>
      <span style="font-size:18px;font-weight:700;color:${bmiColor};">${bmi.toFixed(1)}</span>
      <span style="color:${bmiColor};font-size:13px;margin-left:8px;">${bmiText}</span>
    </div>` : '';

  const lifestyleHtml = LIFESTYLE_FLAGS.map(f => {
    const on = ls[f.key] === true;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 0;border-bottom:1px solid #1e293b;">
        <div>
          <div style="color:#e2e8f0;font-size:14px;">${f.label}</div>
          <div style="color:#475569;font-size:12px;margin-top:2px;">${f.desc}</div>
        </div>
        <button class="udp-toggle ${on ? 'udp-toggle-on' : ''}" data-lf-key="${f.key}">
          <div class="udp-toggle-thumb"></div>
        </button>
      </div>`;
  }).join('');

  return `
    <div class="udp-section">
      <div class="udp-section-label">Základní údaje</div>
      <div class="udp-row-4">
        <div>
          <div class="udp-field-label">Rok narození</div>
          <input id="prof-birth-year" type="number" class="udp-input udp-mini"
                 placeholder="1957" min="1920" max="2010" value="${esc(birthYear)}">
          ${calcAge ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px;">${calcAge} let</div>` : ''}
        </div>
        <div>
          <div class="udp-field-label">Výška (cm)</div>
          <input id="prof-height" type="number" class="udp-input udp-mini"
                 placeholder="178" min="140" max="220" value="${esc(p.height ?? '')}">
        </div>
        <div>
          <div class="udp-field-label">Váha (kg)</div>
          <input id="prof-weight" type="number" class="udp-input udp-mini"
                 placeholder="80" min="40" max="200" value="${esc(p.weight ?? '')}">
        </div>
        <div>
          <div class="udp-field-label">Pohlaví</div>
          <div class="udp-gender-row">
            <button class="udp-gender-btn ${p.gender === 'male'   ? 'active' : ''}" data-gender="male">Muž</button>
            <button class="udp-gender-btn ${p.gender === 'female' ? 'active' : ''}" data-gender="female">Žena</button>
          </div>
        </div>
      </div>
      ${bmiHtml}
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Životní styl</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 4px;line-height:1.5;">
        Ovlivňuje SEDENTARY a CHRONIC_STRESS větve v CRT.
      </p>
      ${lifestyleHtml}
    </div>

    <div class="udp-save-row">
      <span id="udp-status-profil" class="udp-status"></span>
      <button id="btn-save-profil" class="udp-save-btn">Uložit</button>
    </div>`;
}

function bindProfilEvents() {
  document.querySelectorAll('.udp-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.udp-gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('[data-lf-key]').forEach(toggle => {
    toggle.addEventListener('click', () => toggle.classList.toggle('udp-toggle-on'));
  });

  // Live BMI recalculation
  ['prof-height', 'prof-weight'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateBmiDisplay);
  });

  document.getElementById('btn-save-profil')?.addEventListener('click', saveProfil);
}

function updateBmiDisplay() {
  const h = parseFloat(document.getElementById('prof-height')?.value);
  const w = parseFloat(document.getElementById('prof-weight')?.value);
  const bmi = calcBmi(h, w);
  const existing = document.getElementById('udp-bmi-live');
  if (!bmi) { if (existing) existing.remove(); return; }
  const [text, color] = bmiLabel(bmi);
  const html = `<div id="udp-bmi-live" style="margin-top:12px;padding:10px 14px;border-radius:8px;
    background:rgba(255,255,255,0.04);border:1px solid #1e293b;">
    <span style="color:#64748b;font-size:13px;">BMI: </span>
    <span style="font-size:18px;font-weight:700;color:${color};">${bmi.toFixed(1)}</span>
    <span style="color:${color};font-size:13px;margin-left:8px;">${text}</span>
  </div>`;
  if (existing) existing.outerHTML = html;
  else document.querySelector('.udp-row-4')?.insertAdjacentHTML('afterend', html);
}

async function saveProfil() {
  setStatus('udp-status-profil', 'saving');
  const birthYear = parseInt(document.getElementById('prof-birth-year')?.value) || null;
  const height    = parseFloat(document.getElementById('prof-height')?.value)   || null;
  const weight    = parseFloat(document.getElementById('prof-weight')?.value)   || null;
  const gender    = document.querySelector('.udp-gender-btn.active')?.dataset.gender ?? null;
  const age       = birthYear ? (new Date().getFullYear() - birthYear) : null;

  const lifestyle = {};
  document.querySelectorAll('[data-lf-key]').forEach(toggle => {
    lifestyle[toggle.dataset.lfKey] = toggle.classList.contains('udp-toggle-on');
  });

  try {
    const profileData = { user_id: userId };
    if (birthYear !== null) profileData.birth_year = birthYear;
    if (age !== null)       profileData.age         = age;
    if (gender)             profileData.gender      = gender;
    if (height !== null)    profileData.height      = height;
    if (weight !== null)    profileData.weight      = weight;

    const { error: pe } = await supabase.from('user_profiles')
      .upsert(profileData, { onConflict: 'user_id' });
    if (pe) console.warn('profile upsert:', pe.message);

    const { error: le } = await supabase.from('user_health_profile')
      .upsert({ user_id: userId, lifestyle }, { onConflict: 'user_id' });
    if (le) console.warn('lifestyle upsert:', le.message);

    const { data: freshProfile } = await supabase.from('user_profiles')
      .select('age, gender, height, weight, birth_year').eq('user_id', userId).maybeSingle();
    cachedData.profile   = freshProfile ?? {};
    cachedData.lifestyle = lifestyle;
    setStatus('udp-status-profil', 'ok');
  } catch (e) {
    console.error('saveProfil:', e?.message || e);
    setStatus('udp-status-profil', 'error');
  }
}

// ═══════════════════════════════════════════════════
// TAB: Sen — Dekatlon goal (beze změny)
// ═══════════════════════════════════════════════════

const DECATHLON_GOALS = [
  { key: 'plavani',  icon: '🏊', label: 'Uplavat 0,5 km',         desc: 'V bazénu nebo v jezeře, bez přestávky.',       pillar_weights: { kardio: 0.4, sila: 0.3, stabilita: 0.2, vo2max: 0.1 } },
  { key: 'bezky',    icon: '🎿', label: 'Projet na běžkách 5 km', desc: 'Klasicky nebo bruslením, vlastním tempem.',    pillar_weights: { vo2max: 0.4, vytrvalost: 0.3, sila: 0.2, stabilita: 0.1 } },
  { key: 'kolo',     icon: '🚴', label: 'Jet 2 hodiny na kole',   desc: 'Silnice nebo les, bez nutnosti zastavit.',     pillar_weights: { vo2max: 0.35, vytrvalost: 0.35, sila: 0.2, stabilita: 0.1 } },
  { key: 'hora',     icon: '🏔️', label: 'Vyjít na horu',          desc: '800+ m převýšení, vlastními nohami.',          pillar_weights: { vytrvalost: 0.35, sila: 0.35, stabilita: 0.2, vo2max: 0.1 } },
  { key: 'tenis',    icon: '🎾', label: 'Zahrát tenis',           desc: 'Celý set, reagovat a pohybovat se po kurtu.',  pillar_weights: { stabilita: 0.3, sila: 0.3, vo2max: 0.2, vytrvalost: 0.2 } },
  { key: 'vnoucata', icon: '👶', label: 'Hrát si s vnoučaty',     desc: 'Sedat na zem, vstávat, nosit, honit se.',      pillar_weights: { stabilita: 0.35, sila: 0.3, mobilita: 0.25, vo2max: 0.1 } },
  { key: 'chuze',    icon: '🚶', label: 'Ujít 5 km v pohodě',     desc: 'Procházka přírodou, bez únavy a bolesti.',     pillar_weights: { stabilita: 0.35, vytrvalost: 0.35, sila: 0.2, vo2max: 0.1 } },
  { key: 'sila',     icon: '💪', label: 'Ovládat vlastní tělo',   desc: 'Dřep, shyb, klik — silné a mobilní tělo.',    pillar_weights: { sila: 0.5, stabilita: 0.3, mobilita: 0.2 } },
];

function renderAspirationsTab() {
  const current = cachedData.decathlon?.goal_key ?? '';
  const cards = DECATHLON_GOALS.map(g => {
    const selected = g.key === current;
    return `
      <div class="asp-card${selected ? ' asp-card-selected' : ''}" data-key="${g.key}"
        style="padding:16px;border-radius:12px;cursor:pointer;
               border:2px solid ${selected ? '#06b6d4' : 'rgba(255,255,255,0.1)'};
               background:${selected ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)'};
               transition:all 0.2s;">
        <div style="font-size:26px;margin-bottom:6px;">${g.icon}</div>
        <div style="color:${selected ? '#06b6d4' : '#e2e8f0'};font-size:15px;font-weight:600;margin-bottom:4px;">${g.label}</div>
        <div style="color:#64748b;font-size:12px;line-height:1.5;">${g.desc}</div>
      </div>`;
  }).join('');

  return `
    <div class="udp-section">
      <h3 style="color:#f8fafc;font-size:18px;margin-bottom:6px;line-height:1.5;">
        Jaký je tvůj sen k
        <input id="asp-target-age" type="number" min="50" max="105"
          value="${cachedData.decathlon?.target_age ?? 85}"
          style="width:52px;font-size:18px;font-weight:700;text-align:center;
                 background:transparent;border:none;border-bottom:2px solid #06b6d4;
                 color:#06b6d4;outline:none;padding:0 2px;">. narozeninám?
      </h3>
      <p style="color:#64748b;font-size:13px;margin-bottom:20px;font-style:italic;">CHJ přizpůsobí plán tak, aby ses k němu dostal.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${cards}</div>
    </div>
    <div class="udp-save-row">
      <span id="udp-status-sen" class="udp-status"></span>
      <button id="btn-save-aspirations" class="udp-save-btn">Uložit</button>
    </div>`;
}

function bindAspirationsEvents() {
  document.querySelectorAll('.asp-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.asp-card').forEach(c => {
        c.style.border = '2px solid rgba(255,255,255,0.1)';
        c.style.background = 'rgba(255,255,255,0.03)';
        c.querySelector('div:nth-child(2)').style.color = '#e2e8f0';
        c.classList.remove('asp-card-selected');
      });
      card.style.border = '2px solid #06b6d4';
      card.style.background = 'rgba(6,182,212,0.1)';
      card.querySelector('div:nth-child(2)').style.color = '#06b6d4';
      card.classList.add('asp-card-selected');
    });
  });
  document.getElementById('btn-save-aspirations')?.addEventListener('click', saveAspirations);
}

async function saveAspirations() {
  const selected = document.querySelector('.asp-card-selected');
  if (!selected) { setStatus('udp-status-sen', 'error'); return; }
  const goalKey = selected.dataset.key;
  const goal = DECATHLON_GOALS.find(g => g.key === goalKey);
  if (!goal) return;
  const targetAge = parseInt(document.getElementById('asp-target-age')?.value) || 85;

  setStatus('udp-status-sen', 'saving');
  try {
    await supabase.from('user_decathlon').update({ active: false }).eq('user_id', userId);
    const { error } = await supabase.from('user_decathlon').insert({
      user_id: userId, goal_key: goal.key, label: goal.label,
      target_age: targetAge, priority: 5, pillar_weights: goal.pillar_weights, active: true,
    });
    if (error) throw error;
    cachedData.decathlon = { goal_key: goal.key, label: goal.label, target_age: targetAge };
    setStatus('udp-status-sen', 'ok');
  } catch (e) {
    console.error('saveAspirations:', e?.message || e);
    setStatus('udp-status-sen', 'error');
  }
}

// ═══════════════════════════════════════════════════
// TAB: Data — Check-in + Dokumenty + Integrace
// ═══════════════════════════════════════════════════

function renderDataTab() {
  return `
    <!-- Check-in -->
    <div class="udp-section">
      <div class="udp-section-label">Dnešní záznam</div>

      <div style="font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">ENERGIE</div>
      <div style="margin-bottom:28px;">
        <input id="chk-energie" type="range" min="1" max="5" step="1" value="3"
          style="width:100%;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
                 background:linear-gradient(to right,#ef4444 0%,#eab308 50%,#22c55e 100%);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="color:#64748b;font-size:13px;">Vyčerpaný</span>
          <span id="chk-energie-label" style="color:#06b6d4;font-size:20px;font-weight:600;">ujde to</span>
          <span style="color:#64748b;font-size:13px;">Nabitý</span>
        </div>
      </div>

      <div style="font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">SPÁNEK</div>
      <div style="margin-bottom:28px;">
        <input id="chk-spanek" type="range" min="0" max="12" step="0.5" value="7"
          style="width:100%;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
                 background:linear-gradient(to right,#1e3a5f 0%,#06b6d4 58%,#0e7490 100%);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="color:#64748b;font-size:13px;">0 h</span>
          <span id="chk-spanek-label" style="color:#06b6d4;font-size:20px;font-weight:600;">7 h</span>
          <span style="color:#64748b;font-size:13px;">12 h</span>
        </div>
      </div>

      <div style="font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">
        HRV <span style="font-weight:400;">(ms · volitelné)</span>
      </div>
      <div style="margin-bottom:8px;">
        <input id="chk-hrv" type="range" min="0" max="120" step="1" value="0"
          style="width:100%;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
                 background:linear-gradient(to right,#1e293b 0%,#334155 100%);opacity:0.5;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="color:#334155;font-size:13px;">—</span>
          <span id="chk-hrv-label" style="color:#475569;font-size:20px;font-weight:600;"></span>
          <span style="color:#334155;font-size:13px;">120 ms</span>
        </div>
      </div>

      <div class="udp-save-row" style="border:none;padding-top:8px;">
        <span id="chk-status" class="udp-status"></span>
        <button id="btn-save-checkin" class="udp-save-btn">Uložit záznam</button>
      </div>
    </div>

    <!-- Dokumenty -->
    <div class="udp-section" style="border-top:1px solid #1e293b;padding-top:28px;">
      <div class="udp-section-label">Zdravotní dokumenty</div>
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px;">
        Krevní výsledky, Holter, EKG, zpráva od lékaře nebo DEXA scan.<br>
        Claude dokument analyzuje a výsledky se promítnou do tvých uzlů.
      </p>
      <div id="doc-dropzone" style="border:2px dashed #334155;border-radius:12px;padding:28px 16px;
        text-align:center;cursor:pointer;transition:border-color 0.2s;">
        <div style="font-size:28px;margin-bottom:8px;">🔬</div>
        <div style="color:#94a3b8;font-size:14px;">Přetáhni nebo klikni pro výběr</div>
        <div style="color:#475569;font-size:12px;margin-top:4px;">JPG, PNG, PDF · max 3,5 MB</div>
        <input id="doc-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" style="display:none;">
      </div>
      <div id="doc-file-info" style="display:none;margin-top:12px;padding:10px 14px;
        background:rgba(6,182,212,0.05);border:1px solid rgba(6,182,212,0.2);
        border-radius:8px;color:#94a3b8;font-size:13px;"></div>
      <div id="doc-error" style="display:none;margin-top:10px;padding:10px 14px;
        background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);
        border-radius:8px;color:#fca5a5;font-size:13px;"></div>
      <button id="doc-upload-btn" disabled style="margin-top:14px;width:100%;padding:12px;
        border-radius:10px;border:1px solid #334155;background:transparent;color:#475569;
        font-size:14px;cursor:not-allowed;transition:all 0.2s;">Analyzovat a uložit</button>
      <div id="doc-result" style="display:none;margin-top:16px;">
        <div class="udp-section-label">Výsledek analýzy</div>
        <div id="doc-result-body"></div>
      </div>
    </div>

    <!-- Integrace -->
    <div class="udp-section" style="border-top:1px solid #1e293b;padding-top:28px;">
      <div class="udp-section-label">Wearable data</div>
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px;">
        Nahraj export z Ultrahuman Ring (CSV) — CHJ načte HRV, spánek a kroky.
      </p>
      <div id="uh-dropzone" style="border:2px dashed #334155;border-radius:12px;padding:28px 16px;
        text-align:center;cursor:pointer;transition:border-color 0.2s;">
        <div style="font-size:28px;margin-bottom:8px;">💍</div>
        <div style="color:#94a3b8;font-size:14px;">Přetáhni nebo klikni pro výběr</div>
        <div style="color:#475569;font-size:12px;margin-top:4px;">CSV export z Ultrahuman Ring</div>
        <input id="uh-file-input" type="file" accept=".csv,text/csv" style="display:none;">
      </div>
      <div id="uh-file-info" style="display:none;margin-top:12px;padding:10px 14px;
        background:rgba(6,182,212,0.05);border:1px solid rgba(6,182,212,0.2);
        border-radius:8px;color:#94a3b8;font-size:13px;"></div>
      <div id="uh-error" style="display:none;margin-top:10px;padding:10px 14px;
        background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);
        border-radius:8px;color:#fca5a5;font-size:13px;"></div>
      <button id="uh-import-btn" disabled style="margin-top:14px;width:100%;padding:12px;
        border-radius:10px;border:1px solid #334155;background:transparent;color:#475569;
        font-size:14px;cursor:not-allowed;transition:all 0.2s;">Importovat data</button>
      <div id="uh-result" style="display:none;margin-top:16px;">
        <div class="udp-section-label">Výsledek importu</div>
        <div id="uh-result-body"></div>
      </div>
    </div>`;
}

function bindDataEvents() {
  bindCheckInEvents();
  bindDocumentsEvents();
  bindUltrahumanEvents();
}

function bindCheckInEvents() {
  const energieLabels = ['', 'vyčerpaný', 'unavený', 'ujde to', 'dobrý', 'nabitý'];
  const energieSlider = document.getElementById('chk-energie');
  const energieLabel  = document.getElementById('chk-energie-label');
  if (energieSlider && energieLabel) {
    energieLabel.textContent = energieLabels[energieSlider.value] || '';
    energieSlider.addEventListener('input', () => {
      energieLabel.textContent = energieLabels[energieSlider.value] || '';
    });
  }
  const spanekSlider = document.getElementById('chk-spanek');
  const spanekLabel  = document.getElementById('chk-spanek-label');
  if (spanekSlider && spanekLabel) {
    spanekLabel.textContent = spanekSlider.value + ' h';
    spanekSlider.addEventListener('input', () => { spanekLabel.textContent = spanekSlider.value + ' h'; });
  }
  const hrvSlider = document.getElementById('chk-hrv');
  const hrvLabel  = document.getElementById('chk-hrv-label');
  if (hrvSlider && hrvLabel) {
    hrvSlider.addEventListener('input', () => {
      hrvLabel.textContent = hrvSlider.value > 0 ? hrvSlider.value + ' ms' : '';
    });
  }
  document.getElementById('btn-save-checkin')?.addEventListener('click', async () => {
    const energie = parseInt(energieSlider?.value ?? 3);
    const spanek  = parseFloat(spanekSlider?.value ?? 7);
    const hrv     = parseInt(hrvSlider?.value ?? 0);
    setStatus('chk-status', 'saving');
    try {
      const res = await fetch('/api/user?action=readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, energie, spanek_hod: spanek, hrv: hrv > 0 ? hrv : null }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Chyba.');
      setStatus('chk-status', 'ok');
      setTimeout(() => closePanel(), 1200);
    } catch (err) {
      const el = document.getElementById('chk-status');
      if (el) { el.textContent = err.message; el.style.color = '#ef4444'; }
    }
  });
}

function bindDocumentsEvents() {
  const dropzone  = document.getElementById('doc-dropzone');
  const fileInput = document.getElementById('doc-file-input');
  const uploadBtn = document.getElementById('doc-upload-btn');
  const fileInfo  = document.getElementById('doc-file-info');
  const errorBox  = document.getElementById('doc-error');
  if (!dropzone) return;
  let selectedFile = null;

  const MAX_MB = 3.5;
  const ACCEPTED = ['image/jpeg','image/png','image/webp','application/pdf'];

  function selectFile(f) {
    errorBox.style.display = 'none';
    if (!ACCEPTED.includes(f.type)) { showDocError('Nepodporovaný formát. Nahraj JPG, PNG nebo PDF.'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { showDocError(`Soubor příliš velký (max ${MAX_MB} MB).`); return; }
    selectedFile = f;
    fileInfo.style.display = 'block';
    fileInfo.textContent = `📄 ${f.name} · ${(f.size/1024).toFixed(0)} KB`;
    dropzone.style.borderColor = '#06b6d4';
    enableDocBtn();
  }

  function showDocError(msg) {
    errorBox.style.display = 'block'; errorBox.textContent = msg;
    selectedFile = null; fileInfo.style.display = 'none'; disableDocBtn();
  }

  function enableDocBtn() {
    uploadBtn.disabled = false;
    uploadBtn.style.cssText = 'margin-top:14px;width:100%;padding:12px;border-radius:10px;border:1px solid rgba(6,182,212,0.4);background:rgba(6,182,212,0.08);color:#67e8f9;font-size:14px;cursor:pointer;transition:all 0.2s;';
  }

  function disableDocBtn() {
    uploadBtn.disabled = true;
    uploadBtn.style.cssText = 'margin-top:14px;width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:transparent;color:#475569;font-size:14px;cursor:not-allowed;';
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = '#06b6d4'; });
  dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = selectedFile ? '#06b6d4' : '#334155'; });
  dropzone.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) selectFile(f); });
  fileInput.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) selectFile(f); });

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile || !userId) return;
    uploadBtn.disabled = true; uploadBtn.textContent = 'Analyzuji…'; uploadBtn.style.color = '#94a3b8';
    errorBox.style.display = 'none';
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });
      const res = await fetch('/api/tools/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, fileBase64: base64, mediaType: selectedFile.type, fileName: selectedFile.name }),
      });
      const data = await res.json();
      if (!res.ok) { showDocError(`[${res.status}] ${data.error || JSON.stringify(data)}`); enableDocBtn(); uploadBtn.textContent = 'Analyzovat a uložit'; return; }
      renderDocResult(data, dropzone, fileInfo, uploadBtn, fileInput);
    } catch (e) {
      showDocError('Chyba: ' + (e?.message || String(e)));
      enableDocBtn(); uploadBtn.textContent = 'Analyzovat a uložit';
    }
  });
}

function renderDocResult(data, dropzone, fileInfo, uploadBtn, fileInput) {
  const resultBox  = document.getElementById('doc-result');
  const resultBody = document.getElementById('doc-result-body');
  resultBox.style.display = 'block';
  const stateDot   = s => s === 'RED' ? '🔴' : s === 'YELLOW' ? '🟡' : '🟢';
  const deltaColor = d => d < 0 ? '#f87171' : d > 0 ? '#4ade80' : '#64748b';
  const deltaStr   = d => d > 0 ? `+${d}` : String(d);
  const NODE_LABEL = { zdravi: 'Zdraví', telo: 'Tělo', mysl: 'Mysl', metabolicke: 'Metabolismus', vyziva: 'Výživa' };
  const nodesHtml  = (data.node_updates ?? []).map(n => `
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;">
      <span style="font-size:14px;color:#e2e8f0;">${stateDot(n.state)} ${NODE_LABEL[n.node_id] || n.node_id}</span>
      <span style="font-size:14px;color:#64748b;">${n.previous_index} → <strong style="color:#e2e8f0;">${n.new_index}</strong>
        &nbsp;<span style="color:${deltaColor(n.delta)};">${deltaStr(n.delta)}</span></span>
    </div>`).join('');
  resultBody.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;
      background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;">
      <span style="color:#4ade80;font-size:15px;">✔</span>
      <span style="color:#4ade80;font-size:13px;">${data.intro || 'Dokument uložen a zpracován'}</span>
    </div>
    ${data.conclusion ? `<div style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">${data.conclusion}</div>` : ''}
    ${nodesHtml ? `<div style="margin-bottom:4px;">${nodesHtml}</div>` : ''}
    ${data.flags?.includes('CONSULT_DOCTOR') ? `<div style="margin-top:12px;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#fca5a5;font-size:13px;">⚠ Konzultuj výsledky s lékařem.</div>` : ''}
    <button id="doc-upload-another" style="margin-top:16px;width:100%;padding:10px;border-radius:10px;border:1px solid #334155;background:transparent;color:#64748b;font-size:13px;cursor:pointer;">Nahrát další dokument</button>`;
  document.getElementById('doc-upload-another')?.addEventListener('click', () => {
    resultBox.style.display = 'none'; fileInfo.style.display = 'none';
    dropzone.style.borderColor = '#334155'; uploadBtn.disabled = true;
    uploadBtn.textContent = 'Analyzovat a uložit'; fileInput.value = '';
  });
  uploadBtn.disabled = false; uploadBtn.textContent = 'Analyzovat a uložit';
}

function bindUltrahumanEvents() {
  const dropzone  = document.getElementById('uh-dropzone');
  const fileInput = document.getElementById('uh-file-input');
  const importBtn = document.getElementById('uh-import-btn');
  const fileInfo  = document.getElementById('uh-file-info');
  const errorBox  = document.getElementById('uh-error');
  if (!dropzone) return;
  let selectedFile = null;

  function enableBtn() {
    importBtn.disabled = false;
    importBtn.style.cssText = 'margin-top:14px;width:100%;padding:12px;border-radius:10px;border:1px solid rgba(6,182,212,0.4);background:rgba(6,182,212,0.08);color:#67e8f9;font-size:14px;cursor:pointer;';
  }

  function disableBtn() {
    importBtn.disabled = true;
    importBtn.style.cssText = 'margin-top:14px;width:100%;padding:12px;border-radius:10px;border:1px solid #334155;background:transparent;color:#475569;font-size:14px;cursor:not-allowed;';
  }

  function showErr(msg) {
    errorBox.style.display = 'block'; errorBox.textContent = msg;
    selectedFile = null; fileInfo.style.display = 'none'; disableBtn();
  }

  function selectFile(f) {
    errorBox.style.display = 'none';
    if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') { showErr('Nahraj CSV soubor.'); return; }
    if (f.size > 5 * 1024 * 1024) { showErr('Soubor je příliš velký (max 5 MB).'); return; }
    selectedFile = f;
    fileInfo.style.display = 'block';
    fileInfo.textContent = `📄 ${f.name} · ${(f.size/1024).toFixed(0)} KB`;
    dropzone.style.borderColor = '#06b6d4'; enableBtn();
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = '#06b6d4'; });
  dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = selectedFile ? '#06b6d4' : '#334155'; });
  dropzone.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) selectFile(f); });
  fileInput.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) selectFile(f); });

  importBtn.addEventListener('click', async () => {
    if (!selectedFile || !userId) return;
    importBtn.disabled = true; importBtn.textContent = 'Importuji…'; importBtn.style.color = '#94a3b8';
    try {
      const csvText = await selectedFile.text();
      const res = await fetch('/api/tools/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, csvText, source: 'ultrahuman' }),
      });
      const data = await res.json();
      if (!res.ok) { showErr(`Chyba: ${data.error || JSON.stringify(data)}`); enableBtn(); importBtn.textContent = 'Importovat data'; return; }
      const resultBox  = document.getElementById('uh-result');
      const resultBody = document.getElementById('uh-result-body');
      resultBox.style.display = 'block';
      const stateDot   = s => s === 'RED' ? '🔴' : s === 'YELLOW' ? '🟡' : '🟢';
      const stateColor = s => s === 'RED' ? '#f87171' : s === 'YELLOW' ? '#fbbf24' : '#4ade80';
      resultBody.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;">
          <span style="color:#4ade80;">✔</span>
          <span style="color:#4ade80;font-size:13px;">Importováno ${data.days_imported} dní · uzly aktualizovány</span>
        </div>
        ${(data.nodes_updated || []).map(n => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;">
            <span style="font-size:14px;color:#e2e8f0;">${stateDot(n.state)} ${n.label}</span>
            <span style="font-size:14px;color:${stateColor(n.state)};font-weight:600;">${n.index}</span>
          </div>`).join('')}`;
      if (typeof window.refreshUniverseData === 'function') window.refreshUniverseData();
    } catch (e) {
      showErr('Chyba: ' + (e?.message || String(e)));
      enableBtn(); importBtn.textContent = 'Importovat data';
    }
  });
}

// ─── Bind events per tab ───────────────────────────
function bindTabEvents(tab) {
  document.querySelectorAll('.udp-tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  document.getElementById('udp-close')?.addEventListener('click', closePanel);
  document.getElementById('userDataModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closePanel();
  });
  switch (tab) {
    case 'zdravi':      bindZdraviEvents();      break;
    case 'kondice':     bindKondiceEvents();     break;
    case 'profile':     bindProfilEvents();      break;
    case 'aspirations': bindAspirationsEvents(); break;
    case 'data':        bindDataEvents();        break;
  }
}

// ─── Status helper ─────────────────────────────────
function setStatus(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  const map = { saving: ['⏳ Ukládám…', '#94a3b8'], ok: ['✓ Uloženo', '#22c55e'], error: ['✗ Chyba', '#ef4444'] };
  const [text, color] = map[state] ?? ['', '#94a3b8'];
  el.textContent = text; el.style.color = color;
  if (state === 'ok') setTimeout(() => { el.textContent = ''; }, 3000);
}

function esc(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ─── Shared helpers ────────────────────────────────
function renderMedRow(i, med = {}) {
  return `
    <div class="udp-injury-row" data-med-idx="${i}">
      <input class="udp-input med-name" placeholder="Název (např. Pradaxa)"
             value="${esc(med.name ?? '')}" style="flex:2;">
      <input class="udp-input med-dose" placeholder="Dávka (např. 110 mg 2×)"
             value="${esc(med.dose ?? '')}" style="flex:2;">
      <button class="udp-del-btn" data-med-idx="${i}" title="Odstranit">✕</button>
    </div>`;
}

function renderSuppRow(i, supp = {}) {
  const name = typeof supp === 'string' ? supp : (supp.name ?? '');
  const dose  = typeof supp === 'string' ? ''   : (supp.dose ?? '');
  return `
    <div class="udp-injury-row" data-supp-idx="${i}">
      <input class="udp-input supp-name" placeholder="Název (např. Omega-3)"
             value="${esc(name)}" style="flex:2;">
      <input class="udp-input supp-dose" placeholder="Dávka (např. 500 mg)"
             value="${esc(dose)}" style="flex:2;">
      <button class="udp-del-btn" data-supp-idx="${i}" title="Odstranit">✕</button>
    </div>`;
}

// ─── Init — inject styles + modal HTML ────────────
export function initUserDataPanel() {
  const style = document.createElement('style');
  style.textContent = `
    .udp-hidden { display: none !important; }
    @keyframes udp-fadein { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
    #userDataModal {
      position:fixed;inset:0;z-index:10100;
      background:rgba(2,6,23,0.85);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;
      padding:16px;box-sizing:border-box;
    }
    #userDataModal:not(.udp-hidden) .udp-panel { animation:udp-fadein 0.18s ease; }
    .udp-panel {
      background:#0f172a;border:1px solid #1e293b;
      border-radius:16px;width:100%;max-width:760px;
      max-height:90vh;display:flex;flex-direction:column;
      overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.7);
    }
    .udp-header { display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0;flex-shrink:0; }
    .udp-title { color:#f8fafc;font-size:18px;font-weight:700;margin:0; }
    .udp-close-btn { background:none;border:none;color:#475569;font-size:20px;cursor:pointer;padding:4px 8px;border-radius:6px;line-height:1; }
    .udp-close-btn:hover { color:#94a3b8;background:rgba(255,255,255,0.05); }
    .udp-tabs { display:flex;gap:0;padding:12px 20px 0;border-bottom:1px solid #1e293b;flex-shrink:0;overflow-x:auto;scrollbar-width:none; }
    .udp-tabs::-webkit-scrollbar { display:none; }
    .udp-tab { background:none;border:none;border-bottom:2px solid transparent;color:#64748b;font-size:13px;font-weight:600;padding:8px 14px 12px;cursor:pointer;white-space:nowrap;letter-spacing:0.3px;transition:color 0.15s,border-color 0.15s; }
    .udp-tab:hover { color:#94a3b8; }
    #udp-body { flex:1;overflow-y:auto;padding:28px; }
    .udp-section { margin-bottom:28px; }
    .udp-section-label { color:#64748b;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:12px; }
    .udp-field-label { color:#64748b;font-size:13px;margin-bottom:7px;font-weight:500; }
    .udp-input { background:rgba(255,255,255,0.06);border:1px solid #1e293b;border-radius:8px;color:#e2e8f0;font-size:15px;padding:11px 14px;outline:none;box-sizing:border-box;transition:border-color 0.15s; }
    .udp-input:focus { border-color:#06b6d4; }
    .udp-select { padding:10px 8px;font-size:14px;cursor:pointer;background:rgba(255,255,255,0.06);border:1px solid #1e293b;border-radius:8px;color:#e2e8f0; }
    .udp-mini { width:100%; }
    .udp-injury-row { display:flex;gap:8px;align-items:center;margin-bottom:10px; }
    .udp-injury-row .udp-input { flex:1; }
    .udp-del-btn { background:none;border:none;color:#475569;font-size:16px;cursor:pointer;padding:6px 8px;border-radius:6px;flex-shrink:0; }
    .udp-del-btn:hover { color:#ef4444;background:rgba(239,68,68,0.1); }
    .udp-add-btn { background:none;border:1px dashed #334155;border-radius:8px;color:#475569;font-size:13px;padding:10px 16px;cursor:pointer;width:100%;margin-top:4px; }
    .udp-add-btn:hover { border-color:#06b6d4;color:#06b6d4; }
    .udp-row-4 { display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:start; }
    @media (max-width:500px) { .udp-row-4 { grid-template-columns:1fr 1fr; } }
    .udp-gender-row { display:flex;gap:6px; }
    .udp-gender-btn { flex:1;padding:9px 0;border-radius:8px;font-size:13px;font-weight:600;border:1px solid #1e293b;background:rgba(255,255,255,0.04);color:#64748b;cursor:pointer;transition:all 0.15s; }
    .udp-gender-btn.active { border-color:#06b6d4;background:rgba(6,182,212,0.12);color:#06b6d4; }
    .udp-toggle { width:44px;height:24px;border-radius:12px;background:#1e293b;border:none;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0; }
    .udp-toggle.udp-toggle-on { background:#06b6d4; }
    .udp-toggle-thumb { position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 0.2s;pointer-events:none; }
    .udp-toggle.udp-toggle-on .udp-toggle-thumb { transform:translateX(20px); }
    .udp-yn-row { display:flex;gap:6px; }
    .udp-yn-btn { padding:7px 16px;border-radius:8px;font-size:13px;font-weight:600;border:1px solid #1e293b;background:rgba(255,255,255,0.04);color:#64748b;cursor:pointer;transition:all 0.15s; }
    .udp-yn-yes { border-color:#22c55e;background:rgba(34,197,94,0.12);color:#22c55e; }
    .udp-yn-no  { border-color:#ef4444;background:rgba(239,68,68,0.12);color:#ef4444; }
    .udp-save-row { display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-top:8px;padding-top:16px;border-top:1px solid #1e293b; }
    .udp-status { font-size:13px; }
    .udp-save-btn { padding:10px 24px;background:#06b6d4;border:none;border-radius:8px;color:#0f172a;font-size:14px;font-weight:700;cursor:pointer; }
    .udp-save-btn:hover { background:#22d3ee; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'userDataModal';
  modal.className = 'udp-hidden';
  modal.innerHTML = `
    <div class="udp-panel">
      <div class="udp-header">
        <h2 class="udp-title">Vstupní data</h2>
        <button id="udp-close" class="udp-close-btn">✕</button>
      </div>
      <div class="udp-tabs">
        <button class="udp-tab" data-tab="zdravi">Zdraví</button>
        <button class="udp-tab" data-tab="kondice">Kondice</button>
        <button class="udp-tab" data-tab="profile">Profil</button>
        <button class="udp-tab" data-tab="aspirations">Sen</button>
        <button class="udp-tab" data-tab="data">Data</button>
      </div>
      <div id="udp-body"></div>
    </div>`;
  document.body.appendChild(modal);

  activeTab = 'zdravi';
  setTimeout(() => switchTab(activeTab), 0);
}

// ─── Open directly on check-in (ranní výzva) ──────
export function openCheckInTab() {
  userId = window.firebaseAuth?.currentUser?.uid;
  if (!userId) return;
  const modal = document.getElementById('userDataModal');
  if (!modal) return;
  modal.classList.remove('udp-hidden');
  activeTab = 'data';
  loadAndRender();
}

window.openCheckInTab = openCheckInTab;
