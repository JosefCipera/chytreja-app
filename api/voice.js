// ============================================================
// /api/voice – CHJ hlasový vstup
// Parsuje přirozený text → intent + data + spoken response
// ============================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Node name → ID mapping (pro SHOW_NODE intent) ──────────
const NODE_ALIASES = {
  'tělo': 'telo', 'telo': 'telo', 'svalů': 'telo', 'svaly': 'telo',
  'síla': 'sila', 'silou': 'sila',
  'výdrž': 'vytrvalost', 'vytrvalost': 'vytrvalost', 'vytrvalosti': 'vytrvalost',
  'kardio': 'kardio', 'srdce': 'kardio',
  'vo2max': 'vo2max', 'kondice': 'vo2max',
  'mysl': 'mysl', 'hlava': 'mysl', 'mozek': 'mysl',
  'stres': 'stres', 'klid': 'klid', 'soustředění': 'soustredeni',
  'výživa': 'vyziva', 'vyziva': 'vyziva', 'strava': 'vyziva', 'jídlo': 'vyziva',
  'bílkoviny': 'bilkoviny', 'protein': 'bilkoviny',
  'půst': 'pust', 'hladovění': 'pust',
  'zdraví': 'zdravi', 'zdravi': 'zdravi',
  'spánek': 'spanek', 'spanek': 'spanek',
  'dýchání': 'dychani', 'dychani': 'dychani', 'dech': 'dychani',
  'metabolismus': 'metabolicke', 'metabolicke': 'metabolicke',
  'mobilita': 'mobilita', 'pohyblivost': 'mobilita',
  'stabilita': 'stabilita', 'rovnováha': 'rovnovaha',
  'biomarkery': 'biomarkery', 'krev': 'biomarkery',
  'hosszověkost': 'dlouhovekost', 'dlouhověkost': 'dlouhovekost',
  'hra o život': 'dlouhovekost',
};

const SYSTEM_PROMPT = `Jsi CHJ asistent pro rozpoznávání hlasových pokynů v češtině.
Uživatel ti pošle přirozený text. Tvůj úkol je rozpoznat záměr a extrahovat data.

Vrať POUZE validní JSON (bez markdown, bez komentářů):
{
  "intent": "SHOW_NODE | LOG_ACTIVITY | LOG_BIOMETRIC | START_TIMER | PROACTIVE | CHAT",
  "node_id": "telo|mysl|vyziva|zdravi|metabolicke|spanek|sila|vytrvalost|kardio|vo2max|dychani|stabilita|mobilita|...",
  "activity": {
    "type": "swimming|running|cycling|strength|walking|yoga|breathing|other",
    "value": 500,
    "unit": "m|km|min|reps|sets|steps",
    "node_id": "vytrvalost|sila|kardio|dychani|stabilita|mobilita"
  },
  "biometric": {
    "key": "weight_kg|waist_cm|body_fat_pct",
    "value": 85.5
  },
  "timer": {
    "type": "breathing|rest|exercise|custom",
    "seconds": 60,
    "label": "Kontrolní pauza"
  },
  "response": "krátká odpověď pro uživatele (max 12 slov, česky, tykání, přímá, bez plku)"
}

Pravidla:
- intent SHOW_NODE: uživatel chce vidět konkrétní uzel ("zobraz Tělo", "otevři Mysl")
- intent LOG_ACTIVITY: uživatel hlásí aktivitu ("plaval jsem", "udělal jsem 20 dřepů", "běžel 5 km")
- intent LOG_BIOMETRIC: váha, pas, tuk ("vážím 82 kg", "mám pas 95")
- intent START_TIMER: chce stopky nebo timer ("stopky na dech", "minutový timer", "kontrolní pauza")
- intent CHAT: cokoliv jiného
- response: co CHJ řekne nahlas — krátce, přátelsky, tykání
- Pokud loguješ aktivitu: node_id je uzel ke kterému aktivita patří (plavání → vytrvalost, dřepy → sila)`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, userId, context } = req.body;
  if (!text || !userId) return res.status(400).json({ error: 'Missing text or userId' });

  // ── 1. Rychlá lokální detekce SHOW_NODE (bez AI) ─────────
  const lower = text.toLowerCase().trim();
  const showMatch = lower.match(/^(?:zobraz|otevři|ukaz|ukazuj|uzel)\s+(.+)$/);
  if (showMatch) {
    const keyword = showMatch[1].trim();
    const nodeId  = NODE_ALIASES[keyword];
    if (nodeId) {
      return res.json({
        intent:  'SHOW_NODE',
        node_id: nodeId,
        response: `Otvírám ${keyword}.`
      });
    }
  }

  // ── 2. AI parsing pro komplexní intenty ──────────────────
  let parsed = null;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: text }
      ]
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '{}';
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error('Voice AI parse error:', e.message);
    return res.json({
      intent:   'CHAT',
      response: 'Nerozuměl jsem, zkus to znovu.'
    });
  }

  // ── 3. Uložit data do DB ──────────────────────────────────
  if (parsed.intent === 'LOG_ACTIVITY' && parsed.activity) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      await supabase.from('user_fitness_tests').insert({
        user_id:   userId,
        test_type: parsed.activity.type,
        value:     parsed.activity.value,
        unit:      parsed.activity.unit,
        node_id:   parsed.activity.node_id || null,
        source:    'voice',
        notes:     text
      });
    } catch (e) {
      console.warn('LOG_ACTIVITY save error:', e.message);
    }
  }

  if (parsed.intent === 'LOG_BIOMETRIC' && parsed.biometric) {
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const patch = { user_id: userId, source: 'voice' };
      patch[parsed.biometric.key] = parsed.biometric.value;
      await supabase.from('user_biometrics').insert(patch);
    } catch (e) {
      console.warn('LOG_BIOMETRIC save error:', e.message);
    }
  }

  return res.json(parsed);
}
