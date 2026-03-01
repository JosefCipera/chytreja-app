/* ================================================
   MEDIOTÉKA – data ze Supabase (longevity_media + longevity_articles)
   ================================================ */
console.log("🔥 medioteka.js NAČTEN");

const SUPABASE_URL = 'https://pionxzqtxcughvfbgadi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_w29DE53nrdGnNEvBn68kzg_ujje7u5Y';
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

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
      id:          String(r.id),
      type:        r.type,
      title:       r.title,
      description: r.summary || r.source || '',
      url:         r.url,
      node_id:     r.node_id,
      source:      r.source || '',
      duration_min: r.duration_min,
    }));

    const articleItems = (articlesRes.data || []).map(r => ({
      id:         String(r.id),
      type:       'article',
      title:      r.title,
      description: r.source || '',
      url:        r.url,
      contentUrl: r.url,
      node_id:    r.node_id,
      source:     r.source || '',
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
function toEmbedUrl(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0`;
  return url;
}

/* ------------------------------------------------
   3) RENDER GRID – KARTY
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
      <div class="medioteka-card-tag">${item.type.toUpperCase()}</div>
    </div>
  `).join("");
}

/* ------------------------------------------------
   4) VIEWER – MODÁL
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
      const embedUrl = toEmbedUrl(item.url);
      content = `
        <h3 style="color:#fff;margin:0 0 12px">${item.title}</h3>
        <div class="video-wrapper">
          <iframe src="${embedUrl}" frameborder="0"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
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
   5) ZAVŘENÍ MODÁLU
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
   6) VYHLEDÁVÁNÍ – s normalizací diakritiky
   ------------------------------------------------ */

// "Čtyři" → "ctyri", "špatně" → "spatne"
function stripDia(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", () => {
  const q = stripDia(searchInput.value.trim());
  if (!q) { renderMediaGrid(window.MEDIA_ITEMS); return; }

  const filtered = window.MEDIA_ITEMS.filter(item => {
    // primárně title (vždy)
    if (stripDia(item.title).includes(q)) return true;
    // sekundárně description + node_id – jen při delším dotazu
    if (q.length > 2) {
      if (stripDia(item.description).includes(q)) return true;
      if (stripDia(item.node_id).includes(q)) return true;
    }
    return false;
  });
  renderMediaGrid(filtered);
});

/* ------------------------------------------------
   7) INIT
   ------------------------------------------------ */
async function initMedioteka() {
  console.log("🚀 initMedioteka()");
  const items = await loadLibrary();
  window.MEDIA_ITEMS = items;
  renderMediaGrid(items);
}

initMedioteka();
