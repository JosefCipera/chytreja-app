const CACHE_NAME = 'chytre-ja-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app/index.html',
  '/app/js/universe/splash.js',
  '/manifest.webmanifest',
  '/app/assets/images/logo-512.png',
  // Přidej sem další klíčové soubory (CSS, hlavní JS)
];

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Okamžitě převezme kontrolu nad všemi okny
});

// Instalace - uloží základní soubory do telefonu
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Strategie: Stale-While-Revalidate
// Aplikace se načte z paměti (bleskově), ale na pozadí zkontroluje aktualizace
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});