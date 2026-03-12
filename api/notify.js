// api/notify.js – CHJ notifikační endpoint
// POST /api/notify
//
// Akce:
//   { action: 'subscribe',  subscription: <PushSubscription> }         → uloží sub do DB
//   { action: 'send',       userId, title, body, url }                 → pošle push na uživatele
//   { action: 'test',       subscription: <PushSubscription> }         → pošle testovací push
//
// Web Push (VAPID) – potřeba env proměnné:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { action, subscription, userId, title, body, url } = req.body;

  // ─── Uložit Push subscription ───────────────────────────────────
  if (action === 'subscribe') {
    if (!subscription) return res.status(400).json({ error: 'Missing subscription' });

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        endpoint: subscription.endpoint,
        subscription: JSON.stringify(subscription),
        user_id: userId || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error('❌ push_subscriptions upsert:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true, message: 'Subscription saved' });
  }

  // ─── Poslat push notifikaci ─────────────────────────────────────
  if (action === 'send' || action === 'test') {
    const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_EMAIL       = process.env.VAPID_EMAIL || 'mailto:admin@iting.cz';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(501).json({
        error: 'VAPID keys not configured',
        hint: 'Run: npx web-push generate-vapid-keys and add to .env.local',
      });
    }

    // Dynamický import (web-push není nutný pro základní provoz)
    let webpush;
    try {
      webpush = (await import('web-push')).default;
      webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    } catch {
      return res.status(500).json({ error: 'web-push package not installed. Run: npm install web-push' });
    }

    // Pro test: pošli na konkrétní subscription z body
    if (action === 'test' && subscription) {
      const payload = JSON.stringify({
        title: title || '🧠 Chytré já',
        body:  body  || 'Testovací push notifikace.',
        url:   url   || '/app/',
      });
      try {
        await webpush.sendNotification(
          typeof subscription === 'string' ? JSON.parse(subscription) : subscription,
          payload
        );
        return res.json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Pro send: najdi subscription uživatele v DB
    if (action === 'send' && userId) {
      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId);

      if (error) return res.status(500).json({ error: error.message });
      if (!subs?.length) return res.status(404).json({ error: 'No subscription found for user' });

      const payload = JSON.stringify({
        title: title || '🧠 Chytré já',
        body:  body  || 'Máš novou zprávu.',
        url:   url   || '/app/',
      });

      const results = await Promise.allSettled(
        subs.map(s => webpush.sendNotification(JSON.parse(s.subscription), payload))
      );

      const sent   = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return res.json({ ok: true, sent, failed });
    }

    return res.status(400).json({ error: 'Missing userId or subscription for send/test' });
  }

  return res.status(400).json({ error: 'Unknown action. Use: subscribe | send | test' });
}
