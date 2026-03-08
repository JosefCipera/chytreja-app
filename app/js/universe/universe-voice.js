// === UNIVERSE-VOICE.JS ===
// Hlasový vstup (STT) + výstup (TTS) + intent routing
// ─────────────────────────────────────────────────────

// ── TTS ───────────────────────────────────────────────────────
export function aiSpeak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const msg = new SpeechSynthesisUtterance(text);
  msg.lang  = 'cs-CZ';
  msg.rate  = 1.05;
  msg.pitch = 1.1;

  // Pokus o český hlas
  const voices    = speechSynthesis.getVoices();
  const czVoice   = voices.find(v => /cs[-_]CZ/i.test(v.lang))
                 || voices.find(v => /czech/i.test(v.lang));
  if (czVoice) msg.voice = czVoice;

  window.speechSynthesis.speak(msg);
}

// Počkej na načtení hlasů (asynchronní v Chrome)
export function aiSpeakWhenReady(text) {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    aiSpeak(text);
  } else {
    speechSynthesis.addEventListener('voiceschanged', () => aiSpeak(text), { once: true });
  }
}

export function playWhoosh() {
  const audio = new Audio('https://files.catbox.moe/2t6h4j.mp3');
  audio.volume = 0.25;
  audio.play().catch(() => {});
}


// ── STT – Speech Recognition ──────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening  = false;

function buildRecognition() {
  if (!SpeechRecognition) return null;
  const r = new SpeechRecognition();
  r.lang          = 'cs-CZ';
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.continuous    = false;
  return r;
}

// Vrátí Promise<string> – transkript nebo null při chybě
export function listenOnce() {
  return new Promise((resolve) => {
    if (!SpeechRecognition) {
      aiSpeak('Tvůj prohlížeč nepodporuje rozpoznávání řeči.');
      resolve(null);
      return;
    }
    if (isListening) { resolve(null); return; }

    recognition = buildRecognition();
    isListening  = true;
    setMicState('listening');

    recognition.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || '';
      console.log('🎤 STT:', text);
      isListening = false;
      setMicState('idle');
      resolve(text.trim());
    };

    recognition.onerror = (e) => {
      console.warn('STT error:', e.error);
      isListening = false;
      setMicState('idle');
      if (e.error === 'not-allowed') aiSpeak('Povol přístup k mikrofonu.');
      resolve(null);
    };

    recognition.onend = () => {
      isListening = false;
      setMicState('idle');
    };

    recognition.start();
  });
}

export function stopListening() {
  recognition?.stop();
  isListening = false;
  setMicState('idle');
}


// ── Intent routing ────────────────────────────────────────────
// Zavolá /api/voice, vrátí parsed intent objekt
async function callVoiceApi(text) {
  const userId = window.firebaseAuth?.currentUser?.uid;
  if (!userId) return { intent: 'CHAT', response: 'Nejsi přihlášen.' };

  try {
    const res  = await fetch('/api/voice', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, userId })
    });
    return await res.json();
  } catch (e) {
    console.error('Voice API error:', e);
    return { intent: 'CHAT', response: 'Problém s připojením.' };
  }
}

// Hlavní handler – zavolej po obdržení STT textu
export async function handleVoiceInput(text) {
  if (!text) return;

  setMicState('thinking');
  const result = await callVoiceApi(text);
  setMicState('idle');

  console.log('🧠 Voice intent:', result);

  switch (result.intent) {
    case 'SHOW_NODE': {
      const nodeId = result.node_id;
      const node   = window.MAIN_UNIVERSE_DATA?.find(n => n.id === nodeId);
      if (node) {
        // Dynamický import aby se předešlo cirkulárnímu importu
        const { showPanel } = await import('./universe-panel.js');
        playWhoosh();
        await showPanel(node);
        if (result.response) aiSpeakWhenReady(result.response);
      } else {
        aiSpeakWhenReady('Tento uzel jsem nenašel.');
      }
      break;
    }

    case 'START_TIMER': {
      const secs  = result.timer?.seconds || 60;
      const label = result.timer?.label   || 'Timer';
      startVoiceTimer(secs, label);
      if (result.response) aiSpeakWhenReady(result.response);
      break;
    }

    case 'LOG_ACTIVITY':
    case 'LOG_BIOMETRIC': {
      // Data jsou uložena v /api/voice – tady jen potvrdíme hlasem
      if (result.response) aiSpeakWhenReady(result.response);
      showVoiceToast(result.response || 'Zaznamenáno.');
      break;
    }

    default: {
      // CHAT nebo neznámý intent
      if (result.response) aiSpeakWhenReady(result.response);
    }
  }
}


// ── Hlasový timer ─────────────────────────────────────────────
let timerInterval = null;

export function startVoiceTimer(totalSeconds, label = 'Pauza') {
  clearInterval(timerInterval);

  const timerEl = getOrCreateTimerOverlay();
  timerEl.style.display = 'flex';
  timerEl.querySelector('.vt-label').textContent = label;

  let remaining = totalSeconds;
  updateTimerDisplay(timerEl, remaining);

  timerInterval = setInterval(() => {
    remaining--;
    updateTimerDisplay(timerEl, remaining);

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerEl.style.display = 'none';
      aiSpeakWhenReady('Čas vypršel.');
    }
  }, 1000);
}

function updateTimerDisplay(el, seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  el.querySelector('.vt-time').textContent = `${m}:${s}`;
}

function getOrCreateTimerOverlay() {
  let el = document.getElementById('voice-timer');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'voice-timer';
  el.innerHTML = `
    <div class="vt-label">Timer</div>
    <div class="vt-time">00:00</div>
    <button class="vt-stop" onclick="document.getElementById('voice-timer').style.display='none'; clearInterval(window._voiceTimerInterval)">✕</button>
  `;
  el.style.cssText = `
    display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:rgba(15,20,35,0.96); border:1px solid #334;
    border-radius:20px; padding:32px 48px; z-index:9999;
    flex-direction:column; align-items:center; gap:12px;
    box-shadow:0 0 40px rgba(80,120,255,0.3);
  `;
  document.body.appendChild(el);
  return el;
}


// ── Proaktivní pozdrav ────────────────────────────────────────
// Zavolej po první interakci uživatele (ne automaticky – browser blokuje)
export function proactiveGreeting() {
  const today     = new Date().toDateString();
  const lastGreet = localStorage.getItem('chj_last_greeting');
  if (lastGreet === today) return;   // dnes už pozdravil

  localStorage.setItem('chj_last_greeting', today);

  // Najdi stav hlavního uzlu
  const mainNode = window.MAIN_UNIVERSE_DATA?.find(n => n.id === 'dlouhovekost');
  const state    = mainNode?.state || 'YELLOW';
  const hour     = new Date().getHours();

  const timeGreet = hour < 12 ? 'Dobré ráno' : hour < 18 ? 'Dobrý den' : 'Dobrý večer';

  const greetings = {
    GREEN:  `${timeGreet}. Tvoje baterie svítí zeleně, dobrá práce.`,
    YELLOW: `${timeGreet}. Máš prostor zlepšit se — podívej se na svůj stav.`,
    RED:    `${timeGreet}. Dnes je dobrý den začít změnu.`,
  };

  const text = greetings[state] || greetings.YELLOW;
  // Krátká prodleva aby se prohlížeč stihl inicializovat
  setTimeout(() => aiSpeakWhenReady(text), 800);
}


// ── UI helpers ────────────────────────────────────────────────
function setMicState(state) {
  const btn = document.getElementById('voice-mic-btn');
  if (!btn) return;

  btn.dataset.state = state;
  const icon = btn.querySelector('.mic-icon');
  if (!icon) return;

  switch (state) {
    case 'listening': icon.textContent = '🔴'; btn.title = 'Poslouchám…';  break;
    case 'thinking':  icon.textContent = '💭'; btn.title = 'Zpracovávám…'; break;
    default:          icon.textContent = '🎤'; btn.title = 'Říct CHJ';     break;
  }
}

function showVoiceToast(message) {
  const toast = document.createElement('div');
  toast.className = 'voice-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
    background:rgba(30,50,90,0.95); color:#e2e8f0;
    padding:10px 20px; border-radius:10px; font-size:14px;
    z-index:9998; pointer-events:none;
    animation: fadeUpOut 2.5s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

// CSS animace pro toast
if (!document.getElementById('voice-toast-style')) {
  const s = document.createElement('style');
  s.id = 'voice-toast-style';
  s.textContent = `
    @keyframes fadeUpOut {
      0%   { opacity:0; transform:translateX(-50%) translateY(10px); }
      15%  { opacity:1; transform:translateX(-50%) translateY(0); }
      75%  { opacity:1; }
      100% { opacity:0; transform:translateX(-50%) translateY(-10px); }
    }
  `;
  document.head.appendChild(s);
}
