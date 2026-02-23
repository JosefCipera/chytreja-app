// =====================================================
// API ENDPOINT: /api/chat.js - Chytré já (OpenAI)
// =====================================================

import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// Fallback aspiration data – matches api/aspiration.js
const BEZKY_V_85 = {
  type: 'bezky_v_85',
  label: 'Běžky v 85',
  requirements: {
    stabilita:   { required_level: 0.85, importance_weight: 0.9 },
    sila:        { required_level: 0.75, importance_weight: 0.8 },
    telo:        { required_level: 0.70, importance_weight: 0.75 },
    kardio:      { required_level: 0.80, importance_weight: 0.85 },
    vo2max:      { required_level: 0.75, importance_weight: 0.85 },
    mysl:        { required_level: 0.70, importance_weight: 0.65 },
    vyziva:      { required_level: 0.75, importance_weight: 0.70 },
    zdravi:      { required_level: 0.70, importance_weight: 0.70 },
    metabolicke: { required_level: 0.65, importance_weight: 0.60 },
  }
};

async function fetchAspirationData(supabase, userId, nodeId) {
  if (nodeId === 'dlouhovekost') return null;

  try {
    const { data: userAspiration } = await supabase
      .from('user_aspirations')
      .select('aspiration_type, aspiration_label')
      .eq('user_id', userId)
      .maybeSingle();

    const aspirationType = userAspiration?.aspiration_type || BEZKY_V_85.type;
    const aspirationLabel = userAspiration?.aspiration_label || BEZKY_V_85.label;

    let requiredLevel = null;
    let importanceWeight = 1;

    const { data: requirement } = await supabase
      .from('aspiration_requirements')
      .select('required_level, importance_weight')
      .eq('aspiration_type', aspirationType)
      .eq('node_id', nodeId)
      .maybeSingle();

    if (requirement) {
      requiredLevel    = Number(requirement.required_level);
      importanceWeight = Number(requirement.importance_weight);
    } else {
      const fallback = BEZKY_V_85.requirements[nodeId];
      if (!fallback) return null;
      requiredLevel    = fallback.required_level;
      importanceWeight = fallback.importance_weight;
    }

    const { data: metric } = await supabase
      .from('user_metrics')
      .select('current_index')
      .eq('user_id', userId)
      .eq('node_id', nodeId)
      .eq('universe', 'longevity')
      .maybeSingle();

    // current_index is stored on 0–100 scale; normalize to 0–1 to match requiredLevel
    const currentLevel = metric?.current_index != null ? Number(metric.current_index) / 100 : null;
    const gap = currentLevel !== null ? Math.max(0, requiredLevel - currentLevel) : null;

    return {
      label:            aspirationLabel,
      requiredLevel,
      importanceWeight,
      currentLevel,
      gap,
      achieved:         gap !== null ? gap <= 0.02 : null
    };
  } catch (err) {
    console.warn('fetchAspirationData error:', err.message);
    return null;
  }
}

export default async function (req, res) {
  try {
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

    const userId = context?.userId || 'demo-user-123';

    // ✅ Bottleneck fetch
    const { data: bottleneck } = await supabase
      .from('user_bottlenecks')
      .select('node_label, gap, bottleneck_score, aspiration_label')
      .eq('user_id', userId)
      .order('bottleneck_score', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ✅ Aspiration fetch (null for main node)
    const aspirationData = await fetchAspirationData(supabase, userId, nodeId);

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

    // 2️⃣ Načtení uzlu
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

    node.articles = articles || [];
    node.media = media || [];
    node.docs = docs || [];

    // Načti step_provocation z universe_nodes
    const { data: nodeSteps } = await supabase
      .from('universe_nodes')
      .select('step_provocation')
      .eq('id', nodeId)
      .eq('universe_id', 'longevity')
      .maybeSingle();

    const stepProvocation = nodeSteps?.step_provocation || null;

    const isSubNode = nodeId !== 'dlouhovekost';

    // ─── CONVERSATION MODE ───────────────────────────────────────────────────
    if (userQuestion) {
      const aspirationContext = isSubNode && aspirationData?.gap > 0.05
        ? `\nUživatelův sen: ${aspirationData.label}. U tohoto uzlu zaostává — připomeň to přirozeně v odpovědi.`
        : '';

      const CONVO_SYSTEM = `Jsi Chytré Já — osobní kouč pro dlouhověkost.

Uživatel se tě může ptát na cokoliv, ale ty si vybíráš, jak odpovíš.
Vždy směřuj hovor k dlouhověkosti a aktuálnímu uzlu.${aspirationContext}
Odpovídej česky, tykej, buď přímý a konkrétní. Max dvě věty.
Nezačínaj větou "Rozumím" ani "Samozřejmě". Nepřidávej rady nesouvisející s uzlem.
Zakázaná slova: "musíš", "je důležité", "měl bys", "hrozí", "ohrožuje", "samostatnost".`;

      const CONVO_USER = `Uzel: ${node.label} (stav: ${node.state || context?.state || 'neznámý'})
${stepProvocation ? `Kontext: "${stepProvocation}"` : ''}
Dotaz uživatele: ${userQuestion}`;

      const convoCompletion = await openai.chat.completions.create({
        model:       "gpt-4o-mini",
        messages:    [
          { role: "system", content: CONVO_SYSTEM },
          { role: "user",   content: CONVO_USER   }
        ],
        temperature: 0.7,
        max_tokens:  160
      });

      return res.json({
        verdict: convoCompletion.choices[0].message.content.trim()
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    function getRiderRisk(nodeLabel) {
      const risks = {
        'kardio':         'srdce',
        'vo2max':         'kondice a srdce',
        'síla':           'pohyb a síla',
        'stabilita':      'rovnováha a pohyb',
        'metabolicke':    'energii a tělo',
        'nervovy_system': 'mozek a hlava'
      };
      return risks[nodeLabel.toLowerCase()] || 'tělo';
    }

    function getNodeContext(nodeId) {
      const contexts = {
        'telo':        'síla a svaly',
        'mysl':        'pozornost a paměť',
        'vyziva':      'strava a energie',
        'zdravi':      'prevence a odolnost',
        'metabolicke': 'metabolismus a rovnováha těla'
      };
      return contexts[nodeId] || '';
    }

    function getNodeLabel(nodeId) {
      const labels = {
        'telo':        'tělo',
        'mysl':        'hlava',
        'vyziva':      'strava',
        'zdravi':      'zdraví',
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

PODŘÍZENÝ UZEL S MEZEROU K SENU (použij pokud je MEZERA_K_SENU v kontextu):
"Pro tvůj sen o [sen] tu [oblast] zatím nestačí — [co konkrétně chybí]."

Doplň jen to co je v hranatých závorkách. Neměň strukturu věty. Nepřidávej nic navíc.

Pokud je k dispozici KONTEXT PROVOKACE, zachovej jeho přímý a faktický tón — žádné cukrování, žádné rady navíc.

JAZYK: Česky, tykání, přímočaré. Max třicet slov celkem. Žádné číslovky – psát slovně.
`;

    const bottleneckLabel = context?.bottleneck || null;

    // Build aspiration block for sub-nodes only
    let aspirationBlock = '';
    if (isSubNode && aspirationData) {
      if (aspirationData.gap > 0.05) {
        aspirationBlock = `SEN: ${aspirationData.label}
MEZERA_K_SENU: ${Math.round(aspirationData.gap * 100)} bodů — použij šablonu PODŘÍZENÝ UZEL S MEZEROU K SENU`;
      } else {
        aspirationBlock = `SEN: ${aspirationData.label}
SEN_SPLNEN: Cíl pro sen dosažen — udržovací tón, bez naléhavosti`;
      }
    }

    const USER_PROMPT = `
REŽIM: ${isSubNode ? 'PODŘÍZENÝ UZEL' : 'HLAVNÍ UZEL'}
UZEL: ${node.label}
STAV: ${node.state || context?.state || 'UNKNOWN'}
${stepProvocation ? `KONTEXT PROVOKACE: "${stepProvocation}"` : ''}
${!isSubNode && bottleneckLabel ? `SLABÝ ČLÁNEK: ${getNodeLabel(bottleneckLabel)}
OHROŽENÍ: ${getRiderRisk(bottleneckLabel)}` : ''}
${isSubNode ? `OBLAST: ${getNodeContext(nodeId)}` : ''}
${aspirationBlock}

Odpověz JEDNOU větou. Napiš jednu větu a skonči.
`.trim();

    // 5️⃣ OpenAI API call
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT }
      ],
      temperature: 0.3,
      max_tokens: 100
    });

    const text = completion.choices[0].message.content;

    console.log("=== RAW TEXT ===");
    console.log(text);
    console.log("=== RAW TEXT END ===");

    const formatted = text.replace(/\.\s+/g, '.\n\n').trim();

    return res.json({
      verdict: formatted,
      usage: {
        prompt_tokens:      completion.usage.prompt_tokens,
        completion_tokens:  completion.usage.completion_tokens,
        total_tokens:       completion.usage.total_tokens
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
