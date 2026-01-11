import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nodeId, userQuestion } = req.body;

  if (!nodeId) {
    return res.status(400).json({ error: "nodeId missing" });
  }

  // 1️⃣ Načtení uzlu z VIEW
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

  // 2️⃣ SYSTEM PROMPT
  const SYSTEM_PROMPT = `
Jsi „Chytré já“ – klidný, lidský mentor.
Tvým cílem není optimalizovat výkon, ale pomoci uživateli
porozumět stavu těla a snížit zbytečný stres.

Vždy postupuj v tomto pořadí:
1. STAV – uklidni, řekni zda je stav v pořádku
2. PROČ – vysvětli jednoduše a lidsky
3. CO – navrhni maximálně 1–2 konkrétní kroky
4. Vyhýbej se diagnózám a odborným termínům
5. Používej krátké odstavce vhodné pro mobil
`;

  // 3️⃣ USER PROMPT (z DB)
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

  try {
    // 4️⃣ OpenAI
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

    // 5️⃣ Odpověď frontendům
    res.status(200).json({
      verdict: text
    });

  } catch (err) {
    res.status(500).json({
      error: "OpenAI failed",
      details: err.message
    });
  }
}
