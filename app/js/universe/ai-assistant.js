console.log("ASSISTANT JS LOADED - API VERSION");

// ======================================
// AI ASISTENT – PANEL CHAT (API VERSION)
// ======================================

// --------------------------------------------------
// GLOBÁLNÍ KONTEXT
// --------------------------------------------------
let currentNodeId = null;

window.setAIContext = function (nodeId) {
  currentNodeId = nodeId;
  console.log("🎯 AI context set:", nodeId);
};

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
// THINKING INDIKÁTOR
// --------------------------------------------------
function addThinking() {
  const msgs = document.getElementById("ai-integrated-msgs");
  if (!msgs) return null;

  const thinkingDiv = document.createElement("div");
  thinkingDiv.className = "ai-msg bot thinking";
  thinkingDiv.innerText = "…";

  msgs.appendChild(thinkingDiv);
  msgs.scrollTop = msgs.scrollHeight;

  return thinkingDiv;
}

// --------------------------------------------------
// API VOLÁNÍ
// --------------------------------------------------
async function callAI(userQuestion = null) {
  if (!currentNodeId) {
    console.error("❌ NodeId not set!");
    return "Chyba: Uzel není nastaven.";
  }

  try {
    console.log("📡 Calling /api/chat with:", { nodeId: currentNodeId, userQuestion });

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: currentNodeId,
        userQuestion: userQuestion
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log("✅ API response:", data);

    return data.verdict || "Nepodařilo se získat odpověď.";

  } catch (err) {
    console.error("❌ API error:", err);
    return "Chyba při komunikaci s AI. Zkus to prosím znovu.";
  }
}

// --------------------------------------------------
// 3. ÚVODNÍ VERDIKT (API CALL)
// --------------------------------------------------
window.showInitialVerdict = async function () {
  console.log("🎯 showInitialVerdict called");

  const thinking = addThinking();
  const verdict = await callAI(null); // null = initial verdict

  if (thinking) thinking.remove();

  window.showAIDiagnosis(verdict, "bot");

  // Chipsy - zatím základní (můžeš upravit podle AI odpovědi)
  showAIChips([
    { label: "Proč?", value: "Proč mám tento stav?" },
    { label: "Co mám dělat?", value: "Co mám konkrétně dělat?" }
  ]);
};

// --------------------------------------------------
// 4. REAKCE NA UŽIVATELSKÝ INPUT (API CALL)
// --------------------------------------------------
window.handleAIReply = async function (text) {
  if (!text || !text.trim()) return;

  console.log("💬 User question:", text);

  const thinking = addThinking();
  const reply = await callAI(text); // text = user question

  if (thinking) thinking.remove();

  window.showAIDiagnosis(reply, "bot");

  // Můžeš přidat chipsy podle kontextu
  // showAIChips([...]);
};

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

console.log("✅ AI Assistant ready (API mode)");