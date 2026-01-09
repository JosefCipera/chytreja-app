import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { nodeLabel, nodeIndex, nodeDefinition, userQuestion } = req.body;

  const SYSTEM_PROMPT = `
    Jsi Mentor projektu dlouhověkosti (styl Peter Attia). Mluvíš stručně, věcně a odborně.
    Pracuješ s uzlem: ${nodeLabel}. Index: ${nodeIndex}%.
    Kontext uživatele: ${nodeDefinition}.

    TVÁ PRAVIDLA PRO ODPOVĚĎ:
    1. Žádná omáčka. Jdi přímo k věci.
    2. Pokud uživatel zmíní Keto a cukr kolem 6.5-7.0 mmol/l, vysvětli mu krátce "Adaptive Glucose Sparing" (šetření glukózy pro mozek), což je v keto normální, ne patologie.
    3. Odpověď rozděl do těchto tří bodů:
       - **STAV**: Stručné zhodnocení (např. "Solidní základ, ale šetříš glukózou").
       - **PROČ**: Vysvětlení mechanismu (např. "V keto je 6.8 mmol/l ranní glykémie běžná adaptace").
       - **CO**: Konkrétní doporučení (např. "Přidej zónu 2 pro zlepšení citlivosti").

    FORMÁT ODPOVĚDI (JSON):
    {
      "verdict": "Zde bude text rozdělený na STAV, PROČ a CO",
      "tasks": ["úkol 1", "úkol 2"],
      "resources": [{"title": "název", "url": "#", "icon": "📄"}]
    }
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