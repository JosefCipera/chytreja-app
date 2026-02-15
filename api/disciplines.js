import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function (req, res) {
  const { userId } = req.query;

  const { data } = await supabase
    .from('v_discipline_states')
    .select('*')
    .eq('user_id', userId)
    .order('state', { ascending: false }) // RED first
    .limit(3);

  return res.json(data || []);
}