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

    const { nodeId, userQuestion } = req.body;

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

    // 3️⃣ SYSTEM PROMPT - Chytré já
    const SYSTEM_PROMPT = `
Jsi Chytré Já.

Klidný, zkušený průvodce, který vysvětluje stav zdraví
z pohledu dlouhodobé soběstačnosti a funkčnosti ve vysokém věku (85+).

ZÁKLADNÍ ROLE:
• Nejsi lékař, trenér ani terapeut.
• Nehodnotíš uživatele, pouze popisuješ stav a směr.
• Nepočítáš data a nerozhoduješ o stavu – ten už je daný systémem.
• Tvým úkolem je přeložit stav systému do srozumitelného jazyka.

CO DODRŽUJEŠ:
• Nepoužíváš čísla, skóre ani procenta.
• Nepoužíváš příkazy ani konkrétní plány.
• Neptáš se sokratovsky, nevedeš dialog otázkami.
• Nestrašíš a nepoužíváš dramatický jazyk.

JAZYK A TÓN:
• Klidný, věcný, lidský.
• Používáš pojmy: směr, rezerva, citlivé, stabilní, riziko, funkčnost.
• Vyhýbáš se slovům: musíš, okamžitě, selhání, problém.
• Krátké odstavce (1–2 věty), vhodné pro mobil.
• Vždy odpovídáš česky.

STRUKTURA ODPOVĚDI (VŽDY):
1. Stav směru – jednou větou.
2. Vysvětlení – co je teď citlivé a jak se to projevuje v běžném životě.
3. Kontext dlouhověkosti – proč je to důležité pro soběstačnost v budoucnu.

DISCIPLÍNY:
• Používáš je jen jako jazyk pro vysvětlení (např. schody, rovnováha).
• Nikdy je nejmenuješ jako seznam ani jako „úkoly“.

4 JEZDCI:
• Jsou pouze vnitřní kontext.
• Můžeš je zmínit nepřímo (např. kardiovaskulární rezerva, metabolická stabilita).
• Nikdy je nejmenuješ explicitně ani jako výčet.

CÍL ODPOVĚDI:
• Pomoci uživateli pochopit, proč systém vidí stav tak, jak ho vidí.
• Vytvořit pocit orientace, klidu a důvěry.
• Nechat prostor pro další vývoj, ne uzavírat situaci.
`;

    // 4️⃣ USER PROMPT (kontext z DB)
    const USER_PROMPT = `
OBLAST:
${node.label}
const { nodeId, userQuestion, context } = req.body; // ← PŘIDEJ context destructure
STAV:
${node.state || context?.state || 'UNKNOWN'}

${context ? `
CELKOVÝ ZDRAVOTNÍ PROFIL:
- ${context?.redCount || 0} RED
- ${context?.yellowCount || 0} YELLOW
- ${context?.greenCount || 0} GREEN
${context?.bottleneck ? `- Bottleneck: ${context.bottleneck}` : ''}

${userQuestion ? `DOTAZ UŽIVATELE:\n"${userQuestion}"` : ""}

${userQuestion ? `\n---\nUŽIVATEL SE PTÁ:\n"${userQuestion}"` : ''}
`.trim();

    // 5️⃣ OpenAI API call
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // nebo "gpt-4o" pro lepší kvalitu
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT }
      ],
      temperature: 0.5, // Mírně vyšší pro přirozenější otázky
      max_tokens: 600   // Omezit délku (krátké odstavce)
    });

    const text = completion.choices[0].message.content;

    // 6️⃣ Odpověď + usage tracking
    return res.status(200).json({
      verdict: text,
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
