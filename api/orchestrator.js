// =====================================================
// API: /api/orchestrator.js — CHJ Master Agent (fast)
// Architecture: pre-fetch all data → single Haiku call → save
// Target: 5-8s total (fits Vercel Hobby 10s limit)
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-haiku-4-5';

// ── SYSTEM PROMPT ──────────────────────────────────────
const SYSTEM_PROMPT = `Jsi CHJ rozhodovatel — vybíráš disciplínu Dekatlonu pro dnešní den.

PRAVIDLA:
- Česky, tykej, přímočaře
- Nikdy název nemoci — HUD label: SRDCE, MOZEK, METABOLISMUS, IMUNITA
- HRV delta < -20% → vynechej kardio a sila, preferuj spanek nebo stabilita
- Spánek < 6h → snižuj intenzitu, preferuj emocni, smysl, stabilita
- Včerejší disciplína = sila → dnes ne sila
- Bottleneck (nejnižší index) má nejvyšší prioritu
- Sen uživatele → zmiň ho vždy v completion_feedback, konkrétně

10 DISCIPLÍN:
sila | kardio | stabilita | spanek | vyziva | metabolismus | kognitivni | emocni | prevence | smysl

VÝSTUPY:
- verdict: max 15 slov, přímé, bez caveat
- completion_feedback: max 1 věta, hovorová čeština jako trenér, VŽDY s konkrétním odkazem na sen uživatele
  Příklady tónu:
    "Srdce, které v osmdesáti pěti dotáhne ten půlkilometr — stavíš ho dnes."
    "Každý záběr ve vodě začíná tady — kardio, které se počítá."
    "Bez tahle základny ten půlkilometr v pětaosmdesáti neuplaváš."
    "Svaly si to pamatují — v osmdesáti pěti ti to vrátí v bazénu."
  Zakázané konstrukce: "si tělo" (špatně) → "tělo" (správně)
  Zakázané tvary: "buješ", "polovikilometr" → správně "budeš", "půlkilometr"
  Vyhni se infinitivům — radši "budeš", "zvládneš", "dotáhneš"
- weekly_hint: volitelně, max 1 věta co přijde zítra/tento týden

ODPOVĚZ POUZE JSON (bez markdown):
{"discipline_id":"...","node_id":"...","verdict":"...","completion_feedback":"...","reasoning":"...","weekly_hint":"..."}`;

// ── PRE-FETCH ALL USER CONTEXT ─────────────────────────
async function fetchUserContext(sb, userId) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const [
    profileRes, readinessRes, medsRes, decathlonRes,
    metricsRes, constraintsRes, recentRes,
  ] = await Promise.all([
    sb.from('user_profiles').select('age, gender, height, weight').eq('user_id', userId).maybeSingle(),
    sb.from('user_readiness').select('hrv_ms, hrv_baseline_ms, resting_hr, sleep_hours, energy_level').eq('user_id', userId).eq('date', today).maybeSingle(),
    sb.from('user_medications').select('name, affects').eq('user_id', userId).eq('active', true),
    sb.from('user_decathlon').select('goal_key, label, target_age, pillar_weights').eq('user_id', userId).eq('active', true).maybeSingle(),
    sb.from('user_metrics').select('node_id, state, current_index').eq('user_id', userId).eq('universe', 'longevity').in('node_id', ['telo','zdravi','mysl','vyziva','metabolicke']),
    sb.from('user_constraints').select('constraint_key, severity').eq('user_id', userId),
    sb.from('orchestrator_log').select('date, pillar, verdict').eq('user_id', userId).gte('date', weekAgoStr).order('date', { ascending: false }).limit(7),
  ]);

  // Compute HRV delta
  const r = readinessRes.data;
  const hrvDelta = r?.hrv_ms && r?.hrv_baseline_ms
    ? Math.round(((r.hrv_ms - r.hrv_baseline_ms) / r.hrv_baseline_ms) * 100)
    : null;

  // Find bottleneck (lowest index among main nodes)
  const metrics = metricsRes.data || [];
  const nonGray = metrics.filter(m => m.state !== 'GRAY');
  const bottleneck = nonGray.sort((a, b) => a.current_index - b.current_index)[0] || null;

  // Yesterday's discipline
  const yesterday = recentRes.data?.[0];
  const yesterdayDiscipline = yesterday?.date === new Date(Date.now() - 86400000).toISOString().split('T')[0]
    ? yesterday.pillar : null;

  return {
    today,
    profile: profileRes.data,
    readiness: r ? {
      hrv_delta_pct: hrvDelta,
      sleep_hours: r.sleep_hours,
      energy_level: r.energy_level,
      resting_hr: r.resting_hr,
      summary: hrvDelta !== null
        ? (hrvDelta < -20 ? 'LOW — snižuj intenzitu' : hrvDelta < -10 ? 'MODERATE' : 'GOOD')
        : 'UNKNOWN',
    } : null,
    medications: (medsRes.data || []).map(m => m.name),
    dream: decathlonRes.data ? {
      goal: decathlonRes.data.label,
      target_age: decathlonRes.data.target_age,
      key: decathlonRes.data.goal_key,
    } : null,
    bottleneck: bottleneck ? { node_id: bottleneck.node_id, state: bottleneck.state, index: bottleneck.current_index } : null,
    nodes: metrics.map(m => ({ node_id: m.node_id, state: m.state, index: m.current_index })),
    injuries: (constraintsRes.data || []).map(c => c.constraint_key),
    yesterday_discipline: yesterdayDiscipline,
    recent_disciplines: (recentRes.data || []).map(r => r.pillar).filter(Boolean),
  };
}

// ── DETERMINISTIC FALLBACK ─────────────────────────────
function fallbackDecision(ctx) {
  const discipline = ctx.readiness?.hrv_delta_pct < -20 ? 'spanek'
    : ctx.readiness?.sleep_hours < 6 ? 'emocni'
    : ctx.yesterday_discipline === 'sila' ? 'kardio'
    : ctx.bottleneck?.node_id === 'telo' ? 'sila'
    : ctx.bottleneck?.node_id === 'zdravi' ? 'kardio'
    : ctx.bottleneck?.node_id === 'mysl' ? 'kognitivni'
    : 'stabilita';

  const nodeMap = { sila: 'telo', kardio: 'zdravi', stabilita: 'telo', spanek: 'mysl', kognitivni: 'mysl', emocni: 'mysl', vyziva: 'vyziva', metabolismus: 'metabolicke', prevence: 'zdravi', smysl: 'mysl' };

  return {
    discipline_id: discipline,
    node_id: nodeMap[discipline] || 'telo',
    verdict: 'Dnes jdeme na ' + discipline + '.',
    completion_feedback: ctx.dream ? `Každý krok tě přibližuje k cíli — ${ctx.dream.goal} v ${ctx.dream.target_age}.` : 'Dobrá práce, pokračuj.',
    reasoning: 'fallback: deterministic',
    weekly_hint: null,
  };
}

// ── MAIN HANDLER ──────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { nodeId, userId: bodyUserId } = req.body || {};
    const userId = bodyUserId || 'demo-user-123';

    // 1. Check cache — if already decided today for this node, return cached
    const today = new Date().toISOString().split('T')[0];
    const { data: cached } = await sb.from('orchestrator_log')
      .select('pillar, verdict, completion_feedback, weekly_hint')
      .eq('user_id', userId)
      .eq('node_id', nodeId || null)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.verdict) {
      return res.json({
        discipline_id: cached.pillar,
        verdict: cached.verdict,
        completion_feedback: cached.completion_feedback,
        weekly_hint: cached.weekly_hint || null,
        cached: true,
      });
    }

    // 2. Pre-fetch all context in parallel
    const ctx = await fetchUserContext(sb, userId);

    // 3. Build context message for Haiku
    const contextMsg = `
UŽIVATEL: věk ${ctx.profile?.age ?? '?'}, pohlaví ${ctx.profile?.gender ?? '?'}
READINESS: ${ctx.readiness ? `HRV delta ${ctx.readiness.hrv_delta_pct ?? 'N/A'}%, spánek ${ctx.readiness.sleep_hours ?? 'N/A'}h, energie ${ctx.readiness.energy_level ?? 'N/A'}/5 → ${ctx.readiness.summary}` : 'Bez dat'}
LÉKY: ${ctx.medications.length ? ctx.medications.join(', ') : 'žádné'}
OMEZENÍ: ${ctx.injuries.length ? ctx.injuries.join(', ') : 'žádná'}
BOTTLENECK: ${ctx.bottleneck ? `${ctx.bottleneck.node_id} (${ctx.bottleneck.state}, index ${ctx.bottleneck.index})` : 'nezjištěn'}
UZLY: ${ctx.nodes.map(n => `${n.node_id}:${n.state}(${n.index})`).join(', ')}
VČERA: ${ctx.yesterday_discipline ?? 'nic'}
POSLEDNÍ DISCIPLÍNY: ${ctx.recent_disciplines.slice(0, 5).join(', ') || 'žádné'}
SEN: ${ctx.dream ? `"${ctx.dream.goal}" ve věku ${ctx.dream.target_age} let` : 'není nastaven'}
UZEL: ${nodeId ?? 'obecně'}

Rozhodni které disciplíně dát dnes prioritu.`.trim();

    // 4. Call Haiku — single turn, JSON response
    let decision = null;
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contextMsg }],
      });

      const text = response.content.find(b => b.type === 'text')?.text || '';
      // Extract JSON (handle possible markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        decision = JSON.parse(jsonMatch[0]);
      } else {
        console.warn('Haiku: no JSON found in response');
      }
    } catch (e) {
      console.warn('Haiku call failed:', e.message);
    }

    // 5. Fallback if Haiku failed or returned invalid response
    const VALID_DISCIPLINES = ['sila','kardio','stabilita','spanek','vyziva','metabolismus','kognitivni','emocni','prevence','smysl'];
    if (!decision || !VALID_DISCIPLINES.includes(decision.discipline_id)) {
      console.warn('Using deterministic fallback');
      decision = fallbackDecision(ctx);
    }

    // 6. Save to orchestrator_log
    await sb.from('orchestrator_log').insert({
      user_id: userId,
      node_id: nodeId || decision.node_id || null,
      pillar: decision.discipline_id,
      verdict: decision.verdict,
      completion_feedback: decision.completion_feedback,
      weekly_hint: decision.weekly_hint || null,
      reasoning: decision.reasoning,
      signals: ctx.readiness || {},
    }).then(({ error }) => {
      if (error) console.warn('orchestrator_log insert failed:', error.message);
    });

    return res.json({
      discipline_id: decision.discipline_id,
      node_id: decision.node_id,
      verdict: decision.verdict,
      completion_feedback: decision.completion_feedback,
      weekly_hint: decision.weekly_hint || null,
    });

  } catch (e) {
    console.error('orchestrator error:', e);
    return res.status(500).json({ error: e.message });
  }
}
