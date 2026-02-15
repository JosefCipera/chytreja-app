import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function (req, res) {
  const { userId, nodeId } = req.query;

  // ✅ Najdi children nodes (pokud je parent)
  const { data: children } = await supabase
    .from('longevity_nodes')
    .select('id')
    .eq('parent', nodeId);

  // Pokud má children → použij je, jinak sám node
  const nodeIds = children && children.length > 0
    ? children.map(c => c.id)
    : [nodeId];

  // /api/disciplines.js
  const { data } = await supabase
    .from('v_discipline_states')
    .select('discipline_id, name, icon, state, description')
    .eq('user_id', userId)
    .in('node_id', nodeIds)
    .order('state', { ascending: false });

  // ✅ Deduplikuj + worst state
  const disciplineMap = new Map();

  data.forEach(d => {
    const existing = disciplineMap.get(d.discipline_id);

    if (!existing) {
      disciplineMap.set(d.discipline_id, d);
    } else {
      // Worst state wins (RED > YELLOW > GREEN > GRAY)
      const stateRank = { RED: 0, YELLOW: 1, GREEN: 2, GRAY: 3 };
      if (stateRank[d.state] < stateRank[existing.state]) {
        disciplineMap.set(d.discipline_id, d);
      }
    }
  });

  const unique = Array.from(disciplineMap.values()).slice(0, 3);

  return res.json(unique);
}