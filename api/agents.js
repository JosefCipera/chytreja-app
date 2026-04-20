// =====================================================
// API: /api/agents.js — CHJ Agent Router
// Routes to specialized agents based on `type` param
//
// POST /api/agents
// Body: { type: 'telo', userId, discipline, nodeId }
//
// Agents:
//   telo  — sila | kardio | stabilita
//   (mysl, vyziva, zdravi — coming in v0.3+)
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-haiku-4-5';

// ── TIER ──────────────────────────────────────────────
function getTier(index) {
  if (index <= 40) return 1;
  if (index <= 70) return 2;
  return 3;
}

// ── TĚLO AGENT ─────────────────────────────────────────
const TELO_SYSTEM = `Jsi Tělo Agent CHJ — vybíráš konkrétní cvičení pro dnešní disciplínu.

DISCIPLÍNY: sila | kardio | stabilita

TIER systém (dle stavu uzlu Tělo):
- tier 1 (index 0–40): začátečník, bezpečné pohyby bez náčiní
- tier 2 (index 41–70): střední náročnost, základní náčiní nebo vlastní váha
- tier 3 (index 71+): náročné varianty, progrese

CVIČENÍ — SÍLA:
Tier 1: Dřep u stěny (3×30s), Klik o stůl (3×8), Vzpažení s lahví (3×12), Sed-leh (3×10)
Tier 2: Dřep (3×12), Klik (3×10), Rumunský mrtvý tah (3×10), Bicepsový zdvih (3×12)
Tier 3: Výpad (3×10/noha), Bulharský dřep (3×8), Mrtvý tah (3×8), Shyb (3×max)

CVIČENÍ — KARDIO:
Tier 1: Chůze 20 min, Kolo 15 min pomalé, Plavání 15 min volný styl
Tier 2: Svižná chůze 30 min, Kolo 25 min střední tempo, Plavání 20 min
Tier 3: Běh 30 min, Intervalový trénink (8×1min), Plavání 30 min technicky

CVIČENÍ — STABILITA:
Tier 1: Stoj na jedné noze (3×20s), Plank (3×15s), Sed-leh pomalu (3×8)
Tier 2: Plank (3×30s), Bird-dog (3×10/strana), Boční plank (2×20s)
Tier 3: Plank (3×60s), Single-leg deadlift (3×8), Rotační výpad (3×10)

CONSTRAINTS — VŽDY respektuj:
- koleno_levy / koleno_pravy: vynechej dřepy a výpady → nahraď plankem nebo stojnými cviky
- zada: vynechej mrtvé tahy a sed-lehy → nahraď plankem
- rameno_levy / rameno_pravy: vynechej kliky a overhead → nahraď nohama nebo core
- kycel: vynechej hluboké dřepy → nahraď chůzí nebo plaváním

PRAVIDLA:
- Nikdy neopakuj yesterdayAction
- coaching_note: max 1 věta, konkrétní odkaz na sen uživatele (plavání, běžky, vnuci...)
- Česky, tykej, trenérský tón
- type: "timed" (s dobou v sekundách) | "counter" (sety×repy) | "distance" (metry)

ODPOVĚZ POUZE JSON (bez markdown):
{"action_id":"...","label":"...","type":"timed|counter|distance","duration_s":null,"sets":null,"reps":null,"distance_m":null,"coaching_note":"..."}`;

const TELO_FALLBACKS = {
  sila: { action_id: 'drep_u_steny', label: 'Dřep u stěny 3×30s', type: 'timed', duration_s: 90, sets: 3, reps: null, distance_m: null, coaching_note: 'Nohama tlač do podlahy — základ síly, která tě unese.' },
  kardio: { action_id: 'chůze_20min', label: 'Chůze 20 minut', type: 'timed', duration_s: 1200, sets: null, reps: null, distance_m: null, coaching_note: 'Svižně, ramena uvolněná — srdce si to žádá.' },
  stabilita: { action_id: 'plank_3x30', label: 'Plank 3×30s', type: 'timed', duration_s: 90, sets: 3, reps: null, distance_m: null, coaching_note: 'Core pevný jako skála — bez toho se daleko nedojde.' },
};

async function teloAgent(client, sb, { userId, discipline, nodeId }) {
  if (!['sila', 'kardio', 'stabilita'].includes(discipline)) {
    return { error: `Invalid discipline: ${discipline}` };
  }

  const today = new Date().toISOString().split('T')[0];

  // Cache check
  const { data: cached } = await sb.from('agent_log')
    .select('action_id, label, type, duration_s, sets, reps, distance_m, coaching_note')
    .eq('user_id', userId).eq('node_id', nodeId).eq('discipline', discipline).eq('date', today)
    .maybeSingle();
  if (cached?.action_id) return { ...cached, cached: true };

  // Fetch context
  const [metricsRes, constraintsRes, decathlonRes, missionRes] = await Promise.all([
    sb.from('user_metrics').select('current_index').eq('user_id', userId).eq('node_id', nodeId).eq('universe', 'longevity').maybeSingle(),
    sb.from('user_constraints').select('constraint_key').eq('user_id', userId),
    sb.from('user_decathlon').select('label, target_age, goal_key').eq('user_id', userId).eq('active', true).maybeSingle(),
    sb.from('mission_log').select('action_id').eq('user_id', userId).eq('node_id', nodeId)
      .gte('date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const nodeIndex = metricsRes.data?.current_index ?? 50;
  const tier = getTier(nodeIndex);
  const constraints = (constraintsRes.data || []).map(c => c.constraint_key);
  const dream = decathlonRes.data;
  const yesterdayAction = missionRes.data?.action_id ?? null;

  const contextMsg = `DISCIPLÍNA: ${discipline}
TIER: ${tier} (index uzlu Tělo: ${nodeIndex})
OMEZENÍ: ${constraints.length ? constraints.join(', ') : 'žádná'}
VČEREJŠÍ AKCE: ${yesterdayAction ?? 'žádná'}
SEN: ${dream ? `"${dream.label}" ve věku ${dream.target_age} let` : 'není nastaven'}

Vyber jedno konkrétní cvičení pro dnešek.`;

  // Haiku call
  let action = null;
  try {
    const response = await client.messages.create({
      model: MODEL, max_tokens: 400,
      system: TELO_SYSTEM,
      messages: [{ role: 'user', content: contextMsg }],
    });
    const text = response.content.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) action = JSON.parse(match[0]);
  } catch (e) {
    console.warn('Tělo Agent Haiku failed:', e.message);
  }

  if (!action?.action_id) {
    console.warn('Tělo Agent: fallback for', discipline);
    action = TELO_FALLBACKS[discipline];
  }

  // Save to agent_log (fire and forget)
  sb.from('agent_log').insert({ user_id: userId, node_id: nodeId, discipline, date: today, tier, ...action })
    .then(({ error }) => { if (error) console.warn('agent_log insert failed:', error.message); });

  return action;
}

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { type, userId = 'demo-user-123', ...params } = req.body || {};

  try {
    switch (type) {
      case 'telo':
        return res.json(await teloAgent(client, sb, { userId, ...params }));

      // Future agents:
      // case 'mysl':   return res.json(await myslAgent(client, sb, { userId, ...params }));
      // case 'vyziva': return res.json(await vyzivaAgent(client, sb, { userId, ...params }));
      // case 'zdravi': return res.json(await zdraviAgent(client, sb, { userId, ...params }));

      default:
        return res.status(400).json({ error: `Unknown agent type: ${type}` });
    }
  } catch (e) {
    console.error('agents error:', e);
    return res.status(500).json({ error: e.message });
  }
}
