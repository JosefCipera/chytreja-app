/**
 * launcher.js — CHJ Shell
 * Injected immediately on page load (replaces splash.js).
 * Acts as a persistent shell: shows bio state, sleeps after action,
 * wakes on voice command to route to universe nodes.
 */

// ── Version ──────────────────────────────────────────────────────────────────
const CHJ_VERSION = 'v0.2.1';
console.log('[CHJ Launcher] loaded', CHJ_VERSION);

// ── Styles ───────────────────────────────────────────────────────────────────
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@300;800&display=swap');

#chj-launcher {
  position: fixed; inset: 0; z-index: 9999;
  background: #010406;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex; flex-direction: column;
  justify-content: space-between; align-items: center;
  padding: 60px 40px 52px;
  overflow: hidden; cursor: pointer;
  transition: opacity 0.6s ease;
}
#chj-launcher.fade-out { opacity: 0; pointer-events: none; }

/* Ambient corners */
#chj-launcher::before, #chj-launcher::after {
  content: ''; position: absolute;
  width: 300px; height: 300px; border-radius: 50%;
  background: rgba(0,188,212,0.03); filter: blur(80px); pointer-events: none;
}
#chj-launcher::before { top: -50px; left: -50px; }
#chj-launcher::after  { bottom: -50px; right: -50px; }

/* Corner stars */
.chjl-star {
  position: absolute; color: #4ba6b5;
  font-size: 22px; opacity: 0.35; pointer-events: none;
}
.chjl-star-tl { top: 28px; left: 28px; }
.chjl-star-br { bottom: 28px; right: 28px; }

/* Version */
.chjl-version {
  position: absolute; bottom: 14px; left: 20px;
  font-size: 11px; color: #0d2530; letter-spacing: 1px;
  font-family: monospace;
}

/* ── Logo ── */
.chjl-header {
  text-align: center; width: 100%; z-index: 10;
  display: flex; flex-direction: column; align-items: center;
}
.chjl-logo {
  display: flex; flex-direction: row; align-items: center; gap: 10px;
  margin-bottom: 10px;
}
.chjl-cursor {
  width: 2px; height: 74px; background: #e2e8f0; border-radius: 1px;
  flex-shrink: 0; animation: chjl-blink 1.1s step-end infinite;
  box-shadow: none;
  align-self: flex-end;
  margin-bottom: 2px;
}
@keyframes chjl-blink { 0%,100%{opacity:1} 50%{opacity:0} }
.chjl-text {
  display: flex; flex-direction: column;
  font-family: 'Urbanist', sans-serif;
  line-height: 0.88; letter-spacing: 2px; text-align: left;
}
.chjl-row1 { font-size: 46px; font-weight: 300; color: #e2e8f0; }
.chjl-row2 { font-size: 46px; font-weight: 800; color: #e2e8f0; }

/* Flat accent mark above letter */
.chjl-ac {
  position: relative; display: inline-block;
}
.chjl-ac::after {
  content: ''; position: absolute;
  left: 50%; transform: translateX(-50%);
  width: 0.42em; height: 0.06em; background: currentColor;
  top: 0.1em; border-radius: 1px;
}

.chjl-sub {
  font-size: 12px; letter-spacing: 5px; color: #5ba8bc;
  text-transform: uppercase; margin-top: 14px; margin-bottom: 22px;
  padding-right: 5px; text-shadow: 0 0 18px rgba(91,168,188,0.5);
}

/* ── Laser line ── */
.chjl-laser-wrap {
  width: min(85vw, 480px);
  height: 6px;
  margin-top: 18px;
  background: transparent;
  border: none;
  border-radius: 3px; overflow: hidden;
}
.chjl-laser {
  height: 100%; border-radius: 3px;
  transition: width 3.2s cubic-bezier(0.25,0,0.1,1),
              box-shadow 3.2s ease;
  width: 0%;
}

/* ── Center stage ── */
.chjl-main {
  text-align: center; max-width: 560px; width: 100%;
  flex-grow: 1; display: flex;
  justify-content: center; align-items: center;
  position: relative; z-index: 10;
}
.chjl-stage {
  width: 100%; position: absolute;
  transition: opacity 0.55s cubic-bezier(0.4,0,0.2,1),
              transform 0.55s cubic-bezier(0.4,0,0.2,1),
              filter 0.55s cubic-bezier(0.4,0,0.2,1);
}
.chjl-alarm {
  font-size: 26px; font-weight: 300;
  letter-spacing: 0px; color: #8ba8b8;
  line-height: 1.65; text-shadow: none;
}
.chjl-action {
  font-size: 26px; font-weight: 300; line-height: 1.65;
  color: #e8f4f8; opacity: 0; transform: scale(0.97);
  filter: blur(14px); pointer-events: none;
  display: flex; flex-direction: column; align-items: center; gap: 40px;
}

/* ── Chips — stejný styl jako starý HOTOVO ── */
.chjl-chips {
  display: flex; flex-wrap: wrap; gap: 14px; justify-content: center;
}
.chjl-chip {
  background: linear-gradient(180deg, rgba(14,52,69,0.85) 0%, rgba(7,30,41,0.95) 100%);
  border: 1.5px solid #3ca9bd; color: #fff;
  padding: 14px clamp(18px, 8vw, 48px);
  font-size: clamp(15px, 4.5vw, 22px); font-weight: 400;
  letter-spacing: 2px; border-radius: 8px; cursor: pointer;
  box-shadow: 0 0 28px rgba(0,188,212,0.25), inset 0 0 12px rgba(0,188,212,0.15);
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
  font-family: inherit; white-space: nowrap;
}
.chjl-chip:hover {
  border-color: #00bcd4;
  box-shadow: 0 0 45px rgba(0,188,212,0.55), inset 0 0 18px rgba(0,188,212,0.25);
  transform: scale(1.02);
}

/* ── Timer ── */
.chjl-timer {
  display: flex; flex-direction: column; align-items: center; gap: 28px;
}
.chjl-timer-num {
  font-size: clamp(52px, 16vw, 88px); font-weight: 300; letter-spacing: 4px;
  color: #e8f4f8; font-family: 'Urbanist', sans-serif; line-height: 1;
  text-shadow: 0 0 40px rgba(0,188,212,0.3);
}

/* ── Inline zdroje ── */
.chjl-srcs-back {
  background: none; border: none; color: #3ca9bd; cursor: pointer;
  font-size: 16px; letter-spacing: 1px; padding: 4px 0 12px;
  font-family: inherit; align-self: flex-start;
}
.chjl-srcs-back:hover { color: #00bcd4; }
.chjl-srcs-wrap {
  display: flex; flex-direction: column; gap: 14px; width: 100%;
}
/* Zdroje v inline pohledu — větší jako v HUDu */
.chjl-srcs-wrap .chjl-src {
  padding: 20px 22px;
}
.chjl-srcs-wrap .chjl-src-type {
  font-size: 11px; margin-bottom: 10px;
}
.chjl-srcs-wrap .chjl-src-title {
  font-size: 17px; -webkit-line-clamp: 4;
}
.chjl-srcs-wrap .chjl-src-meta {
  font-size: 12px; margin-top: 8px;
}
.chjl-srcs-wrap .chjl-src-badge {
  font-size: 11px; margin-top: 12px;
}

/* HOTOVO button — zachováno pro zpětnou kompatibilitu (modal close atd.) */
.chjl-btn {
  background: linear-gradient(180deg, rgba(14,52,69,0.85) 0%, rgba(7,30,41,0.95) 100%);
  border: 1.5px solid #3ca9bd; color: #fff;
  padding: 14px 48px; font-size: 22px; font-weight: 400;
  letter-spacing: 2px; border-radius: 8px; cursor: pointer;
  box-shadow: 0 0 28px rgba(0,188,212,0.25), inset 0 0 12px rgba(0,188,212,0.15);
  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
  font-family: inherit; white-space: nowrap;
  font-size: clamp(15px, 4.5vw, 22px);
  padding: 14px clamp(18px, 8vw, 48px);
}
.chjl-btn:hover {
  border-color: #00bcd4;
  box-shadow: 0 0 45px rgba(0,188,212,0.55), inset 0 0 18px rgba(0,188,212,0.25);
  transform: scale(1.02);
}

/* ── Footer ── */
.chjl-footer {
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 14px;
  transition: opacity 0.5s ease; z-index: 10;
}
.chjl-mic {
  width: 72px; height: 72px; border-radius: 50%;
  background: rgba(4,28,36,0.6);
  border: 1px solid rgba(0,188,212,0.3);
  display: none; /* skrytý — voice probíhá automaticky */
  justify-content: center; align-items: center;
  box-shadow: 0 0 22px rgba(0,188,212,0.12);
  animation: chjl-mic-pulse 3s infinite ease-in-out;
  cursor: pointer;
}
.chjl-mic svg { fill: #3ca9bd; width: 28px; height: 28px; transition: fill 0.3s; }
@keyframes chjl-mic-pulse {
  0%   { transform:scale(1);    box-shadow:0 0 22px rgba(0,188,212,0.12); border-color:rgba(0,188,212,0.3); }
  50%  { transform:scale(1.05); box-shadow:0 0 38px rgba(0,188,212,0.35); border-color:rgba(0,188,212,0.65); }
  100% { transform:scale(1);    box-shadow:0 0 22px rgba(0,188,212,0.12); border-color:rgba(0,188,212,0.3); }
}
.chjl-mic.listening {
  animation: none;
  border-color: rgba(0,188,212,0.8);
  box-shadow: 0 0 0 0 rgba(0,188,212,0.4);
  animation: chjl-mic-listen 1s infinite;
}
@keyframes chjl-mic-listen {
  0%,100% { box-shadow: 0 0 0 0 rgba(0,188,212,0.4); }
  50%     { box-shadow: 0 0 0 12px rgba(0,188,212,0); }
}

/* Text input */
.chjl-input-wrap {
  display: flex; align-items: center; gap: 8px;
  border-bottom: 1px solid rgba(0,188,212,0.15);
  padding-bottom: 4px; width: 200px;
  transition: border-color 0.3s;
}
.chjl-input-wrap:focus-within { border-color: rgba(0,188,212,0.5); }
.chjl-input {
  background: transparent; border: none; outline: none;
  color: #7ab8c8; font-family: inherit; font-size: 13px;
  width: 100%; caret-color: #00bcd4;
}
.chjl-input::placeholder { color: #3a7080; font-size: 13px; }
.chjl-send {
  background: none; border: none; cursor: pointer;
  color: #1e3a48; font-size: 16px; padding: 0; line-height: 1;
  transition: color 0.2s; flex-shrink: 0;
}
.chjl-send:hover { color: #00bcd4; }

/* Sources */
.chjl-sources {
  display: flex; gap: 12px; justify-content: center;
  margin-top: 24px; width: 100%;
  animation: chjl-fade-up 0.5s ease forwards;
}
@keyframes chjl-fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.chjl-src {
  flex: 1;
  background: rgba(6,182,212,0.05);
  border: 1px solid rgba(6,182,212,0.2);
  border-radius: 10px; padding: 14px 16px;
  cursor: pointer; text-align: left;
  transition: border-color 0.2s, background 0.2s;
}
.chjl-src:hover { border-color: rgba(6,182,212,0.5); background: rgba(6,182,212,0.1); }
.chjl-src-type { font-size: 9px; letter-spacing: 2px; color: #3ca9bd;
  font-family: monospace; margin-bottom: 6px; }
.chjl-src-title { font-size: 13px; color: #c8dfe8; line-height: 1.45; font-weight: 500;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.chjl-src-meta { font-size: 10px; color: #3a6a7a; margin-top: 5px; }
.chjl-src-badge { font-size: 9px; color: #22c55e; margin-top: 8px;
  letter-spacing: 1px; font-family: monospace; }

/* Source modal */
#chj-src-modal {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(1,4,6,0.92); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
#chj-src-modal.hidden { display: none; }
.chjl-modal-box {
  background: #0a1a22; border: 1px solid rgba(6,182,212,0.2);
  border-radius: 12px; max-width: 540px; width: 100%;
  max-height: 80vh; overflow-y: auto; padding: 28px 24px;
  position: relative;
}
.chjl-modal-close {
  position: absolute; top: 14px; right: 16px;
  background: none; border: none; color: #3ca9bd;
  font-size: 20px; cursor: pointer; line-height: 1;
}
.chjl-modal-type { font-size: 10px; letter-spacing: 2px; color: #3ca9bd; font-family: monospace; margin-bottom: 8px; }
.chjl-modal-title { font-size: 17px; color: #e2e8f0; font-weight: 500; margin-bottom: 6px; line-height: 1.4; }
.chjl-modal-meta { font-size: 12px; color: #4a7a8a; margin-bottom: 16px; }
.chjl-modal-body { font-size: 14px; color: #94a3b8; line-height: 1.7; }
.chjl-modal-body h3 { font-size: 15px; color: #c8dfe8; margin: 16px 0 6px; font-weight: 600; }
.chjl-modal-body h4 { font-size: 13px; color: #3ca9bd; margin: 12px 0 4px; font-weight: 600; letter-spacing: 1px; }
.chjl-modal-body p  { margin: 0 0 8px; }
.chjl-modal-body strong { color: #e2e8f0; }
.chjl-modal-link { display: inline-block; margin-top: 16px; font-size: 12px;
  color: #3ca9bd; text-decoration: none; letter-spacing: 1px; }
.chjl-modal-link:hover { color: #00bcd4; }

/* Footer v sleep-listening stavu — jen minimální input, bez mic */
#chj-launcher.sleeping .chjl-footer { opacity: 0; pointer-events: none; }
#chj-launcher.sleeping.listening .chjl-footer { opacity: 1 !important; pointer-events: all; }
#chj-launcher.sleeping:not(.listening) .chjl-mic { display: none !important; }
#chj-launcher.sleeping.listening .chjl-mic {
  display: flex !important;
  width: 36px; height: 36px;
  opacity: 0.4;
  animation: chjl-mic-pulse 3s infinite ease-in-out;
}

/* Speaking override — text viditelný i ze sleep stavu */
/* Musí být za sleep pravidly A mít vyšší specificitu (sleeping.speaking) */

/* Sleep state — nebula visible, branding hidden */
#chj-launcher.sleeping .chjl-footer     { opacity: 0 !important; pointer-events: none; }
#chj-launcher.sleeping .chjl-laser-wrap { opacity: 0 !important; }
#chj-launcher.sleeping .chjl-header     { opacity: 0 !important; pointer-events: none; }
#chj-launcher.sleeping .chjl-main       { opacity: 0 !important; pointer-events: none; }
#chj-launcher.sleeping .chjl-nebula     { opacity: 1; }
#chj-launcher:not(.sleeping) .chjl-nebula { opacity: 0; pointer-events: none; }

/* Speaking tijdens sleep — vyšší specificita než sleeping pravidla (stejná + .speaking) */
#chj-launcher.sleeping.speaking .chjl-main  { opacity: 1 !important; pointer-events: all !important; }
#chj-launcher.sleeping.speaking .chjl-alarm { opacity: 1 !important; transform: none !important; filter: none !important; }

/* Plynulé přechody mezi stavy */
.chjl-nebula     { transition: opacity 1.8s ease; }
.chjl-header     { transition: opacity 1.2s ease 0.8s; }  /* logo: po nebuле */
.chjl-laser-wrap { transition: opacity 1.0s ease 1.4s; }  /* laser: po logu */
.chjl-main       { transition: opacity 0.6s ease; }  /* text: bez delay — hlas začíná hned */
.chjl-footer     { transition: opacity 0.8s ease 2.2s; }  /* mic: poslední */

/* Nebula orb */
.chjl-nebula {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 1.2s ease;
  pointer-events: none;
}
.chjl-nebula-halo {
  position: absolute;
  width: 280px; height: 280px; border-radius: 50%;
  background: radial-gradient(circle,
    rgba(6,182,212,0.07) 0%,
    rgba(88,28,135,0.04) 50%,
    transparent 75%
  );
  filter: blur(22px);
  animation: chjl-halo 5s ease-in-out infinite;
}
.chjl-nebula-body {
  position: absolute;
  width: 170px; height: 170px;
  background: radial-gradient(ellipse at 38% 38%,
    rgba(14,40,60,0.95) 0%,
    rgba(6,20,35,0.98) 45%,
    rgba(2,8,18,1) 100%
  );
  box-shadow:
    0 0 50px rgba(6,182,212,0.10),
    0 0 100px rgba(6,182,212,0.05),
    inset 0 0 35px rgba(6,182,212,0.07);
  animation: chjl-morph 9s ease-in-out infinite,
             chjl-breathe 5s ease-in-out infinite;
}
.chjl-nebula-core {
  position: absolute;
  width: 60px; height: 60px; border-radius: 50%;
  background: radial-gradient(circle,
    rgba(6,182,212,0.18) 0%,
    rgba(6,182,212,0.05) 55%,
    transparent 100%
  );
  filter: blur(10px);
  animation: chjl-core 5s ease-in-out infinite;
}
.chjl-nebula canvas {
  position: absolute; inset: 0;
  pointer-events: none;
}
@keyframes chjl-morph {
  0%  { border-radius: 58% 42% 44% 56% / 52% 48% 52% 48%; }
  20% { border-radius: 42% 58% 56% 44% / 44% 56% 44% 56%; }
  40% { border-radius: 52% 48% 38% 62% / 60% 40% 60% 40%; }
  60% { border-radius: 44% 56% 62% 38% / 48% 52% 48% 52%; }
  80% { border-radius: 62% 38% 46% 54% / 40% 60% 38% 62%; }
  100%{ border-radius: 58% 42% 44% 56% / 52% 48% 52% 48%; }
}
@keyframes chjl-breathe {
  0%,100% { transform: scale(1);    opacity: 0.85; }
  50%      { transform: scale(1.08); opacity: 1; }
}
@keyframes chjl-halo {
  0%,100% { transform: scale(1);    opacity: 0.6; }
  50%      { transform: scale(1.18); opacity: 1; }
}
@keyframes chjl-core {
  0%,100% { transform: scale(1);   opacity: 0.5; }
  50%      { transform: scale(1.4); opacity: 1; }
}

/* Plovoucí ← tlačítko zpět do launcheru */
#chj-back-btn {
  position: fixed; bottom: 28px; left: 50%;
  transform: translateX(-50%);
  z-index: 9998;
  background: rgba(1,4,6,0.85);
  border: 1px solid rgba(0,188,212,0.2);
  color: #4a8fa0;
  font-family: monospace;
  font-size: 11px; letter-spacing: 3px;
  padding: 9px 22px;
  border-radius: 20px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.3s;
}
#chj-back-btn:hover {
  color: #00bcd4;
  border-color: rgba(0,188,212,0.5);
}
`;

// ── HTML ─────────────────────────────────────────────────────────────────────
const HTML = `
<style>${STYLE}</style>

<div class="chjl-star chjl-star-tl">✦</div>
<div class="chjl-star chjl-star-br">✦</div>
<div class="chjl-version">${CHJ_VERSION}</div>

<!-- STAV 1: Nebula (sleep state) -->
<div class="chjl-nebula" id="chjNebula">
  <canvas id="chjNebulaStars"></canvas>
  <div class="chjl-nebula-halo"></div>
  <div class="chjl-nebula-body"></div>
  <div class="chjl-nebula-core"></div>
</div>

<div class="chjl-header">
  <div class="chjl-logo">
    <div class="chjl-cursor"></div>
    <div class="chjl-text">
      <span class="chjl-row1">chytr<span class="chjl-ac">e</span></span>
      <span class="chjl-row2">j<span class="chjl-ac">a</span></span>
    </div>
  </div>
  <div class="chjl-sub">Medicína 3.0</div>
  <div class="chjl-laser-wrap">
    <div class="chjl-laser" id="chjLaser"></div>
  </div>
</div>

<div class="chjl-main">
  <div class="chjl-stage chjl-alarm" id="chjAlarm"></div>

  <div class="chjl-stage chjl-action" id="chjAction">
    <div id="chjActionText"></div>
    <div class="chjl-chips" id="chjChips"></div>
    <div class="chjl-timer" id="chjTimerWrap" style="display:none">
      <div class="chjl-timer-num" id="chjTimerNum">0:00</div>
      <button class="chjl-chip" id="chjBtn">[ Hotovo ]</button>
    </div>
    <div class="chjl-srcs-wrap" id="chjSrcsInline" style="display:none">
      <button class="chjl-srcs-back" id="chjSrcsBack">← zpět</button>
      <div class="chjl-sources" id="chjSources"></div>
    </div>
  </div>
</div>

<div id="chj-src-modal" class="hidden">
  <div class="chjl-modal-box">
    <button class="chjl-modal-close" id="chjModalClose">✕</button>
    <div class="chjl-modal-type" id="chjModalType"></div>
    <div class="chjl-modal-title" id="chjModalTitle"></div>
    <div class="chjl-modal-meta" id="chjModalMeta"></div>
    <div class="chjl-modal-body" id="chjModalBody"></div>
    <a class="chjl-modal-link" id="chjModalLink" target="_blank" rel="noopener">↗ OTEVŘÍT ZDROJ</a>
  </div>
</div>

<div class="chjl-footer" id="chjFooter">
  <div class="chjl-mic" id="chjMic">
    <svg viewBox="0 0 24 24">
      <path d="M12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14M17.3,11C17.3,14 14.76,16.2 12,16.2C9.24,16.2 6.7,14 6.7,11H5C5,14.41 7.72,17.23 11,17.72V21H13V17.72C16.28,17.23 19,14.41 19,11H17.3Z"/>
    </svg>
  </div>
  <div class="chjl-input-wrap" id="chjInputWrap">
    <input class="chjl-input" id="chjInput" type="text"
      placeholder="nebo napiš…" autocomplete="off">
    <button class="chjl-send" id="chjSend">↵</button>
  </div>
</div>
`;

// ── Node routing map ─────────────────────────────────────────────────────────
// Maps voice keywords → node IDs
// Pokrývá Lehkost i Longevity uzly — launcher rozpozná oba vesmíry
// Klíčová slova rozdělená podle modelu — "spánek" v longevity ≠ "spánek" v lehkost
const NODE_KEYWORDS = {
  lehkost: {
    'pohyb':      'lh_pohyb',
    'tělo':       'lh_pohyb',
    'telo':       'lh_pohyb',
    'cvičení':    'lh_pohyb',
    'cviceni':    'lh_pohyb',
    'chůze':      'lh_pohyb',
    'chuze':      'lh_pohyb',
    'regenerace': 'lh_regenerace',
    'spánek':     'lh_regenerace',
    'spanek':     'lh_regenerace',
    'spát':       'lh_regenerace',
    'odpočinek':  'lh_regenerace',
    'zdraví':     'lh_regenerace',
    'zdravi':     'lh_regenerace',
    'výživa':     'lh_vyziva',
    'výživu':     'lh_vyziva',
    'jídlo':      'lh_vyziva',
    'jidlo':      'lh_vyziva',
    'jím':        'lh_vyziva',
    'mysl':       'lh_mysl',
    'myšlení':    'lh_mysl',
    'stres':      'lh_mysl',
    'hlava':      'lh_mysl',
  },
  longevity: {
    'hra o život':  'dlouhovekost',
    'hra o zivot':  'dlouhovekost',
    'tělo':         'telo',
    'telo':         'telo',
    'síla':         'telo',
    'svaly':        'telo',
    'pohyb':        'telo',
    'zdraví':       'zdravi',
    'prevence':     'zdravi',
    'metabolismus': 'metabolicke',
    'cukr':         'metabolicke',
    'inzulín':      'metabolicke',
    'mysl':         'mysl',
    'mozek':        'mysl',
    'spánek':       'spanek',
    'spanek':       'spanek',
    'kardio':       'kardio',
    'srdce':        'kardio',
    'kondice':      'kardio',
    'výživa':       'vyziva',
    'protein':      'vyziva',
  },
  toc: {
    'průtok':       'toc',
    'prutok':       'toc',
    'hra o průtok': 'toc',
    'hra o prutok': 'toc',
    'omezení':      'toc',
    'strategie':    'toc_strategie',
    'finance':      'toc_finance',
    'výroba':       'toc_vyroba',
    'projekty':     'toc_projekty',
    'marketing':    'toc_marketing',
  },
  // common: prázdné — sdílená slova řeší tryRoute dynamicky
  common: {},
};

// ── State ────────────────────────────────────────────────────────────────────
let _phase = 'loading'; // loading | awake | action | timer | sleeping
let _bioData = null;    // { killer, pct, color, action, actionType, actionDuration, sources }
let _recognition = null;
// Briefing je on-demand — žádný auto-prewarm, uživatel iniciuje hlasem
let _sourcesBlob  = null;   // prefetchnutý blob pro sources odpověď
let _chj_speaking = false;  // guard: zabrání dvojímu spuštění hlasu

// ── Briefing prewarm ─────────────────────────────────────────────────────────
// Briefing je on-demand — uživatel iniciuje hlasem. Prewarm jen načte bio data.

// ── Typewriter ───────────────────────────────────────────────────────────────
// _typewriter(el, text, charDelay) — píše znak po znaku do elementu
function _typewriter(el, text, charDelay = 50) {
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    if (i >= text.length) { clearInterval(interval); return; }
    el.textContent += text[i];
    i++;
  }, charDelay);
}

// ── Nebula stars ─────────────────────────────────────────────────────────────
function _initNebulaStars() {
  const canvas = document.getElementById('chjNebulaStars');
  if (!canvas) return;
  const nebula = document.getElementById('chjNebula');
  canvas.width  = nebula.offsetWidth  || window.innerWidth;
  canvas.height = nebula.offsetHeight || window.innerHeight;
  canvas.style.position = 'absolute';
  canvas.style.inset    = '0';
  canvas.style.width    = '100%';
  canvas.style.height   = '100%';

  const ctx = canvas.getContext('2d');
  const stars = Array.from({ length: 70 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    r:     Math.random() * 1.1 + 0.2,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.006 + 0.002,
    base:  Math.random() * 0.4 + 0.1,
  }));

  let _running = true;
  function draw(t) {
    if (!_running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      const op = s.base * (0.4 + 0.6 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${op})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ── Mount ────────────────────────────────────────────────────────────────────
(function mount() {
  // Injektuj CSS okamžitě — skryj header, nastav tmavé body pozadí (zabraňuje přebliknutí)
  const hideHeaderStyle = document.createElement('style');
  hideHeaderStyle.id = 'chj-hide-header';
  hideHeaderStyle.textContent = `
    #appHeader { display: none !important; }
    body { background: #010406 !important; }
  `;
  document.head.appendChild(hideHeaderStyle);

  const el = document.createElement('div');
  el.id = 'chj-launcher';
  el.classList.add('sleeping'); // STAV 1: začínáme s nebulou
  el.innerHTML = HTML;

  // Block clicks going through while loading
  el.addEventListener('click', onLauncherClick);
  document.body.insertAdjacentElement('afterbegin', el);

  // Nebula hvězdy (Canvas 2D)
  _initNebulaStars();

  // Wire up controls (after insertion)
  document.getElementById('chjBtn').addEventListener('click', onHotovo);   // HOTOVO v timeru
  document.getElementById('chjSrcsBack').addEventListener('click', e => {  // ← zpět ze zdrojů
    e.stopPropagation();
    document.getElementById('chjSrcsInline').style.display = 'none';
    document.getElementById('chjActionText').style.display = '';
    document.getElementById('chjChips').style.display = 'flex';
  });
  document.getElementById('chjMic').addEventListener('click', onMicClick);
  document.getElementById('chjSend').addEventListener('click', onTextSend);
  document.getElementById('chjInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') onTextSend();
  });
  document.getElementById('chjInput').addEventListener('click', e => e.stopPropagation());
  document.getElementById('chjInputWrap').addEventListener('click', e => e.stopPropagation());

  // Source modal — zavření
  document.getElementById('chjModalClose').addEventListener('click', () =>
    document.getElementById('chj-src-modal').classList.add('hidden'));
  document.getElementById('chj-src-modal').addEventListener('click', e => {
    if (e.target.id === 'chj-src-modal')
      document.getElementById('chj-src-modal').classList.add('hidden');
  });

  // Start loading data (auth is handled by universe-init.js separately)
  loadBioData();
})();

// ── Data loading ─────────────────────────────────────────────────────────────
async function loadBioData() {
  try {
    // Wait for Firebase auth (universe-init sets window._chjUserId)
    const userId = await waitForUserId(8000);
    if (!userId) { showFallback(); return; }

    // Launcher vždy zobrazuje BIO stav z Longevity (dlouhovekost) — Bio-Vesmír je základ.
    // currentModel se použije jen pro routing hlasových příkazů (viz tryRoute).
    const url = `/api/hud-data-bulk?nodes=dlouhovekost&userId=${userId}&universe=longevity`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`hud-data-bulk ${res.status}`);
    const bulk = await res.json();
    const data = bulk.dlouhovekost || {};

    // Debug — viditelné v konzoli (F12)
    console.log('[CHJ Launcher] bio data:', { url, uid: userId, killer: data.killer, pct: data.battery?.percent });

    const rawPct = data.battery?.percent ?? 50;
    const pct    = rawPct > 0 ? rawPct : 50; // fallback to 50 if no data yet (new user)
    const killer = data.killer?.label ?? null;
    const action = data.action?.label ?? null;

    const killerText = killer
      ? killer.toLowerCase()
      : pct > 70 ? 'tělo v kondici'
      : pct > 40 ? 'energie pod střed'
      : 'přetížení regenerace';

    _bioData = {
      pct,
      killer: killerText,
      description: data.killer?.description ?? '',
      action: action || 'Odpočiň si a sleduj jak se cítíš.',
      actionType:     data.action?.type     || 'simple',
      actionDuration: data.action?.duration || 0,
      sources: data.sources || [],
      userId,
      color:  pct > 70 ? '#22c55e' : pct > 40 ? '#eab308' : '#ef4444',
      gradient: pct > 70
        ? 'linear-gradient(90deg, #0d3820, #22c55e)'
        : pct > 40
        ? 'linear-gradient(90deg, #2d1f00, #eab308)'
        : 'linear-gradient(90deg, #2d0808, #ef4444)',
    };

    // Bio data načtena — launcher čeká na uživatele (on-demand)
    _phase = 'sleeping';
  } catch (e) {
    console.warn('[CHJ Launcher] loadBioData failed:', e);
    showFallback();
  }
}

function getUid() {
  // chj_uid je uložené v localStorage po přihlášení — nejrychlejší zdroj
  return localStorage.getItem('chj_uid')
    || window.CHJ_UID
    || window.firebaseAuth?.currentUser?.uid
    || null;
}

function waitForUserId(timeoutMs) {
  return new Promise(resolve => {
    const uid = getUid();
    if (uid) { resolve(uid); return; }
    const start = Date.now();
    const t = setInterval(() => {
      const u = getUid();
      if (u) { clearInterval(t); resolve(u); }
      else if (Date.now() - start > timeoutMs) { clearInterval(t); resolve(null); }
    }, 200);
  });
}

function showFallback() {
  // Fallback data — čekáme na tap stejně jako s reálnými daty
  _bioData = {
    pct: 50, killer: 'energie pod střed', action: 'Řekni co chceš řešit.',
    description: '',
    color: '#eab308',
    gradient: 'linear-gradient(90deg, #2d1f00, #eab308)',
  };
  _phase = 'sleeping';
}

// ── Phases ───────────────────────────────────────────────────────────────────
function showAwake() {
  _phase = 'awake';
  const launcher = document.getElementById('chj-launcher');
  launcher.classList.remove('sleeping', 'listening');

  // Laser line — reset inline stylů, force reflow, pak animace
  const laser = document.getElementById('chjLaser');
  laser.style.width      = '';
  laser.style.background = '';
  laser.style.boxShadow  = '';
  void laser.offsetWidth;
  laser.style.width      = _bioData.pct + '%';
  laser.style.background = _bioData.gradient;
  laser.style.boxShadow  = `0 0 20px ${_bioData.color}, 0 0 8px ${_bioData.color}`;

  // Alarm text — prázdný, vyplní ho typewriter ze spoken textu při onplay
  const alarm = document.getElementById('chjAlarm');
  alarm.textContent     = '';
  alarm.style.opacity   = '1';
  alarm.style.transform = 'scale(1)';
  alarm.style.filter    = 'blur(0)';
  alarm.style.color     = '#8ba8b8';
  alarm.style.fontSize  = '';

  // Hide action
  const action = document.getElementById('chjAction');
  action.style.opacity      = '0';
  action.style.transform    = 'scale(0.97)';
  action.style.filter       = 'blur(14px)';
  action.style.pointerEvents = 'none';

  // Footer schovaný — zobrazí se až po akci
  document.getElementById('chjFooter').style.opacity = '0';
}

function showAction() {
  _phase = 'action';

  // Alarm fade out
  const alarm = document.getElementById('chjAlarm');
  alarm.style.opacity       = '0';
  alarm.style.transform     = 'scale(1.04)';
  alarm.style.filter        = 'blur(14px)';
  alarm.style.pointerEvents = 'none';

  setTimeout(() => {
    document.getElementById('chjActionText').textContent = _bioData.action;

    // Resetuj sub-views
    document.getElementById('chjTimerWrap').style.display = 'none';
    document.getElementById('chjSrcsInline').style.display = 'none';
    document.getElementById('chjSources').innerHTML = '';
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

    // Jen [ Hotovo ] — žádný Start, Później, Zdroje
    const chips = document.getElementById('chjChips');
    chips.innerHTML = '';
    chips.appendChild(_makeChip('[ Hotovo ]', 'chjl-chip', onHotovo));

    const action = document.getElementById('chjAction');
    action.style.opacity      = '1';
    action.style.transform    = 'scale(1)';
    action.style.filter       = 'blur(0)';
    action.style.pointerEvents = 'all';

    // Footer s diskrétním textovým polem (bez mic ikony)
    const footer = document.getElementById('chjFooter');
    if (footer) { footer.style.transition = 'opacity 0.8s ease'; footer.style.opacity = '1'; }

    // Pasivní STT — uživatel může říct "hotovo"
    if (window.matchMedia('(pointer: coarse)').matches) startPassiveListening();
  }, 180);
}

function _makeChip(label, cls, handler) {
  const btn = document.createElement('button');
  btn.className = cls;
  btn.textContent = label;
  btn.addEventListener('click', e => { e.stopPropagation(); handler(e); });
  return btn;
}

let _timerInterval = null;

function onStart(e) {
  if (e) e.stopPropagation();
  _phase = 'timer';

  // Skryj chipy, zobraz timer
  document.getElementById('chjChips').style.display = 'none';
  const timerWrap = document.getElementById('chjTimerWrap');
  timerWrap.style.display = 'flex';

  const duration = _bioData.actionDuration || 60;
  let remaining = duration;

  function fmt(s) {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}`;
  }

  document.getElementById('chjTimerNum').textContent = fmt(remaining);

  _timerInterval = setInterval(() => {
    remaining--;
    document.getElementById('chjTimerNum').textContent = fmt(remaining);
    if (remaining <= 0) {
      clearInterval(_timerInterval);
      _timerInterval = null;
      onHotovo(null);
    }
  }, 1000);
}

function onPozdeji(e) {
  if (e) e.stopPropagation();
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  goSleep(); // bez logování mise
}

function showSourcesInline(e) {
  if (e) e.stopPropagation();

  // Skryj action text + chipy, zobraz inline zdroje
  document.getElementById('chjActionText').style.display = 'none';
  document.getElementById('chjChips').style.display = 'none';
  const wrap = document.getElementById('chjSrcsInline');
  wrap.style.display = 'flex';

  const sourcesEl = document.getElementById('chjSources');
  sourcesEl.innerHTML = '';
  sourcesEl.style.display = 'flex';
  sourcesEl.style.flexDirection = 'column';
  sourcesEl.style.gap = '14px';

  (_bioData.sources || []).slice(0, 2).forEach(src => {
    const card = document.createElement('div');
    card.className = 'chjl-src';
    card.innerHTML = `
      <div class="chjl-src-type">${(src.type || 'article').toUpperCase()}</div>
      <div class="chjl-src-title">${src.title || ''}</div>
      <div class="chjl-src-meta">${[src.journal, src.year].filter(Boolean).join(' · ')}</div>
      <div class="chjl-src-badge">[${src.status || 'VERIFIED'}]</div>`;
    card.addEventListener('click', e => { e.stopPropagation(); openSourceModal(src); });
    sourcesEl.appendChild(card);
  });
}

// Po briefingu: sleep + zobraz text input pro hlasový/textový povel
// Po briefingu: sleep + zobraz text input pro hlasový/textový povel
function goSleepListening() {
  goSleep();
  document.getElementById('chj-launcher')?.classList.add('listening');
  // Spusť pasivní STT na všech zařízeních
  startPassiveListening();
}

function goSleep() {
  _phase = 'sleeping';
  const launcher = document.getElementById('chj-launcher');
  launcher.classList.add('sleeping');

  // Fade out action
  const action = document.getElementById('chjAction');
  action.style.opacity      = '0';
  action.style.transform    = 'scale(0.96)';
  action.style.filter       = 'blur(18px)';
  action.style.pointerEvents = 'none';

  // Laser off — čisti inline styly, CSS class vrátí width:0%
  const laser = document.getElementById('chjLaser');
  laser.style.width      = '';
  laser.style.background = '';
  laser.style.boxShadow  = 'none';

  // Reset timer + chipy
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  setTimeout(() => {
    const alarm = document.getElementById('chjAlarm');
    alarm.textContent = '';
    alarm.style.opacity = '0';
    document.getElementById('chjFooter').style.opacity = '1';
    document.getElementById('chjSources').innerHTML = '';
    document.getElementById('chjChips').style.display = 'flex';
    document.getElementById('chjTimerWrap').style.display = 'none';
    document.getElementById('chjSrcsInline').style.display = 'none';
  }, 500);

  // Mobil: pasivní poslouchání, Desktop: tap-to-talk
  if (window.matchMedia('(pointer: coarse)').matches) startPassiveListening();
}

// ── Routing — open universe node ─────────────────────────────────────────────
function routeToNode(nodeId) {
  const launcher = document.getElementById('chj-launcher');

  // Přepni vesmír podle prefixu uzlu (lh_ → lehkost, toc → toc, ostatní → longevity)
  const targetModel = nodeId
    ? (nodeId.startsWith('lh_') ? 'lehkost'
      : (nodeId === 'toc' || nodeId.startsWith('toc_')) ? 'toc'
      : 'longevity')
    : null;

  const currentModel = localStorage.getItem('currentModel');
  const needsSwitch  = targetModel && targetModel !== currentModel;

  // Zastav pasivní poslouchání — onend nesmí restartovat po routingu
  _phase = 'routing';
  if (_recognition) { try { _recognition.stop(); } catch(_) {} _recognition = null; }

  // Odstraň sleeping/listening před fade-out — zabrání CSS konfliktům
  launcher.classList.remove('sleeping', 'listening');

  const doOpen = () => {
    if (nodeId && window._openNodeById) {
      window._openNodeById(nodeId);
    }
    // null nodeId = jen odhali canvas (universe běží za laucherem)
  };

  // Vrať hlavičku appky — odstraň CSS inject
  document.getElementById('chj-hide-header')?.remove();

  const fadeOut = () => {
    // Nejdřív otevři uzel (launcher ho ještě zakrývá), pak teprve fade
    doOpen();
    setTimeout(() => launcher.classList.add('fade-out'), 300);
  };

  if (needsSwitch && window._loadAndRenderModel) {
    localStorage.setItem('currentModel', targetModel);
    const role = localStorage.getItem('userRole') || 'demo';
    window._loadAndRenderModel(targetModel, role).then(fadeOut).catch(fadeOut);
  } else {
    fadeOut();
  }

  setTimeout(() => {
    launcher.classList.add('fade-out'); // fallback
    setTimeout(() => {
      launcher.style.display = 'none';
      // Injektuj plovoucí ← tlačítko zpět
      if (!document.getElementById('chj-back-btn')) {
        const btn = document.createElement('button');
        btn.id = 'chj-back-btn';
        btn.textContent = '← CHJ';
        btn.onclick = () => {
          btn.remove();
          launcher.style.display = 'flex';
          launcher.classList.remove('fade-out');
          launcher.style.opacity = '1';
          // Znovu skryj header
          if (!document.getElementById('chj-hide-header')) {
            const s = document.createElement('style');
            s.id = 'chj-hide-header';
            s.textContent = '#appHeader { display: none !important; } body { background: #010406 !important; }';
            document.head.appendChild(s);
          }
          // Vrať nebulu + listening stav, spusť STT
          launcher.classList.add('sleeping', 'listening');
          _phase = 'sleeping';
          startPassiveListening();
        };
        document.body.appendChild(btn);
      }
    }, 650);
  }, 150);
}

// ── Voice ────────────────────────────────────────────────────────────────────
function onMicClick(e) {
  e.stopPropagation();
  if (_phase === 'routing') return;
  if (_recognition) { try { _recognition.stop(); } catch(_) {} _recognition = null; }
  listenOnce(transcript => _handleCommand(transcript));
}


function startPassiveListening() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return;
  if (_recognition) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function spawnSession() {
    if (_phase !== 'sleeping' || _recognition) return;
    const r = new SR();
    r.lang = 'cs-CZ'; r.continuous = false; r.interimResults = false; r.maxAlternatives = 1;
    let blocked = false;

    r.onresult = e => {
      const t = e.results[0][0].transcript.toLowerCase();
      console.log('[CHJ Passive] heard:', t);
      _handleCommand(t);
    };
    r.onerror = e => {
      console.warn('[CHJ Passive] error:', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') blocked = true;
    };
    r.onend = () => {
      _recognition = null;
      if (_phase === 'sleeping' && !blocked) setTimeout(spawnSession, 300);
    };
    _recognition = r;
    try { r.start(); } catch(err) { _recognition = null; }
  }

  spawnSession();
}

function listenOnce(cb) {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = document.getElementById('chjMic');

  function attempt(tries) {
    if (tries <= 0) { _recognition = null; mic.classList.remove('listening'); return; }
    const r = new SR();
    r.lang = 'cs-CZ'; r.continuous = false; r.interimResults = false;
    _recognition = r;

    r.onresult = e => {
      const t = e.results[0][0].transcript.toLowerCase();
      console.log('[CHJ] heard:', t);
      _recognition = null;
      mic.classList.remove('listening');
      cb(t);
    };
    r.onerror = e => {
      console.warn('[CHJ] STT:', e.error);
      _recognition = null;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        mic.classList.remove('listening'); return;
      }
      setTimeout(() => attempt(tries - 1), 200);
    };
    r.onend = () => { if (_recognition === r) _recognition = null; };
    try { r.start(); } catch(err) { _recognition = null; mic.classList.remove('listening'); }
  }

  mic.classList.add('listening');
  attempt(5);
}

// Hlavní uzly pro každý model
const MAIN_NODE = { longevity: 'dlouhovekost', lehkost: 'lh_main', toc: 'toc' };
const HOME_PHRASES = ['chytré já', 'chytre ja', 'přehled', 'hlavní', 'domů', 'domu'];

function tryRoute(transcript) {
  const model = localStorage.getItem('currentModel') || 'longevity';

  // "domů / přehled / chytré já" → hlavní uzel aktivního modelu
  for (const phrase of HOME_PHRASES) {
    if (transcript.includes(phrase)) {
      routeToNode(MAIN_NODE[model] || 'dlouhovekost');
      return true;
    }
  }

  // Jen klíčová slova aktivního modelu — bez přepínání vesmírů
  const kws = NODE_KEYWORDS[model] || {};
  for (const [kw, nodeId] of Object.entries(kws)) {
    if (transcript.includes(kw)) {
      routeToNode(nodeId);
      return true;
    }
  }
  return false;
}

// ── Command handler ──────────────────────────────────────────────────────────
const SOURCES_KEYWORDS  = ['proč', 'proc', 'zdroje', 'zdroj', 'studie', 'víc', 'vic',
  'řekni mi víc', 'rekni mi vic', 'důkaz', 'dukaz', 'odkud to víš', 'proc to'];

const RECOMMEND_PHRASES = ['co dál', 'co dal', 'co teď', 'co ted', 'co mám dělat',
  'co mam delat', 'poraď', 'porad', 'další krok', 'dalsi krok', 'co doporučuješ', 'co dal'];

async function _handleCommand(text) {
  // Ignoruj všechny příkazy dokud CHJ mluví (echo z reproduktoru)
  if (_chj_speaking) return true;

  const t = text.toLowerCase().trim();

  // 1. "Co dál?" — multikriteriální doporučení
  if (RECOMMEND_PHRASES.some(kw => t.includes(kw))) {
    await _doRecommend();
    return true;
  }

  // 2. Zdroje
  if (SOURCES_KEYWORDS.some(kw => t.includes(kw))) {
    _doSources();
    return true;
  }

  // 3. Navigace na uzel (max 4 slova)
  if (t.split(/\s+/).length <= 4) {
    if (tryRoute(t)) return true;
  }

  // 4. Volné dotazy → AI (fallback)
  return false;
}

// "Co dál?" — zavolá API s bio kontextem, přehraje odpověď, vrátí do nebuly
async function _doRecommend() {
  _chj_speaking = true; // nastav HNED — blokuje echo triggery během celého fetch
  if (_recognition) { try { _recognition.stop(); } catch(_) {} _recognition = null; }

  const context = {
    mode:   'recommend',
    hour:   new Date().getHours(),
    userId: _bioData?.userId ?? null,
    role:   localStorage.getItem('userRole') || 'longevity',
    toc:    null, // TODO: TOC bottleneck až bude vrstva aktivní
  };

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(`TTS ${res.status}: ${d.detail || d.error || '?'}`);
    }
    const spokenText = decodeURIComponent(res.headers.get('X-CHJ-Text') || '');
    const url      = URL.createObjectURL(await res.blob());
    const audio    = new Audio(url);
    const laser    = document.getElementById('chjLaser');
    const launcher = document.getElementById('chj-launcher');

    const cleanup = () => {
      laser?.classList.remove('speaking');
      launcher?.classList.remove('speaking');
      URL.revokeObjectURL(url);
      _chj_speaking = false;
    };

    audio.onplay = () => {
      laser?.classList.add('speaking');
      launcher?.classList.add('speaking'); // odkryje .chjl-main přes CSS override
      const alarm = document.getElementById('chjAlarm');
      if (alarm && spokenText) {
        alarm.textContent = '';
        _typewriter(alarm, spokenText, 48);
      }
    };
    audio.onended = () => { cleanup(); setTimeout(() => goSleepListening(), 600); };
    audio.onerror = () => cleanup();
    audio.play().catch(e => { console.warn('[CHJ] recommend play blocked:', e); cleanup(); });
  } catch (e) {
    console.warn('[CHJ] _doRecommend failed:', e);
  }
}

// Vrátí nejlepší zdroj (preferuj script_cz)
function _bestSource() {
  const sources = _bioData?.sources || [];
  return sources.find(s => s.script_cz) || sources[0] || null;
}

// Sestaví spoken text pro zdroje — jen název + journal (krátké)
function _buildSourcesText() {
  const src = _bestSource();
  if (!src) return 'Ke téhle akci teď nemám konkrétní studie.';
  return `${src.title}${src.journal ? ', ' + src.journal : ''}.`;
}

// Prefetch sources audio na pozadí (volá se po goSleepListening)
async function _prewarmSources() {
  const text = _buildSourcesText();
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    _sourcesBlob = URL.createObjectURL(await res.blob());
  } catch (e) {
    console.warn('[CHJ] prewarm sources failed:', e);
  }
}

// Přečte první zdroj + otevře ho rovnou v modalu
function _doSources() {
  if (_chj_speaking) return; // nikdy neotevírat zatímco CHJ mluví
  const sources = _bioData?.sources || [];

  // Zavři HUD panel pokud je otevřený
  if (window.closePanel) window.closePanel();

  _sourcesBlob = null; // zahod prewarm — nečteme nahlas

  // Otevři nejlepší zdroj rovnou v modalu
  const best = _bestSource();
  if (best) openSourceModal(best);
}

// Přehraje libovolný text přes ElevenLabs (Mode A — přímý text)
// blobUrl: pokud je předpřipravený blob, použij ho (synchronní play pro iOS)
async function _speakText(text, blobUrl = null) {
  const laser = document.getElementById('chjLaser');
  const play = (url, revoke) => {
    const audio = new Audio(url);
    audio.onplay  = () => laser?.classList.add('speaking');
    audio.onended = () => {
      laser?.classList.remove('speaking');
      if (revoke) URL.revokeObjectURL(url);
    };
    audio.play().catch(e => console.warn('[CHJ] play blocked:', e));
  };

  if (blobUrl) {
    // Synchronní — iOS gesture ok
    play(blobUrl, true);
    return;
  }

  // Async fallback (desktop)
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    play(URL.createObjectURL(await res.blob()), true);
  } catch (e) {
    console.warn('[CHJ] _speakText failed:', e);
  }
}

// ── Text input ───────────────────────────────────────────────────────────────
async function onTextSend() {
  const input = document.getElementById('chjInput');
  const text  = input.value.trim();
  input.value = '';

  if (!text) return;

  // Command handler — zdroje, navigace
  const handled = await _handleCommand(text);
  if (handled) return;

  // Otherwise send to AI and show response as action
  if (_phase !== 'action') {
    document.getElementById('chjActionText').textContent = '…';
    showAction();
  }

  try {
    const userId = getUid() || '';
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, userId, nodeId: 'lh_main', mode: 'launcher' }),
    });
    const data = await res.json();
    document.getElementById('chjActionText').textContent =
      data.reply || data.message || data.text || text;
  } catch (e) {
    document.getElementById('chjActionText').textContent =
      'Teď to nejde. Zkus to znovu.';
  }
}

// ── Click handler ─────────────────────────────────────────────────────────────
function onLauncherClick(e) {
  if (e.target.closest('#chjBtn,#chjMic,#chjInputWrap,#chjChips,#chjSrcsInline')) return;
  if (_phase === 'awake') {
    // Tap na awake — spusť STT pokud neprobíhá
    if (!_chj_speaking) onMicClick();
  }
  else if (_phase === 'sleeping') {
    showAwake();
  }
  // 'action', 'timer', 'done' — klik nic nedělá
}

// ── HOTOVO ───────────────────────────────────────────────────────────────────
function onHotovo(e) {
  if (e) e.stopPropagation();
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  // Zaloguj splněnou misi
  const userId = getUid();
  if (userId) {
    const model = localStorage.getItem('currentModel') || 'longevity';
    const nodeId = model === 'lehkost' ? 'lh_main' : 'dlouhovekost';
    fetch('/api/mission-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, nodeId }),
    }).catch(err => console.warn('[CHJ] mission-complete failed:', err));
  }
  goSleep();
}

// ── Source modal ─────────────────────────────────────────────────────────────
function renderMd(text) {
  return text
    .split('\n')
    .map(line => {
      if (/^### (.+)/.test(line)) return `<h4>${line.replace(/^### /, '')}</h4>`;
      if (/^## (.+)/.test(line))  return `<h3>${line.replace(/^## /, '')}</h3>`;
      if (/^\|/.test(line))       return ''; // skip markdown tables
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
      return line.trim() ? `<p>${line}</p>` : '';
    })
    .join('');
}

function openSourceModal(src) {
  document.getElementById('chjModalType').textContent  = src.type || 'ARTICLE';
  document.getElementById('chjModalTitle').textContent = src.title || '';
  document.getElementById('chjModalMeta').textContent  = [src.journal, src.year].filter(Boolean).join(' · ');

  const body = document.getElementById('chjModalBody');
  const raw = src.script_cz || src.summary || '';
  if (raw) {
    body.innerHTML = renderMd(raw);
  } else {
    body.innerHTML = '<p>Otevři odkaz pro plný text zdroje.</p>';
  }

  const link = document.getElementById('chjModalLink');
  if (src.url) { link.href = src.url; link.style.display = 'inline-block'; }
  else { link.style.display = 'none'; }

  document.getElementById('chj-src-modal').classList.remove('hidden');
}


// ── Public API (for universe-init to call) ───────────────────────────────────
window.chjLauncher = {
  hide:    () => routeToNode(null),
  sleep:   goSleep,
  wake:    showAwake,
  version: CHJ_VERSION,
};

// ── Expose hideSplash alias for compatibility ─────────────────────────────────
window.hideSplash = () => {
  // Legacy alias — do nothing, launcher manages its own lifecycle
};
