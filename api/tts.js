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

async function generateBriefingText(context) {
  const { killer = 'energie', action = '', streak = 0 } = context;
  const streakNote = streak >= 3 ? ` Uživatel je na sérii ${streak} dní v řadě.` : '';

  const systemPrompt = `Jsi CHJ — osobní digitální partner pro zdraví a dlouhověkost.
Po spuštění appky řekneš uživateli jeho největší aktuální problém a co s tím dnes udělat.
Pravidla:
- Přesně 1–2 věty, maximálně 25 slov celkem
- Přirozená mluvená čeština, tykání
- Tón: přátelský ale přímý kouč — rovnou k věci, bez úvodu
- Žádné "dobré ráno", žádná procenta, žádné obecné fráze
- Žádné názvy nemocí ani diagnóz
- Žádné příkazy ("musíš", "měl bys") — místo toho nabídni nebo navrhni
- Výstup: jen samotný text, nic jiného`;

  const userPrompt = `Největší problém uživatele teď: ${killer}
Doporučená akce: ${action || 'není specifikována'}${streakNote}

Řekni mu situaci a co udělat.`;

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
      spokenText = await generateBriefingText(context);
      console.log('[TTS] AI briefing:', spokenText);
    } catch (err) {
      console.error('[TTS] AI generation failed:', err);
      return res.status(502).json({ error: 'AI briefing generation failed', detail: err.message });
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
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 0.95,
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

    const buf = await elRes.arrayBuffer();
    res.send(Buffer.from(buf));

  } catch (err) {
    console.error('[TTS] fetch error:', err);
    res.status(500).json({ error: 'TTS fetch failed' });
  }
}
