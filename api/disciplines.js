import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function (req, res) {
  const { userId, nodeId } = req.query; // ← PŘIDEJ nodeId

  const { data } = await supabase
    .from('v_discipline_states')
    .select('discipline_id, name, icon, state, description')
    .eq('user_id', userId)
    .eq('node_id', nodeId) // ← FILTER podle node
    .order('state', { ascending: false })
    .limit(3);

  return res.json(data || []);
}