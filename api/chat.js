// =====================================================
// API ENDPOINT: /api/chat.js - Chytré já (OpenAI)
// =====================================================

import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export default async function (req, res) {
  try {
    // 1️⃣ Povolit jen POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }

    console.log('ENV CHECK:', {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'EXISTS' : 'MISSING',
      ai: process.env.AI_ENABLED
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { nodeId, userQuestion, context } = req.body;

    // ✅ Bottleneck fetch
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

    // Načti step_provocation z universe_nodes (Learning by Doing kontext)
    const { data: nodeSteps } = await supabase
      .from('universe_nodes')
      .select('step_provocation')
      .eq('id', nodeId)
      .eq('universe_id', 'longevity')
      .maybeSingle();

    const stepProvocation = nodeSteps?.step_provocation || null;

    // Helper funkce

    const aspiration = null;

    // Helper funkce
    function getRiderRisk(nodeLabel) {
      const risks = {
        'kardio': 'srdce',
        'vo2max': 'kondice a srdce',
        'síla': 'samostatnost',
        'stabilita': 'rovnováha a samostatnost',
        'metabolicke': 'energii a tělo',
        'nervovy_system': 'mozek a hlava'
      };
      return risks[nodeLabel.toLowerCase()] || 'tělo';
    }

    function getNodeContext(nodeId) {
      const contexts = {
        'telo': 'síla a svaly',
        'mysl': 'pozornost a paměť',
        'vyziva': 'strava a energie',
        'zdravi': 'prevence a odolnost',
        'metabolicke': 'metabolismus a rovnováha těla'
      };
      return contexts[nodeId] || '';
    }

    function getNodeLabel(nodeId) {
      const labels = {
        'telo': 'tělo',
        'mysl': 'hlava',
        'vyziva': 'strava',
        'zdravi': 'zdraví',
        'metabolicke': 'metabolismus'
      };
      return labels[nodeId] || nodeId;
    }

    const SYSTEM_PROMPT = `
Jsi Chytré Já — průvodce zdravím a dlouhověkostí.

ODPOVÍDEJ PŘESNĚ PODLE ŠABLONY:

HLAVNÍ UZEL:
Když stav špatný: "Nejvíc tě brzdí [slabý článek], bez změny to půjde dolů."
Když stav střední: "Celkově ok, ale [slabý článek] zaostává."
Když stav dobrý: "Jsi v dobré kondici, drž to takhle."

PODŘÍZENÝ UZEL:
Když stav špatný: "Tvoje [oblast] nestačí — [co to znamená pro tělo]."
Když stav střední: "Tvoje [oblast] není špatná, ale [co konkrétně slábne]."
Když stav dobrý: "Tvoje [oblast] je v pořádku."

Doplň jen to co je v hranatých závorkách. Neměň strukturu věty. Nepřidávej nic navíc.

Pokud je k dispozici KONTEXT PROVOKACE, zachovej jeho přímý a faktický tón — žádné cukrování, žádné rady navíc.

JAZYK: Česky, tykání, přímočaré. Max třicet slov celkem.
`;

    const bottleneckLabel = context?.bottleneck || null;

    const USER_PROMPT = `
REŽIM: ${node.id === 'dlouhovekost' ? 'HLAVNÍ UZEL' : 'PODŘÍZENÝ UZEL'}
UZEL: ${node.label}
STAV: ${node.state || context?.state || 'UNKNOWN'}
${stepProvocation ? `KONTEXT PROVOKACE: "${stepProvocation}"` : ''}
${node.id === 'dlouhovekost' && bottleneckLabel ? `SLABÝ ČLÁNEK: ${getNodeLabel(bottleneckLabel)}
OHROŽENÍ: ${getRiderRisk(bottleneckLabel)}` : ''}
${node.id !== 'dlouhovekost' ? `OBLAST: ${getNodeContext(node.id)}` : ''}

Odpověz JEDNOU větou. Napiš jednu větu a skonči.
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
