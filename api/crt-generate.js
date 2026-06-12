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
  const X_BASE = 320; // širší pro 3 větve

  nodes.forEach(n => {
    const lv = n.level ?? 0;
    const spread = X_BASE * (1 - lv / (maxLevel + 1) * 0.35);
    if (n.branch === 'L') n.x = -spread;
    else if (n.branch === 'R') n.x = spread;
    else if (n.branch === 'LC') n.x = -spread * 0.5; // střední-levá (fyzická větev)
    else n.x = 0; // C — root, junction, UDE
    n.y = lv * Y_STEP;
  });
  return nodes;
}

async function fetchContext(userId, role) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Metriky uzlů
  let q = supabase
    .from('user_metrics')
    .select('node_id, state, current_index')
    .eq('user_id', userId)
    .eq('universe', 'longevity')
    .in('state', ['RED', 'YELLOW', 'GREEN']);
  if (role === 'dekatlon') q = q.in('node_id', DEKATLON_NODE_IDS);
  else if (role === 'lehkost') q = q.in('node_id', LEHKOST_NODE_IDS);
  const { data: metrics } = await q;

  // 2. Zdravotní profil (diagnózy, léky, labs)
  const { data: profile } = await supabase
    .from('user_health_profile')
    .select('diagnoses, medications, labs, physical, goal_text, doctor_notes, birth_year, sex')
    .eq('user_id', userId)
    .single();

  // 3. Poslední check-in (energie, spánek, stres)
  const today = new Date().toISOString().slice(0, 10);
  const { data: checkins } = await supabase
    .from('daily_checkin')
    .select('energy, sleep_hours, stress, binge, movement_level, weight_kg, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(7);

  // 4. Onboarding odpovědi (fyzické limity, node_inputs)
  const { data: nodeInputs } = await supabase
    .from('node_inputs')
    .select('node_id, question_id, value')
    .eq('user_id', userId);

  return {
    metrics: metrics || [],
    profile: profile || {},
    checkins: checkins || [],
    nodeInputs: nodeInputs || [],
  };
}

// Lidsky čitelné popisky CHJ uzlů pro Opus
const NODE_LABELS = {
  telo:          'Fyzická kondice (síla, pohyb, mobilita)',
  kardio:        'Kardiovaskulární kondice (srdce, oběh)',
  dychani:       'Dýchání a okysličení',
  sila:          'Svalová síla',
  mobilita:      'Pohyblivost a flexibilita',
  stabilita:     'Stabilita a rovnováha',
  vytrvalost:    'Vytrvalost a výdrž',
  plyometrie:    'Výbušnost a rychlost',
  rovnovaha:     'Rovnováha',
  mysl:          'Mentální zdraví (stres, emoce, focus)',
  stres:         'Chronický stres',
  vyziva:        'Výživa a stravování',
  spanek:        'Spánek a regenerace',
  zdravi:        'Celkové zdraví',
  metabolicke:   'Metabolické zdraví',
  nervovy_system:'Nervový systém',
  dlouhovekost:  'Dlouhověkost (celkový stav)',
};

async function generateCRT({ metrics, profile, checkins, nodeInputs }, role) {
  // Seřaď uzly od nejhoršího — vezmi všechny RED a YELLOW
  const sorted = [...metrics].sort((a, b) => (a.current_index ?? 100) - (b.current_index ?? 100));
  const worstNodes = sorted
    .filter(m => m.state === 'RED' || m.state === 'YELLOW')
    .slice(0, 8)
    .map(m => ({
      id: m.node_id,
      label: NODE_LABELS[m.node_id] || m.node_id,
      state: m.state,
      score: m.current_index > 1 ? Math.round(m.current_index) : Math.round(m.current_index * 100),
    }));

  const roleContext = role === 'dekatlon'
    ? 'Uživatel trénuje Dekatlon dlouhověkosti (9 fyzických disciplín).'
    : role === 'lehkost'
    ? 'Uživatel pracuje na hubnutí a lehčím životním stylu.'
    : 'Uživatel pracuje na dlouhověkosti a celkovém zdraví.';

  const metricsText = worstNodes.length
    ? worstNodes.map(n => `- ${n.label}: ${n.state} (${n.score}%)`).join('\n')
    : '(žádná data ze skóre)';

  // Zdravotní profil
  const diagText   = (profile.diagnoses   || []).join(', ') || 'neuvedeno';
  const medsText   = (profile.medications || []).map(m => `${m.name} ${m.dose || ''}`).join(', ') || 'neuvedeno';
  const labsObj    = profile.labs || {};
  const labsText   = Object.entries(labsObj)
    .filter(([k]) => k !== 'date')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'neuvedeno';
  const goalText   = profile.goal_text || 'neuvedeno';
  const doctorText = profile.doctor_notes ? `\nPoznámky od lékaře:\n${profile.doctor_notes.slice(0, 800)}` : '';

  // Poslední check-in (průměr posledních 7 dní)
  const checkinText = checkins.length
    ? checkins.slice(0, 3).map(c =>
        `${c.date}: energie ${c.energy}/5, spánek ${c.sleep_hours}h, stres ${c.stress}/5${c.binge ? ', přejedení' : ''}`
      ).join('\n')
    : 'žádné záznamy';

  const metricsText2 = metricsText;

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
- Labely v češtině: PRIMÁRNĚ srozumitelně pro laika (co člověk cítí nebo zná z běžného života)
  Odborný termín pouze pokud je diagnóza přímo z profilu uživatele (např. "Fibrilace síní FaP").
  Příklady: "Ztuhlé cévy" ne "Arteroskleróza", "Slabý srdeční rytmus" ne "Arytmie",
  "Únava po pohybu" ne "Snížená aerobní kapacita". Max 4 slova.

Topologie — čistý strom BEZ křížení, TŘI větve:
- Levá větev (L): příčiny z metabolického/cévního subsystému (LDL, cévy, zánět)
- Pravá větev (R): příčiny z autonomního/nervového subsystému (stres, sympatikus, HRV)
- Střední větev (C) pod kořenem: fyzická kondice (pohyb, aerobní kapacita, svalová síla)
  → fyzická dekondice zvyšuje zátěž srdce a zhoršuje obě ostatní větve
- Všechny tři větve se sbíhají v junction uzlech před hlavním UDE`;

  const userPrompt = `${roleContext}

ZDRAVOTNÍ PROFIL:
- Diagnózy: ${diagText}
- Léky: ${medsText}
- Labs: ${labsText}
- Cíl: ${goalText}${doctorText}

SKÓRE UZLŮ (od nejhoršího):
${metricsText2}

POSLEDNÍ CHECK-INY:
${checkinText}

Na základě diagnóz a dat sestav CRT: najdi jednu kořenovou příčinu, dvě kauzální větve (L a R), junction uzly kde se větve sbíhají, a 1–2 UDE nahoře.

Pravidla pro UDE:
- Nejvyšší UDE je hlavní diagnóza uživatele kterou AKTUÁLNĚ prožívá (např. Fibrilace síní FaP)
- Cíl (goal_text) do CRT NEPATŘÍ — patří do Goal Tree, ne do Current Reality
- Extrasystoly jsou junction uzel těsně pod FaP (type=junction), ne UDE
- Hypertenze je příčina (type=cause), ne UDE

Pravidla pro injections:
- PRVNÍ injections jsou vždy léky z profilu uživatele (Torvacard, Pradaxa, Kalnormin...)
- Pak 1–2 životní intervence (pohyb, dech, strava)
- Celkem max 4 injections

Strom musí mít 10–14 uzlů celkem (root + nodes). Vrať pouze JSON.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() ?? '';

  // Parse JSON — Claude by měl vrátit čistý JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude nevrátil JSON. Text: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    throw new Error(`JSON parse error: ${e.message}. Text: ${jsonMatch[0].slice(0, 300)}`);
  }
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

const CRT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, role = 'longevity', force = false } = req.body || {};

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 0. Zkus server-side cache (user_health_profile.crt_cache)
    if (userId && !force) {
      const { data: prof } = await supabase
        .from('user_health_profile')
        .select('crt_cache, crt_cache_at')
        .eq('user_id', userId)
        .single();

      if (prof?.crt_cache && prof?.crt_cache_at) {
        const age = Date.now() - new Date(prof.crt_cache_at).getTime();
        if (age < CRT_CACHE_TTL_MS) {
          console.log(`[CRT] server cache hit (${Math.round(age/60000)}min old)`);
          res.setHeader('Cache-Control', 'no-store');
          return res.json({ ...prof.crt_cache, _cached: true });
        }
      }
    }

    // 1. Načti všechny zdroje dat
    const ctx = userId ? await fetchContext(userId, role) : { metrics: [], profile: {}, checkins: [], nodeInputs: [] };
    console.log(`[CRT] generate userId=${userId} role=${role} metrics=${ctx.metrics.length} profile=${!!ctx.profile.diagnoses}`);

    // 2. Claude vygeneruje strom
    const crt = await generateCRT(ctx, role);

    // 3. Sestav seznam všech uzlů
    const allNodes = [
      { ...crt.root, type: 'golden_box', level: 0, branch: 'C' },
      ...(crt.nodes || []),
    ];

    // 4. Auto-pozicování
    calcPositions(allNodes);

    // 5. Overlay barev (bez barev — jen mapování stavu pro případné budoucí použití)
    const coloredNodes = overlayColors(allNodes, ctx.metrics);

    const result = {
      title:      'Kauzální mapa zdraví',
      subtitle:   'Current Reality Tree — generováno z vašich dat',
      nodes:      coloredNodes,
      edges:      crt.edges || [],
      and_joins:  crt.and_joins || [],
      injections: crt.injections || [],
      has_data:   ctx.metrics.length > 0 || !!ctx.profile.diagnoses,
    };

    // Ulož do server-side cache
    if (userId) {
      await supabase.from('user_health_profile')
        .update({ crt_cache: result, crt_cache_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json(result);

  } catch (e) {
    console.error('[CRT] generate error:', e.message);
    res.status(500).json({ error: 'CRT generation failed', detail: e.message });
  }
}
