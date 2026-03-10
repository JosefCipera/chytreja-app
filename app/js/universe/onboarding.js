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

  // ── Demographics ──────────────────────────────────
  {
    id: 'age', type: 'number', category: 'demographic',
    q: 'Kolik ti je let?',
    desc: 'Věk ovlivňuje referenční hodnoty a doporučení.',
    placeholder: 'Např. 45',
    min: 18, max: 99
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

  // ── Injuries ──────────────────────────────────────
  {
    id: 'injuries', type: 'multiselect', category: 'injury',
    q: 'Máš nějaká fyzická omezení nebo zranění?',
    desc: 'CHJ přizpůsobí doporučené aktivity.',
    options: [
      { value: 'knee',     label: '🦵 Koleno' },
      { value: 'back',     label: '🔙 Záda' },
      { value: 'shoulder', label: '💪 Rameno' },
      { value: 'hip',      label: '🦴 Kyčel' },
      { value: 'none',     label: '✅ Žádné omezení' }
    ]
  },

  // ── Aspiration ────────────────────────────────────
  {
    id: 'aspiration', type: 'cards', category: 'aspiration',
    q: 'Co chceš v životě zvládnout?',
    desc: 'Tvůj sen ovlivní, co ti CHJ doporučí jako prioritu.',
    options: [
      { value: 'active_senior', icon: '🏔️', label: 'Aktivní senior',
        desc: 'Turistika, běžky a hry s vnouky v osmdesátce' },
      { value: 'athlete',       icon: '🏃', label: 'Výkonnostní sport',
        desc: 'Ironman, maraton nebo horská turistika' },
      { value: 'vitality',      icon: '⚡', label: 'Energie a vitalita',
        desc: 'Soustředění, síla a dobrá nálada každý den' },
      { value: 'prevention',    icon: '🛡️', label: 'Zdraví a prevence',
        desc: 'Vyhýbat se nemocem a udržet si zdraví co nejdéle' }
    ]
  }
];

const TOTAL_STEPS = onboardingQuestions.length; // 15

// =====================================================
// THRESHOLDY (health slider → semafor)
// =====================================================

const thresholds = {
  'stabilita':     { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
  'sila':          { red: [1,2,3],     yellow: [4,5,6,7], green: [8,9,10] },
  'vytrvalost':    { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'spanek':        { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'metabolicke':   { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
  'bílkoviny':     { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'klid':          { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'mobilita':      { red: [1,2,3],     yellow: [4,5,6],   green: [7,8,9,10] },
  'nervovy_system':{ red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] },
  'smysl':         { red: [1,2,3,4,5], yellow: [6,7,8],   green: [9,10] },
  'vo2max':        { red: [1,2,3,4],   yellow: [5,6,7],   green: [8,9,10] }
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
      <p style="color:#475569;font-size:12px;margin-top:8px;text-align:center;">${q.min}–${q.max} let</p>
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
    demographic: '📋 O tobě',
    injury: '📋 O tobě',
    aspiration: '🎯 Tvůj sen'
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
    <div class="onboarding-container" style="max-width:500px;padding:30px;">

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

    // 1. Health metrics → node_inputs + node_state_history (snapshot)
    const today = new Date().toISOString().split('T')[0];
    for (const q of onboardingQuestions.filter(q => q.category === 'health')) {
      const value = userAnswers[q.id];
      if (value === undefined) continue;
      const state = getState(q.id, value);
      console.log(`  → ${q.id}: ${value} → ${state}`);
      const { error } = await supabase.from('node_inputs').insert({
        user_id: userId,
        node_id: q.id,
        source: 'onboarding',
        state,
        value_numeric: value
      });
      if (error) throw error;

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

    // 2. Demographics → user_profile (age, gender)
    const age    = userAnswers['age'];
    const gender = userAnswers['sex'];
    if (age !== undefined || gender !== undefined) {
      const profilePatch = {};
      if (age    !== undefined) profilePatch.age    = Number(age);
      if (gender !== undefined) profilePatch.gender = gender;
      console.log('  → user_profile demographics:', profilePatch);
      const { error } = await supabase.from('user_profiles').upsert({
        user_id: userId,
        ...profilePatch
      }, { onConflict: 'user_id' });
      if (error) console.warn('⚠️ user_profile demographics:', error.message);
    }

    // 3. Injuries → user_constraints (pouze injury typ)
    // Normalizace: 'back' → 'back_lower' (sjednocení s chat.js INJURY_SUBS)
    const INJURY_KEY_MAP = { back: 'back_lower' };
    const injuries = (userAnswers['injuries'] ?? [])
      .filter(i => i !== 'none')
      .map(i => INJURY_KEY_MAP[i] ?? i);
    if (injuries.length > 0) {
      // Smaž staré záznamy
      await supabase.from('user_constraints')
        .delete()
        .eq('user_id', userId)
        .eq('constraint_type', 'injury');

      for (const injury of injuries) {
        console.log(`  → injury: ${injury}`);
        const { error } = await supabase.from('user_constraints').insert({
          user_id: userId,
          constraint_type: 'injury',
          constraint_key: injury,
          constraint_value: 'true',
          severity: 'moderate'
        });
        if (error) console.warn(`⚠️ injury ${injury}:`, error.message);
      }
    }

    // 4. Aspiration → user_aspirations
    const aspiration = userAnswers['aspiration'];
    if (aspiration) {
      console.log(`  → aspiration: ${aspiration}`);
      // Try upsert, fall back to insert
      const { error } = await supabase.from('user_aspirations').upsert({
        user_id: userId,
        aspiration_type: aspiration
      }, { onConflict: 'user_id' });
      if (error) console.warn('⚠️ aspiration:', error.message);
    }

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
// START ONBOARDING
// =====================================================

export function startOnboarding() {
  const modal = document.getElementById('mediaModal');
  if (!modal) { console.error('❌ Modal #mediaModal not found'); return; }
  currentStep = 0;
  userAnswers = {};
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  renderOnboarding();
}

window.startOnboarding = startOnboarding;
