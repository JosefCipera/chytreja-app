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
      model: 'claude-haiku-4-5',
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
      .select('node_label, bottleneck_score, gap')
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
  const result = { node_label: node?.label || worst.node_id, bottleneck_score: score, gap: null };
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

async function generateRecommendText(context) {
  const { hour = new Date().getHours(), userId = null, role = 'longevity', toc = null } = context;

  const bottleneck = await fetchBottleneck(userId, role);

  const timeLabel = hour < 9 ? 'ráno' : hour < 12 ? 'dopoledne' : hour < 17 ? 'odpoledne' : 'večer';
  const goalLine = getUniverseContext(role);
  const bottleneckLine = bottleneck?.node_label
    ? `Aktuální bottleneck: ${bottleneck.node_label} (skóre ${Math.round((bottleneck.bottleneck_score ?? 0) * 100)} %).`
    : 'Bez výrazného bottlenecku — tělo v pohodě.';
  const tocNote = toc?.bottleneck ? `\nByznysová priorita: ${toc.bottleneck}` : '';

  const systemPrompt = `Jsi CHJ — digitální partner pro zdraví a výkon. Uživatel se ptá co má dělat dál.
Tvoje logika (TOC bottleneck-first):
1. Aktuální bottleneck je jediné hrdlo — zmíň ho jménem v odpovědi.
2. Doporuč JEDNU konkrétní akci která ho odblokuje.
3. Propoj s cílem uživatele — ne generická rada.

Pravidla:
- 1–2 věty, max 25 slov
- Přirozená hovorová čeština, tykání
- Výstup: jen text, bez uvozovek
- Vyhýbej se pomlčce (—) uprostřed věty

Příklad (bottleneck = VO2max): "VO2max je teď tvoje největší hrdlo, tak dnes večer zkus 20 minut svižné chůze nebo kolo."`;

  const userPrompt = `Denní doba: ${timeLabel}
${goalLine}
${bottleneckLine}${tocNote}

Co teď doporučíš?`;

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
      model: 'claude-haiku-4-5',
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
      if (mode === 'recommend') {
        spokenText = await generateRecommendText(context);
        console.log('[TTS] recommend:', spokenText);
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
