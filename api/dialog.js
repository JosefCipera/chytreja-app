// =====================================================
// API ENDPOINT: /api/dialog.js — Constraint Finding Dialog
//
// POST {
//   userId,
//   role,
//   messages: [{ role: 'assistant'|'user', content: string }]
// }
//
// Vrací:
//   { text, done: false }                          — další otázka
//   { text, done: true, constraint, node_id }      — constraint nalezen, uloží do daily_checkin
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mapování constraint klíčových slov → node_id
const CONSTRAINT_NODE_MAP = {
  spanek:     ['spánek', 'unavený', 'unavena', 'nespal', 'nespala', 'málo spánek', 'probouzel'],
  mysl:       ['stres', 'práce', 'tlačí', 'hlava', 'úzkost', 'nestíhám', 'dusí', 'myšlenky', 'neklid'],
  kardio:     ['kondice', 'dech', 'srdce', 'pohyb', 'cvičení'],
  vyziva:     ['jídlo', 'jím', 'výživa', 'přejídám', 'sladké'],
  regenerace: ['bolest', 'zranění', 'přetížený', 'přetížená', 'svaly'],
};

async function fetchContext(userId, role) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [metricsRes, profileRes] = await Promise.all([
    supabase.from('user_metrics')
      .select('node_id, current_index, state')
      .eq('user_id', userId)
      .in('state', ['RED', 'YELLOW'])
      .order('current_index', { ascending: true })
      .limit(4),
    supabase.from('user_health_profile')
      .select('diagnoses, labs, goal_text, crt_cache')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const worstNodes = (metricsRes.data || [])
    .map(n => `${n.node_id} (${n.state})`)
    .join(', ');

  const profile = profileRes.data || {};
  const diagnoses = profile.diagnoses?.join(', ') || null;
  const ldl = profile.labs?.LDL ? `LDL ${profile.labs.LDL}` : null;
  const goal = profile.goal_text || null;

  // CRT root cause
  const crtRoot = profile.crt_cache?.nodes?.find(n => n.type === 'root')?.label || null;

  return { worstNodes, diagnoses, ldl, goal, crtRoot, role };
}

async function saveConstraint(userId, nodeId, constraint) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const today = new Date().toISOString().slice(0, 10);

    // Upsert dnešní záznam — přidá constraint_node_id
    await supabase.from('daily_checkin')
      .upsert({
        user_id: userId,
        date: today,
        universe: 'longevity',
        constraint_node_id: nodeId,
        constraint_label: constraint,
      }, { onConflict: 'user_id,date,universe' });
  } catch (e) {
    console.warn('[Dialog] saveConstraint failed:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, role = 'longevity', messages = [] } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const ctx = await fetchContext(userId, role);

  const contextBlock = [
    ctx.worstNodes && `Nejslabší uzly: ${ctx.worstNodes}`,
    ctx.diagnoses  && `Diagnózy: ${ctx.diagnoses}`,
    ctx.ldl        && ctx.ldl,
    ctx.goal       && `Cíl: ${ctx.goal}`,
    ctx.crtRoot    && `Kořenová příčina (CRT): ${ctx.crtRoot}`,
  ].filter(Boolean).join('\n');

  const systemPrompt = `Jsi CHJ — osobní průvodce zdravím. Vedeš krátký ranní rozhovor abys zjistil co dnes nejvíc blokuje uživatele.

Kontext uživatele:
${contextBlock}

Pravidla:
- Max 3 otázky celkem (včetně první). Pak musíš rozhodnout.
- Každá otázka je jedna věta, max 12 slov, tykání.
- Reaguj na odpověď — nedrž skript.
- Když víš constraint, vrať JSON na samostatném řádku (nic jiného):
  {"done":true,"text":"jedna akce max 12 slov","constraint":"název","node_id":"node_id"}
- node_id musí být jedno z: spanek, mysl, kardio, vyziva, regenerace
- Akce musí respektovat diagnózy (při FaP ne sprint, ne maximální zátěž)
- Pokud uživatel říká že je v pohodě → constraint je kondice nebo spánek (vždy něco lze posunout)
- Tykání, čistá čeština, žádná anglická slova`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing' });

  // První zpráva — CHJ začíná otázkou
  const aiMessages = messages.length === 0
    ? []
    : messages;

  // Pokud žádné zprávy → první otázka bez user inputu
  const reqMessages = aiMessages.length === 0
    ? [{ role: 'user', content: '(začni dialog)' }]
    : aiMessages;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system: systemPrompt,
      messages: reqMessages,
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return res.status(502).json({ error: 'Claude error', detail: err });
  }

  const data = await aiRes.json();
  const raw = data.content?.[0]?.text?.trim() ?? '';

  // Zkus parsovat JSON odpověď (done=true)
  try {
    const jsonMatch = raw.match(/\{.*"done"\s*:\s*true.*\}/s);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      // Ulož constraint do daily_checkin
      if (result.node_id) {
        await saveConstraint(userId, result.node_id, result.constraint);
      }
      return res.json({
        text: result.text,
        done: true,
        constraint: result.constraint,
        node_id: result.node_id,
      });
    }
  } catch (_) {}

  // Další otázka
  return res.json({ text: raw, done: false });
}
