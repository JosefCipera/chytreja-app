// universe-viewers.js

// jednoduchý markdown → HTML parser
// Načtení knihovny marked z CDN (modulový import)
// ESM verze marked
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js";

export function convertMarkdownToHtml(md) {
  return marked.parse(md);
}

/**
 * Vrací absolutní URL podle typu souboru.
 * Slouží jak pro Universe, tak pro Mediotéku.
 */
export function resolveMediaPath(path) {

  // Pokud už začíná / → necháme jak je
  if (path.startsWith("/")) return path;

  // Lokální video / audio / obrázky / pdf
  if (path.endsWith(".mp3")) return `/media/audio/${path}`;
  if (path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg"))
    return `/media/images/${path}`;
  if (path.endsWith(".pdf")) return `/media/pdf/${path}`;
  if (path.endsWith(".md")) return `/clanky/${path}`;

  // fallback
  return path;
}
// === UNIVERSE VIEWER ===
// používá stejný viewer.html jako mediotéka

export function openViewer(file, type = null) {

  // Pokud URL obsahuje příponu, detekujeme typ automaticky
  if (!type) {
    if (file.endsWith(".md")) type = "article";
    else if (file.endsWith(".pdf")) type = "pdf";
    else if (file.match(/\.(png|jpg|jpeg|gif)$/)) type = "image";
    else if (file.endsWith(".mp3")) type = "audio";
    else type = "other";
  }

  // Oprava nadbytečného "public/"
  file = file.replace(/^\/?public\//, "/");

  const target = `/public/viewer.html?type=${type}&file=${encodeURIComponent(file)}`;

  window.open(target, "_blank");
}

