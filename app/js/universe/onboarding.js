// =====================================================
// ONBOARDING.JS - Semafor MVP + Constraints + Aspiration
// =====================================================

import { supabase } from './supabaseClient.js';

// =====================================================
// QUESTIONS
// type: 'slider' | 'number' | 'buttons' | 'multiselect' | 'cards'
// category: 'health' | 'demographic' | 'injury' | 'aspiration'
// =====================================================

export const onboardingQuestions = [
  // ── Health metrics (slider 1–10) ──────────────────
  {
    id: 'stabilita', type: 'slider', category: 'health',
    q: 'Jak dlouho vydržíte na jedné noze (zavřené oči)?',
    desc: 'Prevence pádů a neurodegenerace.',
    help: 'Sekundy: <5=1, 5-10=3, 10-20=6, >30=10'
  },
  {
    id: 'sila', type: 'slider', category: 'health',
    q: 'Kolik uděláte kliků/dřepů bez přestávky?',
    desc: 'Svaly jsou tvůj metabolický motor.',
    help: '1-3=slabé, 4-7=průměr, 8-10=skvělé'
  },
  {
    id: 'vytrvalost', type: 'slider', category: 'health',
    q: 'Jak se cítíte po vyjití 4 pater schodů?',
    desc: 'VO2 Max je klíč k délce života.',
    help: 'Vyčerpaný=1, lehce unavený=5, čerstvý=10'
  },
  {
    id: 'spanek', type: 'slider', category: 'health',
    q: 'Budíte se ráno odpočatí?',
    desc: 'Spánek čistí mozek od toxinů.',
    help: 'Nikdy=1, občas=5, vždy=10'
  },
  {
    id: 'metabolicke', type: 'slider', category: 'health',
    q: 'Jaká je vaše glykémie nalačno (pokud víte)?',
    desc: 'Cukr koroduje cévy.',
    help: 'Nevím nebo >6.0=1, 5.5-6.0=5, <5.0=10'
  },
  {
    id: 'bílkoviny', type: 'slider', category: 'health',
    q: 'Máte v každém jídle zdroj bílkovin?',
    desc: 'Stavební kámen pro dlouhověkost.',
    help: 'Nikdy=1, občas=5, vždy=10'
  },
  {
    id: 'klid', type: 'slider', category: 'health',
    q: 'Jak zvládáte stresové situace (1-10)?',
    desc: 'Kortizol ničí imunitu.',
    help: 'Velmi špatně=1, klidně=10'
  },
  {
    id: 'mobilita', type: 'slider', category: 'health',
    q: 'Dotknete se s nataženýma nohama dlaněmi země?',
    desc: 'Pružnost těla = pružnost cév.',
    help: 'Vůbec ne=1, s obtížemi=5, snadno=10'
  },
  {
    id: 'nervovy_system', type: 'slider', category: 'health',
    q: 'Jak vnímáte svou paměť a soustředění?',
    desc: 'Kognitivní rezerva proti Alzheimeru.',
    help: 'Problémy denně=1, občas=5, výborné=10'
  },
  {
    id: 'smysl', type: 'slider', category: 'health',
    q: 'Máte jasný důvod, proč ráno vstát z postele?',
    desc: 'Psychologie přímo ovlivňuje zánět v těle.',
    help: 'Ne=1, částečně=5, silný účel=10'
  },
  {
    id: 'vo2max', type: 'slider', category: 'health',
    q: 'Jak se cítíte po běhu na 100 metrů?',
    desc: 'Kardiovaskulární kapacita.',
    help: 'Vyčerpaný=1, lehce unavený=5, čerstvý=10'
  },

  // ── Dekathlon (Attia) ─────────────────────────────
  {
    id: 'grip', type: 'slider', category: 'health',
    q: 'Jak silný je tvůj stisk ruky?',
    desc: 'Síla stisku predikuje dlouhověkost.',
    help: 'Neudržíš tašku=1, normální=5, drtivý stisk=10'
  },
  {
    id: 'dead_hang', type: 'slider', category: 'health',
    q: 'Jak dlouho vydrží viset na hrazdě?',
    desc: 'Dead hang = síla horní části těla.',
    help: '0s=1, 10s=3, 30s=6, 60s+=10'
  },
  {
    id: 'floor_get_up', type: 'slider', category: 'health',
    q: 'Jak lehce vstaneš ze země bez pomoci rukou?',
    desc: 'Test funkční síly celého těla.',
    help: 'Nezvládnu=1, s obtížemi=5, lehce=10'
  },

  // ── Demographics + body ─────────────────────────────
  {
    id: 'birth_year', type: 'number', category: 'demographic',
    q: 'Rok tvého narození?',
    desc: 'Pro výpočet bio-věku potřebujeme znát tvůj skutečný věk.',
    placeholder: 'Např. 1975',
    min: 1930, max: 2010
  },
  {
    id: 'sex', type: 'buttons', category: 'demographic',
    q: 'Jaké máš pohlaví?',
    desc: 'Referenční hodnoty se liší podle pohlaví.',
    options: [
      { value: 'male',   label: 'Muž' },
      { value: 'female', label: 'Žena' }
    ]
  },
  {
    id: 'height', type: 'number', category: 'demographic',
    q: 'Kolik měříš? (cm)',
    desc: 'Pro výpočet BMI a referenčních hodnot.',
    placeholder: 'Např. 178',
    min: 140, max: 220
  },
  {
    id: 'weight', type: 'number', category: 'demographic',
    q: 'Kolik vážíš? (kg)',
    desc: 'Váha v kombinaci s výškou ovlivňuje metabolické zdraví.',
    placeholder: 'Např. 82',
    min: 35, max: 200
  }
];

const TOTAL_STEPS = onboardingQuestions.length; // 18 (14 health + 4 demographic)

// =====================================================
// THRESHOLDY (health slider → semafor)
// =====================================================

const thresholds = {
  'stabilita':      { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
  'sila':           { red: [1,2,3],     yellow: [4,5,6,7], green: [8,9,10] },
  'vytrvalost':     { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'spanek':         { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'metabolicke':    { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
  'bílkoviny':      { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'klid':           { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'mobilita':       { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
  'nervovy_system': { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'smysl':          { red: [1,2,3,4,5], yellow: [6,7,8],   green: [9,10] },
  'vo2max':         { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'grip':           { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
  'dead_hang':      { red: [1,2,3],     yellow: [4,5,6,7], green: [8,9,10] },
  'floor_get_up':   { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
};

// =====================================================
// STATE
// =====================================================

let currentStep = 0;
let userAnswers = {};

// =====================================================
// RENDER HELPERS – input fragments
// =====================================================

function renderSliderHTML(q) {
  const prev = userAnswers[q.id] ?? 5;
  return `
    <p style="color:#64748b;font-size:13px;margin-bottom:20px;font-style:italic;">${q.help}</p>
    <div style="margin-bottom:40px;">
      <input type="range" id="onboarding-slider" min="1" max="10" value="${prev}"
        style="width:100%;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;
               background:linear-gradient(to right,#ef4444 0%,#eab308 50%,#22c55e 100%);">
      <div style="display:flex;justify-content:space-between;margin-top:8px;">
        <span style="color:#64748b;font-size:13px;">Slabé</span>
        <span id="slider-value" style="color:#06b6d4;font-size:20px;font-weight:600;">${prev}</span>
        <span style="color:#64748b;font-size:13px;">Skvělé</span>
      </div>
    </div>`;
}

function renderNumberHTML(q) {
  const prev = userAnswers[q.id] ?? '';
  return `
    <div style="margin-bottom:40px;">
      <input type="number" id="onboarding-number"
        min="${q.min}" max="${q.max}" value="${prev}"
        placeholder="${q.placeholder}"
        style="width:100%;padding:16px;font-size:22px;text-align:center;
               background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);
               border-radius:10px;color:#f8fafc;outline:none;box-sizing:border-box;">
      <p style="color:#475569;font-size:12px;margin-top:8px;text-align:center;">${q.min}–${q.max}</p>
    </div>`;
}

function renderButtonsHTML(q) {
  const prev = userAnswers[q.id] ?? null;
  const btns = q.options.map(o => `
    <button class="onb-btn${prev === o.value ? ' onb-btn-selected' : ''}"
      data-value="${o.value}"
      style="flex:1;padding:16px;font-size:18px;font-weight:600;border-radius:10px;cursor:pointer;
             border:2px solid ${prev === o.value ? '#06b6d4' : 'rgba(255,255,255,0.15)'};
             background:${prev === o.value ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.05)'};
             color:${prev === o.value ? '#06b6d4' : '#94a3b8'};transition:all 0.2s;">
      ${o.label}
    </button>`).join('');
  return `<div style="display:flex;gap:16px;margin-bottom:40px;">${btns}</div>`;
}

function renderMultiselectHTML(q) {
  const prev = userAnswers[q.id] ?? [];
  const items = q.options.map(o => {
    const checked = prev.includes(o.value);
    return `
      <label class="onb-multi-item" data-value="${o.value}"
        style="display:flex;align-items:center;gap:14px;padding:14px 16px;
               border-radius:10px;cursor:pointer;margin-bottom:10px;
               border:2px solid ${checked ? '#06b6d4' : 'rgba(255,255,255,0.1)'};
               background:${checked ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)'};
               transition:all 0.2s;">
        <div class="onb-checkbox" style="width:20px;height:20px;border-radius:5px;flex-shrink:0;
          border:2px solid ${checked ? '#06b6d4' : '#475569'};
          background:${checked ? '#06b6d4' : 'transparent'};
          display:flex;align-items:center;justify-content:center;transition:all 0.2s;">
          ${checked ? '<span style="color:#0f172a;font-size:13px;font-weight:700;">✓</span>' : ''}
        </div>
        <span style="color:${checked ? '#e2e8f0' : '#94a3b8'};font-size:16px;">${o.label}</span>
      </label>`;
  }).join('');
  return `<div style="margin-bottom:30px;">${items}</div>`;
}

function renderCardsHTML(q) {
  const prev = userAnswers[q.id] ?? null;
  const cards = q.options.map(o => `
    <div class="onb-card${prev === o.value ? ' onb-card-selected' : ''}"
      data-value="${o.value}"
      style="padding:18px;border-radius:12px;cursor:pointer;
             border:2px solid ${prev === o.value ? '#06b6d4' : 'rgba(255,255,255,0.1)'};
             background:${prev === o.value ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)'};
             transition:all 0.2s;">
      <div style="font-size:28px;margin-bottom:8px;">${o.icon}</div>
      <div style="color:${prev === o.value ? '#06b6d4' : '#e2e8f0'};font-size:15px;font-weight:600;margin-bottom:4px;">${o.label}</div>
      <div style="color:#64748b;font-size:13px;line-height:1.5;">${o.desc}</div>
    </div>`).join('');
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:30px;">${cards}</div>`;
}

// =====================================================
// BIND EVENTS after innerHTML
// =====================================================

function bindInputEvents(q) {
  if (q.type === 'slider') {
    const slider = document.getElementById('onboarding-slider');
    const valueDisplay = document.getElementById('slider-value');
    slider.oninput = (e) => { valueDisplay.textContent = e.target.value; };
  }

  if (q.type === 'buttons') {
    document.querySelectorAll('.onb-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.onb-btn').forEach(b => {
          b.style.border = '2px solid rgba(255,255,255,0.15)';
          b.style.background = 'rgba(255,255,255,0.05)';
          b.style.color = '#94a3b8';
          b.classList.remove('onb-btn-selected');
        });
        btn.style.border = '2px solid #06b6d4';
        btn.style.background = 'rgba(6,182,212,0.15)';
        btn.style.color = '#06b6d4';
        btn.classList.add('onb-btn-selected');
      };
    });
  }

  if (q.type === 'multiselect') {
    document.querySelectorAll('.onb-multi-item').forEach(item => {
      item.onclick = () => {
        const val = item.dataset.value;
        // "none" deselects everything else
        if (val === 'none') {
          document.querySelectorAll('.onb-multi-item').forEach(i => {
            setMultiItem(i, i.dataset.value === 'none');
          });
          return;
        }
        // Any other option deselects "none"
        const noneItem = document.querySelector('.onb-multi-item[data-value="none"]');
        if (noneItem) setMultiItem(noneItem, false);
        // Toggle this item
        const isSelected = item.querySelector('.onb-checkbox')?.style.background === 'rgb(6, 182, 212)';
        setMultiItem(item, !isSelected);
      };
    });
  }

  if (q.type === 'cards') {
    document.querySelectorAll('.onb-card').forEach(card => {
      card.onclick = () => {
        document.querySelectorAll('.onb-card').forEach(c => {
          c.style.border = '2px solid rgba(255,255,255,0.1)';
          c.style.background = 'rgba(255,255,255,0.03)';
          c.querySelector('div:nth-child(2)').style.color = '#e2e8f0';
          c.classList.remove('onb-card-selected');
        });
        card.style.border = '2px solid #06b6d4';
        card.style.background = 'rgba(6,182,212,0.1)';
        card.querySelector('div:nth-child(2)').style.color = '#06b6d4';
        card.classList.add('onb-card-selected');
      };
    });
  }
}

function setMultiItem(item, selected) {
  const checkbox = item.querySelector('.onb-checkbox');
  const label = item.querySelector('span');
  item.style.border = selected ? '2px solid #06b6d4' : '2px solid rgba(255,255,255,0.1)';
  item.style.background = selected ? 'rgba(6,182,212,0.1)' : 'rgba(255,255,255,0.03)';
  if (checkbox) {
    checkbox.style.border = selected ? '2px solid #06b6d4' : '2px solid #475569';
    checkbox.style.background = selected ? '#06b6d4' : 'transparent';
    checkbox.innerHTML = selected ? '<span style="color:#0f172a;font-size:13px;font-weight:700;">✓</span>' : '';
  }
  if (label) label.style.color = selected ? '#e2e8f0' : '#94a3b8';
}

// =====================================================
// GET CURRENT VALUE from DOM
// =====================================================

function getCurrentValue(q) {
  switch (q.type) {
    case 'slider': {
      return parseInt(document.getElementById('onboarding-slider')?.value ?? 5);
    }
    case 'number': {
      const v = parseInt(document.getElementById('onboarding-number')?.value);
      return isNaN(v) ? null : v;
    }
    case 'buttons': {
      const sel = document.querySelector('.onb-btn-selected');
      return sel ? sel.dataset.value : null;
    }
    case 'multiselect': {
      const checked = [...document.querySelectorAll('.onb-multi-item')].filter(
        i => i.querySelector('.onb-checkbox')?.style.background === 'rgb(6, 182, 212)'
      ).map(i => i.dataset.value);
      return checked.length > 0 ? checked : null;
    }
    case 'cards': {
      const sel = document.querySelector('.onb-card-selected');
      return sel ? sel.dataset.value : null;
    }
  }
  return null;
}

// =====================================================
// RENDER ONBOARDING
// =====================================================

export function renderOnboarding() {
  const modalContent = document.getElementById('modalContent');
  const q = onboardingQuestions[currentStep];
  const progress = Math.round((currentStep / TOTAL_STEPS) * 100);

  // Section label for context switch
  const sectionLabels = {
    health: '',
    demographic: '📋 O tobě'
  };
  const sectionLabel = sectionLabels[q.category] || '';
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  // Build input HTML
  let inputHTML = '';
  switch (q.type) {
    case 'slider':     inputHTML = renderSliderHTML(q);     break;
    case 'number':     inputHTML = renderNumberHTML(q);     break;
    case 'buttons':    inputHTML = renderButtonsHTML(q);    break;
    case 'multiselect':inputHTML = renderMultiselectHTML(q);break;
    case 'cards':      inputHTML = renderCardsHTML(q);      break;
  }

  modalContent.innerHTML = `
    <div class="onboarding-container" style="max-width:500px;padding:30px;position:relative;">

      <!-- Zavřít -->
      <button id="btn-close-onboarding" title="Zavřít"
        style="position:absolute;top:0;right:0;background:none;border:none;
               color:#475569;font-size:22px;cursor:pointer;line-height:1;padding:4px 8px;"
        >✕</button>

      <!-- Progress -->
      <div style="margin-bottom:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="color:#94a3b8;font-size:13px;">
            ${sectionLabel ? `<span style="color:#06b6d4;font-weight:600;">${sectionLabel} · </span>` : ''}
            Otázka ${currentStep + 1} z ${TOTAL_STEPS}
          </span>
          <span style="color:#06b6d4;font-size:13px;">${progress}%</span>
        </div>
        <div style="height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
          <div style="width:${progress}%;height:100%;background:#06b6d4;transition:width 0.3s;"></div>
        </div>
      </div>

      <!-- Question -->
      <h3 style="color:#f8fafc;font-size:21px;margin-bottom:10px;">${q.q}</h3>
      <p style="color:#94a3b8;font-size:15px;margin-bottom:${q.help ? '4px' : '24px'};">${q.desc}</p>

      <!-- Input -->
      ${inputHTML}

      <!-- Buttons -->
      <div style="display:flex;gap:12px;">
        ${currentStep > 0
          ? '<button id="btn-back" style="flex:1;padding:14px;background:rgba(255,255,255,0.08);border:none;border-radius:8px;color:#94a3b8;font-size:16px;cursor:pointer;">← Zpět</button>'
          : ''}
        <button id="btn-next"
          style="flex:2;padding:14px;background:#06b6d4;border:none;border-radius:8px;
                 color:#0f172a;font-size:16px;font-weight:600;cursor:pointer;">
          ${isLastStep ? 'Dokončit ✓' : 'Další →'}
        </button>
      </div>

    </div>
  `;

  // Bind input-specific events
  bindInputEvents(q);

  // Close (✕)
  document.getElementById('btn-close-onboarding')?.addEventListener('click', closeOnboarding);

  // Back
  document.getElementById('btn-back')?.addEventListener('click', () => {
    currentStep--;
    renderOnboarding();
  });

  // Next
  document.getElementById('btn-next').addEventListener('click', async () => {
    const value = getCurrentValue(q);
    if (value === null || value === undefined) {
      // Simple shake feedback for required fields
      const btn = document.getElementById('btn-next');
      btn.style.background = '#ef4444';
      setTimeout(() => { btn.style.background = '#06b6d4'; }, 600);
      return;
    }
    userAnswers[q.id] = value;

    if (currentStep < TOTAL_STEPS - 1) {
      currentStep++;
      renderOnboarding();
    } else {
      await saveOnboarding();
    }
  });
}

// =====================================================
// SAVE ONBOARDING
// =====================================================

async function saveOnboarding() {
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = `
    <div style="text-align:center;padding:60px 30px;">
      <div style="font-size:48px;margin-bottom:20px;">⏳</div>
      <h3 style="color:#f8fafc;margin-bottom:12px;">Ukládám tvoje odpovědi...</h3>
      <p style="color:#94a3b8;">Moment prosím</p>
    </div>`;

  try {
    const userId = window.firebaseAuth?.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    console.log('💾 Saving onboarding for user:', userId);

    // 1. Health metrics → node_inputs + user_metrics + node_state_history
    const today = new Date().toISOString().split('T')[0];
    const nodeStates = {}; // track states for parent calculation

    for (const q of onboardingQuestions.filter(q => q.category === 'health')) {
      const value = userAnswers[q.id];
      if (value === undefined) continue;
      const state = getState(q.id, value);
      const currentIndex = value * 10; // slider 1-10 → index 0-100
      console.log(`  → ${q.id}: ${value} → ${state} (index: ${currentIndex})`);

      // node_inputs
      const { error } = await supabase.from('node_inputs').insert({
        user_id: userId,
        node_id: q.id,
        source: 'onboarding',
        state,
        value_numeric: value
      });
      if (error) throw error;

      // user_metrics (the key table for universe colors!)
      const { error: metErr } = await supabase.from('user_metrics').upsert({
        user_id: userId,
        node_id: q.id,
        universe: 'longevity',
        current_index: currentIndex,
        state
      }, { onConflict: 'user_id,node_id,universe' });
      if (metErr) console.warn(`⚠️ user_metrics(${q.id}):`, metErr.message);

      nodeStates[q.id] = state;

      // Snapshot do node_state_history pro sparkline trend
      if (state !== 'GRAY') {
        const { error: histError } = await supabase.from('node_state_history').insert({
          user_id: userId,
          node_id: q.id,
          date: today,
          state
        });
        if (histError) console.warn(`⚠️ node_state_history(${q.id}):`, histError.message);
      }
    }

    // 1b. Calculate parent node states (worst child rule)
    const parentMap = {
      sila:         ['grip', 'dead_hang'],
      stabilita:    ['floor_get_up'],
      telo:         ['sila', 'vytrvalost', 'stabilita', 'mobilita', 'vo2max'],
      mysl:         ['nervovy_system', 'klid', 'smysl'],
      vyziva:       ['bílkoviny'],
      zdravi:       ['metabolicke', 'spanek'],
      dlouhovekost: ['telo', 'mysl', 'vyziva', 'zdravi'],
    };

    const stateOrder = { RED: 3, YELLOW: 2, GREEN: 1, GRAY: 0 };

    // First pass: immediate parents
    for (const [parent, children] of Object.entries(parentMap)) {
      if (parent === 'dlouhovekost') continue; // do last
      let worstState = 'GREEN';
      for (const child of children) {
        const cs = nodeStates[child];
        if (cs && (stateOrder[cs] || 0) > (stateOrder[worstState] || 0)) {
          worstState = cs;
        }
      }
      nodeStates[parent] = worstState;

      // Average index from children for parent
      const childIndices = children
        .map(c => userAnswers[c] !== undefined ? userAnswers[c] * 10 : null)
        .filter(v => v !== null);
      const avgIndex = childIndices.length > 0
        ? Math.round(childIndices.reduce((a, b) => a + b, 0) / childIndices.length)
        : 50;

      const { error: pErr } = await supabase.from('user_metrics').upsert({
        user_id: userId,
        node_id: parent,
        universe: 'longevity',
        current_index: avgIndex,
        state: worstState
      }, { onConflict: 'user_id,node_id,universe' });
      if (pErr) console.warn(`⚠️ parent user_metrics(${parent}):`, pErr.message);
      console.log(`  → parent ${parent}: worst=${worstState}, avgIndex=${avgIndex}`);
    }

    // Second pass: hlavní uzel (dlouhovekost)
    {
      let worstState = 'GREEN';
      for (const child of parentMap.dlouhovekost) {
        const cs = nodeStates[child];
        if (cs && (stateOrder[cs] || 0) > (stateOrder[worstState] || 0)) {
          worstState = cs;
        }
      }
      const parentIndices = parentMap.dlouhovekost
        .map(c => nodeStates[c] ? (stateOrder[nodeStates[c]] === 3 ? 25 : stateOrder[nodeStates[c]] === 2 ? 55 : 85) : 50);
      const avgIndex = Math.round(parentIndices.reduce((a, b) => a + b, 0) / parentIndices.length);

      const { error: mErr } = await supabase.from('user_metrics').upsert({
        user_id: userId,
        node_id: 'dlouhovekost',
        universe: 'longevity',
        current_index: avgIndex,
        state: worstState
      }, { onConflict: 'user_id,node_id,universe' });
      if (mErr) console.warn(`⚠️ user_metrics(dlouhovekost):`, mErr.message);
      console.log(`  → hlavní uzel: worst=${worstState}, avgIndex=${avgIndex}`);
    }

    // 1c. Set remaining nodes to GRAY (locked)
    const { data: allNodes } = await supabase
      .from('longevity_nodes')
      .select('id')
      .neq('id', 'dlouhovekost');

    const setNodes = new Set(Object.keys(nodeStates));
    setNodes.add('dlouhovekost');
    const grayNodes = (allNodes || []).filter(n => !setNodes.has(n.id));

    for (const n of grayNodes) {
      const { error: gErr } = await supabase.from('user_metrics').upsert({
        user_id: userId,
        node_id: n.id,
        universe: 'longevity',
        current_index: 0,
        state: 'GRAY'
      }, { onConflict: 'user_id,node_id,universe' });
      if (gErr) console.warn(`⚠️ gray(${n.id}):`, gErr.message);
    }
    console.log(`  → ${grayNodes.length} nodes set to GRAY`);

    // 2. Demographics → user_profile (birth_year, gender, height, weight)
    const birthYear = userAnswers['birth_year'];
    const gender    = userAnswers['sex'];
    const height    = userAnswers['height'];
    const weight    = userAnswers['weight'];
    if (birthYear !== undefined || gender !== undefined || height !== undefined || weight !== undefined) {
      const profilePatch = {};
      if (birthYear !== undefined) {
        profilePatch.birth_year = Number(birthYear);
        profilePatch.age = new Date().getFullYear() - Number(birthYear);
      }
      if (gender !== undefined) profilePatch.gender = gender;
      if (height !== undefined) profilePatch.height = Number(height);
      if (weight !== undefined) profilePatch.weight = Number(weight);
      console.log('  → user_profile demographics:', profilePatch);
      const { error } = await supabase.from('user_profiles').upsert({
        user_id: userId,
        ...profilePatch
      }, { onConflict: 'user_id' });
      if (error) console.warn('⚠️ user_profile demographics:', error.message);
    }

    // Injuries + Aspiration: handled in Nastavení (user-data-panel.js), not onboarding

    console.log('✅ Onboarding saved');

    modalContent.innerHTML = `
      <div style="text-align:center;padding:60px 30px;">
        <div style="font-size:64px;margin-bottom:20px;">✓</div>
        <h3 style="color:#22c55e;margin-bottom:12px;">Hotovo!</h3>
        <p style="color:#94a3b8;margin-bottom:30px;">Tvoje data jsou uložena</p>
        <button onclick="location.reload()"
          style="padding:14px 28px;background:#06b6d4;border:none;border-radius:8px;
                 color:#0f172a;font-size:16px;font-weight:600;cursor:pointer;">
          Zobrazit výsledky
        </button>
      </div>`;

  } catch (err) {
    console.error('❌ Save error:', err);
    modalContent.innerHTML = `
      <div style="text-align:center;padding:60px 30px;">
        <div style="font-size:48px;margin-bottom:20px;">⚠️</div>
        <h3 style="color:#ef4444;margin-bottom:12px;">Chyba při ukládání</h3>
        <p style="color:#94a3b8;margin-bottom:30px;">${err.message}</p>
        <button onclick="location.reload()"
          style="padding:14px 28px;background:#64748b;border:none;border-radius:8px;
                 color:#fff;font-size:16px;cursor:pointer;">
          Zkusit znovu
        </button>
      </div>`;
  }
}

// =====================================================
// HELPER: MAP ANSWER TO SEMAFOR STATE
// =====================================================

function getState(nodeId, value) {
  const t = thresholds[nodeId];
  if (!t) {
    console.warn(`⚠️ No threshold for ${nodeId}, defaulting to YELLOW`);
    return 'YELLOW';
  }
  if (t.red.includes(value))    return 'RED';
  if (t.yellow.includes(value)) return 'YELLOW';
  return 'GREEN';
}

// =====================================================
// CLOSE ONBOARDING
// =====================================================

function closeOnboarding() {
  const modal = document.getElementById('mediaModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.classList.add('hidden');
  // Odstraní Escape listener, aby nezůstal viset
  document.removeEventListener('keydown', _onboardingEscHandler);
}

function _onboardingEscHandler(e) {
  if (e.key === 'Escape') closeOnboarding();
}

// =====================================================
// START ONBOARDING
// =====================================================

export function startOnboarding() {
  const modal = document.getElementById('mediaModal');
  if (!modal) { console.error('❌ Modal #mediaModal not found'); return; }
  currentStep = 0;
  userAnswers = {};
  modal.style.display = 'flex';
  modal.classList.remove('hidden');

  // Escape key → zavřít
  document.removeEventListener('keydown', _onboardingEscHandler); // guard double-attach
  document.addEventListener('keydown', _onboardingEscHandler);

  // Klik na pozadí (mimo modalContent) → zavřít
  modal.onclick = (e) => {
    if (e.target === modal) closeOnboarding();
  };

  renderOnboarding();
}

window.startOnboarding = startOnboarding;
