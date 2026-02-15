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

  // Fetch disciplíny pro node(s)
  const { data } = await supabase
    .from('v_discipline_states')
    .select('discipline_id, name, icon, state, description')
    .eq('user_id', userId)
    .in('node_id', nodeIds) // ← children OR self
    .order('state', { ascending: false })
    .limit(3);

  return res.json(data || []);
}