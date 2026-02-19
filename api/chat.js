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

    // 1. Helper funkce
    function getRiderRisk(nodeLabel) {
      const risks = {
        'kardio': 'Infarkt/mrtvice',
        'vo2max': 'Infarkt',
        'síla': 'Ztráta nezávislosti',
        'stabilita': 'Pád/zlomeniny',
        'metabolicke': 'Cukrovka/slepota',
        'nervovy_system': 'Demence/Alzheimer'
      };
      return risks[nodeLabel.toLowerCase()] || 'Ztráta funkčnosti';
    }
    const aspiration = null; // TODO: načíst z user_aspirations až bude onboarding hotový

    const SYSTEM_PROMPT = `
Jsi Chytré Já — průvodce zdravím a dlouhověkostí.

TVOJE ROLE:
Krátce říct co je špatně a proč to ohrožuje budoucnost uživatele.

DVA REŽIMY:

1) HLAVNÍ UZEL (Stoletý desetibojař):
Celkový pohled na baterii. Řekni jak na tom uživatel je celkově
a co ho táhne dolů nejvíc. Směruj na slabý článek.
Příklad: "Jsi na tom slušně, ale tělo je slabý článek. Bez něj tě kardio dostihne."

2) PODŘÍZENÝ UZEL (Tělo, Mysl, Výživa, Zdraví):
Konkrétní stav uzlu. Řekni co nestačí a jaký je důsledek — 
osobně, konkrétně, s odkazem na sen pokud je známý.
Příklad: "Síla ti v pětaosmdesáti nebude stačit. Hrozí ti kardio a na běžky se ani nepostavíš."

FORMÁT:
- Jeden odstavec, maximálně dvě tři věty
- Žádné nadpisy, odrážky, formátování
- Žádná akce — ta je v jiné sekci

PRAVIDLA:
- Max patnáct slov na větu
- Konkrétní hrozby (infarkt, pád, demence — ne "zdravotní problémy")
- Konkrétní sen (běžky v pětaosmdesáti, hrát si s vnouky — ne "budoucnost")
- Žádné číslovky — piš slovně (třikrát, třicet minut, pětaosmdesát)

ZAKÁZÁNO:
- Čísla a číslice
- "musíš", "okamžitě", "je důležité", "měl bys"
- "metabolická rezerva", "dlouhodobě"
- Akční kroky (ty patří do sekce Akce)
- Fráze typu "Dobrá zpráva je"

JAZYK: Česky, tykání, přímočaré. Max třicet slov celkem.
`;

    const bottleneckLabel = context?.bottleneck || null;

    const USER_PROMPT = `
REŽIM: ${node.id === 'dlouhovekost' ? 'HLAVNÍ UZEL' : 'PODŘÍZENÝ UZEL'}
UZEL: ${node.label}
STAV: ${node.state}
${bottleneckLabel ? `BOTTLENECK: ${bottleneckLabel}
HROZBA: ${getRiderRisk(bottleneckLabel)}` : ''}
${aspiration ? `SEN: ${aspiration}` : ''}

Odpověz jedním odstavcem.
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

    console.log("=== RAW TEXT ===");
    console.log(text);
    console.log("=== RAW TEXT END ===");

    const formatted = text.replace(/\.\s+/g, '.\n\n').trim();

    console.log("=== FORMATTED ===");
    console.log(formatted);
    console.log("=== FORMATTED END ===");

    return res.json({
      verdict: formatted,
      usage: {
        prompt_tokens: completion.usage.prompt_tokens,
        completion_tokens: completion.usage.completion_tokens,
        total_tokens: completion.usage.total_tokens
      }
    });

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
