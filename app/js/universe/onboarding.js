// =====================================================
// ONBOARDING.JS - Semafor MVP
// =====================================================

import { supabase } from './supabaseClient.js';

// =====================================================
// 11 OTÁZEK
// =====================================================

export const onboardingQuestions = [
  {
    id: 'stabilita',
    q: 'Jak dlouho vydržíte na jedné noze (zavřené oči)?',
    desc: 'Prevence pádů a neurodegenerace.',
    help: 'Sekundy: <5=1, 5-10=3, 10-20=6, >30=10'
  },
  {
    id: 'sila',
    q: 'Kolik uděláte kliků/dřepů bez přestávky?',
    desc: 'Svaly jsou tvůj metabolický motor.',
    help: '1-3=slabé, 4-7=průměr, 8-10=skvělé'
  },
  {
    id: 'vytrvalost',
    q: 'Jak se cítíte po vyjití 4 pater schodů?',
    desc: 'VO2 Max je klíč k délce života.',
    help: 'Vyčerpaný=1, lehce unavený=5, čerstvý=10'
  },
  {
    id: 'spanek',
    q: 'Budíte se ráno odpočatí?',
    desc: 'Spánek čistí mozek od toxinů.',
    help: 'Nikdy=1, občas=5, vždy=10'
  },
  {
    id: 'metabolicke',
    q: 'Jaká je vaše glykémie nalačno (pokud víte)?',
    desc: 'Cukr koroduje cévy.',
    help: 'Nevím nebo >6.0=1, 5.5-6.0=5, <5.0=10'
  },
  {
    id: 'bílkoviny',
    q: 'Máte v každém jídle zdroj bílkovin?',
    desc: 'Stavební kámen pro dlouhověkost.',
    help: 'Nikdy=1, občas=5, vždy=10'
  },
  {
    id: 'klid',
    q: 'Jak zvládáte stresové situace (1-10)?',
    desc: 'Kortizol ničí imunitu.',
    help: 'Velmi špatně=1, klidně=10'
  },
  {
    id: 'mobilita',
    q: 'Dotknete se s nataženýma nohama dlaněmi země?',
    desc: 'Pružnost těla = pružnost cév.',
    help: 'Vůbec ne=1, s obtížemi=5, snadno=10'
  },
  {
    id: 'nervovy_system',
    q: 'Jak vnímáte svou paměť a soustředění?',
    desc: 'Kognitivní rezerva proti Alzheimeru.',
    help: 'Problémy denně=1, občas=5, výborné=10'
  },
  {
    id: 'smysl',
    q: 'Máte jasný důvod, proč ráno vstát z postele?',
    desc: 'Psychologie přímo ovlivňuje zánět v těle.',
    help: 'Ne=1, částečně=5, silný účel=10'
  },
  {
    id: 'vo2max',
    q: 'Jak se cítíte po běhu na 100 metrů?',
    desc: 'Kardiovaskulární kapacita.',
    help: 'Vyčerpaný=1, lehce unavený=5, čerstvý=10'
  }
];

// =====================================================
// THRESHOLDY (1-10 → SEMAFOR)
// =====================================================

const thresholds = {
  'stabilita': { red: [1, 2, 3], yellow: [4, 5, 6], green: [7, 8, 9, 10] },
  'sila': { red: [1, 2, 3], yellow: [4, 5, 6, 7], green: [8, 9, 10] },
  'vytrvalost': { red: [1, 2, 3, 4], yellow: [5, 6, 7], green: [8, 9, 10] },
  'spanek': { red: [1, 2, 3, 4], yellow: [5, 6, 7], green: [8, 9, 10] },
  'metabolicke': { red: [1, 2, 3], yellow: [4, 5, 6], green: [7, 8, 9, 10] },
  'bílkoviny': { red: [1, 2, 3, 4], yellow: [5, 6, 7], green: [8, 9, 10] },
  'klid': { red: [1, 2, 3, 4], yellow: [5, 6, 7], green: [8, 9, 10] },
  'mobilita': { red: [1, 2, 3], yellow: [4, 5, 6], green: [7, 8, 9, 10] },
  'nervovy_system': { red: [1, 2, 3, 4], yellow: [5, 6, 7], green: [8, 9, 10] },
  'smysl': { red: [1, 2, 3, 4, 5], yellow: [6, 7, 8], green: [9, 10] },
  'vo2max': { red: [1, 2, 3, 4], yellow: [5, 6, 7], green: [8, 9, 10] }
};

// =====================================================
// STATE
// =====================================================

let currentStep = 0;
let userAnswers = {};

// =====================================================
// RENDER ONBOARDING
// =====================================================

export function renderOnboarding() {
  const modalContent = document.getElementById('modalContent');
  const q = onboardingQuestions[currentStep];

  const progress = Math.round((currentStep / 11) * 100);

  modalContent.innerHTML = `
    <div class="onboarding-container" style="max-width: 500px; padding: 30px;">
      
      <!-- Progress bar -->
      <div style="margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #94a3b8; font-size: 14px;">Otázka ${currentStep + 1} z 11</span>
          <span style="color: #06b6d4; font-size: 14px;">${progress}%</span>
        </div>
        <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
          <div style="width: ${progress}%; height: 100%; background: #06b6d4; transition: width 0.3s;"></div>
        </div>
      </div>
      
      <!-- Question -->
      <h3 style="color: #f8fafc; font-size: 22px; margin-bottom: 12px;">${q.q}</h3>
      <p style="color: #94a3b8; font-size: 15px; margin-bottom: 8px;">${q.desc}</p>
      <p style="color: #64748b; font-size: 13px; margin-bottom: 30px; font-style: italic;">${q.help}</p>
      
      <!-- Slider -->
      <div style="margin-bottom: 40px;">
        <input 
          type="range" 
          id="onboarding-slider" 
          min="1" 
          max="10" 
          value="5"
          style="width: 100%; height: 8px; border-radius: 4px; outline: none; -webkit-appearance: none; background: linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%);"
        >
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
          <span style="color: #64748b; font-size: 13px;">Slabé</span>
          <span id="slider-value" style="color: #06b6d4; font-size: 20px; font-weight: 600;">5</span>
          <span style="color: #64748b; font-size: 13px;">Skvělé</span>
        </div>
      </div>
      
      <!-- Buttons -->
      <div style="display: flex; gap: 12px;">
        ${currentStep > 0 ? '<button id="btn-back" style="flex: 1; padding: 14px; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: #94a3b8; font-size: 16px; cursor: pointer;">Zpět</button>' : ''}
        <button id="btn-next" style="flex: 2; padding: 14px; background: #06b6d4; border: none; border-radius: 8px; color: #0f172a; font-size: 16px; font-weight: 600; cursor: pointer;">
          ${currentStep === 10 ? 'Dokončit ✓' : 'Další →'}
        </button>
      </div>
      
    </div>
  `;

  // Slider update
  const slider = document.getElementById('onboarding-slider');
  const valueDisplay = document.getElementById('slider-value');

  slider.oninput = (e) => {
    valueDisplay.textContent = e.target.value;
  };

  // Back button
  const backBtn = document.getElementById('btn-back');
  if (backBtn) {
    backBtn.onclick = () => {
      currentStep--;
      renderOnboarding();
    };
  }

  // Next button
  document.getElementById('btn-next').onclick = async () => {
    const value = parseInt(slider.value);
    userAnswers[q.id] = value;

    if (currentStep < 10) {
      currentStep++;
      renderOnboarding();
    } else {
      await saveOnboarding();
    }
  };
}

// =====================================================
// SAVE ONBOARDING
// =====================================================

async function saveOnboarding() {
  const modalContent = document.getElementById('modalContent');

  // Loading state
  modalContent.innerHTML = `
    <div style="text-align: center; padding: 60px 30px;">
      <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
      <h3 style="color: #f8fafc; margin-bottom: 12px;">Ukládám vaše odpovědi...</h3>
      <p style="color: #94a3b8;">Moment prosím</p>
    </div>
  `;

  try {
    const userId = window.firebaseAuth?.currentUser?.uid;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    console.log("💾 Saving onboarding for user:", userId);
    console.log("📊 Answers:", userAnswers);

    // Insert všech 11 odpovědí do node_inputs
    for (const [nodeId, value] of Object.entries(userAnswers)) {
      const state = getState(nodeId, value);

      console.log(`  → ${nodeId}: ${value} → ${state}`);

      const { error } = await supabase.from('node_inputs').insert({
        user_id: userId,
        node_id: nodeId,
        source: 'onboarding',
        state: state,
        value_numeric: value
      });

      if (error) {
        console.error(`❌ Insert failed for ${nodeId}:`, error);
        throw error;
      }
    }

    console.log("✅ All answers saved");

    // Success screen
    modalContent.innerHTML = `
      <div style="text-align: center; padding: 60px 30px;">
        <div style="font-size: 64px; margin-bottom: 20px;">✓</div>
        <h3 style="color: #22c55e; margin-bottom: 12px;">Hotovo!</h3>
        <p style="color: #94a3b8; margin-bottom: 30px;">Vaše data byla uložena</p>
        <button onclick="location.reload()" style="padding: 14px 28px; background: #06b6d4; border: none; border-radius: 8px; color: #0f172a; font-size: 16px; font-weight: 600; cursor: pointer;">
          Zobrazit výsledky
        </button>
      </div>
    `;

  } catch (err) {
    console.error('❌ Save error:', err);

    modalContent.innerHTML = `
      <div style="text-align: center; padding: 60px 30px;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h3 style="color: #ef4444; margin-bottom: 12px;">Chyba při ukládání</h3>
        <p style="color: #94a3b8; margin-bottom: 30px;">${err.message}</p>
        <button onclick="location.reload()" style="padding: 14px 28px; background: #64748b; border: none; border-radius: 8px; color: #fff; font-size: 16px; cursor: pointer;">
          Zkusit znovu
        </button>
      </div>
    `;
  }
}

// =====================================================
// HELPER: MAP ANSWER TO STATE
// =====================================================

function getState(nodeId, value) {
  const t = thresholds[nodeId];

  if (!t) {
    console.warn(`⚠️ No threshold defined for ${nodeId}, defaulting to YELLOW`);
    return 'YELLOW';
  }

  if (t.red.includes(value)) return 'RED';
  if (t.yellow.includes(value)) return 'YELLOW';
  return 'GREEN';
}

// =====================================================
// START ONBOARDING (exposed globally)
// =====================================================

export function startOnboarding() {
  const modal = document.getElementById('mediaModal');

  if (!modal) {
    console.error('❌ Modal #mediaModal not found');
    return;
  }

  // Reset state
  currentStep = 0;
  userAnswers = {};

  // Show modal
  modal.style.display = 'flex';
  modal.classList.remove('hidden');

  // Render first question
  renderOnboarding();
}

// Expose globally for onclick handlers
window.startOnboarding = startOnboarding;