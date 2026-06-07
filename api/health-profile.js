// =====================================================
// API ENDPOINT: /api/health-profile
//
// GET  ?userId=xxx          → načte profil
// POST { userId, ...patch } → uloží / merguje patch
//
// Používá se z:
//   - crt-generate.js (čte kontext pro Opus)
//   - tools/parse.js  (ukládá výsledky z PDF)
//   - UI formuláře v avataru "Já"
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ── GET: načti profil ──────────────────────────────
  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data, error } = await supabase
      .from('user_health_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      return res.status(500).json({ error: error.message });
    }

    return res.json(data || { user_id: userId });
  }

  // ── POST: uložit / mergovat ────────────────────────
  if (req.method === 'POST') {
    const { userId, ...patch } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Načti existující profil
    const { data: existing } = await supabase
      .from('user_health_profile')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Merge jsonb polí (diagnoses, medications, labs, physical)
    const merged = {
      user_id: userId,
      ...(existing || {}),
      ...patch,
    };

    // Jsonb merge: přidáme nové záznamy, nenahrazujeme celé pole
    if (patch.diagnoses && existing?.diagnoses) {
      const set = new Set([...existing.diagnoses, ...patch.diagnoses]);
      merged.diagnoses = [...set];
    }
    if (patch.medications && existing?.medications) {
      // Merguj podle jména léku
      const map = {};
      [...(existing.medications || []), ...(patch.medications || [])].forEach(m => {
        map[m.name] = m;
      });
      merged.medications = Object.values(map);
    }
    if (patch.labs && existing?.labs) {
      merged.labs = { ...existing.labs, ...patch.labs };
    }
    if (patch.physical && existing?.physical) {
      merged.physical = { ...existing.physical, ...patch.physical };
    }
    if (patch.doctor_notes && existing?.doctor_notes) {
      // Přidej nové poznámky za staré (s oddělovačem)
      merged.doctor_notes = existing.doctor_notes + '\n\n---\n\n' + patch.doctor_notes;
    }

    const { data, error } = await supabase
      .from('user_health_profile')
      .upsert(merged, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ok: true, profile: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
