// =====================================================
// API ENDPOINT: /api/chat.js - Chytré já (OpenAI)
// =====================================================

console.log("API CHAT HIT");
console.log("API CHAT POST HIT");

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function (req, res) {
  try {
    // 1️⃣ Povolit jen POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    const { nodeId, userQuestion, context } = req.body; // ← PŘIDEJ context
    // ✅ PŘIDEJ bottleneck fetch
    const { data: bottleneck } = await supabase
      .from('user_bottlenecks')
      .select('node_label, gap, bottleneck_score, aspiration_label')
      .eq('user_id', context?.userId || 'demo-user-123')
      .order('bottleneck_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!nodeId) {
      return res.status(400).json({ error: "nodeId missing" });
    }

    // 🔌 AI feature flag
    const AI_ENABLED = process.env.AI_ENABLED === "true";

    if (!AI_ENABLED) {
      console.log("AI disabled – returning mock response");
      return res.status(200).json({
        verdict: "🤖 AI je dočasně vypnutá (test režim)."
      });
    }

    // 2️⃣ Načtení uzlu z VIEW
    // Načti node
    const { data: node, error: nodeError } = await supabase
      .from("longevity_nodes")
      .select("*")
      .eq("id", nodeId)
      .maybeSingle();

    if (nodeError) {
      return res.status(500).json({ error: "Database error", details: nodeError.message });
    }

    if (!node) {
      return res.status(200).json({ verdict: "Pro tento uzel ještě nemám kontext." });
    }

    // Načti related data
    const { data: articles } = await supabase
      .from("longevity_articles")
      .select("*")
      .eq("node_id", nodeId);

    const { data: media } = await supabase
      .from("longevity_media")
      .select("*")
      .eq("node_id", nodeId);

    const { data: docs } = await supabase
      .from("longevity_docs")
      .select("*")
      .eq("node_id", nodeId);

    // Přidej k node
    node.articles = articles || [];
    node.media = media || [];
    node.docs = docs || [];

    const SYSTEM_PROMPT = `
Jsi Chytré Já — mentor dlouhověkosti pro "Stoletého desetibojaře".
Tvým úkolem je propojit zdravotní data s životní vizí uživatele.

ZÁKLADNÍ NASTAVENÍ:
- Tón: Respektující mentor, přímý, motivační.
- Cíl: Ukázat bottleneck a nabídnout dvě cesty (Úleva vs. Odolnost).
- Žádné strašení, mluv o svobodě pohybu a plnění snů.

STRUKTURA ODPOVĚDI (STRIKTNĚ):
1. věta: Analýza bottlenecku ve vztahu k jeho snu (např. Běžky, Labe).
2. věta: Nabídka dvou cest (Úleva vs. Odolnost) formou otázky.
(Ponech prázdný řádek mezi bloky pro čitelnost).

PRAVIDLA:
- Max 40 slov celkem.
- Žádné vágno ("je důležité", "v současnosti").
- Mluv o konkrétních věcech: schody, kufr, stopa, voda, dech.

ZAKÁZANÁ SLOVA: "metabolická rezerva", "jezdec", "brnění", "musíš", "pádový".
`;

    // 4️⃣ USER PROMPT (obohatíme o ASPIRACI)
    const USER_PROMPT = `
VIZE/SEN: ${user.aspiration_label || 'Aktivní stáří'}
BOTTLENECK: ${node.label} (${context.bottleneck_score})
STAV: ${node.state} (Index: ${um.current_index})
OMEZENÍ: ${user_vault.health_notes} (např. bolavé koleno)

FORMÁT:
[Analýza: Sen vs. Bottleneck]

[Vedení: Cesta úleva vs. Odolnost]
`.trim();

    // 5️⃣ OpenAI API call
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT }
      ],
      temperature: 0.3, // Nižší pro konzistentnější formát
      max_tokens: 100   // Kratší limit (max 40 slov)
    });

    const text = completion.choices[0].message.content;

    // ✅ Formátování: přidej prázdné řádky mezi věty
    const formatted = text.replace(/\.\s+/g, '.\n\n').trim();

    // 6️⃣ Odpověď + usage tracking
    return res.status(200).json({
      verdict: formatted,
      usage: {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      }
    });

  } catch (err) {
    console.error("API /chat error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
}
