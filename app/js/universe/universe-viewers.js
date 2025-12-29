// =============================================================
// universe-viewers.js
// -------------------------------------------------------------
// Jednotný viewer pro MD / PDF / IMAGE / AUDIO / VIDEO
// Připravený pro data/universes/*
// =============================================================

import { marked } from "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js";

// -------------------------------------------------------------
// Markdown → HTML
// -------------------------------------------------------------
export function convertMarkdownToHtml(md) {
  return marked.parse(md);
}

// -------------------------------------------------------------
// Open viewer (nový svět)
// -------------------------------------------------------------
export function openViewer(url, type = null) {
  if (!url) return;

  // === automatická detekce typu ===
  if (!type) {
    if (url.endsWith(".md")) type = "md";
    else if (url.endsWith(".pdf")) type = "pdf";
    else if (url.match(/\.(png|jpg|jpeg|gif)$/)) type = "image";
    else if (url.endsWith(".mp3")) type = "audio";
    else if (url.startsWith("http")) type = "video";
    else type = "other";
  }

  const params = new URLSearchParams({
    type,
    url
  });

  // viewer.html je vedle index.html
  const target = `./viewer.html?${params.toString()}`;

  window.open(target, "_blank", "noopener");
}
