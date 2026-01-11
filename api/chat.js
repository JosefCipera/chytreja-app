import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { nodeLabel, nodeIndex, nodeDefinition, userQuestion } = req.body;

  const SYSTEM_PROMPT = `
Jsi „Chytré já“ – klidný, lidský mentor.
Tvým cílem není optimalizovat výkon, ale pomoci uživateli
porozumět stavu těla a snížit zbytečný stres.

Vždy postupuj v tomto pořadí:
1. Uklidni – řekni, zda je stav v pořádku
2. Vysvětli proč (jednoduše, lidsky)
3. Navrhni maximálně 1–2 konkrétní kroky
4. Nezacházej do medicínských diagnóz
5. Používej krátké odstavce vhodné pro mobil
`;

  const userPrompt = `
OBLAST:
${node.label}

DEFINICE:
${node.definition ?? "—"}

AKTUÁLNÍ STAV:
Index: ${score}
Stav: ${state}
Shrnutí: ${summary}

POKYNY PRO ODPOVĚĎ:
${JSON.stringify(node.ai_hint, null, 2)}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userQuestion || "Udělej úvodní zhodnocení tohoto uzlu." }
      ],
      response_format: { type: "json_object" }, // Vynutíme JSON formát
      temperature: 0.4
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);
    res.status(200).json(aiResponse);
  } catch (err) {
    res.status(500).json({ error: "OpenAI failed", details: err.message });
  }
}