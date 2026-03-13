// =====================================================
// UNIVERSE-INIT.JS - SUPABASE INTEGRATION v2.0
// =====================================================
const ORBIT_ZONES = [
  [280, 360],   // větší vzdálenost
  [380, 480],
  [500, 600],
  [620, 740]
];
import { renderUniverse } from "./universe-core.js";
import { initUserDataPanel } from "./user-data-panel.js";
import { listenOnce, handleVoiceInput, proactiveGreeting } from "./universe-voice.js";
import { requestCHJPermission } from "./notifications.js";

// Supabase setup
const { createClient } = window.supabase;
const SUPABASE_URL = 'https://pionxzqtxcughvfbgadi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_w29DE53nrdGnNEvBn68kzg_ujje7u5Y';

window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("✅ Supabase SDK připraveno");

// ─── TTS primer (unlock Web Speech API on first user touch) ───
window._chjTTSPrimed = false;
document.addEventListener('pointerdown', function _primeTTS() {
  const primer = new SpeechSynthesisUtterance('\u00a0');
  primer.volume = 0;
  window.speechSynthesis.speak(primer); // synchronous inside gesture = unlocks engine for session
  window._chjTTSPrimed = true;
  console.log('🔊 TTS engine primed');
  if (typeof window._chjPendingTTS === 'function') {
    window._chjPendingTTS();
    window._chjPendingTTS = null;
  }
}, { once: true });

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

  Object.entries(index)
    .filter(([key]) => key === 'longevity') // ← PŘIDEJ (jen longevity)
    .forEach(([key, cfg]) => {
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
  initUserDataPanel();
  initVoiceButton();
  initHeaderMic();
  initStartGameBtn();
  writeDailySnapshot();   // snapshot stavů uzlů → sparkline trend

  // Žádost o notifikační oprávnění – po 3s, nenásilně
  setTimeout(() => requestCHJPermission(), 3000);
})();

// ── Spusť hru! tlačítko ───────────────────────────────────────
// Primární role: spustí TTS čtení CHJ briefingu v panelu.
// Po kliknutí (nebo po dočtení) se tlačítko skryje – účel splněn.
function initStartGameBtn() {
  const btn = document.getElementById('start-game-btn');
  if (!btn) return;

  const hideBtn = () => {
    btn.style.transition = 'opacity 0.4s';
    btn.style.opacity = '0';
    setTimeout(() => { btn.style.display = 'none'; }, 400);
  };

  // Schovat také po dočtení TTS (pokud uživatel nekliknul sám)
  window._chjOnTTSEnd = hideBtn;

  btn.addEventListener('pointerdown', () => {
    hideBtn();

    // Primer – odemkne TTS engine synchronně v gesture kontextu
    const primer = new SpeechSynthesisUtterance('\u00a0');
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
    window._chjTTSPrimed = true;

    // Pokud panel už načetl data → spusť TTS briefingu přímo
    if (typeof window._chjStartTTS === 'function') {
      window._chjStartTTS();
      return;
    }

    // Panel ještě načítá → spusť pending TTS (nebo počkej na primer)
    const pending = window._chjPendingTTS;
    if (typeof pending === 'function') {
      window._chjPendingTTS = null;
      pending();
    }
    // Jinak: _doAutoTTS se spustí automaticky když panel načte (primed = true)
  }, { once: true });
}

// =====================================================
// DAILY SNAPSHOT – zapiš dnešní stavy do node_state_history
// Zavolá se jednou za den; vybuduje historii pro sparkline trend
// =====================================================
async function writeDailySnapshot() {
  const TODAY_KEY = 'chj_snapshot_' + new Date().toISOString().slice(0, 10); // 'chj_snapshot_2026-03-11'
  if (localStorage.getItem(TODAY_KEY)) return; // dnes už zapsáno

  const userId = await getCurrentUserId();
  if (!userId || userId === 'demo-user-123') return; // jen přihlášení uživatelé

  const nodes = window.MAIN_UNIVERSE_DATA || [];
  const rows = nodes
    .filter(n => n.state && ['GREEN', 'YELLOW', 'RED'].includes(n.state))
    .map(n => ({ user_id: userId, node_id: n.id, date: new Date().toISOString().slice(0, 10), state: n.state }));

  if (rows.length === 0) return;

  const { error } = await window.supabaseClient
    .from('node_state_history')
    .upsert(rows, { onConflict: 'user_id,node_id,date', ignoreDuplicates: true });

  if (error) {
    console.warn('⚠️ writeDailySnapshot:', error.message);
  } else {
    localStorage.setItem(TODAY_KEY, '1');
    console.log(`✅ Daily snapshot: ${rows.length} uzlů`);
  }
}

// =====================================================
// VOICE BUTTON – mic tlačítka (floor + header)
// =====================================================

// Sdílený flag – pozdrav se přehraje jen jednou bez ohledu na to, které mic stlačíš
let _voiceGreeted = false;

async function handleMicClick() {
  // Klik na mic zruší případné probíhající TTS
  if (window.speechSynthesis?.speaking) {
    window.speechSynthesis.cancel();
    return;
  }
  if (!_voiceGreeted) {
    _voiceGreeted = true;
    proactiveGreeting();
    // Pokračuje dál – ihned spustí mic, nečeká na druhý klik
  }
  const text = await listenOnce();
  if (text) await handleVoiceInput(text);
}

function initVoiceButton() {
  const btn = document.getElementById('voice-mic-btn');
  if (!btn) return;
  btn.addEventListener('click', handleMicClick);
}

function initHeaderMic() {
  const btn = document.getElementById('header-mic-btn');
  if (!btn) return;
  btn.addEventListener('click', handleMicClick);
}

// =====================================================
// 4) LOAD MODEL + RENDER
// =====================================================
async function loadAndRenderModel(modelName, role) {
  // ✅ PŘIDEJ guard:
  if (modelName !== 'longevity') {
    console.warn(`⚠️ Model ${modelName} není podporován, fallback na longevity`);
    modelName = 'longevity';
  }
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

  // Auto-open Hra o život – panel se otevře hned po načtení univerza
  // (700ms čeká na inicializaci vis.js sítě)
  setTimeout(async () => {
    const mainNode = window.MAIN_UNIVERSE_DATA?.find(n => n.id === 'dlouhovekost');
    if (mainNode && mainNode.state && mainNode.state !== 'GRAY') {
      const { showPanel } = await import('./universe-panel.js');
      showPanel(mainNode);
    }
  }, 700);

  // Načti user constraints do window.USER_CONSTRAINTS (pro discipline offer)
  (async () => {
    const uid = window.firebaseAuth?.currentUser?.uid;
    if (!uid || uid === 'demo-user-123') return;
    const { data } = await window.supabaseClient
      .from('user_constraints')
      .select('constraint_key, severity')
      .eq('user_id', uid)
      .eq('constraint_type', 'injury');
    window.USER_CONSTRAINTS = data || [];
    console.log(`✅ USER_CONSTRAINTS: ${window.USER_CONSTRAINTS.length} záznamů`);
  })();

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

      const { data: nodes, error: nodesError } = await window.supabaseClient
        .from('longevity_nodes')
        .select('*');

      if (nodesError) throw nodesError;
      console.log(`   ✓ Nodes: ${nodes.length}`);

      const { data: metrics, error: metricsError } = await window.supabaseClient
        .from('user_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('universe', modelName);

      if (metricsError) throw metricsError;
      console.log(`   ✓ Metrics: ${metrics.length}`);
      // ✅ PŘIDEJ — vytvoř mapu node_id → state
      const metricsMap = new Map(metrics.map(m => [m.node_id, m]));
      console.log("📊 Metrics map:", metricsMap); // ← PŘIDEJ

      // ✅ PŘIDEJ — merge state do nodes
      nodes.forEach(node => {
        const metric = metricsMap.get(node.id);
        node.state = metric?.state || 'GRAY'; // ← TOHLE PŘIDÁ STATE!
        node.current_index = metric?.current_index ?? 0;
        node.target_index = metric?.target_index ?? 100;
      });

      console.log("✅ Merged state into nodes");

      window.MAIN_UNIVERSE_DATA = nodes; // ← PŘESUŇ SEM (dovnitř try bloku)
      console.log("🔍 CHECK MERGE:");
      console.log("Total nodes:", window.MAIN_UNIVERSE_DATA.length);
      console.log("Nodes with state:", window.MAIN_UNIVERSE_DATA.filter(n => n.state).length);
      console.log("Sample node:", window.MAIN_UNIVERSE_DATA.find(n => n.id === 'mysl'));
      // Check if user is new (no metrics data)
      if (!metrics || metrics.length === 0) {
        console.log("🆕 New user detected - all nodes will have current_index = 0");
        console.log("💡 User should complete onboarding to populate data");
      }

      const { data: articles, error: articlesError } = await window.supabaseClient
        .from('longevity_articles')
        .select('*');

      if (articlesError) console.warn("⚠️ Articles error:", articlesError);
      console.log(`   ✓ Articles: ${articles?.length || 0}`);

      const { data: media, error: mediaError } = await window.supabaseClient
        .from('longevity_media')
        .select('*');

      if (mediaError) console.warn("⚠️ Media error:", mediaError);
      console.log(`   ✓ Media: ${media?.length || 0}`);

      const { data: docs, error: docsError } = await window.supabaseClient
        .from('longevity_docs')
        .select('*');

      if (docsError) console.warn("⚠️ Docs error:", docsError);
      console.log(`   ✓ Docs: ${docs?.length || 0}`);

      console.log('⏳ Merging data...');

      // const metricsMap = new Map(metrics?.map(m => [m.node_id, m]) || []);
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

          state: node.state, // ← PŘIDEJ TOHLE!

          current_index: metric?.current_index ?? 0,  // Use ?? for explicit 0
          target_index: metric?.target_index ?? 100,
          priority: metric?.priority ?? 5,

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
  renderVisibleUniverse(window.MAIN_UNIVERSE_DATA);
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
  // Wait for Firebase auth to be ready (max 3 seconds)
  let retries = 0;
  while (!window.firebaseAuth?.currentUser && retries < 30) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }

  if (window.firebaseAuth?.currentUser) {
    const uid = window.firebaseAuth.currentUser.uid;
    console.log("✅ Firebase UID:", uid);
    return uid;
  }

  console.warn("⚠️ Firebase auth timeout after 3s, using demo user");
  return "demo-user-123";
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

    const defaultAccess = (role === 'demo' || role === 'free') ? 'locked' : 'visible';
    model.forEach(n => {
      n.access = accessMap.get(n.id) || defaultAccess;
      // Locked uzly vždy zobrazit šedě bez ohledu na metriky z DB
      if (n.access === 'locked') n.state = 'GRAY';
    });

  } catch (err) {
    console.warn("⚠️ Nelze načíst access model", err);
  }
}

// =====================================================
// 8) RENDER VISIBLE UNIVERSE
// =====================================================
function renderVisibleUniverse(model) {
  if (!model || !Array.isArray(model)) {
    console.error("❌ Invalid model data");
    return;
  }

  const visible = model.filter(n => n.access !== "hidden");

  console.log("🔍 Visible nodes with state:", visible.filter(n => n.state).length); // ← PŘIDEJ
  console.log("Sample visible:", visible[0]); // ← PŘIDEJ

  const main = visible.find(n => !n.parent) || visible[0];
  const firstLevel = visible.filter(n => n.id === main.id || n.parent === main.id);

  console.log("First level sample:", firstLevel[0]); // ← PŘIDEJ

  renderUniverse(visible, firstLevel, main.id);
}

// =====================================================
// 9) HEADER CONTROLS
// =====================================================
function initHeaderControls() {
  // ─── Profile dropdown ───
  const profileBtn = document.getElementById("profileBtn");
  const profileDropdown = document.getElementById("profileDropdown");

  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.add("hidden");
      }
    });
  }

  // ─── Role + model selectors ───
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

  modelSelect.addEventListener("change", async (e) => {
    const newModel = e.target.value;
    localStorage.setItem("currentModel", newModel);

    const role = localStorage.getItem("userRole") || "demo";
    await loadAndRenderModel(newModel, role);
  });

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