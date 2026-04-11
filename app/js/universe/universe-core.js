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

// ── 🌌 Star field + nebula (drawn once on load) ──────────────────────────────
(function initStarField() {
  const canvas = document.createElement('canvas');
  canvas.id = 'star-field';
  document.body.appendChild(canvas);

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight - 56;
    draw();
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Stars
    for (let i = 0; i < 180; i++) {
      const x  = Math.random() * canvas.width;
      const y  = Math.random() * canvas.height;
      const r  = Math.random() * 1.3;
      const op = 0.15 + Math.random() * 0.55;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${op})`;
      ctx.fill();
    }

    // Nebula blobs
    [
      { x: 0.20, y: 0.30, r: 220, c: '6,182,212',   o: 0.07 },
      { x: 0.80, y: 0.72, r: 260, c: '139,92,246',  o: 0.08 },
      { x: 0.58, y: 0.08, r: 180, c: '34,197,94',   o: 0.05 },
      { x: 0.08, y: 0.82, r: 160, c: '99,102,241',  o: 0.06 },
    ].forEach(n => {
      const nx = n.x * canvas.width;
      const ny = n.y * canvas.height;
      const g  = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r);
      g.addColorStop(0, `rgba(${n.c},${n.o})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, n.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  resize();
  window.addEventListener('resize', resize);
})();

// ── 🌌 Subtle breathing animation only (no tilt) ─────────────────────────────
(function initBreathing() {
  const net = document.getElementById('network');
  if (net) net.classList.add('breathing');
})();

// 🌌 Vykreslení hlavní nebo podsítě
export function getViewState() {
  return { centerId: currentCenter, nodes: [...lastRenderedNodes] };
}

// Update metrics in-place + force redraw — no network destroy/recreate
export function updateMetricsAndRedraw(metricsMap) {
  if (!network || !lastRenderedNodes.length) return;

  const colors = { GREEN: '#22c55e', YELLOW: '#eab308', RED: '#ef4444', GRAY: '#64748b' };
  const nodeUpdates = [];

  lastRenderedNodes.forEach(node => {
    const metric = metricsMap.get(node.id);
    if (!metric) return;
    node.current_index = metric.current_index ?? node.current_index;
    const idx = node.current_index;
    // Preserve GRAY (locked) for untouched nodes — only update if user has activity
    if (idx > 0 || node.state !== 'GRAY') {
      node.state = idx <= 40 ? 'RED' : idx <= 70 ? 'YELLOW' : 'GREEN';
    }
    const col = colors[node.state];
    nodeUpdates.push({
      id: node.id,
      color: {
        background: col,
        border: col,
        highlight: { background: lighten(col, 0.25), border: col }
      }
    });
  });

  if (nodeUpdates.length) {
    network.body.data.nodes.update(nodeUpdates);
  }
  network.redraw(); // triggers afterDrawing with updated current_index
}

export function renderUniverse(DATA, subset = null, forcedMainId = null) {

  const nodes = [];
  const edges = [];
  const seen = new Set();
  const source = subset || DATA;
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
        gravitationalConstant: -40000,  // Silnější odpuzování = uzly dál od sebe
        springLength: 320,              // Delší pružiny = více prostoru
        springConstant: 0.03,
        avoidOverlap: 1.0               // Plné zabránění překrytí klikatelné plochy
      },
      stabilization: {
        enabled: true,
        iterations: 300,                // Více iterací = lepší rozmístění
        fit: true,
        updateInterval: 10
      }
    }
  };

  // 🌌 Vykreslení nové sítě
  network = new vis.Network(el.network, { nodes: nodesDS, edges: edgesDS }, options);

  // 🌠 Depth glow halos – drawn BEFORE vis.js nodes (behind them)
  const allIds    = source.map(n => n.id);
  const colorMap  = { GREEN: '34,197,94', YELLOW: '234,179,8', RED: '239,68,68', GRAY: '100,116,139' };

  network.on("beforeDrawing", (ctx) => {
    const positions  = network.getPositions(allIds);
    const centerPos  = positions[mainId];
    if (!centerPos) return;

    source.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;

      const isMain = node.id === mainId;
      const dist   = Math.sqrt(
        Math.pow(pos.x - centerPos.x, 2) +
        Math.pow(pos.y - centerPos.y, 2)
      );

      // Closer to center = depthFactor closer to 1 (brighter, bigger halo)
      const depthFactor = isMain ? 1.0 : Math.max(0.3, 1 - dist / 480);
      const rgb         = colorMap[node.state] || '148,163,184';
      const baseR       = isMain ? 120 : 80;
      const glowR       = baseR * (0.45 + 0.55 * depthFactor);

      const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
      g.addColorStop(0,   `rgba(${rgb},${(0.22 * depthFactor).toFixed(3)})`);
      g.addColorStop(0.5, `rgba(${rgb},${(0.09 * depthFactor).toFixed(3)})`);
      g.addColorStop(1,   'rgba(0,0,0,0)');

      ctx.save();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  });

  // 🔮 Sphere shading + 🔒 lock emojis — single afterDrawing pass
  const lockedIds = source.filter(n => n.state === 'GRAY').map(n => n.id);

  // Fixed node radii matching makeNode() — avoids bbox including label text width
  const NODE_RADIUS = { main: 62, child: 46 };

  network.on("afterDrawing", (ctx) => {
    const positions = network.getPositions(allIds);

    // ── Sphere shading over each vis.js flat circle ──
    source.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;

      const isMain  = node.id === mainId;
      const radius  = isMain ? NODE_RADIUS.main : NODE_RADIUS.child;
      const isGray  = node.state === 'GRAY';

      const [r, g, b] = (colorMap[node.state] || '148,163,184').split(',').map(Number);

      // Gray nodes: subtle shading only (avoid "lead ball" look)
      const hiBoost  = isGray ? 35  : 70;
      const shBoost  = isGray ? 30  : 60;

      // Light source: small offset top-left
      const lx = pos.x - radius * 0.28;
      const ly = pos.y - radius * 0.30;

      // Sphere gradient
      const sph = ctx.createRadialGradient(lx, ly, 0, pos.x, pos.y, radius * 1.02);
      sph.addColorStop(0,    `rgb(${Math.min(255,r+hiBoost)},${Math.min(255,g+hiBoost)},${Math.min(255,b+hiBoost)})`);
      sph.addColorStop(0.45, `rgb(${r},${g},${b})`);
      sph.addColorStop(1,    `rgb(${Math.max(0,r-shBoost)},${Math.max(0,g-shBoost)},${Math.max(0,b-shBoost)})`);

      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = sph;
      ctx.fill();

      // Specular highlight — smaller, softer
      if (!isGray) {
        const sx   = pos.x - radius * 0.30;
        const sy   = pos.y - radius * 0.32;
        const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 0.30);
        spec.addColorStop(0,   'rgba(255,255,255,0.42)');
        spec.addColorStop(0.6, 'rgba(255,255,255,0.06)');
        spec.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = spec;
        ctx.fill();
      }

      // Thin rim
      ctx.strokeStyle = `rgba(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)},0.40)`;
      ctx.lineWidth   = isMain ? 2 : 1.5;
      ctx.stroke();

      ctx.restore();
    });

    // ── Progress potentiometer under each node ──
    source.forEach(node => {
      const pos = positions[node.id];
      if (!pos || node.state === 'GRAY') return;

      const isMain = node.id === mainId;
      const radius = isMain ? NODE_RADIUS.main : NODE_RADIUS.child;
      const idx    = node.current_index ?? 0;

      // Full 0–100 progress
      const progress = Math.max(0, Math.min(1, idx / 100));

      const isMob = window.innerWidth < 768;
      const fontSize = isMain ? (isMob ? 34 : 28) : (isMob ? 26 : 22);
      const labelBottom = pos.y + radius + 14 + fontSize * 1.3;
      const barY = labelBottom + 6;

      // Vertical segments (rotated 90°) — like an equalizer
      const numSegs = 10;
      const segW    = 7;
      const segH    = isMain ? 18 : 13;
      const gap     = 2;
      const totalW  = numSegs * segW + (numSegs - 1) * gap;
      const segBarX = pos.x - totalW / 2;
      const cr2     = 1;

      ctx.save();
      ctx.lineWidth = 0.5;
      for (let i = 0; i < numSegs; i++) {
        const segX   = segBarX + i * (segW + gap);
        const filled = (i + 1) * 10 <= idx;
        ctx.beginPath();
        ctx.roundRect(segX, barY, segW, segH, cr2);
        ctx.fillStyle = filled ? 'rgba(148,163,184,0.42)' : 'rgba(148,163,184,0.10)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.18)';
        ctx.stroke();
      }
      ctx.restore();
    });

    // ── Lock emojis on GRAY nodes — recomputed each frame ──
    const currentLocked = source.filter(n => n.state === 'GRAY').map(n => n.id);
    if (currentLocked.length) {
      const lockPos = network.getPositions(currentLocked);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '20px serif';
      currentLocked.forEach(id => {
        const pos = lockPos[id];
        if (pos) ctx.fillText('🔒', pos.x, pos.y);
      });
      ctx.restore();
    }
  });

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
        window.closeHudOverlay?.();
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
  const isMobile = window.innerWidth < 768;
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

  const isLocked = it.state === 'GRAY';

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
    size: isMain ? 62 : 46,
    font: {
      color: "#fff",
      size: isMain ? (isMobile ? 34 : 28) : (isMobile ? 26 : 22),
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