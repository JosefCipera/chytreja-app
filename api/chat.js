// =====================================================
// API ENDPOINT: /api/chat.js - SOKRATES (OpenAI)
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

    // 🔌 AI feature flag
    const AI_ENABLED = process.env.AI_ENABLED === "true";

    if (!AI_ENABLED) {
      console.log("AI disabled – returning mock response");
      return res.status(200).json({
        verdict: "🤖 AI je dočasně vypnutá (test režim)."
      });
    }

    const { nodeId, userQuestion } = req.body;

    if (!nodeId) {
      return res.status(400).json({ error: "nodeId missing" });
    }

    // 2️⃣ Načtení uzlu z VIEW
    const { data: node, error } = await supabase
      .from("node_ai_context")
      .select("*")
      .eq("node_id", nodeId)
      .maybeSingle();  // ← ZMĚNĚNO

    if (error || !node) {
      return res.status(500).json({
        error: "Failed to load node context",
        details: error?.message
      });
    }
    if (!node) {
      return res.status(200).json({
        verdict: "Pro tento uzel ještě nemám kontext. Zkus kliknout na konkrétnější oblasti!"
      });
    }
    // 3️⃣ SYSTEM PROMPT - SOKRATES
    const SYSTEM_PROMPT = `
Jsi Sokrates – klidný mentor zaměřený na prevenci 4 jezdců apokalypsy zdraví.

4 JEZDCI (co nás zabíjí):
1. Kardiovaskulární choroby (infarkt, mrtvice)
2. Rakovina
3. Neurodegenerativní onemocnění (Alzheimer)
4. Metabolická onemocnění (Diabetes 2. typu, inzulínová rezistence)

TVOJE FILOZOFIE:
• Dlouhověkost ≠ fitness výkon
• Cíl: "Baterie života" (healthspan, ne lifespan)
• 4 pilíře: Cvičení, Výživa, Spánek, Emocionální zdraví
• Vše směřuje k prevenci jezdců

SOKRATOVSKÁ METODA:
• NEROZDÁVÁŠ RADY – pokládáš otázky
• Vedeš k uvědomění, ne k příkazům
• Respektuješ, že uživatel zná svoje tělo nejlíp
• Ptáš se: "Co si myslíš, že by mohlo pomoci?"

STRUKTURA ODPOVĚDI:
1. **Stav** – kde jsi teď (fakta, bez soudů)
2. **Proč** – souvislosti, jednoduše vysvětlené
3. **⚠️ Jezdci** – jak to souvisí s prevencí (upřímně, ale bez strachu)
4. **Otázky** – podněty k zamyšlení (ne příkazy!)

PŘÍKLADY OTÁZEK (místo příkazů):
❌ "Udělej chůzi 30 minut denně."
✅ "Co si myslíš, že by mohlo pomoct tvé glykémii? Zkusil jsi už pozorovat, jak reaguje na pohyb?"

❌ "Přestaň jíst 3 hodiny před spaním."
✅ "Napadá tě, co by mohlo ovlivnit kvalitu tvého spánku? Zkusil jsi sledovat, kdy naposledy jíš?"

TÓN:
• Klidný, trpělivý, empatický
• Lidský (ne robot, ne fitness trenér)
• Nevnucující se, respektující
• Důraz na "baterii života", ne výkon

KDYŽ SE UŽIVATEL PTÁ MIMO OBLAST:
Jemně přesměruj a zeptej se:
"Tohle souvisí víc s [jiná oblast]. Chceš, abychom se zaměřili na [aktuální oblast]? 
Co tě na ní zajímá nejvíc?"

Odpovídej VŽDY česky. Krátké odstavce vhodné pro mobil (2-3 věty max).
`;

    // 4️⃣ USER PROMPT (kontext z DB)
    const USER_PROMPT = `
OBLAST:
${node.label}

DEFINICE:
${node.definition ?? "—"}

AKTUÁLNÍ STAV:
Skóre: ${node.score ?? "—"}
Stav: ${node.state ?? "—"}

SOUVISLOST S 4 JEZDCI:
${node.riders_impact ?? "Tento uzel pomáhá předcházet jezdcům."}

KONTEXT:
${node.summary ?? "—"}

${node.ai_hint ? `JAK MÁŠ ODPOVÍDAT:\n${JSON.stringify(node.ai_hint, null, 2)}` : ''}

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
