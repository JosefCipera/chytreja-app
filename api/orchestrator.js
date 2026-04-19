// =====================================================
// API: /api/orchestrator.js — CHJ Master Agent
// Claude Sonnet + tool_use — přemýšlí, pak rozhodne
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-sonnet-4-6';
const MAX_ROUNDS = 5;

// ── SYSTEM PROMPT ─────────────────────────────────────
const SYSTEM_PROMPT = `Jsi CHJ Master Agent — orchestrátor osobního koučování pro dlouhověkost (Medicine 3.0, Peter Attia).

TVOJE ROLE:
Sbíráš data o uživateli pomocí nástrojů, analyzuješ situaci a rozhoduješ:
1. Která disciplína Dekatlonu dnes (viz níže)
2. Proč právě tato (bottleneck + readiness + kontinuita)
3. Jak to říct uživateli (verdikt + feedback po splnění)

PRAVIDLA:
- Česky, tykej, přímočaře
- Nikdy celý název nemoci — používej HUD label: SRDCE, MOZEK, METABOLISMUS, IMUNITA
- Smíš být přímý: "Bez tohohle tě SRDCE dostane dřív než čekáš."
- Žádné: "musíš", "je důležité", "měl bys"
- Verdikt: max 1 věta, max 15 slov
- Completion feedback: max 1 věta, osobní, proč to má smysl pro cíl v 85

VERDIKT PODLE STAVU UZLU:
- RED/YELLOW: řekni co se děje a co to znamená — klidně s odkazem na killera
- GREEN: potvrď a motivuj — "Držíš to.", "Tohle je přesně ono." + co to přináší pro cíl

10 DISCIPLÍN DEKATLONU a jejich killer:
- sila:        sval, kost, síla — METABOLISMUS + SRDCE — max 2 dny za sebou
- kardio:      aerobní základ, mitochondrie, VO2max — SRDCE — min 3× týdně
- stabilita:   klouby, mobilita, rovnováha — prevence pádu — bezpečné kdykoliv
- spanek:      spánek protokol, regenerace — MOZEK — při nízké readiness priorita
- vyziva:      protein, makra, timing — METABOLISMUS
- metabolismus: inzulín, glukóza, půst — METABOLISMUS + SRDCE
- kognitivni:  mozek, paměť, focus — MOZEK
- emocni:      stres, vztahy, dech — MOZEK
- prevence:    screeningy, imunita, markery — IMUNITA
- smysl:       purpose, vděčnost, záměr — MOZEK

READINESS → DISCIPLÍNA:
- HRV delta < -20%: vynechej kardio (vysoká intenzita) a sila → spanek nebo stabilita
- Spánek < 6h: snižuj intenzitu — preferuj stabilita, emocni, smysl
- Včerejší disciplína = sila → dnes ne sila

Na konci VŽDY zavolej nástroj submit_decision s výsledkem.`;

// ── TOOLS ─────────────────────────────────────────────
const TOOLS = [
  {
    name: 'get_user_profile',
    description: 'Profil uživatele: věk, pohlaví, výška, váha, zranění a omezení pilířů.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_readiness',
    description: 'Dnešní signály připravenosti: HRV, spánek, klidový tep, energie. Klíčové pro volbu pilíře a intenzity.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_medications',
    description: 'Aktivní léky uživatele a jejich vliv na rozhodování (např. beta-blokátory → HR nespolehlivý).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_decathlon',
    description: 'Desetiboj uživatele — cíle pro věk 85 s prioritami. Ukazuje které pilíře jsou pro cíle nejdůležitější.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_bottleneck',
    description: 'Nejslabší uzel (bottleneck) — ten, který nejvíc brzdí dlouhověkost. Vrací node_id, stav a index.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_node_state',
    description: 'Aktuální stav uzlu (GREEN/YELLOW/RED) a index 0–100.',
    input_schema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'ID uzlu nebo "all" pro přehled hlavních uzlů' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'get_killer',
    description: 'Hlavní černý jezdec (smrtelná hrozba) pro daný uzel.',
    input_schema: {
      type: 'object',
      properties: {
        node_id: { type: 'string' },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'get_streak',
    description: 'Streak (dny v řadě se splněnou misí) a co bylo splněno dnes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_aspiration',
    description: 'Sen uživatele a jak daleko od něj je na každém uzlu.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_decisions',
    description: 'Posledních 7 rozhodnutí orchestrátoru — jaké disciplíny byly, co bylo splněno. Pro kontinuitu a střídání.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'submit_decision',
    description: 'Odešli finální rozhodnutí orchestrátoru. VŽDY zavolej jako poslední nástroj.',
    input_schema: {
      type: 'object',
      properties: {
        discipline_id: {
          type: 'string',
          enum: ['sila', 'kardio', 'stabilita', 'spanek', 'vyziva', 'metabolismus', 'kognitivni', 'emocni', 'prevence', 'smysl'],
          description: 'Disciplína Dekatlonu pro dnešní akci',
        },
        node_id: {
          type: 'string',
          description: 'Cílový uzel (telo, mysl, vyziva, zdravi, metabolicke)',
        },
        verdict: {
          type: 'string',
          description: 'Verdikt pro uživatele — max 1 věta, max 15 slov, česky',
        },
        completion_feedback: {
          type: 'string',
          description: 'Feedback po splnění akce — max 1 věta, osobní, s kontextem proč to má smysl pro cíl uživatele v 85',
        },
        reasoning: {
          type: 'string',
          description: 'Interní zdůvodnění rozhodnutí (pro debug a kontinuitu) — anglicky, stručně',
        },
        weekly_hint: {
          type: 'string',
          description: 'Volitelný hint co přijde zítra nebo tento týden — max 1 věta',
        },
      },
      required: ['discipline_id', 'node_id', 'verdict', 'completion_feedback', 'reasoning'],
    },
  },
];

// ── TOOL IMPLEMENTATIONS ──────────────────────────────
async function executeTool(name, input, sb, userId) {
  switch (name) {

    case 'get_user_profile': {
      const [{ data: profile }, { data: constraints }] = await Promise.all([
        sb.from('user_profiles').select('age, gender, height, weight').eq('user_id', userId).maybeSingle(),
        sb.from('user_constraints').select('constraint_key, severity, affects_pillars').eq('user_id', userId),
      ]);
      return {
        age: profile?.age,
        gender: profile?.gender,
        height_cm: profile?.height,
        weight_kg: profile?.weight,
        injuries: (constraints || [])
          .filter(c => c.constraint_key)
          .map(c => ({
            key: c.constraint_key,
            severity: c.severity,
            affects_pillars: c.affects_pillars || [],
          })),
      };
    }

    case 'get_readiness': {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await sb
        .from('user_readiness')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle();

      if (!data) return { available: false, message: 'Žádná data připravenosti pro dnešek.' };

      const hrvDelta = data.hrv_ms && data.hrv_baseline_ms
        ? Math.round(((data.hrv_ms - data.hrv_baseline_ms) / data.hrv_baseline_ms) * 100)
        : null;

      return {
        available: true,
        hrv_ms: data.hrv_ms,
        hrv_baseline_ms: data.hrv_baseline_ms,
        hrv_delta_pct: hrvDelta,
        resting_hr: data.resting_hr,
        sleep_hours: data.sleep_hours,
        sleep_quality: data.sleep_quality,
        energy_level: data.energy_level,
        source: data.source,
        readiness_summary: hrvDelta !== null
          ? hrvDelta < -20 ? 'LOW — snižuj intenzitu'
          : hrvDelta < -10 ? 'MODERATE — opatrně'
          : 'GOOD — normální zátěž'
          : 'UNKNOWN — chybí HRV data',
      };
    }

    case 'get_medications': {
      const { data } = await sb
        .from('user_medications')
        .select('name, affects')
        .eq('user_id', userId)
        .eq('active', true);

      if (!data?.length) return { medications: [], notes: [] };

      const notes = [];
      const allAffects = data.flatMap(m => m.affects || []);
      if (allAffects.includes('hr_unreliable')) notes.push('HR nespolehlivý → používej RPE místo tepu');
      if (allAffects.includes('fatigue')) notes.push('Léky způsobují únavu → snižuj intenzitu');
      if (allAffects.includes('glucose_masked')) notes.push('Hladina cukru nemusí odrážet skutečný stav');
      if (allAffects.includes('bp_lowered')) notes.push('BP snížený léky → pozor na ortostatiku');

      return { medications: data.map(m => m.name), notes };
    }

    case 'get_decathlon': {
      const { data } = await sb
        .from('user_decathlon')
        .select('goal_key, label, target_age, priority, pillar_weights')
        .eq('user_id', userId)
        .eq('active', true)
        .order('priority', { ascending: false });

      if (!data?.length) return { goals: [], message: 'Desetiboj není nastaven.' };

      // Aggregate pillar importance across all goals weighted by priority
      const pillarScore = {};
      for (const goal of data) {
        for (const [pillar, weight] of Object.entries(goal.pillar_weights || {})) {
          pillarScore[pillar] = (pillarScore[pillar] || 0) + weight * goal.priority;
        }
      }

      return {
        goals: data.map(g => ({ key: g.goal_key, label: g.label, priority: g.priority })),
        pillar_importance: pillarScore,
      };
    }

    case 'get_bottleneck': {
      const MAIN = ['telo', 'mysl', 'vyziva', 'zdravi', 'metabolicke'];
      const LABELS = { telo: 'Tělo', mysl: 'Mysl', vyziva: 'Výživa', zdravi: 'Zdraví', metabolicke: 'Metabolismus' };
      const { data } = await sb
        .from('user_metrics')
        .select('node_id, state, current_index')
        .eq('user_id', userId)
        .eq('universe', 'longevity')
        .in('node_id', MAIN)
        .order('current_index', { ascending: true });

      if (!data?.length) return { node_id: null, message: 'Žádná data.' };
      const worst = data[0];
      return { node_id: worst.node_id, label: LABELS[worst.node_id] || worst.node_id, state: worst.state, index: worst.current_index };
    }

    case 'get_node_state': {
      const nodeId = input.node_id;
      if (nodeId === 'all') {
        const MAIN = ['telo', 'mysl', 'vyziva', 'zdravi', 'metabolicke'];
        const { data } = await sb.from('user_metrics').select('node_id, state, current_index')
          .eq('user_id', userId).eq('universe', 'longevity').in('node_id', MAIN);
        const map = {};
        for (const m of (data || [])) map[m.node_id] = { state: m.state, index: m.current_index };
        return map;
      }
      const { data } = await sb.from('user_metrics').select('state, current_index')
        .eq('user_id', userId).eq('node_id', nodeId).eq('universe', 'longevity').maybeSingle();
      return data || { state: 'UNKNOWN', index: null };
    }

    case 'get_killer': {
      const LABELS = {
        infarkt_a_mrtvice: 'srdce a cévy',
        cukrovka: 'hladina cukru a metabolismus',
        demence: 'mozek a paměť',
        rakovina: 'buněčná odolnost',
      };
      const { data } = await sb.from('node_riders').select('rider')
        .eq('node_id', input.node_id).order('priority', { ascending: true }).limit(1).maybeSingle();
      return { node_id: input.node_id, killer: data?.rider || 'unknown', label: LABELS[data?.rider] || 'neznámé ohrožení' };
    }

    case 'get_streak': {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await sb.from('mission_log').select('date')
        .eq('user_id', userId).order('date', { ascending: false }).limit(30);

      const dates = [...new Set((data || []).map(r => r.date))].sort().reverse();
      const todayDone = dates[0] === today;

      let streak = 0;
      const ref = new Date(today);
      for (const d of dates) {
        if (d === ref.toISOString().split('T')[0]) { streak++; ref.setDate(ref.getDate() - 1); }
        else if (!todayDone && streak === 0) { ref.setDate(ref.getDate() - 1); if (d === ref.toISOString().split('T')[0]) { streak++; ref.setDate(ref.getDate() - 1); } else break; }
        else break;
      }

      return { streak, today_done: todayDone };
    }

    case 'get_aspiration': {
      const { data: asp } = await sb.from('user_aspirations')
        .select('aspiration_type, aspiration_label').eq('user_id', userId).maybeSingle();
      if (!asp?.aspiration_type) return { aspiration: null };

      const { data: reqs } = await sb.from('aspiration_requirements')
        .select('node_id, required_level, importance_weight').eq('aspiration_type', asp.aspiration_type);
      if (!reqs?.length) return { label: asp.aspiration_label, gaps: [] };

      const { data: metrics } = await sb.from('user_metrics').select('node_id, current_index')
        .eq('user_id', userId).eq('universe', 'longevity').in('node_id', reqs.map(r => r.node_id));

      const gaps = reqs.map(r => {
        const m = (metrics || []).find(m => m.node_id === r.node_id);
        const gap = Math.max(0, r.required_level - (m ? m.current_index / 100 : 0));
        return { node_id: r.node_id, gap: Math.round(gap * 100) };
      }).filter(g => g.gap > 2).sort((a, b) => b.gap - a.gap);

      return { label: asp.aspiration_label, gaps };
    }

    case 'get_recent_decisions': {
      const { data } = await sb.from('orchestrator_log')
        .select('date, pillar, node_id, completed, verdict, reasoning')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);
      return { recent: data || [] };
    }

    case 'submit_decision':
      // Handled by caller — just return the input as-is
      return input;

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { message, nodeId, userId: bodyUserId } = req.body || {};
    const userId = bodyUserId || 'demo-user-123';

    if (!message) return res.status(400).json({ error: 'Missing message' });

    const userContent = nodeId
      ? `[Uživatel je na uzlu: ${nodeId}] ${message}`
      : message;

    const messages = [{ role: 'user', content: userContent }];

    // ── TOOL LOOP ─────────────────────────────────────
    let decision = null;
    const toolTrace = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      // Collect tool calls from this response
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

      if (!toolUseBlocks.length || response.stop_reason === 'end_turn') {
        // No more tool calls — extract text if any
        break;
      }

      // Add assistant response to messages
      messages.push({ role: 'assistant', content: response.content });

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          console.log(`🔧 [${round}] ${block.name}(${JSON.stringify(block.input)})`);

          if (block.name === 'submit_decision') {
            decision = block.input;
            return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) };
          }

          const result = await executeTool(block.name, block.input, sb, userId);
          toolTrace.push({ name: block.name, input: block.input, result });
          return { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) };
        })
      );

      // If decision was submitted, we're done
      if (decision) break;

      messages.push({ role: 'user', content: toolResults });
    }

    if (!decision) {
      return res.status(500).json({ error: 'Orchestrátor nedokončil rozhodnutí.' });
    }

    // Save to orchestrator_log — pillar column stores discipline_id
    await sb.from('orchestrator_log').insert({
      user_id: userId,
      node_id: nodeId || decision.node_id || null,
      pillar: decision.discipline_id,          // reuse existing column
      verdict: decision.verdict,
      completion_feedback: decision.completion_feedback,
      weekly_hint: decision.weekly_hint || null,
      reasoning: decision.reasoning,
      signals: toolTrace.find(t => t.name === 'get_readiness')?.result || {},
    }).then(({ error }) => { if (error) console.warn('orchestrator_log insert failed:', error.message); });

    return res.json({
      discipline_id: decision.discipline_id,
      node_id: decision.node_id,
      verdict: decision.verdict,
      completion_feedback: decision.completion_feedback,
      weekly_hint: decision.weekly_hint || null,
      debug: process.env.NODE_ENV === 'development'
        ? { reasoning: decision.reasoning, tools: toolTrace.map(t => t.name) }
        : undefined,
    });

  } catch (e) {
    console.error('orchestrator error:', e);
    return res.status(500).json({ error: e.message });
  }
}
