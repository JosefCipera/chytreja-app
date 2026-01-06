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
const valuesEl = document.getElementById("nodeValues");

function openMdViewer(url) {
  window.open(
    `/app/viewer.html?type=md&file=${encodeURIComponent(url)}`,
    "_blank"
  );
}

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
// nahoře v souboru
export function showPanel(node) {
  console.log("📌 Otevírám panel:", node.id);

  lastSelectedNode = node;
  resetPanel();
  // ⛔ vždy odstranit vitality kartu
  document.querySelectorAll(".metric-card").forEach(el => el.remove());

  // ================================
  // 🏷️ TITUL (ikona + jemné písmo)
  // ================================
  titleEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      ${node.icon ? `
        <span style="
          font-size: 22px;
          line-height: 1;
          opacity: 0.9;
        ">
          ${node.icon}
        </span>` : ""
    }
      <span style="
        font-size: 20px;
        font-weight: 500;
        letter-spacing: 0.2px;
        color: #f1f5f9;
      ">
        ${node.label || ""}
      </span>
    </div>
  `;

  // ================================
  // 📘 DEFINICE
  // ================================
  defEl.textContent = node.definition || "";

  // ================================
  // 📦 HODNOTY
  // ================================
  // ================================
  // 🔋 DEMO – VITALITY / METRIC KARTA
  // ================================
  if (node.id === "dlouhovekost") {

    // 🧹 ochrana proti duplicitě
    const existing = document.querySelector(
      `.metric-card[data-node="${node.id}"]`
    );
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.className = "metric-card";
    container.dataset.node = node.id;

    // 🎨 barva uzlu
    const baseColor = node.color || "#22c55e";
    const bgColor = `${baseColor}22`; // průhledný odstín

    // --- DEMO DATA ---
    const value = 72;
    const unit = "/ 100";
    const range = "celkový stav";
    const status = node.status || "demo";

    // --- HTML ---
    container.innerHTML = `
    <div style="
      font-size:14px;
      opacity:0.85;
      margin-bottom:4px;
    ">
      ${node.label}
    </div>

    <div style="
      font-size:22px;
      margin-bottom:6px;
    ">
      ${value} ${unit}
    </div>

    <div style="
      font-size:13px;
      opacity:0.75;
    ">
      Rozmezí: ${range}
    </div>

    <div style="
      height:8px;
      background:#334155;
      border-radius:6px;
      overflow:hidden;
      margin-top:8px;
    ">
      <div style="
        width:70%;
        height:100%;
        background:${baseColor};
      "></div>
    </div>
  `;

    // --- styl kontejneru ---
    container.style.background = bgColor;
    container.style.border = `1px solid ${baseColor}55`;
    container.style.borderRadius = "14px";
    container.style.padding = "12px 14px";
    container.style.marginTop = "12px";
    container.style.color = "#f1f5f9";
    container.style.boxShadow = "0 4px 10px rgba(0,0,0,0.25)";

    // 👉 vložení hned POD definici
    defEl.insertAdjacentElement("afterend", container);
  }

  if (valuesEl) valuesEl.innerHTML = "";

  const seen = new Set();

  if (node.values && node.values.length > 0) {
    node.values.forEach(v => {

      const key = `${v.type}|${v.title}|${v.url}`;
      if (seen.has(key)) return;
      seen.add(key);

      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.style.marginBottom = "14px";

      const iconMap = {
        article: "📝",
        video: "🎬",
        audio: "🎧",
        md: "📄",
        pdf: "📘",
        image: "🖼️"
      };

      const icon = iconMap[v.type] || "📦";

      let contentHTML = "";

      // 🎬 VIDEO
      // 🎬 VIDEO
if (v.type === "video") {
  contentHTML = `
    <iframe
      src="${v.url}"
      width="100%"
      height="220"
      style="border-radius:10px;margin-top:8px;"
      frameborder="0"
      allowfullscreen>
    </iframe>
  `;
}

      // 🎧 AUDIO
      else if (v.type === "audio") {
        contentHTML = `
    <audio controls style="width:100%;margin-top:8px;">
      <source src="${v.url}">
    </audio>
  `;
      }

      // 🖼️ IMAGE
      else if (v.type === "image") {
        contentHTML = `
    <div style="
      display:flex;
      justify-content:center;
      margin-top:10px;
    ">
      <img
        src="${v.url}"
        style="
          max-width:160px;
          width:100%;
          border-radius:12px;
          box-shadow:0 0 8px rgba(0,0,0,0.35);
        ">
    </div>
  `;
      }
      // 📄 MD / ARTICLE → viewer
      else if (v.type === "md" || v.type === "article") {
        contentHTML = `
    <a href="#" style="color:#38bdf8;">
      Otevřít →
    </a>
  `;
      }

      // 📘 PDF → nový tab
      else if (v.type === "pdf") {
        contentHTML = `
    <a href="#" style="color:#38bdf8;">
      Otevřít →
    </a>
  `;
      }

      // 📦 FALLBACK
      else {
        contentHTML = `
    <a href="${v.url}" target="_blank" style="color:#38bdf8;">
      Otevřít →
    </a>
  `;
      }

      li.innerHTML = `
  <div>
    <div style="
  font-weight:500;
  color:#38bdf8;
  cursor:default;
">
  ${icon} ${v.title}
</div>

    ${v.summary ? `<small style="color:#94a3b8;">${v.summary}</small>` : ""}
    ${contentHTML}
  </div>
`;
      // 👉 SEM TO PŘIDEJ
      li.querySelector("[data-video]")?.addEventListener("click", e => {
        e.preventDefault();
        window.open(
          `/app/viewer.html?type=video&file=${encodeURIComponent(v.url)}`,
          "_blank"
        );
      });

      const link = li.querySelector("a");
      if (link) {
        link.addEventListener("click", e => {
          e.preventDefault();

          if (v.type === "md" || v.type === "article") {
            openMdViewer(v.url);
          } else if (v.type === "pdf") {
            window.open(v.url, "_blank");
          }
        });
      }

      valuesEl.appendChild(li);

    });
  }

  // ================================
  // 👁️ ZOBRAZENÍ PANELU
  // ================================
  panelEl.classList.add("visible");
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

  // ⚠️ DŮLEŽITÉ: klik na síť NEZAVÍRÁ panel
  if (e.target.closest("#network")) return;

  if (!panelEl.contains(e.target)) {
    closePanel();
  }
});

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