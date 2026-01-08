// ======================================
// AI ASISTENT – PANEL CHAT (MENTOR VERZE)
// ======================================

// --------------------------------------------------
// 1. VÝPIS ZPRÁV (AI + UŽIVATEL)
// --------------------------------------------------
window.showAIDiagnosis = function (text, type = "bot") {
  const msgs = document.getElementById("ai-integrated-msgs");
  if (!msgs) {
    console.warn("AI: container #ai-integrated-msgs nenalezen");
    return;
  }

  const msgDiv = document.createElement("div");
  msgDiv.className = `ai-msg ${type}`;
  msgDiv.innerText = text;

  msgs.appendChild(msgDiv);
  msgs.scrollTop = msgs.scrollHeight;
};

// --------------------------------------------------
// 2. STAV KONTEXTU (UZEL)
// --------------------------------------------------
let currentNodeContext = {
  label: null,
  index: null
};

// --------------------------------------------------
// 3. STAV KONVERZACE (VEDENÍ)
// --------------------------------------------------
let conversationState = {
  priority: null,
  lastAction: null
};

// --------------------------------------------------
// Voláno z universe-panel.js
// --------------------------------------------------
window.setAIContext = function (nodeLabel, nodeIndex) {
  const msgs = document.getElementById("ai-integrated-msgs");
  if (!msgs) return;

  msgs.innerHTML = "";
  currentNodeContext.label = nodeLabel;
  currentNodeContext.index = nodeIndex;

  window.showAIDiagnosis(
    `Podívám se na oblast ${nodeLabel} a na to, co je teď nejdůležitější.`,
    "bot"
  );

  setTimeout(window.showInitialVerdict, 600);
};

// --------------------------------------------------
// 4. ÚVODNÍ VERDIKT AI + NASTAVENÍ PRIORITY
// --------------------------------------------------
window.showInitialVerdict = function () {
  const { index } = currentNodeContext;

  if (index >= 80) {
    conversationState.priority = "udržení rovnováhy";
    conversationState.lastAction = "zůstat konzistentní";

    window.showAIDiagnosis(
      `Celkově je to ve velmi dobrém stavu.

Teď dává největší smysl držet to, co už funguje.
Stačí zůstat konzistentní a nic zbytečně nehrotit.`,
      "bot"
    );

  } else if (index >= 60) {
    conversationState.priority = "metabolický základ";
    conversationState.lastAction = "klidná chůze";

    window.showAIDiagnosis(
      `Stav je dobrý, jen tu je jedno slabší místo.

Dnes má největší smysl podpořit metabolický základ.
Klidná 45minutová chůze udělá víc než jakýkoli tlak na výkon.`,
      "bot"
    );

  } else {
    conversationState.priority = "regenerace";
    conversationState.lastAction = "zklidnit tempo a spánek";

    window.showAIDiagnosis(
      `Tělo teď potřebuje víc klidu a pozornosti.

Největší přínos dnes bude regenerace.
Zkus jít spát o něco dřív a ubrat tempo.`,
      "bot"
    );
  }

  showAIChips([
    { label: "Proč", value: "proč" },
    { label: "Úkoly", value: "úkoly" },
    { label: "Rychlá rada", value: "rychlá rada" }
  ]);
};

// --------------------------------------------------
// 5. DETEKCE DOTAZU MIMO PRIORITU (DEMO HEURISTIKA)
// --------------------------------------------------
function isOffTopic(text) {
  const t = text.toLowerCase();
  const offTopicKeywords = [
    "suplement",
    "doplněk",
    "vitamin",
    "protein",
    "technologie",
    "aplikace",
    "peníze",
    "nemám čas",
    "čas"
  ];

  return offTopicKeywords.some(k => t.includes(k));
}

// --------------------------------------------------
// 6. ZPRACOVÁNÍ VSTUPU UŽIVATELE
// --------------------------------------------------
function handleSend() {
  const input = document.getElementById("aiPanelInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  window.showAIDiagnosis(text, "user");

  setTimeout(() => {
    window.handleAIReply(text);
  }, 300);
}

// --------------------------------------------------
// 7. REAKCE AI – VEDENÍ KONVERZACE 🍒
// --------------------------------------------------
window.handleAIReply = function (text) {
  const t = text.toLowerCase();
  let reply = "";

  if (t.includes("proč")) {
    reply =
      "Protože právě tady se teď nejvíc rozhoduje o tom, jak se budeš cítit dál.\n\n" +
      "Malá změna v pohybu má v tomhle stavu větší efekt než složité zásahy.";

  } else if (t.includes("úkol")) {
    reply =
      "Pojďme na jednoduché kroky:\n\n" +
      "• klidná chůze\n" +
      "• bez tlaku na výkon\n" +
      "• jen plynulý pohyb\n\n" +
      "To úplně stačí.";

  } else if (t.includes("rych")) {
    reply =
      "Dnes udělej jednu věc:\n" +
      "projdi se v klidu a bez cíle.";

  } else if (isOffTopic(t) && conversationState.lastAction) {
    reply =
      "Můžeme se na to podívat.\n\n" +
      "Teď má ale největší efekt " +
      conversationState.lastAction +
      ".\n" +
      "Tam bych se dnes soustředil.";

  } else {
    reply =
      "Rozumím.\n\n" +
      "Z hlediska dneška ale pořád platí, že největší přínos má " +
      conversationState.lastAction +
      ".";
  }

  window.showAIDiagnosis(reply, "bot");
};

// --------------------------------------------------
// 8. EVENTY – ENTER + KLIK NA ŠIPKU
// --------------------------------------------------
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "aiPanelInput") {
    e.preventDefault();
    handleSend();
  }
});

document.addEventListener("click", (e) => {
  if (
    e.target.closest(".fa-paper-plane") &&
    e.target.closest("#sidePanel")
  ) {
    handleSend();
  }
});

// --------------------------------------------------
// 9. AI CHIPS
// --------------------------------------------------
function showAIChips(options) {
  const msgs = document.getElementById("ai-integrated-msgs");
  if (!msgs) return;

  const wrap = document.createElement("div");
  wrap.className = "ai-chips";

  options.forEach(opt => {
    const chip = document.createElement("div");
    chip.className = "ai-chip";
    chip.innerText = opt.label;

    chip.addEventListener("click", () => {
      window.showAIDiagnosis(opt.value, "user");
      window.handleAIReply(opt.value);
    });

    wrap.appendChild(chip);
  });

  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}
