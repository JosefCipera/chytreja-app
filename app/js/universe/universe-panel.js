const panelEl = document.getElementById("sidePanel");
const titleEl = document.getElementById("nodeTitle");
const defEl = document.getElementById("nodeDef");
const tasksEl = document.getElementById("nodeTasks");

export function closePanel() {
  if (panelEl) {
    panelEl.classList.remove("open", "visible");
    setTimeout(() => { panelEl.style.display = "none"; }, 300);
    document.body.classList.remove("panel-open");
  }
}

// Přidáme globální přístup pro křížek v AI chatu
window.closePanel = closePanel;

function resetPanel() {
  if (titleEl) titleEl.innerHTML = "";
  if (defEl) defEl.innerHTML = "";
  if (tasksEl) {
    tasksEl.innerHTML = "";
    tasksEl.style.display = "block";
  }
  // Vyčistíme karty indexu
  document.querySelectorAll(".metric-card").forEach(el => el.remove());

  // KLÍČOVÉ: Vyčistíme i zprávy asistenta, aby mohl "měřit" znovu
  const msgs = document.getElementById('ai-integrated-msgs');
  if (msgs) msgs.innerHTML = "";
}

export function showPanel(node) {
  if (!panelEl) return;
  resetPanel();

  // 1. ZÁKLADNÍ TEXTY
  if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-circle-nodes"></i> ${node.label || "Detail"}`;
  if (defEl) defEl.textContent = node.definition || "";

  // 2. KARTA MĚŘENÍ (Tady bereme to reálné číslo)
  const val = node.current_index || 72;
  const metricCard = document.createElement("div");
  metricCard.className = "metric-card";
  metricCard.style.cssText = `background: ${node.color || '#38bdf8'}22; border: 1px solid ${node.color || '#38bdf8'}55; border-radius: 12px; padding: 15px; margin: 15px 0; color: #f1f5f9;`;
  metricCard.innerHTML = `
    <div style="font-size:12px; opacity:0.7; margin-bottom:5px;">Index připravenosti</div>
    <div style="font-size:22px; font-weight:bold;">${val} / 100</div>
    <div style="height:8px; background:rgba(0,0,0,0.3); border-radius:4px; margin:10px 0; overflow:hidden;">
        <div style="width:${val}%; height:100%; background:${node.color || '#38bdf8'}; transition: width 0.5s ease;"></div>
    </div>
  `;
  defEl.after(metricCard);

  // 3. PROPOJENÍ S "CHYTRÉ JÁ" (Bez duplicit)
  // Najdeme tvůj nadpis "Chytré já", který už v panelu máš
  const aiTitle = Array.from(panelEl.querySelectorAll('b, h3, .panel-section-title')).find(el => el.textContent.includes("Chytré já"));

  if (aiTitle) {
    // 3. PROPOJENÍ S "CHYTRÉ JÁ" – pevný kotevní bod
    let msgsContainer = document.getElementById('ai-integrated-msgs');
    if (!msgsContainer) {
      msgsContainer = document.createElement('div');
      msgsContainer.id = 'ai-integrated-msgs';
      msgsContainer.style.cssText =
        "padding: 10px 0; color: #cbd5e1; font-size: 14px; min-height: 40px;";

      const aiSection = document.getElementById('aiPanelSection');
      if (aiSection) {
        aiSection.before(msgsContainer);
      }
    }
  }

  // 4. SKRYTÍ STARÉHO MODRÉHO BOXU
  // Pokud v HTML stále straší ten starý overlay, tady ho definitivně vypneme
  const oldOverlay = document.getElementById('aiChatOverlay');
  if (oldOverlay) oldOverlay.style.display = 'none';

  // 5. ZOBRAZENÍ PANELU
  panelEl.style.display = "block";
  setTimeout(() => {
    panelEl.classList.add("open", "visible");
    document.body.classList.add("panel-open");

    // 6. SPUŠTĚNÍ ASISTENTA S REÁLNÝMI DATY
    // Posíláme label (např. "Zdraví") a reálnou hodnotu (např. 72)
    if (window.setAIContext) {
      window.setAIContext(node.label || "Detail", val);
    }
  }, 10);
}