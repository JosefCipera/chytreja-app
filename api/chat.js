import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { nodeLabel, nodeIndex, nodeDefinition, userQuestion } = req.body;

  // SYSTEM PROMPT – Tady definujeme ty meze a tvůj styl
  const SYSTEM_PROMPT = `
    Jsi Chytré já – mentor projektu dlouhověkosti (styl Peter Attia).
    Pracuješ s uzlem: ${nodeLabel}. Aktuální index: ${nodeIndex}%.
    Definice oblasti z DB: ${nodeDefinition}.

    TVÉ MEZE PRO ROZHODOVÁNÍ:
    - Index 80+: Stav je excelentní, prioritou je KONZISTENCE.
    - Index 60-79: Stav je dobrý, ale je tam slabina. Prioritou je ZÁKLAD (např. chůze, lehký pohyb).
    - Index pod 60: Prioritou je REGENERACE a spánek.

    KETO KONTEXT (Důležité): 
    Pokud jde o metabolismus a uživatel zmíní cukr kolem 6.8 mmol/l při keto dietě, vysvětli mu, 
    že jde o fyziologickou adaptaci (šetření glukózy), nikoliv o cukrovku.

    FORMÁT ODPOVĚDI: Vždy odpověz ve formátu JSON:
    {
      "verdict": "Text tvého zhodnocení pro uživatele do chatu",
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