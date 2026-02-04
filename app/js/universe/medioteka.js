/* ================================================
   MEDIOTÉKA – FINÁLNÍ VERZE PRO iting.cz
   ================================================ */
console.log("🔥 medioteka.js NAČTEN");

/* ------------------------------------------------
   1) LOAD LIBRARY (JSON)
   ------------------------------------------------ */
async function loadLibrary() {
  try {
    const res = await fetch("../data/medioteka.json");
    if (!res.ok) throw new Error("Soubor medioteka.json nenalezen");

    const data = await res.json();
    console.log("📦 Načteno:", data.library);

    return data.library || [];
  } catch (err) {
    console.error("❌ Nelze načíst mediotéku:", err);
    return [];
  }
}

/* ------------------------------------------------
   2) RESOLVE URL – BEZ MAGIE
   ------------------------------------------------ */
function resolveMediaUrl(item) {
  if (item.type === "video") return item.url;
  if (item.type === "article") return item.contentUrl;
  return item.url;
}

/* ------------------------------------------------
   3) RENDER GRID – KARTY
   ------------------------------------------------ */
function renderMediaGrid(items) {
  const grid = document.getElementById("mediaGrid");
  grid.innerHTML = "";

  const icons = {
    audio: `<i class="fa-solid fa-headphones fa-2xl" style="color:#a855f7"></i>`,
    video: `<i class="fa-solid fa-video fa-2xl" style="color:#ef4444"></i>`,
    image: `<i class="fa-solid fa-image fa-2xl" style="color:#4ade80"></i>`,
    pdf: `<i class="fa-solid fa-file-pdf fa-2xl" style="color:#fbbf24"></i>`,
    article: `<i class="fa-solid fa-book-open fa-2xl" style="color:#a78bfa"></i>`
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

  const url = resolveMediaUrl(item);
  let content = "";

  switch (item.type) {

    case "audio":
      content = `
        <audio controls class="medioteka-audio">
          <source src="${url}" type="audio/mpeg">
        </audio>`;
      break;

    case "video":
      content = `
        <div class="video-wrapper">
          <iframe src="${url}" frameborder="0"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>`;
      break;

    case "image":
      content = `<img src="${url}" alt="${item.title}">`;
      break;

    case "pdf":
      content = `<iframe class="pdf-frame" src="${url}"></iframe>`;
      break;

    case "article":
      fetch(item.contentUrl)
        .then(res => res.text())
        .then(txt => {
          document.getElementById("modalContent").innerHTML =
            `<div class="article-body">${marked.parse(txt)}</div>`;
        });
      break;
  }

  document.getElementById("modalContent").innerHTML = content;
  document.getElementById("mediaModal").classList.remove("hidden");
};

/* ------------------------------------------------
   5) ZAVŘENÍ MODÁLU
   ------------------------------------------------ */
function closeMediaModal() {
  document.getElementById("mediaModal").classList.add("hidden");
}

document.addEventListener("click", (e) => {
  const modal = document.getElementById("mediaModal");
  if (!modal || modal.classList.contains("hidden")) return;
  if (e.target === modal || e.target.matches(".medioteka-modal-close")) {
    closeMediaModal();
  }
});

/* ------------------------------------------------
   6) VYHLEDÁVÁNÍ
   ------------------------------------------------ */
const searchInput = document.getElementById("searchInput");

searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = window.MEDIA_ITEMS.filter(item =>
    item.title.toLowerCase().includes(q)
  );
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
