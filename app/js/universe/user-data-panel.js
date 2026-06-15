// =====================================================
// USER DATA PANEL – Vstupní data (tabbed, editable)
// Tabs: Fyzické limity | Biologický cíl | Pas
// =====================================================

import { supabase } from './supabaseClient.js';

// ─── State ────────────────────────────────────────
let activeTab   = 'profile';
let cachedData  = null;   // { profile, constraints, aspiration, aspirationOptions }
let userId      = null;

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

  const [profileRes, constraintsRes, decathlonRes, integrationsRes, healthRes, medsRes] = await Promise.all([
    supabase.from('user_profiles').select('age, gender, height, weight, birth_year').eq('user_id', userId).maybeSingle(),
    supabase.from('user_constraints').select('constraint_type, constraint_key, constraint_value, severity').eq('user_id', userId),
    supabase.from('user_decathlon').select('goal_key, label').eq('user_id', userId).eq('active', true).maybeSingle(),
    supabase.from('user_integrations').select('service, enabled').eq('user_id', userId),
    supabase.from('user_health_profile').select('diagnoses, symptoms, family_history, supplements').eq('user_id', userId).maybeSingle(),
    supabase.from('user_medications').select('name, dose, active').eq('user_id', userId).eq('active', true)
  ]);

  cachedData = {
    profile:      profileRes.data      ?? {},
    constraints:  constraintsRes.data  ?? [],
    decathlon:    decathlonRes.data    ?? {},
    integrations: integrationsRes.data ?? [],
    diagnoses:      healthRes.data?.diagnoses      ?? [],
    symptoms:       healthRes.data?.symptoms       ?? [],
    family_history: healthRes.data?.family_history ?? '',
    supplements:    healthRes.data?.supplements    ?? [],
    medications:    medsRes.data ?? [],
  };

  renderTab(activeTab);
}

// ─── Skeleton ──────────────────────────────────────
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

// ─── Render dispatcher ─────────────────────────────
function renderTab(tab) {
  const body = document.getElementById('udp-body');
  if (!body || !cachedData) return;
  switch (tab) {
    case 'profile':      body.innerHTML = renderProfileMainTab();   break;
    case 'constraints':  body.innerHTML = renderConstraintsTab();   break;
    case 'aspirations':  body.innerHTML = renderAspirationsTab();   break;
    case 'vitality':     body.innerHTML = renderVitalityTab();      break;
    case 'checkin':      body.innerHTML = renderCheckInTab();       break;
    case 'zdravi':       body.innerHTML = renderZdraviTab();        break;
    case 'documents':    body.innerHTML = renderDocumentsTab();     break;
    case 'integrations': body.innerHTML = renderIntegrationsTab();  break;
  }
  bindTabEvents(tab);
}

// ═══════════════════════════════════════════════════
// TAB 1 – Fyzické limity
// Stored as: type='injury', key='injury_N', value=JSON{location,restriction}, severity
// ═══════════════════════════════════════════════════

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

function renderConstraintsTab() {
  const injuries = getInjuries();
  const rows = injuries.length
    ? injuries.map((inj, i) => renderInjuryRow(i, inj)).join('')
    : `<p style="color:#475569;font-size:14px;padding:8px 0;">Žádné omezení.</p>`;

  return `
    <div class="udp-section">
      <div class="udp-section-label">Lokalizace a typ omezení</div>
      <div id="injury-rows">${rows}</div>
      <button id="btn-add-injury" class="udp-add-btn">+ Přidat omezení</button>
    </div>
    <div class="udp-save-row">
      <span id="udp-status-1" class="udp-status"></span>
      <button id="btn-save-constraints" class="udp-save-btn">Uložit</button>
    </div>`;
}

function renderInjuryRow(i, inj = {}) {
  return `
    <div class="udp-injury-row" data-idx="${i}">
      <input class="udp-input inj-location" placeholder="Lokalizace (např. Levý kotník – po operaci)"
             value="${esc(inj.location ?? '')}" style="flex:2;">
      <input class="udp-input inj-restriction" placeholder="Typ omezení (např. Nesmím rotace)"
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

function bindConstraintsEvents() {
  document.getElementById('btn-add-injury')?.addEventListener('click', () => {
    const container = document.getElementById('injury-rows');
    const idx = container.querySelectorAll('.udp-injury-row').length;
    const emptyP = container.querySelector('p');
    if (emptyP) emptyP.remove();
    container.insertAdjacentHTML('beforeend', renderInjuryRow(idx));
    bindDelButtons();
  });
  bindDelButtons();

  document.getElementById('btn-save-constraints')?.addEventListener('click', saveConstraints);
}

function bindDelButtons() {
  document.querySelectorAll('.udp-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.udp-injury-row').remove();
      // Re-index
      document.querySelectorAll('.udp-injury-row').forEach((row, i) => row.dataset.idx = i);
      if (!document.querySelector('.udp-injury-row')) {
        document.getElementById('injury-rows').innerHTML =
          `<p style="color:#475569;font-size:14px;padding:8px 0;">Žádné omezení.</p>`;
      }
    });
  });
}

async function saveConstraints() {
  setStatus('udp-status-1', 'saving');
  const rows = [...document.querySelectorAll('.udp-injury-row')].map(row => ({
    location:    row.querySelector('.inj-location').value.trim(),
    restriction: row.querySelector('.inj-restriction').value.trim(),
    severity:    row.querySelector('.inj-severity').value
  })).filter(r => r.location || r.restriction);

  try {
    // Delete all existing injuries for user
    await supabase.from('user_constraints')
      .delete()
      .eq('user_id', userId)
      .eq('constraint_type', 'injury');

    // Re-insert
    for (let i = 0; i < rows.length; i++) {
      const { error } = await supabase.from('user_constraints').insert({
        user_id: userId,
        constraint_type: 'injury',
        constraint_key:  `injury_${i}`,
        constraint_value: JSON.stringify({ location: rows[i].location, restriction: rows[i].restriction }),
        severity: rows[i].severity
      });
      if (error) throw error;
    }

    // Refresh cache
    const { data } = await supabase.from('user_constraints').select('*').eq('user_id', userId);
    cachedData.constraints = data ?? [];
    setStatus('udp-status-1', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('udp-status-1', 'error');
  }
}

// ═══════════════════════════════════════════════════
// TAB 2 – Biologický cíl
// ── Decathlon goals definition ─────────────────────
const DECATHLON_GOALS = [
  { key: 'plavani',  icon: '🏊', label: 'Uplavat 0,5 km',         desc: 'V bazénu nebo v jezeře, bez přestávky.',        pillar_weights: { kardio: 0.4, sila: 0.3, stabilita: 0.2, vo2max: 0.1 } },
  { key: 'bezky',    icon: '🎿', label: 'Projet na běžkách 5 km',  desc: 'Klasicky nebo bruslením, vlastním tempem.',     pillar_weights: { vo2max: 0.4, vytrvalost: 0.3, sila: 0.2, stabilita: 0.1 } },
  { key: 'kolo',     icon: '🚴', label: 'Jet 2 hodiny na kole',    desc: 'Silnice nebo les, bez nutnosti zastavit.',      pillar_weights: { vo2max: 0.35, vytrvalost: 0.35, sila: 0.2, stabilita: 0.1 } },
  { key: 'hora',     icon: '🏔️', label: 'Vyjít na horu',           desc: '800+ m převýšení, vlastními nohami.',           pillar_weights: { vytrvalost: 0.35, sila: 0.35, stabilita: 0.2, vo2max: 0.1 } },
  { key: 'tenis',    icon: '🎾', label: 'Zahrát tenis',            desc: 'Celý set, reagovat a pohybovat se po kurtu.',   pillar_weights: { stabilita: 0.3, sila: 0.3, vo2max: 0.2, vytrvalost: 0.2 } },
  { key: 'vnoucata', icon: '👶', label: 'Hrát si s vnoučaty',      desc: 'Sedat na zem, vstávat, nosit, honit se.',       pillar_weights: { stabilita: 0.35, sila: 0.3, mobilita: 0.25, vo2max: 0.1 } },
  { key: 'chuze',    icon: '🚶', label: 'Ujít 5 km v pohodě',      desc: 'Procházka přírodou, bez únavy a bolesti.',      pillar_weights: { stabilita: 0.35, vytrvalost: 0.35, sila: 0.2, vo2max: 0.1 } },
  { key: 'sila',     icon: '💪', label: 'Ovládat vlastní tělo',    desc: 'Dřep, shyb, klik — silné a mobilní tělo.',     pillar_weights: { sila: 0.5, stabilita: 0.3, mobilita: 0.2 } },
];

// ═══════════════════════════════════════════════════
// TAB 2 – Sen (user_decathlon)
// ═══════════════════════════════════════════════════

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
        <input id="asp-target-age" type="number" min="50" max="105" value="${cachedData.decathlon?.target_age ?? 85}"
          style="width:52px;font-size:18px;font-weight:700;text-align:center;
                 background:transparent;border:none;border-bottom:2px solid #06b6d4;
                 color:#06b6d4;outline:none;padding:0 2px;">. narozeninám?
      </h3>
      <p style="color:#64748b;font-size:13px;margin-bottom:20px;font-style:italic;">CHJ přizpůsobí plán tak, aby ses k němu dostal.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${cards}
      </div>
    </div>

    <div class="udp-save-row">
      <span id="udp-status-2" class="udp-status"></span>
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
  if (!selected) {
    setStatus('udp-status-2', 'error');
    return;
  }
  const goalKey = selected.dataset.key;
  const goal = DECATHLON_GOALS.find(g => g.key === goalKey);
  if (!goal) return;

  const targetAge = parseInt(document.getElementById('asp-target-age')?.value) || 85;

  setStatus('udp-status-2', 'saving');
  try {
    // Deactivate existing, then insert new
    await supabase.from('user_decathlon').update({ active: false }).eq('user_id', userId);
    const { error } = await supabase.from('user_decathlon').insert({
      user_id:        userId,
      goal_key:       goal.key,
      label:          goal.label,
      target_age:     targetAge,
      priority:       5,
      pillar_weights: goal.pillar_weights,
      active:         true,
    });
    if (error) throw error;

    cachedData.decathlon = { goal_key: goal.key, label: goal.label, target_age: targetAge };
    setStatus('udp-status-2', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('udp-status-2', 'error');
  }
}

// ═══════════════════════════════════════════════════
// TAB 3 – Technický a biologický pas
// age, gender, height, weight → user_profiles
// connectivity → user_constraints type='connectivity'
// ═══════════════════════════════════════════════════

const CONNECTORS = [
  { key: 'apple_health', label: '🍎 Apple Health' },
  { key: 'oura',         label: '💍 Oura Ring' },
  { key: 'garmin',       label: '⌚ Garmin' },
  { key: 'dexcom',       label: '📡 Dexcom' }
];

function getConnectivity(key) {
  return (cachedData.integrations ?? []).find(i => i.service === key)?.enabled === true;
}

function renderProfileMainTab() {
  const p = cachedData.profile ?? {};
  const genderM = (p.gender === 'male');
  const genderF = (p.gender === 'female');
  const birthYear = p.birth_year ?? '';
  const calcAge = birthYear ? (new Date().getFullYear() - birthYear) : '';

  return `
    <div class="udp-section">
      <div class="udp-section-label">Základní údaje</div>
      <div class="udp-row-4">
        <div>
          <div class="udp-field-label">Rok narození</div>
          <input id="prof-birth-year" type="number" class="udp-input udp-mini" placeholder="1957"
                 min="1920" max="2010" value="${esc(birthYear)}">
          ${calcAge ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px;">${calcAge} let</div>` : ''}
        </div>
        <div>
          <div class="udp-field-label">Výška (cm)</div>
          <input id="prof-height" type="number" class="udp-input udp-mini" placeholder="178"
                 min="140" max="220" value="${esc(p.height ?? '')}">
        </div>
        <div>
          <div class="udp-field-label">Váha (kg)</div>
          <input id="prof-weight" type="number" class="udp-input udp-mini" placeholder="80"
                 min="40" max="200" value="${esc(p.weight ?? '')}">
        </div>
        <div>
          <div class="udp-field-label">Pohlaví</div>
          <div class="udp-gender-row">
            <button class="udp-gender-btn ${genderM ? 'active' : ''}" data-gender="male">Muž</button>
            <button class="udp-gender-btn ${genderF ? 'active' : ''}" data-gender="female">Žena</button>
          </div>
        </div>
      </div>
    </div>

    <div class="udp-save-row">
      <span id="udp-status-3" class="udp-status"></span>
      <button id="btn-save-profile" class="udp-save-btn">Uložit</button>
    </div>`;
}

// ═══════════════════════════════════════════════════
// TAB 5 – Ranní check-in (energie, spánek, HRV)
// ═══════════════════════════════════════════════════

function renderCheckInTab() {
  return `
    <div class="udp-section">

      <!-- ENERGIE slider -->
      <div style="font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">ENERGIE</div>
      <p style="color:#64748b;font-size:13px;margin-bottom:16px;font-style:italic;">Vyčerpaný=1, Ujde to=3, Nabitý=5</p>
      <div style="margin-bottom:32px;">
        <input id="chk-energie" type="range" min="1" max="5" step="1" value="3"
          style="width:100%;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
                 background:linear-gradient(to right,#ef4444 0%,#eab308 50%,#22c55e 100%);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="color:#64748b;font-size:13px;">Vyčerpaný</span>
          <span id="chk-energie-label" style="color:#06b6d4;font-size:22px;font-weight:600;">ujde</span>
          <span style="color:#64748b;font-size:13px;">Nabitý</span>
        </div>
      </div>

      <!-- SPÁNEK slider -->
      <div style="font-family:monospace;font-size:12px;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">SPÁNEK</div>
      <p style="color:#64748b;font-size:13px;margin-bottom:16px;font-style:italic;">Méně než 5 h=nízko, 7–8 h=ideál, 10+ h=přespáno</p>
      <div style="margin-bottom:32px;">
        <input id="chk-spanek" type="range" min="0" max="12" step="0.5" value="7"
          style="width:100%;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
                 background:linear-gradient(to right,#1e3a5f 0%,#06b6d4 58%,#0e7490 100%);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="color:#64748b;font-size:13px;">0 h</span>
          <span id="chk-spanek-label" style="color:#06b6d4;font-size:22px;font-weight:600;">7 h</span>
          <span style="color:#64748b;font-size:13px;">12 h</span>
        </div>
      </div>

      <!-- HRV slider (volitelné) -->
      <h3 style="color:#2d3f52;font-size:16px;margin-bottom:6px;">HRV <span style="font-size:13px;font-weight:400;">(ms · volitelné)</span></h3>
      <p style="color:#1e2d3d;font-size:13px;margin-bottom:16px;font-style:italic;">Nech vlevo pokud nemáš wearable</p>
      <div style="margin-bottom:16px;">
        <input id="chk-hrv" type="range" min="0" max="120" step="1" value="0"
          style="width:100%;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;cursor:pointer;
                 background:linear-gradient(to right,#1e293b 0%,#334155 100%);opacity:0.5;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
          <span style="color:#334155;font-size:13px;">—</span>
          <span id="chk-hrv-label" style="color:#475569;font-size:22px;font-weight:600;"></span>
          <span style="color:#334155;font-size:13px;">120 ms</span>
        </div>
      </div>

    </div>

    <div class="udp-save-row">
      <span id="chk-status" class="udp-status"></span>
      <button id="btn-save-checkin" class="udp-save-btn">Uložit a zavřít</button>
    </div>`;
}

function bindCheckInEvents() {
  const energieLabels = ['', 'vyčerpaný', 'unavený', 'ujde to', 'dobrý', 'nabitý'];

  // Energie slider
  const energieSlider = document.getElementById('chk-energie');
  const energieLabel  = document.getElementById('chk-energie-label');
  if (energieSlider && energieLabel) {
    energieLabel.textContent = energieLabels[energieSlider.value] || '';
    energieSlider.addEventListener('input', () => {
      energieLabel.textContent = energieLabels[energieSlider.value] || '';
    });
  }

  // Spánek slider
  const spanekSlider = document.getElementById('chk-spanek');
  const spanekLabel  = document.getElementById('chk-spanek-label');
  if (spanekSlider && spanekLabel) {
    spanekLabel.textContent = spanekSlider.value + ' h';
    spanekSlider.addEventListener('input', () => {
      spanekLabel.textContent = spanekSlider.value + ' h';
    });
  }

  // HRV slider (0 = not set)
  const hrvSlider = document.getElementById('chk-hrv');
  const hrvLabel  = document.getElementById('chk-hrv-label');
  if (hrvSlider && hrvLabel) {
    hrvLabel.textContent = '';
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
        body: JSON.stringify({
          userId: userId,
          energie,
          spanek_hod: spanek,
          hrv: hrv > 0 ? hrv : null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Chyba.');
      setStatus('chk-status', 'ok');
      setTimeout(() => closePanel(), 1200);
    } catch (err) {
      const status = document.getElementById('chk-status');
      if (status) { status.textContent = err.message; status.style.color = '#ef4444'; }
    }
  });
}

// ═══════════════════════════════════════════════════
// TAB 4 – Vitalita (spustí přeměření)
// ═══════════════════════════════════════════════════
function renderVitalityTab() {
  return `
    <div class="udp-section" style="text-align:center; padding:30px 20px;">
      <div style="font-size:40px; margin-bottom:16px;">⚡</div>
      <div style="color:#e2e8f0; font-size:16px; margin-bottom:8px;">Přeměř svou vitalitu</div>
      <div style="color:#94a3b8; font-size:14px; margin-bottom:24px; line-height:1.6;">
        Projdeš 11 otázek o svém zdraví a kondici.<br>
        Výsledek přepočítá barvy uzlů a bio-věk.
      </div>
      <button id="btn-start-vitality" class="udp-save-btn" style="font-size:16px; padding:14px 32px;">
        Začít měření
      </button>
    </div>`;
}

function bindProfileMainEvents() {
  // Gender buttons
  document.querySelectorAll('.udp-gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.udp-gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('btn-save-profile')?.addEventListener('click', saveProfile);
}

function bindVitalityEvents() {
  document.getElementById('btn-start-vitality')?.addEventListener('click', () => {
    closePanel();
    if (typeof window.startOnboarding === 'function') {
      window.startOnboarding();
    }
  });
}

async function saveProfile() {
  setStatus('udp-status-3', 'saving');
  const birthYear = parseInt(document.getElementById('prof-birth-year')?.value) || null;
  const height = parseInt(document.getElementById('prof-height').value) || null;
  const weight = parseInt(document.getElementById('prof-weight').value) || null;
  const gender = document.querySelector('.udp-gender-btn.active')?.dataset.gender ?? null;

  // Calculate age from birth_year
  const age = birthYear ? (new Date().getFullYear() - birthYear) : null;

  try {
    // user_profiles upsert
    const profileData = { user_id: userId };
    if (birthYear !== null) profileData.birth_year = birthYear;
    if (age !== null)    profileData.age    = age;
    if (gender)          profileData.gender = gender;
    if (height !== null) profileData.height = height;
    if (weight !== null) profileData.weight = weight;

    const { error: pe } = await supabase.from('user_profiles')
      .upsert(profileData, { onConflict: 'user_id' });
    if (pe) console.warn('profile upsert:', pe.message);

    // Refresh cache
    const { data: freshProfile } = await supabase
      .from('user_profiles')
      .select('age, gender, height, weight, birth_year')
      .eq('user_id', userId)
      .maybeSingle();
    cachedData.profile = freshProfile ?? {};
    setStatus('udp-status-3', 'ok');
  } catch (e) {
    console.error(e);
    setStatus('udp-status-3', 'error');
  }
}

// ─── Bind events per tab ───────────────────────────
function bindTabEvents(tab) {
  // Tab buttons
  document.querySelectorAll('.udp-tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  // Close
  document.getElementById('udp-close')?.addEventListener('click', closePanel);
  document.getElementById('userDataModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePanel();
  });
  // Tab-specific
  switch (tab) {
    case 'profile':      bindProfileMainEvents();    break;
    case 'constraints':  bindConstraintsEvents();    break;
    case 'aspirations':  bindAspirationsEvents();    break;
    case 'vitality':     bindVitalityEvents();       break;
    case 'checkin':      bindCheckInEvents();        break;
    case 'zdravi':       bindZdraviEvents();         break;
    case 'documents':    bindDocumentsEvents();      break;
    case 'integrations': bindIntegrationsEvents();   break;
  }
}

// ─── Status helper ─────────────────────────────────
function setStatus(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  const map = {
    saving: ['⏳ Ukládám…', '#94a3b8'],
    ok:     ['✓ Uloženo',   '#22c55e'],
    error:  ['✗ Chyba',     '#ef4444']
  };
  const [text, color] = map[state] ?? ['', '#94a3b8'];
  el.textContent = text;
  el.style.color = color;
  if (state === 'ok') setTimeout(() => { el.textContent = ''; }, 3000);
}

// ─── Escape helper ─────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ─── Inject styles + modal HTML on load ───────────
export function initUserDataPanel() {
  // Styles
  const style = document.createElement('style');
  style.textContent = `
    .udp-hidden { display: none !important; }
    @keyframes udp-fadein { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }
    #userDataModal {
      position: fixed; inset: 0; z-index: 10100;
      background: rgba(2,6,23,0.85); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    }
    #userDataModal:not(.udp-hidden) .udp-panel { animation: udp-fadein 0.18s ease; }
    .udp-panel {
      background: #0f172a; border: 1px solid #1e293b;
      border-radius: 16px; width: 100%; max-width: 760px;
      max-height: 90vh; display: flex; flex-direction: column;
      overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.7);
    }
    .udp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 0; flex-shrink: 0;
    }
    .udp-title { color: #f8fafc; font-size: 18px; font-weight: 700; margin: 0; }
    .udp-close-btn {
      background: none; border: none; color: #475569; font-size: 20px;
      cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1;
    }
    .udp-close-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.05); }
    .udp-tabs {
      display: flex; gap: 0; padding: 12px 20px 0; border-bottom: 1px solid #1e293b;
      flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
    }
    .udp-tabs::-webkit-scrollbar { display: none; }
    .udp-tab {
      background: none; border: none; border-bottom: 2px solid transparent;
      color: #64748b; font-size: 13px; font-weight: 600; padding: 8px 14px 12px;
      cursor: pointer; white-space: nowrap; letter-spacing: 0.3px;
      transition: color 0.15s, border-color 0.15s;
    }
    .udp-tab:hover { color: #94a3b8; }
    #udp-body { flex: 1; overflow-y: auto; padding: 28px; }
    .udp-section { margin-bottom: 28px; }
    .udp-section-label {
      color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: 0.8px;
      text-transform: uppercase; margin-bottom: 12px;
    }
    .udp-field-label { color: #64748b; font-size: 13px; margin-bottom: 7px; font-weight: 500; }
    .udp-input {
      background: rgba(255,255,255,0.06); border: 1px solid #1e293b;
      border-radius: 8px; color: #e2e8f0; font-size: 15px;
      padding: 11px 14px; outline: none; box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .udp-input:focus { border-color: #06b6d4; }
    .udp-select { padding: 10px 8px; font-size: 14px; cursor: pointer; }
    .udp-select-full { width: 100%; }
    .udp-mini { width: 100%; }
    .udp-injury-row {
      display: flex; gap: 8px; align-items: center; margin-bottom: 10px;
    }
    .udp-injury-row .udp-input { flex: 1; }
    .udp-del-btn {
      background: none; border: none; color: #475569; font-size: 16px;
      cursor: pointer; padding: 6px 8px; border-radius: 6px; flex-shrink: 0;
    }
    .udp-del-btn:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
    .udp-add-btn {
      background: none; border: 1px dashed #334155; border-radius: 8px;
      color: #475569; font-size: 13px; padding: 10px 16px;
      cursor: pointer; width: 100%; margin-top: 4px;
    }
    .udp-add-btn:hover { border-color: #06b6d4; color: #06b6d4; }
    .udp-row-2 { display: grid; grid-template-columns: 140px 1fr; gap: 16px; align-items: start; }
    .udp-row-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 500px) {
      .udp-row-4 { grid-template-columns: 1fr 1fr; }
      .udp-row-2 { grid-template-columns: 1fr; }
    }
    .udp-gender-row { display: flex; gap: 6px; }
    .udp-gender-btn {
      flex: 1; padding: 9px 0; border-radius: 8px; font-size: 13px; font-weight: 600;
      border: 1px solid #1e293b; background: rgba(255,255,255,0.04);
      color: #64748b; cursor: pointer; transition: all 0.15s;
    }
    .udp-gender-btn.active { border-color: #06b6d4; background: rgba(6,182,212,0.12); color: #06b6d4; }
    .udp-conn-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0; border-bottom: 1px solid #1e293b;
    }
    .udp-conn-row:last-child { border-bottom: none; }
    .udp-conn-label { color: #94a3b8; font-size: 15px; font-weight: 500; }
    .udp-toggle {
      width: 44px; height: 24px; border-radius: 12px; background: #1e293b;
      border: none; cursor: pointer; position: relative; transition: background 0.2s;
      flex-shrink: 0;
    }
    .udp-toggle.udp-toggle-on { background: #06b6d4; }
    .udp-toggle-thumb {
      position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
      border-radius: 50%; background: #fff;
      transition: transform 0.2s; pointer-events: none;
    }
    .udp-toggle.udp-toggle-on .udp-toggle-thumb { transform: translateX(20px); }
    .udp-save-row {
      display: flex; align-items: center; justify-content: flex-end;
      gap: 16px; margin-top: 8px; padding-top: 16px;
      border-top: 1px solid #1e293b;
    }
    .udp-status { font-size: 13px; }
    .udp-save-btn {
      padding: 10px 24px; background: #06b6d4; border: none; border-radius: 8px;
      color: #0f172a; font-size: 14px; font-weight: 700; cursor: pointer;
    }
    .udp-save-btn:hover { background: #22d3ee; }
  `;
  document.head.appendChild(style);

  // Modal HTML
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
        <button class="udp-tab" data-tab="documents">Dokumenty</button>
        <button class="udp-tab" data-tab="profile">Profil</button>
        <button class="udp-tab" data-tab="vitality">Vitalita</button>
        <button class="udp-tab" data-tab="aspirations">Sen</button>
        <button class="udp-tab" data-tab="constraints">Omezení</button>
        <button class="udp-tab" data-tab="integrations">Integrace</button>
      </div>
      <div id="udp-body"></div>
    </div>`;
  document.body.appendChild(modal);

  // Set initial active tab style
  activeTab = 'zdravi';
  setTimeout(() => switchTab(activeTab), 0);
}

// ─── Open directly on check-in tab ─────────────────
// Called automatically in the morning when readiness is missing
export function openCheckInTab() {
  userId = window.firebaseAuth?.currentUser?.uid;
  if (!userId) return;
  const modal = document.getElementById('userDataModal');
  if (!modal) return;
  modal.classList.remove('udp-hidden');
  activeTab = 'profile';
  loadAndRender();
}

window.openCheckInTab = openCheckInTab;

// ═══════════════════════════════════════════════════
// TAB: Zdraví — Diagnózy + Léky
// ═══════════════════════════════════════════════════

function renderZdraviTab() {
  const diagnoses    = (cachedData.diagnoses ?? []).join('\n');
  const symptoms     = (cachedData.symptoms  ?? []).join('\n');
  const familyHist   = cachedData.family_history ?? '';
  const meds         = cachedData.medications  ?? [];
  const supps        = cachedData.supplements  ?? [];

  const medRows  = meds.length  ? meds.map((m, i) => renderMedRow(i, m)).join('')  : renderMedRow(0, {});
  const suppRows = supps.length ? supps.map((s, i) => renderSuppRow(i, s)).join('') : renderSuppRow(0, {});

  return `
    <div class="udp-section">
      <div class="udp-section-label">Diagnózy</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Každá diagnóza na nový řádek. Neznáš přesný název? Napiš jak to popisuje lékař — AI doplní.
      </p>
      <textarea id="zdravi-diagnoses" rows="3" class="udp-input" style="width:100%;resize:vertical;font-family:inherit;"
        placeholder="např. Fibrilace síní&#10;Hypertenze&#10;Vysoký LDL">${esc(diagnoses)}</textarea>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Symptomy</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Co tě pravidelně trápí — bolest, únava, dušnost, závratě... Každý symptom na řádek.
      </p>
      <textarea id="zdravi-symptoms" rows="3" class="udp-input" style="width:100%;resize:vertical;font-family:inherit;"
        placeholder="např. Únava po obědě&#10;Noční pocení&#10;Bušení srdce">${esc(symptoms)}</textarea>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Rodinná anamnéza</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Nemoci rodičů nebo sourozenců — kardio, cukrovka, rakovina, demence...
      </p>
      <textarea id="zdravi-family" rows="3" class="udp-input" style="width:100%;resize:vertical;font-family:inherit;"
        placeholder="např. Otec: infarkt v 65, cukrovka 2. typu&#10;Matka: rakovina prsu">${esc(familyHist)}</textarea>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Léky</div>
      <div id="med-rows">${medRows}</div>
      <button id="btn-add-med" class="udp-add-btn">+ Přidat lék</button>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Doplňky stravy</div>
      <p style="color:#64748b;font-size:13px;margin:0 0 10px;line-height:1.5;">
        Vitamíny, minerály, omega-3, adaptogeny... každý na řádek.
      </p>
      <div id="supp-rows">${suppRows}</div>
      <button id="btn-add-supp" class="udp-add-btn">+ Přidat doplněk</button>
    </div>

    <div class="udp-save-row">
      <span id="udp-status-zdravi" class="udp-status"></span>
      <button id="btn-save-zdravi" class="udp-save-btn">Uložit</button>
    </div>`;
}

function renderSuppRow(i, supp = {}) {
  const name = typeof supp === 'string' ? supp : (supp.name ?? '');
  const dose = typeof supp === 'string' ? '' : (supp.dose ?? '');
  return `
    <div class="udp-injury-row" data-supp-idx="${i}">
      <input class="udp-input supp-name" placeholder="Název (např. Omega-3)"
             value="${esc(name)}" style="flex:2;">
      <input class="udp-input supp-dose" placeholder="Dávka (např. 500 mg)"
             value="${esc(dose)}" style="flex:2;">
      <button class="udp-del-btn" data-supp-idx="${i}" title="Odstranit">✕</button>
    </div>`;
}

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

function bindZdraviEvents() {
  document.getElementById('btn-add-med')?.addEventListener('click', () => {
    const container = document.getElementById('med-rows');
    const idx = container.querySelectorAll('.udp-injury-row').length;
    container.insertAdjacentHTML('beforeend', renderMedRow(idx));
    bindMedDelButtons();
  });
  document.getElementById('btn-add-supp')?.addEventListener('click', () => {
    const container = document.getElementById('supp-rows');
    const idx = container.querySelectorAll('.udp-injury-row').length;
    container.insertAdjacentHTML('beforeend', renderSuppRow(idx));
    bindSuppDelButtons();
  });
  bindMedDelButtons();
  bindSuppDelButtons();
  document.getElementById('btn-save-zdravi')?.addEventListener('click', saveZdravi);
}

function bindMedDelButtons() {
  document.querySelectorAll('[data-med-idx] .udp-del-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.udp-injury-row').remove());
  });
}

function bindSuppDelButtons() {
  document.querySelectorAll('[data-supp-idx] .udp-del-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.udp-injury-row').remove());
  });
}

async function saveZdravi() {
  setStatus('udp-status-zdravi', 'saving');
  const diagnoses      = (document.getElementById('zdravi-diagnoses')?.value ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  const symptoms       = (document.getElementById('zdravi-symptoms')?.value   ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  const family_history = (document.getElementById('zdravi-family')?.value     ?? '').trim();

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
      .upsert({ user_id: userId, diagnoses, symptoms, family_history, supplements }, { onConflict: 'user_id' });
    if (e1) throw e1;

    const { error: e2 } = await supabase.from('user_medications').update({ active: false }).eq('user_id', userId);
    if (e2) throw e2;

    for (const med of medications) {
      const { error: e3 } = await supabase.from('user_medications')
        .upsert({ user_id: userId, name: med.name, dose: med.dose, active: true }, { onConflict: 'user_id,name' });
      if (e3) throw e3;
    }

    cachedData.diagnoses      = diagnoses;
    cachedData.symptoms       = symptoms;
    cachedData.family_history = family_history;
    cachedData.supplements    = supplements;
    cachedData.medications    = medications;
    setStatus('udp-status-zdravi', 'ok');
    window.chjRefreshHealthData?.();
  } catch (e) {
    console.error('saveZdravi error:', e?.message || e?.code || JSON.stringify(e));
    setStatus('udp-status-zdravi', 'error');
  }
}

// ═══════════════════════════════════════════════════
// TAB: Dokumenty — Health Document Parser
// ═══════════════════════════════════════════════════

function renderDocumentsTab() {
  return `
    <div class="udp-section">
      <div class="udp-section-label">Nahrát zdravotní dokument</div>
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px;">
        Krevní výsledky, Holter, EKG, zpráva od lékaře nebo DEXA scan.<br>
        Claude dokument analyzuje a výsledky se promítnou do tvých uzlů.
      </p>

      <div id="doc-dropzone" style="
        border: 2px dashed #334155; border-radius: 12px; padding: 28px 16px;
        text-align: center; cursor: pointer; transition: border-color 0.2s;
      ">
        <div style="font-size: 28px; margin-bottom: 8px;">🔬</div>
        <div style="color: #94a3b8; font-size: 14px;">Přetáhni nebo klikni pro výběr</div>
        <div style="color: #475569; font-size: 12px; margin-top: 4px;">JPG, PNG, PDF · max 3,5 MB</div>
        <input id="doc-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" style="display:none;">
      </div>

      <div id="doc-file-info" style="display:none; margin-top:12px; padding:10px 14px;
        background:rgba(6,182,212,0.05); border:1px solid rgba(6,182,212,0.2);
        border-radius:8px; color:#94a3b8; font-size:13px;"></div>

      <div id="doc-error" style="display:none; margin-top:10px; padding:10px 14px;
        background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);
        border-radius:8px; color:#fca5a5; font-size:13px;"></div>

      <button id="doc-upload-btn" disabled style="
        margin-top: 14px; width: 100%; padding: 12px;
        border-radius: 10px; border: 1px solid #334155;
        background: transparent; color: #475569;
        font-size: 14px; cursor: not-allowed; transition: all 0.2s;
      ">Analyzovat a uložit</button>
    </div>

    <div id="doc-result" style="display:none;" class="udp-section">
      <div class="udp-section-label">Výsledek analýzy</div>
      <div id="doc-result-body"></div>
    </div>`;
}

function bindDocumentsEvents() {
  const dropzone = document.getElementById('doc-dropzone');
  const fileInput = document.getElementById('doc-file-input');
  const uploadBtn = document.getElementById('doc-upload-btn');
  const fileInfo  = document.getElementById('doc-file-info');
  const errorBox  = document.getElementById('doc-error');
  let selectedFile = null;

  const MAX_MB = 3.5;
  const ACCEPTED = ['image/jpeg','image/png','image/webp','application/pdf'];

  function selectFile(f) {
    errorBox.style.display = 'none';
    if (!ACCEPTED.includes(f.type)) {
      showError('Nepodporovaný formát. Nahraj JPG, PNG nebo PDF.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      showError(`Soubor je příliš velký (${(f.size/1024/1024).toFixed(1)} MB). Maximum je ${MAX_MB} MB.`);
      return;
    }
    selectedFile = f;
    fileInfo.style.display = 'block';
    fileInfo.textContent = `📄 ${f.name} · ${(f.size/1024).toFixed(0)} KB`;
    dropzone.style.borderColor = '#06b6d4';
    uploadBtn.disabled = false;
    uploadBtn.style.cssText = `margin-top:14px;width:100%;padding:12px;border-radius:10px;
      border:1px solid rgba(6,182,212,0.4);background:rgba(6,182,212,0.08);
      color:#67e8f9;font-size:14px;cursor:pointer;transition:all 0.2s;`;
  }

  function showError(msg) {
    errorBox.style.display = 'block';
    errorBox.textContent = msg;
    selectedFile = null;
    fileInfo.style.display = 'none';
    uploadBtn.disabled = true;
    uploadBtn.style.cssText = `margin-top:14px;width:100%;padding:12px;border-radius:10px;
      border:1px solid #334155;background:transparent;color:#475569;
      font-size:14px;cursor:not-allowed;`;
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#06b6d4'; });
  dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = selectedFile ? '#06b6d4' : '#334155'; });
  dropzone.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) selectFile(f); });
  fileInput.addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) selectFile(f); });

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile || !userId) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Analyzuji a ukládám…';
    uploadBtn.style.color = '#94a3b8';
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
        body: JSON.stringify({
          userId,
          fileBase64: base64,
          mediaType: selectedFile.type,
          fileName: selectedFile.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data.raw ? `\n\nClaude raw: ${data.raw}` : '';
        showError(`[${res.status}] ${data.error || JSON.stringify(data)}${detail}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Analyzovat a uložit';
        return;
      }

      // Show result
      renderDocResult(data);

    } catch (e) {
      showError('Chyba: ' + (e?.message || String(e)));
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Analyzovat dokument';
    }
  });

  function renderDocResult(data) {
    const resultBox = document.getElementById('doc-result');
    const resultBody = document.getElementById('doc-result-body');
    resultBox.style.display = 'block';

    const stateDot   = s => s === 'RED' ? '🔴' : s === 'YELLOW' ? '🟡' : '🟢';
    const deltaColor = d => d < 0 ? '#f87171' : d > 0 ? '#4ade80' : '#64748b';
    const deltaStr   = d => d > 0 ? `+${d}` : String(d);
    const NODE_LABEL = { zdravi: 'Zdraví', telo: 'Tělo', mysl: 'Mysl', metabolicke: 'Metabolismus', vyziva: 'Výživa' };

    const conclusionHtml = data.conclusion
      ? `<div style="color:#cbd5e1;font-size:15px;line-height:1.6;margin-bottom:16px;">${data.conclusion}</div>`
      : '';

    // Node cards
    const nodesHtml = data.node_updates?.length
      ? data.node_updates.map(n => `
          <div style="display:flex;align-items:center;justify-content:space-between;
            padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;">
            <span style="font-size:14px;color:#e2e8f0;">
              ${stateDot(n.state)} ${NODE_LABEL[n.node_id] || n.node_id}
            </span>
            <span style="font-size:14px;color:#64748b;">
              ${n.previous_index} → <strong style="color:#e2e8f0;">${n.new_index}</strong>
              &nbsp;<span style="color:${deltaColor(n.delta)};">${deltaStr(n.delta)}</span>
            </span>
          </div>`).join('')
      : '';

    const consultHtml = data.flags?.includes('CONSULT_DOCTOR') ? `
      <div style="margin-top:12px;padding:10px 14px;background:rgba(239,68,68,0.08);
        border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#fca5a5;font-size:13px;">
        ⚠ Konzultuj výsledky s lékařem.
      </div>` : '';

    resultBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;
        background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;">
        <span style="color:#4ade80;font-size:15px;">✔</span>
        <span style="color:#4ade80;font-size:13px;">${data.intro || 'Dokument uložen a zpracován'}</span>
      </div>
      ${conclusionHtml}
      ${nodesHtml
        ? `<div style="margin-bottom:4px;">${nodesHtml}</div>`
        : ''}
      ${consultHtml}
      <button id="doc-upload-another" style="margin-top:16px;width:100%;padding:10px;
        border-radius:10px;border:1px solid #334155;background:transparent;
        color:#64748b;font-size:13px;cursor:pointer;">
        Nahrát další dokument
      </button>`;

    document.getElementById('doc-upload-another')?.addEventListener('click', () => {
      resultBox.style.display = 'none';
      fileInfo.style.display = 'none';
      dropzone.style.borderColor = '#334155';
      selectedFile = null;
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Analyzovat dokument';
      fileInput.value = '';
    });

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Analyzovat dokument';
  }
}

// ═══════════════════════════════════════════════════
// TAB: Integrace — Ultrahuman Ring CSV import
// ═══════════════════════════════════════════════════

function renderIntegrationsTab() {
  return `
    <div class="udp-section">
      <div class="udp-section-label">Wearable data</div>
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 20px;">
        Nahraj export z Ultrahuman Ring. CHJ načte HRV, spánek a kroky<br>
        a aktualizuje uzly Zdraví, Spánek a Tělo.
      </p>

      <!-- How to export hint -->
      <div style="background:rgba(6,182,212,0.04);border:1px solid rgba(6,182,212,0.15);
        border-radius:10px;padding:12px 16px;margin-bottom:20px;">
        <div style="color:#67e8f9;font-size:12px;font-weight:700;letter-spacing:0.06em;
          text-transform:uppercase;margin-bottom:6px;">Jak exportovat z Ultrahuman</div>
        <div style="color:#64748b;font-size:13px;line-height:1.7;">
          Appka → Profil → <strong style="color:#94a3b8;">Data Export</strong> →
          zvolíš rozsah → CSV přijde emailem → nahraj sem.
        </div>
      </div>

      <!-- Drop zone -->
      <div id="uh-dropzone" style="
        border: 2px dashed #334155; border-radius: 12px; padding: 28px 16px;
        text-align: center; cursor: pointer; transition: border-color 0.2s;
      ">
        <div style="font-size: 28px; margin-bottom: 8px;">💍</div>
        <div style="color: #94a3b8; font-size: 14px;">Přetáhni nebo klikni pro výběr</div>
        <div style="color: #475569; font-size: 12px; margin-top: 4px;">CSV export z Ultrahuman Ring</div>
        <input id="uh-file-input" type="file" accept=".csv,text/csv" style="display:none;">
      </div>

      <div id="uh-file-info" style="display:none; margin-top:12px; padding:10px 14px;
        background:rgba(6,182,212,0.05); border:1px solid rgba(6,182,212,0.2);
        border-radius:8px; color:#94a3b8; font-size:13px;"></div>

      <div id="uh-error" style="display:none; margin-top:10px; padding:10px 14px;
        background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25);
        border-radius:8px; color:#fca5a5; font-size:13px;"></div>

      <button id="uh-import-btn" disabled style="
        margin-top: 14px; width: 100%; padding: 12px;
        border-radius: 10px; border: 1px solid #334155;
        background: transparent; color: #475569;
        font-size: 14px; cursor: not-allowed; transition: all 0.2s;
      ">Importovat data</button>
    </div>

    <div id="uh-result" style="display:none;" class="udp-section">
      <div class="udp-section-label">Výsledek importu</div>
      <div id="uh-result-body"></div>
    </div>`;
}

function bindIntegrationsEvents() {
  const dropzone  = document.getElementById('uh-dropzone');
  const fileInput = document.getElementById('uh-file-input');
  const importBtn = document.getElementById('uh-import-btn');
  const fileInfo  = document.getElementById('uh-file-info');
  const errorBox  = document.getElementById('uh-error');
  let selectedFile = null;

  function enableBtn() {
    importBtn.disabled = false;
    importBtn.style.cssText = `margin-top:14px;width:100%;padding:12px;border-radius:10px;
      border:1px solid rgba(6,182,212,0.4);background:rgba(6,182,212,0.08);
      color:#67e8f9;font-size:14px;cursor:pointer;transition:all 0.2s;`;
  }

  function disableBtn() {
    importBtn.disabled = true;
    importBtn.style.cssText = `margin-top:14px;width:100%;padding:12px;border-radius:10px;
      border:1px solid #334155;background:transparent;color:#475569;
      font-size:14px;cursor:not-allowed;`;
  }

  function showError(msg) {
    errorBox.style.display = 'block';
    errorBox.textContent = msg;
    selectedFile = null;
    fileInfo.style.display = 'none';
    dropzone.style.borderColor = '#334155';
    disableBtn();
  }

  function selectFile(f) {
    errorBox.style.display = 'none';
    if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') {
      showError('Nahraj CSV soubor z Ultrahuman appky.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showError('Soubor je příliš velký (max 5 MB).');
      return;
    }
    selectedFile = f;
    fileInfo.style.display = 'block';
    fileInfo.textContent = `📄 ${f.name} · ${(f.size / 1024).toFixed(0)} KB`;
    dropzone.style.borderColor = '#06b6d4';
    enableBtn();
  }

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.style.borderColor = '#06b6d4'; });
  dropzone.addEventListener('dragleave', ()  => { dropzone.style.borderColor = selectedFile ? '#06b6d4' : '#334155'; });
  dropzone.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) selectFile(f); });
  fileInput.addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) selectFile(f); });

  importBtn.addEventListener('click', async () => {
    if (!selectedFile || !userId) return;

    importBtn.disabled = true;
    importBtn.textContent = 'Importuji…';
    importBtn.style.color = '#94a3b8';
    errorBox.style.display = 'none';

    try {
      const csvText = await selectedFile.text();

      const res = await fetch('/api/tools/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, csvText, source: 'ultrahuman' }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(`Chyba: ${data.error || JSON.stringify(data)}`);
        enableBtn();
        importBtn.textContent = 'Importovat data';
        return;
      }

      renderImportResult(data);

    } catch (e) {
      showError('Chyba: ' + (e?.message || String(e)));
      enableBtn();
      importBtn.textContent = 'Importovat data';
    }
  });

  function renderImportResult(data) {
    const resultBox  = document.getElementById('uh-result');
    const resultBody = document.getElementById('uh-result-body');
    resultBox.style.display = 'block';

    const stateDot   = s => s === 'RED' ? '🔴' : s === 'YELLOW' ? '🟡' : '🟢';
    const stateColor = s => s === 'RED' ? '#f87171' : s === 'YELLOW' ? '#fbbf24' : '#4ade80';

    const nodesHtml = (data.nodes_updated || []).map(n => `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;">
        <span style="font-size:14px;color:#e2e8f0;">${stateDot(n.state)} ${n.label}</span>
        <span style="font-size:14px;color:${stateColor(n.state)};font-weight:600;">${n.index}</span>
      </div>`).join('');

    resultBody.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 14px;
        background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.25);border-radius:8px;">
        <span style="color:#4ade80;font-size:15px;">✔</span>
        <span style="color:#4ade80;font-size:13px;">
          Importováno ${data.days_imported} dní · uzly aktualizovány
        </span>
      </div>
      ${nodesHtml}
      <button id="uh-import-another" style="margin-top:16px;width:100%;padding:10px;
        border-radius:10px;border:1px solid #334155;background:transparent;
        color:#64748b;font-size:13px;cursor:pointer;">
        Nahrát nový export
      </button>`;

    document.getElementById('uh-import-another')?.addEventListener('click', () => {
      resultBox.style.display = 'none';
      fileInfo.style.display = 'none';
      dropzone.style.borderColor = '#334155';
      selectedFile = null;
      disableBtn();
      importBtn.textContent = 'Importovat data';
      fileInput.value = '';
    });

    // Refresh universe nodes automatically — no F5 needed
    if (typeof window.refreshUniverseData === 'function') {
      window.refreshUniverseData();
    }
  }
}
