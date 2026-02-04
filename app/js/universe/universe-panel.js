import { supabase } from './supabaseClient.js';
console.log("PANEL JS LOADED");

const panelEl = document.getElementById("sidePanel");
const titleEl = document.getElementById("nodeTitle");
const defEl = document.getElementById("nodeDef");
const tasksEl = document.getElementById("nodeTasks");
const panelHeader = document.querySelector("#sidePanel .panel-header");
async function loadBatteryScore() {
  try {
    // Get user from Firebase auth
    const userId = window.firebaseAuth?.currentUser?.uid || 'demo-user-123';
    const { data, error } = await window.supabaseClient
      .from('v_vitality_dashboard')
      .select('node_id, current_index, contribution, weight')
      .eq('user_id', userId)
      .eq('universe', 'longevity');

    if (error) throw error;
    if (!data || data.length === 0) return { score: 0, bottleneck: null };

    // vitality_score = SUM(contribution) — rows kde weight = 0 nepočítají se automaticky (contribution = 0)
    const score = data.reduce((sum, row) => sum + (row.contribution || 0), 0);

    // bottleneck = nejmenší current_index, ale jen kde weight > 0 (aktivní uzly)
    const weighted = data.filter(row => row.weight > 0);
    const bottleneck = weighted.length > 0
      ? weighted.sort((a, b) => a.current_index - b.current_index)[0]
      : null;

    return {
      score: Math.round(score * 10) / 10,
      bottleneck: bottleneck ? bottleneck.node_id : null,
      bottleneck_index: bottleneck ? bottleneck.current_index : null
    };
  } catch (err) {
    console.error('❌ Battery load failed:', err);
    return { score: 0, bottleneck: null, bottleneck_index: null };
  }
}
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
    defEl.style.color = "#f1f5f9";
    defEl.style.fontSize = "16px";
  }
  if (tasksEl) {
    tasksEl.innerHTML = "";
    tasksEl.style.display = "block";
  }

  document.querySelectorAll(".metric-card, .dynamic-section, hr.dynamic-hr").forEach(el => el.remove());

  const msgs = document.getElementById('ai-integrated-msgs');
  if (msgs) msgs.innerHTML = "";
}

export async function showPanel(node) {
  if (!panelEl) return;
  resetPanel();

  if (node.id === 'dlouhovekost') {
    await showGameOfLife(node);
    return;
  }
  const nodeColor = node.color || '#38bdf8';

  if (titleEl) {
    const icon = node.icon || "fa-solid fa-circle-nodes";
    const color = node.color?.background || node.color || "#94a3b8";

    const isEmoji = !icon.includes('fa-') && !icon.includes('icon-');

    let iconHTML;
    if (isEmoji) {
      iconHTML = `<span style="font-size:1.4em;margin-right:8px;">${icon}</span>`;
    } else {
      iconHTML = `<i class="${icon}" style="color:${color};margin-right:8px;font-size:1.3em;"></i>`;
    }

    titleEl.innerHTML = `
    ${iconHTML}
    ${node.label || "Detail"}
  `;
  }
  if (defEl) {
    defEl.textContent = node.definition || "";
    defEl.style.color = "#f1f5f9";
    defEl.style.fontSize = "16px";
    defEl.style.marginTop = "10px";
  }

  const val = node.current_index ?? 0;  // Použij ?? místo || (explicitní 0)
  const metricCard = document.createElement("div");
  metricCard.className = "metric-card";
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
      header.style.marginTop = "20px";
      header.style.marginBottom = "15px";
    }
  });

  panelEl.style.display = "block";
  setTimeout(() => {
    panelEl.classList.add("open", "visible");
    document.body.classList.add("panel-open");

    if (window.setAIContext) {
      window.setAIContext(node.id);
    }

    if (window.showInitialVerdict) {
      window.showInitialVerdict();
      const input = document.getElementById("aiPanelInput");
      const sendBtn = document.getElementById("ai-send");

      const sendMessage = () => {
        if (!input) return;
        const value = input.value.trim();
        if (!value) return;

        window.showAIDiagnosis(value, "user");
        window.handleAIReply(value);
        input.value = "";
      };

      if (input) {
        input.onkeydown = null;
        input.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
          }
        };
      }

      if (sendBtn) {
        sendBtn.onclick = null;
        sendBtn.onclick = () => {
          sendMessage();
        };
      }

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

function loadNodeResources(node) {
  const resourcesList = document.getElementById("resourcesList");
  if (!resourcesList) return;

  resourcesList.innerHTML = "";

  const resources = [];

  if (node.articles && node.articles.length > 0) {
    node.articles.forEach(article => {
      resources.push({
        type: 'markdown',
        title: article.title,
        url: article.url,
        summary: article.summary
      });
    });
  }

  if (node.media && node.media.length > 0) {
    node.media.forEach(media => {
      resources.push({
        type: media.type,
        title: media.title,
        url: media.url,
        summary: media.summary
      });
    });
  }

  if (node.docs && node.docs.length > 0) {
    node.docs.forEach(doc => {
      resources.push({
        type: doc.type || 'pdf',
        title: doc.title,
        url: doc.url,
        summary: doc.summary
      });
    });
  }

  if (resources.length === 0) {
    resourcesList.innerHTML = '<li style="color: #64748b; font-style: italic; font-size: 15px; padding: 20px 12px;">Žádné zdroje k dispozici</li>';
    return;
  }

  resources.forEach(resource => {
    const li = document.createElement("li");
    li.style.cssText = `
      padding: 16px 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      transition: all 0.2s ease;
      border-radius: 8px;
      margin-bottom: 4px;
    `;

    const icons = {
      'markdown': '📄',
      'video': '🎥',
      'audio': '🎵',
      'image': '🖼️',
      'pdf': '📕'
    };

    const icon = icons[resource.type] || '📎';

    li.innerHTML = `
      <div style="display: flex; align-items: start; gap: 12px;">
        <span style="font-size: 24px;">${icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #e2e8f0; margin-bottom: 6px; font-size: 15px; line-height: 1.4;">${resource.title}</div>
          ${resource.summary ? `<div style="font-size: 13px; color: #94a3b8; line-height: 1.5;">${resource.summary}</div>` : ''}
        </div>
      </div>
    `;

    li.addEventListener('click', () => {
      openResource(resource);
    });

    li.addEventListener('mouseenter', () => {
      li.style.background = 'rgba(59, 130, 246, 0.15)';
      li.style.transform = 'translateX(4px)';
    });

    li.addEventListener('mouseleave', () => {
      li.style.background = 'transparent';
      li.style.transform = 'translateX(0)';
    });

    resourcesList.appendChild(li);
  });
}

function openResource(resource) {
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

async function openMarkdownViewer(url, title) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Chyba načítání souboru');

    const markdown = await response.text();

    const html = window.marked ? marked.parse(markdown) : `<pre style="white-space: pre-wrap; line-height: 1.6;">${markdown}</pre>`;

    showModal(title, html, 'markdown');

  } catch (error) {
    console.error('Chyba načítání Markdown:', error);
    alert(`Nepodařilo se načíst dokument: ${error.message}`);
  }
}

function openPDFViewer(url, title) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    window.open(url, '_blank');
    return;
  }

  const iframe = `<iframe src="${url}" style="width:100%; height:80vh; border:none; border-radius:8px;"></iframe>`;
  showModal(title, iframe, 'pdf');
}

function openVideoViewer(url, title) {
  let videoEmbed;

  if (url.includes('youtube.com/embed/') || url.includes('youtu.be')) {
    const embedUrl = url.includes('embed') ? url : url.replace('youtu.be/', 'youtube.com/embed/');
    videoEmbed = `
      <iframe 
        width="100%" 
        height="500" 
        src="${embedUrl}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        style="border-radius:8px;">
      </iframe>
    `;
  } else {
    videoEmbed = `
      <video controls style="width:100%; max-height:500px; border-radius:8px;">
        <source src="${url}" type="video/mp4">
        Tvůj prohlížeč nepodporuje video.
      </video>
    `;
  }

  showModal(title, videoEmbed, 'video');
}

function openAudioPlayer(url, title) {
  const audioPlayer = `
    <div style="text-align:center; padding:30px;">
      <audio controls style="width:100%; max-width:450px;">
        <source src="${url}" type="audio/mpeg">
        Tvůj prohlížeč nepodporuje audio.
      </audio>
    </div>
  `;

  showModal(title, audioPlayer, 'audio');
}

function openImageViewer(url, title) {
  const imageViewer = `
    <div style="text-align:center;">
      <img src="${url}" alt="${title}" style="max-width:100%; max-height:70vh; border-radius:8px;">
    </div>
  `;

  showModal(title, imageViewer, 'image');
}

function showModal(title, content, type) {
  const existingModal = document.getElementById('resourceModal');
  if (existingModal) existingModal.remove();

  const modalSizes = {
    pdf: { maxWidth: '900px', maxHeight: '90vh' },
    markdown: { maxWidth: '900px', maxHeight: '85vh' },
    video: { maxWidth: '1000px', maxHeight: '85vh' },
    audio: { maxWidth: '550px', maxHeight: '350px' },
    image: { maxWidth: '700px', maxHeight: '75vh' }
  };

  const size = modalSizes[type] || modalSizes.markdown;

  const modal = document.createElement('div');
  modal.id = 'resourceModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.15s ease;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: #1e293b;
    border-radius: 16px;
    padding: 24px;
    max-width: ${size.maxWidth};
    max-height: ${size.maxHeight};
    width: 100%;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    transform: translateY(20px);
    transition: transform 0.2s ease;
  `;

  modalContent.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; position: sticky; top: 0; background: #1e293b; z-index: 1; padding-bottom: 12px;">
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

  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    modalContent.style.transform = 'translateY(0)';
  });

  const closeModalFn = () => {
    modal.style.opacity = '0';
    modalContent.style.transform = 'translateY(20px)';
    setTimeout(() => modal.remove(), 150);
  };

  document.getElementById('closeModal').addEventListener('click', closeModalFn);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModalFn();
    }
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModalFn();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

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

const styleSheet = document.createElement("style");
styleSheet.textContent = `
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
  
  @media (max-width: 768px) {
    #resourceModal {
      padding: 10px !important;
    }
    
    #resourceModal > div {
      max-width: 100% !important;
      max-height: 95vh !important;
      padding: 16px !important;
      border-radius: 12px !important;
    }
    
    #resourceModal h2 {
      font-size: 1.2em !important;
    }
    
    #resourceModal iframe {
      height: 60vh !important;
      min-height: 400px !important;
    }
  }
  
  @media (max-width: 480px) {
    .resources-list li {
      padding: 12px 8px !important;
    }
    
    .resources-list li > div {
      gap: 8px !important;
    }
    
    .resources-list li span {
      font-size: 20px !important;
    }
    
    .resources-list li div div:first-child {
      font-size: 14px !important;
    }
    
    .resources-list li div div:last-child {
      font-size: 12px !important;
    }
  }
`;
document.head.appendChild(styleSheet);

async function showGameOfLife(node) {
  const battery = await loadBatteryScore();

  // 1. Nadpis
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) {
    titleEl.innerHTML = `<span style="font-size:1.4em;margin-right:8px;">🔋</span>Stoletý desetibojař`;
  }

  // 2. Karta baterie
  let metricCard = document.querySelector('.metric-card');
  if (!metricCard) {
    metricCard = document.createElement('div');
    metricCard.className = 'metric-card';
    metricCard.style.cssText = `
      background: #06b6d415; 
      border: 1px solid #06b6d433; 
      border-radius: 12px; 
      padding: 20px; 
      margin: 15px 0; 
      color: #fff;
      box-shadow: 0 4px 15px #06b6d411;
    `;
    const panelHeader = document.querySelector('.panel-header');
    if (panelHeader) panelHeader.after(metricCard);
  }

  metricCard.innerHTML = `
    <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Stav baterie</div>
    <div style="display:flex; align-items:baseline; gap:5px;">
      <span style="font-size:32px; font-weight:600;">${String(battery.score).replace('.', ',')}</span>
      <span style="font-size:32px; font-weight:600; opacity:0.8;">%</span>
    </div>
    <div style="height:6px; background:rgba(0,0,0,0.3); border-radius:3px; margin-top:12px; overflow:hidden;">
      <div style="width:${battery.score}%; height:100%; background:#06b6d4; box-shadow:0 0 8px #06b6d4aa; transition:width 0.8s ease;"></div>
    </div>
    
  `;

  // 3. Zobraz panel
  panelEl.style.display = "block";
  panelEl.classList.add("open", "visible");
  document.body.classList.add("panel-open");
}
export async function updateRecommendations() {
  const valuesContainer = document.querySelector('#resourcesList'); // Používáme tvé ID
  if (!valuesContainer) return;

  // 1. Zjistíme aktuální bottleneck
  const { data: dashboard, error } = await supabase
    .from('v_vitality_dashboard')
    .select('*')
    .eq('is_bottleneck', true)
    .single();

  // Ošetření stavu, kdy uživatel nemá test (Chyba 400 nebo prázdná data)
  if (error || !dashboard) {
    valuesContainer.innerHTML = `
      <div class="onboarding-prompt" style="padding: 15px; text-align: center;">
        <p style="font-size: 13px; color: #9ba1a6;">Zatím nemáš žádná data. Změř si svou vitalitu, aby Sokrates věděl, co ti doporučit.</p>
        <button onclick="startOnboarding()" class="btn-primary" style="margin-top: 10px;">Spustit měření</button>
      </div>`;
    return;
  }

  // 2. Najdeme odpovídající materiály (např. pro 'spanek')
  const { data: recommendations } = await supabase
    .from('node_media')
    .select('*')
    .eq('node_id', dashboard.node_id)
    .limit(2);

  if (!recommendations || recommendations.length === 0) return;

  // 3. Vykreslíme je
  valuesContainer.innerHTML = recommendations.map(item => `
        <li class="hodnoty-item" onclick="window.location.href='medioteka.html?id=${item.id}'">
            <div class="icon">${item.type === 'video' ? '🎥' : '🎧'}</div>
            <div class="content">
                <strong>${item.title}</strong>
                <p>${item.summary}</p>
            </div>
        </li>
    `).join('');
}

// Uvnitř tvého scriptu (app.js nebo v index.html)
export function startOnboarding() {
  const modal = document.getElementById('mediaModal');
  const content = document.getElementById('modalContent');

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'block';

    // Důležité: spustíme první krok dotazníku
    if (typeof renderOnboardingStep === "function") {
      renderOnboardingStep(0);
    } else {
      console.error("Chyba: Funkce renderOnboardingStep nebyla nalezena!");
    }
  }
}

// TÍMTO JI ZPŘÍSTUPNÍŠ PRO HTML ONCLICK
window.startOnboarding = startOnboarding;