// POST /api/mission-complete
// New game loop logic:
//   1 step/day = stabilize (stop decline)
//   2 steps/day = improve (+5 index)
//   0 steps = decline (-3 index per day of inactivity)
//
// Rolling 7-day window, no Monday reset.
// After improving: recalc state → recalc parents (worst child rule)
// Also logs to node_state_history for sparkline.

import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });
import { createClient } from "@supabase/supabase-js";

// ── CONFIG ───────────────────────────────────────────
const INDEX_IMPROVE = 5;   // +5 for 2 steps in a day
const INDEX_DECLINE = 3;   // -3 per inactive day (applied on next action)
const RED_MAX = 40;
const YELLOW_MAX = 70;

function indexToState(index) {
  if (index <= RED_MAX) return 'RED';
  if (index <= YELLOW_MAX) return 'YELLOW';
  return 'GREEN';
}

export default async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { userId, nodeId } = req.body || {};
    if (!userId || !nodeId) {
      return res.status(400).json({ error: 'Missing userId or nodeId' });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Count today's steps — one query for all nodes, then filter
    const { data: todayAllMissions } = await supabase
      .from('mission_log')
      .select('id, node_id')
      .eq('user_id', userId)
      .eq('date', today);

    const todayTotalCount = todayAllMissions?.length || 0;
    const todayCount = todayAllMissions?.filter(m => m.node_id === nodeId).length || 0;

    // 2. Get current node metrics
    const { data: metric } = await supabase
      .from('user_metrics')
      .select('current_index, state')
      .eq('user_id', userId)
      .eq('node_id', nodeId)
      .eq('universe', 'longevity')
      .maybeSingle();

    const oldIndex = metric?.current_index ?? 30;
    const oldState = metric?.state || indexToState(oldIndex);

    // 3. Calculate inactive days (days since last step, excluding today)
    let inactiveDays = 0;
    const { data: lastMission } = await supabase
      .from('mission_log')
      .select('date')
      .eq('user_id', userId)
      .eq('node_id', nodeId)
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(1);

    if (lastMission?.length) {
      const lastDate = new Date(lastMission[0].date);
      const todayDate = new Date(today);
      const diffMs = todayDate - lastDate;
      inactiveDays = Math.max(0, Math.floor(diffMs / 86400000) - 1); // -1 because 1 day gap is normal
    }

    // 4. Apply decline for inactive days first
    let adjustedIndex = oldIndex;
    if (inactiveDays > 0) {
      adjustedIndex = Math.max(0, oldIndex - (inactiveDays * INDEX_DECLINE));
    }

    // 5. Apply today's impact
    let newIndex = adjustedIndex;
    let impact = 'stabilized'; // default: 1 step = stabilize

    if (todayCount >= 2) {
      // 2+ steps today → improve
      newIndex = Math.min(100, adjustedIndex + INDEX_IMPROVE);
      impact = 'improved';
    }
    // todayCount === 1 → stabilize (no change beyond decline recovery)

    let newState = indexToState(newIndex);

    // 5b. If this node has children, enforce worst-child rule
    const { data: nodeChildren } = await supabase
      .from('longevity_nodes')
      .select('id')
      .eq('parent', nodeId);

    if (nodeChildren && nodeChildren.length > 0) {
      const childIds = nodeChildren.map(c => c.id);
      const { data: childMetrics } = await supabase
        .from('user_metrics')
        .select('state')
        .eq('user_id', userId)
        .eq('universe', 'longevity')
        .in('node_id', childIds);

      const stateOrder = { RED: 3, YELLOW: 2, GREEN: 1 };
      let worstChild = newState;
      for (const cm of (childMetrics || [])) {
        if ((stateOrder[cm.state] || 0) > (stateOrder[worstChild] || 0)) {
          worstChild = cm.state;
        }
      }
      newState = worstChild;
    }

    // 6. Update user_metrics
    const { error: updateErr } = await supabase
      .from('user_metrics')
      .upsert({
        user_id: userId,
        node_id: nodeId,
        universe: 'longevity',
        current_index: newIndex,
        state: newState,
      }, { onConflict: 'user_id,node_id,universe' });

    if (updateErr) {
      console.error('mission-complete: update error', updateErr);
      return res.json({ improved: false, error: updateErr.message });
    }

    // 7. Log to history (for sparkline)
    try {
      await supabase.from('node_state_history').insert({
        user_id: userId,
        node_id: nodeId,
        state: newState,
        current_index: newIndex,
      });
    } catch (_) { /* ignore history errors */ }

    // 8. Recalc parents (worst child rule)
    const parentUpdates = await recalcParents(supabase, userId, nodeId);

    // 9. Rolling 7-day stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: weekMissions } = await supabase
      .from('mission_log')
      .select('id')
      .eq('user_id', userId)
      .eq('node_id', nodeId)
      .gte('date', weekAgo.toISOString().split('T')[0]);

    const weekCount = weekMissions?.length || 0;

    return res.json({
      impact,
      todayCount,
      todayTotalCount,
      weekCount,
      nodeId,
      oldIndex,
      newIndex,
      oldState,
      newState,
      stateChanged: oldState !== newState,
      inactiveDays,
      parentUpdates,
      // Feedback messages
      message: impact === 'improved'
        ? 'Dvojitý zásah. Jdeš nahoru.'
        : inactiveDays > 0
          ? `Zpátky v sedle po ${inactiveDays} ${inactiveDays === 1 ? 'dni' : 'dnech'}.`
          : 'Držíš tempo.',
      // Can do more?
      canDoMore: todayCount < 2,
      offerMore: todayCount === 1, // "Chceš ještě jeden krok?"
    });

  } catch (e) {
    console.error('mission-complete: crash', e);
    return res.json({ improved: false, error: e.message });
  }
}

// ── PARENT RECALC (worst child rule) ───────────────────
async function recalcParents(supabase, userId, nodeId) {
  const updates = [];

  const { data: nodeRow } = await supabase
    .from('longevity_nodes')
    .select('parent')
    .eq('id', nodeId)
    .maybeSingle();

  if (!nodeRow?.parent) return updates;

  let currentParent = nodeRow.parent;

  for (let depth = 0; depth < 5 && currentParent; depth++) {
    const { data: children } = await supabase
      .from('longevity_nodes')
      .select('id')
      .eq('parent', currentParent);

    if (!children || children.length === 0) break;

    const childIds = children.map(c => c.id);

    const { data: childMetrics } = await supabase
      .from('user_metrics')
      .select('node_id, state')
      .eq('user_id', userId)
      .eq('universe', 'longevity')
      .in('node_id', childIds);

    const stateOrder = { RED: 3, YELLOW: 2, GREEN: 1 };
    let worstState = 'GREEN';

    for (const cm of (childMetrics || [])) {
      if ((stateOrder[cm.state] || 0) > (stateOrder[worstState] || 0)) {
        worstState = cm.state;
      }
    }

    const { error } = await supabase
      .from('user_metrics')
      .upsert({
        user_id: userId,
        node_id: currentParent,
        universe: 'longevity',
        state: worstState,
      }, { onConflict: 'user_id,node_id,universe' });

    if (!error) {
      updates.push({ nodeId: currentParent, state: worstState });
    }

    const { data: parentRow } = await supabase
      .from('longevity_nodes')
      .select('parent')
      .eq('id', currentParent)
      .maybeSingle();

    currentParent = parentRow?.parent || null;
  }

  return updates;
}
