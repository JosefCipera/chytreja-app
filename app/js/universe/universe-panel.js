import { openViewer } from "./universe-viewers.js";
import { resolveUniverseUrl } from "./universe-paths.js";

let lastSelectedNode = null;
const panelEl = document.getElementById("sidePanel");
const titleEl = document.getElementById("nodeTitle");
const defEl = document.getElementById("nodeDef");
const tasksEl = document.getElementById("nodeTasks");
console.log("Prověřuji element úloh:", tasksEl); // Přidej tento log
const closeBtn = document.getElementById("closePanel");
const valuesEl = document.getElementById("nodeValues");
const priorityContent = document.getElementById("priorityContent");

function openMdViewer(url) {
  window.open(`/app/viewer.html?type=md&file=${encodeURIComponent(url)}`, "_blank");
}

panelEl.addEventListener("click", e => e.stopPropagation());

export function showPanel(node) {
  console.log("📌 Otevírám panel:", node.id);
  console.log("Data pro panel:", node);

  lastSelectedNode = node;
  resetPanel();

  // 1. Vyčistit staré metric-karty, aby se nemnožily při překlikávání
  document.querySelectorAll(".metric-card").forEach(el => el.remove());

  // ================================
  // 🏷️ TITUL
  // ================================
  titleEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      ${node.icon ? `<span style="font-size: 22px; opacity: 0.9;">${node.icon}</span>` : ""}
      <span style="font-size: 20px; font-weight: 500; color: #f1f5f9;">${node.label || ""}</span>
    </div>
  `;

  // ================================
  // 📘 DEFINICE
  // ================================
  defEl.textContent = node.definition || "";

  // ================================
  // 🔋 INDEX KARTA (Index připravenosti)
  // ================================
  const val = node.current_index || (node.content && node.content.current_index);
  const strat = node.strategy_priority || (node.content && node.content.strategy_priority);

  if (val || node.id === 'dlouhovekost') {
    const cardVal = val || 72;
    const container = document.createElement("div");
    container.className = "metric-card";
    container.innerHTML = `
        <div style="font-size:14px; opacity:0.85; margin-bottom:4px;">Index připravenosti</div>
        <div style="font-size:22px; margin-bottom:6px;">${cardVal} / 100</div>
        <div style="height:8px; background:#334155; border-radius:6px; overflow:hidden; margin-top:8px;">
            <div style="width:${cardVal}%; height:100%; background:${node.color || '#38bdf8'};"></div>
        </div>
        <hr style="margin: 15px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; gap:12px; align-items:flex-start;">
            <span style="font-size:20px;">⚡</span>
            <div>
                <div style="font-size:13px; font-weight:bold; color:#fbbf24; margin-bottom:2px;">Strategie (Parťák):</div>
                <div style="font-size:13px; line-height:1.4; opacity:0.9;">${strat || "Sleduj trendy a udržuj konzistenci."}</div>
            </div>
        </div>
    `;
    Object.assign(container.style, {
      background: `${node.color || '#38bdf8'}22`,
      border: `1px solid ${node.color || '#38bdf8'}55`,
      borderRadius: "14px", padding: "12px 14px", marginTop: "12px", color: "#f1f5f9", marginBottom: "20px"
    });
    defEl.insertAdjacentElement("afterend", container);
  }

  // ================================
  // 📦 HODNOTY (Média, PDF, Články)
  // ================================
  if (valuesEl) {
    valuesEl.innerHTML = "";
    const seen = new Set(); // Ochrana proti duplicitám

    if (node.values && node.values.length > 0) {
      node.values.forEach(v => {
        const key = `${v.type}|${v.title}|${v.url}`;
        if (seen.has(key)) return;
        seen.add(key);

        const li = document.createElement("li");
        li.style.listStyle = "none";
        li.style.marginBottom = "18px";

        const iconMap = { article: "📝", video: "🎬", audio: "🎧", md: "📄", pdf: "📘", image: "🖼️" };
        const icon = iconMap[v.type] || "📦";

        let contentHTML = "";
        if (v.type === "video") {
          contentHTML = `<iframe src="${v.url}" width="100%" height="200" style="border-radius:10px;margin-top:8px;" frameborder="0" allowfullscreen></iframe>`;
        } // 🎧 AUDIO - modrý nádech místo šedé
        else if (v.type === "audio") {
          contentHTML = `
    <div style="margin-top:8px; filter: sepia(100%) underline; filter: hue-rotate(170deg) saturate(300%) brightness(90%);">
      <audio controls style="width:100%; height:35px;">
        <source src="${v.url}">
      </audio>
    </div>`;
        } else // 🖼️ IMAGE - zmenšený a centrovaný
          if (v.type === "image") {
            contentHTML = `
            <div style="display:flex; justify-content:center; margin-top:10px;">
              <img src="${v.url}" style="
                max-width: 180px; 
                width: 100%; 
                border-radius: 12px; 
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.1);
              ">
            </div>`;
          } else {
            contentHTML = `<a href="#" class="open-link" style="color:#38bdf8; text-decoration:none; display:block; margin-top:4px;">Otevřít ${v.type.toUpperCase()} →</a>`;
          }

        li.innerHTML = `
          <div>
            <div style="font-weight:500; color:#38bdf8;">${icon} ${v.title}</div>
            ${v.summary ? `<small style="color:#94a3b8; display:block; line-height:1.3; margin-top:2px;">${v.summary}</small>` : ""}
            ${contentHTML}
          </div>
        `;

        // Event listener pro otevírání MD a PDF
        const link = li.querySelector(".open-link");
        if (link) {
          link.addEventListener("click", e => {
            e.preventDefault();
            if (v.type === "md" || v.type === "article") openMdViewer(v.url);
            else window.open(v.url, "_blank");
          });
        }
        valuesEl.appendChild(li);
      });
    }
  }

  // ================================
  // 🧩 ÚLOHY (Interaktivní karty)
  // ================================
  if (tasksEl) {
    tasksEl.innerHTML = "";
    if (node.tasks && node.tasks.length > 0) {
      node.tasks.forEach(task => {
        const li = document.createElement("li");
        li.style.listStyle = "none";
        // V universe-panel.js v části pro vykreslování tasks:
        li.innerHTML = `
    <div class="task-card" style="
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.3);
        padding: 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    " onmouseover="this.style.background='rgba(56, 189, 248, 0.2)'; this.style.transform='translateY(-2px)';" 
      onmouseout="this.style.background='rgba(56, 189, 248, 0.1)'; this.style.transform='translateY(0)';">
        <div style="font-weight:600; color:#fbbf24;">⚡ ${task.title}</div>
        <div style="font-size:12px; opacity:0.8; margin-top:4px;">${task.description}</div>
    </div>
`;
        li.onclick = () => {
          if (task.title.includes("úchopu")) {
            // Vytvoříme interaktivní formulář přímo v kartě úkolu
            const card = li.querySelector('.task-card');
            card.innerHTML = `
      <div style="font-weight:600; color:#fbbf24; margin-bottom:8px;">⚡ Zadej výsledek (kg)</div>
      <div style="display:flex; gap:8px;">
        <input type="number" id="gripValue" placeholder="kg" style="
          width: 70px; background: rgba(0,0,0,0.3); border: 1px solid #38bdf8; 
          color: white; border-radius: 5px; padding: 4px 8px;
        ">
        <button id="saveGrip" style="
          background: #38bdf8; border: none; color: white; 
          border-radius: 5px; padding: 4px 12px; cursor: pointer; font-weight: bold;
        ">Uložit</button>
      </div>
    `;

            // Zabráníme probublávání kliku na kartu
            card.onclick = (e) => e.stopPropagation();

            document.getElementById("saveGrip").onclick = () => {
              const val = document.getElementById("gripValue").value;
              if (val) {
                // Simulace uložení a aktualizace indexu
                alert(`Uloženo: ${val} kg. Tvůj Index připravenosti se přepočítává...`);

                // Animace aktualizace indexu na kartě (pro demo)
                const indexText = document.querySelector(".metric-card div[style*='22px']");
                if (indexText) {
                  indexText.style.color = "#22c55e"; // Zelená jako úspěch
                  indexText.textContent = "75 / 100"; // Zvýšíme index o 3 body
                }
              }
            };
          } else {
            alert(`Spouštím: ${task.title}`);
          }
        };
        tasksEl.appendChild(li);
      });
    } else {
      tasksEl.innerHTML = `<li style="opacity:0.5; font-size:13px; list-style:none;">Žádné aktivní úlohy.</li>`;
    }
  }

  // Úprava textu pod bleskem
  if (priorityContent) priorityContent.textContent = "Sleduj své denní cíle níže.";

  panelEl.classList.add("visible");
}
function resetPanel() {
  [titleEl, defEl, valuesEl, tasksEl].forEach(el => { if (el) el.innerHTML = ""; });
}

export function closePanel() {
  panelEl.classList.remove("visible");
  resetPanel();
}

if (closeBtn) closeBtn.onclick = closePanel;