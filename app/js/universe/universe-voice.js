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

  // Mic stav: SPEAKING → po skončení zpět IDLE
  msg.onstart = () => setMicState('speaking');
  msg.onend   = () => setMicState('idle');
  msg.onerror = () => setMicState('idle');

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

    // Guard: Promise se splní jen jednou (onresult NEBO onend/onerror)
    let settled = false;
    const done = (val) => {
      if (settled) return;
      settled = true;
      isListening = false;
      setMicState('idle');
      resolve(val);
    };

    recognition.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || '';
      console.log('🎤 STT:', text);
      done(text.trim());
    };

    recognition.onerror = (e) => {
      console.warn('STT error:', e.error);
      if (e.error === 'not-allowed') aiSpeak('Povol přístup k mikrofonu.');
      done(null);
    };

    recognition.onend = () => {
      // Zajistí resolve i pokud onresult/onerror nenastal (prázdný výsledek, timeout)
      done(null);
    };

    recognition.start();
  });
}

export function stopListening() {
  recognition?.stop();
  isListening = false;
  setMicState('idle');
}


// ── Klient-side SHOW_NODE detekce (bez API, nulová latence) ──
// Matchuje přímo labely uzlů z window.MAIN_UNIVERSE_DATA (z DB).
// Synonyma jen pro mluvené výrazy lišící se od labelu uzlu.
const _SYNONYMS = {
  'srdce':        'kardio',
  'hlava':        'mysl',
  'mozek':        'mysl',
  'strava':       'vyziva',
  'jídlo':        'vyziva',
  'protein':      'bilkoviny',
  'krev':         'biomarkery',
  'kondice':      'vo2max',
  'dech':         'dychani',
  'pohyblivost':  'mobilita',
  'svaly':        'telo',
  'svalů':        'telo',
  'dlouhověkost': 'dlouhovekost',
  'hosszověkost': 'dlouhovekost',
};

// Slova signalizující záměr "zobrazit uzel"
const _SHOW_WORDS = new Set([
  'zobraz','zobrazit','otevři','otevřít','otevřit',
  'ukaz','ukazuj','ukaž','uzel','najdi',
]);

// Odstraní diakritiku – fallback pro ručně zadaný text bez háčků
function _strip(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Pomocné porovnání: slovo vs. jeden token (s pádem a diakritikou fallback)
function _wordMatches(word, token) {
  if (token === word) return true;
  if (word.endsWith('u') && token === word.slice(0, -1) + 'a') return true;
  if (word.endsWith('i') && token === word.slice(0, -1) + 'a') return true;
  const sw = _strip(word), st = _strip(token);
  if (sw === st) return true;
  if (word.endsWith('u') && st === _strip(word.slice(0, -1) + 'a')) return true;
  if (word.endsWith('i') && st === _strip(word.slice(0, -1) + 'a')) return true;
  return false;
}

// Přesný match: slovo odpovídá CELÉMU labelu (jeden normalizovaný řetězec).
// Priorita 1 – zabraňuje záměně "rovnováha" → "Imunitní rovnováha".
function _matchesExact(word, node) {
  const label = node.label.toLowerCase().normalize('NFC').replace(/[.,!?;:()-]+/g, '').trim();
  return _wordMatches(word, label);
}

// Částečný match: slovo odpovídá JEDNOMU slovu ve víceslovném labelu.
// Priorita 2 – pro uzly jako "Imunitní rovnováha", "Nervový systém".
function _matchesWordInLabel(word, node) {
  const labelWords = node.label.toLowerCase().normalize('NFC').split(/\s+/);
  for (let lw of labelWords) {
    lw = lw.replace(/[.,!?;:()-]+/g, '');
    if (lw && _wordMatches(word, lw)) return true;
  }
  return false;
}

function _tryShowNode(text) {
  const s = text.toLowerCase().normalize('NFC').trim();
  const words = s.split(/\s+/).map(w => w.replace(/[.,!?;:]+$/, ''));

  const hasShowIntent = words.some(w => _SHOW_WORDS.has(w));
  // Pokračuj jen pokud je "show" záměr nebo jde o jednoslovný přímý povel
  if (!hasShowIntent && words.length > 1) return null;

  const nodes = window.MAIN_UNIVERSE_DATA || [];
  // Odfiltruj navigační slova a příliš krátká slova – zbytek je název uzlu
  const contentWords = words.filter(w => !_SHOW_WORDS.has(w) && w.length >= 3);

  console.log('🔎 _tryShowNode contentWords:', contentWords, '| nodes loaded:', nodes.length);

  for (const word of contentWords) {
    // 1. Synonyma (srdce→kardio, hlava→mysl…)
    if (_SYNONYMS[word]) { console.log('🔎 synonym:', word, '→', _SYNONYMS[word]); return _SYNONYMS[word]; }

    // 2. Přesný match celého labelu (vyšší priorita – např. "rovnováha" → "Rovnováha")
    for (const node of nodes) {
      if (_matchesExact(word, node)) { console.log('🔎 exact:', word, '→', node.id, `(${node.label})`); return node.id; }
    }

    // 3. Slovo uvnitř víceslovného labelu (nižší priorita – "imunitní" → "Imunitní rovnováha")
    for (const node of nodes) {
      if (_matchesWordInLabel(word, node)) { console.log('🔎 partial:', word, '→', node.id, `(${node.label})`); return node.id; }
    }
  }
  return null;
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
    if (!res.ok) {
      // 404 = Live Server bez backendu, jinak obecná chyba
      const msg = res.status === 404
        ? 'Zápis funguje jen přes vercel dev, ne Live Server.'
        : `Chyba serveru (${res.status}).`;
      return { intent: 'CHAT', response: msg };
    }
    return await res.json();
  } catch (e) {
    // fetch selhal úplně (CORS, síť, Live Server na jiném portu)
    console.error('Voice API error:', e);
    return { intent: 'CHAT', response: 'Zápis funguje jen přes vercel dev, ne Live Server.' };
  }
}

// Pomocná funkce: otevře panel pro uzel podle ID
async function _openNodeById(nodeId) {
  const node = window.MAIN_UNIVERSE_DATA?.find(n => n.id === nodeId);
  if (!node) { aiSpeakWhenReady('Tento uzel jsem nenašel.'); return false; }
  const { showPanel } = await import('./universe-panel.js');
  playWhoosh();
  await showPanel(node);
  return true;
}

// Hlavní handler – zavolej po obdržení STT textu
export async function handleVoiceInput(text) {
  if (!text) return;

  // ── Okamžitá klient-side detekce uzlu (bez API) ──────────
  const localNodeId = _tryShowNode(text);
  if (localNodeId) {
    console.log('🎯 Local SHOW_NODE:', localNodeId);
    await _openNodeById(localNodeId);
    return;
  }

  setMicState('thinking');
  const result = await callVoiceApi(text);
  setMicState('idle');

  console.log('🧠 Voice intent:', result);

  switch (result.intent) {
    case 'SHOW_NODE': {
      await _openNodeById(result.node_id);
      if (result.response) aiSpeakWhenReady(result.response);
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
      // Data jsou uložena v /api/voice – tady jen potvrdíme hlasem + zobrazíme text
      if (result.response) {
        aiSpeakWhenReady(result.response);
        showResponseInPanel(result.response || 'Zaznamenáno.');
      }
      break;
    }

    default: {
      // CHAT nebo neznámý intent – mluv + zobraz text v panelu
      if (result.response) {
        aiSpeakWhenReady(result.response);
        showResponseInPanel(result.response);
      }
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
  // Floor mic (#voice-mic-btn)
  const btn = document.getElementById('voice-mic-btn');
  if (btn) {
    btn.dataset.state = state;
    const icon = btn.querySelector('.mic-icon');
    if (icon) {
      switch (state) {
        case 'listening': icon.textContent = '🎙️'; btn.title = 'Poslouchám…';  break;
        case 'thinking':  icon.textContent = '🎙️'; btn.title = 'Zpracovávám…'; break;
        case 'speaking':  icon.textContent = '🎙️'; btn.title = 'Mluvím…';      break;
        default:          icon.textContent = '🎤'; btn.title = 'Říct CHJ';     break;
      }
    }
  }

  // Header mic (#header-mic-btn) – vlnky obarveny přes innerHTML span
  const headerBtn = document.getElementById('header-mic-btn');
  if (headerBtn) {
    headerBtn.dataset.state = state;
    const icon = headerBtn.querySelector('.header-mic-icon');
    if (icon) {
      switch (state) {
        case 'listening':
          // zelené vlnky dovnitř: )) 🎤 ((
          icon.innerHTML = '<span style="color:#22c55e;font-weight:700">))</span> 🎤 <span style="color:#22c55e;font-weight:700">((</span>';
          break;
        case 'thinking':
          icon.textContent = '💭';
          break;
        case 'speaking':
          // modré vlnky ven: (( 🔊 ))
          icon.innerHTML = '<span style="color:#60a5fa;font-weight:700">((</span> 🔊 <span style="color:#60a5fa;font-weight:700">))</span>';
          break;
        default:
          icon.textContent = '🎤';
          break;
      }
    }
  }
}

// Nastavení SPEAKING stavu z panelu (volá startTTS / onend)
export function setHeaderMicSpeaking(active) {
  const headerBtn = document.getElementById('header-mic-btn');
  if (!headerBtn) return;
  const icon = headerBtn.querySelector('.header-mic-icon');
  if (active) {
    headerBtn.dataset.state = 'speaking';
    if (icon) {
      // modré vlnky ven: (( 🔊 ))
      icon.innerHTML = '<span style="color:#60a5fa;font-weight:700">((</span> 🔊 <span style="color:#60a5fa;font-weight:700">))</span>';
    }
  } else {
    headerBtn.dataset.state = 'idle';
    if (icon) icon.textContent = '🎤';
  }
}

// Zobrazí hlasovou odpověď do otevřeného panelu CHJ, jinak toast
function showResponseInPanel(message) {
  const messageEl = document.querySelector('#sidePanel .chj-message');
  if (messageEl) {
    messageEl.textContent = message;
    return;
  }
  showVoiceToast(message);
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
