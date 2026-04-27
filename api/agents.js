// =====================================================
// API: /api/agents.js — CHJ Agent Router
// Routes to specialized agents based on `type` param
//
// POST /api/agents
// Body: { type: 'telo', userId, discipline, nodeId }
//
// Agents:
//   telo   — sila | kardio | stabilita
//   mysl   — spanek | kognitivni | emocni | smysl
//   zdravi — prevence | metabolismus
//   vyziva — vyziva
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
- guide_search: krátký YouTube dotaz v češtině (max 6 slov) pokud akce vyžaduje techniku/návod (cvičení, dýchání). null pro chůzi, vodu, záznamy.
- guide_label: "Jak cvičit" | "Jak dýchat" | "Jak na to" | null (dle guide_search)
- Česky, tykej, trenérský tón
- Správně: "svaly zad" (NE "záďě" — neexistuje), "svaly nohou" (NE "nožní svaly")
- Správně: "zánětlivý stav" (NE "zápalební stav" — neexistuje)
- type: "timed" (s dobou v sekundách) | "counter" (sety×repy) | "distance" (metry)

ODPOVĚZ POUZE JSON (bez markdown):
{"action_id":"...","label":"...","type":"timed|counter|distance","duration_s":null,"sets":null,"reps":null,"distance_m":null,"guide_search":null,"guide_label":null}`;

const TELO_FALLBACKS = {
  sila:      { action_id: 'drep_u_steny', label: 'Dřep u stěny 3×30s',  type: 'timed', duration_s: 90,   sets: 3, reps: null, distance_m: null, guide_search: 'dřep u stěny správná technika', guide_label: 'Jak cvičit' },
  kardio:    { action_id: 'chuze_20min',  label: 'Chůze 20 minut',       type: 'timed', duration_s: 1200, sets: null, reps: null, distance_m: null, guide_search: null, guide_label: null },
  stabilita: { action_id: 'plank_3x30',  label: 'Plank 3×30s',           type: 'timed', duration_s: 90,   sets: 3, reps: null, distance_m: null, guide_search: 'plank správná technika core', guide_label: 'Jak cvičit' },
};

async function teloAgent(client, sb, { userId, discipline, nodeId, force = false, excludeActionId = null }) {
  if (!['sila', 'kardio', 'stabilita'].includes(discipline)) {
    return { error: `Invalid discipline: ${discipline}` };
  }

  const today = new Date().toISOString().split('T')[0];

  // Cache check — skip when force=true (second action request)
  if (!force) {
    const { data: cached } = await sb.from('agent_log')
      .select('action_id, label, type, duration_s, sets, reps, distance_m, guide_search, guide_label')
      .eq('user_id', userId).eq('node_id', nodeId).eq('discipline', discipline).eq('date', today)
      .maybeSingle();
    if (cached?.action_id) return { ...cached, cached: true };
  }

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
${excludeActionId ? `VYHNOUT SE (právě splněno): ${excludeActionId}` : ''}
SEN: ${dream ? `"${dream.label}" ve věku ${dream.target_age} let` : 'není nastaven'}
${force ? 'DRUHÁ AKCE: Vyber jinou variantu cvičení než je VYHNOUT SE.' : ''}

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

  // Save to agent_log (fire and forget) — explicit columns to avoid schema mismatch
  sb.from('agent_log').insert({
    user_id: userId, node_id: nodeId, discipline, date: today, tier,
    action_id: action.action_id, label: action.label, type: action.type,
    duration_s: action.duration_s ?? null, sets: action.sets ?? null,
    reps: action.reps ?? null, distance_m: action.distance_m ?? null,
    guide_search: action.guide_search ?? null, guide_label: action.guide_label ?? null,
  }).then(({ error }) => { if (error) console.warn('agent_log insert failed:', error.message); });

  return action;
}

// ── MYSL AGENT ─────────────────────────────────────────
const MYSL_SYSTEM = `Jsi Mysl Agent CHJ — vybíráš konkrétní mentální nebo emoční cvičení pro dnešní disciplínu.

DISCIPLÍNY: spanek | kognitivni | emocni | smysl

TIER systém (dle stavu uzlu Mysl):
- tier 1 (index 0–40): jednoduché, nízká bariéra vstupu
- tier 2 (index 41–70): střední náročnost, vyžaduje soustředění
- tier 3 (index 71+): hluboká práce, náročnější rutiny

CVIČENÍ — SPÁNEK:
Tier 1: 4-7-8 dýchání před spánkem (4 min), Choď spát ve stejnou dobu 7 dní, Bez obrazovky 30 min před spaním
Tier 2: Box breathing 5 min + relaxace svalů, Chladná místnost 18°C + tma, Ranní světlo 10 min po probuzení
Tier 3: Kompletní spánková rutina (teplota, tma, čas, bez alkoholu), Sleduj spánek 7 dní a vyhodnoť

CVIČENÍ — KOGNITIVNÍ:
Tier 1: Čti 20 minut (kniha, ne zprávy), Křížovka nebo sudoku 15 min, Napiš 3 věci co ses dnes naučil
Tier 2: Meditace 10 minut (soustředění na dech), Nauč se 10 nových slov cizího jazyka, Čti náročnější text 30 min
Tier 3: Hluboká práce bez přerušení 45 min, Napiš shrnutí kapitoly vlastními slovy, Nauč se novou dovednost 30 min

CVIČENÍ — EMOČNÍ:
Tier 1: Napiš 3 věci za které jsi dnes vděčný, 5 minut box breathing, Krátká procházka v přírodě 15 min
Tier 2: Zavolej nebo napiš blízkému člověku, Deník emocí — co cítíš a proč (10 min), Vycházka v přírodě 30 min
Tier 3: Hluboký rozhovor s blízkým, Reflexe hodnot — co je pro tebe důležité (20 min), Odpusť si nebo druhému

CVIČENÍ — SMYSL:
Tier 1: Přečti si svůj sen a zamysli se co ti k němu dnes přiblíží, Udělej něco pro druhého (malá laskavost)
Tier 2: Pracuj 30 min na projektu který tě naplňuje, Napiš proč chceš dosáhnout svého snu
Tier 3: Mentoruj nebo pomoz někomu s dovedností kterou máš, Kreativní tvorba 45 min (psaní, hudba, kreslení)

PRAVIDLA:
- Nikdy neopakuj yesterdayAction
- guide_search: krátký YouTube dotaz v češtině (max 6 slov) pokud akce vyžaduje návod (dýchání, meditace). null pro čtení, záznamy, procházky.
- guide_label: "Jak dýchat" | "Průvodce meditací" | "Jak na to" | null
- Česky, tykej, klidný ale motivující tón
- Správně: "zánětlivý stav" (NE "zápalební stav" — neexistuje)
- type: "timed" (s dobou v sekundách) | "habit" (jednorázové HOTOVO)

ODPOVĚZ POUZE JSON (bez markdown):
{"action_id":"...","label":"...","type":"timed|habit","duration_s":null,"guide_search":null,"guide_label":null}`;

const MYSL_FALLBACKS = {
  spanek:     { action_id: 'dychani_478',  label: '4-7-8 dýchání před spánkem',                        type: 'timed', duration_s: 240,  guide_search: '4-7-8 dýchání technika návod', guide_label: 'Jak dýchat' },
  kognitivni: { action_id: 'cti_20min',    label: 'Čti 20 minut',                                      type: 'timed', duration_s: 1200, guide_search: null, guide_label: null },
  emocni:     { action_id: 'vdecnost_3',   label: 'Napiš 3 věci za které jsi vděčný',                  type: 'habit', duration_s: null, guide_search: null, guide_label: null },
  smysl:      { action_id: 'reflexe_snu',  label: 'Zamysli se nad svým snem — co ti k němu dnes přiblíží', type: 'habit', duration_s: null, guide_search: null, guide_label: null },
};

async function myslAgent(client, sb, { userId, discipline, nodeId, force = false, excludeActionId = null }) {
  if (!['spanek', 'kognitivni', 'emocni', 'smysl'].includes(discipline)) {
    return { error: `Invalid discipline for mysl: ${discipline}` };
  }

  const today = new Date().toISOString().split('T')[0];

  // Cache check — skip when force=true (second action request)
  if (!force) {
    const { data: cached } = await sb.from('agent_log')
      .select('action_id, label, type, duration_s, guide_search, guide_label')
      .eq('user_id', userId).eq('node_id', nodeId).eq('discipline', discipline).eq('date', today)
      .maybeSingle();
    if (cached?.action_id) return { ...cached, cached: true };
  }

  // Fetch context
  const [metricsRes, decathlonRes, missionRes] = await Promise.all([
    sb.from('user_metrics').select('current_index').eq('user_id', userId).eq('node_id', nodeId).eq('universe', 'longevity').maybeSingle(),
    sb.from('user_decathlon').select('label, target_age, goal_key').eq('user_id', userId).eq('active', true).maybeSingle(),
    sb.from('mission_log').select('action_id').eq('user_id', userId).eq('node_id', nodeId)
      .gte('date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const nodeIndex = metricsRes.data?.current_index ?? 50;
  const tier = getTier(nodeIndex);
  const dream = decathlonRes.data;
  const yesterdayAction = missionRes.data?.action_id ?? null;

  const contextMsg = `DISCIPLÍNA: ${discipline}
TIER: ${tier} (index uzlu Mysl: ${nodeIndex})
VČEREJŠÍ AKCE: ${yesterdayAction ?? 'žádná'}
${excludeActionId ? `VYHNOUT SE (právě splněno): ${excludeActionId}` : ''}
SEN: ${dream ? `"${dream.label}" ve věku ${dream.target_age} let` : 'není nastaven'}
${force ? 'DRUHÁ AKCE: Vyber jinou variantu než je VYHNOUT SE.' : ''}

Vyber jedno konkrétní cvičení pro dnešek.`;

  let action = null;
  try {
    const response = await client.messages.create({
      model: MODEL, max_tokens: 300,
      system: MYSL_SYSTEM,
      messages: [{ role: 'user', content: contextMsg }],
    });
    const text = response.content.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) action = JSON.parse(match[0]);
  } catch (e) {
    console.warn('Mysl Agent Haiku failed:', e.message);
  }

  if (!action?.action_id) {
    console.warn('Mysl Agent: fallback for', discipline);
    action = MYSL_FALLBACKS[discipline];
  }

  sb.from('agent_log').insert({
    user_id: userId, node_id: nodeId, discipline, date: today, tier,
    action_id: action.action_id, label: action.label, type: action.type,
    duration_s: action.duration_s ?? null,
    guide_search: action.guide_search ?? null, guide_label: action.guide_label ?? null,
  }).then(({ error }) => { if (error) console.warn('agent_log insert failed:', error.message); });

  return action;
}

// ── ZDRAVÍ AGENT ───────────────────────────────────────
const ZDRAVI_SYSTEM = `Jsi Zdraví Agent CHJ — vybíráš konkrétní preventivní nebo metabolickou akci pro dnešní den.

DISCIPLÍNY: prevence | metabolismus

TIER systém (dle stavu uzlu Zdraví/Metabolismus):
- tier 1 (index 0–40): základní návyky, nízká bariéra
- tier 2 (index 41–70): střední náročnost, vyžaduje plánování
- tier 3 (index 71+): pokročilé protokoly

CVIČENÍ — PREVENCE:
Tier 1: Zaznamenej co jsi dnes jedl (foto nebo text), Vypij 2,5l vody — nastav připomínky, Změř si TK ráno nalačno
Tier 2: Naplánuj preventivní prohlídku (zubař, oční, praktik), Omega-3 doplněk + vitamin D dnes, Přečti si jeden výsledek z posledních krevních testů
Tier 3: Projdi si výsledky krevních testů a zapiš trendy, CGM sledování — nasaď senzor, Konzultuj výsledky s lékařem

CVIČENÍ — METABOLISMUS:
Tier 1: Projdi se 10 minut po největším jídle dnes, Vynechej sladké nápoje celý den, Snídaně s 30g proteinu — vejce, tvaroh nebo jogurt
Tier 2: Přerušovaný půst 14:10 — první jídlo až v 10h, Vynechej škroby k večeři, Chůze 20 minut do 30 minut po obědě
Tier 3: Přerušovaný půst 16:8 — okno 12:00–20:00, Proteinový den (2g/kg těl. hmotnosti), Intervalová chůze 30 min (2 min rychle, 1 min pomalu)

GLUKÓZA — pokud uživatel zmíní hraniční glukózu (5,8–7,0):
- Prioritizuj: chůze po jídle, protein na snídani, vynechání rafinovaných sacharidů
- Vyhni se: půstu > 16h (může stresovat), extrémním doporučením
- coaching_note: zmiň konkrétní dopad na výkon při plavání nebo snu

PRAVIDLA:
- Nikdy neopakuj yesterdayAction
- guide_search: krátký YouTube dotaz v češtině (max 6 slov) jen pokud akce vyžaduje návod (CGM, krevní testy). null pro chůzi, vodu, záznamy.
- guide_label: "Návod" | "Jak na to" | null
- Česky, tykej, klidný ale přímý tón
- Správně: "zánětlivý stav" (NE "zápalební stav" — neexistuje)
- type: "timed" (s dobou v sekundách) | "habit" (jednorázové HOTOVO)

ODPOVĚZ POUZE JSON (bez markdown):
{"action_id":"...","label":"...","type":"timed|habit","duration_s":null,"guide_search":null,"guide_label":null}`;

const ZDRAVI_FALLBACKS = {
  prevence:     { action_id: 'voda_25l',        label: 'Vypij 2,5l vody — nastav připomínky',         type: 'habit', duration_s: null, guide_search: null, guide_label: null },
  metabolismus: { action_id: 'chuze_po_jidle',  label: 'Projdi se 10 minut po největším jídle',       type: 'timed', duration_s: 600,  guide_search: null, guide_label: null },
};

async function zdraviAgent(client, sb, { userId, discipline, nodeId, force = false, excludeActionId = null }) {
  if (!['prevence', 'metabolismus'].includes(discipline)) {
    return { error: `Invalid discipline for zdravi: ${discipline}` };
  }

  const today = new Date().toISOString().split('T')[0];

  // Cache check — skip when force=true (second action request)
  if (!force) {
    const { data: cached } = await sb.from('agent_log')
      .select('action_id, label, type, duration_s, guide_search, guide_label')
      .eq('user_id', userId).eq('node_id', nodeId).eq('discipline', discipline).eq('date', today)
      .maybeSingle();
    if (cached?.action_id) return { ...cached, cached: true };
  }

  // Fetch context
  const [metricsRes, decathlonRes, missionRes, constraintsRes] = await Promise.all([
    sb.from('user_metrics').select('current_index').eq('user_id', userId).eq('node_id', nodeId).eq('universe', 'longevity').maybeSingle(),
    sb.from('user_decathlon').select('label, target_age, goal_key').eq('user_id', userId).eq('active', true).maybeSingle(),
    sb.from('mission_log').select('action_id').eq('user_id', userId).eq('node_id', nodeId)
      .gte('date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false }).limit(1).maybeSingle(),
    sb.from('user_constraints').select('constraint_key, constraint_value').eq('user_id', userId),
  ]);

  const nodeIndex = metricsRes.data?.current_index ?? 50;
  const tier = getTier(nodeIndex);
  const dream = decathlonRes.data;
  const yesterdayAction = missionRes.data?.action_id ?? null;

  // Check for glucose constraint
  const constraints = constraintsRes.data || [];
  const glucoseNote = constraints.some(c =>
    c.constraint_key?.includes('glukoz') ||
    (c.constraint_value && JSON.stringify(c.constraint_value).includes('glukoz'))
  ) ? 'Uživatel má hraniční glukózu — prioritizuj chůzi po jídle a protein.' : '';

  const contextMsg = `DISCIPLÍNA: ${discipline}
TIER: ${tier} (index uzlu: ${nodeIndex})
VČEREJŠÍ AKCE: ${yesterdayAction ?? 'žádná'}
${excludeActionId ? `VYHNOUT SE (právě splněno): ${excludeActionId}` : ''}
SEN: ${dream ? `"${dream.label}" ve věku ${dream.target_age} let` : 'není nastaven'}
${glucoseNote}
${force ? 'DRUHÁ AKCE: Vyber jinou variantu než je VYHNOUT SE.' : ''}

Vyber jedno konkrétní cvičení pro dnešek.`;

  let action = null;
  try {
    const response = await client.messages.create({
      model: MODEL, max_tokens: 300,
      system: ZDRAVI_SYSTEM,
      messages: [{ role: 'user', content: contextMsg }],
    });
    const text = response.content.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) action = JSON.parse(match[0]);
  } catch (e) {
    console.warn('Zdraví Agent Haiku failed:', e.message);
  }

  if (!action?.action_id) {
    console.warn('Zdraví Agent: fallback for', discipline);
    action = ZDRAVI_FALLBACKS[discipline];
  }

  sb.from('agent_log').insert({
    user_id: userId, node_id: nodeId, discipline, date: today, tier,
    action_id: action.action_id, label: action.label, type: action.type,
    duration_s: action.duration_s ?? null,
    guide_search: action.guide_search ?? null, guide_label: action.guide_label ?? null,
  }).then(({ error }) => { if (error) console.warn('agent_log insert failed:', error.message); });

  return action;
}

// ── VÝŽIVA AGENT ──────────────────────────────────────
const VYZIVA_SYSTEM = `Jsi Výživa Agent CHJ — vybíráš konkrétní výživovou akci pro dnešní den.

DISCIPLÍNA: vyziva

TIER systém (dle stavu uzlu Výživa):
- tier 1 (index 0–40): základní návyky, malá změna, žádná váha potravin
- tier 2 (index 41–70): vědomé stravování, cílený příjem proteinu
- tier 3 (index 71+): optimalizace — makra, timing, kvalita potravin

AKCE — VÝŽIVA:
Tier 1:
- Snídaně se 30g proteinu — vejce, tvaroh nebo řecký jogurt
- Zelenina na každém talíři dnes (aspoň hrst)
- Vynechej sladké nápoje celý den — jen voda, čaj nebo káva bez cukru
- Záznamu co jíš dnes — foto nebo poznámka do telefonu

Tier 2:
- Připrav si oběd doma (ne fast food) — maso/ryba + zelenina + příloha
- Proteinový cíl: spočítej co jsi jedl a dojdi na 1,5g/kg těl. hmotnosti
- Večeře bez škrobů — ryba nebo kuře + zelenina nebo salát
- Přidej omega-3 zdroj k jídlu — tučná ryba, vlašské ořechy nebo doplněk

Tier 3:
- Proteinový den: 2g/kg těl. hmotnosti — plánuj jídla ráno
- Monosaturated fats focus — olivový olej, avokádo, ořechy k obědu i večeři
- Výživa okolo tréninku — protein do 30 min po cvičení
- Celý den bez ultra-processed potravin — jen přirozené zdroje

PRAVIDLA:
- Nikdy neopakuj yesterdayAction
- guide_search: krátký YouTube dotaz v češtině (max 6 slov) pokud akce vyžaduje recept nebo návod. null pro vynechání sladkého, záznamy, doplňky.
- guide_label: "Recept" | "Jak připravit" | null
- Česky, tykej, přímý trenérský tón
- Správně: "zánětlivý stav" (NE "zápalební stav" — neexistuje)
- type: "habit" (jednorázové HOTOVO) | "timed" (s dobou v sekundách pro tracking)
- Protein je priority — zmiň ho pokud je tier 1 nebo 2

ODPOVĚZ POUZE JSON (bez markdown):
{"action_id":"...","label":"...","type":"habit|timed","duration_s":null,"guide_search":null,"guide_label":null}`;

const VYZIVA_FALLBACKS = {
  vyziva: { action_id: 'protein_snidane', label: 'Snídaně se 30g proteinu — vejce, tvaroh nebo jogurt', type: 'habit', duration_s: null, guide_search: 'snídaně 30g proteinu rychlý recept', guide_label: 'Recept' },
};

async function vyzivaAgent(client, sb, { userId, discipline, nodeId, force = false, excludeActionId = null }) {
  const today = new Date().toISOString().split('T')[0];

  // Cache check — skip when force=true (second action request)
  if (!force) {
    const { data: cached } = await sb.from('agent_log')
      .select('action_id, label, type, duration_s, guide_search, guide_label')
      .eq('user_id', userId).eq('node_id', nodeId).eq('discipline', discipline).eq('date', today)
      .maybeSingle();
    if (cached?.action_id) return { ...cached, cached: true };
  }

  // Fetch context
  const [metricsRes, decathlonRes, missionRes, profileRes] = await Promise.all([
    sb.from('user_metrics').select('current_index').eq('user_id', userId).eq('node_id', 'vyziva').eq('universe', 'longevity').maybeSingle(),
    sb.from('user_decathlon').select('label, target_age, goal_key').eq('user_id', userId).eq('active', true).maybeSingle(),
    sb.from('mission_log').select('action_id').eq('user_id', userId).eq('node_id', nodeId)
      .gte('date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false }).limit(1).maybeSingle(),
    sb.from('user_profiles').select('weight').eq('user_id', userId).maybeSingle(),
  ]);

  const nodeIndex = metricsRes.data?.current_index ?? 50;
  const tier = getTier(nodeIndex);
  const dream = decathlonRes.data;
  const yesterdayAction = missionRes.data?.action_id ?? null;
  const weight = profileRes.data?.weight ?? null;

  const contextMsg = `DISCIPLÍNA: vyziva
TIER: ${tier} (index uzlu Výživa: ${nodeIndex})
VČEREJŠÍ AKCE: ${yesterdayAction ?? 'žádná'}
${excludeActionId ? `VYHNOUT SE (právě splněno): ${excludeActionId}` : ''}
${weight ? `VÁHA UŽIVATELE: ${weight} kg` : ''}
SEN: ${dream ? `"${dream.label}" ve věku ${dream.target_age} let` : 'není nastaven'}
${force ? 'DRUHÁ AKCE: Vyber jinou výživovou akci než je VYHNOUT SE.' : ''}

Vyber jednu konkrétní výživovou akci pro dnešek.`;

  let action = null;
  try {
    const response = await client.messages.create({
      model: MODEL, max_tokens: 300,
      system: VYZIVA_SYSTEM,
      messages: [{ role: 'user', content: contextMsg }],
    });
    const text = response.content.find(b => b.type === 'text')?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) action = JSON.parse(match[0]);
  } catch (e) {
    console.warn('Výživa Agent Haiku failed:', e.message);
  }

  if (!action?.action_id) {
    console.warn('Výživa Agent: using fallback');
    action = VYZIVA_FALLBACKS.vyziva;
  }

  sb.from('agent_log').insert({
    user_id: userId, node_id: nodeId, discipline, date: today, tier,
    action_id: action.action_id, label: action.label, type: action.type,
    duration_s: action.duration_s ?? null,
    guide_search: action.guide_search ?? null, guide_label: action.guide_label ?? null,
  }).then(({ error }) => { if (error) console.warn('agent_log insert failed:', error.message); });

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
      case 'mysl':
        return res.json(await myslAgent(client, sb, { userId, ...params }));
      case 'zdravi':
        return res.json(await zdraviAgent(client, sb, { userId, ...params }));

      case 'vyziva':
        return res.json(await vyzivaAgent(client, sb, { userId, ...params }));

      default:
        return res.status(400).json({ error: `Unknown agent type: ${type}` });
    }
  } catch (e) {
    console.error('agents error:', e);
    return res.status(500).json({ error: e.message });
  }
}
