console.log("PANEL JS LOADED");

const panelEl = document.getElementById("sidePanel");
const titleEl = document.getElementById("nodeTitle");
const defEl = document.getElementById("nodeDef");
const tasksEl = document.getElementById("nodeTasks");
const panelHeader = document.querySelector("#sidePanel .panel-header");

export function closePanel() {
  if (panelEl) {
    panelEl.classList.remove("open", "visible");
    setTimeout(() => { panelEl.style.display = "none"; }, 300);
    document.body.classList.remove("panel-open");
  }
}
const closeBtn = document.getElementById("closePanel");
if (closeBtn) {
  closeBtn.onclick = () => {
    closePanel();
  };
}

window.closePanel = closePanel;

function resetPanel() {
  if (titleEl) titleEl.innerHTML = "";
  if (defEl) {
    defEl.innerHTML = "";
    defEl.style.color = "#f1f5f9"; // Bělejší pro lepší čtení
    defEl.style.fontSize = "16px";
  }
  if (tasksEl) {
    tasksEl.innerHTML = "";
    tasksEl.style.display = "block";
  }

  // Vyčistíme staré karty i statické sekce, které budeme generovat dynamicky
  document.querySelectorAll(".metric-card, .dynamic-section, hr.dynamic-hr").forEach(el => el.remove());

  const msgs = document.getElementById('ai-integrated-msgs');
  if (msgs) msgs.innerHTML = "";
}

export function showPanel(node) {
  console.log('🎯 showPanel called');
  console.log('📊 Node data:', node);
  console.log('📄 Articles:', node.articles?.length || 0);
  console.log('📕 Docs:', node.docs?.length || 0);
  console.log('🎥 Media:', node.media?.length || 0);
  if (!panelEl) return;
  resetPanel();

  const nodeColor = node.color || '#38bdf8';

  // 1. ZÁKLADNÍ TEXTY
  if (titleEl) {
    const icon = node.icon || "fa-solid fa-circle-nodes";
    const color = node.color?.background || node.color || "#94a3b8";

    titleEl.innerHTML = `
    <i class="${icon}" style="color:${color};margin-right:8px;"></i>
    ${node.label || "Detail"}
  `;
  }
  if (defEl) {
    defEl.textContent = node.definition || "";
    defEl.style.color = "#f1f5f9";
    defEl.style.fontSize = "16px";
    defEl.style.marginTop = "10px"; // Menší mezera od nadpisu
  }

  // 2. KARTA MĚŘENÍ - S podbarvením (glow) podle barvy uzlu
  const val = node.current_index || 72;
  const metricCard = document.createElement("div");
  metricCard.className = "metric-card";
  // Dynamické podbarvení: používáme barvu uzlu s nízkou opacitou (22) a jemný border
  metricCard.style.cssText = `
    background: ${nodeColor}15; 
    border: 1px solid ${nodeColor}33; 
    border-radius: 12px; 
    padding: 20px; 
    margin: 15px 0; 
    color: #fff;
    box-shadow: 0 4px 15px ${nodeColor}11;
  `;
  metricCard.innerHTML = `
    <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Index připravenosti</div>
    <div style="display: flex; align-items: baseline; gap: 5px;">
      <span style="font-size: 32px; font-weight: 600;">${val}</span>
      <span style="font-size: 32px; font-weight: 600; opacity: 0.8;">%</span>
    </div>
    <div style="height: 6px; background: rgba(0, 0, 0, 0.3); border-radius: 3px; margin-top: 12px; overflow: hidden;">
      <div style="width: ${val}%; height: 100%; background: ${nodeColor}; box-shadow: 0 0 8px ${nodeColor}aa; transition: width 1s ease;"></div>
    </div>
  `;
  if (panelHeader) panelHeader.after(metricCard);

  // 3. ÚPRAVA NADPISŮ - Barva #83B0E3 a menší mezery
  const existingHeaders = panelEl.querySelectorAll('h3, .panel-section-title, b');
  existingHeaders.forEach(header => {
    const text = header.textContent.toLowerCase();
    if (text.includes("chytré já") || text.includes("úkoly") || text.includes("zdroje") || text.includes("myšlenky") || text.includes("strategie")) {
      header.style.fontSize = "22px";
      header.style.fontWeight = "600";
      header.style.color = "#83B0E3";
      header.style.display = "flex";
      header.style.alignItems = "center";
      header.style.gap = "10px";
      header.style.marginTop = "20px"; // Zmenšená mezera od oddělovače
      header.style.marginBottom = "15px";
    }
  });

  // 4. ZOBRAZENÍ
  panelEl.style.display = "block";
  setTimeout(() => {
    panelEl.classList.add("open", "visible");
    document.body.classList.add("panel-open");

    // 🔽 TADY
    if (window.showInitialVerdict) {
      window.showInitialVerdict();
      const input = document.getElementById("aiPanelInput");
      const sendBtn = document.getElementById("ai-send");

      const sendMessage = () => {
        if (!input) return;          // 🔴 DŮLEŽITÉ
        const value = input.value.trim();
        if (!value) return;

        window.showAIDiagnosis(value, "user");
        window.handleAIReply(value);
        input.value = "";
      };

      if (input) {
        input.onkeydown = null;      // 🔴 reset
        input.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
          }
        };
      }

      if (sendBtn) {
        sendBtn.onclick = null;      // 🔴 reset
        sendBtn.onclick = () => {
          sendMessage();
        };
      }

    }

    if (window.setAIContext) {
      window.setAIContext(node.id);
    }

    window.__pendingTasks = [
      "Klidná chůze v zóně 2 (30–45 min)\nBez tlaku. Jen pohyb, který tě drží stabilního.",
      "Krátké dechové cvičení (5–10 min)\nKdyž není čas na chůzi, tohle stačí."
    ];

    if (window.__pendingTasks && window.setTasks) {
      window.setTasks(window.__pendingTasks);
    }
    if (window.setResources) {
      window.setResources([
        "Proč funguje klidná chůze v zóně 2",
        "Dech a stabilita nervového systému"
      ]);
    }
    loadNodeResources(node);
  }, 10);
}
window.setTasks = function (tasks) {
  const section = document.getElementById("tasksSection");
  const list = document.getElementById("tasksList");

  if (!section || !list) return;

  section.style.display = "block";
  list.innerHTML = "";

  tasks.forEach(task => {
    const li = document.createElement("li");
    li.textContent = task;
    list.appendChild(li);
  });
};
window.setResources = function (resources) {
  const section = document.getElementById("resourcesSection");
  const list = document.getElementById("resourcesList");

  if (!section || !list) return;

  section.style.display = "block";
  list.innerHTML = "";

  resources.forEach(res => {
    const li = document.createElement("li");
    li.textContent = res;
    list.appendChild(li);
  });
};
// =====================================================
// PANEL ÚPRAVY - universe-panel.js (UPDATED)
// =====================================================

// ========================================
// NAČTENÍ ZDROJŮ Z UZLU (ze Supabase)
// ========================================
export function loadNodeResources(node) {
  console.log('📚 loadNodeResources called');
  console.log('  → node.articles:', node.articles);
  console.log('  → node.media:', node.media);
  console.log('  → node.docs:', node.docs);

  const resourcesList = document.getElementById("resourcesList");
  console.log('  → resourcesList element:', resourcesList);

  if (!resourcesList) {
    console.error('❌ Element resourcesList not found!');
    return;
  }

  const resources = [];

  // Articles (Markdown z node.articles)
  if (node.articles && node.articles.length > 0) {
    node.articles.forEach(article => {
      resources.push({
        type: 'markdown',
        title: article.title,
        url: article.url, // už je Supabase URL po UPDATE
        summary: article.summary
      });
    });
  }

  // Media (video, audio, image)
  if (node.media && node.media.length > 0) {
    node.media.forEach(media => {
      resources.push({
        type: media.type, // 'video', 'audio', 'image'
        title: media.title,
        url: media.url, // může být Supabase nebo YouTube
        summary: media.summary
      });
    });
  }

  // Docs (PDF, Markdown)
  if (node.docs && node.docs.length > 0) {
    node.docs.forEach(doc => {
      resources.push({
        type: doc.type || 'pdf', // 'pdf', 'markdown'
        title: doc.title,
        url: doc.url, // už je Supabase URL
        summary: doc.summary
      });
    });
  }

  // Render resources
  if (resources.length === 0) {
    resourcesList.innerHTML = '<li style="color: #64748b; font-style: italic;">Žádné zdroje k dispozici</li>';
    return;
  }

  resources.forEach(resource => {
    const li = document.createElement("li");
    li.style.cssText = `
      padding: 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      transition: background 0.2s;
    `;

    // Ikona podle typu
    const icons = {
      'markdown': '📄',
      'video': '🎥',
      'audio': '🎵',
      'image': '🖼️',
      'pdf': '📕'
    };

    const icon = icons[resource.type] || '📎';

    li.innerHTML = `
      <div style="display: flex; align-items: start; gap: 10px;">
        <span style="font-size: 20px;">${icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">${resource.title}</div>
          ${resource.summary ? `<div style="font-size: 12px; color: #94a3b8;">${resource.summary}</div>` : ''}
        </div>
      </div>
    `;

    // Click handler
    li.addEventListener('click', () => {
      openResource(resource);
    });

    li.addEventListener('mouseenter', () => {
      li.style.background = 'rgba(59, 130, 246, 0.1)';
    });

    li.addEventListener('mouseleave', () => {
      li.style.background = 'transparent';
    });

    resourcesList.appendChild(li);
  });
}

// ========================================
// OTEVŘENÍ ZDROJE
// ========================================
function openResource(resource) {
  console.log('📖 Opening resource:', resource);

  switch (resource.type) {
    case 'markdown':
      openMarkdownViewer(resource.url, resource.title);
      break;

    case 'pdf':
      openPDFViewer(resource.url, resource.title);
      break;

    case 'video':
      openVideoViewer(resource.url, resource.title);
      break;

    case 'audio':
      openAudioPlayer(resource.url, resource.title);
      break;

    case 'image':
      openImageViewer(resource.url, resource.title);
      break;

    default:
      window.open(resource.url, '_blank');
  }
}

// ========================================
// MARKDOWN VIEWER
// ========================================
async function openMarkdownViewer(url, title) {
  try {
    // Načti Markdown ze Supabase
    const response = await fetch(url);
    if (!response.ok) throw new Error('Chyba načítání souboru');

    const markdown = await response.text();

    // Převeď Markdown na HTML (použij marked.js library)
    // Pokud nemáš marked.js, můžeš zobrazit raw Markdown
    const html = window.marked ? marked.parse(markdown) : `<pre>${markdown}</pre>`;

    // Vytvoř modal
    showModal(title, html, 'markdown');

  } catch (error) {
    console.error('Chyba načítání Markdown:', error);
    alert(`Nepodařilo se načíst dokument: ${error.message}`);
  }
}

// ========================================
// PDF VIEWER
// ========================================
function openPDFViewer(url, title) {
  // PDF zobrazíme přes iframe
  const iframe = `<iframe src="${url}" style="width:100%; height:600px; border:none; border-radius:8px;"></iframe>`;
  showModal(title, iframe, 'pdf');
}

// ========================================
// VIDEO VIEWER
// ========================================
function openVideoViewer(url, title) {
  let videoEmbed;

  if (url.includes('youtube.com/embed/') || url.includes('youtu.be')) {
    // YouTube embed
    const embedUrl = url.includes('embed') ? url : url.replace('youtu.be/', 'youtube.com/embed/');
    videoEmbed = `
      <iframe 
        width="100%" 
        height="450" 
        src="${embedUrl}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        style="border-radius:8px;">
      </iframe>
    `;
  } else {
    // HTML5 video pro lokální soubory
    videoEmbed = `
      <video controls style="width:100%; max-height:500px; border-radius:8px;">
        <source src="${url}" type="video/mp4">
        Tvůj prohlížeč nepodporuje video.
      </video>
    `;
  }

  showModal(title, videoEmbed, 'video');
}

// ========================================
// AUDIO PLAYER
// ========================================
function openAudioPlayer(url, title) {
  const audioPlayer = `
    <div style="text-align:center; padding:40px;">
      <audio controls style="width:100%; max-width:500px;">
        <source src="${url}" type="audio/mpeg">
        Tvůj prohlížeč nepodporuje audio.
      </audio>
    </div>
  `;

  showModal(title, audioPlayer, 'audio');
}

// ========================================
// IMAGE VIEWER
// ========================================
function openImageViewer(url, title) {
  const imageViewer = `
    <div style="text-align:center;">
      <img src="${url}" alt="${title}" style="max-width:100%; max-height:600px; border-radius:8px;">
    </div>
  `;

  showModal(title, imageViewer, 'image');
}

// ========================================
// UNIVERZÁLNÍ MODAL
// ========================================
function showModal(title, content, type) {
  // Odstraň existující modal
  const existingModal = document.getElementById('resourceModal');
  if (existingModal) existingModal.remove();

  // Vytvoř nový modal
  const modal = document.createElement('div');
  modal.id = 'resourceModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: #1e293b;
    border-radius: 16px;
    padding: 24px;
    max-width: 900px;
    max-height: 85vh;
    width: 90%;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: slideUp 0.3s ease;
  `;

  modalContent.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <h2 style="color:#f8fafc; margin:0; font-size:1.5em;">${title}</h2>
      <button id="closeModal" style="
        background:transparent; 
        border:none; 
        color:#94a3b8; 
        font-size:28px; 
        cursor:pointer;
        line-height:1;
        padding:0;
        width:32px;
        height:32px;
        border-radius:50%;
        transition:all 0.2s;
      ">&times;</button>
    </div>
    <div class="modal-body" style="color:#e2e8f0;">
      ${content}
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Event listeners
  document.getElementById('closeModal').addEventListener('click', () => {
    modal.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => modal.remove(), 200);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => modal.remove(), 200);
    }
  });

  // Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => modal.remove(), 200);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Hover efekt na close button
  const closeBtn = document.getElementById('closeModal');
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(239, 68, 68, 0.2)';
    closeBtn.style.color = '#ef4444';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = '#94a3b8';
  });
}

// ========================================
// CSS ANIMACE (přidej do hlavního CSS)
// ========================================
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(30px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Styling pro Markdown obsah */
  .modal-body h1, .modal-body h2, .modal-body h3 {
    color: #f8fafc;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  
  .modal-body p {
    line-height: 1.6;
    margin-bottom: 1em;
  }
  
  .modal-body code {
    background: rgba(0,0,0,0.3);
    padding: 2px 6px;
    border-radius: 4px;
    color: #38bdf8;
  }
  
  .modal-body pre {
    background: rgba(0,0,0,0.3);
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1em 0;
  }
  
  .modal-body ul, .modal-body ol {
    margin-left: 1.5em;
    line-height: 1.8;
  }
  
  .modal-body a {
    color: #38bdf8;
    text-decoration: none;
  }
  
  .modal-body a:hover {
    text-decoration: underline;
  }
`;
document.head.appendChild(styleSheet);


