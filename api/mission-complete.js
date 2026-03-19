// POST /api/mission-complete
// Called after mission is saved to mission_log.
// Checks if user earned enough missions → improves node current_index → recalcs state.
//
// Game loop:
//   mission completed → mission_log
//   → enough missions for this node? → bump current_index
//   → recalc state (GREEN/YELLOW/RED)
//   → recalc parent state (worst child rule)
//   → return new states

import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });
import { createClient } from "@supabase/supabase-js";

// ── THRESHOLDS ─────────────────────────────────────────
// How many missions (in last 7 days) needed to improve a node
const MISSIONS_TO_IMPROVE = 3;
// How much current_index improves per step (0–100 scale)
const INDEX_BUMP = 5;
// State boundaries (current_index thresholds)
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

    // 1. Count missions for this node in last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const { data: recentMissions, error: missErr } = await supabase
      .from('mission_log')
      .select('id')
      .eq('user_id', userId)
      .eq('node_id', nodeId)
      .gte('date', weekAgoStr);

    if (missErr) {
      console.error('mission-complete: count error', missErr);
      return res.json({ improved: false, error: missErr.message });
    }

    const missionCount = recentMissions?.length || 0;

    // Not enough missions yet — no improvement
    if (missionCount < MISSIONS_TO_IMPROVE) {
      return res.json({
        improved: false,
        missionCount,
        needed: MISSIONS_TO_IMPROVE,
        message: `${missionCount}/${MISSIONS_TO_IMPROVE} misí tento týden`,
      });
    }

    // 2. Get current node metrics
    const { data: metric, error: metErr } = await supabase
      .from('user_metrics')
      .select('current_index, state')
      .eq('user_id', userId)
      .eq('node_id', nodeId)
      .eq('universe', 'longevity')
      .maybeSingle();

    if (metErr) {
      console.error('mission-complete: metric read error', metErr);
      return res.json({ improved: false, error: metErr.message });
    }

    const oldIndex = metric?.current_index ?? 30;
    const oldState = metric?.state || indexToState(oldIndex);

    // 3. Bump index (cap at 100)
    const newIndex = Math.min(100, oldIndex + INDEX_BUMP);
    const newState = indexToState(newIndex);

    // 4. Update user_metrics
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

    // 5. Log state change to history
    await supabase.from('node_state_history').insert({
      user_id: userId,
      node_id: nodeId,
      state: newState,
      index_value: newIndex,
    }).catch(() => {}); // non-critical

    // 6. Recalc parent state (worst child rule)
    const parentUpdates = await recalcParents(supabase, userId, nodeId);

    return res.json({
      improved: true,
      nodeId,
      oldIndex,
      newIndex,
      oldState,
      newState,
      stateChanged: oldState !== newState,
      missionCount,
      parentUpdates,
      message: oldState !== newState
        ? `${oldState} → ${newState}!`
        : `Index: ${oldIndex} → ${newIndex}`,
    });

  } catch (e) {
    console.error('mission-complete: crash', e);
    return res.json({ improved: false, error: e.message });
  }
}

// ── PARENT RECALC (worst child rule) ───────────────────
async function recalcParents(supabase, userId, nodeId) {
  const updates = [];

  // Get node's parent from longevity_nodes
  const { data: nodeRow } = await supabase
    .from('longevity_nodes')
    .select('parent')
    .eq('id', nodeId)
    .maybeSingle();

  if (!nodeRow?.parent) return updates;

  let currentParent = nodeRow.parent;

  // Walk up the tree (max 5 levels to prevent infinite loop)
  for (let depth = 0; depth < 5 && currentParent; depth++) {
    // Get all children of this parent
    const { data: children } = await supabase
      .from('longevity_nodes')
      .select('id')
      .eq('parent', currentParent);

    if (!children || children.length === 0) break;

    const childIds = children.map(c => c.id);

    // Get states of all children
    const { data: childMetrics } = await supabase
      .from('user_metrics')
      .select('node_id, state')
      .eq('user_id', userId)
      .eq('universe', 'longevity')
      .in('node_id', childIds);

    // Worst child rule: RED > YELLOW > GREEN
    const stateOrder = { RED: 3, YELLOW: 2, GREEN: 1 };
    let worstState = 'GREEN';

    for (const cm of (childMetrics || [])) {
      if ((stateOrder[cm.state] || 0) > (stateOrder[worstState] || 0)) {
        worstState = cm.state;
      }
    }

    // Update parent
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

    // Go up one more level
    const { data: parentRow } = await supabase
      .from('longevity_nodes')
      .select('parent')
      .eq('id', currentParent)
      .maybeSingle();

    currentParent = parentRow?.parent || null;
  }

  return updates;
}
