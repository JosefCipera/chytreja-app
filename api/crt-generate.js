// =====================================================
// API ENDPOINT: /api/crt-generate.js
// POST { userId, role }
//
// 1. Načte user_metrics z Supabase
// 2. Pošle Claude strukturovaný prompt
// 3. Claude vrátí CRT jako JSON
// 4. Auto-pozicování uzlů z level+branch
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const DEKATLON_NODE_IDS = ['sila','stabilita','vo2max','kardio','mobilita','vytrvalost','rovnovaha','plyometrie','dychani'];
const LEHKOST_NODE_IDS  = ['vyziva','kardio','spanek','mysl'];

// Auto-pozicování: level + branch → x, y
// Strom se od kořene (y=0) rozevírá nahoru (větší y = vyšší úroveň)
function calcPositions(nodes) {
  const levels = [...new Set(nodes.map(n => n.level ?? 0))].sort((a,b) => a-b);
  const maxLevel = Math.max(...levels);
  const Y_STEP = 130;
  const X_BASE = 280;

  nodes.forEach(n => {
    const lv = n.level ?? 0;
    // x: větve se sbíhají ke středu s rostoucí úrovní
    const spread = X_BASE * (1 - lv / (maxLevel + 1) * 0.4);
    if (n.branch === 'L') n.x = -spread;
    else if (n.branch === 'R') n.x = spread;
    else n.x = 0; // C (center) — root, junction, UDE
    n.y = lv * Y_STEP;
  });
  return nodes;
}

async function fetchUserMetrics(userId, role) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from('user_metrics')
    .select('node_id, state, current_index')
    .eq('user_id', userId)
    .eq('universe', 'longevity')
    .in('state', ['RED', 'YELLOW', 'GREEN']);

  if (role === 'dekatlon') query = query.in('node_id', DEKATLON_NODE_IDS);
  else if (role === 'lehkost') query = query.in('node_id', LEHKOST_NODE_IDS);

  const { data } = await query;
  return data || [];
}

async function generateCRT(metrics, role) {
  // Seřaď uzly od nejhoršího
  const sorted = [...metrics].sort((a, b) => (a.current_index ?? 100) - (b.current_index ?? 100));
  const worstNodes = sorted.slice(0, 6).map(m => ({
    id: m.node_id,
    state: m.state,
    score: m.current_index > 1 ? Math.round(m.current_index) : Math.round(m.current_index * 100),
  }));

  const roleContext = role === 'dekatlon'
    ? 'Uživatel trénuje Dekatlon dlouhověkosti (9 fyzických disciplín).'
    : role === 'lehkost'
    ? 'Uživatel pracuje na hubnutí a lehčím životním stylu.'
    : 'Uživatel pracuje na dlouhověkosti a celkovém zdraví.';

  const metricsText = worstNodes.map(n =>
    `- ${n.id}: ${n.state} (${n.score}%)`
  ).join('\n');

  const systemPrompt = `Jsi expert na Theory of Constraints (Goldratt) a medicínu.
Analyzuješ zdravotní data uživatele a sestavuješ Current Reality Tree (CRT) — kauzální strom příčin a důsledků.

Vrátíš POUZE validní JSON (bez markdown bloků, bez komentářů) v přesném formátu:
{
  "root": { "id": "root", "label": "Kořenová příčina (max 4 slova)", "node_id": null },
  "nodes": [
    { "id": "L1", "label": "Uzel (max 4 slova)", "type": "cause", "node_id": "kardio", "level": 1, "branch": "L" }
  ],
  "edges": [{ "from": "root", "to": "L1" }],
  "and_joins": [{ "sources": ["C1","C2"], "target": "S1" }],
  "injections": [{ "label": "Konkrétní akce", "node_id": "kardio" }]
}

Pravidla pro strukturu:
- root: type="golden_box", level=0, branch="C" — nejhlubší příčina (Single Root Cause)
- nodes: level 1–5, branch L (levá větev) nebo R (pravá větev), C (střed — junction/UDE)
- type: "cause" (příčina), "junction" (spojení dvou příčin), "ude" (nežádoucí důsledek — symptom)
- UDE uzly (type=ude): nejvyšší level, branch=C — to co uživatel CÍTÍ jako problém
- and_joins: jen kde dva uzly SPOLEČNĚ způsobují třetí
- injections: 2–3 konkrétní akce které přeruší kauzální řetěz
- node_id: CHJ uzel pokud existuje (kardio/mysl/vyziva/spanek/dlouhovekost), jinak null
- Labely v češtině, max 4 slova, bez diakritiky není nutné

Topologie — čistý strom BEZ křížení:
- Levá větev (L): příčiny z metabolického/cévního subsystému
- Pravá větev (R): příčiny z autonomního/nervového subsystému
- Větve se spojí v junction uzlech, pak pokračují jako UDE`;

  const userPrompt = `${roleContext}

Změřené zdravotní uzly (od nejhoršího):
${metricsText || '(žádná data — vytvoř obecný strom pro daný kontext)'}

Sestav CRT: najdi jednu kořenovou příčinu, dvě kauzální větve (L a R), junction uzly kde se větve sbíhají, a 1–2 UDE nahoře.
Strom musí mít 8–11 uzlů celkem (root + nodes). Vrať pouze JSON.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() ?? '';

  // Parse JSON — Claude by měl vrátit čistý JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude nevrátil validní JSON');
  return JSON.parse(jsonMatch[0]);
}

// Overlay barev z user_metrics
function overlayColors(nodes, metrics) {
  const STATE_COLOR = {
    RED:    { bg: '#3d1a1a', border: '#e05252', text: '#f5a0a0' },
    YELLOW: { bg: '#3a2e0a', border: '#d4a017', text: '#f0d060' },
    GREEN:  { bg: '#0f2d1a', border: '#3a9e5f', text: '#6ddb99' },
    GRAY:   { bg: '#1a2535', border: '#3a5068', text: '#8ba8b8' },
  };
  const metricsMap = {};
  metrics.forEach(m => { metricsMap[m.node_id] = m; });

  return nodes.map(n => {
    const m = n.node_id ? metricsMap[n.node_id] : null;
    let state = m?.state;
    if (!state && m?.current_index != null) {
      const idx = m.current_index > 1 ? m.current_index : m.current_index * 100;
      state = idx <= 0 ? 'GRAY' : idx <= 40 ? 'RED' : idx <= 70 ? 'YELLOW' : 'GREEN';
    }
    state = state || 'GRAY';
    return { ...n, _state: state, _index: m?.current_index ?? null };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, role = 'longevity' } = req.body || {};

  try {
    // 1. Načti metriky
    const metrics = userId ? await fetchUserMetrics(userId, role) : [];
    console.log(`[CRT] generate for userId=${userId} role=${role} metrics=${metrics.length}`);

    // 2. Claude vygeneruje strom
    const crt = await generateCRT(metrics, role);

    // 3. Sestav seznam všech uzlů
    const allNodes = [
      { ...crt.root, type: 'golden_box', level: 0, branch: 'C' },
      ...(crt.nodes || []),
    ];

    // 4. Auto-pozicování
    calcPositions(allNodes);

    // 5. Overlay barev
    const coloredNodes = overlayColors(allNodes, metrics);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      title:      'Kauzální mapa zdraví',
      subtitle:   'Current Reality Tree — generováno z vašich dat',
      nodes:      coloredNodes,
      edges:      crt.edges || [],
      and_joins:  crt.and_joins || [],
      injections: crt.injections || [],
      has_data:   metrics.length > 0,
    });

  } catch (e) {
    console.error('[CRT] generate error:', e.message);
    res.status(500).json({ error: 'CRT generation failed', detail: e.message });
  }
}
