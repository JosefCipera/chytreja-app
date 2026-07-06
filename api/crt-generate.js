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
      model: 'claude-haiku-4-5',
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

  const systemPrompt = `Jsi špičkový expert na Goldrattovu Teorii omezení (TOC) a preventivní medicínu dlouhověkosti (Medicine 3.0). Tvým úkolem je analyzovat zdravotní data pacienta a sestavit perfektní, čistý a logicky neprůstřelný Current Reality Tree (CRT) ve formátu JSON. Výstup je zpracováván skriptem, který podle parametrů 'level' a 'branch' natvrdo počítá souřadnice pro SVG vykreslení.

### ⚠️ ZÁVAZNÁ MATEMATICKÁ PRAVIDLA PRO LEVELING A TOPOLOGII:
Parametry \`level\` (0 až 6) a \`branch\` (L/R/C) určují absolutní polohu uzlu na obrazovce. Musíš je generovat podle těchto striktních pravidel, jinak se vizuální mapa rozpadne:

1. PRAVIDLO KAUZÁLNÍHO STOUPÁNÍ (Osa Y):
   - Pokud uzel A způsobuje uzel B, pak uzel B MUSÍ mít parametr \`level\` minimálně o 1 vyšší než uzel A (např. uzel A má level 2, uzel B má level 3).
   - Příčina a její přímý následek NESMÍ mít nikdy stejný level!

2. PRAVIDLO PRO PARALELNÍ VĚTVE (Osa X):
   - Uzly v levé větvi (branch: "L") a pravé větvi (branch: "R") se vyvíjejí nezávisle.
   - Na stejný level smíš dát uzel z L a uzel z R POUZE tehdy, pokud jsou v kauzálním řetězci stejně vzdálené od kořene (Level 0). Nesnaž se je uměle zarovnávat horizontálně, pokud jedna větev stoupá rychleji.

3. PRAVIDLO ŽÁDNÝCH SLEPÝCH ULIČEK (No Dead Ends):
   - Každý uzel v grafu, kromě samotného vrcholu (Level 6), MUSÍ mít alespoň jednu výstupní hranu (edge) směřující do uzlu na vyšším levelu. Žádný uzel nesmí zůstat "viset" bez následníka.

4. SBÍHAVOST DO JEDNOHO VRCHOLU (Finální trychtýř):
   - Na samém vrcholu (Level 6, branch: "C") musí být vždy přesně JEDNO HLAVNÍ ULTIMATE UDE (např. "Riziko infarktu a CMP").
   - Pokud máš na Level 4 nebo 5 dvě závažná UDE (např. "Problémy s erekcí" v L větvi a "Fibrilace síní" v R větvi), obě z nich MUSÍ mít výstupní hranu vedoucí nahoru. Buď se slijí do společného uzlu na Level 5, nebo obě samostatně odkazují hranou přímo do finálního Ultimate UDE na Level 6.

5. PRAVIDLO ČISTÝCH VĚTVÍ — ABSOLUTNÍ ZÁKAZ KŘÍŽENÍ:
   - Uzel branch="L" smí mít hranu (edge "from") VÝHRADNĚ do uzlů branch="L" nebo do junction/C uzlu na vyšším levelu.
   - Uzel branch="R" smí mít hranu (edge "from") VÝHRADNĚ do uzlů branch="R" nebo do junction/C uzlu na vyšším levelu.
   - POVOLENO: root (L0, C) → uzel L nebo R větve. POVOLENO: L větev → junction C nahoře. POVOLENO: R větev → junction C nahoře.
   - ZAKÁZÁNO: hrana z L uzlu do R uzlu nebo naopak kdekoliv uprostřed stromu.
   - ZAKÁZÁNO: uzel A (branch L) má hranu do uzlu B (branch R) i kdyby byl B na vyšším levelu — musí projít přes junction.
   - PROČ: renderovací engine kreslí hrany přímo. Jakákoli cross-branch hrana vytvoří vizuální křížení šipek, které mapu znehodnotí.

### FORMÁT VÝSTUPU:
Vrať POUZE validní JSON bez jakéhokoliv doprovodného textu.

{
  "root": "node_root",
  "nodes": [
    { "id": "node_id", "level": 0, "branch": "C", "type": "cause", "label": "Stručný odborný název (max 5 slov)", "label_layman": "Jednoduché vysvětlení pro laika (max 6 slov)" }
  ],
  "edges": [
    { "from": "node_id", "to": "node_id" }
  ],
  "and_joins": [],
  "injections": [],
  "universe_map": [
    { "node_id": "node_id", "universe": "cardio/metabolism" }
  ],
  "medications_map": [
    { "medication": "Název", "target_node_id": "node_id", "type": "treatment/protects/warning", "label": "Co dělá v těle" }
  ]
}

### KRITICKÁ PRAVIDLA PRO OBSAH UZLŮ — GOLDRATTOVA CRT:

6. TYPY UZLŮ A CO DO NICH PATŘÍ:

   **ROOT (Level 0, branch C, type "cause")** = jediný kořenový systémový bottleneck.
   - Musí být KONKRÉTNÍ fyziologický/metabolický stav — ne vágní shrnutí!
   - ✅ "Chronická inzulínová rezistence a hyperglykémie"
   - ✅ "Metabolický syndrom — viscerální tuk a inzulinová rezistence"
   - ❌ ZAKÁZÁNO: "Tělo dlouhodobě strádá", "Celkové oslabení organismu", "Komplexní zdravotní stav" — příliš vágní!
   - Root = jediná nejhlubší systémová příčina ze které vychází celý strom.

   **CAUSE (Level 1–3)** = konkrétní patofyziologický mechanismus odvozený z root.
   - ✅ "Ateroskleróza mozkových tepen", "Neuropatie periferních nervů"
   - ❌ ZAKÁZÁNO: anamnestická fakta jako "Prodělal mrtvici v roce X" — toto je vstupní podmínka, ne příčina v CRT!
   - Anamnéza (prodělané nemoci) patří jako kontext pro výběr root, NIKDY jako standalone uzel.

   **UDE = Undesirable Effect (Level 4–5)** = stav, který pacient AKTUÁLNĚ prožívá negativně a lze ho pozorovat.
   - ✅ "Chronická bolest zad omezuje pohyb" (pacient to teď cítí)
   - ✅ "Nestabilní chůze a třes rukou" (pozorovatelné nyní)
   - ❌ ZAKÁZÁNO: prognózy a předpoklady jako "na hraně kolapsu", "hrozí pád", "pacient křehne" — to jsou budoucí rizika, ne aktuální UDE!
   - ❌ ZAKÁZÁNO: past tense jako "prodělal", "byl hospitalizován", "utrpěl" — CRT popisuje SOUČASNOU realitu.

   **ULTIMATE UDE (Level 6, branch C)** = jediný bod sbíhání, smí být prognostický.
   - ✅ "Hrozí recidiva mrtvice nebo imobilizace" — apex smí popisovat budoucí riziko, protože je to cíl celého stromu.

   **JUNCTION (Level 4–5, branch C)** = sbíhavý uzel kde se L a R větve setkají před apexem.

7. PRAVIDLO KAUZALITY — KAŽDÁ HRANA MUSÍ MÍT LOGIKU "PROTOŽE":
   - Hrana A→B musí dávat smysl jako: "Protože A, proto B."
   - Pokud si nedokážeš říct "protože X, proto Y", hrana nepatří do grafu.

Typy uzlů: "cause" (příčina), "junction" (spojení dvou větví), "ude" (aktuálně prožívaný negativní stav — Level 4–5).
Level 0 = root, Level 6 = Ultimate UDE (apex). Rozsah: 10–14 uzlů celkem (včetně root).`;

  const userPrompt = `Sestav CRT strom pro tohoto pacienta:

PACIENT: ${profile.birth_year ? (new Date().getFullYear() - profile.birth_year) + 'let' + (profile.sex === 'F' ? 'á' : profile.sex === 'M' ? 'ý' : '') + ' ' : ''}${profile.sex === 'F' ? 'žena' : profile.sex === 'M' ? 'muž' : 'pacient'}
DIAGNÓZY: ${diagText}
LÉKY: ${medsText}
LABS: ${labsText}${sympText !== 'neuvedeno' ? '\nSYMPTOMY: ' + sympText : ''}${doctorText}

SKÓRE UZLŮ (od nejhoršího):
${metricsText}

POSLEDNÍ CHECK-INY:
${checkinText}

HLAVNÍ ULTIMATE UDE NA VRCHOLU (Level 6): urči sám podle všech dat tohoto pacienta — konkrétní prognostické riziko specifické pro něj (ne generické "zhoršení kvality života").

Injections: nejprve léky z profilu (${(profile.medications || []).map(m => m.name || m).join(', ') || 'neuvedeno'}), pak 1–2 životní intervence. Max 4 celkem.

Vrať pouze čistý JSON. Žádný text navíc.`;

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
      ...(modelCfg.thinking ? { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } } : {}),
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  // Fable/Opus s adaptive thinking vrací thinking bloky před textem — hledáme první text blok
  const textBlock = (data.content || []).find(b => b.type === 'text');
  const text = textBlock?.text?.trim() ?? '';
  console.log(`[CRT] model=${modelCfg.id} content blocks:`, (data.content || []).map(b => `${b.type}(${b.text?.length ?? 0})`).join(', '));

  const blocks = (data.content || []).map(b => `${b.type}(${b.text?.length ?? b.thinking?.length ?? '?'})`).join(',');
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Claude nevrátil JSON. Model: ${modelCfg.id}. Blocks: ${blocks}. Text: ${text.slice(0, 300)}`);
  let crt;
  try {
    crt = JSON.parse(jsonMatch[0]);
  } catch(e) {
    throw new Error(`JSON parse error: ${e.message}. Text: ${jsonMatch[0].slice(0, 300)}`);
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

  // medications_map: {medication, target_node_id, type, label} → {name, targets[], effect, type, reason}
  if (Array.isArray(crt.medications_map)) {
    crt.medications_map = crt.medications_map.map(m => ({
      name:    m.medication || m.name || '',
      targets: m.target_node_id ? [m.target_node_id] : (m.targets || []),
      effect:  m.label || m.effect || '',
      type:    m.type || 'treatment',
      reason:  m.label || m.reason || '',
    }));
  }

  // Post-processing: odstraň hrany porušující topologická pravidla
  crt.edges = validateEdges(crt.nodes, crt.root, crt.edges || []);

  // Připoj orphan apex uzly k hlavnímu apexu (validateEdges mohl odebrat jejich hranu)
  crt.edges = connectOrphans(crt.nodes, crt.root, crt.edges);

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
    if (!hasSources.has(n.id)) {
      // Orphan — nemá výstupní hranu, připoj k apexu
      console.log(`[CRT] orphan apex připojen: ${n.id} → ${mainApex.id}`);
      result.push({ from: n.id, to: mainApex.id });
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
    _v:          27, // bump při změně promptu NEBO layout algoritmu → invaliduje cache
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

  // Výběr modelu: sonnet5 default, opus, fable
  // Sonnet 5 má adaptive thinking by default (stejně jako Fable) → thinking:true + effort:low
  const MODEL_MAP = {
    opus:    { id: 'claude-opus-4-8',  thinking: false, maxTokens: 8000 },
    sonnet5: { id: 'claude-sonnet-5',  thinking: true,  maxTokens: 16000 },
    fable:   { id: 'claude-fable-5',   thinking: true,  maxTokens: 16000 },
  };
  const modelCfg = MODEL_MAP[modelParam] || MODEL_MAP.sonnet5;

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

    // 2. Claude vygeneruje strom
    const crt = await generateCRT(ctx, role, modelCfg);

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
