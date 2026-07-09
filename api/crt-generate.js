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
const STATES_ARR = JSON.parse(readFileSync(join(_dir, '../data/crt/longevity-states.json'), 'utf8'));
const STATES_DB  = Object.fromEntries(STATES_ARR.map(s => [s.id, s]));

// ── Modely — měň zde, ne v kódu ──────────────────────────────────────────────
const MODELS = {
  crt:       'claude-fable-5',    // generátor CRT stromu
  fallback:  'claude-sonnet-5',   // fallback při safety refusal
  medparse:  'claude-sonnet-5',   // klasifikace léků (primary_indication, companion_for)
  reassign:  'claude-haiku-4-5',  // reassignment root-only léků (rychlý, levný)
};
// ─────────────────────────────────────────────────────────────────────────────

const DEKATLON_NODE_IDS = ['sila','stabilita','vo2max','kardio','mobilita','vytrvalost','rovnovaha','plyometrie','dychani'];
const LEHKOST_NODE_IDS  = ['vyziva','kardio','spanek','mysl'];

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

  // 2. Zdravotní profil (diagnózy, labs) + léky + suplementy z user_medications
  const [{ data: profile }, { data: meds }] = await Promise.all([
    supabase.from('user_health_profile')
      .select('diagnoses, symptoms, family_history, labs, physical, goal_text, doctor_notes, birth_year, sex, medications, supplements')
      .eq('user_id', userId).single(),
    supabase.from('user_medications')
      .select('name, dose').eq('user_id', userId).eq('active', true),
  ]);
  if (profile) {
    const profileMeds = (profile.medications || []).map(m => ({ name: typeof m === 'string' ? m : m?.name, dose: m?.dose || '' })).filter(m => m.name);
    const profileSupps = (profile.supplements || []).map(s => ({ name: typeof s === 'string' ? s : s?.name, dose: s?.dose || '', _fromDb: 'supplements' })).filter(s => s.name);
    const tableMeds   = meds ?? [];
    const seen = new Set(tableMeds.map(m => m.name?.toLowerCase()));
    const merged = [...tableMeds, ...profileMeds.filter(m => !seen.has(m.name?.toLowerCase()))];
    const seenAll = new Set(merged.map(m => m.name?.toLowerCase()));
    const mergedSupps = profileSupps.filter(s => !seenAll.has(s.name?.toLowerCase()));
    profile.medications = [...merged, ...mergedSupps];
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
        `Jsi farmakologický asistent. Pro každý lék vrať JSON.\nPole: inn, group, effect (česky max 8 slov), primary_indication (česky), companion_for (název léku ke kterému je ochranou, nebo null), is_supplement (true jen volně prodejné vitamíny/minerály).\nVrať POUZE JSON pole:\n[{"name":"...","inn":"...","group":"...","effect":"...","primary_indication":"...","companion_for":null,"is_supplement":false}]\n\nLéky:\n${list}`,
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

async function generateCRT({ metrics, profile, checkins, nodeInputs }, role, modelCfg) {
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
  const { meds: resolvedMeds, interactions: resolvedInteractions } = await resolveMedications(profile.medications || []);
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
- "id" musí být přesně ID ze STATE DICTIONARY.
- "label" a "label_layman" přebírej z STATE DICTIONARY (jsou tam pro každé ID).
- "type" přebírej z STATE DICTIONARY.
- "level" a "branch" nastav podle layout pravidel (použij typical_level a typical_branch jako výchozí bod).
- medications_map NEGENERUJ — léky přiřadí systém deterministicky po tvém výstupu.
- Rozsah: 8–14 uzlů celkem (včetně root).`;

  const hasDoctorNotes = !!(profile.doctor_notes && profile.doctor_notes.trim().length > 20);

  const userPrompt = `Přelož lékařský popis do CRT JSON struktury.

DIAGNÓZY: ${diagText}
LABS: ${labsText}${sympText !== 'neuvedeno' ? '\nSYMPTOMY: ' + sympText : ''}

${hasDoctorNotes
  ? `KAUZÁLNÍ POPIS (zdroj pravdy — přelož přesně, neměň kauzalitu):
${profile.doctor_notes.trim()}

Instrukce: Namapuj každou entitu z KAUZÁLNÍHO POPISU na ID ze STATE DICTIONARY. Zahrň POUZE entity explicitně zmíněné v popisu — neextrapoluj důsledky ani rizika navíc. Apex = poslední entita v popisu (FaP, ED, atd.) — nic nad ní nepřidávej.`
  : `Kauzální popis není k dispozici. Odvoď kauzální řetěz z DIAGNÓZY a LABS. Použij pouze ID ze STATE DICTIONARY.`}

Vrať pouze čistý JSON. Žádný text navíc.`;

  let crt;
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
    if (data.stop_reason === 'refusal' || (usage.output_tokens != null && usage.output_tokens < 150)) {
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
    const applyStateLabels = n => {
      const def = STATES_DB[n?.id];
      if (def) {
        n.label        = def.label;
        n.label_layman = def.label_layman;
        n.type         = def.type;
        n.level        = def.typical_level;   // kanonická hloubka → validateEdges
        n.branch       = def.typical_branch;  // kanonická větev → vis.js pozice
      }
    };
    (crt.nodes || []).forEach(applyStateLabels);
    if (crt.root && typeof crt.root === 'object') applyStateLabels(crt.root);
  }

  // Med-injekce: pokud žádný aktivní stav nemá lék uživatele v med_targets → injektuj stav
  // Bezpečné: injektuje jen stavy ze STATES_DB, bez AI, bez text-matchingu
  {
    const activeIds = new Set([
      ...(crt.nodes || []).map(n => n.id),
      ...(crt.root ? [typeof crt.root === 'string' ? crt.root : crt.root.id] : []),
    ]);
    for (const m of (profile.medications || [])) {
      const nameLow = (m.name || m || '').trim().toLowerCase();
      const inn     = DRUGS_DB[nameLow]?.inn?.toLowerCase();
      if (!nameLow || DRUGS_DB[nameLow]?.no_canvas) continue;

      // Všechny STATES_DB stavy které mají tento lék v med_targets
      const targetStates = STATES_ARR.filter(def =>
        (def.med_targets || []).some(t => t === nameLow || (inn && t === inn))
      );
      // Pokud je alespoň jeden stav aktivní → lék je pokryt, přeskočit
      if (targetStates.some(def => activeIds.has(def.id))) continue;
      // Injektuj stav s nejvyšším typical_level (nejspecifičtější)
      const best = targetStates.reduce((b, d) => (d.typical_level ?? 0) > (b?.typical_level ?? -1) ? d : b, null);
      if (!best) continue;
      if (best.canvas === false) {
        // pharmacy-only stav — jen med_map, žádný canvas uzel
        activeIds.add(best.id);
        console.log(`[CRT] med-injekce (pharmacy only): ${best.id} (via ${nameLow})`);
        continue;
      }
      const injNode = { id: best.id, label: best.label, label_layman: best.label_layman, type: best.type, level: best.typical_level, branch: best.typical_branch, _injected: true };
      crt.nodes.push(injNode);
      activeIds.add(best.id);
      // Pokud má typické potomky, propoj injektovaný uzel k prvnímu dostupnému ve stromu
      const childTarget = (best.typical_children || []).find(cid => activeIds.has(cid));
      if (childTarget) {
        crt.edges = crt.edges || [];
        crt.edges.push({ from: best.id, to: childTarget });
        // _injected zůstává true → connectSourceless nepřidá falešného rodiče
        console.log(`[CRT] med-injekce hrana: ${best.id} → ${childTarget}`);
      }
      console.log(`[CRT] med-injekce: ${best.id} (via ${nameLow})`);
    }
  }

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
      if (!targets.length && dbEntry?.inn)
        targets = drugToStates[dbEntry.inn.toLowerCase()] || [];
      // Dedup: pokud lék sedí do více aktivních stavů, vezmi jen ten s nejvyšším levelem
      if (targets.length > 1) {
        targets = [targets.reduce((best, sid) =>
          (STATES_DB[sid]?.typical_level ?? 0) > (STATES_DB[best]?.typical_level ?? 0) ? sid : best
        )];
      }

      primaryMeds.push({
        name,
        targets:      [...targets],
        effect:       dbEntry?.effect || '',
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

    // Interakce — deterministicky z drugs.json
    const warningMeds = resolvedInteractions.map(ix => {
      const targets = new Set();
      ix.drugs.forEach(drug => {
        const key = drug.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        (medTargetMap[key] || new Set()).forEach(t => targets.add(t));
      });
      return { name: ix.drugs.join(' + '), targets: [...targets], effect: ix.note || '', type: 'warning', reason: ix.note || '' };
    });
    if (warningMeds.length) console.log(`[CRT] interakce: ${warningMeds.map(w => w.name).join(', ')}`);

    primaryMeds.forEach(m => {
      if (m.targets.length) console.log(`[CRT] ${m.name} → ${m.targets.join(', ')}`);
      else                  console.log(`[CRT] ${m.name} → no state match (lékárna only)`);
    });

    // Strip internal fields
    crt.medications_map = [
      ...primaryMeds.map(({ _nameLow, _inn, _companionFor, ...rest }) => rest),
      ...warningMeds,
    ];
  }

  // Post-processing: odstraň hrany porušující topologická pravidla
  crt.edges = validateEdges(crt.nodes, crt.root, crt.edges || []);

  // Připoj uzly bez výstupní hrany (orphan apex) k hlavnímu apexu
  crt.edges = connectOrphans(crt.nodes, crt.root, crt.edges);
  // Připoj uzly bez vstupní hrany (orphan source) k nejbližšímu nižšímu uzlu
  crt.edges = connectSourceless(crt.nodes, crt.root, crt.edges);

  return crt;
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

    // Level skip uvnitř stejné větve (L→L nebo R→R, jump > 1) = redundantní hrana
    // C→C spine a cross-level junction jsou záměrné, neodstraňovat
    if ((fb === 'L' && tb === 'L') || (fb === 'R' && tb === 'R')) {
      if ((to.level ?? 0) - (from.level ?? 0) > 1) {
        console.log(`[CRT validate] odstraněna redundantní same-branch hrana: ${e.from}(${fb},L${from.level})→${e.to}(${tb},L${to.level})`);
        return false;
      }
    }
    // Zakázáno: L↔R (přímé křížení větví)
    if ((fb === 'L' && tb === 'R') || (fb === 'R' && tb === 'L')) {
      console.log(`[CRT validate] odstraněna cross-branch hrana: ${e.from}(${fb})→${e.to}(${tb})`);
      return false;
    }
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

// Stabilní hash vstupních dat — změna dat = nový hash = nový graf
function dataHash(ctx, modelId) {
  const key = JSON.stringify({
    _v:          57, // bump při změně promptu NEBO layout algoritmu → invaliduje cache
    model:       modelId || 'claude-sonnet-5',
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

  const { userId, role = 'longevity', force = false, model: modelParam } = req.body || {};

  // Výběr modelu: Fable default, Sonnet 5 jako fallback při refusal
  const MODEL_MAP = {
    sonnet5: { id: MODELS.fallback,  thinking: true,  effort: 'low', maxTokens: 16000 },
    fable:   { id: MODELS.crt,       thinking: true,  effort: 'low', maxTokens: 64000 },
    gpt4o:   { id: 'gpt-4o',         provider: 'openai',             maxTokens: 16000 },
  };
  const modelCfg = MODEL_MAP[modelParam] || MODEL_MAP.fable;
  const fallbackCfg = MODEL_MAP.sonnet5;

  if (!userId) return res.status(401).json({ error: 'Přihlaste se pro zobrazení mapy.' });

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Načti všechny zdroje dat
    const ctx = userId ? await fetchContext(userId, role) : { metrics: [], profile: {}, checkins: [], nodeInputs: [] };
    const hash = dataHash(ctx, modelCfg.id);
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

    // 2. Claude vygeneruje strom — Fable fallback na Sonnet 5 při safety refusal
    let crt;
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
    const allNodes = [
      { ...crt.root, type: 'golden_box', level: 0, branch: 'C' },
      ...(crt.nodes || []),
    ];

    // 4. Auto-pozicování
    calcPositions(allNodes, crt.edges || []);

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

    // Ulož do server-side cache — upsert (update selžel tiše pokud řádek neexistuje)
    if (userId) {
      const { error: cacheErr } = await supabase.from('user_health_profile')
        .upsert({ user_id: userId, crt_cache: result, crt_cache_hash: hash, crt_cache_at: new Date().toISOString() },
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
