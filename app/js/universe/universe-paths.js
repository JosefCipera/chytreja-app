// -------------------------------------------------------------
// UNIVERSE PATH RESOLVER
// -------------------------------------------------------------

const DATA_BASE = "../data/universes";

/**
 * Přeloží URL z JSONu na správnou URL pro prohlížeč
 * - absolutní URL (http, https) nechá být
 * - relativní URL přeloží v rámci universe
 */
export function resolveUniverseUrl(url, universeId) {
  if (!url) return null;

  // ✅ absolutní URL (YouTube, externí odkazy)
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (!universeId) {
    console.warn("⚠️ resolveUniverseUrl: chybí universeId");
    return url;
  }

  // odstraní úvodní ../ nebo ./
  const cleanPath = url.replace(/^(\.\.\/|\.\/)/, "");

  return `${DATA_BASE}/${universeId}/${cleanPath}`;
}
