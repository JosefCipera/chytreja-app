// ============================================================
// /api/voice – CHJ hlasový vstup
// Parsuje přirozený text → intent + data + spoken response
// ============================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
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

// ── Normalizace českých pádů → nominativ ──────────────────
// STT vrací akuzativ: "zobraz rovnováhu" → "rovnováhu" → "rovnováha"
function resolveNodeAlias(keyword) {
  if (NODE_ALIASES[keyword]) return NODE_ALIASES[keyword];
  // -u → -a  (rovnováhu→rovnováha, výživu→výživa, stabilitu→stabilita, sílu→síla)
  if (keyword.endsWith('u')) {
    const nom = keyword.slice(0, -1) + 'a';
    if (NODE_ALIASES[nom]) return NODE_ALIASES[nom];
  }
  // -i → -a  (případný lok. pád)
  if (keyword.endsWith('i')) {
    const nom = keyword.slice(0, -1) + 'a';
    if (NODE_ALIASES[nom]) return NODE_ALIASES[nom];
  }
  return null;
}

// ── Ořezání command slov ze začátku (iterativní) ──────────
// "ukaž uzel rovnováha" → "uzel rovnováha" → "rovnováha"
// "zobraz rovnováhu"    → "rovnováhu"
const COMMAND_PREFIX_RE = /^(zobraz(it)?|otevři(t)?|ukaz(uj)?|ukaž|uzel|mi|prosím|najdi|zobrazit|otevřít)\s+/;
function stripCommandPrefixes(s) {
  let out = s.trim();
  let prev;
  do { prev = out; out = out.replace(COMMAND_PREFIX_RE, '').trim(); } while (out !== prev);
  return out;
}

// Deterministické mapování typu aktivity → uzel (fallback pokud AI node_id nevyplní)
const ACTIVITY_NODE_MAP = {
  'swimming':  'vytrvalost',
  'running':   'vytrvalost',
  'cycling':   'vytrvalost',
  'strength':  'sila',
  'walking':   'mobilita',
  'yoga':      'mobilita',
  'breathing': 'dychani',
  'other':     null,
};

const SYSTEM_PROMPT = `Jsi CHJ asistent pro rozpoznávání hlasových pokynů v češtině.
Uživatel ti pošle přirozený text. Tvůj úkol je rozpoznat záměr a extrahovat data.

Vrať POUZE validní JSON (bez markdown, bez komentářů):
{
  "intent": "SHOW_NODE | LOG_ACTIVITY | LOG_BIOMETRIC | START_TIMER | PROACTIVE | CHAT",
  "node_id": "telo|mysl|vyziva|zdravi|metabolicke|spanek|sila|vytrvalost|kardio|vo2max|dychani|stabilita|rovnovaha|mobilita|stres|klid|soustredeni|bilkoviny|pust|biomarkery|dlouhovekost|...",
  "activity": {
    "type": "swimming|running|cycling|strength|walking|yoga|breathing|other",
    "value": 500,
    "unit": "m|km|min|s|reps|sets|steps",
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
- intent LOG_ACTIVITY: minulý čas – uživatel říká co UŽ UDĚLAL ("plaval jsem", "cvičil jsem 20 sekund", "udělal jsem dřepy", "byl jsem na procházce")
- intent LOG_BIOMETRIC: váha, pas, tuk ("vážím 82 kg", "mám pas 95")
- intent START_TIMER: imperativ/budoucnost – uživatel chce SPUSTIT stopky ("stopky na dech", "minutový timer", "spusť 60 sekund", "dej mi 2 minuty")
- intent CHAT: cokoliv jiného
- response: co CHJ řekne nahlas — krátce, přátelsky, tykání
- Jednotky: sekundy → "s", minuty → "min", metry → "m", kilometry → "km"
- Mapování aktivit na uzly: plavání/běh/kolo → vytrvalost, dřepy/posilování → sila, chůze/jóga → mobilita, dýchání/Buteyko/kontrolní pauza/pranajama → dychani (type="breathing")
- DŮLEŽITÉ: rovnováha = node_id "rovnovaha" (NIKDY "stabilita"). Jsou to různé uzly.`;

// Deterministická extrakce jednotky z českého textu
// Dvojí pokrytí: s diakritikou i bez (různé STT/encoding výstupy)
function extractUnit(text) {
  const t = text.toLowerCase();
  // sekundy/vteřiny – s háčky i bez
  if (/sekund|vte[rř]in/.test(t))  return 's';
  // minuty
  if (/minut/.test(t))              return 'min';
  if (/kilom/.test(t))              return 'km';
  if (/\bmetr/.test(t))             return 'm';
  if (/krok/.test(t))               return 'steps';
  return null;
}

// Normalizace jednotky vrácené AI (sec→s, minutes→min atd.)
function normalizeUnit(unit) {
  if (!unit) return null;
  switch (unit.toLowerCase()) {
    case 'sec': case 's': case 'seconds': return 's';
    case 'min': case 'minutes':           return 'min';
    case 'km':  case 'kilometers':        return 'km';
    case 'm':   case 'meters':            return 'm';
    default: return unit;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, userId, context } = req.body;
  if (!text || !userId) return res.status(400).json({ error: 'Missing text or userId' });

  // ── 1. Rychlá lokální detekce SHOW_NODE (bez AI) ─────────
  // NFC normalizace – STT může vracet dekompozici háčků (ž = z + combining caron)
  const lower = text.toLowerCase().normalize('NFC').trim();

  // Ořež command slova: "ukaž uzel rovnováhu" → "rovnováhu"
  const stripped = stripCommandPrefixes(lower);
  const wasCommand = stripped !== lower;  // bylo tam aspoň jedno command slovo?

  console.log('🔍 voice local:', { lower, stripped, wasCommand });

  // A) Command slova na začátku: "zobraz tělo", "ukaž uzel rovnováhu"
  if (wasCommand) {
    const nodeId = resolveNodeAlias(stripped);
    console.log('🔍 A) stripped alias:', stripped, '→', nodeId);
    if (nodeId) {
      return res.json({ intent: 'SHOW_NODE', node_id: nodeId, response: `Otvírám.` });
    }
  }

  // B) "uzel X" kdekoliv ve větě: "jak vypadá uzel rovnováha", "co je uzel tělo"
  const uzelMatch = lower.match(/\buzel\s+(\S+)/);
  if (uzelMatch) {
    const nodeId = resolveNodeAlias(uzelMatch[1]);
    console.log('🔍 B) uzel match:', uzelMatch[1], '→', nodeId);
    if (nodeId) {
      return res.json({ intent: 'SHOW_NODE', node_id: nodeId, response: `Otvírám.` });
    }
  }

  // C) Přímý název uzlu: "rovnováha", "rovnováhu", "kardio"
  const directNodeId = resolveNodeAlias(lower);
  console.log('🔍 C) direct alias:', lower, '→', directNodeId);
  if (directNodeId) {
    return res.json({ intent: 'SHOW_NODE', node_id: directNodeId, response: `Otvírám.` });
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
    console.log('🤖 AI raw:', raw);
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
      const activityNodeId = parsed.activity.node_id
        || ACTIVITY_NODE_MAP[parsed.activity.type]
        || null;
      const activityUnit = extractUnit(text) || normalizeUnit(parsed.activity.unit) || null;
      console.log('💾 LOG_ACTIVITY:', { extractUnit: extractUnit(text), aiUnit: parsed.activity.unit, finalUnit: activityUnit, type: parsed.activity.type, value: parsed.activity.value, node_id: activityNodeId });
      const { error: dbError } = await supabase.from('user_fitness_tests').insert({
        user_id:   userId,
        test_type: parsed.activity.type,
        value:     parsed.activity.value,
        unit:      activityUnit,
        node_id:   activityNodeId,
        source:    'voice',
        notes:     text
      });
      if (dbError) console.error('❌ DB insert error:', JSON.stringify(dbError));
      else console.log('✅ DB insert OK');
    } catch (e) {
      console.error('❌ LOG_ACTIVITY exception:', e.message);
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
