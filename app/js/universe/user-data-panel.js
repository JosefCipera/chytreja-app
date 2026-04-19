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
  userId = window.firebaseAuth?.currentUser?.uid;
  if (!userId) { console.warn('Not authenticated'); return; }

  const modal = document.getElementById('userDataModal');
  if (!modal) return;
  modal.classList.remove('udp-hidden');
  loadAndRender();
}

function closePanel() {
  document.getElementById('userDataModal')?.classList.add('udp-hidden');
}

window.openUserDataPanel = openUserDataPanel;

// ─── Load all data ─────────────────────────────────
async function loadAndRender() {
  renderSkeleton();

  const [profileRes, constraintsRes, aspirationRes, aspOptionsRes, integrationsRes] = await Promise.all([
    supabase.from('user_profiles').select('age, gender, height, weight, birth_year').eq('user_id', userId).maybeSingle(),
    supabase.from('user_constraints').select('constraint_type, constraint_key, constraint_value, severity').eq('user_id', userId),
    supabase.from('user_aspirations').select('aspiration_type, label, target_age, milestone').eq('user_id', userId).maybeSingle(),
    supabase.from('aspiration_requirements').select('aspiration_type, aspiration_label'),
    supabase.from('user_integrations').select('service, enabled').eq('user_id', userId)
  ]);

  // Distinct aspiration options from aspiration_requirements
  const aspOptions = [];
  const seen = new Set();
  for (const row of (aspOptionsRes.data ?? [])) {
    if (!seen.has(row.aspiration_type)) {
      seen.add(row.aspiration_type);
      aspOptions.push({ type: row.aspiration_type, label: row.aspiration_label });
    }
  }

  cachedData = {
    profile:           profileRes.data      ?? {},
    constraints:       constraintsRes.data  ?? [],
    aspiration:        aspirationRes.data   ?? {},
    aspirationOptions: aspOptions,
    integrations:      integrationsRes.data ?? []
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
    case 'profile':     body.innerHTML = renderProfileMainTab(); break;
    case 'constraints': body.innerHTML = renderConstraintsTab();  break;
    case 'aspirations': body.innerHTML = renderAspirationsTab();  break;
    case 'vitality':    body.innerHTML = renderVitalityTab();     break;
    case 'checkin':     body.innerHTML = renderCheckInTab();      break;
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
// aspiration_type/label → user_aspirations
// target_age, milestone → user_constraints type='aspiration'
// ═══════════════════════════════════════════════════

function getAspirationConstraint(key) {
  return (cachedData.constraints ?? []).find(
    c => c.constraint_type === 'aspiration' && c.constraint_key === key
  )?.constraint_value ?? '';
}

function renderAspirationsTab() {
  const curType  = cachedData.aspiration?.aspiration_type ?? '';
  const curLabel = cachedData.aspiration?.label           ?? '';
  const targetAge = getAspirationConstraint('target_age');
  const milestone = getAspirationConstraint('milestone');

  const options = cachedData.aspirationOptions ?? [];
  // If current aspiration not in DB options, add it as custom option
  const hasCustom = curType && !options.find(o => o.type === curType);

  const optionsHTML = [
    `<option value="">— vyber nebo napiš vlastní —</option>`,
    ...options.map(o =>
      `<option value="${esc(o.type)}" data-label="${esc(o.label)}" ${curType === o.type ? 'selected' : ''}>${o.label}</option>`
    ),
    hasCustom ? `<option value="${esc(curType)}" selected>${esc(curLabel)}</option>` : ''
  ].join('');

  return `
    <div class="udp-section">
      <div class="udp-section-label">Předdefinovaný cíl</div>
      <select id="asp-type" class="udp-input udp-select-full">
        ${optionsHTML}
      </select>
    </div>

    <div class="udp-section">
      <div class="udp-section-label">Vlastní cíl (volný text)</div>
      <input id="asp-label" class="udp-input" placeholder="Např. Být plně mobilní v 90 letech"
             value="${esc(curLabel)}" style="width:100%;">
    </div>

    <div class="udp-section udp-row-2">
      <div>
        <div class="udp-section-label">Cílový věk funkčnosti</div>
        <input id="asp-age" type="number" class="udp-input" placeholder="Např. 90" min="50" max="120"
               value="${esc(targetAge)}" style="width:100px;">
      </div>
      <div style="flex:1;">
        <div class="udp-section-label">Konkrétní milník</div>
        <input id="asp-milestone" class="udp-input" placeholder="Např. Uběhnout 5 km pod 25 minut"
               value="${esc(milestone)}" style="width:100%;">
      </div>
    </div>

    <div class="udp-save-row">
      <span id="udp-status-2" class="udp-status"></span>
      <button id="btn-save-aspirations" class="udp-save-btn">Uložit</button>
    </div>`;
}

function bindAspirationsEvents() {
  // Auto-fill label when predefined option selected
  document.getElementById('asp-type')?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    const label = opt?.dataset.label ?? '';
    if (label) document.getElementById('asp-label').value = label;
  });

  document.getElementById('btn-save-aspirations')?.addEventListener('click', saveAspirations);
}

async function saveAspirations() {
  setStatus('udp-status-2', 'saving');
  const aspType    = document.getElementById('asp-type').value.trim();
  const aspLabel   = document.getElementById('asp-label').value.trim();
  const targetAge  = document.getElementById('asp-age').value.trim();
  const milestone  = document.getElementById('asp-milestone').value.trim();

  try {
    // user_aspirations – delete existing, then insert
    // Note: only aspiration_type is guaranteed to exist as column
    if (aspType || aspLabel) {
      await supabase.from('user_aspirations').delete().eq('user_id', userId);
      const { error } = await supabase.from('user_aspirations').insert({
        user_id:         userId,
        aspiration_type: aspType || 'custom',
        label:           aspLabel || aspType || 'custom'
      });
      if (error) throw error;
    }

    // Aspiration extras (target_age, milestone) → user_aspirations
    if (targetAge || milestone) {
      const patch = {};
      if (targetAge) patch.target_age = parseInt(targetAge) || null;
      if (milestone) patch.milestone  = milestone;
      const { error: ae } = await supabase.from('user_aspirations')
        .update(patch)
        .eq('user_id', userId);
      if (ae) console.warn('aspiration extras:', ae.message);
    }

    // Refresh
    const [aspRes] = await Promise.all([
      supabase.from('user_aspirations').select('aspiration_type, label, target_age, milestone').eq('user_id', userId).maybeSingle()
    ]);
    cachedData.aspiration = aspRes.data ?? {};
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
      <div class="udp-section-label">Energie</div>
      <div id="chk-energie-row" style="display:flex;gap:8px;margin-bottom:4px;">
        ${[1,2,3,4,5].map(n => `
          <button data-n="${n}" class="chk-e-btn" style="
            flex:1;padding:12px 0;font-size:16px;font-family:monospace;
            border-radius:8px;cursor:pointer;transition:all .15s;
            border:1px solid ${n<=3?'rgba(6,182,212,.55)':'rgba(255,255,255,.06)'};
            background:${n<=3?'rgba(6,182,212,.1)':'transparent'};
            color:${n<=3?'#22d3ee':'#64748b'};">${n}</button>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#334155;font-family:monospace;letter-spacing:.05em;margin-bottom:24px;">
        <span>vyčerpaný</span><span>nabitý</span>
      </div>

      <div class="udp-section-label">Spánek (hodiny)</div>
      <input id="chk-spanek" type="number" min="0" max="24" step="0.5" placeholder="7.5"
        class="udp-input" style="width:100%;font-size:20px;text-align:center;margin-bottom:20px;">

      <div class="udp-section-label" style="color:#334155;">HRV (ms · volitelné)</div>
      <input id="chk-hrv" type="number" min="0" max="300" placeholder="—"
        class="udp-input" style="width:100%;font-size:18px;text-align:center;background:transparent;border-color:rgba(255,255,255,.05);color:#475569;">
    </div>

    <div class="udp-save-row">
      <span id="chk-status" class="udp-status"></span>
      <button id="btn-save-checkin" class="udp-save-btn">Uložit a zavřít</button>
    </div>`;
}

function bindCheckInEvents() {
  let energie = 3;

  const energieRow = document.getElementById('chk-energie-row');
  if (energieRow) {
    energieRow.addEventListener('click', e => {
      const btn = e.target.closest('.chk-e-btn');
      if (!btn) return;
      energie = Number(btn.dataset.n);
      energieRow.querySelectorAll('.chk-e-btn').forEach(b => {
        const n = Number(b.dataset.n);
        b.style.borderColor = n <= energie ? 'rgba(6,182,212,.55)' : 'rgba(255,255,255,.06)';
        b.style.background  = n <= energie ? 'rgba(6,182,212,.1)'  : 'transparent';
        b.style.color       = n <= energie ? '#22d3ee'              : '#64748b';
      });
    });
  }

  document.getElementById('btn-save-checkin')?.addEventListener('click', async () => {
    const spanek = parseFloat(document.getElementById('chk-spanek').value);
    const hrv    = document.getElementById('chk-hrv').value;
    const status = document.getElementById('chk-status');

    if (isNaN(spanek) || spanek < 0 || spanek > 24) {
      status.textContent = 'Zadej hodiny spánku (0–24)';
      status.style.color = '#ef4444';
      return;
    }

    setStatus('chk-status', 'saving');
    try {
      const res = await fetch('/api/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId, energie, spanek_hod: spanek,
          hrv: hrv !== '' ? Number(hrv) : null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Chyba.');
      setStatus('chk-status', 'ok');
      setTimeout(() => closePanel(), 1200);
    } catch (err) {
      status.textContent = err.message;
      status.style.color = '#ef4444';
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
    case 'profile':     bindProfileMainEvents();  break;
    case 'constraints': bindConstraintsEvents();  break;
    case 'aspirations': bindAspirationsEvents();  break;
    case 'vitality':    bindVitalityEvents();     break;
    case 'checkin':     bindCheckInEvents();      break;
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
    #userDataModal {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(2,6,23,0.85); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; box-sizing: border-box;
    }
    .udp-panel {
      background: #0f172a; border: 1px solid #1e293b;
      border-radius: 16px; width: 100%; max-width: 620px;
      max-height: 88vh; display: flex; flex-direction: column;
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
      display: flex; gap: 0; padding: 16px 24px 0; border-bottom: 1px solid #1e293b;
      flex-shrink: 0;
    }
    .udp-tab {
      background: none; border: none; border-bottom: 2px solid transparent;
      color: #64748b; font-size: 14px; font-weight: 600; padding: 10px 18px 13px;
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
        <h2 class="udp-title">⚙️ Nastavení</h2>
        <button id="udp-close" class="udp-close-btn">✕</button>
      </div>
      <div class="udp-tabs">
        <button class="udp-tab" data-tab="checkin">Check-in</button>
        <button class="udp-tab" data-tab="profile">Profil</button>
        <button class="udp-tab" data-tab="constraints">Omezení</button>
        <button class="udp-tab" data-tab="aspirations">Sen</button>
        <button class="udp-tab" data-tab="vitality">Vitalita</button>
      </div>
      <div id="udp-body"></div>
    </div>`;
  document.body.appendChild(modal);

  // Set initial active tab style
  activeTab = 'profile';
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
  activeTab = 'checkin';
  loadAndRender();
}

window.openCheckInTab = openCheckInTab;
