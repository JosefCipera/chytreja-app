// === UNIVERSE-PANEL.JS ===
// Pravý panel – Chytré já brífink + smart chips + živý chat
// Refactored: game logic in game-engine.js, data queries in data-layer.js
console.log("PANEL JS LOADED");

import {
  DEMO_PREVIEWS, ACTIVE_MOTTOS, getDemoPreview,
  NODE_RIDERS, RIDER_ICONS, getRiders,
  VERDICT_TEXTS, KILLER_TEXTS, NODE_KILLERS, generateVerdict,
  DAILY_MISSIONS, pickMission
} from './game-engine.js';

import {
  fetchAspiration, fetchLearningSteps, drawMiniTrend, drawIndexLabel, fetchTrend
} from './data-layer.js';

import { aiSpeak } from './universe-voice.js';

import { runSkill, hasSkill } from './skill-router.js';

// Game constants + data fetching imported from modules (see imports above)

// Formátování CHJ textu: 1. věta tight, každá další věta s půlřádkovým odsazením dolů
function formatChjText(text) {
  const parts = (text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return text || '';
  return parts.map((p, i) =>
    i === 0
      ? `<span style="display:block;">${p}</span>`
      : `<span style="display:block; margin-top:0.55em;">${p}</span>`
  ).join('');
}

function showLockedPanel(node) {
  const preview = getDemoPreview(node.id);

  // Nadpis
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) {
    titleEl.innerHTML = `${node.icon || ''} ${node.label || ''}`;
  }

  // Skryj chat input – gray uzly nemají AI chat
  const aiSection = document.getElementById('aiPanelSection');
  if (aiSection) aiSection.style.display = 'none';

  const card = document.createElement('div');
  card.className = 'chj-card dynamic-section';

  if (preview.vhled_1 || preview.vhled_2 || preview.doplneni) {
    // ── Nový formát: vhled / doplneni / napojeni ──
    card.innerHTML = `
      <div class="locked-panel-inner">
        <div class="locked-badge">🔒 Připravujeme pro tebe</div>
        ${(preview.vhled_1 || preview.vhled_2) ? `
        <div class="locked-section">
          <div class="locked-section-label">Vhled</div>
          ${preview.vhled_1 ? `<p class="locked-insight">${preview.vhled_1}</p>` : ''}
          ${preview.vhled_2 ? `<p class="locked-insight">${preview.vhled_2}</p>` : ''}
        </div>` : ''}
        ${preview.doplneni ? `
        <div class="locked-section">
          <div class="locked-section-label">Co budeme sledovat</div>
          <p class="locked-desc">${preview.doplneni}</p>
        </div>` : ''}
        ${preview.napojeni ? `
        <div class="locked-section">
          <div class="locked-section-label">Propojíme s</div>
          <div class="locked-sensor-item">${preview.napojeni}</div>
        </div>` : ''}
      </div>
    `;
  } else {
    // ── Starý formát: text / tracks / sensors (původní locked uzly) ──
    const { text = '', tracks = [], sensors = [] } = preview;
    card.innerHTML = `
      <div class="locked-panel-inner">
        <div class="locked-badge">🔒 Připravujeme pro tebe</div>
        <h3 class="locked-hook">Tohle tě čeká?</h3>
        ${text ? `<p class="locked-desc">${text}</p>` : ''}
        ${tracks.length ? `
        <div class="locked-section">
          <div class="locked-section-label">Co budeme sledovat</div>
          ${tracks.map(t => `<div class="locked-track-item">• ${t}</div>`).join('')}
        </div>` : ''}
        ${sensors.length ? `
        <div class="locked-section">
          <div class="locked-section-label">Propojíme s</div>
          ${sensors.map(s => `<div class="locked-sensor-item">📡 ${s}</div>`).join('')}
        </div>` : ''}
        <button class="locked-cta-btn" onclick="alert('Pro verze přijde brzy! 🚀')">Odemknout v Pro →</button>
      </div>
    `;
  }

  const panelHeader = document.querySelector('.panel-header');
  if (panelHeader) panelHeader.after(card);
}

// =====================================================
// STYLES  (injektujeme jednou při načtení modulu)
// =====================================================

if (!document.getElementById('chj-panel-styles')) {
  const s = document.createElement('style');
  s.id = 'chj-panel-styles';
  s.textContent = `
    .chj-dots {
      display: inline-block;
      color: #64748b;
      font-size: 22px;
      letter-spacing: 8px;
      animation: chj-breathe 1.2s ease-in-out infinite;
    }
    @keyframes chj-breathe {
      0%, 100% { opacity: 0.15; }
      50%       { opacity: 0.9;  }
    }
    #aiPanelInput:disabled,
    #ai-send:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Node motto (barevné uzly) ── */
    .node-motto {
      font-size: 15px;
      color: #e2e8f0;
      font-style: italic;
      line-height: 1.65;
      padding: 8px 20px 2px;
      margin: 4px 0 0;
    }

    /* ── Locked panel ── */
    .locked-panel-inner {
      background: linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%);
      border: 1px solid #312e81;
      border-radius: 14px;
      padding: 22px 20px 20px;
      margin: 15px 0;
    }
    .locked-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #fbbf24;
      background: rgba(251,191,36,0.12);
      border: 1px solid rgba(251,191,36,0.35);
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 14px;
    }
    .locked-hook {
      font-size: 21px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 10px;
      line-height: 1.25;
    }
    .locked-desc {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.65;
      margin: 0 0 20px;
    }
    .locked-section {
      margin-bottom: 16px;
    }
    .locked-section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #60a5fa;
      margin-bottom: 8px;
    }
    .locked-insight {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.65;
      margin: 0 0 10px;
    }
    .locked-track-item {
      font-size: 14px;
      color: #f1f5f9;
      padding: 4px 0;
      font-weight: 500;
      line-height: 1.4;
    }
    .locked-sensor-item {
      font-size: 13px;
      color: #94a3b8;
      padding: 3px 0;
    }
    .locked-cta-btn {
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 13px 16px;
      background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      letter-spacing: 0.4px;
      transition: opacity 0.18s;
      box-shadow: 0 4px 14px rgba(99,102,241,0.4);
    }
    .locked-cta-btn:hover { opacity: 0.82; }
  `;
  document.head.appendChild(s);
}

// =====================================================
// PANEL CORE
// =====================================================

const panelEl = document.getElementById("sidePanel");

export function closePanel() {
  if (panelEl) {
    panelEl.classList.remove("open", "visible");
    setTimeout(() => { panelEl.style.display = "none"; }, 300);
    document.body.classList.remove("panel-open");
  }
  // Show HUD when panel closes
  import('./hud.js').then(m => m.showHUD()).catch(() => {});
}

const closeBtn = document.getElementById("closePanel");
if (closeBtn) closeBtn.onclick = () => closePanel();
window.closePanel = closePanel;

function resetPanel() {
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) titleEl.innerHTML = "";
  document.querySelectorAll(".metric-card, .chj-card, .dynamic-section, hr.dynamic-hr").forEach(el => el.remove());
  const msgs = document.getElementById('ai-integrated-msgs');
  if (msgs) msgs.innerHTML = "";
  const panel = document.getElementById('sidePanel');
  if (panel) panel.scrollTop = 0;
}

export async function showPanel(node, options = {}) {
  // v0.2+: non-GRAY nodes open in Svelte HUD overlay (only explicit click)
  if (node.state !== 'GRAY' && !options.skipHud) {
    const uid = window.CHJ_UID || window.firebaseAuth?.currentUser?.uid;
    if (uid && window.openHudOverlay) {
      window.openHudOverlay(uid, node.id);
      return;
    }
  }

  // Zavři HUD overlay pokud je otevřený (šedé uzly jdou do vanilla panelu)
  if (typeof window.closeHudOverlay === 'function') window.closeHudOverlay();

  // Fallback: GRAY (locked) nodes or no auth → vanilla panel
  if (!panelEl) return;

  const wasOpen = panelEl.classList.contains('open');

  panelEl.style.transition = "none";
  if (!wasOpen) {
    panelEl.style.visibility = "hidden";
    panelEl.classList.remove("open", "visible");
  }

  resetPanel();

  if (node.state === 'GRAY') {
    showLockedPanel(node);
  } else {
    showGameOfLife(node, options);
  }

  panelEl.style.display = "block";
  panelEl.style.visibility = "visible";
  panelEl.classList.add("open", "visible");
  document.body.classList.add("panel-open");
  import('./hud.js').then(m => m.hideHUD()).catch(() => {});

  requestAnimationFrame(() => { panelEl.style.transition = ""; });
}

// Data fetching + game logic imported from modules (see imports above)


// =====================================================
// VIEWER MODAL  (iFrame → /app/viewer.html)
// =====================================================

const TYPE_MAP = { markdown: 'md', pdf: 'pdf', video: 'video', audio: 'audio', image: 'image', gif: 'image' };

function detectType(url) {
  if (!url) return 'md';
  if (url.endsWith('.md')) return 'md';
  if (url.endsWith('.pdf')) return 'pdf';
  if (url.match(/\.(mp4|webm|mov)$/i)) return 'video';
  if (url.match(/\.(mp3|ogg|wav|m4a)$/i)) return 'audio';
  if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) return 'image';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  return 'md';
}

let _currentViewerClose = null;

window.addEventListener('message', e => {
  if (e.data === 'closeViewer' && _currentViewerClose) {
    _currentViewerClose();
  }
  // Handle source card clicks from HUD iframe (only on app/app.html — index.html has its own openSourceViewer)
  if (e.data?.type === 'chj:source:open' && typeof window.openSourceViewer !== 'function') {
    const src = e.data.source;
    if (!src?.url) return;
    const u = src.url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) { openViewerModal(src.url, 'video', src.title || ''); return; }
    if (u.match(/\.pdf(\?|$)/)) { openViewerModal(src.url, 'pdf', src.title || ''); return; }
    if (u.match(/\.(mp3|ogg|wav|m4a)(\?|$)/)) { openViewerModal(src.url, 'audio', src.title || ''); return; }
    if (u.match(/\.(md|markdown)(\?|$)/)) { _openArticleModal(src.url, src.title || ''); return; }
    window.open(src.url, '_blank');
  }
});

// Inline MD article modal — no iframe, SVG buttons always render on mobile
function _openArticleModal(url, title) {
  document.getElementById('viewerModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'viewerModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,14,0.97);display:flex;flex-direction:column;z-index:10000;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
  modal.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid rgba(6,182,212,0.18);display:flex;align-items:center;gap:8px;flex-shrink:0;min-height:48px;">
      <span style="font-family:monospace;font-size:11px;color:#64748b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title || ''}</span>
      <button id="vm-tts" title="Přehrát" style="background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;cursor:pointer;padding:6px 8px;line-height:0;flex-shrink:0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
      </button>
      <button id="vm-close" title="Zavřít" style="background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#94a3b8;cursor:pointer;padding:4px 9px;font-size:20px;line-height:1;flex-shrink:0;">&times;</button>
    </div>
    <div id="vm-body" style="flex:1;overflow-y:auto;padding:22px 18px 40px;scrollbar-width:thin;scrollbar-color:#1e40af rgba(0,0,0,0.2);">
      <style>#vm-body::-webkit-scrollbar{width:3px}#vm-body::-webkit-scrollbar-thumb{background:#1e40af;border-radius:2px}</style>
      <div style="color:#475569;font-size:13px;font-family:monospace;text-align:center;padding-top:40px;">NAČÍTÁM…</div>
    </div>`;
  document.body.appendChild(modal);

  const closeModal = () => { modal.style.opacity = '0'; modal.style.transition = 'opacity 0.18s'; setTimeout(() => modal.remove(), 180); };
  _currentViewerClose = closeModal;
  document.getElementById('vm-close').onclick = closeModal;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  const escHandler = e => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);

  let _ttsActive = false;
  const ttsBtn = document.getElementById('vm-tts');
  ttsBtn.onclick = () => {
    if (_ttsActive) {
      window.speechSynthesis?.cancel();
      _ttsActive = false;
      ttsBtn.style.color = '#94a3b8';
      return;
    }
    const text = (document.getElementById('vm-body')?.innerText || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').trim();
    if (!text) return;
    _ttsActive = true;
    ttsBtn.style.color = '#f87171';
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'cs-CZ'; utt.rate = 1.05; utt.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const cz = voices.find(v => /cs[-_]CZ/i.test(v.lang));
    if (cz) utt.voice = cz;
    utt.onend = utt.onerror = () => { _ttsActive = false; ttsBtn.style.color = '#94a3b8'; };
    window.speechSynthesis.speak(utt);
  };

  fetch(url)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then(md => {
      const html = window.CHJ_convertMd ? window.CHJ_convertMd(md) : `<pre style="white-space:pre-wrap;color:#8b9fc4;font-size:14px;">${md}</pre>`;
      const body = document.getElementById('vm-body');
      if (body) body.innerHTML = `<div style="max-width:720px;margin:0 auto;color:#8b9fc4;font-size:15.5px;line-height:1.7;font-family:system-ui,sans-serif;">${html}</div>`;
    })
    .catch(err => {
      const body = document.getElementById('vm-body');
      if (body) body.innerHTML = `<p style="color:#f87171;padding:16px;font-family:monospace;font-size:13px;">Nelze načíst dokument.<br><small style="color:#64748b;">${err.message}</small></p>`;
    });
}

function openViewerModal(fileUrl, type, title, onBack = null, scriptCz = null) {
  document.getElementById('viewerModal')?.remove();

  // PDF → fetch+blob do modálu (blob: URL obchází X-Frame-Options a CORS)
  if (type === 'pdf') {
    const modal = document.createElement('div');
    modal.id = 'viewerModal';
    // opacity: 1 hned – žádný fade-in (zabraňuje záblesku panelu)
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      z-index: 10000;
      transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 20px; background:#0f172a; border-bottom:1px solid #1e293b; flex-shrink:0;
      ">
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="color:#94a3b8; font-size:14px; font-weight:500;">📕 ${title || 'PDF'}</span>
          <a href="${fileUrl}" target="_blank" style="
            color:#60a5fa;font-size:13px;text-decoration:none;
            padding:4px 10px;border:1px solid rgba(96,165,250,0.3);border-radius:6px;
            background:rgba(96,165,250,0.08);transition:all 0.15s;
          " onmouseover="this.style.background='rgba(96,165,250,0.18)'" onmouseout="this.style.background='rgba(96,165,250,0.08)'">↗ Otevřít</a>
        </div>
        <button id="closeViewerModal" style="
          background:transparent;border:none;color:#94a3b8;
          font-size:24px;cursor:pointer;padding:4px 8px;
          border-radius:6px;line-height:1;transition:all 0.2s;
        ">&times;</button>
      </div>
      <div id="pdfContainer" style="flex:1;width:100%;background:#0a0f1e;display:flex;align-items:center;justify-content:center;">
        <div style="color:#64748b;font-size:14px;">Načítám PDF…</div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeViewer = () => {
      _currentViewerClose = null;
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 200);
    };
    _currentViewerClose = closeViewer;
    // Přechod zpět: okamžité odebrání (bez fade) aby mezi modály nebyl záblesk panelu
  const closeAndBack = () => {
    if (onBack) {
      _currentViewerClose = null;
      modal.remove();
      onBack();
    } else {
      closeViewer();
    }
  };

    const btn = document.getElementById('closeViewerModal');
    btn.onclick = closeAndBack;
    btn.onmouseenter = () => { btn.style.background = 'rgba(239,68,68,0.2)'; btn.style.color = '#ef4444'; };
    btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#94a3b8'; };
    modal.addEventListener('click', e => { if (e.target === modal) closeAndBack(); });
    const escHandler = e => {
      if (e.key === 'Escape') { closeAndBack(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    // 1. Pokus: fetch+blob → <object type="application/pdf"> (nejlépe funguje v prohlížeči)
    // 2. Fallback: Google Docs Viewer (veřejné PDF přes Google servery)
    // 3. Vždy je v hlavičce záložní odkaz "Otevřít ↗"
    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(blob => {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(pdfBlob);
        const container = document.getElementById('pdfContainer');
        if (container) {
          container.innerHTML = `<object data="${blobUrl}" type="application/pdf" style="width:100%;height:100%;border:none;"><p style="color:#94a3b8;padding:16px;text-align:center;">PDF viewer není dostupný.<br>Použij tlačítko <em>Otevřít</em> v záhlaví.</p></object>`;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
        }
      })
      .catch(() => {
        const container = document.getElementById('pdfContainer');
        if (container) {
          const gdocUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
          container.innerHTML = `<iframe src="${gdocUrl}" style="width:100%;height:100%;border:none;" allow="fullscreen"></iframe>`;
        }
      });
    return;
  }

  // MD: delegate to openSourceViewer (inline render with print/download/TTS buttons)
  // This works on both desktop and mobile — no iframe, no missing buttons
  if (type === 'md' && typeof window.openSourceViewer === 'function') {
    window.openSourceViewer({ url: fileUrl, title, type: 'md' });
    return;
  }

  const isAudio = type === 'audio';
  const scriptCzParam = scriptCz ? `&script_cz=${encodeURIComponent(scriptCz)}` : '';
  const viewerSrc = `/app/viewer.html?type=${encodeURIComponent(type)}&file=${encodeURIComponent(fileUrl)}${scriptCzParam}`;

  const modal = document.createElement('div');
  modal.id = 'viewerModal';

  if (isAudio) {
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000;
      transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="
        background:#1e293b; border-radius:16px; overflow:hidden;
        width:90%; max-width:480px;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
        display:flex; flex-direction:column;
      ">
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; background:#0f172a; border-bottom:1px solid #1e293b; flex-shrink:0;
        ">
          <span style="color:#94a3b8; font-size:14px; font-weight:500;">🎵 ${title || 'Audio'}</span>
          <button id="closeViewerModal" style="
            background:transparent;border:none;color:#94a3b8;
            font-size:22px;cursor:pointer;padding:4px 8px;
            border-radius:6px;line-height:1;transition:all 0.2s;
          ">&times;</button>
        </div>
        <iframe src="${viewerSrc}" style="width:100%;height:220px;border:none;background:#0f172a;overflow:hidden;" allow="autoplay"></iframe>
      </div>
    `;
  } else {
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      z-index: 10000;
      transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 20px; background:#0f172a; border-bottom:1px solid #1e293b; flex-shrink:0;
      ">
        <span style="color:#94a3b8; font-size:14px; font-weight:500;">${title || ''}</span>
        <button id="closeViewerModal" style="
          background:transparent;border:none;color:#94a3b8;
          font-size:24px;cursor:pointer;padding:4px 8px;
          border-radius:6px;line-height:1;transition:all 0.2s;
        ">&times;</button>
      </div>
      <iframe src="${viewerSrc}" style="flex:1;width:100%;border:none;background:#0a0f1e;" allow="fullscreen"></iframe>
    `;
  }

  document.body.appendChild(modal);
  // žádný fade-in (modal se zobrazí okamžitě, bez záblesku panelu)

  const closeViewer = () => {
    _currentViewerClose = null;
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 200);
  };

  _currentViewerClose = closeViewer;

  // Přechod zpět: okamžité odebrání (bez fade) aby mezi modály nebyl záblesk panelu
  const closeAndBack = () => {
    if (onBack) {
      _currentViewerClose = null;
      modal.remove();
      onBack();
    } else {
      closeViewer();
    }
  };

  const btn = document.getElementById('closeViewerModal');
  btn.onclick = closeAndBack;
  btn.onmouseenter = () => { btn.style.background = 'rgba(239,68,68,0.2)'; btn.style.color = '#ef4444'; };
  btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#94a3b8'; };

  modal.addEventListener('click', e => { if (e.target === modal) closeAndBack(); });

  const escHandler = e => {
    if (e.key === 'Escape') { closeAndBack(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

function openTextAsViewer(markdownText, title) {
  if (!markdownText) { showToast('Obsah není k dispozici.'); return; }
  const blob = new Blob([markdownText], { type: 'text/plain; charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  openViewerModal(blobUrl, 'md', title);
}

async function openResourcesViewer(node) {
  // Loading modal
  document.getElementById('viewerModal')?.remove();
  const loadingModal = document.createElement('div');
  loadingModal.id = 'viewerModal';
  loadingModal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;`;
  loadingModal.innerHTML = `<div style="color:#94a3b8;font-size:14px;display:flex;align-items:center;gap:10px;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
      </path>
    </svg>
    Vybírám nejlepší zdroje…
  </div>`;
  document.body.appendChild(loadingModal);

  // AI výběr zdrojů
  const userId = window.firebaseAuth?.currentUser?.uid || null;
  let all = [];
  try {
    const resp = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: node.id, state: node.state, userId }),
    });
    if (resp.ok) {
      const data = await resp.json();
      all = data.sources || [];
    }
  } catch (e) {
    console.warn('sources API failed, fallback to node data:', e);
  }

  // Fallback na pre-načtená data pokud API selže
  if (all.length === 0) {
    all = [
      ...(node.articles || []).map(a => ({ title: a.title, url: a.url, summary: a.summary, type: detectType(a.url) })),
      ...(node.media || []).map(m => ({ title: m.title, url: m.url, summary: m.summary, type: TYPE_MAP[m.type] || detectType(m.url) })),
      ...(node.docs || []).map(d => ({ title: d.title, url: d.url, summary: d.summary, type: TYPE_MAP[d.type] || detectType(d.url) })),
    ].filter(r => r.url);
  }

  loadingModal.remove();

  if (all.length === 0) { showToast('Žádné zdroje k dispozici.'); return; }
  if (all.length === 1) { openViewerModal(all[0].url, all[0].type, all[0].title, null, all[0].script_cz); return; }

  const PANEL_LIMIT = 5;
  const shown   = all.slice(0, PANEL_LIMIT);
  const hasMore = all.length > PANEL_LIMIT;

  document.getElementById('viewerModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'viewerModal';
  modal.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.85);
    display:flex; align-items:center; justify-content:center;
    z-index:10000;
  `;

  const icons = { md: '📄', pdf: '📕', video: '🎥', audio: '🎵', image: '🖼️' };

  modal.innerHTML = `
    <div style="
      background:#1e293b; border-radius:16px; padding:24px;
      max-width:560px; width:90%; max-height:90vh; overflow-y:auto;
      box-shadow:0 20px 60px rgba(0,0,0,0.7);
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="color:#f8fafc; margin:0; font-size:1.15em;">📚 Zdroje</h2>
        <button id="closeViewerModal" style="background:transparent;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">&times;</button>
      </div>
      ${shown.map((r, i) => `
        <div data-idx="${i}" class="res-pick" style="
          display:flex; align-items:center; gap:12px;
          padding:14px 16px; border-radius:10px; cursor:pointer;
          border:1px solid #1e293b; margin-bottom:8px;
          background:#0f172a; transition:all 0.15s ease;
        ">
          <span style="font-size:22px;">${icons[r.type] || '📎'}</span>
          <div>
            <div style="font-weight:600; color:#e2e8f0; font-size:14px;">${r.title || 'Bez názvu'}</div>
            ${r.summary ? `<div style="font-size:12px; color:#64748b; margin-top:2px;">${r.summary}</div>` : ''}
          </div>
        </div>
      `).join('')}
      ${hasMore ? `
        <a href="/app/medioteka.html?node=${encodeURIComponent(node.id)}" style="
          display:block; text-align:center; margin-top:8px;
          padding:10px; border-radius:8px;
          background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2);
          color:#60a5fa; font-size:13px; text-decoration:none;
        ">
          Mediotéka →
        </a>
      ` : `
        <div style="text-align:center; margin-top:14px;">
          <a href="/app/medioteka.html?node=${encodeURIComponent(node.id)}" style="
            color:#475569; font-size:12px; text-decoration:none;
          " onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#475569'">
            Mediotéka →
          </a>
        </div>
      `}
    </div>
  `;

  document.body.appendChild(modal);

  const closeViewer = () => {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 200);
  };

  document.getElementById('closeViewerModal').onclick = closeViewer;
  modal.addEventListener('click', e => { if (e.target === modal) closeViewer(); });

  const escHandler = e => {
    if (e.key === 'Escape') { closeViewer(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  modal.querySelectorAll('.res-pick').forEach(el => {
    const item = shown[parseInt(el.dataset.idx)];
    el.addEventListener('click', () => {
      modal.remove();
      openViewerModal(item.url, item.type, item.title, () => openResourcesViewer(node), item.script_cz);
    });
    el.addEventListener('mouseenter', () => {
      el.style.background = 'rgba(59,130,246,0.12)';
      el.style.borderColor = 'rgba(59,130,246,0.3)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = '#0f172a';
      el.style.borderColor = '#1e293b';
    });
  });
}

/** Mission completion toast — mikro-odměna inside panel */
function _showMissionToast(msg, parentEl) {
  const existing = document.getElementById('mission-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'mission-toast';
  toast.style.cssText = `
    text-align:center; padding:10px 16px; margin:8px 0;
    background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.25);
    border-radius:10px; color:#86efac; font-size:14px; font-weight:500;
    opacity:0; transition: opacity 0.4s ease;
  `;
  toast.textContent = msg;

  const missionCard = parentEl?.querySelector('#mission-card');
  if (missionCard) {
    missionCard.prepend(toast);
  } else {
    parentEl?.prepend(toast);
  }
  requestAnimationFrame(() => toast.style.opacity = '1');

  // Fade out after 4s
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }
  }, 4000);
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:#1e293b; color:#94a3b8; padding:10px 20px;
    border-radius:8px; font-size:14px; z-index:99999;
    opacity:0; transition:opacity 0.2s ease; white-space:nowrap;
  `;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 2500);
}

// =====================================================
// SHOW GAME OF LIFE  (hlavní builder panelu)
// =====================================================

/** Generuje HTML baterie pro hlavní uzel (state = GREEN / YELLOW / RED / jiný). */
function _buildBatteryHTML(vitalityPct, goalLabel, trendDir) {
  // Color thresholds adjusted by trend direction
  // trendDir: 'up' | 'stable' | 'down'
  const THRESHOLDS = {
    up:     { green: 85, yellow: 75, red: 55 },
    stable: { green: 80, yellow: 65, red: 50 },
    down:   { green: 75, yellow: 60, red: 40 },
  };
  const t = THRESHOLDS[trendDir] || THRESHOLDS.stable;

  const pct = Math.round(vitalityPct ?? 60);
  const fillPct = Math.max(3, Math.min(100, pct));
  const isGreen  = pct >= t.green;
  const isYellow = !isGreen && pct >= t.yellow;
  const isRed    = !isGreen && !isYellow; // everything below yellow = red

  const battColor  = isGreen ? '#22c55e' : isYellow ? '#eab308' : isRed ? '#ef4444' : '#6b7280';
  const battBorder = isGreen ? 'rgba(34,197,94,0.35)' : isYellow ? 'rgba(234,179,8,0.35)' : isRed ? 'rgba(239,68,68,0.35)' : 'rgba(107,114,128,0.35)';
  const battGlow   = isGreen ? 'rgba(34,197,94,0.7)'  : isYellow ? 'rgba(234,179,8,0.7)'  : isRed ? 'rgba(239,68,68,0.7)'  : 'rgba(107,114,128,0.4)';

  return `
    <div style="padding:12px 0 4px;">
      ${goalLabel ? `<div style="font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Cíl: držet nad 80 % <span style="color:#64748b;">· ${goalLabel}</span></div>` : `<div style="font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Cíl: držet nad 80 %</div>`}
      <div style="text-align:center;">
        <!-- Battery + % side by side -->
        <div style="display:inline-flex; align-items:center; gap:16px;">
          <!-- Battery -->
          <div style="display:inline-flex; flex-direction:column; align-items:center;">
            <div style="
              width:22px; height:11px;
              border:2px solid ${battBorder};
              border-bottom:none;
              border-radius:5px 5px 0 0;
              background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04));
            "></div>
            <div style="
              width:62px; height:140px;
              border:2px solid ${battBorder};
              border-radius:5px 5px 8px 8px;
              background:rgba(8,8,18,0.6);
              position:relative; overflow:hidden;
              box-shadow:0 0 22px ${battBorder}, inset 0 0 12px rgba(0,0,0,0.4);
            ">
              <div style="
                position:absolute; bottom:0; left:0; right:0;
                height:${fillPct}%;
                background:linear-gradient(180deg, ${battColor}88, ${battColor}ee);
                box-shadow:0 0 30px ${battGlow};
                transition:height 1.5s ease;
              "></div>
              <div style="
                position:absolute; top:0; bottom:0; left:6px; width:9px;
                background:linear-gradient(90deg, rgba(255,255,255,0.09), transparent);
                border-radius:4px; pointer-events:none;
              "></div>
              <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-evenly;padding:10px 0;pointer-events:none;">
                ${[0,1,2].map(() => `<div style="height:1px;background:rgba(255,255,255,0.06);margin:0 8px;"></div>`).join('')}
              </div>
            </div>
          </div>
          <!-- % next to battery, vertically centered -->
          <span id="battery-pct" style="font-size:38px; font-weight:500; color:${battColor}; font-variant-numeric:tabular-nums; line-height:1;">${pct}<span style="font-size:22px;margin-left:2px;">%</span></span>
        </div>
      </div>
    </div>
  `;
}

async function showGameOfLife(node, options = {}) {
  const isSecondAction = options.isSecondAction || false;
  console.log("🎮 showGameOfLife:", node.id);
  const userId = window.firebaseAuth?.currentUser?.uid || 'demo-user-123';

  // Ukáže chat input (pro barevné uzly)
  const aiSection = document.getElementById('aiPanelSection');
  if (aiSection) aiSection.style.display = 'flex';

  // 1. Nadpis
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) {
    titleEl.innerHTML = `<span style="font-size:1.15em; margin-right:6px;">${node.icon || '🎮'}</span>${node.label || 'Hra o život'}`;
  }

  // 1b. Motto – italická věta pod nadpisem (pokud existuje)
  const motto = ACTIVE_MOTTOS[node.id];
  if (motto) {
    const mottoEl = document.createElement('div');
    mottoEl.className = 'node-motto dynamic-section';
    mottoEl.textContent = motto;
    const panelHeader = document.querySelector('.panel-header');
    if (panelHeader) panelHeader.after(mottoEl);
  }

  // 2. Metric karta – skeleton (baterie pro hlavní uzel, sparkline pro ostatní)
  console.log("🎮 showGameOfLife node.id:", node.id, "state:", node.state);
  const isMainNode = node.id === 'dlouhovekost';

  let metricCard = document.querySelector('.metric-card');
  if (metricCard) metricCard.remove();

  metricCard = document.createElement('div');
  metricCard.className = 'metric-card';
  metricCard.style.cssText = `
    background:#06b6d415; border:1px solid #06b6d433;
    border-radius:12px; padding:20px; margin:15px 0;
  `;

  // Vitality: avg current_index of colored child nodes → percentage
  let vitalityPct = 0; // default: no data = 0
  let goalLabel = null;
  let bottleneckLabel = null;
  if (isMainNode) {
    const allNodes = window.MAIN_UNIVERSE_DATA || [];
    const children = allNodes.filter(n => n.parent === 'dlouhovekost' && n.state && n.state !== 'GRAY' && n.current_index != null);
    if (children.length > 0) {
      // Penalize RED nodes — average alone is too optimistic
      const sum = children.reduce((s, n) => {
        const penalty = n.state === 'RED' ? 0.5 : n.state === 'YELLOW' ? 0.8 : 1.0;
        return s + (n.current_index * penalty);
      }, 0);
      vitalityPct = sum / children.length;
    }
    // Bottleneck = worst child node
    const NODE_LABELS = { telo: 'tělo', mysl: 'hlava', vyziva: 'strava', zdravi: 'zdraví', metabolicke: 'metabolismus' };
    const worst = children
      .filter(n => n.current_index != null)
      .sort((a, b) => (a.current_index ?? 100) - (b.current_index ?? 100))[0];
    if (worst) bottleneckLabel = NODE_LABELS[worst.id] || worst.label || worst.id;

    // Fetch aspiration label
    if (userId !== 'demo-user-123' && window.supabaseClient) {
      try {
        const { data: aspRow } = await window.supabaseClient
          .from('user_aspirations').select('aspiration_type').eq('user_id', userId).maybeSingle();
        const GOAL_LABELS = {
          bezky_v_85: 'Běžky v 85', ironman_v_70: 'Ironman v 70',
          vnouci: 'Hrát si s vnouky', samostatnost_v_90: 'Samostatnost v 90',
        };
        if (aspRow?.aspiration_type) goalLabel = GOAL_LABELS[aspRow.aspiration_type] || null;
      } catch (e) { /* ignore */ }
    }

    // No animation — static number, trend adjusts color thresholds
  }

  // Skeleton se liší podle typu uzlu
  if (isMainNode) {
    metricCard.innerHTML = _buildBatteryHTML(vitalityPct, goalLabel, 'stable');
  } else {
    metricCard.innerHTML = `
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Trend (30 dní)</div>
      <div style="height:80px;background:rgba(255,255,255,0.05);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
    `;
  }

  // Vlož metricCard za motto (pokud existuje), jinak za panelHeader
  const panelHeader = document.querySelector('.panel-header');
  const insertAfterEl = document.querySelector('.node-motto') || panelHeader;
  if (insertAfterEl) insertAfterEl.after(metricCard);

  // 3. CHJ karta – skeleton
  let chjCard = document.querySelector('.chj-card');
  if (chjCard) chjCard.remove();

  chjCard = document.createElement('div');
  chjCard.className = 'chj-card';
  chjCard.style.cssText = `
    background:#0f172a; border:1px solid #1e293b;
    border-radius:12px; padding:20px; margin:15px 0; color:#fff;
  `;
  chjCard.innerHTML = `
    <div style="height:60px;background:rgba(255,255,255,0.04);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
  `;
  metricCard.after(chjCard);


  // 4. Paralelní načtení dat (verdict je hardcoded → žádný API call)
  const [steps, trend, aspiration, missionStatus] = await Promise.all([
    fetchLearningSteps(node.id),
    fetchTrend(userId, node.id, node.state),
    fetchAspiration(userId, node.id),
    fetch(`/api/mission-log?userId=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : { streak: 0, todayMissions: [] })
      .catch(() => ({ streak: 0, todayMissions: [] })),
  ]);

  // Verdict z hardcoded map — synchronní, nulová latence
  const verdict = generateVerdict(node, aspiration);

  const provocationText = steps?.step_provocation ?? null;
  const actionText = steps?.step_action ?? null;
  const actionTitle = steps?.step_action_title ?? steps?.step_action_label ?? null;
  const reflectionText = steps?.step_reflection ?? null;
  const reflectionTitle = steps?.step_reflection_title ?? steps?.step_reflection_label ?? null;

  // 5. Sparkline + aspiration indicator
  const aspirationHtml = aspiration ? `
    <div style="
      margin-top:10px; padding:8px 12px;
      background:${aspiration.achieved ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)'};
      border:1px solid ${aspiration.achieved ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'};
      border-radius:8px; font-size:12px;
      display:flex; align-items:center; gap:8px;
    ">
      <span>🎯</span>
      <span style="color:#94a3b8;">${aspiration.label}:</span>
      <span style="color:${aspiration.achieved ? '#22c55e' : '#fbbf24'}; font-weight:500;">
        ${aspiration.achieved ? 'splněno' : 'zaostávám'}
      </span>
    </div>
  ` : '';

  // 5b. Hlavní uzel → re-render battery with trend; ostatní uzly → sparkline
  if (isMainNode) {
    // Re-render battery now that trend data is available
    const trendDir = trend.arrow === '↗️' ? 'up' : trend.arrow === '↘️' ? 'down' : 'stable';
    metricCard.innerHTML = _buildBatteryHTML(vitalityPct, goalLabel, trendDir);
  } else {
    // 1 bod stačí – zduplikujeme ho aby drawMiniTrend měl co nakreslit (plochá čára = stabilní)
    const hasData = trend.numeric?.length >= 1;
    const chartData = hasData && trend.numeric.length === 1
      ? [trend.numeric[0], trend.numeric[0]]
      : trend.numeric;

    metricCard.innerHTML = `
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Trend (30 dní)</div>
      ${hasData
        ? `<canvas class="weather-trend-canvas" style="width:100%;height:55px;display:block;border-radius:6px;"></canvas>`
        : `<div style="color:#64748b;font-size:13px;padding:14px 0;">Zatím není trend</div>`
      }
    `;

    if (hasData) {
      requestAnimationFrame(() => {
        const canvas = metricCard.querySelector('.weather-trend-canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          drawMiniTrend(ctx, chartData, trend.lineColor);
          // Show current_index value (e.g. "30") in top-right corner of sparkline
          if (node.current_index != null) {
            drawIndexLabel(ctx, node.current_index, trend.lineColor);
          }
        }
      });
    }
  }

  // 6. Hlavní text brífinku – AI primární, provocationText fallback
  const aiErrorTexts = ['Chyba při komunikaci s AI.', 'Zatím nemám dost dat.', 'API nevrátilo platnou odpověď.'];
  const isAiValid = verdict?.text && !verdict.text.startsWith('API error') && !aiErrorTexts.includes(verdict.text);

  let initialText;
  if (isAiValid) {
    initialText = verdict.text;
  } else if (provocationText) {
    console.warn("⚠️ AI selhalo, fallback na provokaci z DB:", node.id);
    initialText = provocationText;
  } else {
    initialText = 'Nepodařilo se načíst diagnózu.';
  }

  // Animované bubliny pro všechny uzly (1–3 věty z AI)
  const verdictLines = verdict?.lines?.length >= 1 ? verdict.lines : null;

  // Hlavní uzel: 1. chip = stav baterie + bottleneck (z _buildBatteryHTML logiky)
  // Sub-uzly: jen AI věty (verdict)
  let BATTERY_STATUS_TEXT = null;
  if (isMainNode) {
    const pct = Math.round(vitalityPct ?? 0);
    const statusLine = pct >= 80 ? 'Baterie nabita.' : pct >= 65 ? 'Baterie drží.' : 'Baterie klesla.';
    const NODE_LABELS_CHJ = { telo: 'tělo', mysl: 'hlava', vyziva: 'strava', zdravi: 'zdraví', metabolicke: 'metabolismus' };
    const allNodes = window.MAIN_UNIVERSE_DATA || [];
    const children = allNodes.filter(n => n.parent === 'dlouhovekost' && n.state && n.state !== 'GRAY');
    const worst = children
      .filter(n => n.current_index != null)
      .sort((a, b) => (a.current_index ?? 100) - (b.current_index ?? 100))[0];
    const bnLabel = worst ? (NODE_LABELS_CHJ[worst.id] || worst.label || worst.id) : null;
    BATTERY_STATUS_TEXT = bnLabel ? `${statusLine} Brzdí tě ${bnLabel}.` : statusLine;
  }
  const displayLines = isMainNode
    ? [BATTERY_STATUS_TEXT, ...(verdictLines || [])].filter(Boolean)
    : (verdictLines || null);

  // 7. Chip labely
  const chip1Label = actionTitle || 'Co mám dělat?';
  const chip2Label = reflectionTitle || 'Detailní rozbor';
  const hasResources = ((node.articles?.length || 0) + (node.media?.length || 0) + (node.docs?.length || 0)) > 0;

  // (visionHtml odstraněno)

  // 8. Sestavení CHJ karty
  const BUBBLE_STYLES = isMainNode
    ? [
        { bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.25)',   color: '#e2e8f0' },   // bublina 0: bio-věk (teal)
        { bg: 'rgba(234,179,8,0.07)',   border: 'rgba(234,179,8,0.28)',   color: '#fde68a' },   // bublina 1: stav+killer+sen (žlutá)
      ]
    : [
        { bg: 'rgba(234,179,8,0.07)',   border: 'rgba(234,179,8,0.28)',   color: '#fde68a' },   // chip 1: stav + killer (žlutá)
        { bg: 'rgba(139,92,246,0.07)',  border: 'rgba(139,92,246,0.28)',  color: '#c4b5fd' },   // chip 2: aspirace (fialová)
      ];

  // Bubliny: použít transition + JS setTimeout (spolehlivější než CSS animation v innerHTML)
  const chjContentHtml = displayLines
    ? `<div id="chj-bubbles" style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        ${displayLines.map((line, i) => {
          const s = BUBBLE_STYLES[i] || BUBBLE_STYLES[0];
          return `<div data-bubble="${i}" style="
            background:${s.bg}; border:1px solid ${s.border};
            border-radius:10px; padding:13px 16px;
            color:${s.color}; font-size:15px; line-height:1.45;
            opacity:0; transform:translateY(8px);
            transition: opacity 0.55s ease, transform 0.55s ease;
          ">${formatChjText(line)}</div>`;
        }).join('')}
      </div>`
    : `<div class="chj-message" style="
        color:#e2e8f0; font-size:16px; line-height:1.3; margin-bottom:16px;
      ">${formatChjText(initialText)}</div>`;

  // 8b. Mise dne — skill router (progressive) → fallback na statický pickMission
  const streakCount = missionStatus.streak || 0;
  let mission = null;
  let skillMotivation = null;
  let skillLevel = null;

  // Load user constraints for filtering (e.g. knee → no squats)
  // Defined outside if-block so missionComplete() closure can access it
  const userConstraints = (window.USER_CONSTRAINTS || [])
      .map(c => {
        try {
          const val = typeof c.constraint_value === 'string' ? JSON.parse(c.constraint_value) : c.constraint_value;
          return val?.location?.toLowerCase() || '';
        } catch { return ''; }
      })
      .filter(Boolean)
      .map(loc => {
        // Map Czech constraint locations to exercise avoid tags
        if (loc.includes('kolen')) return 'koleno';
        if (loc.includes('kyčl') || loc.includes('kycl')) return 'koleno'; // hip issues → no squats/lunges
        if (loc.includes('kotník') || loc.includes('kotnik')) return 'kotnik';
        if (loc.includes('záda') || loc.includes('zada') || loc.includes('záď')) return 'zada_akutni';
        if (loc.includes('ramen')) return 'rameno';
        if (loc.includes('zápěst') || loc.includes('zapest')) return 'zapesti';
        if (loc.includes('loket') || loc.includes('lokt')) return 'rameno'; // elbow → treat as upper body
        return loc;
      });

  if (!isMainNode) {
    // Try skill router first (progressive difficulty, constraint-aware)
    const skillResult = runSkill({
      nodeId: node.id,
      state: node.state || 'YELLOW',
      streak: streakCount,
      constraints: userConstraints,
    });

    if (skillResult) {
      mission = skillResult.mission;
      skillMotivation = skillResult.motivation;
      skillLevel = skillResult.level;
    } else {
      // Fallback: static mission from game-engine
      mission = pickMission(node.id, node.state || 'YELLOW');
    }
  }

  // Max 2× per day per mission
  const todayThisMission = missionStatus.todayMissions?.filter(m => m.mission_id === mission?.id)?.length || 0;
  const alreadyDone = mission && todayThisMission >= 2;
  const streakBadge = streakCount > 0
    ? `<div style="text-align:center;margin-top:10px;padding:8px 14px;
        background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);
        border-radius:8px;font-size:14px;color:#e2e8f0;">
        🔥 ${streakCount} ${streakCount === 1 ? 'den' : streakCount < 5 ? 'dny po sobě' : 'dní po sobě'}</div>`
    : '';

  // Simple action types don't need a "Začít" step — show final button directly
  const isSimpleAction = mission && (mission.action_type === 'habit' || mission.action_type === 'photo');
  const simpleBtnLabel = mission?.action_type === 'photo' ? '📸 VYFOTIT' : '✓ HOTOVO';

  const missionHtml = mission ? `
    <div id="mission-card" style="margin-top:8px;">
      <div style="
        background:rgba(96,165,250,0.07); border:1px solid rgba(96,165,250,0.25);
        border-radius:10px; padding:13px 16px; margin-bottom:10px;
        display:flex; align-items:center; gap:8px;
      ">
        <span style="color:#e2e8f0;font-size:15px;line-height:1.45;">
          ${mission.icon} ${mission.label}${mission.target ? ` <span style="color:#64748b;">× ${mission.target}</span>` : ''}
        </span>
        ${skillLevel ? `<span style="margin-left:auto;font-size:11px;color:#94a3b8;background:rgba(148,163,184,0.1);padding:2px 8px;border-radius:10px;white-space:nowrap;">${skillLevel.name}</span>` : ''}
      </div>
      <div id="mission-timer" style="display:none;text-align:center;margin-bottom:12px;">
        <span id="mission-time" style="font-size:32px;font-weight:600;color:#e2e8f0;font-variant-numeric:tabular-nums;">00:00</span>
      </div>
      <div id="mission-progress" style="display:none;text-align:center;margin-bottom:12px;">
        <span id="mission-count" style="font-size:32px;font-weight:600;color:#e2e8f0;">0</span>
        <span style="color:#64748b;font-size:14px;"> / ${mission.target || ''}</span>
      </div>
      <button id="mission-start" style="
        ${alreadyDone || isSimpleAction ? 'display:none;' : ''}
        width:100%; padding:12px; border-radius:10px; border:1px solid rgba(96,165,250,0.3);
        background:rgba(96,165,250,0.1);
        color:#60a5fa; font-size:14px; font-weight:600; cursor:pointer;
      ">▶ Začít</button>
      <button id="mission-done" style="
        ${alreadyDone || !isSimpleAction ? 'display:none;' : ''}
        width:100%; padding:12px; border-radius:10px; border:1px solid rgba(96,165,250,0.3);
        background:rgba(96,165,250,0.1);
        color:#60a5fa; font-size:14px; font-weight:600; cursor:pointer;
      ">${simpleBtnLabel}</button>
      <div id="mission-completed" style="
        ${alreadyDone ? '' : 'display:none;'} width:100%; text-align:center; padding:12px;
        color:#e2e8f0; font-size:14px; font-weight:500;
      ">✓ Splněno</div>
      ${alreadyDone ? streakBadge : ''}
    </div>
  ` : '';

  chjCard.innerHTML = `
    ${chjContentHtml}
    ${missionHtml}
  `;

  // 9a. Spustit animaci bublin přes JS transition (CSS @keyframes v innerHTML je nespolehlivé)
  if (displayLines) {
    chjCard.querySelectorAll('[data-bubble]').forEach(el => {
      const i = parseInt(el.dataset.bubble) || 0;
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * 850 + 50); // +50ms aby měl browser čas vyrenderovat opacity:0
    });
  }

  // 9. Mission interaction — timer, counter, habit
  if (mission) {
    const startBtn = chjCard.querySelector('#mission-start');
    const doneBtn = chjCard.querySelector('#mission-done');
    const completedBtn = chjCard.querySelector('#mission-completed');
    const timerEl = chjCard.querySelector('#mission-timer');
    const timeDisplay = chjCard.querySelector('#mission-time');
    const progressEl = chjCard.querySelector('#mission-progress');
    const countDisplay = chjCard.querySelector('#mission-count');
    let timerInterval = null;
    let wakeLock = null;

    // Request wake lock during mission (screen stays on)
    async function requestWakeLock() {
      try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }
    }
    function releaseWakeLock() {
      wakeLock?.release(); wakeLock = null;
    }

    function formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    async function missionComplete() {
      releaseWakeLock();
      doneBtn.style.display = 'none';
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      const missionCard = chjCard.querySelector('#mission-card');

      // Instant feedback — show immediately, don't wait for API
      if (missionCard) {
        const btnArea = missionCard.querySelector('#mission-done, #mission-start');
        if (btnArea) btnArea.remove();
        completedBtn.style.display = 'none';
        const feedbackEl = document.createElement('div');
        feedbackEl.style.cssText = 'opacity:0; transition: opacity 0.5s ease;';
        const feedbackText = node.state === 'RED' ? '✔ Krok hotový.'
          : node.state === 'GREEN' ? '✔ Hotovo. Forma drží.'
          : '✔ Hotovo. Držíš tempo.';
        feedbackEl.innerHTML = `<div style="text-align:center;padding:12px;color:#e2e8f0;font-size:14px;font-weight:500;">${feedbackText}</div>`;
        missionCard.appendChild(feedbackEl);
        requestAnimationFrame(() => feedbackEl.style.opacity = '1');
      }

      // Save to mission_log + game loop (background — UI already updated)
      try {
        const resp = await fetch('/api/mission-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            nodeId: node.id,
            missionId: mission.id,
            actionType: mission.action_type,
          }),
        });
        const result = await resp.json();
        console.log('✅ Mission saved:', mission.id, 'streak:', result.streak);

        // GAME LOOP — check impact (update feedback if state changed)
        try {
          const glResp = await fetch('/api/mission-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, nodeId: node.id }),
          });
          const glResult = await glResp.json();
          console.log('🎮 Game loop:', glResult);

          if (!missionCard) return;

          // Upgrade feedback if state changed or improved
          const existingFeedback = missionCard.querySelector('div[style*="text-align:center"]');
          if (existingFeedback) {
            if (glResult.stateChanged) {
              existingFeedback.innerHTML = '<div style="text-align:center;padding:12px;color:#e2e8f0;font-size:14px;font-weight:500;">🎉 Level up! Viditelné zlepšení.</div>';
              if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);
            } else if (glResult.impact === 'improved') {
              existingFeedback.innerHTML = '<div style="text-align:center;padding:12px;color:#e2e8f0;font-size:14px;font-weight:500;">📈 Posun! Jdeš nahoru.</div>';
            }
          }

          // SECOND ACTION — sibling/child node
          // Skip if this panel was already opened as a second action (no 3rd step)
          console.log('🎯 offerMore:', glResult.offerMore, 'isSecondAction:', isSecondAction);

          if (isSecondAction) {
            // No 3rd step — done for today
          } else if (glResult.offerMore) {
            // Find mission from a DIFFERENT CHILD of same parent (or child of current node)
            const allNodes = window.MAIN_UNIVERSE_DATA || [];
            // Children of current node, or siblings (same parent), excluding self
            const parentId = node.parent || 'dlouhovekost';
            const children = allNodes.filter(n =>
              n.id !== node.id &&
              (n.parent === node.id || n.parent === parentId) &&
              n.state && n.state !== 'GRAY' && n.current_index != null
            );
            // Pick weakest child that has a skill or mission
            const secondChild = children
              .filter(n => hasSkill(n.id) || DAILY_MISSIONS[n.id])
              .sort((a, b) => (a.current_index ?? 100) - (b.current_index ?? 100))[0];

            let secondMission = null;
            let secondNodeForOffer = secondChild;
            if (secondChild) {
              const secondSkillResult = runSkill({
                nodeId: secondChild.id,
                state: secondChild.state || 'YELLOW',
                streak: result.streak || 0,
                constraints: userConstraints,
              });
              secondMission = secondSkillResult?.mission || pickMission(secondChild.id, secondChild.state || 'YELLOW');
            }
            console.log('🔍 secondMission (sibling/child):', secondMission?.id, 'from:', secondChild?.id, '(current:', node.id, ')');

            if (secondMission) {
              // Decide: offer or rest? Based on CURRENT node state (the one user just worked on)
              const sState = node.state || 'YELLOW';
              const sTrend = node.trend || 'stable';
              const sStreak = result.streak || 0;
              let shouldOffer = false;
              let offerText = '';

              if (sState === 'RED' || sTrend === 'down') {
                // CASE 1: problém — vždy nabídni
                shouldOffer = true;
                offerText = 'Můžeš to ještě posílit.';
              } else if (sState === 'GREEN' && sTrend === 'up') {
                // CASE 3: dobrý stav — netlačit
                shouldOffer = false;
                offerText = 'Držíš to. Dnes stačí.';
              } else if (sStreak >= 3 && Math.random() < 0.5) {
                // CASE 4: streak boost — občas nabídni
                shouldOffer = true;
                offerText = 'Jedeš dobře. Přidáš krok?';
              } else {
                // CASE 2: střed — 50/50
                shouldOffer = Math.random() < 0.5;
                offerText = shouldOffer ? 'Chceš jít dál?' : 'Dnes stačí.';
              }

              console.log('🎲 2nd action logic:', { sState, sTrend, sStreak, shouldOffer, offerText });

                setTimeout(() => {
                  const offerEl = document.createElement('div');
                  offerEl.style.cssText = 'margin-top:14px; opacity:0; transition: opacity 0.6s ease;';

                  if (!shouldOffer) {
                    // Rest message
                    offerEl.innerHTML = `<div style="
                      background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
                      border-radius:10px; padding:13px 16px; text-align:center;
                      color:#e2e8f0; font-size:14px;
                    ">${offerText} 👍</div>`;
                    missionCard.appendChild(offerEl);
                    requestAnimationFrame(() => offerEl.style.opacity = '1');
                  } else {
                    // Offer second action
                    const NODE_LABELS_2 = { telo: 'tělo', mysl: 'hlavu', vyziva: 'stravu', zdravi: 'zdraví', metabolicke: 'metabolismus' };
                    const secondLabel = NODE_LABELS_2[secondChild.id] || secondChild.label || secondChild.id;

                    offerEl.innerHTML = `
                      <div style="
                        background:rgba(96,165,250,0.06); border:1px solid rgba(96,165,250,0.2);
                        border-radius:10px; padding:14px 16px;
                      ">
                        <div style="color:#94a3b8;font-size:13px;margin-bottom:6px;">
                          ${offerText}
                        </div>
                        <div style="color:#e2e8f0;font-size:15px;margin-bottom:14px;line-height:1.4;">
                          ${secondMission.icon || '💪'} ${secondMission.label}${secondMission.target ? ` <span style="color:#64748b;">× ${secondMission.target}</span>` : ''}
                        </div>
                        <div style="display:flex;gap:10px;align-items:center;">
                          <button id="second-yes" style="
                            padding:10px 16px; border-radius:8px;
                            border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03);
                            color:#94a3b8; font-size:14px; cursor:pointer;
                          ">Ano</button>
                          <button id="second-no" style="
                            padding:10px 16px; border-radius:8px;
                            border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03);
                            color:#94a3b8; font-size:14px; cursor:pointer;
                          ">Ne</button>
                        </div>
                      </div>
                    `;
                    missionCard.appendChild(offerEl);
                    requestAnimationFrame(() => offerEl.style.opacity = '1');

                    // Ne = leave everything as is, just replace offer with 👍
                    document.getElementById('second-no')?.addEventListener('click', () => {
                      offerEl.innerHTML = `<div style="
                        background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
                        border-radius:10px; padding:13px 16px; text-align:center;
                        color:#e2e8f0; font-size:14px;
                      ">Dnes stačí. 👍</div>`;
                    });

                    // Ano = expand second action inline
                    document.getElementById('second-yes')?.addEventListener('click', () => {
                      offerEl.style.opacity = '0';
                      setTimeout(() => {
                        offerEl.innerHTML = `
                          <div style="
                            background:rgba(96,165,250,0.07); border:1px solid rgba(96,165,250,0.25);
                            border-radius:10px; padding:13px 16px; margin-bottom:10px;
                          ">
                            <span style="color:#e2e8f0;font-size:15px;line-height:1.45;">
                              ${secondMission.icon || '💪'} ${secondMission.label}${secondMission.target ? ` <span style="color:#64748b;">× ${secondMission.target}</span>` : ''}
                            </span>
                          </div>
                          <div id="second-timer" style="display:none;text-align:center;margin-bottom:12px;">
                            <span id="second-time" style="font-size:32px;font-weight:600;color:#e2e8f0;font-variant-numeric:tabular-nums;">00:00</span>
                          </div>
                          <div id="second-progress" style="display:none;text-align:center;margin-bottom:12px;">
                            <span id="second-count" style="font-size:32px;font-weight:600;color:#e2e8f0;">0</span>
                            <span style="color:#64748b;font-size:14px;"> / ${secondMission.target || ''}</span>
                          </div>
                          <button id="second-start" style="
                            width:100%; padding:12px; border-radius:10px; border:1px solid rgba(96,165,250,0.3);
                            background:rgba(96,165,250,0.1);
                            color:#60a5fa; font-size:14px; font-weight:600; cursor:pointer;
                          ">Začít</button>
                          <button id="second-done" style="
                            display:none; width:100%; padding:12px; border-radius:10px; border:1px solid rgba(96,165,250,0.3);
                            background:rgba(96,165,250,0.1);
                            color:#60a5fa; font-size:14px; font-weight:600; cursor:pointer;
                          ">✓ Hotovo</button>
                        `;
                        offerEl.style.opacity = '1';

                        // Wire up second mission interaction
                        const secStart = document.getElementById('second-start');
                        const secDone = document.getElementById('second-done');
                        const secTimer = document.getElementById('second-timer');
                        const secTime = document.getElementById('second-time');
                        const secProgress = document.getElementById('second-progress');
                        const secCount = document.getElementById('second-count');

                        function fmtTime(sec) {
                          const m = Math.floor(sec / 60), s = sec % 60;
                          return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                        }

                        async function secondComplete() {
                          secDone.style.display = 'none';
                          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                          try {
                            await fetch('/api/mission-log', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                userId,
                                nodeId: node.id,
                                missionId: secondMission.id,
                                actionType: secondMission.action_type || secondMission.type,
                              }),
                            });
                            const glResp2 = await fetch('/api/mission-complete', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId, nodeId: secondChild.id }),
                            });
                            const glResult2 = await glResp2.json();
                            let resultHtml = '';
                            if (glResult2.stateChanged) {
                              resultHtml = '<div style="text-align:center;padding:10px;color:#e2e8f0;font-size:14px;">🎉 Level up! Viditelné zlepšení.</div>';
                            } else if (glResult2.impact === 'improved') {
                              resultHtml = '<div style="text-align:center;padding:10px;color:#e2e8f0;font-size:14px;">📈 Posun! Jdeš nahoru.</div>';
                            } else {
                              resultHtml = '<div style="text-align:center;padding:10px;color:#e2e8f0;font-size:14px;">✔ Hotovo. Držíš tempo.</div>';
                            }
                            const secStreak = glResult2.weekCount || 0;
                            if (secStreak > 0) {
                              resultHtml += `<div style="text-align:center;margin-top:8px;padding:8px 14px;
                                background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);
                                border-radius:8px;font-size:14px;color:#e2e8f0;">
                                🔥 ${secStreak} ${secStreak === 1 ? 'den' : secStreak < 5 ? 'dny po sobě' : 'dní po sobě'}</div>`;
                            }
                            offerEl.innerHTML += resultHtml;
                          } catch (e2) {
                            console.warn('Second mission save failed:', e2.message);
                            offerEl.innerHTML += '<div style="text-align:center;padding:10px;color:#e2e8f0;font-size:14px;">✔ Hotovo.</div>';
                          }
                        }

                        secStart?.addEventListener('click', () => {
                          secStart.style.display = 'none';
                          if (secondMission.action_type === 'timed' || secondMission.type === 'timed') {
                            let secs = secondMission.duration || 60;
                            secTimer.style.display = 'block';
                            secTime.textContent = fmtTime(secs);
                            const iv = setInterval(() => {
                              secs--;
                              secTime.textContent = fmtTime(secs);
                              if (secs <= 0) { clearInterval(iv); secondComplete(); }
                            }, 1000);
                            secDone.style.display = 'block';
                            secDone.textContent = '⏹ ZASTAVIT';
                            secDone.onclick = () => { clearInterval(iv); secondComplete(); };
                          } else if (secondMission.action_type === 'reps' || secondMission.type === 'reps') {
                            let count = 0;
                            const target = secondMission.target || 10;
                            secProgress.style.display = 'block';
                            secCount.textContent = '0';
                            secDone.style.display = 'block';
                            secDone.textContent = '+1';
                            secDone.onclick = () => {
                              count++;
                              secCount.textContent = count;
                              if (count >= target) { secDone.style.display = 'none'; secondComplete(); }
                            };
                          } else {
                            secDone.style.display = 'block';
                            secDone.textContent = '✓ HOTOVO';
                            secDone.onclick = () => secondComplete();
                          }
                        });
                      }, 400);
                    });
                  }
                }, 3000);
              }
            }
          // --- end second action ---
        } catch (glErr) {
          console.warn('Game loop check failed:', glErr.message);
        }
      } catch (e) {
        console.warn('Mission save failed:', e.message);
      }
    }

    // habit / photo — doneBtn already visible, wire directly (no Začít step)
    if (isSimpleAction) {
      doneBtn.onclick = () => missionComplete();

    } else {
      startBtn.addEventListener('click', () => {
        startBtn.style.display = 'none';
        requestWakeLock();

        if (mission.action_type === 'timed') {
          // Countdown timer
          let remaining = mission.duration_sec;
          timerEl.style.display = 'block';
          timeDisplay.textContent = formatTime(remaining);
          timerInterval = setInterval(() => {
            remaining--;
            timeDisplay.textContent = formatTime(remaining);
            if (remaining <= 0) {
              clearInterval(timerInterval);
              timerEl.style.display = 'none';
              missionComplete();
            }
          }, 1000);
          doneBtn.style.display = 'block';
          doneBtn.textContent = '⏹ ZASTAVIT';
          doneBtn.onclick = () => {
            clearInterval(timerInterval);
            missionComplete();
          };

        } else if (mission.action_type === 'count') {
          // Counter: show +/- buttons and current/target display
          let count = 0;
          progressEl.style.display = 'block';
          countDisplay.textContent = '0';
          doneBtn.style.display = 'block';
          doneBtn.textContent = `+1`;
          doneBtn.onclick = () => {
            count++;
            countDisplay.textContent = String(count);
            if (navigator.vibrate) navigator.vibrate(50);
            if (count >= (mission.target || Infinity)) {
              progressEl.style.display = 'none';
              doneBtn.style.display = 'none';
              missionComplete();
            }
          };
        }
      });
    }
  }

  // 10. TTS – čte aktuálně zobrazený text; tlačítko odstraněno, řídí se mic ikony
  const messageEl = chjCard.querySelector('.chj-message');
  const playBtn = null; // tlačítko odstraněno – zachováno kvůli if (playBtn) guardu níže
  // TTS přečte všechny věty za sebou
  let currentText = displayLines ? displayLines.join(' ') : initialText;
  let ttsPlaying = false;

  function startTTS() {
    if (!currentText) return;
    ttsPlaying = true;

    // Use aiSpeak from universe-voice.js — single voice source
    // aiSpeak handles voice selection, rate, pitch, mic state
    aiSpeak(currentText);

    // Track TTS end to update local state + remove banner
    const checkEnd = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(checkEnd);
        ttsPlaying = false;
        document.getElementById('tts-tap-banner')?.remove();
      }
    }, 300);
  }

  if (playBtn) {
    playBtn.onmouseenter = () => { playBtn.style.background = 'rgba(6,182,212,0.3)'; playBtn.style.transform = 'scale(1.1)'; };
    playBtn.onmouseleave = () => {
      playBtn.style.background = ttsPlaying ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.15)';
      playBtn.style.transform = 'none';
    };
    playBtn.onclick = () => { ttsPlaying ? speechSynthesis.cancel() : startTTS(); };
  }

  // Auto-TTS: počká až domlčí pozdrav, pak spustí briefing
  const _doAutoTTS = () => {
    const attempt = () => {
      const panelOpen = document.getElementById('sidePanel')?.classList.contains('open');
      if (!panelOpen) return; // panel byl mezitím zavřen
      if (window.speechSynthesis.speaking) {
        setTimeout(attempt, 400); // pozdrav ještě hraje, počkej
        return;
      }
      if (!ttsPlaying) startTTS();
    };
    setTimeout(attempt, 400);
  };
  // Exponuj startTTS globálně – tlačítko "Spustit hru!" ho může zavolat přímo
  window._chjStartTTS = () => { if (!ttsPlaying) startTTS(); };

  if (window._chjTTSPrimed) {
    _doAutoTTS(); // engine already unlocked (user touched before data loaded)
  } else {
    // Try auto-speak first — if it works, hide banner
    try {
      const test = new SpeechSynthesisUtterance(' ');
      test.volume = 0;
      test.onend = () => {
        window._chjTTSPrimed = true;
        document.getElementById('tts-tap-banner')?.remove();
        _doAutoTTS();
      };
      window.speechSynthesis.speak(test);
    } catch(e) { /* fallback to banner below */ }
    // Queue TTS until first touch — but wrap to also remove banner
    window._chjPendingTTS = () => {
      // Remove banner when TTS starts (from any touch, not just banner click)
      const b = document.getElementById('tts-tap-banner');
      if (b) { b.style.opacity = '0'; setTimeout(() => b.remove(), 300); }
      _doAutoTTS();
    };

    // Mobile: show "tap to hear" banner inside panel
    const panel = document.getElementById('sidePanel');
    if (panel && !document.getElementById('tts-tap-banner')) {
      const banner = document.createElement('div');
      banner.id = 'tts-tap-banner';
      banner.style.cssText = `
        margin:8px 12px; padding:12px 16px; border-radius:10px;
        background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.2);
        color:#67e8f9; font-size:15px; text-align:center;
        cursor:pointer; transition:opacity 0.3s ease;
      `;
      banner.textContent = '🔊 Klepni a uslyšíš';
      // Insert after panel header
      const header = panel.querySelector('.panel-header');
      if (header) {
        header.after(banner);
      } else {
        panel.prepend(banner);
      }
    }
  }

  // 11. Chip handlery
  const chipAction = document.getElementById('chip-action');
  const chipReflection = document.getElementById('chip-reflection');
  const chipResources = document.getElementById('chip-resources');

  if (chipAction) chipAction.onclick = async () => {
    document.getElementById('actionsModal')?.remove();
    const actModal = document.createElement('div');
    actModal.id = 'actionsModal';
    actModal.style.cssText = `
      position:fixed; inset:0;
      background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      z-index:10000;
      opacity:0; transition:opacity 0.2s ease;
    `;
    actModal.innerHTML = `
      <div style="
        background:#1e293b; border-radius:16px; padding:24px;
        max-width:400px; width:90%;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="color:#fde68a; margin:0; font-size:1em; display:flex; align-items:center; gap:8px;">⚡ Co mám dělat?</h2>
          <button id="closeActModal" style="background:transparent;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">×</button>
        </div>
        <div id="actModalContent" style="color:#cbd5e1; font-size:15px; line-height:1.8;">
          <div style="height:60px;background:rgba(255,255,255,0.05);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(actModal);
    requestAnimationFrame(() => { actModal.style.opacity = '1'; });
    const closeAct = () => { actModal.style.opacity = '0'; setTimeout(() => actModal.remove(), 200); };
    document.getElementById('closeActModal').onclick = closeAct;
    actModal.addEventListener('click', e => { if (e.target === actModal) closeAct(); });
    document.addEventListener('keydown', function escAct(e) {
      if (e.key === 'Escape') { closeAct(); document.removeEventListener('keydown', escAct); }
    });
    try {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Co mám konkrétně dělat? Napiš 2-3 konkrétní kroky.',
          nodeId: node.id,
          userId,
        })
      });
      const data = await res.json();
      const contentEl = document.getElementById('actModalContent');
      if (contentEl) contentEl.innerHTML = (data.verdict || 'Nepodařilo se načíst doporučení.').replace(/\n/g, '<br>');
    } catch (err) {
      const contentEl = document.getElementById('actModalContent');
      if (contentEl) contentEl.textContent = 'Chyba při načítání doporučení.';
    }
  };
  if (chipReflection) chipReflection.onclick = async () => {
    document.getElementById('reflectionModal')?.remove();
    const refModal = document.createElement('div');
    refModal.id = 'reflectionModal';
    refModal.style.cssText = `
      position:fixed; inset:0;
      background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      z-index:10000;
      opacity:0; transition:opacity 0.2s ease;
    `;
    refModal.innerHTML = `
      <div style="
        background:#1e293b; border-radius:16px; padding:24px;
        max-width:400px; width:90%;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="color:#a5b4fc; margin:0; font-size:1em; display:flex; align-items:center; gap:8px;">🧠 Detailní rozbor</h2>
          <button id="closeRefModal" style="background:transparent;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">×</button>
        </div>
        <div id="refModalContent" style="color:#cbd5e1; font-size:15px; line-height:1.8;">
          <div style="height:60px;background:rgba(255,255,255,0.05);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(refModal);
    requestAnimationFrame(() => { refModal.style.opacity = '1'; });
    const closeRef = () => { refModal.style.opacity = '0'; setTimeout(() => refModal.remove(), 200); };
    document.getElementById('closeRefModal').onclick = closeRef;
    refModal.addEventListener('click', e => { if (e.target === refModal) closeRef(); });
    document.addEventListener('keydown', function escRef(e) {
      if (e.key === 'Escape') { closeRef(); document.removeEventListener('keydown', escRef); }
    });
    try {
      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Napiš 3 věty: 1) které oblasti jsou nejhorší a proč je baterie vybitá, 2) proč jsou navrhované akce právě takové — kvůli jakým omezením, 3) jak to souvisí s cílem. Jen fakta, bez obecných frází.',
          nodeId: node.id,
          userId,
        })
      });
      const data = await res.json();
      const contentEl = document.getElementById('refModalContent');
      if (contentEl) contentEl.innerHTML = (data.verdict || 'Nepodařilo se načíst vysvětlení.').replace(/\n/g, '<br>');
    } catch (err) {
      const contentEl = document.getElementById('refModalContent');
      if (contentEl) contentEl.textContent = 'Chyba při načítání vysvětlení.';
    }
  };
  if (chipResources) chipResources.onclick = () => openResourcesViewer(node);

  // 12. Živý chat – přepisování brífinku
  const chatInput = document.getElementById('aiPanelInput');
  const sendBtn = document.getElementById('ai-send');
  let chatBusy = false;

  async function submitChat(question) {
    question = (question || '').trim();
    if (!question || chatBusy) return;

    chatBusy = true;
    if (chatInput) { chatInput.value = ''; chatInput.disabled = true; }
    if (sendBtn) sendBtn.disabled = true;
    speechSynthesis.cancel();

    // Header mic → THINKING s reproduktorem (AI generuje)
    const _hm = document.getElementById('header-mic-btn');
    if (_hm) {
      _hm.dataset.state = 'thinking';
      const _hi = _hm.querySelector('.header-mic-icon');
      if (_hi) _hi.textContent = '🔊';
    }

    // Fresh reference — messageEl may have been replaced by mission UI
    const _msgEl = () => chjCard?.querySelector('.chj-message') || document.querySelector('.chj-message');

    // Zobrazení stavu čekání
    const msgTarget = _msgEl();
    if (msgTarget) msgTarget.innerHTML = '<span style="color:#64748b;font-style:italic;">Chytré já přemýšlí...</span>';

    try {
      const url = '/api/orchestrator';
      const payload = {
        message: question,
        nodeId: node.id,
        userId,
      };
      console.log('Sending to:', url, payload);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error('Server neodpovídá správně');
      }

      const data = await response.json();
      const answer = (data?.verdict || 'Chyba při zpracování odpovědi.').trim();

      // Přepis textu – bez nové bubliny
      currentText = answer;
      const msgDone = _msgEl();
      if (msgDone) msgDone.textContent = answer;

      // Auto-TTS: přečti odpověď (header mic → 🔊 přes startTTS.onstart)
      startTTS();

    } catch (err) {
      console.error('❌ chat submit:', err);
      const msgErr = _msgEl();
      if (msgErr) msgErr.textContent = 'Chyba při komunikaci s AI.';
      // Reset header mic při chybě (TTS nikdy nenastartuje)
      const _hmErr = document.getElementById('header-mic-btn');
      if (_hmErr) {
        _hmErr.dataset.state = 'idle';
        const _hiErr = _hmErr.querySelector('.header-mic-icon');
        if (_hiErr) _hiErr.textContent = '🎤';
      }
    } finally {
      chatBusy = false;
      if (chatInput) { chatInput.disabled = false; chatInput.value = ''; }
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  if (chatInput) chatInput.onkeydown = e => { if (e.key === 'Enter') submitChat(chatInput.value); };
  if (sendBtn) sendBtn.onclick = () => submitChat(chatInput?.value || '');
}

// =====================================================
// LEGACY EXPORT (kompatibilita s app/index.html)
// =====================================================
export async function updateRecommendations() {
  // Doporučení jsou nyní přístupná přes smart chips v CHJ kartě.
}
