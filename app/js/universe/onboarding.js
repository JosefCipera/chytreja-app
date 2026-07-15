// =====================================================
// ONBOARDING.JS - Semafor MVP + Constraints + Aspiration
// =====================================================

import { supabase } from './supabaseClient.js';

// =====================================================
// QUESTIONS
// type: 'slider' | 'number' | 'buttons' | 'multiselect' | 'cards'
// category: 'health' | 'demographic' | 'injury' | 'aspiration'
// =====================================================

// ── Decathlon disciplines ──────────────────────────
// id:   unique discipline key (stored in userAnswers)
// node: aggregated node_id saved to user_metrics (multiple disciplines → average)
// type: 'buttons' — 3 concrete options from the Decathlon PDF
// options: value 9 = GREEN, 5 = YELLOW, 2 = RED (×10 = index)

export const onboardingQuestions = [
  {
    id: 'vstat_ze_zeme', node: 'stabilita', type: 'slider', category: 'health',
    q: 'Lehněte si na zem. Zvládnete vstát bez opory rukou?',
    desc: 'Prevence pádů a ztráty samostatnosti.',
    help: 'Potřebuji pomoc=1, S obtížemi=5, Snadno bez opory=10'
  },
  {
    id: 'vynest_nakup', node: 'sila', type: 'slider', category: 'health',
    q: 'Unesete dvě plné tašky (~5 kg každá) do 2. patra schodů?',
    desc: 'Funkční síla — základ samostatnosti.',
    help: 'Jednu nebo vůbec=1, S námahou=5, Obě bez problémů=10'
  },
  {
    id: 'zvednout_vnouce', node: 'sila', type: 'slider', category: 'health',
    q: 'Zvednete 15 kg ze země do náruče — dítě, pytel, krabici?',
    desc: 'Síla zad a nohou chrání před závislostí na pomoci druhých.',
    help: 'Bolí nebo nedokážu=1, S námahou=5, Bez problémů=10'
  },
  {
    id: 'kufr_do_police', node: 'mobilita', type: 'slider', category: 'health',
    q: 'Zvednete 10–15 kg nad hlavu — kufr do police v letadle?',
    desc: 'Mobilita ramen a síla horní části těla.',
    help: 'Nedokážu=1, S pomocí=5, Bez problémů=10'
  },
  {
    id: 'vyjit_4_patra', node: 'vo2max', type: 'slider', category: 'health',
    q: 'Vyjdete 4 patra schodů bez zastavení a bez zadýchání?',
    desc: 'Srdeční rezerva — jeden z nejsilnějších prediktorů délky života.',
    help: 'Velká námaha=1, Musím zpomalit=5, Klidný dech=10'
  },
  {
    id: 'balanc_jedna_noha', node: 'stabilita', type: 'slider', category: 'health',
    q: 'Vydržíte 30 sekund na jedné noze se zavřenýma očima?',
    desc: 'Prevence zlomenin krčku a pádů.',
    help: 'Méně než 5 s=1, 10–20 s=5, 30 s snadno=10'
  },
  {
    id: 'rychla_chuze', node: 'vytrvalost', type: 'slider', category: 'health',
    q: 'Ujdete 1 km svižným tempem nebo jedete 20 min na kole bez zadýchání?',
    desc: 'Aerobní základ — udržení kondice a mobility.',
    help: 'Nezvládnu=1, Zadýchám se=5, Pohodový dech=10'
  },
  {
    id: 'otevrit_zavarovacku', node: 'sila', type: 'slider', category: 'health',
    q: 'Otevřete tuhý zavařovací víček bez pomoci nástroje nebo druhého člověka?',
    desc: 'Síla úchopu silně koreluje s délkou a kvalitou života.',
    help: 'Potřebuji pomoc=1, S námahou=5, Bez problémů=10'
  },
  {
    id: 'skocit_dopadnout', node: 'plyometrie', type: 'slider', category: 'health',
    q: 'Seskočíte z obrubníku (20 cm) a ustojíte dopad na jedné noze?',
    desc: 'Hustota kostí a rychlost reakce — ochrana před zlomeninami.',
    help: 'Bojím se nebo nedokážu=1, Nejistě=5, Snadno ustojím=10'
  },
  {
    id: 'rovnovaha_zavrene_oci', node: 'rovnovaha', type: 'slider', category: 'health',
    q: 'Ustojíte 10 sekund na jedné noze se zavřenýma očima bez zachycení?',
    desc: 'Propriocepce a rovnovážný systém — prevence pádů ve stáří.',
    help: 'Nedokážu ani 3 s=1, 5–8 s=5, 10 s snadno=10'
  },
  {
    id: 'zadrzeni_dechu', node: 'dychani', type: 'slider', category: 'health',
    q: 'Po klidném výdechu zadržíte dech déle než 20 sekund bez nucení?',
    desc: 'Tolerance CO₂ a efektivita dýchání — základ výkonu i regenerace.',
    help: 'Méně než 8 s=1, 10–18 s=5, 20 s a více=10'
  },
];

const TOTAL_STEPS = onboardingQuestions.length; // 11 health questions

// =====================================================
// THRESHOLDY (health slider → semafor)
// =====================================================

// Thresholds now derived from index (value × 10), not from slider position.
// Button values: 9→90 (GREEN), 5→50 (YELLOW), 2→20 (RED)
// State single source of truth: index ≤40=RED, ≤70=YELLOW, >70=GREEN
const thresholds = {}; // unused — state derived from index in saveOnboarding

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
    health: ''
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

    // 1. Health metrics → aggregate by node, then save to user_metrics
    // Multiple disciplines per node → averaged into one index
    const today = new Date().toISOString().split('T')[0];
    const nodeStates    = {}; // nodeId → state
    const nodeIndexMap  = {}; // nodeId → computed average index

    // Group discipline answers by node
    const nodeRawIndices = {}; // nodeId → [index, ...]
    for (const q of onboardingQuestions.filter(q => q.category === 'health')) {
      const value = userAnswers[q.id];
      if (value === undefined || value === null) continue;
      const index = Number(value) * 10; // button value 9/5/2 → 90/50/20
      if (!nodeRawIndices[q.node]) nodeRawIndices[q.node] = [];
      nodeRawIndices[q.node].push(index);
    }

    // ── Calculate all metrics in memory first, then save via API ──────────────
    // (anon key cannot write — all DB writes go through /api/onboarding-save)
    const stateOrder    = { RED: 3, YELLOW: 2, GREEN: 1, GRAY: 0 };
    const stateOrderMap = { RED: 3, YELLOW: 2, GREEN: 1 };

    for (const [nodeId, indices] of Object.entries(nodeRawIndices)) {
      const currentIndex = Math.round(indices.reduce((a, b) => a + b, 0) / indices.length);
      const state = currentIndex <= 40 ? 'RED' : currentIndex <= 70 ? 'YELLOW' : 'GREEN';
      console.log(`  → ${nodeId}: avg=${currentIndex} → ${state} (from ${indices.length} disciplines)`);
      nodeStates[nodeId]   = state;
      nodeIndexMap[nodeId] = currentIndex;
    }

    // 1b. Calculate parent node states (in memory)
    const parentMap = {
      telo:         ['sila', 'stabilita', 'mobilita', 'plyometrie', 'rovnovaha', 'dychani'],
      zdravi:       ['vo2max', 'vytrvalost'],
      mysl:         [],
      vyziva:       [],
      dlouhovekost: ['telo', 'zdravi', 'mysl', 'vyziva'],
    };

    for (const [parent, children] of Object.entries(parentMap)) {
      if (parent === 'dlouhovekost') continue;
      let worstState = 'GREEN';
      for (const child of children) {
        const cs = nodeStates[child];
        if (cs && (stateOrder[cs] || 0) > (stateOrder[worstState] || 0)) worstState = cs;
      }
      const childIndices = children.map(c => nodeIndexMap[c] ?? null).filter(v => v !== null);
      const avgIndex = childIndices.length > 0
        ? Math.round(childIndices.reduce((a, b) => a + b, 0) / childIndices.length) : 50;
      const indexState  = avgIndex <= 40 ? 'RED' : avgIndex <= 70 ? 'YELLOW' : 'GREEN';
      const parentState = (stateOrderMap[worstState] || 0) >= (stateOrderMap[indexState] || 0) ? worstState : indexState;
      nodeStates[parent]   = parentState;
      nodeIndexMap[parent] = avgIndex;
      console.log(`  → parent ${parent}: state=${parentState}, avgIndex=${avgIndex}`);
    }

    // Second pass: dlouhovekost
    {
      let worstState = 'GREEN';
      for (const child of parentMap.dlouhovekost) {
        const cs = nodeStates[child];
        if (cs && (stateOrder[cs] || 0) > (stateOrder[worstState] || 0)) worstState = cs;
      }
      const parentIndices = parentMap.dlouhovekost
        .map(c => nodeStates[c] ? (stateOrder[nodeStates[c]] === 3 ? 25 : stateOrder[nodeStates[c]] === 2 ? 55 : 85) : 50);
      const avgIndex    = Math.round(parentIndices.reduce((a, b) => a + b, 0) / parentIndices.length);
      const dlIndexState = avgIndex <= 40 ? 'RED' : avgIndex <= 70 ? 'YELLOW' : 'GREEN';
      const dlState     = (stateOrder[worstState] || 0) >= (stateOrder[dlIndexState] || 0) ? worstState : dlIndexState;
      nodeStates['dlouhovekost']   = dlState;
      nodeIndexMap['dlouhovekost'] = avgIndex;
      console.log(`  → hlavní uzel: worst=${worstState}, avgIndex=${avgIndex}`);
    }

    // 1c. Get gray nodes (longevity_nodes is public — anon can SELECT)
    const { data: allNodes } = await supabase.from('longevity_nodes').select('id').neq('id', 'dlouhovekost');
    const setNodes = new Set(Object.keys(nodeStates));
    const grayNodes = (allNodes || []).filter(n => !setNodes.has(n.id));
    for (const n of grayNodes) {
      nodeStates[n.id]   = 'GRAY';
      nodeIndexMap[n.id] = 0;
    }
    console.log(`  → ${grayNodes.length} nodes set to GRAY`);

    // ── Single API call — server writes everything with service_role ──────────
    const urlMode    = new URLSearchParams(window.location.search).get('mode');
    const primaryGoal = urlMode === 'dekatlon' ? 'dekatlon' : 'longevity';

    const allNodeEntries = Object.entries(nodeStates).map(([nodeId, state]) => ({
      nodeId, state, currentIndex: nodeIndexMap[nodeId] ?? 0,
    }));

    const saveRes = await fetch('/api/user?action=onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, nodes: allNodeEntries, primaryGoal }),
    });
    if (!saveRes.ok) console.warn('⚠️ onboarding-save:', await saveRes.text());

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

// Auto-start pokud přišel redirect z jiné stránky (např. crt.html → Vitalita)
if (new URLSearchParams(location.search).get('start') === 'onboarding') {
  window.addEventListener('load', () => setTimeout(startOnboarding, 500));
}
