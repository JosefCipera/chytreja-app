import { supabase } from './supabaseClient.js';

export const onboardingQuestions = [
  { id: 'stabilita', q: 'Jak dlouho vydržíte na jedné noze (zavřené oči)?', desc: 'Prevence pádů a neurodegenerace.', weight: 1 },
  { id: 'sila', q: 'Kolik uděláte kliků/dřepů bez přestávky?', desc: 'Svaly jsou tvůj metabolický motor.', weight: 1 },
  { id: 'vytrvalost', q: 'Jak se cítíte po vyjití 4 pater schodů?', desc: 'VO2 Max je klíč k délce života.', weight: 1 },
  { id: 'spanek', q: 'Budíte se ráno odpočatí?', desc: 'Spánek čistí mozek od toxinů.', weight: 1 },
  { id: 'metabolicke', q: 'Jaká je vaše glykémie nalačno (pokud víte)?', desc: 'Cukr koroduje cévy.', weight: 1 },
  { id: 'bílkoviny', q: 'Máte v každém jídle zdroj bílkovin?', desc: 'Stavební kámen pro dlouhověkost.', weight: 1 },
  { id: 'klid', q: 'Jak zvládáte stresové situace (1-10)?', desc: 'Kortizol ničí imunitu.', weight: 1 },
  { id: 'mobilita', q: 'Dotknete se s nataženýma nohama dlaněmi země?', desc: 'Pružnost těla = pružnost cév.', weight: 1 },
  { id: 'nervovy_system', q: 'Jak vnímáte svou paměť a soustředění?', desc: 'Kognitivní rezerva proti Alzheimeru.', weight: 1 },
  { id: 'smysl', q: 'Máte jasný důvod, proč ráno vstát z postele?', desc: 'Psychologie přímo ovlivňuje zánět v těle.', weight: 1 }
];

let currentStep = 0;
let userAnswers = {};

export function renderOnboarding() {
  const modalContent = document.getElementById('modalContent');
  const q = onboardingQuestions[currentStep];

  modalContent.innerHTML = `
        <div class="onboarding-container">
            <h3>${q.q}</h3>
            <p>${q.desc}</p>
            <input type="range" id="q-range" min="1" max="10" value="5">
            <button id="next-btn">${currentStep === onboardingQuestions.length - 1 ? 'Dokončit' : 'Další'}</button>
        </div>
    `;

  document.getElementById('next-btn').onclick = async () => {
    const val = document.getElementById('q-range').value;
    userAnswers[q.id] = parseInt(val);

    if (currentStep < onboardingQuestions.length - 1) {
      currentStep++;
      renderOnboarding();
    } else {
      await saveResults();
    }
  };
}

async function saveResults() {
  const { data, error } = await supabase.rpc('process_onboarding_test', {
    p_user_id: (await supabase.auth.getUser()).data.user.id,
    p_answers: userAnswers
  });

  if (!error) {
    location.reload(); // Refresh pro aktualizaci dashboardu
  }
}
// assets/js/onboarding.js

// Tato funkce otevře modál a spustí první otázku
export function startOnboarding() {
  const modal = document.getElementById('mediaModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    currentStep = 0; // Resetujeme krok, kdyby to pouštěli podruhé
    userAnswers = {};
    renderOnboarding();
  }
}

// Zpřístupnění pro HTML onclick
window.startOnboarding = startOnboarding;