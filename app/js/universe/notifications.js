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

// ─── 6. In-app reminder on app open ────────────────────────────
// Checks mission status + streak and shows a toast banner (not OS notification).
// Called once on app init, after short delay.

const REMINDER_TEXTS = {
  noMission:    streak => streak > 0
    ? `🔥 Máš ${streak} ${streak === 1 ? 'den' : streak < 5 ? 'dny' : 'dní'} v řadě. Dnešní mise čeká!`
    : '🎯 Dnešní mise čeká. Jeden krok stačí.',
  streakRisk:   streak => `🔥 ${streak} dní v řadě! Nepřeruš to — splň dnešní misi.`,
  allDone:      '✅ Dnešní mise splněna. Jsi ve hře.',
  welcome:      'Ahoj. Otevři uzel a splň první misi.',
};

/**
 * Check today's mission status and show in-app toast.
 * @param {string} userId
 */
export async function checkAndRemind(userId) {
  if (!userId || userId === 'demo-user-123') return;
  if (!window.supabaseClient) return;

  try {
    const sb = window.supabaseClient;
    const today = new Date().toISOString().split('T')[0];

    // 1. Check if any mission done today
    const { data: todayMissions } = await sb
      .from('mission_log')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .limit(1);

    const donToday = todayMissions?.length > 0;

    // 2. Get streak (consecutive days before today)
    const { data: recentDays } = await sb
      .from('mission_log')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30);

    const streak = _calcStreak(recentDays?.map(r => r.date) || [], today);

    // 3. Decide message
    let message;
    if (donToday) {
      message = REMINDER_TEXTS.allDone;
    } else if (streak >= 3) {
      message = REMINDER_TEXTS.streakRisk(streak);
    } else {
      message = REMINDER_TEXTS.noMission(streak);
    }

    // 4. Show toast
    _showToast(message, donToday ? 'green' : streak >= 3 ? 'amber' : 'blue');

  } catch (e) {
    console.warn('🔔 Reminder check failed:', e.message);
  }
}

/** Calculate consecutive days streak ending yesterday (or today if done). */
function _calcStreak(dates, today) {
  if (!dates.length) return 0;
  const unique = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let expected = new Date(today);

  // If today is done, count from today; otherwise from yesterday
  if (unique[0] === today) {
    streak = 1;
    expected.setDate(expected.getDate() - 1);
    for (let i = 1; i < unique.length; i++) {
      const expectedStr = expected.toISOString().split('T')[0];
      if (unique[i] === expectedStr) {
        streak++;
        expected.setDate(expected.getDate() - 1);
      } else break;
    }
  } else {
    expected.setDate(expected.getDate() - 1);
    for (const d of unique) {
      const expectedStr = expected.toISOString().split('T')[0];
      if (d === expectedStr) {
        streak++;
        expected.setDate(expected.getDate() - 1);
      } else break;
    }
  }
  return streak;
}

/** Show a floating toast banner at the top of the screen. */
function _showToast(message, color = 'blue') {
  // Remove existing toast
  document.getElementById('chj-toast')?.remove();

  const colors = {
    blue:  { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#93c5fd' },
    amber: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', text: '#fde68a' },
    green: { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  text: '#86efac' },
  };
  const c = colors[color] || colors.blue;

  const toast = document.createElement('div');
  toast.id = 'chj-toast';
  toast.style.cssText = `
    position:fixed; top:70px; left:50%; transform:translateX(-50%) translateY(-20px);
    z-index:9999; padding:12px 20px; border-radius:12px;
    background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
    font-size:14px; font-weight:600; text-align:center;
    backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    box-shadow:0 4px 20px rgba(0,0,0,0.3);
    opacity:0; transition:opacity 0.4s ease, transform 0.4s ease;
    max-width:90vw; pointer-events:auto; cursor:pointer;
  `;
  toast.textContent = message;
  toast.onclick = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => toast.remove(), 400);
  };

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  // Auto-dismiss after 6 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => toast.remove(), 400);
    }
  }, 6000);
}
