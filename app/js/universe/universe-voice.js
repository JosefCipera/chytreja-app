// === UNIVERSE-VOICE.JS === v20260328
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

// Vrátí Promise která se splní po skončení TTS (onend/onerror)
export function aiSpeakPromise(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'cs-CZ'; msg.rate = 1.05; msg.pitch = 1.1;
    const voices = speechSynthesis.getVoices();
    const czVoice = voices.find(v => /cs[-_]CZ/i.test(v.lang)) || voices.find(v => /czech/i.test(v.lang));
    if (czVoice) msg.voice = czVoice;
    msg.onstart = () => setMicState('speaking');
    msg.onend   = () => { setMicState('idle'); resolve(); };
    msg.onerror = () => { setMicState('idle'); resolve(); };
    window.speechSynthesis.speak(msg);
  });
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
// NOTE: checked fresh inside buildRecognition() – iOS PWA initializes API lazily
let recognition = null;
let isListening  = false;

function buildRecognition() {
  // Re-check at call time so iOS PWA / lazy browser inits are picked up
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang          = 'cs-CZ';
  r.interimResults = false;
  r.maxAlternatives = 1;
  r.continuous    = false;
  return r;
}

// Vrátí Promise<string> – transkript nebo null při chybě
export function listenOnce() {
  return _startRecognition(0);
}

function _startRecognition(attempt) {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      aiSpeak('Tvůj prohlížeč nepodporuje rozpoznávání řeči.');
      resolve(null);
      return;
    }
    // Reset zaseknutého stavu
    if (isListening) {
      try { recognition?.abort(); } catch (_) {}
      isListening = false;
    }

    // Krátká pauza aby audio systém uvolnil device (prevence audio-capture chyby)
    setTimeout(() => {
      recognition = buildRecognition();
      isListening  = true;
      setMicState('listening');

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
        console.warn('STT error:', e.error, '(pokus', attempt + 1, ')');
        if (e.error === 'not-allowed') {
          aiSpeak('Povol přístup k mikrofonu v prohlížeči.');
          done(null);
        } else if (e.error === 'audio-capture' && attempt < 2) {
          // Audio device ještě není volný — retry po 300 ms
          isListening = false;
          setMicState('idle');
          _startRecognition(attempt + 1).then(resolve);
        } else if (e.error === 'audio-capture') {
          // Všechny pokusy selhaly — mikrofon nedostupný
          _showMicToast('Mikrofon není dostupný. Zavři Teams nebo jinou aplikaci, která ho používá.');
          done(null);
        } else {
          done(null);
        }
      };

      recognition.onend = () => done(null);

      try {
        recognition.start();
      } catch (err) {
        console.warn('recognition.start() threw:', err);
        done(null);
      }
    }, attempt === 0 ? 80 : 350);   // první pokus: 80 ms, retry: 350 ms
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

// Pomocná funkce: otevře uzel hlasem = stejné jako klik
//   - 1. úroveň (Tělo, Výživa…): jen HUD, canvas beze změny
//   - 2. úroveň (Kardio…): přepni canvas na podsíť rodiče (bez zoom), pak HUD
async function _openNodeById(nodeId) {
  const DATA = window.MAIN_UNIVERSE_DATA || [];
  const node = DATA.find(n => n.id === nodeId);
  if (!node) return false;

  const [{ getViewState, openSubUniverse }, { showPanel }] = await Promise.all([
    import('./universe-core.js'),
    import('./universe-panel.js'),
  ]);

  const ROOT = 'dlouhovekost';
  const isFirstLevel = !node.parent || node.parent === ROOT;

  playWhoosh();

  if (isFirstLevel) {
    // Jen otevři HUD, canvas nechej být
    showPanel(node);
  } else {
    // Přepni canvas na podsíť rodiče (pokud ještě nejsme uvnitř)
    const { centerId } = getViewState();
    if (centerId !== node.parent) {
      const parentNode = DATA.find(n => n.id === node.parent);
      if (parentNode) openSubUniverse(DATA, parentNode);
    }
    // Malá pauza aby se canvas překreslil, pak otevři HUD
    setTimeout(() => showPanel(node), 350);
  }

  return true;
}

// Hlavní handler – zavolej po obdržení STT textu
export async function handleVoiceInput(text) {
  if (!text) return;

  // ── Klient-side detekce uzlu (bez API) ──────────────────
  const localNodeId = _tryShowNode(text);
  if (localNodeId) {
    await _openNodeById(localNodeId);
    return;
  }

  // API není funkční — tiše ignoruj neznámé příkazy
  setMicState('idle');
  return;

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
// Vrátí Promise — splní se až po skončení pozdravu (nebo ihned pokud dnes už proběhl)
export function proactiveGreeting() {
  const today     = new Date().toDateString();
  const lastGreet = localStorage.getItem('chj_last_greeting');
  if (lastGreet === today) return Promise.resolve();   // dnes už pozdravil

  localStorage.setItem('chj_last_greeting', today);

  const mainNode = window.MAIN_UNIVERSE_DATA?.find(n => n.id === 'dlouhovekost');
  const state    = mainNode?.state || 'YELLOW';
  const hour     = new Date().getHours();
  const timeGreet = hour < 12 ? 'Dobré ráno' : hour < 18 ? 'Dobrý den' : 'Dobrý večer';

  const greetings = {
    GREEN:  `${timeGreet}. Tvoje baterie svítí zeleně. Řekni co chceš zobrazit.`,
    YELLOW: `${timeGreet}. Řekni mi co chceš zobrazit.`,
    RED:    `${timeGreet}. Jsem tady. Řekni mi co chceš zobrazit.`,
  };

  const text = greetings[state] || greetings.YELLOW;
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      aiSpeakPromise(text).then(resolve);
    } else {
      speechSynthesis.addEventListener('voiceschanged', () => aiSpeakPromise(text).then(resolve), { once: true });
    }
  });
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

  // CMD mic (#cmd-mic-btn) – hlasový příkaz, aktivní stavy
  const cmdBtn = document.getElementById('cmd-mic-btn');
  if (cmdBtn) {
    cmdBtn.dataset.state = state;
    const icon  = document.getElementById('cmd-mic-icon');
    const label = document.getElementById('cmd-mic-label');
    switch (state) {
      case 'listening':
        if (icon)  icon.textContent  = '🎙️';
        if (label) label.textContent = 'SLYŠÍM';
        cmdBtn.title = 'Poslouchám…';
        break;
      case 'thinking':
        if (icon)  icon.textContent  = '💭';
        if (label) label.textContent = 'MYSLÍM';
        cmdBtn.title = 'Zpracovávám…';
        break;
      case 'speaking':
        if (icon)  icon.textContent  = '🔊';
        if (label) label.textContent = 'MLUVÍM';
        cmdBtn.title = 'Mluvím…';
        break;
      default:
        if (icon)  icon.textContent  = '🎤';
        if (label) label.textContent = 'CMD';
        cmdBtn.title = 'Hlasový příkaz';
        break;
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

// Chybový toast pro mic problémy (déle viditelný)
function _showMicToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; top:70px; left:50%; transform:translateX(-50%);
    background:rgba(127,29,29,0.95); color:#fecaca;
    padding:10px 20px; border-radius:10px; font-size:13px;
    z-index:9999; pointer-events:none; text-align:center; max-width:320px;
    border:1px solid rgba(239,68,68,0.4);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
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

// Expose for launcher.js routing
window._openNodeById = _openNodeById;
