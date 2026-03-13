// === NOTIFICATIONS.JS ===
// CHJ notifikace – request permission + show via SW
// ─────────────────────────────────────────────────
// Jak to funguje:
//   1. requestCHJPermission()   → poprosí uživatele o souhlas
//   2. showCHJNotification()    → zobrazí notifikaci přes Service Worker
//   3. SW notificationclick     → otevře/fokusuje apku (viz service-worker.js)
//
// Pro "closed app" notifikace (Web Push):
//   → potřeba VAPID klíče + backend /api/notify (viz níže)

const ICON = '/app/assets/images/logo-192.png';

// ─── 1. Požádat o oprávnění ───────────────────────────────────────
export async function requestCHJPermission() {
  if (!('Notification' in window)) {
    console.warn('🔔 Notifikace nejsou podporovány');
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';

  const result = await Notification.requestPermission();
  console.log('🔔 Notification permission:', result);
  return result;
}

// ─── 2. Zobrazit notifikaci přes Service Worker ──────────────────
export async function showCHJNotification(title, body, url = '/app/') {
  const perm = await requestCHJPermission();
  if (perm !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    icon: ICON,
    badge: ICON,
    data: { url },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  });
  return true;
}

// ─── 3. Zkratky pro časté typy notifikací ────────────────────────
export function notifyBottleneck(nodeLabel) {
  return showCHJNotification(
    'Chytré já',
    `${nodeLabel} tě brzdí nejvíc. Podívej se co dělat.`,
    '/app/'
  );
}

export function notifyReminder(text = 'Jak se máš dnes?') {
  return showCHJNotification('Chytré já', text, '/app/');
}

// ─── 4. Test notifikace (pro ladění) ─────────────────────────────
export async function testNotification() {
  const ok = await showCHJNotification(
    '🧠 Chytré já',
    'Testovací notifikace funguje. Klik otevře apku.',
    '/app/'
  );
  console.log('🔔 Test notification sent:', ok);
  return ok;
}

// ─── 5. Web Push subscription (pro notifikace i po zavření apky) ─
// Vyžaduje VAPID_PUBLIC_KEY v prostředí (zatím není implementováno)
export async function subscribeToPush() {
  const VAPID_PUBLIC_KEY = window.CHJ_VAPID_PUBLIC_KEY || null;
  if (!VAPID_PUBLIC_KEY) {
    console.info('🔔 Web Push: VAPID_PUBLIC_KEY není nastaven, přeskočeno');
    return null;
  }

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Uložit subscription na server
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'subscribe', subscription: sub }),
  });

  console.log('🔔 Web Push subscribed');
  return sub;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
