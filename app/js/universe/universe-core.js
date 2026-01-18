// === UNIVERSE-CORE.JS ===
// Radiální stabilní renderer (TOC-like)
// ====================================

import { showPanel, closePanel } from "./universe-panel.js";

/* =======================
   KONSTANTY VZHLEDU
======================= */

/* const NODE_STYLE = {
  sun: { size: 53, font: 22 },       // Polovina původního
  subSun: { size: 47, font: 20 },
  planet: { size: 38, font: 18 }
};*/

function getNodeStyle(modelName) {
  const multiplier = modelName === 'bmc' ? 1.15 : 0.75;

  return {
    sun: { size: Math.round(62 * multiplier), font: 22 },
    subSun: { size: Math.round(58 * multiplier), font: 21 },  // ← 52→58 (+11%)
    planet: { size: Math.round(44 * multiplier), font: 18 }
  };
}

const ORBIT_ZONES = [
  [260, 320],
  [340, 420],
  [460, 540],
  [580, 680]
];

const EDGE_STYLE = {
  color: "#6b7280",
  width: 1.6,
  dashes: true
};

/* =======================
   DOM & STAV
======================= */

const el = {
  network: document.getElementById("network"),
  side: document.getElementById("sidePanel")
};

let network = null;
let currentCenter = null;
let isSubUniverse = false;

const universeHistory = [];
let lastRenderedNodes = [];

/* =======================
   HELPERY
======================= */

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function lighten(hex, percent) {
  if (!hex || typeof hex !== "string") return "#64748b";
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent * 100);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? Math.max(0, R) : 255) * 0x10000 +
      (G < 255 ? Math.max(0, G) : 255) * 0x100 +
      (B < 255 ? Math.max(0, B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

function findNodeById(DATA, id) {
  return DATA.find(n => n.id === id) || null;
}

/* =======================
   HLAVNÍ RENDER
======================= */

export function renderUniverse(DATA, subset = null, forcedMainId = null) {
  console.group("🌞 renderUniverse");

  // ⚠️ OCHRANA PROTI ZACYKLENÍ
  if (window._renderInProgress) {
    console.warn('⚠️ Render already in progress, skipping...');
    console.groupEnd();
    return;
  }

  window._renderInProgress = true;

  try {
    console.log("subset ids:", (subset || DATA).map(n => n.id));
    console.log("forcedMainId:", forcedMainId);
    console.log("currentCenter:", currentCenter);

    const source = subset || DATA;

    if (!source || source.length === 0) {
      window._renderInProgress = false;
      console.groupEnd();
      return;
    }

    if (network) {
      network.destroy();
      network = null;
    }

    const nodes = [];
    const edges = [];
    const seenEdges = new Set();

    let centerNode = null;

    // 1️⃣ explicitní centrum (podsítě)
    if (forcedMainId) {
      centerNode = source.find(n => n.id === forcedMainId);
    }

    // 2️⃣ návrat z historie
    if (!centerNode && currentCenter) {
      centerNode = source.find(n => n.id === currentCenter);
    }

    // 3️⃣ pouze pro hlavní vesmír
    if (!centerNode) {
      centerNode = source.find(n => !n.parent) || source[0];
    }
    const centerId = centerNode.id;
    console.log("➡️ vybrané centrum:", centerId);

    /* === UZLY === */

    source.forEach(node => {
      const isSun = node.id === centerId;
      const isRootSun = isSun && !isSubUniverse;

      const baseColor =
        typeof node.color === "string"
          ? node.color
          : node.color?.background || "#1e293b";

      const NODE_STYLE = getNodeStyle(window.CURRENT_MODEL || 'longevity');
      let style;
      if (isSun) {
        style = isRootSun ? NODE_STYLE.sun : NODE_STYLE.subSun;
      } else {
        style = NODE_STYLE.planet;
      }

      const visNode = {
        id: node.id,
        label: node.label,
        shape: "dot",
        size: style.size,
        font: {
          color: "#fff",
          size: style.font + 6,
          face: "Inter, sans-serif",
          strokeWidth: 4,
          strokeColor: "rgba(0,0,0,0.9)"
        },
        color: {
          background: baseColor,
          border: baseColor,
          highlight: {
            background: lighten(baseColor, 0.14),
            border: baseColor
          }
        },
        borderWidth: 3,
        borderWidthSelected: 3,
        shadow: true,
        fixed: true,
        chosen: {
          node: (values, id, selected, hovering) => {
            if (hovering || selected) {
              values.color = lighten(baseColor, 0.22);
            }
          }
        },
      };

      if (isSun) {
        visNode.x = 0;
        visNode.y = 0;
      } else {
        const index = source.findIndex(n => n.id === node.id);
        const zone = ORBIT_ZONES[index % ORBIT_ZONES.length];
        const radius = (zone[0] + zone[1]) / 2;
        const angle = (index / source.length) * Math.PI * 2;

        visNode.x = Math.cos(angle) * radius + rand(-30, 30);
        visNode.y = Math.sin(angle) * radius + rand(-30, 30);
      }

      nodes.push(visNode);
    });

    /* === HRANY (parent → child) === */

    source.forEach(n => {
      if (!n.parent) return;

      const parentExists = source.some(p => p.id === n.parent);
      if (!parentExists) return;

      const key = [n.parent, n.id].sort().join("::");
      if (seenEdges.has(key)) return;
      seenEdges.add(key);

      edges.push({
        id: key,
        from: n.parent,
        to: n.id,
        color: EDGE_STYLE.color,
        width: EDGE_STYLE.width,
        dashes: EDGE_STYLE.dashes,
        smooth: {
          enabled: true,
          type: Math.random() > 0.5 ? "curvedCW" : "curvedCCW",
          roundness: rand(0.25, 0.45)
        }
      });
    });

    /* === VIS NETWORK === */

    network = new vis.Network(
      el.network,
      {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges)
      },
      {
        physics: false,
        interaction: {
          hover: true,
          dragNodes: false
        }
      }
    );

    setTimeout(() => network.fit({ animation: true }), 300);


    /* =======================
   INTERAKCE
======================= */

    let clickTimer = null;

    network.on("click", params => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      clickTimer = setTimeout(() => {
        clickTimer = null; // ← PŘIDÁNO: reset po exekuci

        if (!params.nodes.length) {
          closePanel();
          if (isSubUniverse) {
            smoothReturn(DATA);
          }
          return;
        }

        const id = params.nodes[0];
        const node = findNodeById(DATA, id);
        if (node) showPanel(node);
      }, 220);
    });

    network.on("doubleClick", params => {
      // ✅ CLEAR timer okamžitě při double-click
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      if (!params.nodes.length) return;

      const id = params.nodes[0];
      const node = findNodeById(DATA, id);
      if (!node) return;

      openSubUniverse(DATA, node);
    });

    lastRenderedNodes = [...source];

    lastRenderedNodes = [...source];

  } finally {
    // ✅ VŽDY uvolni lock (i při chybě)
    window._renderInProgress = false;
    console.groupEnd();
  }
}

/* =======================
   PODVESMÍR
======================= */

function openSubUniverse(DATA, centerNode) {
  const children = DATA.filter(n => n.parent === centerNode.id);
  if (children.length === 0) return;

  // ✅ OPRAVA: Ulož aktuální stav do historie
  if (currentCenter) {
    universeHistory.push({
      centerId: currentCenter,
      nodes: [...lastRenderedNodes]  // ← Důležité: kopie pole
    });
  }

  currentCenter = centerNode.id;
  isSubUniverse = true;

  console.log('📥 Opening sub-universe:', centerNode.id);
  console.log('📚 History depth:', universeHistory.length);

  renderUniverse(DATA, [centerNode, ...children], centerNode.id);
}

function smoothReturn(DATA) {
  console.log('🔙 smoothReturn called');
  console.log('   currentCenter:', currentCenter);
  console.log('   history.length:', universeHistory.length);
  console.log('   history:', universeHistory.map(h => h.centerId));
  console.log('⬅️ Returning back, history depth:', universeHistory.length);

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

  // Vytáhni předchozí stav z historie
  const prev = universeHistory.pop();
  currentCenter = prev.centerId;
  isSubUniverse = universeHistory.length > 0;

  console.log('📤 Restored state:', currentCenter, '(history depth:', universeHistory.length + ')');

  renderUniverse(DATA, prev.nodes, prev.centerId);
}
