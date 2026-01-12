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
export function showRecommendationCard() {
  const msgs = document.getElementById("ai-integrated-msgs");
  if (!msgs) return;

  const card = document.createElement("div");
  card.className = "ai-recommendation-card";

  card.innerHTML = `
    <strong>DOPORUČENÍ</strong><br>
    <em>Udržet metabolickou stabilitu</em><br><br>

    <b>Největší přínos dnes:</b><br>
    Klidná chůze v zóně 2 (30–45 min)<br><br>

    <b>Když nemáš čas:</b><br>
    Krátké dechové cvičení (5–10 min)<br><br>

    <button class="rec-done">Hotovo</button>
    <button class="rec-later">Později</button>
  `;

  card.querySelector(".rec-done").onclick = () => {
    card.remove();
    window.showAIDiagnosis("OK.", "bot");
  };

  card.querySelector(".rec-later").onclick = () => {
    card.remove();
  };

  msgs.appendChild(card);
  msgs.scrollTop = msgs.scrollHeight;
}

// --------------------------------------------------
// 6. AI CHIPS
// --------------------------------------------------
function showAIChips(options) {
  console.log("showAIChips CALLED", options);
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
      if (value === "co_mam_delat") {
        console.log("CO MAM DELAT – HIT");
        showRecommendationCard();
        return;
      }

    });

    wrap.appendChild(chip);
  });

  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}
showInitialVerdict();
