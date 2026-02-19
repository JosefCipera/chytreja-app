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

DVA REŽIMY:

1) HLAVNÍ UZEL (Stoletý desetibojař):
Klidný přehled. Řekni stav a kam směřuje ohrožení, bez názvů nemocí.
Příklad: "Jsi na tom slušně, ale metabolismus tě brzdí — a to ohrožuje srdce."
Příklad: "Celkově dobré, ale tělo zaostává a hlava na to doplatí."

2) PODŘÍZENÝ UZEL (Tělo, Mysl, Výživa, Zdraví):
Konkrétní stav uzlu. 
Mírný tón — ne strašení, ale upřímnost.
Řekni co nestačí a co je v ohrožení.
Příklad: "Síla ti v pětaosmdesáti nebude stačit a ztratíš samostatnost."
Příklad: "Spánek nestačí a mozek na to doplácí."

FORMÁT:
- Jeden odstavec, dvě věty
- Žádné nadpisy, odrážky, formátování
- Žádná akce — ta je v jiné sekci

PRAVIDLA:
- Max patnáct slov na větu
- Mluv o důsledcích, ne o diagnózách (ne "hrozí cukrovka" ale "metabolismus tě brzdí")
- Žádné číslovky — piš slovně
- Směruj na budoucnost, ne na strach

ZAKÁZÁNO:
- Čísla a číslice
- Konkrétní názvy nemocí (ne "cukrovka", "infarkt" — piš "srdce", "mozek", "samostatnost")
- "musíš", "okamžitě", "je důležité", "měl bys", "hrozí"
- Akční kroky
- "Dobrá zpráva je"

JAZYK: Česky, tykání, přímočaré. Max třicet slov celkem.
`;

    const bottleneckLabel = context?.bottleneck || null;

    const USER_PROMPT = `
REŽIM: ${node.id === 'dlouhovekost' ? 'HLAVNÍ UZEL' : 'PODŘÍZENÝ UZEL'}
UZEL: ${node.label}
STAV: ${node.state}
${bottleneckLabel ? `SLABÝ ČLÁNEK: ${bottleneckLabel}
OHROŽENÍ: ${getRiderRisk(bottleneckLabel)}` : ''}
${aspiration ? `SEN: ${aspiration}` : ''}

Odpověz jedním odstavcem, dvě věty.
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
