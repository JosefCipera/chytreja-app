const CACHE_NAME = 'chytre-ja-v2';

const ASSETS = [
  '/',
  '/manifest.webmanifest',
  // CSS
  '/app/css/universe-core.css',
  '/app/css/universe-header.css',
  '/app/css/viewer.css',
  // JS – core
  '/app/js/universe/splash.js',
  '/app/js/universe/supabaseClient.js',
  '/app/js/universe/universe-core.js',
  '/app/js/universe/universe-init.js',
  '/app/js/universe/universe-panel.js',
  '/app/js/universe/universe-ui.js',
  '/app/js/universe/universe-voice.js',
  '/app/js/universe/universe-viewers.js',
  '/app/js/universe/universe-access.js',
  '/app/js/universe/onboarding.js',
  '/app/js/universe/ai-assistant.js',
  // Ikony
  '/app/assets/images/logo-192.png',
  '/app/assets/images/logo-512.png',
];

// Instalace – uloží statické soubory do cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Aktivace – smaže staré cache verze
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch – strategie podle typu requestu
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API volání: vždy ze sítě, nikdy z cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Supabase, Firebase a CDN: vždy ze sítě
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('firebaseapp.com') ||
      url.hostname.includes('openai.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Statické soubory: Stale-While-Revalidate
  // → okamžitě z cache, na pozadí aktualizuje pro příští návštěvu
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => null);
      return cached || network;
    })
  );
});
