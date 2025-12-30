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
export function openViewer(file, type = null) {
  if (!type) {
    if (file.endsWith(".md")) type = "md";
    else if (file.endsWith(".pdf")) type = "pdf";
    else if (file.match(/\.(png|jpg|jpeg|gif)$/)) type = "image";
    else if (file.endsWith(".mp3")) type = "audio";
    else type = "other";
  }

  const url = `./viewer.html?type=${type}&file=${encodeURIComponent(file)}`;

  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  if (isMobile) {
    window.location.href = url;
  } else {
    window.open(url, "_blank");
  }
}
