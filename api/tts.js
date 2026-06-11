// =====================================================
// API ENDPOINT: /api/tts.js — ElevenLabs Text-to-Speech
//
// Mode A — přímý text:
//   POST { text, voiceId? } → audio/mpeg stream
//
// Mode B — AI briefing (kontext → text → hlas):
//   POST { context: { hour, pct, killer, action, streak? }, voiceId? }
//   → OpenAI generuje mluvený text → ElevenLabs → audio/mpeg
// =====================================================

import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

// Czech voice — eleven_multilingual_v2 model supports Czech natively
// Override via ELEVENLABS_VOICE_ID env var or voiceId in request body

// Available voices (tested with eleven_multilingual_v2 + Czech):
// MALE:
//   Brian    nPczCjzI2devNBz1zQrb  — warm, confident
//   Adam     pNInz6obpgDQGcFmaJgB  — deep, authoritative
//   Callum   N2lVS1w4EtoT3dr4eOWO  — calm, smooth
// FEMALE:
//   Charlotte XB0fDUnXU5powFXDhCwa — warm, natural (great for CZ)
//   Matilda  XrExE9yKIg1WjnnlVkGX  — friendly, clear
//   Alice    Xb7hH8MSUJpSbSDYk0k2  — authoritative, precise

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'XB0fDUnXU5powFXDhCwa'; // Charlotte
const MODEL_ID = 'eleven_multilingual_v2';

// ── AI briefing text generation ──────────────────────────────────────────────

function getBriefingSystemPrompt(role) {
  if (role === 'lehkost') {
    return `Jsi CHJ — digitální partner pro hubnutí a životní styl. Mluvíš jako kamarád, přirozeně česky.
Uživatel pracuje na hubnutí a lehčím životním stylu — výživa, pohyb, spánek a mysl jsou jeho čtyři oblasti.
Řekneš jednu věc: co ho teď nejvíc brzdí a proč to blokuje výsledky, pak co konkrétně udělat.
Pravidla:
- 1–2 věty, max 22 slov
- Přirozená hovorová čeština, tykání
- Naléhavost bez strašení — kamarád který říká pravdu
- Výstup: jen text, bez uvozovek

Příklady:
- "Pohyb chybí a bez něj metabolismus stagnuje, tak dnes udělej aspoň 20 minut chůze."
- "Spánek byl krátký a unavené tělo drží tuk, dnes večer bez obrazovek aspoň hodinu před spaním."
- "Výživa zaostává, zkus dnes večeři bez sacharidů a uvidíš jak se zítra budeš cítit."

Vyhýbej se pomlčce (—) uprostřed věty. Věty spojuj čárkou nebo spojkou.`;
  }
  if (role === 'dekatlon') {
    return `Jsi CHJ — digitální partner pro fyzickou výkonnost. Mluvíš jako kamarád, přirozeně česky.
Uživatel trénuje Dekatlon dlouhověkosti — 9 fyzických disciplín (síla, kardio, mobilita, VO2max...).
Cíl: být fyzicky zdatný ve vysokém věku. Každý trénink se počítá.
Řekneš jednu věc: co ho teď brzdí a jaká disciplína zaostává, pak co konkrétně udělat.
Pravidla:
- 1–2 věty, max 22 slov
- Přirozená hovorová čeština, tykání
- Naléhavost bez strašení — kamarád který říká pravdu
- Zmíň konkrétní disciplínu pokud ji znáš
- Výstup: jen text, bez uvozovek

Příklady:
- "VO2max zaostává nejvíc, tak dnes večer zkus 20 minut svižné chůze nebo kolo."
- "Dýchání je tvoje slabina teď, zkus ráno 5 minut Wim Hof nebo box breathing."
- "Kardio stagnuje a bez něj srdce stárne rychleji, dnes aspoň půl hodiny pohybu."

Vyhýbej se pomlčce (—) uprostřed věty. Věty spojuj čárkou nebo spojkou.`;
  }
  // longevity default
  return `Jsi CHJ — digitální partner pro dlouhověkost. Mluvíš jako kamarád, přirozeně česky.
Uživatel pracuje na svém zdraví a dlouhověkosti (Medicine 3.0).
Řekneš jednu věc: co ho teď brzdí a proč to vadí jeho cíli, pak co konkrétně udělat.
Pravidla:
- 1–2 věty, max 22 slov
- Přirozená hovorová čeština, tykání
- Naléhavost bez strašení — kamarád který říká pravdu
- Žádné formální obraty, žádné poučování
- Výstup: jen text, bez uvozovek

Vyhýbej se pomlčce (—) uprostřed věty. Věty spojuj čárkou nebo spojkou.`;
}

async function generateBriefingText(context) {
  const { description = '', action = '', streak = 0, role = 'longevity', userId = null } = context;
  const streakNote = streak >= 3 ? ` Táhne to ${streak} dní v řadě.` : '';

  const systemPrompt = getBriefingSystemPrompt(role);

  // Pro dekatlon: použij reálný bottleneck místo generic longevity description
  let situace = description || 'nejasný stav';
  let coUdelat = action || '';
  if (role === 'dekatlon' && userId) {
    const bn = await fetchBottleneck(userId, role);
    if (bn?.node_label) {
      situace = `${bn.node_label} zaostává nejvíc (skóre ${Math.round(bn.bottleneck_score * 100)} %)`;
      coUdelat = coUdelat || `trénuj ${bn.node_label.toLowerCase()}`;
    }
  }

  const userPrompt = `Situace: ${situace}
Co udělat: ${coUdelat}${streakNote}

Jedna věta — situace + dopad na cíl + co udělat.`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    throw new Error(`Claude error ${aiRes.status}: ${err}`);
  }

  const data = await aiRes.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

// ── "Co dál?" recommendation ─────────────────────────────────────────────────

// Dekatlon uzly — pod 'telo', mají data v user_metrics
const DEKATLON_NODE_IDS = ['sila','stabilita','vo2max','kardio','mobilita','vytrvalost','rovnovaha','plyometrie','dychani'];

// Překlad technických názvů uzlů do srozumitelné češtiny pro uživatele
const NODE_FRIENDLY_CZ = {
  vo2max:     'aerobní kapacita (kondice srdce)',
  kardio:     'kardio kondice',
  sila:       'svalová síla',
  stabilita:  'stabilita a koordinace',
  mobilita:   'pohyblivost kloubů',
  vytrvalost: 'vytrvalost',
  rovnovaha:  'rovnováha',
  plyometrie: 'výbušná síla',
  dychani:    'dýchání',
  spanek:     'spánek',
  vyziva:     'výživa',
  mysl:       'psychická odolnost',
  dlouhovekost: 'celkové zdraví',
};
const LEHKOST_NODE_IDS  = ['vyziva','kardio','spanek','mysl'];

// Killer riziko pro každý uzel — propojení s 4 zabijáky
const NODE_KILLER_RISK = {
  vo2max:       'Nízký VO2max je nejsilnější prediktor předčasné smrti ze všech měřitelných ukazatelů.',
  kardio:       'Srdce bez pravidelné zátěže odejde dřív, než to čekáš.',
  sila:         'Bez svalů srdce nemá co pohánět a metabolismus zpomaluje.',
  stabilita:    'První pád ve vyšším věku spouští řetězec, který končí ztrátou pohybu.',
  vytrvalost:   'Bez vytrvalosti srdce ztrácí rezervu, kterou jednou budeš potřebovat.',
  mobilita:     'Ztráta mobility předchází ztrátě nezávislosti — mozek bez pohybu degeneruje.',
  rovnovaha:    'Pád ve vyšším věku je jednou z hlavních příčin rychlého úpadku.',
  plyometrie:   'Výbušná síla chrání srdce a udržuje svalovou hmotu do vysokého věku.',
  dychani:      'Špatné dýchání snižuje okysličení mozku a zvyšuje kortizol.',
  spanek:       'Bez spánku mozek ničí sám sebe a tělo neregeneruje.',
  vyziva:       'Špatná strava ničí metabolismus dřív, než ho stačíš opravit.',
  mysl:         'Chronický stres je tichý zabiják — kortizol ničí srdce i mozek.',
};

async function fetchBottleneck(userId, role) {
  if (!userId) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Zkus user_bottlenecks (aspiration-weighted)
    const { data: bn } = await supabase
      .from('user_bottlenecks')
      .select('node_id, node_label, bottleneck_score, gap')
      .eq('user_id', userId)
      .order('bottleneck_score', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bn?.node_label) { console.log('[TTS] bottleneck (view):', bn.node_label, bn.bottleneck_score); return bn; }

    // 2. Fallback — nejhorší RED/YELLOW uzel z user_metrics
    // Pro dekatlon filtruj jen dekatlon uzly kde máme skutečná data
    let query = supabase
      .from('user_metrics')
      .select('node_id, current_index, state')
      .eq('user_id', userId)
      .in('state', ['RED', 'YELLOW'])
      .order('current_index', { ascending: true })
      .limit(1);

    if (role === 'dekatlon') {
      query = query.in('node_id', DEKATLON_NODE_IDS);
    } else if (role === 'lehkost') {
      query = query.in('node_id', LEHKOST_NODE_IDS);
    }

    const { data: worst } = await query.maybeSingle();
    if (!worst) { console.log('[TTS] bottleneck: no data for user', userId, 'role', role); return null; }

    // Načti label z longevity_nodes
    const { data: node } = await supabase
      .from('longevity_nodes')
      .select('label')
      .eq('id', worst.node_id)
      .maybeSingle();

    // current_index je 0–100 škála v DB — normalizuj na 0–1
  const score = worst.current_index > 1 ? worst.current_index / 100 : worst.current_index;
  const result = { node_id: worst.node_id, node_label: node?.label || worst.node_id, bottleneck_score: score, gap: null };
    console.log('[TTS] bottleneck (fallback):', result.node_label, result.bottleneck_score);
    return result;
  } catch (e) {
    console.error('[TTS] fetchBottleneck error:', e.message);
    return null;
  }
}

// Popis kontextu vesmíru pro AI prompt
function getUniverseContext(role) {
  if (role === 'dekatlon') return 'Uživatel trénuje Dekatlon dlouhověkosti — 9 fyzických disciplín (síla, kardio, mobilita, VO2max, stabilita...). Cíl: být fyzicky zdatný ve vysokém věku.';
  return 'Globální cíl uživatele: žít déle a zdravěji (Medicine 3.0 / Longevity).';
}

async function fetchHealthProfile(userId) {
  if (!userId) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabase
      .from('user_health_profile')
      .select('diagnoses, medications, labs, goal_text, crt_cache')
      .eq('user_id', userId)
      .maybeSingle();
    return data || null;
  } catch { return null; }
}

// Extrahuje klíčové poznatky z CRT pro briefing prompt
function extractCrtInsights(crtCache) {
  if (!crtCache?.nodes?.length) return null;
  const nodes = crtCache.nodes;
  // Kořen (root) = nejnižší y, nebo type === 'root'
  const root = nodes.find(n => n.type === 'root') || nodes.reduce((a, b) => (a.y ?? 0) < (b.y ?? 0) ? a : b);
  // UDE = nejvyšší y, nebo type === 'ude'
  const ude  = nodes.find(n => n.type === 'ude')  || nodes.reduce((a, b) => (a.y ?? 0) > (b.y ?? 0) ? a : b);
  // Střední uzly — přeskočíme root a ude, seřadíme podle y sestupně (blíže UDE = důležitější)
  const middle = nodes
    .filter(n => n.id !== root?.id && n.id !== ude?.id)
    .sort((a, b) => (b.y ?? 0) - (a.y ?? 0))
    .slice(0, 3)
    .map(n => n.label);
  return { root: root?.label, ude: ude?.label, middle };
}

// Jeden briefing = diagnóza + akce, vše v jednom volání s plným kontextem
async function generateBriefingFull(context) {
  const { hour = new Date().getHours(), userId = null, role = 'longevity' } = context;
  const timeLabel = hour < 9 ? 'ráno' : hour < 12 ? 'dopoledne' : hour < 17 ? 'odpoledne' : 'večer';

  const [bottleneck, profile] = await Promise.all([
    fetchBottleneck(userId, role),
    fetchHealthProfile(userId),
  ]);

  const nodeId = bottleneck?.node_id || null;
  const bottleneckLabel = (nodeId && NODE_FRIENDLY_CZ[nodeId]) || bottleneck?.node_label || 'kondice';
  const killerRisk = nodeId ? (NODE_KILLER_RISK[nodeId] || '') : '';

  const diagnozy = profile?.diagnoses?.length ? profile.diagnoses.join(', ') : null;
  const laby = profile?.labs ? Object.entries(profile.labs)
    .filter(([k]) => k !== 'date')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') : null;
  const cil = profile?.goal_text || null;
  const crt = extractCrtInsights(profile?.crt_cache);

  const crtLine = crt
    ? `Kauzální řetězec (z CRT): ${crt.root} → ${crt.middle?.join(' → ') || '...'} → ${crt.ude}`
    : null;

  const profileLines = [
    diagnozy && `Diagnózy: ${diagnozy}`,
    laby && `Lab výsledky: ${laby}`,
    cil && `Cíl: ${cil}`,
    killerRisk && `Riziko: ${killerRisk}`,
    crtLine,
  ].filter(Boolean).join('\n');

  const systemPrompt = `Jsi CHJ — osobní průvodce zdravím. Mluvíš přirozeně česky jako kamarád.

Napiš PŘESNĚ DVĚ věty, které na sebe navazují:
1. věta: co zaostává + dopad — MAX 8 SLOV, žádné "tělo"
2. věta: jedna konkrétní akce přizpůsobená zdravotnímu stavu — MAX 12 SLOV

Pokud máš k dispozici kauzální řetězec (z CRT), použij ho — první věta může zmínit kořenovou příčinu, druhá věta zasáhne více problémů najednou.

Pravidla:
- Tykání, žádné diagnózy přímo ("mám FaP" → "srdce potřebuje šetřit")
- Akce musí respektovat diagnózy — při FaP vynech sprint a maximální zátěž
- Žádná anglická slova, žádná pomlčka —
- Výstup: pouze dvě věty, bez uvozovek, bez číslování

Příklady s CRT kontextem:
- "Sedavý styl živí LDL i stres zároveň. Dnes půl hodiny chůze zasáhne oboje."
- "Kondice zaostává, srdce to pocítí. Dnes třicet minut svižné chůze, ne klusu."`;

  const userPrompt = `Denní doba: ${timeLabel}
Nejslabší místo: ${bottleneckLabel}
${profileLines}

Napiš dvě navazující věty:`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 120, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  });
  if (!aiRes.ok) throw new Error(`Claude error ${aiRes.status}`);
  const data = await aiRes.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

async function generateStatusText(context) {
  const { userId = null, role = 'longevity' } = context;
  const bottleneck = await fetchBottleneck(userId, role);

  // node_id může chybět z user_bottlenecks view — zkus odvodit z node_label
  const nodeId = bottleneck?.node_id
    || Object.entries(NODE_FRIENDLY_CZ).find(([, v]) => v === bottleneck?.node_label)?.[0]
    || null;
  const killerRisk = nodeId ? (NODE_KILLER_RISK[nodeId] || '') : '';
  const bottleneckLabel = (nodeId && NODE_FRIENDLY_CZ[nodeId]) || bottleneck?.node_label || null;
  const score = bottleneck ? Math.round((bottleneck.bottleneck_score ?? 0) * 100) : null;

  // Template-driven prompt — diagnóza + hint na akci
  const systemPrompt = `Jsi CHJ. Odpovídej PŘESNĚ podle vzoru níže. Nic víc, nic míň.

Vzor: "[Slabina] zaostává a [dopad na tělo nebo cíl]."

Příklady výstupu (přesně takto krátce a přirozeně):
- "Kondice zaostává a srdce to začíná poznávat."
- "Spánek ujíždí a únava se hromadí."
- "Výživa slábne a energie s tím klesá."
- "Síla klesá a tělo to začíná poznávat."

Pravidla (ZÁVAZNÁ):
- max 12 slov celkem
- žádné čísla ani procenta
- žádné nemoci, žádné diagnózy
- žádná pomlčka —
- tykání, hovorová čeština
- jen holá věta, bez uvozovek`;

  const userPrompt = `Slabina: ${bottleneckLabel || 'neznámá'}

Napiš jednu větu podle vzoru:`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 80, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  });
  if (!aiRes.ok) throw new Error(`Claude error ${aiRes.status}`);
  const data = await aiRes.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

async function generateRecommendText(context) {
  const { hour = new Date().getHours(), userId = null, role = 'longevity', toc = null } = context;

  const bottleneck = await fetchBottleneck(userId, role);

  const timeLabel = hour < 9 ? 'ráno' : hour < 12 ? 'dopoledne' : hour < 17 ? 'odpoledne' : 'večer';
  const goalLine = getUniverseContext(role);
  const killerRisk = bottleneck?.node_id ? (NODE_KILLER_RISK[bottleneck.node_id] || '') : '';
  const bottleneckLine = bottleneck?.node_label
    ? `Nejslabší místo: ${bottleneck.node_label} (skóre ${Math.round((bottleneck.bottleneck_score ?? 0) * 100)} %).${killerRisk ? `\nRiziko: ${killerRisk}` : ''}`
    : 'Bez výrazného slabého místa — tělo v pohodě.';
  const tocNote = toc?.bottleneck ? `\nByznysová priorita: ${toc.bottleneck}` : '';

  const systemPrompt = `Jsi CHJ — osobní průvodce zdravím. Mluv přirozeně česky jako kamarád, ne jako asistent.
Uživatel se ptá co má teď udělat. Řekneš mu JEDNU větu s JEDNOU akcí.

Pevná pravidla:
1. JEDNA věta, max 20 slov
2. JEDNA konkrétní akce — žádné "nebo", žádné druhé "a"
3. Čistá čeština — žádná anglická slova (jogging→klus, workout→trénink)
4. Tykání, bez uvozovek

Správné příklady:
- "VO2max zaostává, tak dnes večer jdi na 20 minut svižného klusu."
- "Spánek je tvoje nejslabší místo, tak dnes zalehni nejpozději v devět."
- "Dýchání slábne, tak ráno udělej 5 minut pomalého dýchání nosem."

Špatné příklady — TAKTO NIKDY:
- "...tak jdi na chůzi nebo klus." ← dvě možnosti
- "...tak si nastav budík a zalehni." ← dvě akce
- "...tempem, kdy stěží vyslovíš větu." ← nesrozumitelná opisná konstrukce
- "Běž dnes ráno..." ← "běž" = jdi, ne "jdi běhat/jdi na klus" — buď konkrétní`;

  const userPrompt = `Denní doba: ${timeLabel}
${goalLine}
${bottleneckLine}${tocNote}

Jedna věta, jedna akce, čistá čeština:`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    throw new Error(`Claude error ${aiRes.status}: ${err}`);
  }

  const data = await aiRes.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, context, voiceId } = req.body || {};

  // Musí přijít buď text nebo context
  if (!text && !context) {
    return res.status(400).json({ error: 'Missing text or context' });
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  // Mode B: context → AI → text
  let spokenText = text;
  if (!spokenText) {
    try {
      const mode = context?.mode || 'briefing';
      if (mode === 'status' || mode === 'recommend') {
        // Obě nahrazeny jednotným briefingem s plným kontextem
        spokenText = await generateBriefingFull(context);
        console.log(`[TTS] briefingFull [mode=${mode} role=${context.role||'?'}]:`, spokenText);
      } else {
        spokenText = await generateBriefingText(context);
        console.log('[TTS] briefing:', spokenText);
      }
    } catch (err) {
      console.error('[TTS] AI generation failed:', err);
      return res.status(502).json({ error: 'AI generation failed', detail: err.message });
    }
  }

  if (!spokenText || typeof spokenText !== 'string') {
    return res.status(400).json({ error: 'Empty text after generation' });
  }

  const voice = voiceId || DEFAULT_VOICE_ID;

  // Mode A/B: text → ElevenLabs → audio
  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: spokenText.slice(0, 500),
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.35,       // méně stiff, více expresivní
            similarity_boost: 0.65,
            speed: 1.05,           // o trochu svižnější
          },
        }),
      }
    );

    if (!elRes.ok) {
      const err = await elRes.text();
      console.error('[TTS] ElevenLabs error:', elRes.status, err);
      return res.status(502).json({ error: 'ElevenLabs error', detail: err });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    // Vrátíme text jako header — frontend ho přečte pro typewriter efekt
    if (spokenText) {
      res.setHeader('X-CHJ-Text', encodeURIComponent(spokenText));
      res.setHeader('Access-Control-Expose-Headers', 'X-CHJ-Text');
    }

    const buf = await elRes.arrayBuffer();
    res.send(Buffer.from(buf));

  } catch (err) {
    console.error('[TTS] fetch error:', err);
    res.status(500).json({ error: 'TTS fetch failed' });
  }
}
