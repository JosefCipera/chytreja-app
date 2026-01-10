// === UNIVERSE-CORE.JS ===
// Stabilní verze s podporou podsítí, panelu, hlasu a PDF/MD viewerů

import { showPanel, closePanel } from "./universe-panel.js";

const el = {
  network: document.getElementById("network"),
  side: document.getElementById("sidePanel"),
  title: document.getElementById("nodeTitle"),
  def: document.getElementById("nodeDef"),
  docs: document.getElementById("nodeDocs"),
  media: document.getElementById("nodeMedia"),
  tasks: document.getElementById("nodeTasks"),
  //close: document.getElementById("closePanel")
};

let network;
let isSubUniverse = false;
let currentCenter = null;

// === Historie podsítí a poslední zobrazené uzly ===
const universeHistory = [];
let lastRenderedNodes = [];

// 🌌 Vykreslení hlavní nebo podsítě
export function renderUniverse(DATA, subset = null) {
  console.log("🔧 renderUniverse()");
  const nodes = [];
  const edges = [];
  const seen = new Set();
  const source = subset || DATA;

  // 🧼 znič předchozí síť, ať se korektně překreslí
  if (network && typeof network.destroy === "function") {
    network.destroy();
  }

  // 🧠 dynamický hlavní uzel (podpora pro dlouhověkost, TOC, BMC)
  const preferredRoot =
    source.find(n => n.id === "dlouhovekost") ||
    source.find(n => n.id === "toc") ||
    source.find(n => n.id === "bmc") ||
    source[0];
  const mainId = preferredRoot?.id;
  const hasChildrenMap = new Map();

  DATA.forEach(n => {
    if (n.parent) {
      hasChildrenMap.set(n.parent, true);
    }
  });

  // 🔹 Vytvoř uzly + hrany (parent → child)
  source.forEach(it => {
    const isMain = it.id === mainId;
    nodes.push(
      makeNode(it, isMain, hasChildrenMap.has(it.id), it.id === currentCenter)
    );

    if (it.parent) {
      const parentInSource = source.find(n => n.id === it.parent);
      if (parentInSource) {
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
    nodes: {
      shadow: true,
      font: {
        multi: "html"   // ⬅️ TOTO TAM CHYBÍ
      }
    },
    edges: {
      smooth: { enabled: true, type: "dynamic", roundness: 0.55 },
      dashes: true,
      width: 1,
      color: { color: "#9ca3af" }
    },
    physics: {
      barnesHut: {
        gravitationalConstant: -20000,
        springLength: 200,
        springConstant: 0.04
      }
    },
    interaction: { hover: false }
  };

  // 🌌 Vykreslení nové sítě
  network = new vis.Network(el.network, { nodes: nodesDS, edges: edgesDS }, options);

  // ✨ Vycentrování s animací
  setTimeout(() => network.fit({ animation: true }), 300);

  // 🖱️ Klik – otevře panel nebo návrat

  let clickTimer = null;
  +
    // 🖱️ SINGLE CLICK → PANEL / návrat
    network.on("click", params => {
      if (clickTimer) clearTimeout(clickTimer);

      clickTimer = setTimeout(() => {
        // ⬅️ KLIK MIMO UZEL
        if (!params.nodes.length) {

          // 1️⃣ zavřít panel
          closePanel();

          // 2️⃣ návrat z podsítě (pokud jsme v ní)
          if (isSubUniverse) {
            smoothReturnToUniverse(DATA);
            isSubUniverse = false;
            currentCenter = null;
          }

          return;
        }

        // ⬅️ KLIK NA UZEL
        const id = params.nodes[0];
        const node = findNodeById(DATA, id);
        if (!node) return;

        showPanel(node);
      }, 250);
    });

  // 🖱️🖱️ DOUBLE CLICK → DRILL-DOWN
  network.on("doubleClick", params => {
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

  // === Pomocné funkce ===
  function hasChildren(it, DATA) {
    return DATA.some(n => n.parent === it.id);
  }

  function makeNode(it, isMain, isExpanded) {
    const hasChildren = window.MAIN_UNIVERSE_DATA.some(n => n.parent === it.id);
    const arrow = (hasChildren && !isExpanded) ? " ⤵" : "";

    // TVOJE POMĚRY (přepočtené na pixely pro obrazovku)
    // 28mm -> ~48px (Sun)
    // 25mm -> ~40px (Pillar)
    // 20mm -> ~30px (Discipline)

    let finalSize = 30;
    let finalFont = 14;

    switch (it.type) {
      case 'sun':
        finalSize = 48; // Největší - tvoje 28mm
        finalFont = 20;
        break;
      case 'pillar':
        finalSize = 40; // Střední - tvoje 25mm
        finalFont = 16;
        break;
      case 'discipline':
        finalSize = 30; // Nejmenší - tvoje 20mm
        finalFont = 16;
        break;
      default:
        // Záchranná brzda pro podsítě
        if (isMain || isExpanded) {
          finalSize = 45;
          finalFont = 17;
        }
    }

    const baseColor = (typeof it.color === "string" ? it.color : it.color?.background) || "#1e293b";

    return {
      id: it.id,
      label: it.label + arrow,
      shape: "dot",
      size: finalSize,
      color: {
        background: baseColor,
        border: baseColor,
        highlight: { background: lighten(baseColor, 0.25), border: baseColor }
      },
      font: {
        color: "#fff",
        size: finalFont,
        face: "Inter, sans-serif"
      },
      borderWidth: 2,
      shadow: true
    };
  }

  function makeEdge(from, to) {
    const direction = Math.random() > 0.5 ? "curvedCW" : "curvedCCW";
    const roundness = 0.45 + Math.random() * 0.2;
    return {
      id: [from, to].sort().join("::"),
      from,
      to,
      color: { color: "#9ca3af" },
      dashes: true,
      width: 1,
      smooth: { enabled: true, type: direction, roundness }
    };
  }

  function findNodeById(DATA, id) {
    for (const n of DATA) {
      if (n.id === id) return n;
      if (n.subnodes) {
        const sub = n.subnodes.find(s => s.id === id);
        if (sub) return sub;
      }
    }
    return null;
  }

  // === Podsíť ===
  function openSubUniverse(DATA, centerNode) {
    let subNodes = [];
    const subEdges = [];
    const seen = new Set();

    // 🔹 Ulož aktuální stav, než přejdeme do podsítě
    if (currentCenter) {
      universeHistory.push({
        centerId: currentCenter,
        subNodes: lastRenderedNodes || []
      });
    }

    if (centerNode.subnodes && centerNode.subnodes.length > 0) {
      subNodes = [centerNode, ...centerNode.subnodes];

      centerNode.subnodes.forEach(sub => {
        const keyParent = [centerNode.id, sub.id].sort().join("::");
        if (!seen.has(keyParent)) {
          seen.add(keyParent);
          subEdges.push(makeEdge(centerNode.id, sub.id));
        }

        (sub.related || []).forEach(r => {
          const keySub = [sub.id, r].sort().join("::");
          if (!seen.has(keySub)) {
            seen.add(keySub);
            subEdges.push(makeEdge(sub.id, r));
          }
        });
      });
    } else {
      // 🔹 děti podle parent (správný drill-down)
      const children = DATA.filter(n => n.parent === centerNode.id);

      if (children.length === 0) return;

      subNodes = [centerNode, ...children];

      children.forEach(child => {
        const key = [centerNode.id, child.id].sort().join("::");
        if (!seen.has(key)) {
          seen.add(key);
          subEdges.push(makeEdge(centerNode.id, child.id));
        }
      });
    }

    playWhoosh();
    el.network.classList.add("fade-blur-out");

    setTimeout(() => {
      renderUniverse(DATA, subNodes);
      el.network.classList.remove("fade-blur-out");
      el.network.classList.add("fade-blur-in");
      isSubUniverse = true;
      currentCenter = centerNode.id;

      const nodes = network.body.data.nodes;
      const center = nodes.get(centerNode.id);
      if (center) {
        center.size = 38; // 💫 větší uzel
        center.font = { color: "#fff", size: 19 };
        nodes.update(center);
      }

      // aiSpeak(`Vstupuji do podvesmíru ${centerNode.label}.`);
      setTimeout(() => el.network.classList.remove("fade-blur-in"), 900);
    }, 900);

    // 🪐 Uložit poslední zobrazené uzly
    lastRenderedNodes = [...subNodes];
  }

  function smoothReturnToUniverse(DATA) {
    playWhoosh();
    el.network.classList.add("fade-blur-out");

    setTimeout(() => {
      // 🧭 Návrat o jednu úroveň zpět, pokud existuje historie
      if (universeHistory.length > 0) {
        const prevState = universeHistory.pop();

        if (prevState && prevState.subNodes && prevState.subNodes.length > 0) {
          // 🔹 Vracíme se o jednu úroveň výš
          renderUniverse(DATA, prevState.subNodes);
          currentCenter = prevState.centerId;
          isSubUniverse = true;
        } else {
          // 🔹 Vracíme se až na úplný začátek (hlavní uzel + jeho přímé potomky)
          if (window.MAIN_UNIVERSE_DATA) {
            const mainNode = window.MAIN_UNIVERSE_DATA.find(n => !n.parent);
            if (mainNode) {
              const firstLevel = window.MAIN_UNIVERSE_DATA.filter(
                n => n.id === mainNode.id || n.parent === mainNode.id
              );
              renderUniverse(window.MAIN_UNIVERSE_DATA, firstLevel);
            } else {
              renderUniverse(window.MAIN_UNIVERSE_DATA);
            }
          }
          currentCenter = null;
          isSubUniverse = false;
          universeHistory.length = 0; // reset historie
        }

      } else {
        // 🔹 Není historie → rovnou hlavní úroveň (stejná logika jako výše)
        if (window.MAIN_UNIVERSE_DATA) {
          const mainNode = window.MAIN_UNIVERSE_DATA.find(n => !n.parent);
          if (mainNode) {
            const firstLevel = window.MAIN_UNIVERSE_DATA.filter(
              n => n.id === mainNode.id || n.parent === mainNode.id
            );
            renderUniverse(window.MAIN_UNIVERSE_DATA, firstLevel);
          } else {
            renderUniverse(window.MAIN_UNIVERSE_DATA);
          }
        }

        currentCenter = null;
        isSubUniverse = false;
      }

      // ✨ Animace návratu
      el.network.classList.remove("fade-blur-out");
      el.network.classList.add("fade-blur-in");
      setTimeout(() => el.network.classList.remove("fade-blur-in"), 900);
    }, 900);
  }

  //function closePanel() {
  //  el.side.classList.remove("visible");
  //}

  function playWhoosh() {
    const audio = new Audio("../assets/media/whoosh.mp3");
    audio.volume = 0.25;
    audio.play().catch(() => { });
  }
  /*
  // === PANEL ===
  function showPanel(node) {
    console.log("🟢 showPanel běží pro uzel:", node.id);
  
    const panel = document.getElementById("sidePanel");
    const title = document.getElementById("nodeTitle");
    const def = document.getElementById("nodeDef");
    const docs = document.getElementById("nodeDocs");
    const media = document.getElementById("nodeMedia");
    const tasks = document.getElementById("nodeTasks");
  
    if (!panel) return;
  
    // 🧹 Vyčištění sekcí na začátku (včetně definice)
    [def, docs, media, tasks].forEach(e => { if (e) e.innerHTML = ""; });
  
    // 🪐 Titulek
    if (node.icon) {
      title.innerHTML = `
        <i class="${node.icon}" 
           style="color:${node.color || '#93C5FD'};
                  filter:drop-shadow(0 0 4px ${(node.color || '#93C5FD')}55);
                  font-size:1.25em;margin-right:8px;">
        </i>${node.label || "—"}
      `;
    } else {
      title.textContent = node.label || "—";
    }
  
    // 📘 Definice
    def.textContent = node.definition || "";
  
    // === 🎬 Média (video/audio) ===
    if (node.media && node.media.length > 0) {
      node.media.forEach(m => {
        const li = document.createElement("li");
        li.style.marginBottom = "32px";
        li.style.listStyle = "none";
  
        const titleHTML = m.title
          ? `<h4 style="margin:10px 0 10px;color:#f1f5f9;">${m.title}</h4>`
          : "";
        const summaryHTML = m.summary
          ? `<p style="margin:0 0 12px;font-size:0.95em;color:#cbd5e1;">${m.summary}</p>`
          : "";
  
        if (m.type === "video") {
          if (m.url.endsWith(".mp4")) {
            li.innerHTML = `
              ${titleHTML}${summaryHTML}
              <video controls style="width:100%;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.3);margin-top:8px;">
                <source src="${m.url}" type="video/mp4">
                Váš prohlížeč nepodporuje přehrávání videa.
              </video>`;
          } else {
            li.innerHTML = `
              ${titleHTML}${summaryHTML}
              <iframe width="100%" height="220"
                      src="${m.url}"
                      frameborder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowfullscreen
                      style="border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.3);margin-top:8px;">
              </iframe>`;
          }
        } else if (m.type === "audio") {
          li.innerHTML = `
            ${titleHTML}${summaryHTML}
            <audio controls style="width:100%;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.3);margin-top:8px;">
              <source src="${m.url}" type="audio/mpeg">
              Váš prohlížeč nepodporuje přehrávání audia.
            </audio>`;
        }
  
        media.appendChild(li);
      });
    }
  
    // === 📘 Dokumenty ===
    if (node.docs && node.docs.length > 0) {
      console.group(`📘 Dokumenty pro uzel: ${node.label}`);
      docs.innerHTML = ""; // jistota, že je sekce čistá
  
      node.docs.forEach(d => {
        const li = document.createElement("li");
        li.style.marginBottom = "14px";
        li.style.listStyle = "none";
  
        const isMarkdown = d.url.toLowerCase().endsWith(".md");
        const icon = isMarkdown ? "📝" : "📄";
  
        li.innerHTML = `
        <a href="#" class="doc-link" data-url="${d.url}" data-md="${isMarkdown}" 
           style="color:#3b82f6;text-decoration:none;font-weight:500;">
          ${icon} ${d.title}
        </a><br>
        <small style="color:#94a3b8;font-size:0.9em;">${d.summary || ""}</small>`;
  
        // 🧠 Log pro kontrolu
        console.log(`🔗 ${isMarkdown ? "MD" : "PDF"} dokument:`, d.url);
  
        // 🖱️ Kliknutí otevře příslušný viewer
        li.querySelector("a").onclick = e => {
          e.preventDefault();
          if (isMarkdown) {
            console.log("📝 Otevírám MD viewer:", d.url);
            openMdViewer(d.url);
          } else {
            console.log("📄 Otevírám PDF viewer:", d.url);
            openPdfViewer(d.url);
          }
        };
  
        docs.appendChild(li);
      });
  
      console.groupEnd();
    } else {
      console.warn(`⚠️ Uzel "${node.label}" nemá žádné dokumenty.`);
    }
  
    // === 📘 Edukativní text pro biomarkery ===
    if (node.id === "biomarkery") {
      const interpret = document.createElement("div");
      interpret.className = "lab-info";
      interpret.innerHTML = `
        <h4 style="margin-top:12px;color:#93c5fd;">Jak interpretovat laboratorní výsledky</h4>
        <p style="font-size:0.9em;line-height:1.5;color:#cbd5e1;margin-top:6px;">
          Laboratorní hodnoty ukazují aktuální stav těla – nejsou diagnóza, ale signál.<br>
          <b>Zelená</b> značí rovnováhu, <b>oranžová</b> adaptaci, 
          a <b>červená</b> nutnost konzultace nebo změny.<br>
          Sleduj <em>trend</em> – kam se hodnota vyvíjí v čase.
        </p>
      `;
      def.insertAdjacentElement("afterend", interpret);
    }
  
    // === 📊 Zobrazení biometrických údajů s mini-grafem ===
    if (node.value !== undefined && node.unit) {
      if (!window.bioCards) window.bioCards = new Map();
  
      // kontrola duplicity
      if (window.bioCards.has(node.id)) {
        console.log("ℹ️ Bio karta už existuje:", node.id);
      } else {
        if (window.bioCards.size >= 5) {
          console.warn("⚠️ Limit bio karet (5) dosažen, přeskočeno:", node.id);
        } else {
          const container = document.createElement("div");
          container.className = "metric-card";
          container.dataset.id = node.id;
  
          // --- výpočet poměru ---
          const rangeParts = node.range ? node.range.split(/[-–]/).map(x => parseFloat(x)) : null;
          const [min, max] = rangeParts || [null, null];
          const value = parseFloat(node.value);
          let ratio = 0.5;
          if (min !== null && max !== null && !isNaN(value)) {
            ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
          }
  
          // --- vzhled podle stavu ---
          const status = node.status || "neuvedeno";
          let icon = "⚪", bg = "#334155";
          if (status.includes("v normě")) { icon = "✅"; bg = "#14532d"; }
          else if (status.includes("nad")) { icon = "⚠️"; bg = "#78350f"; }
          else if (status.includes("pod")) { icon = "🔻"; bg = "#1e3a8a"; }
  
          // --- HTML ---
          container.innerHTML = `
            <div class="metric-header" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-size:1.3em;">${icon}</span>
              <b>${node.label}</b>
            </div>
            <div><b>Hodnota:</b> ${node.value} ${node.unit}</div>
            <div><b>Rozmezí:</b> ${node.range || "—"}</div>
            <div><b>Stav:</b> <span style="color:${node.color || "#fff"}">${status}</span></div>
            <div class="metric-bar" style="background:#475569;border-radius:6px;height:10px;width:100%;overflow:hidden;margin-top:6px;position:relative;">
              <div style="position:absolute;left:0;top:0;height:100%;width:${(ratio * 100).toFixed(1)}%;background:${node.color || "#22c55e"};transition:width 0.6s ease;"></div>
            </div>
            <canvas class="trend-canvas" width="200" height="40" style="margin-top:8px;"></canvas>
          `;
  
          container.style.background = bg;
          container.style.color = "#f1f5f9";
          container.style.padding = "10px 14px";
          container.style.borderRadius = "12px";
          container.style.marginTop = "10px";
          container.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  
          // --- Mini trend graf ---
          const canvas = container.querySelector(".trend-canvas");
          if (canvas && canvas.getContext) {
            const ctx = canvas.getContext("2d");
            const values = node.history?.map(h => parseFloat(h.value)) ||
              [node.value, node.value * 0.95, node.value * 1.05, node.value];
  
            if (values.length > 0 && values.every(v => !isNaN(v))) {
              const w = canvas.width, h = canvas.height;
              const maxVal = Math.max(...values);
              const minVal = Math.min(...values);
              const span = maxVal - minVal || 1;
  
              ctx.clearRect(0, 0, w, h);
              ctx.beginPath();
              ctx.lineWidth = 2;
              ctx.strokeStyle = node.color || "#22c55e";
              values.forEach((v, i) => {
                const x = (i / (values.length - 1)) * w;
                const y = h - ((v - minVal) / span) * h;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              });
              ctx.stroke();
  
              const lastX = w - 4;
              const lastY = h - ((values.at(-1) - minVal) / span) * h;
              ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.arc(lastX, lastY, 3, 0, 2 * Math.PI);
              ctx.fill();
            } else {
              console.warn("⚠️ Trend graf: chybí/špatná data u", node.id, node.history);
            }
          }
  
          window.bioCards.set(node.id, container);
          def.insertAdjacentElement("afterend", container);
        }
      }
    }
  
    // === 🧬 Tlačítko pro otevření Mini Dashboardu ===
    const existingBtn = document.getElementById("openBioDashboard");
    if (existingBtn) existingBtn.remove();
    if (node.id === "biomarkery" || node.id === "zdravi") {
      const btn = document.createElement("button");
      btn.id = "openBioDashboard";
      btn.textContent = "🧬 Zobraz přehled biomarkerů";
      btn.style.cssText = `
        display:block;width:100%;margin-top:14px;padding:10px 14px;
        font-size:1rem;background:#3b82f6;color:#fff;border:none;
        border-radius:8px;cursor:pointer;font-weight:600;transition:background 0.3s;
      `;
      btn.onmouseenter = () => (btn.style.background = "#2563eb");
      btn.onmouseleave = () => (btn.style.background = "#3b82f6");
      btn.onclick = () => window.open("./assets/models/dlouhovekost/minidash-zdravi.html", "_blank");
      def.insertAdjacentElement("afterend", btn);
    }
  
    // === Zobraz panel ===
    panel.classList.add("visible");
  
    // === Reset helpera ===
    const helper = document.getElementById("aiHelper");
    if (helper) {
      helper.classList.remove("expanded");
      helper.classList.add("mini");
    }
  
    // Uložit aktuální uzel
    window.currentNode = node;
  }*/

  // === HLAS ===
  function aiSpeak(text) {
    if (!window.speechSynthesis) return;
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = "cs-CZ";
    msg.rate = 1.0;
    msg.pitch = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
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

  // === VIEWERY ===
  function openPdfViewer(url) {
    // PDF otevřeme přímo – prohlížeč si poradí
    console.log("📄 Otevírám PDF:", url);
    window.open(url, "_blank");
  }

  function openMdViewer(url) {
    // url už má být absolutní: /app/content/...
    const cleanUrl = url.startsWith("/")
      ? url
      : `/app/${url.replace(/^(\.\/)+/, "")}`;

    const viewerUrl =
      `/app/viewer.html?type=md&file=${encodeURIComponent(cleanUrl)}`;

    console.log("📖 Otevírám Markdown viewer:", viewerUrl);

    window.open(viewerUrl, "_blank");
  }

  function convertMarkdownToHtml(md) {
    // 🧹 Ořízni zbytečné mezery
    const cleaned = md.trim();

    // 🧠 Nahraď markdown syntaxi za HTML (včetně prvního nadpisu)
    return cleaned
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>")
      .replace(/\*(.*?)\*/gim, "<i>$1</i>")
      .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2' target='_blank'>$1</a>")
      .replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")
      .replace(/^- (.*$)/gim, "<li>$1</li>")
      .replace(/\n\s*\n/gim, "<br><br>"); // nový odstavec
  }

  function closeViewers() {
    document.querySelectorAll(".md-viewer, .pdf-viewer").forEach(v => v.remove());
  }

  // === Mini-Helper logika ===
  const miniHelper = document.getElementById("miniHelper");
  const helperChat = document.getElementById("helperChat");
  const helperPrompt = document.getElementById("helperPrompt");
  const helperExpand = document.getElementById("helperExpand");
  const helperSend = document.getElementById("helperSend");
  const helperInput = document.getElementById("helperInput");
  const helperMessages = document.getElementById("helperMessages");

  if (miniHelper) {
    const openHelper = () => {
      miniHelper.style.display = "none";
      helperChat.classList.remove("hidden");
      helperInput.focus();
    };
    if (helperExpand) helperExpand.addEventListener("click", openHelper);
    if (helperPrompt) helperPrompt.addEventListener("focus", openHelper);
  }

  if (helperSend) {
    helperSend.addEventListener("click", () => {
      const msg = (helperInput?.value || "").trim();
      if (!msg) return;
      addHelperMessage("user", msg);
      helperInput.value = "";

      // 💬 Zatím jednoduchá odpověď (mock)
      setTimeout(() => {
        addHelperMessage("ai", `Chytré Já přemýšlí o: "${msg}"`);
      }, 600);
    });
  }

  function addHelperMessage(sender, text) {
    const div = document.createElement("div");
    div.className = `msg ${sender}`;
    div.textContent = text;
    if (helperMessages) {
      helperMessages.appendChild(div);
      helperMessages.scrollTop = helperMessages.scrollHeight;
    }
  }
}