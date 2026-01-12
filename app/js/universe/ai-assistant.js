console.log("ASSISTANT JS LOADED");

// ======================================
// AI ASISTENT – PANEL CHAT (MENTOR DEMO)
// ======================================
// import { showRecommendationCard } from "./universe-panel.js";

// --------------------------------------------------
// 1. VÝPIS ZPRÁV
// --------------------------------------------------
window.showAIDiagnosis = function (text, type = "bot") {
  const msgs = document.getElementById("ai-integrated-msgs");
  if (!msgs) return;

  const msgDiv = document.createElement("div");
  msgDiv.className = `ai-msg ${type}`;
  msgDiv.innerText = text;

  msgs.appendChild(msgDiv);
  msgs.scrollTop = msgs.scrollHeight;
};

// --------------------------------------------------
// 2. STAV KONVERZACE
// --------------------------------------------------
let conversationState = {
  lastAction: "klidná chůze v zóně 2"
};

// --------------------------------------------------
// 3. ÚVODNÍ VERDIKT + CHIPSY
// --------------------------------------------------
window.showInitialVerdict = function () {
  window.showAIDiagnosis(
    "Metabolická stabilita je na solidní úrovni.\n\n" +
    "Ranní glykémie kolem 6.8 mmol/l je v keto běžná adaptace. " +
    "Tělo šetří glukózou a jede hlavně na tucích.",
    "bot"
  );

  showAIChips([
    { label: "Proč?", value: "proč" },
    { label: "Co mám dělat?", value: "co_mam_delat" }
  ]);
};

// --------------------------------------------------
// 4. REAKCE NA CHIPSY / TEXT
// --------------------------------------------------
window.handleAIReply = function (text) {
  const t = text.toLowerCase();

  // PROČ
  if (t === "proč") {
    window.showAIDiagnosis(
      "Protože jsi teď v režimu, kdy tělo funguje stabilně na tucích.\n\n" +
      "V tomhle stavu mají malé, klidné zásahy větší efekt než snaha něco lámat silou.",
      "bot"
    );
    return;
  }

  // CO MÁM DĚLAT
  if (t === "co_mam_delat") {
    window.showAIDiagnosis(
      "👉 Největší přínos dnes:\n" +
      "Klidná chůze v zóně 2 (30–45 minut).\n\n" +
      "👉 Když nemáš čas:\n" +
      "Krátké dechové cvičení (5–10 minut).\n\n" +
      "Tím podpoříš stabilitu, aniž bys tělo zbytečně stresoval.",
      "bot"
    );
    window.__pendingTasks = [
      "Klidná chůze v zóně 2 (30–45 min)\nBez tlaku. Jen pohyb, který tě drží stabilního.",
      "Krátké dechové cvičení (5–10 min)\nKdyž není čas na chůzi, tohle stačí."
    ];

    return;
  }

  // MIMO TRASU – mentor vrací fokus
  if (t.length > 3) {
    window.showAIDiagnosis(
      "Tohle teď není podstatné.\n\n" +
      "Rozhodující je udržet dnešní stabilitu.\n" +
      "Největší efekt má jedna jednoduchá věc – a tu máš přímo tady.\n\n" +
      "👉 Klikni na *Co mám dělat*.",
      "bot"
    );
    return;
  }

  // DEFAULT (krátké vstupy apod.)
};

// --------------------------------------------------
// 5. INLINE DOPORUČENÍ (KARTA)
// --------------------------------------------------

// --------------------------------------------------
// 6. AI CHIPS
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
      window.showAIDiagnosis(opt.label, "user");
      window.handleAIReply(opt.value);
    });

    wrap.appendChild(chip);
  });

  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}
// showInitialVerdict();
