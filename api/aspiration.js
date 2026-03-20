// =====================================================
// API ENDPOINT: /api/aspiration.js
// GET /api/aspiration?userId=...&nodeId=...
// Returns aspiration requirements + gap for a specific node
// =====================================================

import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

import { createClient } from "@supabase/supabase-js";

// Fallback data – used when DB tables are empty
// Represents "Běžky v 85" aspiration requirements per node
const BEZKY_V_85 = {
  type: 'bezky_v_85',
  label: 'Běžky v 85',
  requirements: {
    stabilita:    { required_level: 0.85, importance_weight: 0.9 },
    sila:         { required_level: 0.75, importance_weight: 0.8 },
    telo:         { required_level: 0.70, importance_weight: 0.75 },
    kardio:       { required_level: 0.80, importance_weight: 0.85 },
    vo2max:       { required_level: 0.75, importance_weight: 0.85 },
    mysl:         { required_level: 0.70, importance_weight: 0.65 },
    vyziva:       { required_level: 0.75, importance_weight: 0.70 },
    zdravi:       { required_level: 0.70, importance_weight: 0.70 },
    metabolicke:  { required_level: 0.65, importance_weight: 0.60 },
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' });
  }

  const { userId = 'demo-user-123', nodeId } = req.query;

  if (!nodeId) {
    return res.status(400).json({ error: 'nodeId missing' });
  }

  // Main node: aspirations not shown
  if (nodeId === 'dlouhovekost') {
    return res.json({ aspiration: null });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Fetch user's aspiration type
  const { data: userAspiration } = await supabase
    .from('user_aspirations')
    .select('aspiration_type, aspiration_label')
    .eq('user_id', userId)
    .maybeSingle();

  // No fallback — if user has no aspiration, return null
  const aspirationType = userAspiration?.aspiration_type;
  const aspirationLabel = userAspiration?.aspiration_label;

  if (!aspirationType) {
    return res.json({ aspiration: null });
  }

  // 2. Fetch requirement for this node from DB, fallback to hardcoded
  let requiredLevel = null;
  let importanceWeight = 1;

  const { data: requirement } = await supabase
    .from('aspiration_requirements')
    .select('required_level, importance_weight')
    .eq('aspiration_type', aspirationType)
    .eq('node_id', nodeId)
    .maybeSingle();

  if (requirement) {
    requiredLevel    = Number(requirement.required_level);
    importanceWeight = Number(requirement.importance_weight);
  } else {
    // Fallback: hardcoded bezky_v_85 data
    const fallback = BEZKY_V_85.requirements[nodeId];
    if (!fallback) {
      return res.json({ aspiration: null });
    }
    requiredLevel    = fallback.required_level;
    importanceWeight = fallback.importance_weight;
  }

  // 3. Fetch current metric for this node
  const { data: metric } = await supabase
    .from('user_metrics')
    .select('current_index')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .eq('universe', 'longevity')
    .maybeSingle();

  // current_index is stored on 0–100 scale; normalize to 0–1 to match requiredLevel
  const currentLevel = metric?.current_index != null ? Number(metric.current_index) / 100 : null;

  // 4. Calculate gap
  const gap         = currentLevel !== null ? Math.max(0, requiredLevel - currentLevel) : null;
  const weightedGap = gap !== null ? gap * importanceWeight : null;
  const achieved    = gap !== null ? gap <= 0.02 : null; // small tolerance

  return res.json({
    aspiration: {
      type:             aspirationType,
      label:            aspirationLabel,
      requiredLevel,
      importanceWeight,
      currentLevel,
      gap,
      weightedGap,
      achieved
    }
  });
}
