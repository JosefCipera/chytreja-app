// POST /api/mission-log  — save completed mission
// GET  /api/mission-log?userId=...  — return streak + today's completed missions
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function (req, res) {
  if (req.method === 'POST') return handlePost(req, res);
  if (req.method === 'GET')  return handleGet(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

// ── POST: save completed mission ──────────────────────────────────
async function handlePost(req, res) {
  try {
    const { userId, nodeId, missionId, actionType } = req.body || {};

    if (!userId || !missionId) {
      return res.status(400).json({ error: 'Missing userId or missionId' });
    }

    const { data, error } = await supabase
      .from('mission_log')
      .upsert({
        user_id:     userId,
        node_id:     nodeId || '',
        mission_id:  missionId,
        action_type: actionType || 'habit',
        date:        new Date().toISOString().split('T')[0],
      }, { onConflict: 'user_id,mission_id,date' })
      .select();

    if (error) {
      console.error('mission-log POST error:', error);
      return res.json({ ok: false, streak: 0, error: error.message });
    }

    const streak = await computeStreak(userId);
    return res.json({ ok: true, streak, saved: data?.[0] || null });
  } catch (e) {
    console.warn('mission-log POST crash:', e.message);
    return res.json({ ok: false, streak: 0, error: e.message });
  }
}

// ── GET: streak + today's missions ────────────────────────────────
async function handleGet(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const today = new Date().toISOString().split('T')[0];

    const [streak, todayResult] = await Promise.all([
      computeStreak(userId),
      supabase
        .from('mission_log')
        .select('mission_id, node_id, action_type')
        .eq('user_id', userId)
        .eq('date', today),
    ]);

    return res.json({
      streak,
      todayMissions: todayResult?.data || [],
    });
  } catch (e) {
    console.warn('mission-log GET error:', e.message);
    return res.json({ streak: 0, todayMissions: [] });
  }
}

// ── Streak calculation ────────────────────────────────────────────
// Count consecutive days (including today) with at least 1 mission
async function computeStreak(userId) {
  const { data, error } = await supabase
    .from('mission_log')
    .select('date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(90);

  if (error || !data || data.length === 0) return 0;

  // Unique sorted dates (newest first)
  const dates = [...new Set(data.map(d => d.date))].sort().reverse();

  let streak = 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let expected = now;

  for (const dateStr of dates) {
    const d = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.round((expected - d) / 86400000);

    if (diffDays <= 1) {
      // Same day or yesterday — streak continues
      streak++;
      expected = new Date(d);
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
