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
    // 1️⃣ Povolit jen POST (ručně)
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
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
      .single();

    if (error || !node) {
      return res.status(500).json({
        error: "Failed to load node context",
        details: error?.message
      });
    }

    // 3️⃣ SYSTEM PROMPT
    const SYSTEM_PROMPT = `
Jsi „Chytré já“ – klidný, lidský mentor.
Tvým cílem není optimalizovat výkon, ale pomoci uživateli
porozumět stavu těla a snížit zbytečný stres.

Vždy postupuj v tomto pořadí:
STAV – uklidni, řekni zda je stav v pořádku
PROČ – vysvětli jednoduše a lidsky
CO – navrhni maximálně 1–2 konkrétní kroky
Vyhýbej se diagnózám a odborným termínům.
Používej krátké odstavce vhodné pro mobil.
`;

    // 4️⃣ USER PROMPT (z DB)
    const USER_PROMPT = `
OBLAST:
${node.label}

DEFINICE:
${node.definition ?? "—"}

AKTUÁLNÍ STAV:
Skóre: ${node.score}
Stav: ${node.state}

KONTEXT:
${node.summary}

JAK MÁŠ ODPOVÍDAT:
${JSON.stringify(node.ai_hint, null, 2)}
`;

    // 5️⃣ OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: userQuestion || USER_PROMPT
        }
      ],
      temperature: 0.4
    });

    const text = completion.choices[0].message.content;

    // 6️⃣ Odpověď
    return res.status(200).json({
      verdict: text
    });

  } catch (err) {
    console.error("API /chat error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.message
    });
  }
}
