// 1. IMPORTY (Vždy úplně nahoře a každý jen jednou!)
import { renderUniverse } from "./universe-core.js";

// 2. NASTAVENÍ SUPABASE
const { createClient } = window.supabase;
const SUPABASE_URL = 'https://pionxzqtxcughvfbgadi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_w29DE53nrdGnNEvBn68kzg_ujje7u5Y';

// 3. INICIALIZACE DO GLOBÁLNÍHO OKNA
window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("✅ Supabase SDK připraveno");

const DATA_BASE = "../data/universes";
// -------------------------------------------------------------
// 1) LOAD INDEX.JSON (universe registry)
// -------------------------------------------------------------
async function loadUniverseIndex() {
  try {
    const res = await fetch("../data/index.json");
    if (!res.ok) throw new Error("index.json nenalezen");

    const indexData = await res.json();
    window.UNIVERSE_INDEX = indexData.universe || {};
    return window.UNIVERSE_INDEX;

  } catch (err) {
    console.error("❌ Nelze načíst index.json:", err);
    window.UNIVERSE_INDEX = {};
    return {};
  }
}

// -------------------------------------------------------------
// 2) POPULATE MODEL SELECTOR
// -------------------------------------------------------------
async function populateModelSelector() {
  const select = document.getElementById("modelSelector");
  if (!select) return;

  select.innerHTML = "";

  const index = window.UNIVERSE_INDEX;
  if (!index) return;

  Object.entries(index).forEach(([key, cfg]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = cfg.label || key;   // ← správný label
    select.appendChild(opt);
  });
}

// -------------------------------------------------------------
// 3) INIT UNIVERSE
// -------------------------------------------------------------
(async function initUniverse() {

  // Načíst index.json
  await loadUniverseIndex();

  // Naplnit dropdown
  await populateModelSelector();

  // Vybrat výchozí model
  const keys = Object.keys(window.UNIVERSE_INDEX);
  if (keys.length === 0) {
    console.error("❌ index.json neobsahuje žádné modely!");
    return;
  }

  const stored = localStorage.getItem("currentModel");
  const modelName = stored || keys[0];

  const role = localStorage.getItem("userRole") || "demo";

  await loadAndRenderModel(modelName, role);

  initHeaderControls();

})();

// -------------------------------------------------------------
// 4) LOAD MODEL + RENDER
// -------------------------------------------------------------
async function loadAndRenderModel(modelName, role) {
  // === NEW: current universe ===
  window.CURRENT_MODEL = modelName;
  const modelPath = window.UNIVERSE_INDEX?.[modelName]?.modelFile;
  if (!modelPath) {
    console.error(`❌ Model "${modelName}" nemá modelFile v index.json`);
    return;
  }

  const model = await loadModel([modelPath], modelName); // Musíme přidat modelName!
  if (!model) {
    console.error(`❌ Nelze načíst model: ${modelName}`);
    return;
  }

  // window.MAIN_UNIVERSE_DATA = model;
  window.BASE_UNIVERSE_DATA = structuredClone(model);
  window.MAIN_UNIVERSE_DATA = structuredClone(model);

  await applyAccessModel(role, model, modelName);

  const headerModelName = document.getElementById("headerModelName");

  if (headerModelName) {
    headerModelName.textContent =
      window.UNIVERSE_INDEX?.[modelName]?.label || modelName;
  }

  // renderUniverse(model);
  // ================================
  // 🌱 STARTOVACÍ PODMNOŽINA (1. úroveň)
  // ================================
  const root = model.find(n => !n.parent);
  const firstLevel = model.filter(
    n => n.id === root.id || n.parent === root.id
  );

  renderUniverse(model, firstLevel);

  updateHeaderColor(role);
}

// -------------------------------------------------------------
// 5) Silently load JSON (HEAD → fetch)
// -------------------------------------------------------------
async function loadModel(urls, modelName) {
  const modelConfig = window.UNIVERSE_INDEX?.[modelName];

  if (modelConfig?.useSupabase) {
    try {
      console.log("📡 Načítám data ze Supabase pro:", modelName);

      // Úprava: přidali jsme is_decathlon_discipline do selectu
      const { data, error } = await window.supabaseClient
        .from("nodes")
        .select(`
          id, label, type, definition, parent, color, icon, 
          current_index, strategy_priority, is_decathlon_discipline,
          node_values ( type, title, description, source ),
          node_tasks ( title, description )
        `);

      if (error) throw error;

      const nodes = data.map(n => ({
        id: n.id,
        label: n.label,
        type: n.type,
        definition: n.definition,
        parent: n.parent, // Vis.js tohle použije pro propojení
        color: n.color,
        icon: n.icon,
        is_decathlon: n.is_decathlon_discipline, // Tady to máme pro filtr desetiboje
        current_index: n.current_index,
        strategy_priority: n.strategy_priority,
        related: [],
        values: (n.node_values || []).map(v => ({
          type: v.type,
          title: v.title,
          summary: v.description,
          url: v.source
        })),
        tasks: (n.node_tasks || []).map(t => ({
          title: t.title,
          description: t.description
        }))
      }));

      // Propojení "related" zůstává stejné - Vis.js tohle žere automaticky
      const map = new Map();
      nodes.forEach(n => map.set(n.id, n));
      nodes.forEach(n => {
        if (n.parent && map.has(n.parent)) {
          map.get(n.parent).related.push(n.id);
        }
      });

      console.log("✅ Model Stoletého desetibojaře sestaven:", nodes);
      return nodes;

    } catch (err) {
      console.error("❌ Chyba při načítání ze Supabase:", err);
      return [];
    }
  }
  return [];
}
// -------------------------------------------------------------
// 6) Access model (free/demo/pro/user)
// -------------------------------------------------------------
async function applyAccessModel(role, model, modelName) {
  const url = `${DATA_BASE}/${modelName}/access/access-${role}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return; // v klidu ignorovat

    const accessData = await res.json();
    const accessMap = new Map(accessData.map(n => [n.id, n.access]));

    model.forEach(n => {
      n.access = accessMap.get(n.id) || "visible";
    });

  } catch (err) {
    console.warn("⚠️ Nelze načíst access model", err);
  }
}

// -------------------------------------------------------------
// 7) Render universe
// -------------------------------------------------------------
function renderVisibleUniverse(model) {
  const visible = model.filter(n => n.access !== "hidden");

  // 1. Najdeme hlavní uzel (Dlouhověkost)
  const main = visible.find(n => !n.parent) || visible[0];

  // 2. Vyfiltrujeme jen hlavní uzel a jeho PŘÍMÉ potomky (Zdraví)
  // Spánek (který má parent: "zdravi") v tomto poli NEBUDE
  const firstLevel = visible.filter(
    n => n.id === main.id || n.parent === main.id
  );

  if (window.UNIVERSE_NETWORK) {
    window.UNIVERSE_NETWORK.destroy();
    window.UNIVERSE_NETWORK = null;
  }

  // 3. Voláme renderUniverse s původním nastavením:
  // DATA (všechno pro navigaci), subset (jen to, co se má teď vykreslit)
  renderUniverse(visible, firstLevel);
}
// -------------------------------------------------------------
// 8) INIT HEADER CONTROLS (role, model switching)
// -------------------------------------------------------------
function initHeaderControls() {

  const roleSelect = document.getElementById("roleSelect");
  const modelSelect = document.getElementById("modelSelector");
  const headerControls = document.querySelector(".header-controls");

  if (!roleSelect || !modelSelect) return;

  // Aktuální hodnoty
  const role = localStorage.getItem("userRole") || "demo";
  const stored = localStorage.getItem("currentModel");
  const modelKeys = Object.keys(window.UNIVERSE_INDEX);
  const defaultModel = stored || modelKeys[0];

  roleSelect.value = role;
  modelSelect.value = defaultModel;

  document.body.classList.add(role);

  // USER režim skryje ovládání
  if (role === "user") {
    headerControls.style.display = "none";
  }

  updateHeaderColor(role);

  // ---- Přepínání role ----
  roleSelect.addEventListener("change", async (e) => {
    const newRole = e.target.value;
    localStorage.setItem("userRole", newRole);

    document.body.classList.remove("demo", "free", "pro", "user");
    document.body.classList.add(newRole);

    updateHeaderColor(newRole);

    if (newRole === "user") return location.reload();

    // reset na BASE
    window.MAIN_UNIVERSE_DATA = structuredClone(window.BASE_UNIVERSE_DATA);

    // ✅ DŮLEŽITÉ – předat model
    await applyAccessModel(
      newRole,
      window.MAIN_UNIVERSE_DATA,
      window.CURRENT_MODEL
    );

    renderVisibleUniverse(window.MAIN_UNIVERSE_DATA);
  });

  // ---- Přepínání modelu ----
  modelSelect.addEventListener("change", async (e) => {
    const newModel = e.target.value;
    localStorage.setItem("currentModel", newModel);

    const role = localStorage.getItem("userRole") || "demo";
    await loadAndRenderModel(newModel, role);
  });
  // === DEV / ADMIN ESCAPE FROM USER MODE ===
  let clickCount = 0;
  let clickTimer = null;

  const appTitle = document.getElementById("appTitle");

  if (appTitle) {
    appTitle.addEventListener("click", () => {
      clickCount++;

      if (!clickTimer) {
        clickTimer = setTimeout(() => {
          clickCount = 0;
          clickTimer = null;
        }, 800);
      }

      if (clickCount >= 3) {
        clickCount = 0;
        clearTimeout(clickTimer);
        clickTimer = null;

        console.warn("🔓 Admin escape: návrat z USER režimu");

        localStorage.setItem("userRole", "demo");
        location.reload();
      }
    });
  }
}

// -------------------------------------------------------------
// 9) Header bar color
// -------------------------------------------------------------
function updateHeaderColor(role) {
  const header = document.getElementById("appHeader");
  if (!header) return;

  const colors = {
    demo: "rgba(59,130,246,0.25)",
    free: "rgba(34,197,94,0.25)",
    pro: "rgba(251,191,36,0.25)",
    user: "rgba(15,23,42,0.9)"
  };

  header.style.background = colors[role] || "rgba(15,23,42,0.9)";
}

// -------------------------------------------------------------
// END FILE
// -------------------------------------------------------------
