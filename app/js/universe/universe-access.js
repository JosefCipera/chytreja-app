// === UNIVERSE-ACCESS.JS ===
// ✔ Vrstva přístupů + Viewer dokumentů (MD/PDF)

// ==========================
// 1) SYSTEM PŘÍSTUPŮ
// ==========================

export function updateUniverseAccess(role = "guest") {
  console.log("🔐 updateUniverseAccess spuštěno pro roli:", role);

  const network = window.network;
  const data = window.MAIN_UNIVERSE_DATA;

  if (!network || !data) {
    console.warn("⚠️ Network nebo data nejsou k dispozici");
    return;
  }

  const nodesDS = network.body.data.nodes;
  const allNodes = nodesDS.get();

  // 🎯 Definice přístupů
  const accessLevels = {
    guest: ["dlouhovekost", "zdravi"], // minimální viditelnost
    pro: data.map(n => n.id) // všechno
  };

  const allowed = new Set(accessLevels[role] || []);

  allNodes.forEach(node => {
    const baseColor = node.color?.background || node.color || "#3b82f6";
    const muted = "#1e293b";

    const isAllowed = allowed.has(node.id);

    nodesDS.update({
      id: node.id,
      color: isAllowed
        ? { background: baseColor, border: baseColor }
        : { background: muted, border: "#475569" },
      opacity: isAllowed ? 1 : 0.4,
      font: { color: isAllowed ? "#ffffff" : "#94a3b8" }
    });
  });

  console.log(
    `✅ Aplikován přístup pro '${role}' — odemčeno: ${allowed.size} uzlů`
  );
}

// Automatické použití po vykreslení vesmíru
document.addEventListener("universeRendered", () => {
  console.log("🎯 universeRendered → aktivuji access filtr (guest)");
  updateUniverseAccess("guest");
});


// === Markdown → HTML minimal renderer ===
function mdToHtml(md) {
  // Základní převody – stačí pro doksy
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')

    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')

    .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*)\*/gim, '<i>$1</i>')

    .replace(/`([^`]+)`/gim, '<code>$1</code>')

    .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>')

    .replace(/^\s*[-+*] (.*)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>')

    .replace(/\n$/gim, '<br>');
}


// === 📄 Otevření PDF ===
export function openPdfViewer(url) {
  const overlay = document.getElementById("docOverlay");
  const frame = document.getElementById("docFrame");

  if (!overlay || !frame) return;

  frame.src = url; // PDF se zobrazí přímo
  overlay.classList.add("visible");
}


// === 📝 Otevření Markdownu s konverzí → HTML ===
export async function openMdViewer(url) {
  const overlay = document.getElementById("docOverlay");
  const frame = document.getElementById("docFrame");

  if (!overlay || !frame) return;

  let mdUrl = url;
  if (mdUrl.startsWith("../public/")) {
    mdUrl = mdUrl.replace("../public/", "./");
  }

  try {
    console.log("📝 Načítám MD:", mdUrl);

    const response = await fetch(mdUrl);
    const text = await response.text();

    const html = `
<html>
<head>
  <style>
    body {
      font-family: Inter, sans-serif;
      padding: 20px;
      background: #0b1220;
      color: #cbd5e1;
      line-height: 1.6;
    }
    h1, h2, h3 {
      color: #7aa7e9;
    }
    b, strong {
      color: #d8dee9;       /* 🆕 jemné bold */
      font-weight: 600;
    }
    code {
      background: #1e293b;
      padding: 3px 6px;
      border-radius: 4px;
    }
    img {
      max-width: 100%;
      border-radius: 8px;
      margin: 10px 0;
    }
    a { color: #7fb0ff; }
  </style>
</head>
<body>${mdToHtml(text)}</body>
</html>
`;

    // ✨ vložím HTML přímo do iframe
    frame.srcdoc = html;
    overlay.classList.add("visible");

  } catch (err) {
    console.error("❌ Chyba při načítání Markdownu:", err);
  }
}


// === ❌ Zavření overlay ===
document.getElementById("closeDoc")?.addEventListener("click", () => {
  document.getElementById("docOverlay")?.classList.remove("visible");
  document.getElementById("docFrame").src = "";
});

