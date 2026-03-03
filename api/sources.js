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

  // 1. Kandidáti pro daný uzel
  const [{ data: media }, { data: articles }, { data: docs }] = await Promise.all([
    supabase.from("longevity_media").select("id, title, type, url, summary, tags").eq("node_id", nodeId),
    supabase.from("longevity_articles").select("id, title, url, summary, tags").eq("node_id", nodeId),
    supabase.from("longevity_docs").select("id, title, type, url, summary").eq("node_id", nodeId),
  ]);

  const candidates = [
    ...(media    || []).map(r => ({ ...r, itemType: r.type || "video" })),
    ...(articles || []).map(r => ({ ...r, itemType: "article" })),
    ...(docs     || []).map(r => ({ ...r, itemType: r.type || "pdf" })),
  ].filter(r => r.url);

  // 2. Pokud ≤ 5 zdrojů, vrátíme vše bez AI
  if (candidates.length <= 5) {
    return res.json({ sources: candidates.map(fmt), ai: false });
  }

  // 3. Uživatelský kontext (bottleneck + sen)
  let bottleneck = null, aspiration = null;
  if (userId) {
    const [{ data: btData }, { data: aspData }] = await Promise.all([
      supabase.from("user_bottlenecks").select("node_id").eq("user_id", userId).limit(1),
      supabase.from("user_aspirations").select("aspiration_type").eq("user_id", userId).limit(1),
    ]);
    bottleneck = btData?.[0]?.node_id || null;
    aspiration = aspData?.[0]?.aspiration_type || null;
  }

  // 4. AI ranking – GPT vybere top 3–5 indexů
  const aiEnabled = process.env.AI_ENABLED !== "false";
  if (!aiEnabled) {
    return res.json({ sources: candidates.slice(0, 5).map(fmt), ai: false });
  }

  const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const list = candidates
    .map((c, i) => `${i}. ${c.title}${c.tags?.length ? " [" + c.tags.join(", ") + "]" : ""}`)
    .join("\n");

  const prompt = `Jsi AI kouč dlouhověkosti (Medicine 3.0). Vyber 3–5 nejrelevantnějších zdrojů.

Kontext:
- Oblast: ${nodeId}, stav: ${state || "YELLOW"}
- Bottleneck: ${bottleneck || "neznámý"}
- Sen uživatele: ${aspiration || "neznámý"}

Zdroje:
${list}

Vrať POUZE JSON pole číselných indexů, např. [0, 2, 4]. Preferuj konkrétní a akční obsah.`;

  let selected = candidates.slice(0, 5);
  try {
    const completion = await oai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 60,
    });
    const raw = completion.choices[0].message.content.trim();
    const indices = JSON.parse(raw);
    const picked = indices.map(i => candidates[i]).filter(Boolean);
    if (picked.length > 0) selected = picked;
  } catch (e) {
    console.warn("AI sources ranking failed, fallback to slice:", e.message);
  }

  return res.json({ sources: selected.map(fmt), ai: true });
}

function fmt(r) {
  return {
    title:     r.title,
    url:       r.url,
    type:      r.itemType || "article",
    summary:   r.summary || "",
    script_cz: r.script_cz || null,
  };
}
