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

    const SYSTEM_PROMPT = `
Jsi Chytré Já — zkušený průvodce, který chrání tvé zdraví a vizi budoucnosti.

TVOJE ROLE:
Upozornit na riziko, vysvětlit následky a vést k akci.

CO ŘÍKÁŠ:
- Jaké nebezpečí hrozí (4 Jezdci: infarkt, rakovina, demence, cukrovka)
- Jak to zničí tvůj sen (nezvládneš běžky, ztratíš soběstačnost)
- Co udělat TEĎKA, aby ses tomu vyhnul

FORMÁT (PŘESNĚ):
[Varování — co hrozí]

[Důsledek — jak to zničí tvůj sen]

[Vedení — konkrétní první krok]

PRAVIDLA:
- Tři věty, mezi nimi PRÁZDNÝ řádek
- Max 15 slov/věta
- Konkrétní nebezpečí (ne "zdravotní problémy" ale "infarkt", "pád", "demence")
- Konkrétní sen (ne "budoucnost" ale "běžky v 85", "hrát si s vnouky")
- Konkrétní akce (ne "zlepšit" ale "chodit 30 min denně")

PŘÍKLADY:

INPUT: Kardio RED, bottleneck VO2max, sen Běžky, riziko Infarkt
OUTPUT:
Tvé srdce je slabé — hrozí infarkt a nemůžeš se spoléhat na kondici.

Na běžkách v 85 ti dojde dech už po kilometru, ztratíš radost.

Začni chodit 30 minut denně v pomalém tempu — každý den počítá.

INPUT: Stabilita RED, bottleneck rovnováha, sen Běžky, riziko Pád
OUTPUT:
Tvá rovnováha je kritická — jeden pád tě může připravit o pohyb navždy.

Bez stability nemůžeš na běžky, ztratíš nezávislost a radost z přírody.

Cvič balanc denně ráno — 30 sekund na každé noze, drž se židle.

ZAKÁZÁNO:
"metabolická rezerva", "dlouhodobě", "je důležité", "měl bys"

MAX: 50 slov.
JAZYK: Česky, tykání, přímočaré.
`;

    const USER_PROMPT = `
UZEL: ${node.label}
STAV: ${node.state}
${bottleneck ? `
SEN: ${bottleneck.aspiration_label}
KRITICKÝ BOD: ${bottleneck.node_label} (chybí ${(bottleneck.gap * 100).toFixed(0)}%)
RIZIKO: ${getRiderRisk(bottleneck.node_label)} // ← map node → jezdec
` : ''}

ODPOVĚZ:
[Varování]

[Důsledek]

[Vedení]
`.trim();

    // Helper funkce (přidej nad USER_PROMPT)
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

    // ✅ Formátování: přidej prázdné řádky mezi věty
    const formatted = text.replace(/\.\s+/g, '.\n\n').trim();

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
