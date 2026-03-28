import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST" });

  const { nodeId, state, userId } = req.body;
  if (!nodeId) return res.status(400).json({ error: "nodeId required" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Load candidates from unified table
  const { data: candidates, error } = await supabase
    .from("longevity_sources")
    .select("id, node_id, type, title, url, summary, tags, script_cz, journal, year, med_id")
    .eq("node_id", nodeId)
    .eq("active", true);

  if (error) {
    console.warn("longevity_sources query failed:", error.message);
    return res.status(500).json({ error: "DB error" });
  }

  const pool = (candidates || []).filter(r => r.url);

  // 2. ≤ 5 sources — return all without AI
  if (pool.length <= 5) {
    return res.json({ sources: pool.map(fmt), ai: false });
  }

  // 3. User context (bottleneck + aspiration) for AI ranking
  let bottleneck = null, aspiration = null;
  if (userId) {
    const [{ data: btData }, { data: aspData }] = await Promise.all([
      supabase.from("user_bottlenecks").select("node_id").eq("user_id", userId).limit(1),
      supabase.from("user_aspirations").select("aspiration_type").eq("user_id", userId).limit(1),
    ]);
    bottleneck = btData?.[0]?.node_id || null;
    aspiration = aspData?.[0]?.aspiration_type || null;
  }

  // 4. AI ranking — GPT picks top 3–5 indices
  const aiEnabled = process.env.AI_ENABLED !== "false";
  if (!aiEnabled) {
    return res.json({ sources: pool.slice(0, 5).map(fmt), ai: false });
  }

  const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const list = pool
    .map((c, i) => `${i}. [${c.type}] ${c.title}${c.tags?.length ? " [" + c.tags.join(", ") + "]" : ""}`)
    .join("\n");

  const prompt = `Jsi AI kouč dlouhověkosti (Medicine 3.0). Vyber 3–5 nejrelevantnějších zdrojů.

Kontext:
- Oblast: ${nodeId}, stav: ${state || "YELLOW"}
- Bottleneck: ${bottleneck || "neznámý"}
- Sen uživatele: ${aspiration || "neznámý"}

Zdroje:
${list}

Vrať POUZE JSON pole číselných indexů, např. [0, 2, 4]. Preferuj konkrétní a akční obsah.`;

  let selected = pool.slice(0, 5);
  try {
    const completion = await oai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 60,
    });
    const raw = completion.choices[0].message.content.trim();
    const indices = JSON.parse(raw);
    const picked = indices.map(i => pool[i]).filter(Boolean);
    if (picked.length > 0) selected = picked;
  } catch (e) {
    console.warn("AI sources ranking failed, fallback to slice:", e.message);
  }

  return res.json({ sources: selected.map(fmt), ai: true });
}

function fmt(r) {
  return {
    id:        r.id,
    title:     r.title,
    url:       r.url,
    type:      r.type,
    summary:   r.summary || "",
    script_cz: r.script_cz || null,
    journal:   r.journal || null,
    year:      r.year || null,
    med_id:    r.med_id || null,
  };
}
