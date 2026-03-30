const CACHE_NAME = 'chytre-ja-v8';

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

// Aktivace – smaže staré cache verze + oznámí klientům aby se reload
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

// Notifikace – klik otevře nebo fokusuje apku
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/app/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Pokud je apka otevřená → jen ji fokusuj
        const existing = clientList.find(c => c.url.includes('/app/'));
        if (existing) return existing.focus();
        // Jinak otevři nové okno
        return self.clients.openWindow(target);
      })
  );
});

// Push notifikace (Web Push API) – zobrazí notifikaci
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Chytré já';
  const options = {
    body: data.body || 'Máš novou zprávu od CHJ.',
    icon: '/app/assets/images/logo-192.png',
    badge: '/app/assets/images/logo-192.png',
    data: { url: data.url || '/app/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
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

  // Všechny /app/ soubory: network-first, cache jen jako offline fallback
  // Tím se eliminuje stale JS (inter-module importy bez version querystringu)
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok) {
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
