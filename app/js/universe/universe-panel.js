import { supabase } from './supabaseClient.js';
console.log("PANEL JS LOADED");

const panelEl = document.getElementById("sidePanel");
const titleEl = document.getElementById("nodeTitle");
const defEl = document.getElementById("nodeDef");
const tasksEl = document.getElementById("nodeTasks");
const panelHeader = document.querySelector("#sidePanel .panel-header");
async function loadBatteryScore() {
  try {
    const userId = window.firebaseAuth?.currentUser?.uid || 'demo-user-123';
    console.log("🔋 Loading battery for user:", userId);

    // Get dlouhovekost (root) node value directly
    const { data: rootNode, error } = await window.supabaseClient
      .from('user_metrics')
      .select('current_index')
      .eq('user_id', userId)
      .eq('universe', 'longevity')
      .eq('node_id', 'dlouhovekost')
      .single();

    console.log("🔋 Root node data:", { rootNode, error });

    if (error) throw error;
    if (!rootNode) {
      console.log("⚠️ No root node found");
      return { score: 0, bottleneck: null };
    }

    // Get bottleneck from decathlon nodes
    const { data: decathlonNodes } = await window.supabaseClient
      .from('user_metrics')
      .select('node_id, current_index')
      .eq('user_id', userId)
      .eq('universe', 'longevity')
      .in('node_id', [
        'stabilita', 'sila', 'vytrvalost', 'mobilita',
        'spanek', 'nervovy_system', 'metabolicke',
        'bílkoviny', 'klid', 'smysl', 'vo2max'
      ]);

    const bottleneck = decathlonNodes && decathlonNodes.length > 0
      ? decathlonNodes.sort((a, b) => a.current_index - b.current_index)[0]
      : null;

    const result = {
      score: Math.round(rootNode.current_index * 10) / 10,
      bottleneck: bottleneck ? bottleneck.node_id : null,
      bottleneck_index: bottleneck ? bottleneck.current_index : null
    };

    console.log("🔋 Battery result:", result);
    return result;

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

  // Disable transitions
  panelEl.style.transition = "none";
  panelEl.style.visibility = "hidden";
  panelEl.classList.remove("open", "visible");

  resetPanel();
  showGameOfLife(node);

  // Show instantly (bez slide)
  panelEl.style.display = "block";
  panelEl.style.visibility = "visible";
  panelEl.classList.add("open", "visible");
  document.body.classList.add("panel-open");

  // Re-enable transitions (pro close animaci)
  requestAnimationFrame(() => {
    panelEl.style.transition = "";
  });
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


// =====================================================
// TREND SPARKLINE - SVG LINE CHART
// =====================================================

async function renderTrendSparkline(userId, nodeId) {
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
    return '<div style="color:#64748b; font-size:13px; padding:20px 0;">Zatím není trend</div>';
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
  if (recentGreen > recentRed + 2) {
    arrow = '↗️'; trendText = 'Zlepšení'; trendColor = '#22c55e';
  } else if (recentRed > recentGreen + 2) {
    arrow = '↘️'; trendText = 'Zhoršení'; trendColor = '#ef4444';
  }

  return `<svg width="100%" height="50" viewBox="0 0 100 100" preserveAspectRatio="none" style="display:block;"><rect x="0" y="0" width="100" height="33" fill="#22c55e" opacity="0.05"/><rect x="0" y="33" width="100" height="34" fill="#eab308" opacity="0.05"/><rect x="0" y="67" width="100" height="33" fill="#ef4444" opacity="0.05"/><polyline points="${points.join(' ')}" fill="none" stroke="${trendColor}" stroke-width="6" opacity="0.2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points.join(' ')}" fill="none" stroke="${trendColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${points[points.length - 1].split(',')[0]}" cy="${points[points.length - 1].split(',')[1]}" r="2" fill="${trendColor}"/></svg><div style="display:flex;align-items:center;gap:8px;margin-top:8px;"><span style="font-size:18px;">${arrow}</span><span style="color:${trendColor};font-size:13px;font-weight:500;">${trendText}</span><span style="color:#64748b;font-size:12px;margin-left:auto;">${data.length} dní</span></div>`;
}
// =====================================================
// CHJ VERDICT GENERATION (OpenAI)
// =====================================================

async function generateVerdictV2(node, userId) {
  try {
    console.log("🤖 Calling CHJ API for node:", node.id);

    const { data: metrics } = await window.supabaseClient
      .from('user_metrics')
      .select('node_id, state, current_index')
      .eq('user_id', userId)
      .eq('universe', 'longevity');

    console.log("📊 Metrics loaded:", metrics?.length);

    if (!metrics || metrics.length === 0) {
      return { text: 'Zatím nemám dost dat.' };
    }

    const bottleneck = metrics
      .filter(m => m.state === 'RED')
      .sort((a, b) => a.current_index - b.current_index)[0];
    const redCount = metrics.filter(m => m.state === 'RED').length;
    const yellowCount = metrics.filter(m => m.state === 'YELLOW').length;
    const greenCount = metrics.filter(m => m.state === 'GREEN').length;

    const payload = {
      nodeId: node.id,
      userQuestion: null,
      context: {
        state: node.state,
        userId: userId,
        redCount,
        yellowCount,
        greenCount,
        bottleneck: bottleneck?.node_id
      }
    };

    console.log("📤 API request:", payload);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log("📥 Raw response:", text);

    if (!response.ok) {
      return { text: `API error ${response.status}` };
    }

    const data = JSON.parse(text);
    const verdict = data?.verdict || 'API nevrátilo platnou odpověď.';

    console.log("✅ Returning:", verdict);

    return { text: verdict.replace(/\n/g, '<br>') };

  } catch (err) {
    console.error('❌ Error:', err);
    return { text: 'Chyba při komunikaci s AI.' };
  }
}

// =====================================================
// SHOW GAME OF LIFE
// =====================================================

async function showGameOfLife(node) {
  console.log("🎮 showGameOfLife called with node:", node); // ← PŘIDEJ
  const userId = window.firebaseAuth?.currentUser?.uid || 'demo-user-123';

  // 1. Nadpis
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) {
    titleEl.innerHTML = `<span style="font-size:1.4em;margin-right:8px;">🏋️</span>${node.label || 'Stoletý desetibojař'}`;
  }

  // 2. Vytvoř kartu s skeleton loader
  let metricCard = document.querySelector('.metric-card');
  if (metricCard) metricCard.remove();

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

  metricCard.innerHTML = `
    <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Trend (30 dní)</div>
    <div style="height:80px; background:rgba(255,255,255,0.05); border-radius:8px; animation:pulse 1.5s ease-in-out infinite;"></div>
    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    </style>
  `;

  const panelHeader = document.querySelector('.panel-header');
  if (panelHeader) panelHeader.after(metricCard);

  // 3. Načti sparkline async
  renderTrendSparkline(userId, node.id).then(sparkline => {
    metricCard.innerHTML = `
      <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Trend (30 dní)</div>
      ${sparkline}
    `;
  });

  // 4. CHJ KARTA
  let chjCard = document.querySelector('.chj-card');
  if (chjCard) chjCard.remove();

  chjCard = document.createElement('div');
  chjCard.className = 'chj-card';
  chjCard.style.cssText = `
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 20px;
    margin: 15px 0;
    color: #fff;
  `;

  chjCard.innerHTML = `
  <h3 style="display:flex; align-items:center; gap:10px; margin:0 0 15px 0; color:#83B0E3; font-size:18px;">
    🧠 Chytré já říká:
  </h3>
  <div class="chj-message" style="color:#cbd5e1; font-size:15px; line-height:1.6; margin-bottom:15px;">
    Načítám...
  </div>
  
  <!-- TTS Controls -->
  <div class="tts-controls" style="display:flex; gap:10px; margin-top:15px;">
    <button id="tts-play" style="background:#06b6d4; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:14px;">
      🔊 Přehrát
    </button>
    <button id="tts-stop" style="background:#64748b; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:14px; display:none;">
      ⏹ Stop
    </button>
  </div>
`;

  metricCard.after(chjCard);
  console.log("✅ CHJ karta vytvořena");

  // 5. AKCE KARTA
  let actionsCard = document.querySelector('.actions-card');
  if (actionsCard) {
    console.log("🗑️ Removing old actions card");
    actionsCard.remove();
  }

  const actionMap = {
    'kardio': ['Klidná chůze 30 min denně', 'Měř srdeční tep po schodech'],
    'vo2max': ['Začni běhat/chodit rychle 2× týdně', 'Test: 4 patra bez dechu'],
    'sila': ['Posiluj 3× týdně — zaměř se na nohy', 'Zkus dřepy a kliky denně'],
    'stabilita': ['Cvič balanc ráno — 30s na každé noze', 'Jóga nebo tai-chi 2× týdně'],
    'spanek': ['Spi 7-8h pravidelně', 'Vypni obrazovky 1h před spaním'],
    'klid': ['Dechová cvičení 10 min denně', 'Meditace nebo procházka v klidu'],
    'smysl': ['Napiš si 3 věci, za co jsi vděčný', 'Plánuj budoucí aktivity s vnoučaty'],
    'metabolicke': ['Omez cukr a rafinované sacharidy', 'Zkontroluj hladinu glukózy'],
    'mobilita': ['Protahuj se 10 min denně', 'Zkus dotknout se země nataženýma nohama']
  };

  const actions = actionMap[node.id] || ['Pokračuj v tom, co děláš', 'Konzultuj s lékařem'];

  console.log("✅ Akce karta vytváření...");
  actionsCard = document.createElement('div');
  actionsCard.className = 'actions-card'; // ← PŘIDEJ TENHLE ŘÁDEK!
  actionsCard.style.cssText = `
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 20px;
  margin: 15px 0;
`;

  actionsCard.innerHTML = `
  <h3 style="color:#83B0E3; font-size:18px; margin:0 0 15px 0;">⚡ Akce</h3>
  <ul style="list-style:none; padding:0; margin:0; color:#cbd5e1;">
    ${actions.map(a => `<li style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">• ${a}</li>`).join('')}
  </ul>
`;

  chjCard.after(actionsCard);
  console.log("✅ Akce karta přidána");

  // 6. HODNOTY KARTA
  let valuesCard = document.querySelector('.values-card');
  if (valuesCard) valuesCard.remove();

  const resourceMap = {
    'kardio': [
      { title: 'Attia: Zone 2 cardio', url: 'https://peterattiamd.com/zone-2-training' },
      { title: 'Huberman: Cardiovascular health', url: 'https://hubermanlab.com/cardio' }
    ],
    'vo2max': [
      { title: 'Attia: VO2 Max importance', url: 'https://peterattiamd.com/vo2max' },
      { title: 'Cooper test', url: '#' }
    ],
    'sila': [
      { title: 'Huberman: Strength training', url: 'https://hubermanlab.com/strength' },
      { title: 'Attia: Muscle longevity', url: '#' }
    ],
    'spanek': [
      { title: 'Huberman: Sleep toolkit', url: 'https://hubermanlab.com/sleep' },
      { title: 'Walker: Why We Sleep', url: '#' }
    ],
    'klid': [
      { title: 'Huberman: Stress control', url: 'https://hubermanlab.com/stress' },
      { title: 'Attia: HRV recovery', url: '#' }
    ]
  };

  const resources = resourceMap[node.id] || [
    { title: 'Attia: Longevity basics', url: 'https://peterattiamd.com' },
    { title: 'Huberman Lab', url: 'https://hubermanlab.com' }
  ];

  console.log("✅ Hodnoty karta vytváření...");
  valuesCard = document.createElement('div');
  valuesCard.className = 'values-card';
  valuesCard.style.cssText = `
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 20px;
  margin: 15px 0;
`;

  valuesCard.innerHTML = `
  <h3 style="color:#83B0E3; font-size:18px; margin:0 0 15px 0;">📚 Hodnoty</h3>
  <div style="color:#cbd5e1;">
    ${resources.map(r => `
      <a href="${r.url}" target="_blank" style="color:#06b6d4; text-decoration:none; display:block; padding:8px 0;">
        → ${r.title}
      </a>
    `).join('')}
  </div>
`;

  actionsCard.after(valuesCard);
  console.log("✅ Hodnoty karta přidána");

  // 7. GENERATE VERDICT
  console.log("🤖 Calling generateVerdictV2 for:", node.id);
  generateVerdictV2(node, userId).then(verdict => {
    console.log("✅ Verdict received:", verdict);

    const messageEl = chjCard.querySelector('.chj-message');

    if (verdict && verdict.text) {
      const plainText = verdict.text.replace(/<br>/g, ' ');

      // ✅ TYPEWRITER EFEKT
      messageEl.innerHTML = '';
      let i = 0;
      const typingInterval = setInterval(() => {
        if (i < plainText.length) {
          messageEl.innerHTML += plainText.charAt(i);
          i++;
        } else {
          clearInterval(typingInterval);
        }
      }, 45);

      // ✅ TTS
      const playBtn = document.getElementById('tts-play');
      const stopBtn = document.getElementById('tts-stop');

      if (playBtn && stopBtn) {
        console.log("🎤 TTS buttons found, setting up handlers");

        playBtn.onclick = () => {
          console.log("🔊 Play button clicked!");
          speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(plainText);
          utterance.lang = 'cs-CZ';
          utterance.pitch = 1.2;
          utterance.rate = 1.1;

          utterance.onstart = () => {
            console.log("🎙 Speech started");
            playBtn.style.display = 'none';
            stopBtn.style.display = 'block';
          };

          utterance.onend = () => {
            console.log("🎙 Speech ended");
            playBtn.style.display = 'block';
            stopBtn.style.display = 'none';
          };

          utterance.onerror = (e) => {
            console.error("🎙 Speech error:", e);
          };

          console.log("📢 Speaking:", plainText.substring(0, 50) + "...");
          window.speechSynthesis.speak(utterance);
        };

        stopBtn.onclick = () => {
          speechSynthesis.cancel();
          playBtn.style.display = 'block';
          stopBtn.style.display = 'none';
        };
      }

    } else {
      console.error("Invalid verdict:", verdict);
      messageEl.innerHTML = 'Chyba: Nepodařilo se načíst diagnózu.';
    }
  }).catch(err => {
    console.error("Generate verdict error:", err);
    const messageEl = chjCard.querySelector('.chj-message');
    if (messageEl) {
      messageEl.innerHTML = 'Chyba při komunikaci s AI.';
    }
  });
}

export async function updateRecommendations() {
  const valuesContainer = document.querySelector('#resourcesList');
  if (!valuesContainer) return;

  const { data: dashboard, error } = await supabase
    .from('v_vitality_dashboard')
    .select('*')
    .eq('is_bottleneck', true)
    .single();

  if (error || !dashboard) {
    valuesContainer.innerHTML = `
      <div class="onboarding-prompt" style="padding: 15px; text-align: center;">
        <p style="font-size: 13px; color: #9ba1a6;">Zatím nemáš žádná data.</p>
        <button onclick="startOnboarding()" class="btn-primary" style="margin-top: 10px;">Spustit měření</button>
      </div>`;
    return;
  }

  const { data: recommendations } = await supabase
    .from('node_media')
    .select('*')
    .eq('node_id', dashboard.node_id)
    .limit(2);

  if (!recommendations || recommendations.length === 0) return;

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