import { renderUniverse } from "./universe-core.js";

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

  const modelPath = window.UNIVERSE_INDEX?.[modelName]?.modelFile;
  if (!modelPath) {
    console.error(`❌ Model "${modelName}" nemá modelFile v index.json`);
    return;
  }

  const model = await loadModel([modelPath]);
  if (!model) {
    console.error(`❌ Nelze načíst model: ${modelName}`);
    return;
  }

  window.MAIN_UNIVERSE_DATA = model;

  await applyAccessModel(role, model);
  const headerModelName = document.getElementById("headerModelName");

  if (headerModelName) {
    headerModelName.textContent =
      window.UNIVERSE_INDEX?.[modelName]?.label || modelName;
  }

  renderVisibleUniverse(model);
  updateHeaderColor(role);
}

// -------------------------------------------------------------
// 5) Silently load JSON (HEAD → fetch)
// -------------------------------------------------------------
async function loadModel(urls) {
  for (const url of urls) {
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (!head.ok) continue;

      const res = await fetch(url);
      return await res.json();

    } catch (err) {
      console.warn(`⚠️ Nelze načíst z ${url}`);
    }
  }
  return null;
}

// -------------------------------------------------------------
// 6) Access model (free/demo/pro/user)
// -------------------------------------------------------------
async function applyAccessModel(role, model) {
  const url = `../data/models/access-${role}.json`;

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
  const main = visible.find(n => !n.parent) || visible[0];

  const firstLevel = visible.filter(
    n => n.id === main.id || n.parent === main.id
  );

  if (window.UNIVERSE_NETWORK) {
    window.UNIVERSE_NETWORK.destroy();
    window.UNIVERSE_NETWORK = null;
  }

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
    return;
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

    await applyAccessModel(newRole, window.MAIN_UNIVERSE_DATA);
    renderVisibleUniverse(window.MAIN_UNIVERSE_DATA);
  });

  // ---- Přepínání modelu ----
  modelSelect.addEventListener("change", async (e) => {
    const newModel = e.target.value;
    localStorage.setItem("currentModel", newModel);

    const role = localStorage.getItem("userRole") || "demo";
    await loadAndRenderModel(newModel, role);
  });
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
