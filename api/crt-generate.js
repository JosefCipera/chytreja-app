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
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: '.env.local' });

const _dir = dirname(fileURLToPath(import.meta.url));
const DRUGS_DB   = JSON.parse(readFileSync(join(_dir, '../data/drugs.json'), 'utf8'));
import { resolveInteractionsRxNorm } from './rxnorm.js';
const STATES_ARR = JSON.parse(readFileSync(join(_dir, '../data/crt/longevity-states.json'), 'utf8'));
const STATES_DB  = Object.fromEntries(STATES_ARR.map(s => [s.id, s]));

// ── Modely — měň zde, ne v kódu ──────────────────────────────────────────────
const MODELS = {
  crt:       'claude-sonnet-5',   // generátor CRT stromu (Haiku hallucínoval uzly bez důkazu)
  fallback:  'claude-sonnet-5',   // fallback při safety refusal
  medparse:  'claude-haiku-4-5',  // klasifikace léků — Haiku stačí pro is_supplement boolean
  reassign:  'claude-haiku-4-5',  // reassignment root-only léků (rychlý, levný)
};
// ─────────────────────────────────────────────────────────────────────────────

const DEKATLON_NODE_IDS = ['sila','stabilita','vo2max','kardio','mobilita','vytrvalost','rovnovaha','plyometrie','dychani'];
const LEHKOST_NODE_IDS  = ['vyziva','kardio','spanek','mysl'];

// Uzly aktivované z kapacitního testu (fyzické schopnosti) — nesmí spouštět
// ani rodičovskou inferenci (geriatrické rodiče) ani downstream kaskádu (FALL_RISK...).
// Jsou to listy grafu: popisují symptom, ne kauzální řetěz.
// Uzly z kapacitního testu nesmí dostat geriatrické rodiče přes parent inference
// (MUSCULOSKELETAL_DEG → osteoporóza, klouby…). Kaskáda do typických dětí je OK:
// LOW_VO2MAX → THREATENED_HEALTHSPAN, MUSCLE_WEAKNESS → INSULIN_RESISTANCE.
const CAPACITY_LEAF_NODES = new Set(['MUSCLE_WEAKNESS', 'LOW_VO2MAX']);

// Auto-pozicování: barycenter (skutečná pozice rodiče/dítěte přes edges), ne
// pevné x podle branch nálepky — ta dřív dávala VŠEM uzlům se stejnou
// level+branch identické x (jen -spread/+spread/0), takže se při více uzlech
// v jedné větvi/úrovni vizuálně překrývaly. branch L/R drží sloupec jako kotva,
// C/LC (a cokoliv extra) se vmáčkne do mezery mezi kotvami beze změny.
// Strom se od kořene (y=0) rozevírá nahoru (větší y = vyšší úroveň).
function calcPositions(nodes, edges) {
  const Y_STEP   = 130;
  const BOX_W    = 220;
  const MIN_GAP  = 230; // místo na lék/doplněk pilulky napravo od uzlu
  const MIN_DIST = BOX_W + MIN_GAP;
  const branchRank = { L: 0, LC: 1, C: 1, R: 2 };

  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));
  (edges || []).forEach(e => {
    const from = nodeById[e.from], to = nodeById[e.to];
    if (!from || !to) return;
    (to._parents = to._parents || []).push(e.from);
  });

  const byLevel = {};
  nodes.forEach(n => { const lv = n.level ?? 0; (byLevel[lv] = byLevel[lv] || []).push(n); });
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  const maxPerLevel = Math.max(...Object.values(byLevel).map(g => g.length));
  const X_SPREAD = Math.max(340, Math.ceil((maxPerLevel - 1) * MIN_DIST / 2));

  const TIE_EPS = 1; // uzly se shodným (na px) barycentrem = praví sourozenci (sdílí rodiče)

  const placeGroup = (group) => {
    const count = group.length;
    if (count === 1) {
      const n = group[0];
      n.x = n._bc != null ? n._bc : (n.x ?? 0);
      n.y = (n.level ?? 0) * Y_STEP;
      n._isAnchor = true; // jediná větev v úrovni = triviálně kotva pro děti
      return;
    }
    group.forEach((n, idx) => {
      n.x = n._bc != null ? n._bc : (-X_SPREAD + (idx / (count - 1)) * X_SPREAD * 2);
    });

    // Shlukuj podle SDÍLENÉHO barycentru — uzly se stejným x (= stejný rodič,
    // skuteční sourozenci) tvoří jeden shluk. Uzly s ODLIŠNÝM barycentrem
    // (jiná větev, jiný rodič) tvoří vlastní shluk a vzájemně se vůbec
    // neovlivňují — osa jedné větve se nehýbe kvůli rozvětvení na druhé straně.
    const sorted = [...group].sort((a, b) => a.x - b.x);
    const clusters = [];
    sorted.forEach(n => {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(n.x - last.center) < TIE_EPS) last.nodes.push(n);
      else clusters.push({ center: n.x, nodes: [n] });
    });

    // Shluk s víc uzly (= rozvětvení) → rozestup symetricky kolem společné
    // osy (rodičova x), ne jeden uzel pevně na ose a druhý vystrčený stranou.
    clusters.forEach(c => {
      if (c.nodes.length > 1) {
        // Seřaď sourozence v clusteru podle branchRank → L vždy vlevo od LC/C/R
        c.nodes.sort((a, b) => (branchRank[a.branch ?? 'C'] ?? 1) - (branchRank[b.branch ?? 'C'] ?? 1));
        c.nodes.forEach((node, i) => {
          node.x = c.center + (i - (c.nodes.length - 1) / 2) * MIN_DIST;
        });
      }
    });

    // Kotva = větev (L/R/C/LC) má v této vrstvě JEDEN uzel. Floater = větev
    // má víc uzlů najednou (AND-join kolize, extra uzel). Prompt staví
    // 3 reálné větve (L=cévní, R=nervová, C=fyzická kondice), ne jen 2 +
    // občasný extra — proto se klasifikace dělá podle počtu, ne podle
    // konkrétního písmene.
    const byBranch = {};
    group.forEach(n => { const b = n.branch || '_'; (byBranch[b] = byBranch[b] || []).push(n); });
    group.forEach(n => {
      n.y = (n.level ?? 0) * Y_STEP;
      n._isAnchor = byBranch[n.branch || '_'].length === 1;
    });
  };

  // Jediný průchod shora dolů (jen podle rodičů, žádný bottom-up — viz
  // historie commitů proč bottom-up i jednosměrná kolize obě rozhazovaly úrovně).
  //
  // Kotva (anchor) počítá bc JEN z rodičů, kteří jsou TAKÉ kotvy — floater
  // rodič (extra uzel) ji nesmí odtáhnout z rovného sloupce, jen hrana k němu
  // se ohne. Junction (sám není kotva) chce naopak průměr přes VŠECHNY své
  // kotva-rodiče (to je skutečné spojení větví, žádný floater filtr).
  const bc = (n) => {
    const parentIds = n._parents || [];
    const anchorParents = parentIds.filter(id => nodeById[id]?._isAnchor);
    const ids = anchorParents.length ? anchorParents : parentIds;
    const xs = ids.map(id => nodeById[id]?.x).filter(x => x != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  levels.forEach(lv => {
    const g = byLevel[lv];
    g.forEach(n => { n._bc = bc(n); });
    g.sort((a, b) => (a._bc != null && b._bc != null && a._bc !== b._bc) ? a._bc - b._bc
      : (branchRank[a.branch ?? 'C'] ?? 1) - (branchRank[b.branch ?? 'C'] ?? 1));
    placeGroup(g);
  });

  nodes.forEach(n => { delete n._parents; delete n._bc; });
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

  // 2. Zdravotní profil (diagnózy, labs) + léky + suplementy z user_medications + základní profil
  const [{ data: profile }, { data: meds }, { data: userProfile }] = await Promise.all([
    supabase.from('user_health_profile')
      .select('diagnoses, symptoms, family_history, labs, physical, goal_text, doctor_notes, birth_year, sex, medications, supplements, behavior_flags, lifestyle, capacity')
      .eq('user_id', userId).single(),
    supabase.from('user_medications')
      .select('name, dose').eq('user_id', userId).eq('active', true),
    supabase.from('user_profiles')
      .select('age, gender, height, weight, birth_year')
      .eq('user_id', userId).maybeSingle(),
  ]);
  // Pokud user_health_profile neexistuje (nový uživatel), vytvoř prázdný objekt — jinak se léky z user_medications ztratí
  const profileObj = profile || {};
  if (profileObj && userProfile) {
    if (!profileObj.birth_year && userProfile.birth_year) profileObj.birth_year = userProfile.birth_year;
    if (!profileObj.sex && userProfile.gender) profileObj.sex = userProfile.gender;
    profileObj._height = userProfile.height;
    profileObj._weight = userProfile.weight;
  }
  {
    const profileMeds  = (profileObj.medications || []).map(m => ({ name: typeof m === 'string' ? m : m?.name, dose: m?.dose || '' })).filter(m => m.name);
    const profileSupps = (profileObj.supplements || []).map(s => ({ name: typeof s === 'string' ? s : s?.name, dose: s?.dose || '', _fromDb: 'supplements' })).filter(s => s.name);
    const tableMeds    = meds ?? [];
    const seen = new Set(tableMeds.map(m => m.name?.toLowerCase()));
    const merged = [...tableMeds, ...profileMeds.filter(m => !seen.has(m.name?.toLowerCase()))];
    const seenAll = new Set(merged.map(m => m.name?.toLowerCase()));
    const mergedSupps = profileSupps.filter(s => !seenAll.has(s.name?.toLowerCase()));
    profileObj.medications = [...merged, ...mergedSupps];
  }

  // 3. Poslední check-in (energie, spánek, stres)
  const today = new Date().toISOString().slice(0, 10);
  const { data: checkins } = await supabase
    .from('daily_checkin')
    .select('energy, sleep_hours, stress, binge, movement_level, weight_kg, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(14); // 14 dní pro průměr spánku → SLEEP_DISORDER

  // 4. Onboarding odpovědi (fyzické limity, node_inputs)
  const { data: nodeInputs } = await supabase
    .from('node_inputs')
    .select('node_id, question_id, value')
    .eq('user_id', userId);

  return {
    metrics: metrics || [],
    profile: profileObj,
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
async function haiku(prompt, maxTokens = 800, model = MODELS.reassign) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Haiku ${res.status}`);
  return (await res.json()).content?.[0]?.text?.trim() ?? '';
}

async function resolveMedications(meds) {
  if (!meds || meds.length === 0) return { meds: [], interactions: [] };

  // 1. Dictionary lookup — deterministické, bez AI
  const resolved = [];
  const unknown  = [];
  meds.forEach(m => {
    const key   = (m.name || '').toLowerCase().trim();
    const entry = DRUGS_DB[key];
    if (entry) {
      resolved.push({ name: m.name, ...entry });
    } else {
      unknown.push(m);
    }
  });

  // 2. Sonnet fallback pouze pro neznámé léky
  if (unknown.length) {
    const list = unknown.map(m => `${m.name}${m.dose ? ' ' + m.dose : ''}`).join('\n');
    try {
      const text = await haiku(
        `Jsi farmakologický asistent. Pro každý lék vrať JSON.\nPole: inn, group, effect (česky max 7 slov — co lék DĚLÁ pro člověka, BEZ medicínských termínů, laicky jako pro babičku; např. "snižuje bolest", "pomáhá spát", "uklidňuje srdce", "snižuje cukr v krvi"), primary_indication (česky, diagnóza/stav), companion_for (název léku ke kterému je ochranou, nebo null), is_supplement (true jen volně prodejné vitamíny/minerály).\nVrať POUZE JSON pole:\n[{"name":"...","inn":"...","group":"...","effect":"...","primary_indication":"...","companion_for":null,"is_supplement":false}]\n\nLéky:\n${list}`,
        1200, MODELS.medparse
      );
      const m = text.match(/\[[\s\S]*\]/);
      if (m) resolved.push(...JSON.parse(m[0]));
    } catch (e) { console.warn('[CRT] drug resolve fallback failed:', e.message); }
  }

  // 3. Interakce — deterministické z DRUGS_DB (bez AI)
  // Vynech záměrné terapeutické kombinace: PPI + antikoagulant (gastroprotekce)
  const intentionalPairs = new Set(['inhibitor protonové pumpy|antikoagulancium', 'antikoagulancium|inhibitor protonové pumpy']);
  const allMedKeys = meds.map(m => (m.name || '').toLowerCase().trim()).filter(Boolean);
  const interactions = [];
  const seenPairs = new Set();
  meds.forEach(m => {
    const keyA = (m.name || '').toLowerCase().trim();
    const dbA  = DRUGS_DB[keyA];
    if (!dbA?.interacts_with) return;
    dbA.interacts_with.forEach(keyB => {
      if (!allMedKeys.includes(keyB)) return;
      const pairKey = [keyA, keyB].sort().join('|');
      if (seenPairs.has(pairKey)) return;
      // Vynech záměrné terapeutické páry
      const dbB = DRUGS_DB[keyB];
      const groupPair = [dbA.group || '', dbB?.group || ''].join('|');
      if (intentionalPairs.has(groupPair)) return;
      seenPairs.add(pairKey);
      const note = dbA.interaction_note || (dbB?.interaction_note) || `Interakce: ${m.name} + ${keyB}`;
      const medB = meds.find(x => (x.name || '').toLowerCase().trim() === keyB);
      interactions.push({ drugs: [m.name, medB?.name || keyB], note });
    });
  });

  console.log(`[CRT] léky: ${resolved.length} (${unknown.length} neznámých), interakce: ${interactions.length}`);
  return { meds: resolved, interactions };
}

async function callGPT4o(systemPrompt, userPrompt, modelCfg) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelCfg.id,
      max_completion_tokens: modelCfg.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`GPT-4o ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  const usage = data.usage || {};
  const text  = data.choices?.[0]?.message?.content?.trim() ?? '';
  console.log(`[CRT] model=${modelCfg.id} finish=${data.choices?.[0]?.finish_reason} tokens: input=${usage.prompt_tokens} output=${usage.completion_tokens}`);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`GPT-4o nevrátil JSON. Text: ${text.slice(0, 300)}`);
  try { return JSON.parse(jsonMatch[0]); }
  catch(e) {
    const cleaned = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

// ── Keyword → State Dictionary ID mapping ────────────────────────────────────
const DIAGNOSIS_KEYWORDS = [
  { keywords: ['inflammaging', 'věkem podmíněný zánět', 'chronický zánět stárnutí'],              id: 'INFLAMMAGING' },
  { keywords: ['stres', 'stress', 'vyhoření', 'burnout', 'napětí', 'úzkost', 'anxiet'],          id: 'CHRONIC_STRESS' },
  { keywords: ['obezita', 'nadváha', 'obese', 'overweight'],                                      id: 'OBESITY' },
  { keywords: ['cholesterol', 'dyslipid', 'ldl', 'lipid'],                                        id: 'DYSLIPIDEMIA' },
  { keywords: ['hypertenze', 'hypertension', 'vysoký tlak'],                                      id: 'HYPERTENSION' },
  { keywords: ['hypothyreóza', 'hypothyroid', 'hypothyreoz', 'štítná žláza', 'tyreoida'],          id: 'HYPOTHYROIDISM' },
  { keywords: ['cukrovka', 'diabetes', 'inzulínová rezistence', 'inzulin', 'glukóza'],            id: 'INSULIN_RESISTANCE' },
  { keywords: ['třes', 'tremor', 'bolest hlavy', 'migréna', 'headache'],                          id: 'NEUROMOTOR_DYS' },
  { keywords: ['nespavost', 'insomnia', 'spánek', 'sleep', 'porucha spánku'],                     id: 'SLEEP_DISORDER' },
  { keywords: ['deprese', 'depression', 'úzkost', 'anxiety', 'psychika', 'nálada'],               id: 'DEPRESSION_ANXIETY' },
  { keywords: ['periferní neuropatie', 'perieferni neuropatie', 'neuropatie', 'peripheral neuropathy'], id: 'PERIPHERAL_NEUROPATHY' },
  { keywords: ['fibrilace', 'arytmie', 'fap', 'atrial fibrillation'],                             id: 'ATRIAL_FIBRILLATION' },
  { keywords: ['kyselina močová', 'dna', 'hyperurikémie', 'gout', 'uric', 'milurit', 'allopurinol', 'febuxostat'], id: 'HYPERURICEMIA' },
  { keywords: ['nízký testosteron', 'hypogonadismus', 'testosterone deficiency', 'andropauza', 'androgen deficiency'], id: 'LOW_TESTOSTERONE' },
  { keywords: ['kosti', 'osteoporóza', 'osteopenie', 'bone density'],                             id: 'BONE_DENSITY_LOSS' },
  { keywords: ['klouby', 'artróza', 'artritis', 'páteř', 'ploténka'],                             id: 'MUSCULOSKELETAL_DEG' },
  { keywords: ['erektilní', 'erectile', 'impotence', 'ed'],                                       id: 'ERECTILE_DYSFUNCTION' },
  { keywords: ['sedavé zaměstnání', 'sedavý', 'kancelář', 'nepohyb', 'sedí celý den', 'sedentary', 'bez pohybu', 'no exercise'], id: 'SEDENTARY_LIFESTYLE_ROOT' },
  { keywords: ['mrtvice', 'stroke', 'cmp', 'tia', 'cerebrovaskulár', 'ischemická mozkov', 'cévní mozková'], id: 'STROKE_RISK' },
  { keywords: ['pád', 'fall risk', 'nestabilita', 'gait instability', 'riziko pádu'],                       id: 'FALL_RISK' },
  { keywords: ['únava', 'unava', 'vyčerpání', 'fatigue', 'nízká výkonnost', 'nizka vykonnost', 'slabost'], id: 'FATIGUE_LOW_CAPACITY' },
];

// Vitalita/Dekatlon metriky → jeden konsolidovaný CRT uzel (most mezi metabolickým kořenem a UDE)
// Jakákoliv fyzická metrika YELLOW/RED → PHYSICAL_DECONDITIONING (nepoletující ostrovy)
const METRICS_UDE_MAP = [
  { longevityId: 'vo2max',     udeId: 'PHYSICAL_DECONDITIONING' },
  { longevityId: 'vytrvalost', udeId: 'PHYSICAL_DECONDITIONING' },
  { longevityId: 'sila',       udeId: 'PHYSICAL_DECONDITIONING' },
  { longevityId: 'mobilita',   udeId: 'PHYSICAL_DECONDITIONING' },
  { longevityId: 'stabilita',  udeId: 'PHYSICAL_DECONDITIONING' },
  { longevityId: 'rovnovaha',  udeId: 'PHYSICAL_DECONDITIONING' },
];

// Deterministické sestavení CRT z diagnóz + léků (bez AI) — pro nové uživatele
// Odstraní diakritiku — 'hyperurikémie' === 'hyperurikemie', 'hypertenze' === 'hypertenze'
function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function buildDeterministicCRT(profile, metrics = [], checkins = []) {
  const allText = stripDiacritics([
    ...(profile.diagnoses || []),
    ...(profile.symptoms  || []),
    profile.doctor_notes || '',
  ].join(' ').toLowerCase());

  const bmi = (profile._height && profile._weight)
    ? profile._weight / ((profile._height / 100) ** 2) : null;

  // Demografická data pro podmíněnou aktivaci/vyloučení stavů
  const _sex = (profile.sex || '').toLowerCase().trim();
  const _age  = profile.birth_year
    ? (new Date().getFullYear() - parseInt(profile.birth_year))
    : null;
  const isMale   = _sex === 'male'   || _sex === 'm' || _sex === 'muž';
  const isFemale = _sex === 'female' || _sex === 'f' || _sex === 'žena' || _sex === 'woman';

  // Když existují doctor_notes, použij POUZE jejich text pro keyword matching.
  // Diagnózy mohou přidávat šum (ESENCIALNI_TREMOR → NEUROMOTOR_DYS), který
  // doctor_notes záměrně nezmínily — lékař popsal relevantní kauzální řetěz.
  const hasDetailedNotes = !!(profile.doctor_notes && profile.doctor_notes.trim().length > 20);
  const keywordText = hasDetailedNotes
    ? stripDiacritics(profile.doctor_notes.toLowerCase())
    : allText;

  // diagText: vždy jen strukturovaný seznam diagnóz (bez doctor_notes) — zdroj confirmed statusu.
  // stripDiacritics zajistí shodu "hyperurikemie" === "hyperurikémie".
  const diagText = stripDiacritics(
    (profile.diagnoses || []).concat(profile.symptoms || []).join(' ').toLowerCase()
  );

  // 1. Keyword matching → aktivní State Dictionary IDs
  const activeIds       = new Set();
  const confirmedIds    = new Set(); // vizuální: modrý border (podloženo daty)
  const cascadeEligible = new Set(); // Tier 1: smí spouštět typical_children cascade + parent inference
  const noInference     = new Set(); // Tier 3: nezatahuje rodiče, nekaskáduje (capacity, auto_if, lifestyle)

  for (const { keywords, id } of DIAGNOSIS_KEYWORDS) {
    // keywordText (doctor_notes): raw keywords — stripDiacritics('třes')='tres' matchuje 'stres' → false positive!
    const inKeywordText = keywords.some(kw => keywordText.includes(kw));
    // diagText (seznam diagnóz): stripped — 'hyperurikemie' (bez háčku na serveru) = 'hyperurikémie' (keyword)
    const kws = keywords.map(stripDiacritics);
    const inDiagText    = kws.some(kw => diagText.includes(kw));
    if (inKeywordText) { activeIds.add(id); confirmedIds.add(id); cascadeEligible.add(id); }
    else if (inDiagText) {
      confirmedIds.add(id); cascadeEligible.add(id); // diagnóza lékaře = Tier 1, smí kaskádovat
    }
  }
  // BMI prahy — naměřená hodnota → Confirmed, ale nekaskáduje (OBESITY→INSULIN_RESISTANCE zůstane Inferred)
  if (bmi && bmi >= 27) { activeIds.add('OBESITY'); confirmedIds.add('OBESITY'); }
  if (bmi && bmi >= 30) { activeIds.add('OBESITY'); confirmedIds.add('OBESITY'); activeIds.add('HYPERTENSION'); confirmedIds.add('HYPERTENSION'); }

  // Lab hodnoty z user_health_profile.labs (manuální zadání z UI)
  // Confirmed = naměřená hodnota, nekaskáduje (stejná logika jako BMI)
  const labs = profile.labs || {};
  const hba1c          = labs.hba1c           != null ? parseFloat(labs.hba1c)           : null;
  const fastingGlucose = labs.fasting_glucose  != null ? parseFloat(labs.fasting_glucose)  : null;
  const fastingInsulin = labs.fasting_insulin  != null ? parseFloat(labs.fasting_insulin)  : null;
  const ldl            = labs.ldl             != null ? parseFloat(labs.ldl)             : null;
  const triglycerides  = labs.triglycerides   != null ? parseFloat(labs.triglycerides)   : null;
  const apob           = labs.apob            != null ? parseFloat(labs.apob)            : null;
  const testosterone   = labs.testosterone    != null ? parseFloat(labs.testosterone)    : null;
  const crp            = labs.crp             != null ? parseFloat(labs.crp)             : null;
  const hrv            = labs.hrv             != null ? parseFloat(labs.hrv)             : null;
  const alt            = labs.alt             != null ? parseFloat(labs.alt)             : null;
  const ast            = labs.ast             != null ? parseFloat(labs.ast)             : null;

  // INSULIN_RESISTANCE — 3 stupně přesnosti (Attia progrese)
  // Krok 1: pas/výška (lifestyle.waist_cm / profile._height) — nejhrubší proxy
  const waistCm = (profile.lifestyle || {}).waist_cm != null ? parseFloat((profile.lifestyle || {}).waist_cm) : null;
  const heightCm = profile._height != null ? parseFloat(profile._height) : null;
  if (waistCm && heightCm && (waistCm / heightCm) > 0.5) {
    if (!activeIds.has('INSULIN_RESISTANCE')) activeIds.add('INSULIN_RESISTANCE');
    if (!activeIds.has('OBESITY')) activeIds.add('OBESITY');
    console.log('[CRT] INSULIN_RESISTANCE + OBESITY inferred: waist/height > 0.5');
  }
  // Krok 2: HbA1c / glukóza nalačno
  if ((hba1c != null && hba1c >= 6.5) || (fastingGlucose != null && fastingGlucose >= 7.0)) {
    activeIds.add('INSULIN_RESISTANCE'); confirmedIds.add('INSULIN_RESISTANCE');
    console.log('[CRT] INSULIN_RESISTANCE confirmed: HbA1c/glucose');
  } else if ((hba1c != null && hba1c >= 5.7) || (fastingGlucose != null && fastingGlucose >= 5.6)) {
    activeIds.add('INSULIN_RESISTANCE');
    console.log('[CRT] INSULIN_RESISTANCE inferred: HbA1c/glucose borderline');
  }
  // Krok 3: HOMA-IR (nejpřesnější — vyžaduje lačný inzulín + glukózu)
  if (fastingInsulin != null && fastingGlucose != null) {
    const homaIr = (fastingInsulin * fastingGlucose) / 22.5;
    if (homaIr > 2.5) { activeIds.add('INSULIN_RESISTANCE'); confirmedIds.add('INSULIN_RESISTANCE'); console.log(`[CRT] INSULIN_RESISTANCE confirmed: HOMA-IR ${homaIr.toFixed(2)}`); }
    else if (homaIr > 1.5) { activeIds.add('INSULIN_RESISTANCE'); console.log(`[CRT] INSULIN_RESISTANCE inferred: HOMA-IR borderline ${homaIr.toFixed(2)}`); }
  }

  // DYSLIPIDEMIA — LDL/TG + ApoB (Attia preferuje ApoB nad LDL)
  if ((ldl != null && ldl >= 4.1) || (triglycerides != null && triglycerides >= 1.7)) {
    activeIds.add('DYSLIPIDEMIA'); confirmedIds.add('DYSLIPIDEMIA');
    console.log('[CRT] DYSLIPIDEMIA confirmed: LDL/TG');
  } else if (ldl != null && ldl >= 3.4) {
    activeIds.add('DYSLIPIDEMIA');
    console.log('[CRT] DYSLIPIDEMIA inferred: LDL borderline');
  }
  if (apob != null) {
    if (apob >= 1.2) { activeIds.add('DYSLIPIDEMIA'); confirmedIds.add('DYSLIPIDEMIA'); console.log('[CRT] DYSLIPIDEMIA confirmed: ApoB >= 1.2 g/L'); }
    else if (apob >= 1.0) { activeIds.add('DYSLIPIDEMIA'); console.log('[CRT] DYSLIPIDEMIA inferred: ApoB borderline'); }
  }

  // TESTOSTERONE
  if (testosterone != null && testosterone < 12 && isMale) {
    activeIds.add('LOW_TESTOSTERONE'); confirmedIds.add('LOW_TESTOSTERONE');
    console.log('[CRT] LOW_TESTOSTERONE confirmed: lab');
  }

  // hs-CRP — low-grade (1–3) = metabolický zánět (inferred), >3 = systémový (confirmed)
  // Pozor: hs-CRP ≠ inflammaging (IL-6, TNF-alpha), ale je dobrý proxy pro chronický low-grade zánět
  if (crp != null) {
    if (crp > 3)      { activeIds.add('CHRONIC_STRESS'); confirmedIds.add('CHRONIC_STRESS'); console.log('[CRT] CHRONIC_STRESS confirmed: hs-CRP > 3'); }
    else if (crp >= 1){ activeIds.add('CHRONIC_STRESS'); console.log('[CRT] CHRONIC_STRESS inferred: hs-CRP 1–3 (low-grade zánět)'); }
  }

  // HRV — autonomní nervový systém, recovery kapacita (Attia top marker)
  if (hrv != null) {
    if (hrv < 40)      { activeIds.add('CHRONIC_STRESS'); confirmedIds.add('CHRONIC_STRESS'); console.log('[CRT] CHRONIC_STRESS confirmed: HRV < 40 ms'); }
    else if (hrv < 50) { activeIds.add('CHRONIC_STRESS'); console.log('[CRT] CHRONIC_STRESS inferred: HRV 40–50 ms'); }
  }

  // ALT / AST — jaterní zátěž, proxy viscerálního tuku
  const altThresh = isMale ? 40 : 30;
  if ((alt != null && alt > altThresh) || (ast != null && ast > 40)) {
    activeIds.add('METABOLIC_HEALTH_ROOT'); confirmedIds.add('METABOLIC_HEALTH_ROOT');
    console.log('[CRT] METABOLIC_HEALTH_ROOT confirmed: ALT/AST elevated');
  }

  // SLEEP — průměr 14 dní z daily_checkin (min. 5 záznamů pro spolehlivost)
  const sleepCheckins = checkins.filter(c => c.sleep_hours != null);
  if (sleepCheckins.length >= 5) {
    const avgSleep = sleepCheckins.reduce((s, c) => s + c.sleep_hours, 0) / sleepCheckins.length;
    if (avgSleep < 6)      { activeIds.add('SLEEP_DISORDER'); confirmedIds.add('SLEEP_DISORDER'); console.log(`[CRT] SLEEP_DISORDER confirmed: avg ${avgSleep.toFixed(1)}h`); }
    else if (avgSleep < 7) { activeIds.add('SLEEP_DISORDER'); console.log(`[CRT] SLEEP_DISORDER inferred: avg ${avgSleep.toFixed(1)}h`); }
  }

  // Životní styl z user_health_profile.lifestyle (UI přepínače) — Tier 3: noInference
  const lifestyle = profile.lifestyle || {};
  if (lifestyle.sedentary === true && !activeIds.has('SEDENTARY_LIFESTYLE_ROOT')) {
    activeIds.add('SEDENTARY_LIFESTYLE_ROOT');
    noInference.add('SEDENTARY_LIFESTYLE_ROOT');
    console.log('[CRT] SEDENTARY_LIFESTYLE_ROOT activated: lifestyle.sedentary (Tier 3)');
  }
  if (lifestyle.stress_job === true) {
    activeIds.add('CHRONIC_STRESS');
    noInference.add('CHRONIC_STRESS');
    console.log('[CRT] CHRONIC_STRESS activated: lifestyle.stress_job (Tier 3)');
  }

  // Fyzická kapacita z user_health_profile.capacity — Tier 3: noInference
  // Zobrazí přesně ten uzel, ale nezatahuje rodiče ani nekaskáduje dál.
  const cap = profile.capacity || {};

  const vo2Fails = [cap.climb_4_floors, cap.fast_walk_2km].filter(v => v === false).length;
  if (vo2Fails >= 2) { activeIds.add('LOW_VO2MAX'); confirmedIds.add('LOW_VO2MAX'); noInference.add('LOW_VO2MAX'); console.log('[CRT] LOW_VO2MAX confirmed (Tier 3): oba aerobní testy selhaly'); }
  else if (vo2Fails === 1) { activeIds.add('LOW_VO2MAX'); noInference.add('LOW_VO2MAX'); console.log('[CRT] LOW_VO2MAX inferred (Tier 3): jeden aerobní test selhal'); }

  if (cap.lift_20kg === false) {
    activeIds.add('MUSCLE_WEAKNESS'); noInference.add('MUSCLE_WEAKNESS');
    console.log('[CRT] MUSCLE_WEAKNESS activated (Tier 3): lift_20kg=false');
  }

  const mobilityFails = [cap.rise_from_floor, cap.balance_eyes_closed].filter(v => v === false).length;
  if (mobilityFails >= 2) { activeIds.add('MOBILITY_DEFICIT'); confirmedIds.add('MOBILITY_DEFICIT'); noInference.add('MOBILITY_DEFICIT'); console.log('[CRT] MOBILITY_DEFICIT confirmed (Tier 3): 2 stabilitní testy selhaly'); }
  else if (mobilityFails === 1) { activeIds.add('MOBILITY_DEFICIT'); noInference.add('MOBILITY_DEFICIT'); console.log('[CRT] MOBILITY_DEFICIT inferred (Tier 3): 1 stabilitní test selhal'); }

  if (cap.breath_20s === false) {
    activeIds.add('CHRONIC_STRESS'); noInference.add('CHRONIC_STRESS');
    console.log('[CRT] CHRONIC_STRESS inferred (Tier 3): breath_20s=false');
  }

  // Fyzická kondice z user_metrics — pouze pokud nejsou doctor_notes
  // (doctor_notes popisují přesný kauzální příběh, metriky by přidaly INACTIVITY_ROOT navíc)
  const PHYSICAL_METRIC_IDS = new Set(['vo2max', 'vytrvalost', 'sila', 'mobilita', 'stabilita', 'rovnovaha']);
  const hasLowFitness = !hasDetailedNotes && metrics.some(m => PHYSICAL_METRIC_IDS.has(m.node_id) && (m.state === 'RED' || m.state === 'YELLOW'));
  if (hasLowFitness && !activeIds.has('SEDENTARY_LIFESTYLE_ROOT')) {
    activeIds.add('INACTIVITY_ROOT');
    activeIds.add('PHYSICAL_DECONDITIONING');
    activeIds.add('FATIGUE_LOW_CAPACITY');
    // NOT in confirmedIds — odvozeno z app metrik, ne z lab/diagnózy
  }

  // Literal ID scan: pokud doctor_notes explicitně zmiňují ID ze State Dictionary (STROKE_RISK, GAIT_INSTABILITY…)
  // Lékař přímo specifikuje uzel → Tier 1 (cascadeEligible).
  if (profile.doctor_notes) {
    const notesUpper = profile.doctor_notes.toUpperCase();
    for (const def of STATES_ARR) {
      if (notesUpper.includes(def.id)) {
        activeIds.add(def.id); confirmedIds.add(def.id); cascadeEligible.add(def.id);
        noInference.delete(def.id); // případný Tier 3 upgrade na Tier 1
      }
    }
  }

  // Fallback: pokud nic nebylo nalezeno, přidej chronický stres
  if (activeIds.size === 0) activeIds.add('CHRONIC_STRESS');

  // Snapshot před kaskádou — potvrzení přímými daty (keyword/BMI/lab/literal ID scan).
  // FORCE_INFERRED přepíše jen confirmedIds přidané kaskádou, ne tato "tvrdá" potvrzení.
  // Příklad: HbA1c ≥ 6.5% → INSULIN_RESISTANCE zůstane modrý; sedavý uzel → šedý.
  const preCascadeConfirmed = new Set(confirmedIds);

  // Sedavý způsob života → přímý metabolický efekt — POUZE pokud je Tier 1 (keyword z diagnóz/notes)
  // Lifestyle toggle (Tier 3) nezatahuje celou kaskádu — pouze zobrazí uzel samotný.
  if (cascadeEligible.has('SEDENTARY_LIFESTYLE_ROOT')) {
    activeIds.add('CHRONIC_STRESS');      cascadeEligible.add('CHRONIC_STRESS');
    activeIds.add('DYSLIPIDEMIA');        cascadeEligible.add('DYSLIPIDEMIA');
    activeIds.add('HYPERURICEMIA');       cascadeEligible.add('HYPERURICEMIA');
    activeIds.add('OBESITY');             // inferred, bez cascadeEligible
    activeIds.add('INSULIN_RESISTANCE'); // inferred: sedavý + nadváha naznačují IR
    activeIds.add('HYPERTENSION');       // inferred: IR → hypertenze → ENDOTHELIAL_DYSFUNCTION řetěz
  }

  // Kořenová inference: přidej METABOLIC_HEALTH_ROOT pro klinické metabolické stavy
  // (přeskočí pokud sedavý životní styl je primárním rootem — ten je specifičtější)
  if (!activeIds.has('SEDENTARY_LIFESTYLE_ROOT') &&
      (activeIds.has('OBESITY') || activeIds.has('DYSLIPIDEMIA') || activeIds.has('INSULIN_RESISTANCE') || activeIds.has('HYPERURICEMIA'))) {
    activeIds.add('METABOLIC_HEALTH_ROOT');
  }

  // Auto-aktivace z demografických dat (condition.auto_if) — Tier 3: noInference
  // Demografika je slabý proxy — uzel se zobrazí, ale nezatahuje rodiče ani nekaskáduje.
  for (const def of STATES_ARR) {
    if (activeIds.has(def.id)) continue;
    const ai = def.condition?.auto_if;
    if (!ai) continue;
    if (ai.gender === 'female' && !isFemale) continue;
    if (ai.gender === 'male'   && !isMale)   continue;
    if (ai.min_age && (!_age || _age < ai.min_age)) continue;
    activeIds.add(def.id);
    noInference.add(def.id);
    console.log(`[CRT] auto-activate (Tier 3): ${def.id} (demographics: ${_sex}, age=${_age})`);
  }

  // Gender exclusion (condition.gender = required gender)
  for (const sid of [...activeIds]) {
    const req = STATES_DB[sid]?.condition?.gender;
    if (!req) continue;
    if (req === 'male'   && isFemale) { activeIds.delete(sid); continue; }
    if (req === 'female' && isMale)   { activeIds.delete(sid); continue; }
  }

  // ED-implies-male fallback: ED je Tier 1 → LOW_TESTOSTERONE také Tier 1.
  if (activeIds.has('ERECTILE_DYSFUNCTION') && !activeIds.has('LOW_TESTOSTERONE')) {
    activeIds.add('LOW_TESTOSTERONE');
    cascadeEligible.add('LOW_TESTOSTERONE');
    noInference.delete('LOW_TESTOSTERONE');
    console.log('[CRT] LOW_TESTOSTERONE activated (Tier 1): ERECTILE_DYSFUNCTION implies male patient');
  }

  // Léky NEAKTIVUJÍ uzly — zobrazují se jen jako pilulky na existujících uzlech (medications_map).
  // Uzly pochází výhradně z diagnóz, symptomů a BMI.

  // Rodičovský řetěz: Tier 1/2 uzly bez rodiče dostanou nejbližšího rodiče ze State Dictionary.
  // Tier 3 (noInference) uzly se přeskočí — zobrazí se bez rodiče nebo jako floating root.
  {
    const reverseMap = {}; // childId → [parentIds]
    for (const def of STATES_ARR) {
      for (const childId of (def.typical_children || [])) {
        (reverseMap[childId] = reverseMap[childId] || []).push(def.id);
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...activeIds]) {
        if (STATES_DB[id]?.can_be_root) continue;
        if (noInference.has(id)) continue; // Tier 3: nezatahuj rodiče
        const parents = (reverseMap[id] || []).filter(p => STATES_DB[p]);
        if (parents.length && !parents.some(p => activeIds.has(p))) {
          const best = parents.sort((a, b) =>
            (STATES_DB[a]?.typical_level ?? 0) - (STATES_DB[b]?.typical_level ?? 0))[0];
          activeIds.add(best);
          console.log(`[CRT] parent inference: ${best} → ${id}`);
          changed = true;
        }
      }
    }
  }

  // Post-parent-chain: SEDENTARY_LIFESTYLE_ROOT mohl být přidán parent inference (ne klíčovým slovem).
  // Explicit block výše (řádky 395-400) proběhl PŘED inference → re-fire pro správnost.
  // Odstraň METABOLIC_HEALTH_ROOT pokud byl přidán dřív (parent inference OBESITY→METABOLIC_HEALTH_ROOT)
  // a INACTIVITY_ROOT pokud SEDENTARY nakonec přišel.
  if (activeIds.has('SEDENTARY_LIFESTYLE_ROOT')) {
    activeIds.add('DYSLIPIDEMIA');
    activeIds.add('HYPERURICEMIA');
    activeIds.add('OBESITY');
    activeIds.delete('METABOLIC_HEALTH_ROOT');
    activeIds.delete('INACTIVITY_ROOT');
    activeIds.delete('PHYSICAL_DECONDITIONING');
    activeIds.delete('FATIGUE_LOW_CAPACITY');
  }

  // INFLAMMAGING jako super-root pohlcuje METABOLIC_HEALTH_ROOT a CHRONIC_STRESS —
  // věkem podmíněný zánět je jejich společný upstream kořen, duplikovat by zmatl graf.
  // HYPERURICEMIA: SEDENTARY kaskáda ji přidala PŘED tímto blokem — smaž pokud není z dat.
  if (activeIds.has('INFLAMMAGING')) {
    activeIds.delete('METABOLIC_HEALTH_ROOT');
    activeIds.delete('CHRONIC_STRESS');
    activeIds.delete('SEDENTARY_LIFESTYLE_ROOT');
    if (!confirmedIds.has('HYPERURICEMIA')) activeIds.delete('HYPERURICEMIA');
    console.log('[CRT] INFLAMMAGING active: suppressed METABOLIC_HEALTH_ROOT, CHRONIC_STRESS, SEDENTARY cascade');
  }

  // Downstream kaskáda — pouze z Tier 1 (cascadeEligible) uzlů s přesně 1 typical_child.
  // DYSLIPIDEMIA→ATHEROSCLEROSIS→VASCULAR_STIFFNESS funguje protože DYSLIPIDEMIA je Tier 1.
  // BMI/capacity uzly nekaskádují — zobrazí se samy, bez downstream řetězu.
  {
    let cascadeChanged = true;
    while (cascadeChanged) {
      cascadeChanged = false;
      for (const id of [...activeIds]) {
        if (!cascadeEligible.has(id)) continue; // Tier 1 only
        const def = STATES_DB[id];
        const children = def?.typical_children || [];
        if (children.length === 0) continue;
        for (const childId of children) {
          if (STATES_DB[childId] && !activeIds.has(childId)) {
            activeIds.add(childId);
            if (cascadeEligible.has(id)) { confirmedIds.add(childId); cascadeEligible.add(childId); }
            console.log(`[CRT] downstream cascade (Tier 1): ${id} → ${childId}`);
            cascadeChanged = true;
          }
        }
      }
    }
  }

  // Propagace cascadeEligible přes typical_children — separátní průchod po kaskádě.
  // Řeší případ kdy parent inference přidal uzel PŘED downstream kaskádou (activeIds.has() = true
  // → blok se nespustil → confirmedIds nepropagoval). Průchod propaguje z confirmed zdrojů
  // přes celý lineární řetěz DYSLIPIDEMIA→ATHEROSCLEROSIS→VASCULAR_STIFFNESS→ENDOTHELIAL_DYSFUNCTION.
  // POZOR: záměrně single-child — multi-child by propagovalo přes SEDENTARY root na INSULIN_RESISTANCE/OBESITY
  // které jsou v activeIds ale záměrně mimo cascadeEligible (mají být inferred, ne confirmed).
  {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...cascadeEligible]) {
        const def = STATES_DB[id];
        const children = def?.typical_children || [];
        if (children.length !== 1) continue; // single-child only — zachování inferred stavu
        const childId = children[0];
        if (activeIds.has(childId) && !cascadeEligible.has(childId)) {
          cascadeEligible.add(childId);
          confirmedIds.add(childId);
          changed = true;
        }
      }
    }
  }

  // Uzly které musí zůstat Inferred pokud nebyly potvrzeny přímými daty (lab/keyword/literal ID).
  // Cascade mohla tyto uzly dostat do confirmedIds nepřímou cestou — tato ochrana to zruší.
  // preCascadeConfirmed = snapshot před kaskádou = "tvrdá" potvrzení (HbA1c, diagnóza, lékař).
  // Příklad: HbA1c ≥ 6.5% → INSULIN_RESISTANCE v preCascadeConfirmed → zůstane modrý (lab).
  //          Sedavý životní styl → INSULIN_RESISTANCE NENÍ v preCascadeConfirmed → šedý.
  const FORCE_INFERRED = new Set([
    'INSULIN_RESISTANCE', // vyžaduje HOMA-IR / HbA1c / glukózu — bez lab = vždy inferred
    'LOW_TESTOSTERONE',   // vyžaduje lab testosteron < 12 nmol/L — ED-implies-male = inferred
    'HYPERTENSION',       // bez měření TK nebo diagnózy = inferred (sedavý životní styl nestačí)
  ]);
  // Odstraň z confirmedIds jen pokud nebylo potvrzeno přímými daty
  for (const id of FORCE_INFERRED) {
    if (!preCascadeConfirmed.has(id)) confirmedIds.delete(id);
  }

  // Zpětná inference: Confirmed potomek → Confirmed rodič
  // "Příčina potvrzeného efektu je také potvrzena" (FaP → CARDIAC_IRRITABILITY, CHRONIC_STRESS → SYMPATHETIC)
  // Výjimky: uzly vyžadující explicitní lab data zůstanou Inferred bez ohledu na potomky.
  const BACKWARD_INFERENCE_EXCLUDE = new Set(['INSULIN_RESISTANCE', 'LOW_TESTOSTERONE']);
  {
    let changed = true;
    while (changed) {
      changed = false;
      for (const [parentId, parentDef] of Object.entries(STATES_DB)) {
        if (!activeIds.has(parentId) || confirmedIds.has(parentId)) continue;
        if (BACKWARD_INFERENCE_EXCLUDE.has(parentId)) continue;
        const isParentRoot = parentDef.can_be_root || (parentDef.typical_level ?? 99) === 0;
        if (isParentRoot) continue;
        const confirmedChild = (parentDef.typical_children || []).some(
          cid => activeIds.has(cid) && confirmedIds.has(cid)
        );
        if (confirmedChild) {
          confirmedIds.add(parentId);
          changed = true;
          console.log(`[CRT] backward inference: ${parentId} confirmed (má confirmed potomka)`);
        }
      }
    }
  }

  // Dedup: STROKE_RISK a THREATENED_HEALTHSPAN jsou ekvivalentní apices —
  // THREATENED_HEALTHSPAN má bohatší kontext (FaP + ED + mrtvice), preferuj ho.
  // Pokud jsou oba aktivní (literal scan + HYPERTENSION kaskáda), odstraň STROKE_RISK.
  if (activeIds.has('THREATENED_HEALTHSPAN') && activeIds.has('STROKE_RISK')) {
    activeIds.delete('STROKE_RISK');
    console.log('[CRT] dedup: STROKE_RISK removed — THREATENED_HEALTHSPAN already active');
  }

  // 2. Sestav nodes + edges ze State Dictionary
  const nodes = [];
  const edges = [];
  const edgeSet = new Set();

  for (const id of activeIds) {
    const def = STATES_DB[id];
    if (!def) continue;
    const isRootNode = def.can_be_root || (def.typical_level ?? 99) === 0;
    const node = {
      id, label: def.label, label_layman: def.label_layman,
      type: def.type, level: def.typical_level, branch: def.typical_branch,
      _inferred: isRootNode ? false : ((FORCE_INFERRED.has(id) && !preCascadeConfirmed.has(id)) || !confirmedIds.has(id)),
    };
    // BMI-based label override: 25–30 = nadváha, ≥30 = obezita
    if (id === 'OBESITY' && bmi && bmi < 30) {
      node.label = 'Nadváha';
      node.label_layman = 'Nadváha';
      node._labelOverride = true;
    }
    nodes.push(node);
    // typical_children → přidej hrany kde cílový node je také aktivní
    for (const childId of (def.typical_children || [])) {
      if (activeIds.has(childId)) {
        const key = `${id}→${childId}`;
        if (!edgeSet.has(key)) { edges.push({ from: id, to: childId }); edgeSet.add(key); }
      }
    }
    // sources → přidej zpětné hrany: každý aktivní zdroj → tento uzel
    for (const sourceId of (def.sources || [])) {
      if (activeIds.has(sourceId)) {
        const key = `${sourceId}→${id}`;
        if (!edgeSet.has(key)) { edges.push({ from: sourceId, to: id }); edgeSet.add(key); }
      }
    }
    // Capacity UDE apexy (LOW_VO2MAX, MUSCLE_WEAKNESS) nemají rodiče v typical_children žádného
    // aktivního uzlu. SEDENTARY (level 0) → tyto UDE je kauzálně správné a validateEdges to propustí
    // (root level 0 smí mířit do libovolné větve).
    if (id === 'SEDENTARY_LIFESTYLE_ROOT') {
      for (const capUde of ['LOW_VO2MAX', 'MUSCLE_WEAKNESS']) {
        if (activeIds.has(capUde)) {
          const key = `SEDENTARY_LIFESTYLE_ROOT→${capUde}`;
          if (!edgeSet.has(key)) { edges.push({ from: 'SEDENTARY_LIFESTYLE_ROOT', to: capUde }); edgeSet.add(key); }
        }
      }
    }
  }

  // Kořen = node s can_be_root:true a nejnižším levelem
  const roots = nodes.filter(n => STATES_DB[n.id]?.can_be_root).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  const root = roots[0] || nodes[0];

  // Ponech root v nodes — post-processing ho extrahuje s korektním labelem
  const crt = { root: root?.id, nodes, edges, medications_map: [] };

  console.log(`[CRT] deterministický strom: ${[root?.id, ...crt.nodes.map(n => n.id)].join(', ')}`);
  return crt;
}

// Vitalita/Dekatlon fyzické UDE uzly — inject na základě user_metrics (obě cesty)
// Přidá jen uzly, pro které existuje přirozený rodič v aktivním CRT stromu.
// Přeskočí pokud je SEDENTARY_LIFESTYLE_ROOT aktivní — sedavý kořen fyzickou situaci pokrývá.
function injectPhysicalUdes(crt, metrics) {
  if (!metrics || !metrics.length) return;

  const existingIds = new Set([
    ...(crt.nodes || []).map(n => n.id),
    crt.root ? (typeof crt.root === 'object' ? crt.root.id : crt.root) : null,
  ].filter(Boolean));

  // SEDENTARY_LIFESTYLE_ROOT pokrývá fyzickou situaci kauzálně — PHYSICAL_DECONDITIONING by byl duplikát
  if (existingIds.has('SEDENTARY_LIFESTYLE_ROOT')) {
    console.log('[CRT] injectPhysicalUdes: skip — SEDENTARY_LIFESTYLE_ROOT aktivní');
    return;
  }

  const allNodes = () => [
    ...(crt.nodes || []),
    ...(crt.root && typeof crt.root === 'object' ? [crt.root] : []),
  ];

  const udesFromMetrics = new Set();
  for (const { longevityId, udeId } of METRICS_UDE_MAP) {
    const m = metrics.find(m => m.node_id === longevityId && (m.state === 'RED' || m.state === 'YELLOW'));
    if (m && !existingIds.has(udeId)) udesFromMetrics.add(udeId);
  }

  for (const udeId of udesFromMetrics) {
    const def = STATES_DB[udeId];
    if (!def) continue;
    const parentNode = allNodes().find(n => STATES_DB[n.id]?.typical_children?.includes(udeId));
    if (!parentNode) {
      console.log(`[CRT] injectPhysicalUdes: skip ${udeId} — no active parent`);
      continue;
    }
    (crt.nodes = crt.nodes || []).push({
      id: udeId, label: def.label, label_layman: def.label_layman,
      type: def.type, level: def.typical_level, branch: def.typical_branch,
      panel_text: def.panel_text || null, _injected: true,
    });
    (crt.edges = crt.edges || []).push({ from: parentNode.id, to: udeId });
    existingIds.add(udeId);
    console.log(`[CRT] injectPhysicalUdes: +${udeId} (${def.label}) ← ${parentNode.id}`);
  }
}

async function generateCRT({ metrics, profile, checkins, nodeInputs, _rawAI }, role, modelCfg) {
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
  const { meds: resolvedMeds, interactions: resolvedInteractions } = await resolveInteractionsRxNorm(profile.medications || []);
  const medsText = resolvedMeds.length
    ? resolvedMeds.map(m => {
        const parts = [`${m.name} (${m.inn})`];
        if (m.primary_indication) parts.push(`indikace: ${m.primary_indication}`);
        if (m.companion_for)      parts.push(`doplněk k: ${m.companion_for}`);
        else if (m.effect)        parts.push(m.effect);
        return parts.join(', ');
      }).join('\n')
    : 'neuvedeno';
  const labsObj      = profile.labs || {};
  const labsText     = Object.entries(labsObj)
    .filter(([k]) => k !== 'date')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'neuvedeno';
  const goalText     = profile.goal_text || 'neuvedeno';
  const doctorText   = profile.doctor_notes ? `\nPoznámky od lékaře:\n${profile.doctor_notes.slice(0, 800)}` : '';
  const bmi = (profile._height && profile._weight)
    ? (profile._weight / ((profile._height / 100) ** 2)).toFixed(1)
    : null;
  const physicalText = [
    profile._height ? `výška: ${profile._height} cm` : '',
    profile._weight ? `váha: ${profile._weight} kg` : '',
    bmi ? `BMI: ${bmi}` : '',
  ].filter(Boolean).join(', ') || 'neuvedeno';

  // Poslední check-in (průměr posledních 7 dní)
  const checkinText = checkins.length
    ? checkins.slice(0, 3).map(c =>
        `${c.date}: energie ${c.energy}/5, spánek ${c.sleep_hours}h, stres ${c.stress}/5${c.binge ? ', přejedení' : ''}`
      ).join('\n')
    : 'žádné záznamy';

  const metricsText2 = metricsText;

  // State Dictionary → prompt text
  const stateListText = STATES_ARR.map(s =>
    `${s.id} | ${s.label} | typ: ${s.type} | větev: ${s.typical_branch} | level: ${s.typical_level}${s.can_be_root ? ' | může být root' : ''}`
  ).join('\n');

  const systemPrompt = `Tato analýza slouží výhradně jako abstraktní logická simulace systémových vazeb v rámci Teorie omezení (TOC) pro akademické účely vizualizace. Nejedná se o klinickou diagnózu ani terapeutické doporučení.

Jsi DETERMINISTICKÝ PARSER kauzálních map pro longevity aplikaci CHJ.

TVŮJ JEDINÝ ÚKOL:
1. Přečti KAUZÁLNÍ POPIS lékaře (sekce KAUZÁLNÍ POPIS v user promptu) — to je zdroj pravdy.
2. Namapuj každou entitu z popisu na odpovídající ID ze STATE DICTIONARY níže.
3. Přeložení kauzální vztahy popsané lékařem do JSON struktury.
4. ŽÁDNÁ KREATIVITA. ŽÁDNÉ VYMÝŠLENÍ. Pouze překlad popisu do struktury.

STATE DICTIONARY — JEDINÁ POVOLENÁ ID UZLŮ:
${stateListText}

Uzly MIMO State Dictionary jsou ZAKÁZÁNY. Pokud lékařský popis zmiňuje stav který není v dictionary, použij nejbližší ID.

### LAYOUT PRAVIDLA (závazná pro vizuální engine):

1. KAUZÁLNÍ STOUPÁNÍ: Pokud A způsobuje B → B má level alespoň o 1 vyšší než A.

2. PARALELNÍ VĚTVE: L větev a R větev se vyvíjejí nezávisle. Na stejný level dej L a R uzel jen pokud jsou stejně daleko od root.

3. ŽÁDNÉ SLEPÉ ULIČKY: Každý uzel (kromě apex) musí mít hranu výše.

4. JEDEN VRCHOL: Level 6, branch C = jediné Ultimate UDE. Obě větve se musí sbíhat.

5. ČISTÉ VĚTVE — ABSOLUTNÍ ZÁKAZ KŘÍŽENÍ:
   - L uzel → pouze L uzly nebo C uzel na level ≥ 5.
   - R uzel → pouze R uzly nebo C uzel na level ≥ 5.
   - ZAKÁZÁNO: L→R nebo R→L hrana kdekoliv ve stromě.
   - ZAKÁZÁNO: L nebo R → C junction na level 1–3.

6. KAUZALITA: Hrana A→B musí dávat smysl jako "Protože A, proto B."

### FORMÁT VÝSTUPU — pouze čistý JSON:

{
  "root": "STATE_ID",
  "nodes": [
    { "id": "STATE_ID", "level": 0, "branch": "C", "type": "cause", "label": "z dictionary", "label_layman": "z dictionary" }
  ],
  "edges": [
    { "from": "STATE_ID", "to": "STATE_ID" }
  ],
  "and_joins": [],
  "injections": [],
  "universe_map": []
}

PRAVIDLA JSON:
- "id": Pokud STATE DICTIONARY obsahuje přesné ID → použij ho. Pokud symptom/stav nemá odpovídající ID → vytvoř popisné ID (např. TREMOR_HANDS, NEUROMOTOR_DYS, JOINT_PAIN). Nikdy nevynechávej symptom jen proto, že není v dictionary.
- "label" a "label_layman": Pro ID ze STATE DICTIONARY přebírej odtamtud. Pro vlastní ID napiš výstižný český label (label) a lidový popis (label_layman).
- "type": Pro ID ze STATE DICTIONARY přebírej. Pro vlastní ID: "cause" pro příčiny, "ude" pro konečné nežádoucí efekty.
- "level" a "branch" nastav podle layout pravidel (použij typical_level a typical_branch jako výchozí bod, pro vlastní uzly odvoď z kontextu).
- medications_map NEGENERUJ — léky přiřadí systém deterministicky po tvém výstupu.
- Rozsah: 8–14 uzlů celkem (včetně root).`;

  // Deterministická cesta = primary pro všechny uživatele.
  // AI (Sonnet/Fable/GPT-4o) pouze pro explicitní ?model=sonnet5/fable/gpt4o.
  const useAI = !!(modelCfg.thinking || modelCfg.provider === 'openai');

  let crt;
  if (_rawAI && useAI) {
    // Partial cache hit — AI výstup z cache, přeskočíme Sonnet
    crt = JSON.parse(JSON.stringify(_rawAI));
    console.log('[CRT] _rawAI použit z cache (Sonnet přeskočen)');
  } else if (!useAI) {
    // PRIMARY: deterministická cesta — všichni uživatelé
    crt = await buildDeterministicCRT(profile, metrics, checkins);
  } else {
  const userPrompt = `Přelož lékařský popis do CRT JSON struktury.

DIAGNÓZY: ${diagText}
LÉKY: ${medsText}
LABS: ${labsText}
FYZICKÉ: ${physicalText}${sympText !== 'neuvedeno' ? '\nSYMPTOMY: ' + sympText : ''}

KAUZÁLNÍ POPIS (zdroj pravdy — přelož přesně, neměň kauzalitu):
${profile.doctor_notes.trim()}

Instrukce: Namapuj každou entitu z KAUZÁLNÍHO POPISU na ID ze STATE DICTIONARY. Zahrň POUZE entity explicitně zmíněné v popisu — neextrapoluj důsledky ani rizika navíc. Apex = poslední entita v popisu (FaP, ED, atd.) — nic nad ní nepřidávej.

Vrať pouze čistý JSON. Žádný text navíc.`;
  if (modelCfg.provider === 'openai') {
    crt = await callGPT4o(systemPrompt, userPrompt, modelCfg);
  } else {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelCfg.id,
        max_tokens: modelCfg.maxTokens,
        ...(modelCfg.thinking ? { thinking: { type: 'adaptive' } } : {}),
        ...(modelCfg.effort   ? { output_config: { effort: modelCfg.effort } } : {}),
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Claude ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = await res.json();
    const usage = data.usage || {};
    console.log(`[CRT] model=${modelCfg.id} stop=${data.stop_reason} tokens: input=${usage.input_tokens} output=${usage.output_tokens}`);
    if (data.stop_reason === 'refusal' || (usage.output_tokens != null && usage.output_tokens < 30)) {
      throw new Error(`Fable refusal: stop=${data.stop_reason} output_tokens=${usage.output_tokens}`);
    }
    const textBlock = (data.content || []).find(b => b.type === 'text' && b.text);
    const text = (textBlock?.text || '').trim();
    const blocks = (data.content || []).map(b => `${b.type}(${b.text?.length ?? b.thinking?.length ?? '?'})`).join(',');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Claude nevrátil JSON. Model: ${modelCfg.id}. Blocks: ${blocks}. Text: ${text.slice(0, 500)}`);
    const rawJson = jsonMatch[0];
    try {
      crt = JSON.parse(rawJson);
    } catch(e) {
      const cleaned = rawJson.replace(/,(\s*[}\]])/g, '$1');
      try {
        crt = JSON.parse(cleaned);
        console.log('[CRT] JSON opraven odstraněním trailing commas');
      } catch(e2) {
        const pos = parseInt((e2.message.match(/position (\d+)/) || [])[1] || '0');
        const snippet = rawJson.slice(Math.max(0, pos - 80), pos + 80);
        throw new Error(`JSON parse error: ${e.message}. Near pos ${pos}: ...${snippet}... | Full length: ${rawJson.length}`);
      }
    }
  }
  } // end else (useAI)

  // Ulož snapshot raw AI výstupu — pouze pro explicitní AI cestu (?model=sonnet5/fable/gpt4o)
  if (useAI && !_rawAI) {
    crt._raw_ai_snapshot = JSON.parse(JSON.stringify(crt));
  }

  // Transformace nového formátu (root=string, medications_map s target_node_id)
  // na starý formát který očekává renderCRT / handler
  if (typeof crt.root === 'string') {
    const rootId = crt.root;
    const rootIdx = (crt.nodes || []).findIndex(n => n.id === rootId);
    if (rootIdx >= 0) {
      crt.root = crt.nodes[rootIdx];         // vytáhni root objekt z nodes
      crt.nodes = crt.nodes.filter((_, i) => i !== rootIdx);
    } else {
      crt.root = { id: rootId, label: 'Kořenová příčina', level: 0, branch: 'C' };
    }
  }

  // Soft validation: odstraň uzly s ID mimo STATES_DB, přebij labely z State Dictionary
  {
    const before = (crt.nodes || []).length;
    crt.nodes = (crt.nodes || []).filter(n => {
      if (!n?.id || !STATES_DB[n.id]) {
        console.log(`[CRT] soft-validation: odstraněn neznámý uzel '${n?.id}'`);
        return false;
      }
      return true;
    });
    if ((crt.nodes || []).length < before)
      console.log(`[CRT] soft-validation: odstraněno ${before - crt.nodes.length} uzlů`);

    // Kanonické hodnoty ze State Dictionary — label, branch, level, type jsou deterministické
    // GPT-4o přiřazuje špatné branch/level → vis.js udělá separátní podstrom
    // Root detekce: uzel bez příchozí hrany + can_be_root → level = 0 (i když typical_level > 0)
    const nodesWithParent = new Set((crt.edges || []).map(e => e.to));
    const applyStateLabels = n => {
      if (n?._labelOverride) return;
      const def = STATES_DB[n?.id];
      if (def) {
        n.label        = def.label;
        n.label_layman = def.label_layman;
        n.type         = def.type;
        const isActualRoot = def.can_be_root && !nodesWithParent.has(n.id);
        n.level        = isActualRoot ? 0 : def.typical_level;  // root → 0, jinak kanonická hloubka
        n.branch       = def.typical_branch;  // kanonická větev → vis.js pozice
        if (def.panel_text) n.panel_text = def.panel_text;
      }
    };
    (crt.nodes || []).forEach(applyStateLabels);
    if (crt.root && typeof crt.root === 'object') applyStateLabels(crt.root);
  }

  // Vitalita/Dekatlon fyzické UDE uzly — po obou cestách (Sonnet i deterministická)
  injectPhysicalUdes(crt, metrics);

  // THREATENED_HEALTHSPAN — apex UDE nad FaP a ED
  // Sonnet ho nemusí vybrat sám → inject pokud je v aktivním stromu FaP nebo ED
  {
    const activeNodeIds = new Set((crt.nodes || []).map(n => n.id));
    const triggers = ['ATRIAL_FIBRILLATION', 'ERECTILE_DYSFUNCTION'];
    if (triggers.some(id => activeNodeIds.has(id)) && !activeNodeIds.has('THREATENED_HEALTHSPAN')) {
      const def = STATES_DB['THREATENED_HEALTHSPAN'];
      if (def) {
        (crt.nodes = crt.nodes || []).push({
          id: 'THREATENED_HEALTHSPAN', label: def.label, label_layman: def.label_layman,
          type: def.type, level: def.typical_level, branch: def.typical_branch,
          panel_text: def.panel_text || null,
        });
        console.log('[CRT] inject: THREATENED_HEALTHSPAN ← FaP/ED aktivní');
      }
    }
  }

  // Med-injekce uzlů odstraněna — léky nemění strukturu grafu, jen zobrazení pilulek (medications_map níže).

  // medications_map — DETERMINISTICKY z STATES_DB.med_targets, žádné AI
  {
    const activeStateIds = new Set([
      ...(crt.nodes || []).map(n => n.id),
      ...(crt.root ? [typeof crt.root === 'string' ? crt.root : crt.root.id] : []),
    ]);

    // Reverse map: drug key (lowercase brand/INN) → [active state_id, ...]
    const drugToStates = {};
    for (const sid of activeStateIds) {
      for (const drug of (STATES_DB[sid]?.med_targets || [])) {
        const k = drug.toLowerCase();
        (drugToStates[k] = drugToStates[k] || []).push(sid);
      }
    }

    const resolvedMap = Object.fromEntries(resolvedMeds.map(m => [m.name.toLowerCase(), m]));
    const dbSuppsSet  = new Set((profile.medications || []).filter(m => m._fromDb === 'supplements').map(m => m.name?.toLowerCase()));
    const medType = name => dbSuppsSet.has(name.toLowerCase()) ? 'protects'
      : (resolvedMap[name.toLowerCase()]?.is_supplement ? 'protects' : 'treatment');

    // Pass 1: přiřaď každý lék ze State Dictionary (brand nebo INN lookup)
    const primaryMeds = [];
    for (const m of (profile.medications || [])) {
      const name    = (m.name || m || '').trim();
      if (!name) continue;
      const nameLow = name.toLowerCase();
      const dbEntry = DRUGS_DB[nameLow];

      if (dbEntry?.no_canvas) { console.log(`[CRT] no_canvas: ${name}`); continue; }

      let targets = drugToStates[nameLow] || [];
      // INN fallback: zkus drugs.json INN, pak Haiku-resolved INN (pro léky mimo drugs.json)
      if (!targets.length) {
        const inn = dbEntry?.inn || resolvedMap[nameLow]?.inn;
        if (inn) targets = drugToStates[inn.toLowerCase()] || [];
      }
      // Dedup: pokud lék sedí do více aktivních stavů, vezmi jen ten s nejvyšším levelem
      if (targets.length > 1) {
        targets = [targets.reduce((best, sid) =>
          (STATES_DB[sid]?.typical_level ?? 0) > (STATES_DB[best]?.typical_level ?? 0) ? sid : best
        )];
      }

      const indication = resolvedMap[nameLow]?.effect || resolvedMap[dbEntry?.inn?.toLowerCase()]?.effect || dbEntry?.effect || '';
      primaryMeds.push({
        name,
        targets:      [...targets],
        effect:       dbEntry?.effect || '',
        note:         indication,
        type:         medType(name),
        reason:       dbEntry?.effect || '',
        _nameLow:     nameLow,
        _inn:         dbEntry?.inn?.toLowerCase(),
        _companionFor: dbEntry?.companion_for?.toLowerCase(),
      });
    }

    // Pass 2: companion_for → sdílí uzel s primárním lékem
    for (const comp of primaryMeds.filter(m => m._companionFor && !m.targets.length)) {
      const pk      = comp._companionFor;
      const pkInn   = DRUGS_DB[pk]?.inn?.toLowerCase();
      const primary = primaryMeds.find(p => p._nameLow === pk || p._inn === pk || p._nameLow === pkInn);
      if (primary?.targets?.length) {
        comp.targets = [primary.targets[0]];
        console.log(`[CRT] companion ${comp.name} → ${comp.targets[0]} (via ${pk})`);
      }
    }

    // Build medTargetMap pro interakce
    const medTargetMap = {};
    primaryMeds.forEach(m => {
      [m._nameLow, m._inn].filter(Boolean).forEach(k => {
        m.targets.forEach(tid => { (medTargetMap[k] = medTargetMap[k] || new Set()).add(tid); });
      });
    });

    // Interakce — zobrazit na KAŽDÉM uzlu kde je JAKÝKOLIV lék z páru (union targets)
    const warningMeds = resolvedInteractions.map(ix => {
      const targets = new Set();
      ix.drugs.forEach(drug => {
        const key = drug.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        (medTargetMap[key] || new Set()).forEach(t => targets.add(t));
      });
      return { name: ix.drugs.join(' + '), targets: [...targets], effect: ix.note || '', type: 'warning', reason: ix.note || '' };
    }).filter(w => w.targets.length);
    if (warningMeds.length) console.log(`[CRT] interakce: ${warningMeds.map(w => `${w.name}→${w.targets.join(',')}`).join(' | ')}`);

    // Fallback: lék bez shody → nejvyšší uzel úrovně ≥1 (root a level-0 jsou z pill renderování vyloučeny)
    const fallbackNode = (crt.nodes || [])
      .filter(n => (n.level ?? 0) >= 1)
      .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
    const fallbackId = fallbackNode?.id || (typeof crt.root === 'string' ? crt.root : crt.root?.id);
    primaryMeds.forEach(m => {
      if (m.targets.length) {
        console.log(`[CRT] ${m.name} → ${m.targets.join(', ')}`);
      } else if (fallbackId) {
        m.targets = [fallbackId];
        console.log(`[CRT] ${m.name} → fallback ${fallbackId}`);
      } else {
        console.log(`[CRT] ${m.name} → no state match (lékárna only)`);
      }
    });

    // Strip internal fields
    crt.medications_map = [
      ...primaryMeds.map(({ _nameLow, _inn, _companionFor, ...rest }) => rest),
      ...warningMeds,
    ];
  }

  // Post-processing: typical_children — přidej hrany které GPT-4o vynechal
  {
    const edgeSet = new Set((crt.edges || []).map(e => `${e.from}→${e.to}`));
    const allActiveIds = new Set([
      ...(crt.nodes || []).map(n => n?.id),
      ...(crt.root ? [typeof crt.root === 'string' ? crt.root : crt.root.id] : []),
    ]);
    const allNodesForTC = [...(crt.nodes || [])];
    if (crt.root && typeof crt.root === 'object') allNodesForTC.push(crt.root);
    allNodesForTC.forEach(n => {
      const def = STATES_DB[n?.id];
      if (!def?.typical_children) return;
      for (const childId of def.typical_children) {
        if (!allActiveIds.has(childId)) continue;
        const key = `${n.id}→${childId}`;
        if (!edgeSet.has(key)) {
          crt.edges = crt.edges || [];
          crt.edges.push({ from: n.id, to: childId });
          edgeSet.add(key);
          console.log(`[CRT] typical_children hrana: ${n.id} → ${childId}`);
        }
      }
    });
  }

  // Odstraň injektované uzly bez vstupní hrany — floatovaly by; pilulka zůstane přes root fallback
  {
    const hasIncoming = new Set((crt.edges || []).map(e => e.to));
    const before = crt.nodes.length;
    crt.nodes = crt.nodes.filter(n => {
      if (n._injected && !hasIncoming.has(n.id)) {
        console.log(`[CRT] injected orphan odstraněn: ${n.id}`);
        return false;
      }
      return true;
    });
    if (crt.nodes.length < before) {
      // Odstraň i hrany vedoucí z odstraněných uzlů
      const remaining = new Set(crt.nodes.map(n => n.id));
      if (crt.root) remaining.add(typeof crt.root === 'string' ? crt.root : crt.root.id);
      crt.edges = (crt.edges || []).filter(e => remaining.has(e.from) && remaining.has(e.to));
    }
  }

  // Post-processing: odstraň hrany porušující topologická pravidla
  crt.edges = validateEdges(crt.nodes, crt.root, crt.edges || []);

  // Připoj uzly bez výstupní hrany (orphan apex) k hlavnímu apexu
  crt.edges = connectOrphans(crt.nodes, crt.root, crt.edges);
  // Připoj uzly bez vstupní hrany (orphan source) k nejbližšímu nižšímu uzlu
  crt.edges = connectSourceless(crt.nodes, crt.root, crt.edges);

  // Personalizovaný panel_text pro kořenové uzly (Sonnet 5) — jen pokud jsou doctor_notes
  // Bez doctor_notes je strom příliš tenký na smysluplný příběh + šetří 10–15s timeout
  if (profile.doctor_notes && profile.doctor_notes.trim().length > 20) {
    const allActiveForPanel = [...(crt.nodes || [])];
    if (crt.root && typeof crt.root === 'object') allActiveForPanel.push(crt.root);
    await generatePanelTexts(allActiveForPanel, crt.edges || [], profile);
  }

  // Behavior warnings: připoj personalizované varování z profilu na aktivní uzly
  const behaviorFlags = profile?.behavior_flags || {};
  const allActive = [...(crt.nodes || [])];
  if (crt.root && typeof crt.root === 'object') allActive.push(crt.root);
  if (Object.keys(behaviorFlags).length) {
    allActive.forEach(n => {
      if (behaviorFlags[n.id]) n.behavior_warning = behaviorFlags[n.id];
    });
  }

  return crt;
}

// Vygeneruje personalizovaný panel_text pro každý kořenový uzel (Sonnet 5)
// Příběh: jak kořen ZPŮSOBUJE problémy výše — kauzální řetěz konkrétní pro tohoto pacienta
async function generatePanelTexts(allNodes, edges, profile) {
  const rootNodes = allNodes.filter(n => (n.level ?? 99) === 0 && n.id);
  if (!rootNodes.length) return;

  const nodeById = Object.fromEntries(allNodes.map(n => [n.id, n]));
  const childrenOf = {};
  (edges || []).forEach(e => { (childrenOf[e.from] = childrenOf[e.from] || []).push(e.to); });

  // BFS: projdi celou větev od kořene, sesbírej popisky uzlů
  const tracePath = (rootId) => {
    const visited = new Set(), queue = [rootId], labels = [];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const n = nodeById[id];
      if (n) labels.push(n.label_layman || n.label);
      (childrenOf[id] || []).forEach(cid => { if (!visited.has(cid)) queue.push(cid); });
    }
    return labels;
  };

  const rootDescriptions = rootNodes.map(r => ({
    id: r.id,
    label: r.label_layman || r.label,
    path: tracePath(r.id).join(' → '),
  }));

  const patientAge  = profile.birth_year ? `${new Date().getFullYear() - profile.birth_year} let` : '';
  const patientSex  = profile.sex === 'F' ? 'Žena' : profile.sex === 'M' ? 'Muž' : '';
  const patientDesc = [patientSex, patientAge].filter(Boolean).join(', ') || 'Pacient';
  const diagText    = (profile.diagnoses || []).join(', ') || '';

  const emptyJson = JSON.stringify(Object.fromEntries(rootDescriptions.map(r => [r.id, '...'])));

  const prompt = `Jsi lékař-kouč. Pro každý kořenový uzel CRT stromu napiš panel_text: 3–4 věty, česky, tykáním.

Pravidla:
- Celý text v TY formě — "hůř usínáš", "cítíš se unavená", "tvoje tělo". Přivlastňovací zájmena (tvůj/tvoje/tvé) používej max 1–2× v celém textu, ne před každým podstatným jménem.
- Příběh: jak tento kořen ZPŮSOBUJE problémy výše v grafu — sleduj kauzální cestu krok za krokem
- Konkrétní — zmiň co se děje přímo v těle pacienta (nervy, nohy, kosti, srdce...)
- Konči kauzálním důsledkem — BEZ rad, BEZ "na tomhle máš vliv", BEZ obecných doporučení
- Hormonální/genetický kořen (štítná žláza): konec = dopad, ne rada
- Žádné fráze: je důležité, musíš, okamžitě, hrozí, měl bys, máš vliv, dokáže zpomalit

Pacient: ${patientDesc}${diagText ? '. Diagnózy: ' + diagText : ''}.

Kořeny a kauzální cesty:
${rootDescriptions.map(r => `[${r.id}] ${r.label}\nCesta: ${r.path}`).join('\n\n')}

Vrať jen JSON bez markdown: ${emptyJson}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Sonnet panel_text ${res.status}`);
    const data = await res.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const jsonMatch = (textBlock?.text || '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in panel_text response');
    const panelTexts = JSON.parse(jsonMatch[0]);
    rootNodes.forEach(n => {
      if (panelTexts[n.id]) {
        n.panel_text = panelTexts[n.id];
        console.log(`[CRT] panel_text: ${n.id}`);
      }
    });
  } catch (e) {
    console.warn('[CRT] panel_text generation failed:', e.message);
    // fallback: State Dictionary panel_text (aplikováno dříve v applyStateLabels)
  }
}

// Vygeneruje behaviorální doporučení pro nejdůležitější uzel bez manuálního flagu
async function generateAutoFlag(allNodes, profile) {
  // Cíl: pouze junction uzly (AND-join body = akční body) bez behavior_warning
  // UDE uzly přeskočíme — jsou to dopady, ne místa kde lze ihned zasáhnout
  const candidate = allNodes
    .filter(n => n.type === 'junction' && !n.behavior_warning)
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))[0];
  if (!candidate) return;

  const diagText = (profile.diagnoses || []).join(', ') || 'neuvedeno';
  const goal = profile.goal_text || '';

  const userMsg = `Jsi CHJ — průvodce zdravím. Napiš JEDNU větu (max 12 slov) — konkrétní behaviorální akci pro pacienta.

Diagnózy: ${diagText}
Cíl: ${goal || 'zlepšit zdraví'}
Klíčový uzel: ${candidate.label || candidate.id} (${candidate.type === 'junction' ? 'konvergenční bod' : 'hlavní projev'})

Jedna věta, čeština, tykání, bez uvozovek:`;

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 80, messages: [{ role: 'user', content: userMsg }] }),
    });
    if (!aiRes.ok) throw new Error(`Haiku ${aiRes.status}`);
    const data = await aiRes.json();
    const text = (data.content?.[0]?.text || '').trim();
    if (text) {
      candidate.behavior_warning = text;
      candidate._behavior_auto = true;
      console.log(`[CRT] auto_flag: ${candidate.id} → "${text}"`);
    }
  } catch (e) {
    console.warn('[CRT] auto_flag failed:', e.message);
  }
}

// Odstraní cross-branch hrany (L↔R) a hrany jdoucí dolů nebo po stejné úrovni
function validateEdges(nodes, root, edges) {
  const allNodes = [...(nodes || [])];
  if (root) allNodes.push(root);
  const nodeById = Object.fromEntries(allNodes.map(n => [n.id, n]));

  return edges.filter(e => {
    const from = nodeById[e.from];
    const to   = nodeById[e.to];
    if (!from || !to) return true;

    // Musí jít nahoru (větší level = vyšší pozice v DU grafu)
    if ((from.level ?? 0) >= (to.level ?? 0)) {
      console.log(`[CRT validate] odstraněna hrana ${e.from}(L${from.level})→${e.to}(L${to.level}): nejde nahoru`);
      return false;
    }

    const fb = from.branch, tb = to.branch;

    // Level skip uvnitř stejné větve (L→L nebo R→R, jump > 1) = redundantní POUZE pokud
    // z from vede hrana na mezilehlý uzel stejné větve (jinak je skip nutný přímý spoj)
    if ((fb === 'L' && tb === 'L') || (fb === 'R' && tb === 'R')) {
      const levelDiff = (to.level ?? 0) - (from.level ?? 0);
      if (levelDiff > 1) {
        const fromLv = from.level ?? 0, toLv = to.level ?? 0;
        const hasIntermediate = edges.some(e2 => {
          if (e2.from !== e.from || e2.to === e.to) return false;
          const mid = nodeById[e2.to];
          return mid && mid.branch === fb && (mid.level ?? 0) > fromLv && (mid.level ?? 0) < toLv;
        });
        if (hasIntermediate) {
          console.log(`[CRT validate] odstraněna redundantní same-branch hrana: ${e.from}(${fb},L${from.level})→${e.to}(${tb},L${to.level})`);
          return false;
        }
      }
    }
    // Junction uzly (AND-join): povoleny pouze hrany do jejich typical_children
    if (from.type === 'junction') {
      const def = STATES_DB[from.id];
      const allowed = def?.typical_children || [];
      if (!allowed.includes(e.to)) {
        console.log(`[CRT validate] odstraněna hrana z junction ${e.from}→${e.to}: není v typical_children [${allowed.join(',')}]`);
        return false;
      }
    }

    // Zakázáno: levý sloupec (L/LC) ↔ pravý sloupec (RC/R) — vizuální křížení
    const isLeft = b => b === 'L' || b === 'LC';
    const isRight = b => b === 'RC' || b === 'R';
    if ((isLeft(fb) && isRight(tb)) || (isRight(fb) && isLeft(tb))) {
      console.log(`[CRT validate] odstraněna cross-column hrana: ${e.from}(${fb})→${e.to}(${tb})`);
      return false;
    }
    // Intra-column (L↔LC nebo R↔RC) jsou v TÉŽE vizuální koloně (branchToCol3 mapuje oba na L/R)
    // → upward hrany L→LC, R→RC jsou povoleny; downward/backward zachytí pravidlo must-go-up výše
    // Zakázáno: C→L nebo C→R mimo root (center nesmí krmit zpět do větve)
    // Root (level 0) smí startovat obě větve
    if (fb === 'C' && (tb === 'L' || tb === 'R') && (from.level ?? 0) > 0) {
      console.log(`[CRT validate] odstraněna center→branch hrana: ${e.from}(C,L${from.level})→${e.to}(${tb})`);
      return false;
    }
    // Zakázáno: L nebo R → C junction na levelu < 3 (příliš nízko — křížení)
    if ((fb === 'L' || fb === 'R') && tb === 'C' && (to.level ?? 0) < 3) {
      console.log(`[CRT validate] odstraněna low-level ${fb}→C hrana: ${e.from}(L${from.level})→${e.to}(C,L${to.level})`);
      return false;
    }
    // Zakázáno: L nebo R → C s přeskokem > 3 úrovní (skip=3 povolen: HYPERURICEMIA L0→ENDOTHELIAL L3)
    if ((fb === 'L' || fb === 'R') && tb === 'C' && (to.level ?? 0) - (from.level ?? 0) > 3) {
      console.log(`[CRT validate] odstraněna long-skip ${fb}→C hrana: ${e.from}(L${from.level})→${e.to}(C,L${to.level})`);
      return false;
    }

    return true;
  });
}

// Připoj uzly bez výstupní hrany (orphan apex) k hlavnímu apexu stromu
function connectOrphans(nodes, root, edges) {
  const allNodes = [...(nodes || [])];
  if (root) allNodes.push(root);

  // Hlavní apex = uzel s nejvyšším levelem (branch C, nebo max level celkově)
  const mainApex = allNodes.reduce((best, n) =>
    (n.level ?? 0) > (best?.level ?? -1) ? n : best, null);
  if (!mainApex) return edges;

  const hasSources = new Set(edges.map(e => e.from));
  const result = [...edges];

  allNodes.forEach(n => {
    if (n.id === mainApex.id) return;
    if (n.id === root?.id) return;
    if (n._injected) return; // injektované uzly nemají kauzální vztah → žádné hrany
    if (n.type === 'ude') return; // UDE uzly jsou legitimní apex — nepřipojovat k jinému apexu
    if (n.type === 'cause' && (STATES_DB[n.id]?.typical_children?.length ?? 0) > 0) return; // cause s definovanými potomky = jejich downstream jen není aktivní, není to sirotčí stav
    if (!hasSources.has(n.id)) {
      // Orphan — hledej nejbližší vyšší uzel (ne rovnou apex — zabráníme dlouhé diagonále)
      const nextLevel = (n.level ?? 0) + 1;
      const candidate = allNodes.find(u =>
        u.id !== n.id &&
        (u.level ?? 0) === nextLevel &&
        (u.branch === n.branch || u.branch === 'C' || n.branch === 'C')
      );
      const target = candidate || mainApex;
      console.log(`[CRT] orphan připojen: ${n.id}(L${n.level}) → ${target.id}(L${target.level ?? '?'})`);
      result.push({ from: n.id, to: target.id });
    }
  });

  return result;
}

// Připoj uzly bez vstupní hrany (orphan source) k nejbližšímu nižšímu uzlu stejné větve
function connectSourceless(nodes, root, edges) {
  const allNodes = [...(nodes || [])];
  if (root) allNodes.push(root);

  const hasTargets = new Set(edges.map(e => e.to));
  const result = [...edges];

  allNodes.forEach(n => {
    if (n.id === root?.id) return;
    if (n._injected) return; // injektované uzly — žádné vstupní hrany, floating
    if (hasTargets.has(n.id)) return;

    const candidates = allNodes.filter(c =>
      c.id !== n.id &&
      (c.level ?? 0) < (n.level ?? 0) &&
      (c.branch === n.branch || c.branch === 'C' || n.branch === 'C')
    ).sort((a, b) => (b.level ?? 0) - (a.level ?? 0));

    if (candidates.length) {
      const parent = candidates[0];
      console.log(`[CRT] sourceless napojení: ${parent.id}(L${parent.level}) → ${n.id}(L${n.level})`);
      result.push({ from: parent.id, to: n.id });
    }
  });

  return result;
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

// Verze cache — dvě nezávislé osy:
// _v_ai: bump POUZE při změně Sonnet promptu → invaliduje AI generování
// _v_pp: bump při změně post-processingu (med-inject, validateEdges...) → přeskočí Sonnet, re-run PP
const _v_ai = 12;
const _v_pp = 97; // fix: STROKE_RISK z ENDOTHELIAL_DYSFUNCTION typical_children — aktivuje se jen keyword matchem (mrtvice/TIA/CMP)

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return String(h >>> 0);
}

// Hash dat + AI verze — určuje jestli je třeba volat Sonnet
function aiHash(ctx, modelId) {
  return hashStr(JSON.stringify({
    _v_ai,
    model:       modelId || 'claude-sonnet-5',
    diagnoses:   ctx.profile.diagnoses || [],
    doctor_notes: ctx.profile.doctor_notes || '',
    labs:        ctx.profile.labs || {},
    goal:        ctx.profile.goal_text || '',
    metrics:     ctx.metrics.map(m => `${m.node_id}:${m.state}`).sort(),
  }));
}

// Hash dat + obě verze — určuje jestli je platný celý výsledek (včetně PP)
function dataHash(ctx, modelId) {
  return hashStr(JSON.stringify({
    _v_ai,
    _v_pp,
    model:       modelId || 'claude-sonnet-5',
    diagnoses:   ctx.profile.diagnoses || [],
    doctor_notes: ctx.profile.doctor_notes || '',
    medications: (ctx.profile.medications || []).map(m => m.name),
    labs:        ctx.profile.labs || {},
    lifestyle:   ctx.profile.lifestyle || {},
    capacity:    ctx.profile.capacity || {},
    goal:        ctx.profile.goal_text || '',
    metrics:     ctx.metrics.map(m => `${m.node_id}:${m.state}`).sort(),
    sleep_avg:   ctx.checkins && ctx.checkins.length >= 5
      ? (ctx.checkins.filter(c => c.sleep_hours != null).reduce((s, c) => s + c.sleep_hours, 0) /
         ctx.checkins.filter(c => c.sleep_hours != null).length).toFixed(1)
      : null,
  }));
}

export { buildDeterministicCRT, STATES_DB, STATES_ARR, DRUGS_DB, DIAGNOSIS_KEYWORDS };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, role = 'longevity', force = false, model: modelParam, mockProfile } = req.body || {};

  // Výběr modelu: Fable default, Sonnet 5 jako fallback při refusal
  const MODEL_MAP = {
    haiku:   { id: MODELS.crt,       maxTokens: 16000 },
    sonnet5: { id: MODELS.fallback,  thinking: true,  effort: 'low', maxTokens: 16000 },
    fable:   { id: 'claude-fable-5', thinking: true,  effort: 'low', maxTokens: 64000 },
    gpt4o:   { id: 'gpt-4o',         provider: 'openai',             maxTokens: 16000 },
  };
  const modelCfg = MODEL_MAP[modelParam] || MODEL_MAP.haiku;
  const fallbackCfg = MODEL_MAP.sonnet5;

  // Dev mock: mockProfile v POST body přeskočí Supabase (jen pokud chybí userId nebo je userId === 'mock')
  if (mockProfile && (!userId || userId === 'mock')) {
    const mockCtx = {
      metrics: [],
      profile: mockProfile,
      checkins: [],
      nodeInputs: [],
    };
    try {
      const result = await generateCRT(mockCtx, role, modelCfg);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ ...result, _mock: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (!userId) return res.status(401).json({ error: 'Přihlaste se pro zobrazení mapy.' });

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Načti všechny zdroje dat
    const ctx = userId ? await fetchContext(userId, role) : { metrics: [], profile: {}, checkins: [], nodeInputs: [] };
    const hash    = dataHash(ctx, modelCfg.id);
    const hashAI  = aiHash(ctx, modelCfg.id);
    console.log(`[CRT] userId=${userId} role=${role} hash=${hash} hashAI=${hashAI}`);

    // 0. Zkus server-side cache
    let cachedRawAI = null;
    if (userId) {
      const { data: prof } = await supabase
        .from('user_health_profile')
        .select('crt_cache, crt_cache_hash')
        .eq('user_id', userId)
        .single();

      if (!force && prof?.crt_cache && prof?.crt_cache_hash === hash) {
        console.log('[CRT] full cache hit');
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ...prof.crt_cache, _cached: true });
      }
      // Partial hit: AI výstup platný, jen PP se změnil → přeskočíme Sonnet
      if (!force && prof?.crt_cache?._raw_ai_hash === hashAI && prof?.crt_cache?._raw_ai) {
        cachedRawAI = prof.crt_cache._raw_ai;
        console.log('[CRT] partial cache hit — AI přeskočen, re-run PP');
      }
    }

    // 2. Claude vygeneruje strom — nebo vezme z AI cache
    let crt;
    if (cachedRawAI) {
      // Re-run jen post-processing na uloženém AI výstupu
      crt = await generateCRT({ ...ctx, _rawAI: cachedRawAI }, role, modelCfg);
    } else {
      try {
        crt = await generateCRT(ctx, role, modelCfg);
      } catch (e) {
        if (modelCfg.id === 'claude-fable-5' && e.message?.includes('refusal')) {
          console.warn('[CRT] Fable refusal — přepínám na Sonnet 5');
          crt = await generateCRT(ctx, role, fallbackCfg);
        } else {
          throw e;
        }
      }
    }

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
    const fixLabel = s => s ? LABEL_FIXES.reduce((t, [re, v]) => t.replace(re, v), s) : (s ?? '');
    // Sanitizace — GPT-4o někdy vrátí strings nebo null místo objektů v nodes
    if (crt.root && typeof crt.root === 'string') {
      const rootId = crt.root;
      crt.root = (crt.nodes || []).find(n => n?.id === rootId) || { id: rootId, label: rootId, level: 0, branch: 'C' };
    }
    crt.nodes = (crt.nodes || []).filter(n => n && typeof n === 'object');
    if (crt.root) crt.root.label = fixLabel(crt.root.label);
    (crt.nodes || []).forEach(n => { n.label = fixLabel(n.label); });
    (crt.injections || []).filter(n => n && typeof n === 'object').forEach(n => { n.label = fixLabel(n.label); });

    // 3. Sestav seznam všech uzlů
    // crt.root může být null (Haiku při multi-root vrátí null) → guard na id
    const rootEntry = (crt.root?.id)
      ? { ...crt.root, type: 'golden_box', level: crt.root.level ?? 0, branch: crt.root.branch || 'C' }
      : null;
    const allNodes = [
      ...(rootEntry ? [rootEntry] : []),
      ...(crt.nodes || []),
    ].filter(n => n?.id); // guard: žádný uzel bez id (prázdný box)

    // Debug: log level-0 uzly — najdi zdroj prázdného zlatého boxu
    console.log('[CRT] root=', JSON.stringify({ id: crt.root?.id, label: crt.root?.label, level: crt.root?.level, branch: crt.root?.branch }));
    const lvl0 = allNodes.filter(n => (n.level ?? 99) === 0);
    console.log('[CRT] level-0 uzly:', lvl0.map(n => `${n.id}|${n.label}|${n.label_layman}|${n.type}|${n.branch}`).join(', '));

    // 4. Auto-pozicování
    calcPositions(allNodes, crt.edges || []);

    // 5. Overlay barev (bez barev — jen mapování stavu pro případné budoucí použití)
    const coloredNodes = overlayColors(allNodes, ctx.metrics);

    // Extrahuj behavior_flags do top-level mapy pro TTS
    const behaviorFlagsMap = {};
    coloredNodes.forEach(n => { if (n.behavior_warning) behaviorFlagsMap[n.id] = n.behavior_warning; });

    const result = {
      title:      'Kauzální mapa zdraví',
      subtitle:   'Current Reality Tree — generováno z vašich dat',
      nodes:      coloredNodes,
      edges:      crt.edges || [],
      and_joins:  crt.and_joins || [],
      injections:      crt.injections || [],
      medications_map: crt.medications_map || [],
      behavior_flags:  behaviorFlagsMap,
      has_data:        ctx.metrics.length > 0 || !!ctx.profile.diagnoses,
    };

    // Ulož do server-side cache — včetně raw AI snapshotu pro partial hit
    if (userId) {
      const rawAIToSave = crt._raw_ai_snapshot || null;
      const cachePayload = { ...result, _raw_ai: rawAIToSave, _raw_ai_hash: rawAIToSave ? hashAI : null };
      const { error: cacheErr } = await supabase.from('user_health_profile')
        .upsert({ user_id: userId, crt_cache: cachePayload, crt_cache_hash: hash, crt_cache_at: new Date().toISOString() },
                { onConflict: 'user_id' });
      if (cacheErr) console.warn('[CRT] cache save failed:', cacheErr.message);
      else console.log('[CRT] cache saved, hash=', hash);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json(result);

  } catch (e) {
    console.error('[CRT] generate error:', e.message);
    res.status(500).json({ error: 'CRT generation failed', detail: e.message });
  }
}
