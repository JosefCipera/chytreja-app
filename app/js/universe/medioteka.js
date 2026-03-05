/* ================================================
   MEDIOTÉKA – data ze Supabase (longevity_media + longevity_articles)
   ================================================ */
console.log("🔥 medioteka.js NAČTEN");

const SUPABASE_URL = 'https://pionxzqtxcughvfbgadi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_w29DE53nrdGnNEvBn68kzg_ujje7u5Y';
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ------------------------------------------------
   Oblast + Autor mapping
   ------------------------------------------------ */
const OBLAST_MAP = {
  sila:           'Pohyb',
  vytrvalost:     'Pohyb',
  mobilita:       'Pohyb',
  stabilita:      'Pohyb',
  rovnovaha:      'Pohyb',
  telo:           'Pohyb',
  kardio:         'Srdce & cévy',
  spanek:         'Spánek',
  stres:          'Stres & imunita',
  imunitni:       'Stres & imunita',
  mysl:           'Mozek',
  nervovy_system: 'Mozek',
  vyziva:         'Výživa',
  metabolicke:    'Metabolismus',
  zdravi:         'Dlouhověkost',
  dlouhovekost:   'Dlouhověkost',
};

function getOblast(node_id) {
  return OBLAST_MAP[node_id] || 'Ostatní';
}

function getAutor(source) {
  const s = (source || '').toLowerCase();
  if (s.includes('huberman')) return 'Huberman';
  if (s.includes('attia') || s.includes('chytré') || s.includes('chytrej')) return 'Attia';
  if (s.includes('walker')) return 'Walker';
  if (s.includes('galpin')) return 'Galpin';
  if (s.includes('patrick') || s.includes('rhonda')) return 'Patrick';
  return 'Ostatní';
}

/* filter state */
let activeOblast = null;
let activeAutor  = null;
let currentPage  = 0;
const PAGE_SIZE  = 12;

/* ------------------------------------------------
   1) LOAD LIBRARY – ze Supabase
   ------------------------------------------------ */
async function loadLibrary() {
  try {
    const [mediaRes, articlesRes] = await Promise.all([
      sb.from('longevity_media').select('*').order('node_id'),
      sb.from('longevity_articles').select('*').order('node_id'),
    ]);

    if (mediaRes.error) throw mediaRes.error;
    if (articlesRes.error) throw articlesRes.error;

    const mediaItems = (mediaRes.data || []).map(r => ({
      id:           String(r.id),
      type:         r.type,
      title:        r.title,
      description:  r.summary || r.source || '',
      url:          r.url,
      node_id:      r.node_id,
      source:       r.source || '',
      duration_min: r.duration_min,
      oblast:       getOblast(r.node_id),
      autor:        getAutor(r.source),
      script_cz:    r.script_cz || null,
    }));

    const articleItems = (articlesRes.data || []).map(r => ({
      id:          String(r.id),
      type:        'article',
      title:       r.title,
      description: r.source || '',
      url:         r.url,
      contentUrl:  r.url,
      node_id:     r.node_id,
      source:      r.source || '',
      oblast:      getOblast(r.node_id),
      autor:       getAutor(r.source),
    }));

    const all = [...mediaItems, ...articleItems];
    console.log(`📦 Načteno: ${all.length} položek (${mediaItems.length} media, ${articleItems.length} článků)`);
    return all;

  } catch (err) {
    console.error("❌ Nelze načíst mediotéku ze Supabase:", err);
    return [];
  }
}

/* ------------------------------------------------
   2) YOUTUBE URL → embed
   ------------------------------------------------ */
function toEmbedUrl(url, mute = false) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match) {
    const tMatch = url.match(/[?&]t=(\d+)s?/);
    const start = tMatch ? `&start=${tMatch[1]}` : '';
    const muteParam = mute ? '&mute=1' : '';
    return `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0${start}${muteParam}`;
  }
  return url;
}

/* ------------------------------------------------
   3) RENDER GRID – KARTY (bez type tagu, s oblastí)
   ------------------------------------------------ */
function renderMediaGrid(items) {
  const grid = document.getElementById("mediaGrid");
  grid.innerHTML = "";

  if (!items.length) {
    grid.innerHTML = `<p style="color:#888;text-align:center;grid-column:1/-1;">Žádné položky k zobrazení.</p>`;
    return;
  }

  const icons = {
    audio:   `<i class="fa-solid fa-headphones fa-2xl" style="color:#a855f7"></i>`,
    video:   `<i class="fa-solid fa-video fa-2xl" style="color:#ef4444"></i>`,
    image:   `<i class="fa-solid fa-image fa-2xl" style="color:#4ade80"></i>`,
    pdf:     `<i class="fa-solid fa-file-pdf fa-2xl" style="color:#fbbf24"></i>`,
    article: `<i class="fa-solid fa-book-open fa-2xl" style="color:#a78bfa"></i>`,
  };

  grid.innerHTML = items.map(item => `
    <div class="medioteka-card" onclick="openMediaModal('${item.id}')">
      <div class="medioteka-card-icon">${icons[item.type] || "📄"}</div>
      <div class="medioteka-card-title">${item.title}</div>
      <div class="medioteka-card-desc">${item.description || ""}</div>
      <div class="medioteka-card-oblast">${item.oblast}</div>
    </div>
  `).join("");
}

/* ------------------------------------------------
   4) CHIPS – render Oblast + Autor
   ------------------------------------------------ */
function renderChips(items) {
  // Oblast chips
  const oblasts = [...new Set(items.map(i => i.oblast))].sort();
  const oblastEl = document.getElementById("oblastChips");
  if (oblastEl) {
    oblastEl.innerHTML = oblasts.map(o => `
      <button class="medioteka-chip${activeOblast === o ? ' active' : ''}"
              onclick="toggleOblast('${o}')">${o}</button>
    `).join("");
  }

  // Autor chips
  const autors = [...new Set(items.map(i => i.autor))].sort();
  const autorEl = document.getElementById("autorChips");
  if (autorEl) {
    autorEl.innerHTML = autors.map(a => `
      <button class="medioteka-chip medioteka-chip--autor${activeAutor === a ? ' active' : ''}"
              onclick="toggleAutor('${a}')">${a}</button>
    `).join("");
  }
}

/* ------------------------------------------------
   5) FILTRY – vyhledávání + oblast + autor
   ------------------------------------------------ */
function stripDia(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function applyFilters() {
  const q = stripDia(document.getElementById("searchInput").value.trim());
  let items = window.MEDIA_ITEMS;

  if (activeOblast) items = items.filter(i => i.oblast === activeOblast);
  if (activeAutor)  items = items.filter(i => i.autor  === activeAutor);
  if (q)            items = items.filter(i => stripDia(i.title).startsWith(q));

  window.FILTERED_ITEMS = items;
  currentPage = 0;
  renderPage();
}

function renderPage() {
  const items = window.FILTERED_ITEMS ?? [];
  const from  = currentPage * PAGE_SIZE;
  renderMediaGrid(items.slice(from, from + PAGE_SIZE));
  renderPagination(items.length);
}

function renderPagination(total) {
  const el = document.getElementById("pagination");
  if (!el) return;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const from = currentPage * PAGE_SIZE + 1;
  const to   = Math.min((currentPage + 1) * PAGE_SIZE, total);

  el.innerHTML = `
    <button onclick="changePage(-1)" class="medioteka-page-btn" ${currentPage === 0 ? 'disabled' : ''}>← Předchozí</button>
    <span class="medioteka-page-info">${from}–${to} z ${total}</span>
    <button onclick="changePage(1)"  class="medioteka-page-btn" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Další →</button>
  `;
}

window.changePage = function(dir) {
  const total      = window.FILTERED_ITEMS?.length ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  currentPage = Math.max(0, Math.min(currentPage + dir, totalPages - 1));
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleOblast = function(o) {
  activeOblast = (activeOblast === o) ? null : o;
  renderChips(window.MEDIA_ITEMS);
  applyFilters();
};

window.toggleAutor = function(a) {
  activeAutor = (activeAutor === a) ? null : a;
  renderChips(window.MEDIA_ITEMS);
  applyFilters();
};

/* ------------------------------------------------
   6) VIEWER – MODÁL
   ------------------------------------------------ */
window.openMediaModal = function (id) {
  const item = window.MEDIA_ITEMS.find(x => x.id === id);
  if (!item) return;

  let content = "";

  switch (item.type) {

    case "audio":
      content = `
        <h3 style="color:#fff;margin:0 0 12px">${item.title}</h3>
        ${item.source ? `<p style="color:#888;font-size:13px;margin:0 0 16px">${item.source}</p>` : ''}
        <audio controls class="medioteka-audio">
          <source src="${item.url}" type="audio/mpeg">
        </audio>`;
      break;

    case "video": {
      // Má-li cvik český koučovací text, ztlumíme originální zvuk
      const hasCzScript = !!item.script_cz;
      const embedUrl = toEmbedUrl(item.url, hasCzScript);

      const scriptPanel = hasCzScript ? `
        <div style="
          margin-top:16px;
          background:rgba(168,85,247,0.12);
          border:1px solid rgba(168,85,247,0.3);
          border-radius:12px;
          padding:14px 18px;
          display:flex;gap:12px;align-items:flex-start;
        ">
          <span style="font-size:22px;line-height:1.3">🐢</span>
          <p style="
            margin:0;color:#e2d9f3;font-size:14px;line-height:1.6;
            font-style:italic;
          ">${item.script_cz}</p>
        </div>` : '';

      content = `
        <h3 style="color:#fff;margin:0 0 12px">${item.title}</h3>
        <div class="video-wrapper">
          <iframe src="${embedUrl}" frameborder="0"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
        ${scriptPanel}
        <div style="text-align:center;margin-top:12px;">
          <a href="${item.url}" target="_blank"
             style="color:#a855f7;font-size:13px;text-decoration:none;">
            ↗ Otevřít na YouTube
          </a>
        </div>`;
      break;
    }

    case "image":
      content = `<img src="${item.url}" alt="${item.title}" style="max-width:100%">`;
      break;

    case "pdf":
      content = `<iframe class="pdf-frame" src="${item.url}"></iframe>`;
      break;

    case "article":
      document.getElementById("modalContent").innerHTML =
        `<p style="color:#888">Načítám článek…</p>`;
      document.getElementById("mediaModal").classList.remove("hidden");
      fetch(item.contentUrl)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then(txt => {
          document.getElementById("modalContent").innerHTML =
            `<div class="article-body">${marked.parse(txt)}</div>`;
        })
        .catch(err => {
          document.getElementById("modalContent").innerHTML =
            `<p style="color:#ef4444">Chyba načítání článku: ${err.message}</p>`;
        });
      return;
  }

  document.getElementById("modalContent").innerHTML = content;
  document.getElementById("mediaModal").classList.remove("hidden");
};

/* ------------------------------------------------
   7) ZAVŘENÍ MODÁLU
   ------------------------------------------------ */
function closeMediaModal() {
  document.getElementById("mediaModal").classList.add("hidden");
  document.getElementById("modalContent").innerHTML = "";
}

window.closeMediaModal = closeMediaModal;

document.addEventListener("click", (e) => {
  const modal = document.getElementById("mediaModal");
  if (!modal || modal.classList.contains("hidden")) return;
  if (e.target === modal || e.target.matches(".medioteka-modal-close")) {
    closeMediaModal();
  }
});

/* ------------------------------------------------
   8) VYHLEDÁVÁNÍ
   ------------------------------------------------ */
document.getElementById("searchInput").addEventListener("input", () => applyFilters());

/* ------------------------------------------------
   9) INIT
   ------------------------------------------------ */
async function initMedioteka() {
  console.log("🚀 initMedioteka()");
  const items = await loadLibrary();
  window.MEDIA_ITEMS = items;

  // Předfiltrování podle ?node= z URL (odkaz z panelu)
  const nodeParam = new URLSearchParams(window.location.search).get('node');
  if (nodeParam) {
    activeOblast = getOblast(nodeParam);
    console.log(`🔍 Předfiltrováno z panelu: node=${nodeParam} → oblast=${activeOblast}`);
  }

  renderChips(items);
  applyFilters();
}

initMedioteka();
