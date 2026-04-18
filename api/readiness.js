// POST /api/readiness — save today's readiness check-in
// GET  /api/readiness?userId=... — check if today's readiness exists
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method === 'POST') return handlePost(req, res);
  if (req.method === 'GET')  return handleGet(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handlePost(req, res) {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const { userId, energie, spanek_hod, hrv } = req.body || {};
    if (!userId || energie == null || spanek_hod == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const today = new Date().toISOString().split('T')[0];

    const { error } = await sb
      .from('user_readiness')
      .upsert({
        user_id:    userId,
        date:       today,
        energie:    Number(energie),
        spanek_hod: Number(spanek_hod),
        hrv:        hrv != null ? Number(hrv) : null,
        source:     'manual',
      }, { onConflict: 'user_id,date' });

    if (error) {
      console.error('[readiness] insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true, date: today });
  } catch (e) {
    console.error('[readiness] crash:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

async function handleGet(req, res) {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const today = new Date().toISOString().split('T')[0];

    const { data } = await sb
      .from('user_readiness')
      .select('energie, spanek_hod, hrv, source')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    return res.json({ exists: !!data, data: data || null });
  } catch (e) {
    console.error('[readiness] GET crash:', e.message);
    return res.json({ exists: false, data: null });
  }
}
