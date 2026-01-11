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

// ======================================
// AI CONTEXT – napojení panelu na API
// ======================================
window.setAIContext = async function (nodeId) {
  const msgs = document.getElementById("ai-integrated-msgs");
  if (!msgs) {
    console.warn("AI: #ai-integrated-msgs nenalezen");
    return;
  }

  // vizuální feedback
  msgs.innerHTML = "";
  window.showAIDiagnosis("Dívám se na to…", "bot");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId })
    });

    if (!response.ok) {
      throw new Error("API neodpovídá");
    }

    const data = await response.json();

    msgs.innerHTML = "";
    window.showAIDiagnosis(data.verdict, "bot");

  } catch (err) {
    msgs.innerHTML = "";
    window.showAIDiagnosis(
      "Teď se mi nedaří spojit s mým mozkem. Zkus to za chvíli.",
      "bot"
    );
    console.error("AI error:", err);
  }
};

// --------------------------------------------------
// 4. ÚVODNÍ VERDIKT AI + ÚKOLY
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

    setTasks([
      "Udržet stávající denní rytmus",
      "Nepřidávat dnes další zátěž"
    ]);
    setResources([
      {
        icon: "📄",
        title: "Jak udržet stabilní denní rytmus",
        url: "#"
      }
    ]);

  } else if (index >= 60) {
    conversationState.priority = "metabolický základ";
    conversationState.lastAction = "klidná chůze";

    window.showAIDiagnosis(
      `Stav je dobrý, jen tu je jedno slabší místo.

Dnes má největší smysl podpořit metabolický základ.
Klidná 45minutová chůze udělá víc než jakýkoli tlak na výkon.`,
      "bot"
    );

    setTasks([
      "Klidná chůze (45 minut)",
      "Vyhnout se tlaku na výkon"
    ]);
    setResources([
      {
        icon: "🎧",
        title: "Pohyb bez výkonu – proč funguje",
        url: "#"
      },
      {
        icon: "📄",
        title: "Metabolický základ jednoduše",
        url: "#"
      }
    ]);

  } else {
    conversationState.priority = "regenerace";
    conversationState.lastAction = "zklidnit tempo a spánek";

    window.showAIDiagnosis(
      `Tělo teď potřebuje víc klidu a pozornosti.

Největší přínos dnes bude regenerace.
Zkus jít spát o něco dřív a ubrat tempo.`,
      "bot"
    );

    setTasks([
      "Jít dnes spát o něco dřív",
      "Zpomalit tempo dne"
    ]);
    setResources([
      {
        icon: "📄",
        title: "Regenerace jako základ výkonu",
        url: "#"
      },
      {
        icon: "🎧",
        title: "Spánek a obnova energie",
        url: "#"
      }
    ]);
  }

  showAIChips([
    { label: "Proč", value: "proč" },
    { label: "Úkoly", value: "úkoly" },
    { label: "Rychlá rada", value: "rychlá rada" }
  ]);
};

// --------------------------------------------------
// 5. DETEKCE DOTAZU MIMO PRIORITU
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
// 7. REAKCE AI
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
      "Zaměř se dnes jen na ty doporučené kroky níž. Není potřeba přidávat další věci.";

  } else if (t.includes("rych")) {
    reply =
      "Jedna věc dnes úplně stačí: klidná chůze nebo víc spánku.";

  } else if (isOffTopic(t) && conversationState.lastAction) {
    reply =
      "Můžeme se na to podívat.\n\n" +
      "Teď má ale největší efekt " +
      conversationState.lastAction +
      ".";

  } else {
    reply =
      "Rozumím.\n\n" +
      "Pro dnešek ale pořád platí, že největší přínos má " +
      conversationState.lastAction +
      ".";
  }

  window.showAIDiagnosis(reply, "bot");
};

// --------------------------------------------------
// 8. EVENTY – ENTER + KLIK
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

// --------------------------------------------------
// 10. ÚKOLY – JEDINÁ DEFINICE (‼️)
// --------------------------------------------------
window.setTasks = function (tasks) {
  const list = document.getElementById("tasksList");
  const section = document.getElementById("tasksSection");

  if (!list || !section) return;

  list.innerHTML = "";

  if (!tasks.length) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  tasks.forEach(task => {
    const li = document.createElement("li");
    li.textContent = task;
    list.appendChild(li);
  });
}
window.setResources = function (resources) {
  const list = document.getElementById("resourcesList");
  const section = document.getElementById("resourcesSection");

  if (!list || !section) return;

  list.innerHTML = "";

  if (!resources.length) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  resources.forEach(res => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="resource-icon">${res.icon || "🔗"}</span>
      <span>${res.title}</span>
    `;

    li.addEventListener("click", () => {
      window.open(res.url, "_blank");
    });

    list.appendChild(li);
  });
}
