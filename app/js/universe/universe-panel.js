// === UNIVERSE-PANEL.JS ===
// Pravý panel – Chytré já brífink + smart chips + živý chat
console.log("PANEL JS LOADED");

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
}

export async function showPanel(node) {
  if (!panelEl) return;

  const wasOpen = panelEl.classList.contains('open');

  panelEl.style.transition = "none";
  if (!wasOpen) {
    // Fresh open – hide first so slide-in animation works
    panelEl.style.visibility = "hidden";
    panelEl.classList.remove("open", "visible");
  }

  resetPanel();
  showGameOfLife(node);

  panelEl.style.display = "block";
  panelEl.style.visibility = "visible";
  panelEl.classList.add("open", "visible");
  document.body.classList.add("panel-open");

  requestAnimationFrame(() => { panelEl.style.transition = ""; });
}

// =====================================================
// DATA FETCHING
// =====================================================

async function fetchAspiration(userId, nodeId) {
  if (nodeId === 'dlouhovekost') return null;
  try {
    const res = await fetch(`/api/aspiration?userId=${encodeURIComponent(userId)}&nodeId=${encodeURIComponent(nodeId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.aspiration || null;
  } catch {
    return null;
  }
}

async function fetchLearningSteps(nodeId) {
  try {
    const { data, error } = await window.supabaseClient
      .from('universe_nodes')
      .select('*')
      .eq('id', nodeId)
      .eq('universe_id', 'longevity')
      .maybeSingle();

    if (error) {
      console.warn(`⚠️ fetchLearningSteps(${nodeId}):`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('⚠️ fetchLearningSteps exception:', err);
    return null;
  }
}

async function fetchTrend(userId, nodeId, nodeState) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

  const { data, error } = await window.supabaseClient
    .from('node_state_history')
    .select('date, state')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .gte('date', dateFilter)
    .order('date', { ascending: true });

  if (error) console.error('Trend error:', error);

  if (!data || data.length === 0) {
    return {
      html: '<div style="color:#64748b; font-size:13px; padding:16px 0;">Zatím není trend</div>',
      text: 'Stabilní'
    };
  }

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = d.state === 'GREEN' ? 20 : d.state === 'YELLOW' ? 50 : 80;
    return `${x},${y}`;
  });

  const recent = data.slice(-7);
  const recentGreen = recent.filter(d => d.state === 'GREEN').length;
  const recentRed = recent.filter(d => d.state === 'RED').length;

  let arrow = '→', trendText = 'Stabilní', trendColor = '#eab308';
  if (recentGreen > recentRed + 2) { arrow = '↗️'; trendText = 'Zlepšení'; trendColor = '#22c55e'; }
  else if (recentRed > recentGreen + 2) { arrow = '↘️'; trendText = 'Zhoršení'; trendColor = '#ef4444'; }

  const stateColor = nodeState === 'GREEN' ? '#22c55e'
    : nodeState === 'YELLOW' ? '#eab308'
      : nodeState === 'RED' ? '#ef4444'
        : '#64748b';

  const last = points[points.length - 1].split(',');

  const html = `
    <svg width="100%" height="50" viewBox="0 0 100 100" preserveAspectRatio="none" style="display:block;">
      <rect x="0" y="0"  width="100" height="33" fill="#22c55e" opacity="0.05"/>
      <rect x="0" y="33" width="100" height="34" fill="#eab308" opacity="0.05"/>
      <rect x="0" y="67" width="100" height="33" fill="#ef4444" opacity="0.05"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="${trendColor}" stroke-width="6" opacity="0.2" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="${stateColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="2" fill="${trendColor}"/>
    </svg>
    <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
      <span style="font-size:18px;">${arrow}</span>
      <span style="color:${trendColor}; font-size:13px; font-weight:500;">${trendText}</span>
      <span style="color:#64748b; font-size:12px; margin-left:auto;">${data.length} dní</span>
    </div>
  `;

  return { html, text: trendText };
}

async function generateVerdictV2(node, userId) {
  try {
    const { data: metrics } = await window.supabaseClient
      .from('user_metrics')
      .select('node_id, state, current_index')
      .eq('user_id', userId)
      .eq('universe', 'longevity');

    if (!metrics || metrics.length === 0) return { text: 'Zatím nemám dost dat.' };

    const bottleneck = metrics
      .filter(m => m.state === 'RED')
      .sort((a, b) => a.current_index - b.current_index)[0];

    const payload = {
      nodeId: node.id,
      userQuestion: null,
      context: {
        state: node.state,
        userId,
        redCount: metrics.filter(m => m.state === 'RED').length,
        yellowCount: metrics.filter(m => m.state === 'YELLOW').length,
        greenCount: metrics.filter(m => m.state === 'GREEN').length,
        bottleneck: bottleneck?.node_id
      }
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return { text: `API error ${response.status}` };

    const data = JSON.parse(await response.text());
    return { text: (data?.verdict || 'API nevrátilo platnou odpověď.').replace(/\n/g, ' ') };

  } catch (err) {
    console.error('❌ generateVerdictV2:', err);
    return { text: 'Chyba při komunikaci s AI.' };
  }
}

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
});

function openViewerModal(fileUrl, type, title, onBack = null) {
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

  const isAudio = type === 'audio';
  const viewerSrc = `/app/viewer.html?type=${encodeURIComponent(type)}&file=${encodeURIComponent(fileUrl)}`;

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

function openResourcesViewer(node) {
  const all = [
    ...(node.articles || []).map(a => ({ title: a.title, url: a.url, summary: a.summary, type: detectType(a.url) })),
    ...(node.media || []).map(m => ({ title: m.title, url: m.url, summary: m.summary, type: TYPE_MAP[m.type] || detectType(m.url) })),
    ...(node.docs || []).map(d => ({ title: d.title, url: d.url, summary: d.summary, type: TYPE_MAP[d.type] || detectType(d.url) }))
  ].filter(r => r.url);

  if (all.length === 0) { showToast('Žádné zdroje k dispozici.'); return; }
  if (all.length === 1) { openViewerModal(all[0].url, all[0].type, all[0].title); return; }

  // Panel zobrazuje max 3 položky – zbytek je k nalezení v Mediátéce
  const PANEL_LIMIT = 3;
  const shown = all.slice(0, PANEL_LIMIT);
  const hasMore = all.length > PANEL_LIMIT;

  document.getElementById('viewerModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'viewerModal';
  modal.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.85);
    display:flex; align-items:center; justify-content:center;
    z-index:10000;
    transition:opacity 0.2s ease;
  `;

  const icons = { md: '📄', pdf: '📕', video: '🎥', audio: '🎵', image: '🖼️' };

  modal.innerHTML = `
    <div style="
      background:#1e293b; border-radius:16px; padding:24px;
      max-width:460px; width:90%; max-height:80vh; overflow-y:auto;
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
        <a href="/app/medioteka.html" style="
          display:block; text-align:center; margin-top:12px;
          padding:10px; border-radius:8px;
          background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2);
          color:#60a5fa; font-size:13px; text-decoration:none;
          transition:background 0.15s;
        ">
          📚 Zobrazit vše v Mediátéce (${all.length - PANEL_LIMIT} dalších)
        </a>
      ` : ''}
    </div>
  `;

  document.body.appendChild(modal);
  // žádný fade-in – modal se zobrazí okamžitě

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
    const idx = parseInt(el.dataset.idx);
    el.addEventListener('click', () => {
      // Okamžité odebrání – bez fade – aby nebyl záblesk panelu mezi modály
      modal.remove();
      openViewerModal(shown[idx].url, shown[idx].type, shown[idx].title, () => openResourcesViewer(node));
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

async function showGameOfLife(node) {
  console.log("🎮 showGameOfLife:", node.id);
  const userId = window.firebaseAuth?.currentUser?.uid || 'demo-user-123';

  // 1. Nadpis
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) {
    titleEl.innerHTML = `<span style="font-size:1.15em; margin-right:6px;">${node.icon || '🏋️'}</span>${node.label || 'Stoletý desetibojař'}`;
  }

  // 2. Trend karta – skeleton
  let metricCard = document.querySelector('.metric-card');
  if (metricCard) metricCard.remove();

  metricCard = document.createElement('div');
  metricCard.className = 'metric-card';
  metricCard.style.cssText = `
    background:#06b6d415; border:1px solid #06b6d433;
    border-radius:12px; padding:20px; margin:15px 0;
  `;
  metricCard.innerHTML = `
    <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Trend (30 dní)</div>
    <div style="height:80px;background:rgba(255,255,255,0.05);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
    <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
  `;

  const panelHeader = document.querySelector('.panel-header');
  if (panelHeader) panelHeader.after(metricCard);

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
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;color:#83B0E3;font-size:18px;">🧠 Chytré já říká:</h3>
    </div>
    <div style="height:60px;background:rgba(255,255,255,0.04);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
  `;
  metricCard.after(chjCard);

  // 4. Paralelní načtení dat (AI běží souběžně s DB dotazy)
  const [steps, trend, aspiration, verdict] = await Promise.all([
    fetchLearningSteps(node.id),
    fetchTrend(userId, node.id, node.state),
    fetchAspiration(userId, node.id),
    generateVerdictV2(node, userId)
  ]);

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

  metricCard.innerHTML = `
    <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Trend (30 dní)</div>
    ${trend.html}
    ${aspirationHtml}
  `;

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

  // 7. Chip labely
  const chip1Label = actionTitle || 'Co mám dělat?';
  const chip2Label = reflectionTitle || 'Detailní rozbor';
  const hasResources = ((node.articles?.length || 0) + (node.media?.length || 0) + (node.docs?.length || 0)) > 0;

  // 8. Sestavení CHJ karty
  chjCard.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;color:#83B0E3;font-size:18px;display:flex;align-items:center;gap:8px;">
        🧠 Chytré já říká:
      </h3>
      <button id="tts-play" title="Přehrát" style="
        background:rgba(6,182,212,0.15); border:1px solid rgba(6,182,212,0.35);
        color:#22d3ee; font-size:18px; width:36px; height:36px;
        border-radius:50%; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:all 0.2s; flex-shrink:0;
      ">🔊</button>
    </div>

    <div class="chj-message" style="
      color:#e2e8f0; font-size:16px; line-height:1.7;
      white-space:pre-line; margin-bottom:24px;
    ">${initialText}</div>

    <div class="smart-chips" style="display:flex;flex-direction:column;gap:10px;">
      <button id="chip-action" style="
        display:flex;align-items:center;gap:10px;
        background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.4);
        color:#fde68a;padding:12px 18px;border-radius:10px;
        cursor:pointer;font-size:14px;font-weight:600;
        text-align:left;transition:all 0.2s;width:100%;
      "><span style="font-size:18px;">⚡</span>${chip1Label}</button>
      <button id="chip-reflection" style="
        display:flex;align-items:center;gap:10px;
        background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.4);
        color:#a5b4fc;padding:12px 18px;border-radius:10px;
        cursor:pointer;font-size:14px;font-weight:600;
        text-align:left;transition:all 0.2s;width:100%;
      "><span style="font-size:18px;">🧠</span>Detailní rozbor</button>
      ${(hasResources || actionText || reflectionText) ? `
        <button id="chip-resources" style="
          display:flex;align-items:center;gap:10px;
          background:rgba(20,184,166,0.1);border:1px solid rgba(20,184,166,0.4);
          color:#5eead4;padding:12px 18px;border-radius:10px;
          cursor:pointer;font-size:14px;font-weight:600;
          text-align:left;transition:all 0.2s;width:100%;
        "><span style="font-size:18px;">📚</span>Další zdroje</button>
      ` : ''}
    </div>
  `;

  // 9. Hover efekty čipů
  chjCard.querySelectorAll('.smart-chips button').forEach(btn => {
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.78'; btn.style.transform = 'translateX(3px)'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; btn.style.transform = 'none'; });
  });

  // 10. TTS – megafon button
  //     Čte vždy aktuálně zobrazený text (currentText – mutable)
  const messageEl = chjCard.querySelector('.chj-message');
  const playBtn = chjCard.querySelector('#tts-play');
  let currentText = initialText;   // <-- toto proměnná sdílená s chat handlerem
  let ttsPlaying = false;

  function startTTS() {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentText);
    utterance.lang = 'cs-CZ';
    utterance.pitch = 1.2;
    utterance.rate = 1.1;
    utterance.onstart = () => {
      ttsPlaying = true;
      playBtn.textContent = '⏹';
      playBtn.title = 'Zastavit';
      playBtn.style.background = 'rgba(239,68,68,0.2)';
      playBtn.style.borderColor = 'rgba(239,68,68,0.4)';
      playBtn.style.color = '#f87171';
    };
    utterance.onend = utterance.onerror = () => {
      ttsPlaying = false;
      playBtn.textContent = '🔊';
      playBtn.title = 'Přehrát';
      playBtn.style.background = 'rgba(6,182,212,0.15)';
      playBtn.style.borderColor = 'rgba(6,182,212,0.35)';
      playBtn.style.color = '#22d3ee';
    };
    window.speechSynthesis.speak(utterance);
  }

  if (playBtn) {
    playBtn.onmouseenter = () => { playBtn.style.background = 'rgba(6,182,212,0.3)'; playBtn.style.transform = 'scale(1.1)'; };
    playBtn.onmouseleave = () => {
      playBtn.style.background = ttsPlaying ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.15)';
      playBtn.style.transform = 'none';
    };
    playBtn.onclick = () => { ttsPlaying ? speechSynthesis.cancel() : startTTS(); };
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          userQuestion: 'Co mám konkrétně dělat? Napiš 2-3 konkrétní kroky.',
          context: { state: node.state, userId }
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          userQuestion: 'Napiš 3 věty: 1) které oblasti jsou nejhorší a proč je baterie vybitá, 2) proč jsou navrhované akce právě takové — kvůli jakým omezením, 3) jak to souvisí s cílem. Jen fakta, bez obecných frází.',
          context: { state: node.state, userId, chjVerdict: initialText }
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

    // Zobrazení stavu čekání
    messageEl.innerHTML = '<span style="color:#64748b;font-style:italic;">Chytré já přemýšlí...</span>';

    try {
      const url = '/api/chat';
      const payload = {
        nodeId: node.id,
        userQuestion: question,
        context: {
          state: node.state,
          userId,
          nodeLabel: node.label
        }
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
      messageEl.textContent = answer;

    } catch (err) {
      console.error('❌ chat submit:', err);
      messageEl.textContent = 'Chyba při komunikaci s AI.';
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
