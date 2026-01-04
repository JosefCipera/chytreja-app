// === UNIVERSE-PANEL.JS ===
// Clean verze panelu s podporou viewerů

import { openViewer } from "./universe-viewers.js";
import { resolveUniverseUrl } from "./universe-paths.js";
let lastSelectedNode = null; // Globální proměnná pro udržení stavu
// Elementy panelu
const panelEl = document.getElementById("sidePanel");
const titleEl = document.getElementById("nodeTitle");
const defEl = document.getElementById("nodeDef");
const docsEl = document.getElementById("nodeDocs");
const mediaEl = document.getElementById("nodeMedia");
const tasksEl = document.getElementById("nodeTasks");
const closeBtn = document.getElementById("closePanel");

// ⛔ Zabrání zavření panelu při kliku uvnitř panelu
panelEl.addEventListener("click", e => {
  e.stopPropagation();
});

// ⛔ Zavírací tlačítko – cílené zavření panelu
if (closeBtn) {
  closeBtn.addEventListener("click", e => {
    e.stopPropagation();
    closePanel();
  });
}

// === Reset panelu ===
function resetPanel() {
  [titleEl, defEl, docsEl, mediaEl, tasksEl].forEach(el => {
    if (el) el.innerHTML = "";
  });

  document.querySelectorAll(".lab-info").forEach(x => x.remove());

  if (window.bioCards) {
    window.bioCards.forEach(card => card.remove());
    window.bioCards.clear();
  }

  const dashBtn = document.getElementById("openBioDashboard");
  if (dashBtn) dashBtn.remove();
}

// === Zavření panelu ===
export function closePanel() {
  panelEl.classList.remove("visible");
  resetPanel();
  console.log("🟥 Panel zavřen.");
}

if (closeBtn) {
  closeBtn.addEventListener("click", closePanel);
}

// Klik mimo panel zavře panel
document.addEventListener("click", e => {
  if (!panelEl.classList.contains("visible")) return;
  if (!panelEl.contains(e.target)) closePanel();
});

// === Hlavní funkce: SHOW PANEL ===
export function showPanel(node) {
  console.log("📌 Otevírám panel:", node.id);

  // TENTO ŘÁDEK PŘIDEJ SEM:
  lastSelectedNode = node;

  resetPanel();
  // ... zbytek kódu zůstává stejný
  // --- Titulek ---
  let iconHTML = "";
  if (node.icon) {
    iconHTML = `
    <span style="
      font-size: 32px;
      line-height: 1;
      margin-right: 10px;
      display: inline-flex;
      align-items: center;
      transform: translateY(1px);
    ">
      ${node.icon}
    </span>`;
  }

  titleEl.innerHTML = `
    <div style="display:flex;align-items:center;">
      ${iconHTML}
      <span style="
        font-size: 22px;
        font-weight:600;
        color:#f1f5f9;
      ">
        ${node.label}
      </span>
    </div>
  `;

  // --- Definice ---
  defEl.textContent = node.definition || "";

  // ================================
  //  📄 1) ARTICLES (Markdown)
  // ================================
  if (node.articles) {
    node.articles.forEach(a => {
      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.style.marginBottom = "12px";

      li.innerHTML = `
        <a href="#" style="color:#38bdf8;font-weight:500;">📝 ${a.title}</a>
        <br><small style="color:#94a3b8">${a.summary || ""}</small>
      `;

      li.querySelector("a").onclick = e => {
        e.preventDefault();
        openViewer(resolveUniverseUrl(a.url, window.CURRENT_MODEL));
      };

      if (docsEl) docsEl.appendChild(li);
    });
  }

  // ================================
  //  📘 2) DOCS (PDF, MD)
  // ================================
  if (node.docs) {
    node.docs.forEach(doc => {
      const isMd = doc.url.toLowerCase().endsWith(".md");
      const icon = isMd ? "📝" : "📄";

      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.style.marginBottom = "14px";

      li.innerHTML = `
        <a href="#" style="color:#38bdf8;font-weight:500;">
          ${icon} ${doc.title}
        </a>
        <br><small style="color:#94a3b8">${doc.summary || ""}</small>
      `;

      li.querySelector("a").onclick = e => {
        e.preventDefault();
        openViewer(resolveUniverseUrl(doc.url, window.CURRENT_MODEL));
      };

      if (docsEl) docsEl.appendChild(li);
    });
  }

  // ================================
  //  🎬 3) MEDIA (video/audio/image)
  // ================================
  if (node.media) {
    node.media.forEach(m => {
      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.style.marginBottom = "20px";

      const mediaUrl = resolveUniverseUrl(m.url, window.CURRENT_MODEL);

      let html = `
        <p style="color:#38bdf8;font-weight:500;margin:0 0 4px 0;">
          ${m.title}
        </p>
        <small style="color:#94a3b8">${m.summary || ""}</small><br>
      `;

      if (m.type === "video") {
        html += `
          <iframe width="100%" height="220"
                  src="${mediaUrl}"
                  frameborder="0"
                  allowfullscreen
                  style="border-radius:10px;margin-top:8px;">
          </iframe>`;
      }

      if (m.type === "audio") {
        html += `
          <audio controls style="width:100%;margin-top:8px;">
            <source src="${mediaUrl}">
          </audio>`;
      }

      if (m.type === "image") {
        html += `
          <img src="${mediaUrl}"
               alt="${m.title}"
               style="
                 display:block;
                 margin:12px auto;
                 width:100%;
                 max-width:180px;
                 border-radius:12px;
                 box-shadow:0 0 8px rgba(0,0,0,0.35);
               ">
        `;
      }

      li.innerHTML = html;
      if (mediaEl) mediaEl.appendChild(li);
    });
  }

  // ================================
  //  🔗 4) TASKS / odkazy
  // ================================
  if (node.tasks) {
    node.tasks.forEach(t => {
      const li = document.createElement("li");
      li.style.listStyle = "none";

      li.innerHTML = t.url
        ? `<a href="${t.url}" target="_blank" style="color:#38bdf8;">🔗 ${t.title}</a>`
        : `• ${t.title}`;

      if (tasksEl) tasksEl.appendChild(li);
    });
  }

  // === Zobrazení panelu ===
  panelEl.classList.add("visible");
}

// === Funkce pro návrat z dokumentu zpět na detail uzlu ===
export function handleBackFromDocument() {
  console.log("🔙 Návrat na uzel:", lastSelectedNode?.id);

  // 1. Zavřeme viewer (tohle většinou řeší universe-viewers.js, ale pro jistotu:)
  const viewer = document.getElementById('viewerContainer') || document.getElementById('doc-reader');
  if (viewer) viewer.style.display = 'none';

  // 2. Zobrazíme zpět boční panel
  if (panelEl) {
    panelEl.classList.add("visible");
  }

  // 3. Pokud máme zapamatovaný uzel, znovu ho vykreslíme, aby data nezmizela
  if (lastSelectedNode) {
    showPanel(lastSelectedNode);
  }
}