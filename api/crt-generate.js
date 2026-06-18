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
  const X_BASE = 320;

  // Group by level+branch to stagger overlapping nodes
  const slots = {};
  nodes.forEach(n => {
    const key = `${n.level ?? 0}_${n.branch ?? 'C'}`;
    (slots[key] = slots[key] || []).push(n);
  });

  nodes.forEach(n => {
    const lv = n.level ?? 0;
    const key = `${lv}_${n.branch ?? 'C'}`;
    const group = slots[key];
    const idx = group.indexOf(n);
    const count = group.length;
    const yOff = count > 1 ? (idx - (count - 1) / 2) * Math.round(Y_STEP * 0.65) : 0;

    const spread = X_BASE * (1 - lv / (maxLevel + 1) * 0.35);
    if (n.branch === 'L') n.x = -spread;
    else if (n.branch === 'R') n.x = spread;
    else if (n.branch === 'LC') n.x = -spread * 0.5;
    else n.x = 0;
    n.y = lv * Y_STEP + yOff;
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

  // 2. Zdravotní profil (diagnózy, labs) + léky z user_medications
  const [{ data: profile }, { data: meds }] = await Promise.all([
    supabase.from('user_health_profile')
      .select('diagnoses, symptoms, family_history, labs, physical, goal_text, doctor_notes, birth_year, sex, medications')
      .eq('user_id', userId).single(),
    supabase.from('user_medications')
      .select('name, dose').eq('user_id', userId).eq('active', true),
  ]);
  if (profile) {
    const profileMeds = (profile.medications || []).map(m => ({ name: typeof m === 'string' ? m : m?.name, dose: m?.dose || '' })).filter(m => m.name);
    const tableMeds   = meds ?? [];
    const seen = new Set(tableMeds.map(m => m.name?.toLowerCase()));
    const merged = [...tableMeds, ...profileMeds.filter(m => !seen.has(m.name?.toLowerCase()))];
    profile.medications = merged;
  }

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

// Pre-processing: přeloží české obchodní názvy léků na INN + mechanismus
async function resolveMedications(meds) {
  if (!meds || meds.length === 0) return [];
  const list = meds.map(m => `${m.name}${m.dose ? ' ' + m.dose : ''}`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 800,

      messages: [{ role: 'user', content:
        `Pro každý lék níže uveď: INN název (účinná látka), farmakologická skupina, a hlavní mechanismus účinku (1 věta česky, max 8 slov).\nVrať POUZE JSON pole, bez komentářů:\n[{"name":"obchodní název","inn":"účinná látka","group":"skupina","effect":"mechanismus"}]\n\nLéky:\n${list}` }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`[CRT] resolveMedications ${res.status}:`, errBody.slice(0, 300));
    return meds.map(m => ({ name: m.name, inn: m.name, group: '', effect: '' }));
  }
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() ?? '[]';
  try {
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}

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

  const universeNodes = role === 'lehkost'
    ? ['lh_main','lh_vyziva','lh_pohyb','lh_mysl','lh_regenerace']
    : ['dlouhovekost','telo','mysl','vyziva','pohyb','regenerace','sila','stabilita','vo2max','kardio','mobilita','vytrvalost','rovnovaha','plyometrie','dychani'];

  const metricsText = worstNodes.length
    ? worstNodes.map(n => `- ${n.label}: ${n.state} (${n.score}%)`).join('\n')
    : '(žádná data ze skóre)';

  // Zdravotní profil
  const diagText     = (profile.diagnoses     || []).join(', ') || 'neuvedeno';
  const sympText     = (profile.symptoms      || []).join(', ') || 'neuvedeno';
  const familyText   = profile.family_history || 'neuvedeno';
  const resolvedMeds = await resolveMedications(profile.medications || []);
  const medsText     = resolvedMeds.length
    ? resolvedMeds.map(m => `${m.name} (${m.inn}${m.effect ? ' — ' + m.effect : ''})`).join(', ')
    : 'neuvedeno';
  const labsObj      = profile.labs || {};
  const labsText     = Object.entries(labsObj)
    .filter(([k]) => k !== 'date')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'neuvedeno';
  const goalText     = profile.goal_text || 'neuvedeno';
  const doctorText   = profile.doctor_notes ? `\nPoznámky od lékaře:\n${profile.doctor_notes.slice(0, 800)}` : '';

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
  "injections": [{ "label": "Konkrétní akce", "node_id": "kardio" }],
  "universe_map": [{ "crt_node_id": "L1", "universe_node": "kardio" }],
  "medications_map": [
    { "name": "Název léku", "targets": ["L1","C2"], "effect": "snižuje LDL", "type": "treatment", "reason": "Proč je lék napojen právě na tento uzel — 1 věta česky pro laika" },
    { "name": "Nolpaza", "targets": ["L1"], "effect": "chrání žaludek", "type": "protects", "reason": "Chrání žaludek před vedlejším účinkem Pradaxy — 1 věta česky" },
    { "name": "Ibuprofen", "targets": ["L1"], "effect": "zvyšuje krvácivost", "type": "warning", "reason": "Kombinace s antikoagulanciem zvyšuje riziko krvácení — 1 věta česky" }
  ]
}

Pravidla pro strukturu:
- root: type="golden_box", level=0, branch="C" — nejhlubší příčina (Single Root Cause)
- nodes: level 1–5, branch L (levá větev) nebo R (pravá větev), C (střed — junction/UDE)
- type: "cause" (příčina), "junction" (spojení dvou příčin), "ude" (nežádoucí důsledek — symptom)
- UDE uzly (type=ude): nejvyšší level, branch=C — to co uživatel CÍTÍ jako problém
- and_joins: jen kde dva uzly SPOLEČNĚ způsobují třetí
- injections: 2–3 konkrétní akce které přeruší kauzální řetěz
- node_id: CHJ uzel pokud existuje (kardio/mysl/vyziva/spanek/dlouhovekost), jinak null
- universe_map: pole objektů {"crt_node_id": "L1", "universe_node": "kardio"} — každý CRT uzel namapuj na nejbližší vesmírový uzel ze seznamu UNIVERSE_NODES níže. Pokud uzel nemá jasný vesmírový protějšek, vynech ho.
- medications_map: Léky z pole "Léky:" výše. Každý lék dostane typ:
  * type="treatment" — lék má PŘÍMÝ farmakologický efekt na uzel (např. statin → LDL). Zahrnout jen léky s přímým efektem.
  * type="protects" — lék je protilek / ochrana k jinému léku v tomto stromě (např. pantoprazol chrání žaludek před Pradaxou). Target = stejný uzel jako chráněný lék. ZAHRNOUT, i když nemá přímý kardiální efekt.
  * type="warning" — lék je riziková kombinace s jiným lékem v tomto stromě (např. ibuprofen zvyšuje krvácivost při antikoagulaci). Target = stejný uzel jako lék se kterým interaguje. ZAHRNOUT jako varování.
  Léky bez jakékoli vazby na léky nebo uzly v tomto CRT VYNECH. Pro každý lék uveď "reason": 1 věta česky pro laika. Efekt: 1–3 slova česky.
- Labely v češtině: PRIMÁRNĚ srozumitelně pro laika (co člověk cítí nebo zná z běžného života)
  Odborný termín pouze pokud je diagnóza přímo z profilu uživatele (např. "Fibrilace síní").
  Příklady: "Ztuhlé cévy" ne "Arteroskleróza", "Slabý srdeční rytmus" ne "Arytmie",
  "Únava po pohybu" ne "Snížená aerobní kapacita".
  Max 5 slov. Label musí být CELÁ srozumitelná věta nebo fráze — nikdy nezkracuj doprostřed.

Topologie — čistý strom BEZ křížení, TŘI větve:
- Levá větev (L): příčiny z metabolického/cévního subsystému (LDL, cévy, zánět, krevní tlak)
- Pravá větev (R): příčiny z autonomního/nervového subsystému (stres, sympatikus, dráždivost)
- Střední větev (C) pod kořenem: fyzická kondice (pohyb, aerobní kapacita, svalová síla)
  → fyzická dekondice zvyšuje zátěž srdce a zhoršuje obě ostatní větve
- Každý uzel patří PŘESNĚ do jedné větve — žádné hrany mezi větvemi L↔R
- Větve se sbíhají POUZE v AND-join uzlech nebo v UDE nahoře
- Sympatikus a dráždivost patří vždy do větve R, krevní tlak vždy do větve L

UNIVERSE_NODES pro universe_map (použij přesně tyto id): UNIVERSE_NODES_PLACEHOLDER

Kauzální řetězce — přesné směry hran (příčina → důsledek):
- LDL → usazeniny v cévách → vysoký krevní tlak → tlak na srdeční stěny (NE: LDL → zátěž srdce přímo)
- fyzická dekondice → vyšší zátěž srdce (střední větev C, samostatná příčina)
- stres → napětí v autonomním systému → dráždivost síní
- Vyšší zátěž srdce je VŽDY způsobena fyzickou dekondicí (větev C), nikdy přímo LDL nebo stresem`;

  const userPrompt = `${roleContext}

ZDRAVOTNÍ PROFIL:
- Diagnózy: ${diagText}
- Symptomy: ${sympText}
- Rodinná anamnéza: ${familyText}
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

Strom musí mít 10–14 uzlů celkem (root + nodes). Vrať pouze JSON.`.replace('UNIVERSE_NODES_PLACEHOLDER', universeNodes.join(', '));

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

// Stabilní hash vstupních dat — změna dat = nový hash = nový graf
function dataHash(ctx) {
  const key = JSON.stringify({
    _v:          9, // bump při změně promptu → invaliduje cache
    diagnoses:   ctx.profile.diagnoses || [],
    medications: (ctx.profile.medications || []).map(m => m.name),
    labs:        ctx.profile.labs || {},
    goal:        ctx.profile.goal_text || '',
    metrics:     ctx.metrics.map(m => `${m.node_id}:${m.state}`).sort(),
  });
  let h = 0;
  for (let i = 0; i < key.length; i++) { h = (Math.imul(31, h) + key.charCodeAt(i)) | 0; }
  return String(h >>> 0);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, role = 'longevity', force = false } = req.body || {};

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Načti všechny zdroje dat
    const ctx = userId ? await fetchContext(userId, role) : { metrics: [], profile: {}, checkins: [], nodeInputs: [] };
    const hash = dataHash(ctx);
    console.log(`[CRT] userId=${userId} role=${role} hash=${hash}`);

    // 0. Zkus server-side cache — platná pokud hash sedí
    if (userId) {
      const { data: prof } = await supabase
        .from('user_health_profile')
        .select('crt_cache, crt_cache_hash')
        .eq('user_id', userId)
        .single();

      if (!force && prof?.crt_cache && prof?.crt_cache_hash === hash) {
        console.log('[CRT] cache hit — data nezměněna');
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ...prof.crt_cache, _cached: true });
      }
    }

    console.log(`[CRT] generuji nový strom (data changed) metrics=${ctx.metrics.length} profile=${!!ctx.profile.diagnoses}`);

    // 2. Claude vygeneruje strom
    const crt = await generateCRT(ctx, role);

    // Post-processing: nahraď odborné/špatné výrazy srozumitelnou češtinou
    const LABEL_FIXES = [
      [/\bdekondice\b/gi,          'nízká kondice'],
      [/\bdekondiční\b/gi,         'kondice'],
      [/\bvysoké stahy\b/gi,       'předčasné stahy'],
      [/\bhigh contractions\b/gi,  'předčasné stahy'],
      [/\barytmie\b/gi,            'nepravidelný rytmus'],
      [/\barteroskleros[ai]s?\b/gi,'ztuhlé cévy'],
      [/\bhypertenze\b/gi,         'vysoký tlak'],
      [/\bdyslipidémie\b/gi,       'vysoký LDL'],
      [/\bsympatikotonie\b/gi,     'přetížený sympatikus'],
    ];
    const fixLabel = s => LABEL_FIXES.reduce((t, [re, v]) => t.replace(re, v), s);
    if (crt.root) crt.root.label = fixLabel(crt.root.label);
    (crt.nodes || []).forEach(n => { n.label = fixLabel(n.label); });
    (crt.injections || []).forEach(n => { n.label = fixLabel(n.label); });

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
      injections:      crt.injections || [],
      medications_map: crt.medications_map || [],
      has_data:        ctx.metrics.length > 0 || !!ctx.profile.diagnoses,
    };

    // Ulož do server-side cache s hashem vstupních dat
    if (userId) {
      await supabase.from('user_health_profile')
        .update({ crt_cache: result, crt_cache_hash: hash, crt_cache_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json(result);

  } catch (e) {
    console.error('[CRT] generate error:', e.message);
    res.status(500).json({ error: 'CRT generation failed', detail: e.message });
  }
}
