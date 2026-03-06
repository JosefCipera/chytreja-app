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
    stabilita: { required_level: 0.85, importance_weight: 0.9 },
    sila: { required_level: 0.75, importance_weight: 0.8 },
    telo: { required_level: 0.70, importance_weight: 0.75 },
    kardio: { required_level: 0.80, importance_weight: 0.85 },
    vo2max: { required_level: 0.75, importance_weight: 0.85 },
    mysl: { required_level: 0.70, importance_weight: 0.65 },
    vyziva: { required_level: 0.75, importance_weight: 0.70 },
    zdravi: { required_level: 0.70, importance_weight: 0.70 },
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
      requiredLevel = Number(requirement.required_level);
      importanceWeight = Number(requirement.importance_weight);
    } else {
      const fallback = BEZKY_V_85.requirements[nodeId];
      if (!fallback) return null;
      requiredLevel = fallback.required_level;
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
      label: aspirationLabel,
      requiredLevel,
      importanceWeight,
      currentLevel,
      gap,
      achieved: gap !== null ? gap <= 0.02 : null
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

    // ✅ Stavy 4 hlavních dětí pro Hra o život (jezdci)
    const RIDER_MAP = {
      'telo':    'srdce',
      'mysl':    'mozku',
      'vyziva':  'metabolismu',
      'zdravi':  'rakoviny'
    };

    let ridersText = '';
    if (nodeId === 'dlouhovekost') {
      const { data: childMetrics } = await supabase
        .from('user_metrics')
        .select('node_id, state')
        .eq('user_id', userId)
        .eq('universe', 'longevity')
        .in('node_id', ['telo', 'mysl', 'vyziva', 'zdravi']);

      const stateMap = Object.fromEntries((childMetrics || []).map(m => [m.node_id, m.state]));

      // 1. RED děti → jezdci, max 2
      let candidates = Object.keys(RIDER_MAP).filter(id => stateMap[id] === 'RED');
      // 2. Pokud žádné RED → YELLOW
      if (candidates.length === 0) {
        candidates = Object.keys(RIDER_MAP).filter(id => stateMap[id] === 'YELLOW');
      }
      // 3. Fallback → bottleneck node
      if (candidates.length === 0 && context?.bottleneck) {
        candidates = [context.bottleneck];
      }

      const riders = candidates.slice(0, 2).map(id => RIDER_MAP[id] || id);
      ridersText = riders.length === 2
        ? `${riders[0]} a ${riders[1]}`
        : riders[0] || '';
    }

    // ✅ Aspiration fetch (null for main node)
    const aspirationData = await fetchAspirationData(supabase, userId, nodeId);

    // ✅ Aspirace label pro hlavní uzel (jen label, bez gap výpočtu)
    let mainNodeAspirationLabel = null;
    if (nodeId === 'dlouhovekost') {
      const { data: userAsp } = await supabase
        .from('user_aspirations')
        .select('aspiration_label')
        .eq('user_id', userId)
        .maybeSingle();
      mainNodeAspirationLabel = userAsp?.aspiration_label || BEZKY_V_85.label;
    }

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

      // Fetch user profile (age, gender)
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('age, gender')
        .eq('user_id', userId)
        .maybeSingle();

      const genderLabel = userProfile?.gender === 'male' ? 'muž'
        : userProfile?.gender === 'female' ? 'žena'
        : null;
      const profileLine = [
        userProfile?.age ? `věk ${userProfile.age} let` : null,
        genderLabel
      ].filter(Boolean).join(', ');

      // Fetch user constraints (injuries + body limits)
      const { data: constraints } = await supabase
        .from('user_constraints')
        .select('constraint_type, constraint_key, constraint_value, severity')
        .eq('user_id', userId);

      const INJURY_SUBS = {
        knee: {
          label:  'koleno',
          avoid:  'dřepy, výpady, kliky na kolenou, běh',
          use:    'plávání nebo rotoped 3x týdně po 30 minutách; stroj na nohy (tlak nohama)',
        },
        back_lower: {
          label:  'záda',
          avoid:  'mrtvé tahy, předklony s váhou, sed-lehy',
          use:    'každý den 10 minut: prkno (statická výdrž) a střídavé zvedání paže a nohy vleže',
        },
        shoulder: {
          label:  'rameno',
          avoid:  'tlaky nad hlavu, shyby, tlak na lavičce',
          use:    'odporová gumička 3x týdně: kroužení ramenem a protahování, 2x10 opakování',
        },
        hip: {
          label:  'kyčel',
          avoid:  'hluboké dřepy, výpady, kopání',
          use:    'plávání nebo rotoped 3x týdně po 30 minutách; protahování kyčlí vleže každý den',
        },
      };
      const SEVERITY_LABELS = { mild: 'mírně', moderate: 'středně', severe: 'závažně' };

      const injuryLines = (constraints || [])
        .filter(c => c.constraint_type === 'injury')
        .map(c => {
          const sub = INJURY_SUBS[c.constraint_key];
          if (!sub) return null;
          const sev = SEVERITY_LABELS[c.severity] || c.severity;
          return `${sub.label} (${sev}): vyhni se — ${sub.avoid}; místo toho — ${sub.use}`;
        })
        .filter(Boolean);

      const WAIST_LIMIT = userProfile?.gender === 'female' ? 80 : 94;
      const bodyLimits = (constraints || [])
        .filter(c => c.constraint_type === 'body')
        .map(c => {
          if (c.constraint_key === 'waist_cm') {
            const val = parseInt(c.constraint_value);
            const over = val - WAIST_LIMIT;
            return over > 0
              ? `obvod pasu ${val} cm (o ${over} cm nad zdravou hranicí ${WAIST_LIMIT} cm) → snižuj kalorický příjem o 300 kcal denně`
              : `obvod pasu ${val} cm (v normě)`;
          }
          return `${c.constraint_key}: ${c.constraint_value}`;
        });

      const constraintsLine = [
        ...injuryLines,
        ...bodyLimits,
      ].filter(Boolean).join('\n');

      // Evidence block — jen pro vysvětlení (když přichází chjVerdict)
      let evidenceBlock = '';
      if (context?.chjVerdict) {
        const NODE_LABELS = {
          telo: 'Tělo', mysl: 'Mysl', vyziva: 'Výživa',
          zdravi: 'Zdraví', metabolicke: 'Metabolismus'
        };
        const MAIN_CHILDREN = ['telo', 'mysl', 'vyziva', 'zdravi', 'metabolicke'];

        const { data: allMetrics } = await supabase
          .from('user_metrics')
          .select('node_id, state, current_index')
          .eq('user_id', userId)
          .eq('universe', 'longevity')
          .in('node_id', MAIN_CHILDREN);

        if (allMetrics?.length) {
          const redNodes    = allMetrics.filter(m => m.state === 'RED')
            .sort((a, b) => a.current_index - b.current_index);
          const yellowNodes = allMetrics.filter(m => m.state === 'YELLOW')
            .sort((a, b) => a.current_index - b.current_index);

          const stateLines = MAIN_CHILDREN
            .map(id => {
              const m = allMetrics.find(m => m.node_id === id);
              return m ? `${NODE_LABELS[id]}: ${m.state}` : null;
            })
            .filter(Boolean);

          const bottleneckNodes = redNodes.length ? redNodes : yellowNodes;
          const bottleneckLabel = bottleneckNodes.slice(0, 2)
            .map(m => NODE_LABELS[m.node_id]).join(' a ');

          evidenceBlock += `Stav oblastí: ${stateLines.join(', ')}.`;
          if (bottleneckLabel) evidenceBlock += ` Největší problém: ${bottleneckLabel}.`;
        }

        if (injuryLines.length) {
          const injuryRationale = injuryLines.map(l => {
            // "koleno (závažně): vyhni se — X; místo toho — Y" → "kvůli kolenu místo X → Y"
            const match = l.match(/^(.+?) \(.+?\): vyhni se — (.+?); místo toho — (.+)$/);
            return match ? `Kvůli ${match[1]} vynecháváme ${match[2].split(',')[0]} a nahrazujeme ${match[3].split(';')[0]}` : l;
          }).join('. ');
          evidenceBlock += ` ${injuryRationale}.`;
        }

        if (bodyLimits.length) {
          evidenceBlock += ` ${bodyLimits.join(', ')}.`;
        }

        const asp = aspirationData || (nodeId === 'dlouhovekost' && mainNodeAspirationLabel
          ? { label: mainNodeAspirationLabel } : null);
        if (asp?.label) {
          evidenceBlock += ` Cíl: ${asp.label}${asp.gap > 0.05 ? ' — zatím mimo dosah' : ''}.`;
        }
      }

      const CONVO_SYSTEM = `Jsi Chytré Já — osobní kouč pro dlouhověkost.

Uživatel se tě může ptát na cokoliv, ale ty si vybíráš, jak odpovíš.
Vždy směřuj hovor k dlouhověkosti a aktuálnímu uzlu.${aspirationContext}
Odpovídej česky, tykej, buď přímý a konkrétní.
Pokud se ptají na akce nebo cvičení: napiš přesně 2-3 konkrétní kroky jako číslovaný seznam, každý max 10 slov. U každého kroku uveď konkrétní číslo (minuty, počet týdně, kcal).
Jinak max dvě věty.
Nezačínaj větou "Rozumím" ani "Samozřejmě". Nepřidávej rady nesouvisející s uzlem.
Zakázaná slova: "musíš", "je důležité", "měl bys", "hrozí", "ohrožuje", "samostatnost".
${constraintsLine ? `OMEZENÍ — striktně respektuj, navrhuj jen konkrétní náhrady:\n${constraintsLine}` : ''}`.trim();

      const CONVO_USER = `Uzel: ${node.label} (stav: ${node.state || context?.state || 'neznámý'})
${profileLine ? `Profil: ${profileLine}` : ''}
${context?.chjVerdict ? `Hodnocení CHJ: "${context.chjVerdict}"` : ''}
${evidenceBlock ? `Evidence:\n${evidenceBlock}` : constraintsLine ? `Omezení:\n${constraintsLine}` : ''}
${stepProvocation ? `Kontext: "${stepProvocation}"` : ''}
Dotaz uživatele: ${userQuestion}`;

      const convoCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: CONVO_SYSTEM },
          { role: "user", content: CONVO_USER }
        ],
        temperature: 0.7,
        max_tokens: 280
      });

      return res.json({
        verdict: convoCompletion.choices[0].message.content.trim()
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    function getRiderRisk(nodeLabel) {
      const risks = {
        'kardio': 'srdce',
        'vo2max': 'kondice a srdce',
        'síla': 'pohyb a síla',
        'stabilita': 'rovnováha a pohyb',
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

ODPOVÍDEJ PŘESNĚ PODLE ŠABLONY. Čísla piš slovně.

HLAVNÍ UZEL (HRA O ŽIVOT):
Napiš DVĚ věty. Max čtyřicet pět slov celkem.

Věta 1 — baterie + jezdci:
Pokud je JEZDCI vyplněno:
- RED: "Tvoje baterie je skoro vybitá — to nahrává onemocněním [jezdci]."
- YELLOW: "Tvoje baterie není plně nabitá — nahrává to onemocněním [jezdci]."
- GREEN: "Tvoje baterie je nabitá, drž to takhle."
Pokud JEZDCI chybí:
- RED: "Tvoje baterie je skoro vybitá, bez změny to půjde dolů."
- YELLOW: "Tvoje baterie není plně nabitá, ale celkově to jde správným směrem."
- GREEN: "Tvoje baterie je nabitá, drž to takhle."
Hodnota [jezdci] = obsah pole JEZDCI — dosaď přesně tak jak je, neskloňuj, neměň.

Věta 2 — sen:
Pokud je SEN vyplněno:
- RED: "Na [sen] se takhle nepostavíš a ztratíš [co tím přijdeš o]."
- YELLOW: "K [snu] ti ještě kus schází, ale je čas to změnit."
- GREEN: "[Sen] si splníš."
Pokud SEN chybí:
- RED nebo YELLOW: "A přijdeš o to, nač se těšíš."
- GREEN: (druhou větu vynech)
Hodnota [sen] = obsah pole SEN, čísla piš slovně, použij vhodný pád.

PODŘÍZENÝ UZEL (bez aspirace nebo SEN_SPLNEN):
- RED: "Tvoje [oblast] nestačí — [co to znamená pro tělo]."
- YELLOW: "Tvoje [oblast] není špatná, ale [co konkrétně slábne]."
- GREEN: "Tvoje [oblast] je v pořádku."

PODŘÍZENÝ UZEL S MEZERA_K_SENU:
- RED: "[Oblast] nestačí — na [sen] se takhle nepostavíš."
- YELLOW: "[Oblast] zaostává — k [snu] ti ještě kus schází."
Příklad RED pro oblast "síla a svaly" a sen "Běžky v 85": "Síla a svaly nestačí — na běžky v pětaosmdesáti se takhle nepostavíš."
Hodnota [sen] = obsah pole SEN, čísla piš slovně, použij vhodný pád.

Doplň jen obsah v hranatých závorkách. Neměň strukturu věty. Nepřidávej nic navíc.

ZAKÁZANÁ SLOVA: musíš, okamžitě, je důležité, měl bys, hrozí, ohrožuje, samostatnost, závislý, pomoc druhých, špatně, trpí, Dobrá zpráva je.
JAZYK: Česky, tykej, přímočaře.
`.trim();

    const bottleneckLabel = context?.bottleneck || null;

    // Build aspiration block for sub-nodes only
    let aspirationBlock = '';
    if (isSubNode && aspirationData) {
      if (aspirationData.gap > 0.05) {
        aspirationBlock = `SEN: ${aspirationData.label}
MEZERA_K_SENU: ano`;
      } else {
        aspirationBlock = `SEN: ${aspirationData.label}
SEN_SPLNEN: ano`;
      }
    }
    console.log('ASPIRATION BLOCK:', aspirationBlock);
    const USER_PROMPT = `
REŽIM: ${isSubNode ? 'PODŘÍZENÝ UZEL' : 'HLAVNÍ UZEL'}
UZEL: ${node.label}
STAV: ${node.state || context?.state || 'UNKNOWN'}
${stepProvocation ? `KONTEXT PROVOKACE: "${stepProvocation}"` : ''}
${!isSubNode && ridersText ? `JEZDCI: ${ridersText}` : ''}
${!isSubNode && mainNodeAspirationLabel ? `SEN: ${mainNodeAspirationLabel}` : ''}
${isSubNode ? `OBLAST: ${getNodeContext(nodeId)}` : ''}
${aspirationBlock}
`.trim();

    // 5️⃣ OpenAI API call
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT }
      ],
      temperature: 0.3,
      max_tokens: 130
    });

    const text = completion.choices[0].message.content;

    console.log("=== RAW TEXT ===");
    console.log(text);
    console.log("=== RAW TEXT END ===");

    const formatted = text.replace(/\.\s+/g, '.\n\n').trim();

    return res.json({
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
