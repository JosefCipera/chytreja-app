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
  if (!panelEl) return;
  resetPanel();

  const nodeColor = node.color || '#38bdf8';

  // 1. ZÁKLADNÍ TEXTY
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-circle-nodes" style="color:${nodeColor}"></i> ${node.label || "Detail"}`;
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


