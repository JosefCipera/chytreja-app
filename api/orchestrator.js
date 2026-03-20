// =====================================================
// API: /api/orchestrator.js — CHJ Master Agent
// AI orchestrátor s tool_use (function calling)
// AI samo rozhodne jaké nástroje zavolat.
// =====================================================

import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ── TOOLS DEFINITION ──────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_node_state',
      description: 'Zjistí aktuální stav uzlu (GREEN/YELLOW/RED) a current_index (0-100). Volej pro konkrétní uzel nebo pro přehled všech hlavních uzlů.',
      parameters: {
        type: 'object',
        properties: {
          node_id: { type: 'string', description: 'ID uzlu (telo, mysl, vyziva, zdravi, metabolicke) nebo "all" pro přehled' },
        },
        required: ['node_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bio_age',
      description: 'Spočítá biologický věk uživatele z fitness markerů (VO2max, síla, stabilita, mobilita). Vrací chronologický věk, bio-věk a rozdíl.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bottleneck',
      description: 'Najde nejslabší uzel (bottleneck) — ten, který nejvíc brzdí dlouhověkost. Vrací node_id, stav a skóre.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_streak',
      description: 'Zjistí streak (počet po sobě jdoucích dní se splněnou misí) a zda je dnešní mise splněná.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_aspiration',
      description: 'Vrátí sen uživatele (aspiraci) a jak daleko od něj je. Např. "Běžky v 85 — zaostává v síle a kardiu".',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_killer',
      description: 'Vrátí hlavního "černého jezdce" (smrtelné ohrožení) pro daný uzel — infarkt, cukrovka, demence nebo rakovina.',
      parameters: {
        type: 'object',
        properties: {
          node_id: { type: 'string', description: 'ID uzlu' },
        },
        required: ['node_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mission',
      description: 'Vrátí dnešní misi pro uzel — konkrétní cvičení/úkol s typem akce (timer, counter, habit).',
      parameters: {
        type: 'object',
        properties: {
          node_id: { type: 'string', description: 'ID uzlu' },
        },
        required: ['node_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_profile',
      description: 'Vrátí profil uživatele — věk, pohlaví, výška, váha, omezení (zranění).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

// ── SYSTEM PROMPT ─────────────────────────────────────
const SYSTEM_PROMPT = `Jsi Chytré Já (CHJ) — osobní AI kouč pro dlouhověkost. Tvůj přístup je Medicine 3.0 (Peter Attia, Outlive).

ROLE: Jsi mentor, parťák, průvodce. Ne lékař, ne strašák.

PRAVIDLA:
- Česky, tykej, buď přímý
- Mluv lidsky — ne "musíš", ne "je důležité", ne "měl bys"
- Nikdy nepiš názvy nemocí přímo (ne "cukrovka" ale "hladina cukru", ne "infarkt" ale "srdce")
- Použij nástroje k získání dat — NIKDY si nevymýšlej čísla ani stavy
- Odpovídej max 3 větami, pokud se uživatel neptá na detail
- Když navrhuješ akci, buď extrémně konkrétní (kolik, jak často, jak dlouho)
- Zohledni omezení uživatele (zranění) — vždy nabídni alternativu

MÁŠ K DISPOZICI NÁSTROJE — použij je k získání aktuálních dat.
Nevolej všechny najednou. Zavolej jen ty, které potřebuješ pro odpověď.

Příklady rozhodování:
- "Jak na tom jsem?" → get_bio_age + get_bottleneck
- "Co mám dnes dělat?" → get_streak + get_mission(bottleneck_node)
- "Proč je tělo červené?" → get_node_state("telo") + get_killer("telo")
- "Jaký mám streak?" → get_streak
- "Co je můj sen?" → get_aspiration`;

// ── TOOL IMPLEMENTATIONS ──────────────────────────────
async function executeTool(name, args, supabase, userId) {
  switch (name) {

    case 'get_node_state': {
      const nodeId = args.node_id;
      if (nodeId === 'all') {
        const MAIN = ['telo', 'mysl', 'vyziva', 'zdravi', 'metabolicke'];
        const { data } = await supabase
          .from('user_metrics')
          .select('node_id, state, current_index')
          .eq('user_id', userId)
          .eq('universe', 'longevity')
          .in('node_id', MAIN);
        const map = {};
        for (const m of (data || [])) {
          map[m.node_id] = { state: m.state, index: m.current_index };
        }
        return map;
      }
      const { data } = await supabase
        .from('user_metrics')
        .select('state, current_index')
        .eq('user_id', userId)
        .eq('node_id', nodeId)
        .eq('universe', 'longevity')
        .maybeSingle();
      return data || { state: 'UNKNOWN', index: null };
    }

    case 'get_bio_age': {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('age')
        .eq('user_id', userId)
        .maybeSingle();

      const MARKERS = ['vo2max', 'sila', 'stabilita', 'mobilita'];
      const WEIGHTS = { vo2max: 0.40, sila: 0.25, stabilita: 0.20, mobilita: 0.15 };
      const { data: metrics } = await supabase
        .from('user_metrics')
        .select('node_id, current_index')
        .eq('user_id', userId)
        .eq('universe', 'longevity')
        .in('node_id', MARKERS);

      function indexToOffset(idx) {
        if (idx <= 20) return 20;
        if (idx <= 40) return 10;
        if (idx <= 60) return 4;
        if (idx <= 75) return 0;
        if (idx <= 90) return -5;
        return -12;
      }

      const chronAge = profile?.age || 50;
      let weightedOffset = 0;
      for (const m of (metrics || [])) {
        const w = WEIGHTS[m.node_id] || 0;
        weightedOffset += indexToOffset(m.current_index) * w;
      }

      const bioAge = Math.round(chronAge + weightedOffset);
      return {
        chronological: chronAge,
        biological: bioAge,
        difference: bioAge - chronAge,
        interpretation: bioAge > chronAge
          ? `Tělo stárne o ${bioAge - chronAge} let rychleji`
          : bioAge < chronAge
            ? `Tělo je o ${chronAge - bioAge} let mladší`
            : 'Tělo odpovídá věku',
      };
    }

    case 'get_bottleneck': {
      const MAIN = ['telo', 'mysl', 'vyziva', 'zdravi', 'metabolicke'];
      const LABELS = { telo: 'Tělo', mysl: 'Mysl', vyziva: 'Výživa', zdravi: 'Zdraví', metabolicke: 'Metabolismus' };
      const { data } = await supabase
        .from('user_metrics')
        .select('node_id, state, current_index')
        .eq('user_id', userId)
        .eq('universe', 'longevity')
        .in('node_id', MAIN)
        .order('current_index', { ascending: true });

      if (!data?.length) return { node_id: null, message: 'Žádná data' };

      const worst = data[0];
      return {
        node_id: worst.node_id,
        label: LABELS[worst.node_id] || worst.node_id,
        state: worst.state,
        index: worst.current_index,
      };
    }

    case 'get_streak': {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('mission_log')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);

      const dates = (data || []).map(r => r.date);
      const todayDone = dates.includes(today);

      // Count consecutive days
      const unique = [...new Set(dates)].sort().reverse();
      let streak = 0;
      const expected = new Date(today);
      if (unique[0] === today) {
        streak = 1;
        expected.setDate(expected.getDate() - 1);
        for (let i = 1; i < unique.length; i++) {
          if (unique[i] === expected.toISOString().split('T')[0]) {
            streak++;
            expected.setDate(expected.getDate() - 1);
          } else break;
        }
      } else {
        expected.setDate(expected.getDate() - 1);
        for (const d of unique) {
          if (d === expected.toISOString().split('T')[0]) {
            streak++;
            expected.setDate(expected.getDate() - 1);
          } else break;
        }
      }

      return { streak, todayDone, totalMissions: dates.length };
    }

    case 'get_aspiration': {
      const { data: asp } = await supabase
        .from('user_aspirations')
        .select('aspiration_type, aspiration_label')
        .eq('user_id', userId)
        .maybeSingle();

      if (!asp?.aspiration_type) {
        return { aspiration: null, message: 'Uživatel nemá nastavený sen.' };
      }

      const label = asp.aspiration_label;
      const type = asp.aspiration_type;

      // Get gaps for all nodes
      const { data: reqs } = await supabase
        .from('aspiration_requirements')
        .select('node_id, required_level, importance_weight')
        .eq('aspiration_type', type);

      if (!reqs?.length) return { label, gaps: [] };

      const nodeIds = reqs.map(r => r.node_id);
      const { data: metrics } = await supabase
        .from('user_metrics')
        .select('node_id, current_index')
        .eq('user_id', userId)
        .eq('universe', 'longevity')
        .in('node_id', nodeIds);

      const LABELS = { telo: 'Tělo', mysl: 'Mysl', vyziva: 'Výživa', zdravi: 'Zdraví', metabolicke: 'Metabolismus', sila: 'Síla', stabilita: 'Stabilita', kardio: 'Kardio', vo2max: 'VO2max' };
      const gaps = reqs.map(r => {
        const m = (metrics || []).find(m => m.node_id === r.node_id);
        const current = m ? m.current_index / 100 : 0;
        const gap = Math.max(0, r.required_level - current);
        return { node_id: r.node_id, label: LABELS[r.node_id] || r.node_id, gap: Math.round(gap * 100) / 100, achieved: gap <= 0.02 };
      }).filter(g => g.gap > 0.02).sort((a, b) => b.gap - a.gap);

      return { label, gaps };
    }

    case 'get_killer': {
      const KILLER_LABELS = {
        infarkt_a_mrtvice: 'infarkt a mrtvice (srdce a cévy)',
        cukrovka: 'cukrovka (metabolický syndrom)',
        demence: 'demence (neurodegenerace)',
        rakovina: 'rakovina (onkologie)',
      };
      const { data } = await supabase
        .from('node_riders')
        .select('rider')
        .eq('node_id', args.node_id)
        .order('priority', { ascending: true })
        .limit(1)
        .maybeSingle();

      return {
        node_id: args.node_id,
        killer: data?.rider || 'unknown',
        description: KILLER_LABELS[data?.rider] || 'neznámé ohrožení',
      };
    }

    case 'get_mission': {
      const { data: metric } = await supabase
        .from('user_metrics')
        .select('state')
        .eq('user_id', userId)
        .eq('node_id', args.node_id)
        .eq('universe', 'longevity')
        .maybeSingle();

      const state = metric?.state || 'YELLOW';

      // Dynamic import of skill
      // Note: In serverless, we inline a simple mission picker
      const NODE_SKILL = {
        telo: 'cviceni', sila: 'cviceni', stabilita: 'cviceni', kardio: 'cviceni', vo2max: 'cviceni',
        mysl: 'mindset', meditace: 'mindset', soustredeni: 'mindset', emoce: 'mindset', stres: 'mindset',
        vyziva: 'vyziva', protein: 'vyziva', hydratace: 'vyziva',
        zdravi: 'prevence', imunitni: 'prevence', obnova: 'prevence',
        metabolicke: 'metabol', glukoza: 'metabol', pust: 'metabol',
      };

      return {
        node_id: args.node_id,
        state,
        skill: NODE_SKILL[args.node_id] || 'unknown',
        hint: `Mise se generuje na frontendu přes skill-router.js pro uzel ${args.node_id} ve stavu ${state}`,
      };
    }

    case 'get_user_profile': {
      const [{ data: profile }, { data: constraints }] = await Promise.all([
        supabase.from('user_profiles').select('age, gender, height, weight').eq('user_id', userId).maybeSingle(),
        supabase.from('user_constraints').select('constraint_key, severity').eq('user_id', userId).eq('constraint_type', 'injury'),
      ]);

      return {
        age: profile?.age,
        gender: profile?.gender,
        height: profile?.height,
        weight: profile?.weight,
        injuries: (constraints || []).map(c => `${c.constraint_key} (${c.severity})`),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── MAIN HANDLER ──────────────────────────────────────
export default async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { message, nodeId, userId: bodyUserId, context } = req.body || {};
    const userId = bodyUserId || context?.userId || 'demo-user-123';

    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    // Build initial user message with context hint
    let userContent = message;
    if (nodeId) {
      userContent = `[Uživatel je na uzlu: ${nodeId}] ${message}`;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];

    // ── TOOL LOOP (max 3 rounds) ───────────────────────
    let finalResponse = null;
    const toolCalls = [];

    for (let round = 0; round < 3; round++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: TOOLS,
        tool_choice: round === 0 ? 'auto' : 'auto',
        temperature: 0.7,
        max_tokens: 400,
      });

      const choice = completion.choices[0];

      // If AI wants to call tools
      if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length) {
        messages.push(choice.message);

        for (const tc of choice.message.tool_calls) {
          const args = JSON.parse(tc.function.arguments || '{}');
          console.log(`🔧 Tool call [${round}]: ${tc.function.name}(${JSON.stringify(args)})`);

          const result = await executeTool(tc.function.name, args, supabase, userId);
          toolCalls.push({ name: tc.function.name, args, result });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        // Continue loop — AI will process tool results
        continue;
      }

      // AI gave a final text response
      finalResponse = choice.message.content;
      break;
    }

    if (!finalResponse) {
      finalResponse = 'Omlouvám se, něco se nepovedlo. Zkus to znovu.';
    }

    return res.json({
      verdict: finalResponse,
      toolsUsed: toolCalls.map(t => t.name),
      debug: process.env.NODE_ENV === 'development' ? toolCalls : undefined,
    });

  } catch (e) {
    console.error('orchestrator error:', e);
    return res.status(500).json({ error: e.message });
  }
}
