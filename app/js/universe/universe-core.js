// === UNIVERSE-CORE.JS ===

import { showPanel, closePanel } from "./universe-panel.js";

const el = {
  network: document.getElementById("network"),
  side: document.getElementById("sidePanel")
};

let network;
let isSubUniverse = false;
let currentCenter = null;

const universeHistory = [];
let lastRenderedNodes = [];

// 🌌 Vykreslení hlavní nebo podsítě
export function renderUniverse(DATA, subset = null, forcedMainId = null) {

  const nodes = [];
  const edges = [];
  const seen = new Set();
  const source = subset || DATA;
  console.log("🔧 renderUniverse()"); // ← OK tady
  console.log("Received nodes:", source.length); // ← OK tady
  console.log("First node:", source[0]); // ← OK tady
  // 🧼 znič předchozí síť
  if (network && typeof network.destroy === "function") {
    network.destroy();
  }

  // 🧠 dynamický hlavní uzel
  let centerNode = null;

  if (forcedMainId) {
    centerNode = source.find(n => n.id === forcedMainId);
  }

  if (!centerNode && currentCenter) {
    centerNode = source.find(n => n.id === currentCenter);
  }

  if (!centerNode) {
    centerNode = source.find(n => !n.parent) || source[0];
  }

  const mainId = centerNode?.id;

  // 🔹 Vytvoř uzly + hrany
  source.forEach(it => {
    const isMain = it.id === mainId;
    nodes.push(makeNode(it, isMain));

    if (it.parent) {
      const parentExists = source.some(p => p.id === it.parent);
      if (parentExists) {
        const key = [it.parent, it.id].sort().join("::");
        if (!seen.has(key)) {
          seen.add(key);
          edges.push(makeEdge(it.parent, it.id));
        }
      }
    }
  });

  // 🔸 DataSety
  const nodesDS = new vis.DataSet(nodes);
  const edgesDS = new vis.DataSet(edges);

  // ⚙️ Nastavení vzhledu a fyziky
  const options = {
    nodes: { shadow: true },
    edges: {
      smooth: { enabled: true, type: "dynamic", roundness: 0.55 },
      dashes: true,
      width: 1.6,
      color: { color: "#6b7280" }
    },
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -25000,  // ← Slabší
        springLength: 220,              // ← Kratší
        springConstant: 0.03,           // ← Tužší pružiny
        avoidOverlap: 0.8               // ← Menší buffer
      },
      stabilization: {
        enabled: true,
        iterations: 150,
        fit: true,
        updateInterval: 5  // ← Rychlejší stabilizace (méně viditelná)
      }
    }
  };

  // 🌌 Vykreslení nové sítě
  network = new vis.Network(el.network, { nodes: nodesDS, edges: edgesDS }, options);

  // 🔒 Overlay zamečků na locked uzlech (canvas drawing)
  const lockedIds = source.filter(n => n.access === 'locked' || n.state === 'GRAY').map(n => n.id);
  if (lockedIds.length) {
    network.on("afterDrawing", (ctx) => {
      const positions = network.getPositions(lockedIds);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "20px serif";
      lockedIds.forEach(id => {
        const pos = positions[id];
        if (pos) ctx.fillText("🔒", pos.x, pos.y);
      });
      ctx.restore();
    });
  }

  // ✨ Vycentrování s animací
  setTimeout(() => network.fit({ animation: true }), 300);

  // 🖱️ Klik – otevře panel nebo návrat
  let clickTimer = null;
  network.on("click", params => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }

    clickTimer = setTimeout(() => {
      clickTimer = null;

      if (!params.nodes.length) {
        const panelWasOpen = document.getElementById("sidePanel")?.classList.contains("open");
        closePanel();
        // Návrat o úroveň výš jen pokud panel byl už zavřený
        if (!panelWasOpen && currentCenter) {
          smoothReturnToUniverse(DATA);
        }
        return;
      }

      const id = params.nodes[0];
      const node = findNodeById(DATA, id);
      if (node) showPanel(node);
    }, 220);
  });

  // 👆 Dvojklik = vstup do podsítě
  network.on("doubleClick", params => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }

    closePanel();

    if (!params.nodes.length) return;
    const id = params.nodes[0];
    const node = findNodeById(DATA, id);
    if (!node) return;
    openSubUniverse(DATA, node);
  });

  lastRenderedNodes = [...source];
}

// === Pomocné funkce ===

function makeNode(it, isMain) {
  console.log(`🎨 makeNode: ${it.id}, state: ${it.state}`); // ← PŘIDEJ
  // Semafor barvy podle state
  const stateColors = {
    'GREEN': '#22c55e',
    'YELLOW': '#eab308',
    'RED': '#ef4444',
    'GRAY': '#64748b'
  };

  // Použij state color pokud existuje, jinak fallback
  const baseColor = stateColors[it.state] ||
    (typeof it.color === "string" ? it.color : (it.color && it.color.background)) ||
    "#1e293b";

  const borderColor =
    (typeof it.color === "object" && it.color && it.color.border)
      ? it.color.border
      : baseColor;

  const isLocked = it.access === 'locked' || it.state === 'GRAY';

  return {
    id: it.id,
    label: it.label,
    color: {
      background: baseColor,
      border: borderColor,
      highlight: {
        background: lighten(baseColor, 0.25),
        border: borderColor
      }
    },
    shape: "dot",
    size: isMain ? 46 : 34,
    font: {
      color: "#fff",
      size: isMain ? 22 : 18,
      face: "Inter, sans-serif",
      strokeWidth: 4,
      strokeColor: "rgba(0,0,0,0.9)"
    },
    borderWidth: 3,
    shadow: true,
    fixed: false
  };
}

function makeEdge(from, to) {
  const direction = Math.random() > 0.5 ? "curvedCW" : "curvedCCW";
  const roundness = 0.25 + Math.random() * 0.2;
  return {
    id: [from, to].sort().join("::"),
    from,
    to,
    color: { color: "#6b7280" },
    dashes: true,
    width: 1.6,
    smooth: { enabled: true, type: direction, roundness }
  };
}

function findNodeById(DATA, id) {
  return DATA.find(n => n.id === id) || null;
}

// === Podsíť ===
function openSubUniverse(DATA, centerNode) {
  const children = DATA.filter(n => n.parent === centerNode.id);
  if (children.length === 0) return;

  // 🔹 Ulož aktuální stav
  if (currentCenter) {
    universeHistory.push({
      centerId: currentCenter,
      nodes: [...lastRenderedNodes]
    });
  }

  currentCenter = centerNode.id;
  isSubUniverse = true;

  console.log('📥 Opening sub-universe:', centerNode.id);
  console.log('📚 History depth:', universeHistory.length);

  renderUniverse(DATA, [centerNode, ...children], centerNode.id);
}

function smoothReturnToUniverse(DATA) {
  console.log('🔙 Smooth return');

  if (universeHistory.length === 0) {
    // Vrať se na root
    currentCenter = null;
    isSubUniverse = false;
    const root = DATA.find(n => !n.parent);
    const firstLevel = DATA.filter(n => n.id === root.id || n.parent === root.id);
    console.log('🏠 Back to root');
    renderUniverse(DATA, firstLevel, root.id);
    return;
  }

  // Vytáhni předchozí stav
  const prev = universeHistory.pop();
  currentCenter = prev.centerId;
  isSubUniverse = universeHistory.length > 0;

  console.log('📤 Restored:', currentCenter);

  // ⭐ OPRAVA 2: přidán setTimeout
  setTimeout(() => {
    renderUniverse(DATA, prev.nodes, prev.centerId);
  }, 50);
}

function lighten(hex, percent) {
  if (typeof hex !== "string") return "#64748b";
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent * 100);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}