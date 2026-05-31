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

function buildTimeLabel(hour) {
  if (hour >= 5  && hour < 11) return 'ráno';
  if (hour >= 11 && hour < 14) return 'dopoledne';
  if (hour >= 14 && hour < 18) return 'odpoledne';
  if (hour >= 18 && hour < 22) return 'večer';
  return 'pozdě v noci';
}

async function generateBriefingText(context) {
  const { hour = new Date().getHours(), pct = 50, killer = 'energie', action = '', streak = 0 } = context;
  const timeLabel = buildTimeLabel(hour);
  const streakNote = streak >= 3 ? ` Máš sérii ${streak} dní v řadě.` : '';

  const systemPrompt = `Jsi CHJ — osobní digitální partner pro zdraví a dlouhověkost.
Mluvenou češtinou (tykání) vítáš uživatele při otevření appky.
Pravidla pro tvou odpověď:
- Přesně 1–2 věty, maximálně 25 slov celkem
- Přirozená mluvená čeština — žádné markdown, žádné odrážky
- Tón: přátelský kouč, ne doktor
- Žádné názvy nemocí, diagnóz
- Žádné příkazy ("musíš", "měl bys", "okamžitě")
- Žádná zobecnění ("je důležité", "je třeba")
- Reaguj na denní dobu, stav energie, hlavní hrozbu a akci`;

  const userPrompt = `Denní doba: ${timeLabel}
Energie: ${pct} %
Největší hrozba dnes: ${killer}
Doporučená akce: ${action || 'žádná konkrétní'}${streakNote}

Vygeneruj uvítání.`;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      temperature: 0.85,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    throw new Error(`OpenAI error ${aiRes.status}: ${err}`);
  }

  const data = await aiRes.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
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
