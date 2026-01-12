console.log("ASSISTANT JS LOADED");

// ======================================
// AI ASISTENT – PANEL CHAT (MENTOR DEMO)
// ======================================
import { showRecommendationCard } from "./universe-panel.js";

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

  if (t === "proč") {
    window.showAIDiagnosis(
      "Protože právě v tomhle stavu má jemné řízení větší efekt " +
      "než snaha něco lámat přes koleno.",
      "bot"
    );

    showAIChips([
      { label: "OK, chápu", value: "ok" },
      { label: "Co mám dělat?", value: "co_mam_delat" }
    ]);
    return;
  }

  if (t === "co_mam_delat") {
    showRecommendationCard();
    return;
  }

  window.showAIDiagnosis(
    "Pro dnešek pořád platí, že největší přínos má " +
    conversationState.lastAction +
    ".",
    "bot"
  );
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

showInitialVerdict();
