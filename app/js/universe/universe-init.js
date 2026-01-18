// =====================================================
// UNIVERSE-INIT.JS - SUPABASE INTEGRATION v2.0
// =====================================================

import { renderUniverse } from "./universe-core.js";

// Supabase setup
const { createClient } = window.supabase;
const SUPABASE_URL = 'https://pionxzqtxcughvfbgadi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_w29DE53nrdGnNEvBn68kzg_ujje7u5Y';  // ← Tvůj původní

window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("✅ Supabase SDK připraveno");

const DATA_BASE = "../data/universes";

// =====================================================
// 1) LOAD INDEX.JSON
// =====================================================
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

// =====================================================
// 2) POPULATE MODEL SELECTOR
// =====================================================
async function populateModelSelector() {
  const select = document.getElementById("modelSelector");
  if (!select) return;

  select.innerHTML = "";
  const index = window.UNIVERSE_INDEX;
  if (!index) return;

  Object.entries(index).forEach(([key, cfg]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = cfg.label || key;
    select.appendChild(opt);
  });
}

// =====================================================
// 3) INIT UNIVERSE
// =====================================================
(async function initUniverse() {
  await loadUniverseIndex();
  await populateModelSelector();

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

// =====================================================
// 4) LOAD MODEL + RENDER
// =====================================================
async function loadAndRenderModel(modelName, role) {
  window.CURRENT_MODEL = modelName;

  console.log(`🔄 Loading model: ${modelName}`);

  const model = await loadModel(modelName);

  if (!model || model.length === 0) {
    console.error("❌ No data loaded!");
    return;
  }

  console.log(`✅ Loaded ${model.length} nodes`);

  window.BASE_UNIVERSE_DATA = structuredClone(model);
  window.MAIN_UNIVERSE_DATA = structuredClone(model);

  await applyAccessModel(role, window.MAIN_UNIVERSE_DATA, modelName);

  renderVisibleUniverse(window.MAIN_UNIVERSE_DATA);

  const headerModelName = document.getElementById("headerModelName");
  if (headerModelName) {
    headerModelName.textContent = window.UNIVERSE_INDEX?.[modelName]?.label || modelName;
  }
  updateHeaderColor(role);
}

// =====================================================
// 5) LOAD MODEL - HYBRID (Supabase + JSON)
// =====================================================
async function loadModel(modelName) {
  const modelConfig = window.UNIVERSE_INDEX?.[modelName];
  if (!modelConfig) return [];

  // ========================================
  // A) SUPABASE MODE
  // ========================================
  if (modelConfig.useSupabase) {
    console.log("📡 Loading from Supabase...");

    try {
      const userId = await getCurrentUserId();

      // 1. Načti strukturu uzlů
      const { data: nodes, error: nodesError } = await window.supabaseClient
        .from('longevity_nodes')
        .select('*');

      if (nodesError) throw nodesError;
      console.log(`   ✓ Nodes: ${nodes.length}`);

      // 2. Načti user metriky
      const { data: metrics, error: metricsError } = await window.supabaseClient
        .from('user_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('universe', modelName);

      if (metricsError) throw metricsError;
      console.log(`   ✓ Metrics: ${metrics.length}`);

      // 3. Načti články
      const { data: articles, error: articlesError } = await window.supabaseClient
        .from('node_articles')
        .select('*');

      if (articlesError) console.warn("⚠️ Articles error:", articlesError);
      console.log(`   ✓ Articles: ${articles?.length || 0}`);

      // 4. Načti media
      const { data: media, error: mediaError } = await window.supabaseClient
        .from('node_media')
        .select('*');

      if (mediaError) console.warn("⚠️ Media error:", mediaError);
      console.log(`   ✓ Media: ${media?.length || 0}`);

      // 5. Načti docs
      const { data: docs, error: docsError } = await window.supabaseClient
        .from('node_docs')
        .select('*');

      if (docsError) console.warn("⚠️ Docs error:", docsError);
      console.log(`   ✓ Docs: ${docs?.length || 0}`);

      // 6. MERGE všechno dohromady
      // 6. MERGE - OPTIMALIZOVANÁ VERZE
      console.log('⏳ Merging data...');

      // Vytvoř mapy místo opakovaného find/filter
      const metricsMap = new Map(metrics?.map(m => [m.node_id, m]) || []);
      const articlesMap = new Map();
      const mediaMap = new Map();
      const docsMap = new Map();

      articles?.forEach(a => {
        if (!articlesMap.has(a.node_id)) articlesMap.set(a.node_id, []);
        articlesMap.get(a.node_id).push(a);
      });

      media?.forEach(m => {
        if (!mediaMap.has(m.node_id)) mediaMap.set(m.node_id, []);
        mediaMap.get(m.node_id).push(m);
      });

      docs?.forEach(d => {
        if (!docsMap.has(d.node_id)) docsMap.set(d.node_id, []);
        docsMap.get(d.node_id).push(d);
      });

      const merged = nodes.map(node => {
        const metric = metricsMap.get(node.id);
        const nodeArticles = articlesMap.get(node.id) || [];
        const nodeMedia = mediaMap.get(node.id) || [];
        const nodeDocs = docsMap.get(node.id) || [];

        return {
          id: node.id,
          label: node.label,
          parent: node.parent,
          icon: node.icon,
          definition: node.definition,
          color: node.color,

          current_index: metric?.current_index || 0,
          target_index: metric?.target_index || 100,
          priority: metric?.priority || 5,

          articles: nodeArticles.map(a => ({
            title: a.title,
            url: a.url,
            summary: a.summary
          })),
          media: nodeMedia.map(m => ({
            type: m.type,
            title: m.title,
            url: m.url,
            summary: m.summary
          })),
          docs: nodeDocs.map(d => ({
            type: d.type,
            title: d.title,
            url: d.url,
            summary: d.summary
          }))
        };
      });

      console.log('✅ Merge completed:', merged.length, 'nodes');

      console.log("✅ Supabase data merged");
      return merged;

    } catch (err) {
      console.error("❌ Supabase load failed:", err);
      return [];
    }
  }

  // ========================================
  // B) JSON MODE (fallback)
  // ========================================
  try {
    const url = modelConfig.modelFile;
    console.log("📄 Loading from JSON:", url);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`JSON load failed: ${url}`);

    const data = await res.json();
    console.log(`✅ JSON data: ${data.length} nodes`);

    return data;

  } catch (err) {
    console.error("❌ JSON load failed:", err);
    return [];
  }
}

// =====================================================
// 6) GET CURRENT USER ID
// =====================================================
async function getCurrentUserId() {
  // Pro demo vracíme hardcoded ID
  return "demo-user-123";

  // V produkci:
  // const { data: { user } } = await window.supabaseClient.auth.getUser();
  // return user?.id;
}

// =====================================================
// 7) ACCESS MODEL
// =====================================================
async function applyAccessModel(role, model, modelName) {
  const url = `${DATA_BASE}/${modelName}/access/access-${role}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return;

    const accessData = await res.json();
    const accessMap = new Map(accessData.map(n => [n.id, n.access]));

    model.forEach(n => {
      n.access = accessMap.get(n.id) || "visible";
    });

  } catch (err) {
    console.warn("⚠️ Nelze načíst access model", err);
  }
}

// =====================================================
// 8) RENDER VISIBLE UNIVERSE
// =====================================================
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

  console.log("🚀 Rendering:", firstLevel.length, "nodes (first level)");
  renderUniverse(visible, firstLevel, main.id);
}

// =====================================================
// 9) HEADER CONTROLS
// =====================================================
function initHeaderControls() {
  const roleSelect = document.getElementById("roleSelect");
  const modelSelect = document.getElementById("modelSelector");
  const headerControls = document.querySelector(".header-controls");

  if (!roleSelect || !modelSelect) return;

  const role = localStorage.getItem("userRole") || "demo";
  const stored = localStorage.getItem("currentModel");
  const modelKeys = Object.keys(window.UNIVERSE_INDEX);
  const defaultModel = stored || modelKeys[0];

  roleSelect.value = role;
  modelSelect.value = defaultModel;
  document.body.classList.add(role);

  if (role === "user") {
    headerControls.style.display = "none";
  }

  updateHeaderColor(role);

  // Přepínání role
  roleSelect.addEventListener("change", async (e) => {
    const newRole = e.target.value;
    localStorage.setItem("userRole", newRole);

    document.body.classList.remove("demo", "free", "pro", "user");
    document.body.classList.add(newRole);
    updateHeaderColor(newRole);

    if (newRole === "user") return location.reload();

    window.MAIN_UNIVERSE_DATA = structuredClone(window.BASE_UNIVERSE_DATA);
    await applyAccessModel(newRole, window.MAIN_UNIVERSE_DATA, window.CURRENT_MODEL);
    renderVisibleUniverse(window.MAIN_UNIVERSE_DATA);
  });

  // Přepínání modelu
  modelSelect.addEventListener("change", async (e) => {
    const newModel = e.target.value;
    localStorage.setItem("currentModel", newModel);

    const role = localStorage.getItem("userRole") || "demo";
    await loadAndRenderModel(newModel, role);
  });

  // Admin escape
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

// =====================================================
// 10) HEADER COLOR
// =====================================================
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

// =====================================================
// 🔋 BONUS: Load Vitality Score
// =====================================================
window.loadVitalityScore = async function () {
  const userId = await getCurrentUserId();
  const universe = window.CURRENT_MODEL;

  const { data, error } = await window.supabaseClient.rpc('calculate_vitality_score', {
    p_user_id: userId,
    p_universe: universe
  });

  if (error) {
    console.error("❌ Vitality Score error:", error);
    return null;
  }

  console.log("🔋 Vitality Score:", data[0]);
  return data[0];
};