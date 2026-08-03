// POST /api/tools/parse
// Unified parser — routes by `source` field:
//   source: 'ultrahuman'  → Ultrahuman Ring CSV import
//   source: (anything else / omitted) → Health Document Parser (Claude Vision)
//
// Replaces api/tools/health-parse.js + api/tools/ultrahuman-parse.js
// to stay within Vercel Hobby plan 12-function limit.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════
// SECTION A — ULTRAHUMAN CSV PARSER
// ══════════════════════════════════════════════════════════════

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      const v = values[i]?.trim();
      row[h] = (v === '' || v === undefined) ? null : v;
    });
    return row;
  }).filter(r => r['Date']);
}

function toNum(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function clamp(v) { return Math.min(100, Math.max(0, Math.round(v))); }

function normalizeHRV(v)       { return clamp((v - 20) / 60 * 100); }
function normalizeRHR(v)       { return clamp((85 - v) / 45 * 100); }
function normalizeDirect(v)    { return clamp(v); }
function normalizeDeepSleep(v) { return clamp(v / 90 * 100); }
function normalizeSteps(v)     { return clamp(v / 10000 * 100); }

function computeDayIndices(row) {
  const hrv      = toNum(row['Average HRV']);
  const rhr      = toNum(row['Average RHR']);
  const recovery = toNum(row['Recovery Score']);
  const sleep    = toNum(row['Sleep Score']);
  const deep     = toNum(row['Deep Sleep']);
  const steps    = toNum(row['Total Steps']);

  const zdraviParts = [];
  if (hrv      !== null) zdraviParts.push({ v: normalizeHRV(hrv),        w: 0.4 });
  if (rhr      !== null) zdraviParts.push({ v: normalizeRHR(rhr),        w: 0.3 });
  if (recovery !== null) zdraviParts.push({ v: normalizeDirect(recovery), w: 0.3 });

  const zdraviIdx = zdraviParts.length
    ? Math.round(zdraviParts.reduce((s, p) => s + p.v * p.w, 0) / zdraviParts.reduce((s, p) => s + p.w, 0))
    : null;

  const spanekParts = [];
  if (sleep !== null) spanekParts.push({ v: normalizeDirect(sleep),   w: 0.6 });
  if (deep  !== null) spanekParts.push({ v: normalizeDeepSleep(deep), w: 0.4 });

  const spanekIdx = spanekParts.length
    ? Math.round(spanekParts.reduce((s, p) => s + p.v * p.w, 0) / spanekParts.reduce((s, p) => s + p.w, 0))
    : null;

  const teloIdx = steps !== null ? normalizeSteps(steps) : null;

  return { zdravi: zdraviIdx, spanek: spanekIdx, telo: teloIdx };
}

async function handleUltrahuman(req, res, sb) {
  const { userId, csvText } = req.body;
  if (!userId)  return res.status(400).json({ error: 'userId required' });
  if (!csvText) return res.status(400).json({ error: 'csvText required' });

  const rows = parseCSV(csvText);
  if (!rows.length) return res.status(400).json({ error: 'No rows found in CSV' });

  const historyRows = [];
  for (const row of rows) {
    const date = row['Date'];
    if (!date) continue;
    const indices = computeDayIndices(row);
    for (const [nodeId, idx] of Object.entries(indices)) {
      if (idx === null) continue;
      const state = idx <= 40 ? 'RED' : idx <= 70 ? 'YELLOW' : 'GREEN';
      historyRows.push({ user_id: userId, node_id: nodeId, current_index: idx, state, date });
    }
  }

  if (!historyRows.length) return res.status(400).json({ error: 'No parseable data in CSV' });

  const { error: histErr } = await sb
    .from('node_state_history')
    .upsert(historyRows, { onConflict: 'user_id,node_id,date' });
  if (histErr) return res.status(500).json({ error: histErr.message });

  const lastDate = historyRows.map(r => r.date).sort().at(-1);
  const since7 = new Date(new Date(lastDate).getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const nodeIds = ['zdravi', 'spanek', 'telo'];
  const metricsUpsert = [];

  for (const nodeId of nodeIds) {
    const recent = historyRows.filter(r => r.node_id === nodeId && r.date >= since7);
    if (!recent.length) continue;
    const avg = Math.round(recent.reduce((s, r) => s + r.current_index, 0) / recent.length);
    const state = avg <= 40 ? 'RED' : avg <= 70 ? 'YELLOW' : 'GREEN';
    metricsUpsert.push({ user_id: userId, node_id: nodeId, universe: 'longevity', current_index: avg, state });
  }

  if (metricsUpsert.length) {
    const { error: metErr } = await sb
      .from('user_metrics')
      .upsert(metricsUpsert, { onConflict: 'user_id,node_id,universe' });
    if (metErr) return res.status(500).json({ error: metErr.message });
  }

  const NODE_LABELS = { zdravi: 'Zdraví', spanek: 'Spánek', telo: 'Tělo' };
  return res.json({
    ok: true,
    days_imported: new Set(historyRows.map(r => r.date)).size,
    nodes_updated: metricsUpsert.map(m => ({
      node: m.node_id, label: NODE_LABELS[m.node_id] || m.node_id,
      index: m.current_index, state: m.state,
    })),
  });
}

// ══════════════════════════════════════════════════════════════
// SECTION B — HEALTH DOCUMENT PARSER (Claude Vision)
// ══════════════════════════════════════════════════════════════

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `Jsi Health Document Parser pro CHJ (Chytré Já) — analyzuješ zdravotní dokumenty.

ÚKOL:
1. Identifikuj typ dokumentu
2. Extrahuj všechny markery s hodnotami, jednotkami a referenčními rozsahy
3. Urči stav každého markeru (normal/borderline/high/low/critical)
4. Namapuj na longevity uzly CHJ a navrhni index_delta
5. Extrahuj léky a omezení

TYPY DOKUMENTŮ:
blood_test | holter | ecg | doctor_report | dexa | sleep_study | other

LONGEVITY UZLY CHJ (pro mapování):
- zdravi — obecné zdraví, prevence
- metabolicke — metabolismus, inzulín, glukóza
- telo — síla, výkon, složení těla
- mysl — mentální zdraví, stres, spánek

MAPOVÁNÍ MARKERŮ → UZLY:
Kardiovaskulární (→ zdravi):
  LDL cholesterol: > 3.4 = borderline, > 4.1 = high, > 4.9 = critical
  HDL cholesterol: < 1.0 (muži) / < 1.2 (ženy) = low
  Triglyceridy: > 1.7 = borderline, > 5.6 = critical
  CRP: > 3 = borderline, > 10 = high
  Krevní tlak (systolický): > 130 = borderline, > 140 = high

Metabolické (→ metabolicke):
  Glukóza nalačno (mmol/L): < 5.6 = normal, 5.6–6.9 = borderline, > 7.0 = high
  HbA1c (%): < 5.7 = normal, 5.7–6.4 = borderline, ≥ 6.5 = high
  Inzulín nalačno: > 10 mU/L = borderline, > 15 = high
  Kyselina močová: > 360 (ženy) / > 420 (muži) μmol/L = high

Výkon a tělo (→ telo):
  Hemoglobin: pod dolní ref = low
  Ferritin: < 30 = low, < 15 = critical
  Vitamin B12: < 200 pmol/L = low
  Testosterone (muži): < 12 nmol/L = low

Imunita / obecné zdraví (→ zdravi):
  Vitamin D: < 50 nmol/L = low, < 25 = critical
  TSH: < 0.4 = low, > 4.0 = high
  ALT: > 40 U/L (muži) / > 35 (ženy) = high
  Kreatinin: nad referenční = high

Holter / EKG (→ zdravi):
  HRV (SDNN ms): < 20 = critical, < 50 = low, > 100 = normal
  Průměrný SF (bpm):
    KONTEXT: Pacient na betablockeru (metoprolol, bisoprolol, atenolol, Kalnormin) nebo po ablaci fibrilace/flutteru síní → brady <50 bpm je očekávaná, hodnoť jako borderline max (ne critical)
    Jinak: < 40 = critical, 40–50 = low, 50–60 = borderline (sportovcům OK), > 80 = borderline, > 100 = high
  VES / komorové ektopické stahy (%):
    < 1% = normal, 1–5% = borderline (delta -10 až -15), > 5% = high (delta -20 až -25), > 10% = critical
  QTc (ms):
    < 440 = normal, 440–460 = borderline (delta -10), 460–500 = high (delta -20), > 500 = critical → CONSULT_DOCTOR
  Supraventrikulární ektopie (SES): ojedinělé = normal, časté = borderline
  Arytmie (AFib/AFL epizody v záznamu): žádné = normal, ojedinělé = borderline, časté/závažné = critical → CONSULT_DOCTOR
  AFib v ANAMNÉZE (ne aktivní v záznamu): zaznamenej jako constraint, nezhoršuj index_delta jako "critical" — pacient může být úspěšně po ablaci a v sinusovém rytmu
  Holter/EKG s negativními nálezy → přidej VŽDY i uzel telo (delta -5 až -10): kardiovaskulární omezení snižuje toleranci zátěže a výkonnost

HODNOCENÍ KARDIOLOGICKÝCH ZPRÁV:
  - Pokud je pacient po ablaci AFib/flutteru a aktuálně v sinusovém rytmu → stav NENÍ critical, maximálně borderline
  - CHADSVASc score > 2 → přidej flag "HIGH_STROKE_RISK" a constraint antikoagulace
  - "Pacient bez symptomů, cítí se dobře" → nezhoršuj index_delta
  - Anamnestické záznamy (předchozí příhody, staré diagnózy) hodnoť jako historical_context, ne aktuální stav
  - Aktivní antikoagulace (warfarin, Pradaxa/dabigatran, Xarelto/rivaroxaban, Eliquis/apixaban) → constraint kontaktní_sporty

VÝPOČET INDEX_DELTA:
  normal: 0 (nebo +3 pokud optimální)
  borderline: -10 až -15
  high/low: -15 až -25
  critical: -25 až -40
  HDL: inverzní logika (čím vyšší tím lepší)
  Kombinace markerů ve stejném uzlu: max -40

VÝSTUPNÍ FORMÁT (přesně tento JSON, bez markdown):
{
  "doc_type": "blood_test",
  "doc_date": "2026-04-14",
  "summary": "1-2 věty pro laika — pouze co bylo zjištěno. Tykání (ty/bereš/tvůj), NE 'pacient'. Žádné zkratky (QTc, VES, HbA1c), žádné latinské termíny, žádná rekapitulace historie. BEZ závěrečné věty o uzlech — tu doplní systém automaticky.",
  "markers": [
    {
      "name": "LDL cholesterol",
      "value": 3.8,
      "unit": "mmol/L",
      "reference_low": null,
      "reference_high": 3.4,
      "status": "borderline",
      "note": "Mírně nad hranicí"
    }
  ],
  "node_impacts": [
    {
      "node_id": "zdravi",
      "index_delta": -12,
      "confidence": "high",
      "reasoning": "LDL 3.8 mmol/L (ref <3.4), CRP v normě"
    }
  ],
  "constraints": [
    {
      "constraint_key": "hypertenze",
      "description": "TK 145/90",
      "active": true,
      "affects_skills": ["kardio_vysoke_intenzity"]
    }
  ],
  "medications": [
    {
      "name": "Pradaxa",
      "dose": "2x150mg",
      "affects": "antikoagulace"
    }
  ],
  "diagnoses": ["Hypertenze", "Fibrilace síní"],
  "symptoms": ["bušení srdce", "únava"],
  "flags": []
}

FLAGS: přidej "CONSULT_DOCTOR" při kritických hodnotách, QTc > 500ms nebo aktivních arytmiích.
       přidej "HIGH_STROKE_RISK" při CHADSVASc > 2.
diagnoses: seznam diagnóz zmíněných v dokumentu. Použij PŘESNĚ tyto kódy kde odpovídají:
  FIBRILACE_SINI_PAROXYSMALNI, FIBRILACE_SINI, HYPERTENZE, ATEROSKLEROZA, EXTRASYSTOLY,
  DIABETES_2_TYPU, PREDIABETES, INZULINOVA_REZISTENCE, METABOLICKY_SYNDROM,
  HYPOTHYREOZA, HYPERTHYREOZA,
  STENOZA_PATERE, SPONDYLOZA, DEGENERATIVNI_ZMENY_PATERE, HERNIATED_DISC,
  OSTEOPOROZA, OSTEOPENIE, PERIEFERNI_NEUROPATIE,
  DEPRESE, UZKOST, ESENCIALNI_TREMOR,
  CHRONICKY_STRES.
  Pokud diagnóza neodpovídá žádnému kódu, použij česky srozumitelný název.
symptoms: seznam symptomů z dokumentu. Použij kódy kde odpovídají:
  BOLEST_NOHOU, SLABOST_NOHOU, NESTABILITA_CHUZE, BUSENI_SRDCE, EXTRASYSTOLY.
  Jinak česky.
Nestanoví vlastní diagnózu — ale extrahuj diagnózy, které jsou přímo uvedené v dokumentu lékařem.
Piš česky.`;

function applyDelta(current, delta) {
  return Math.max(0, Math.min(100, Math.round((current ?? 50) + delta)));
}

const MARKER_PLAIN = {
  'ldl':             { high: 'špatný cholesterol nad normou',         critical: 'špatný cholesterol výrazně nad normou' },
  'hdl':             { low:  'hodný cholesterol pod normou' },
  'triglyceridy':    { high: 'tuky v krvi nad normou',                critical: 'tuky v krvi výrazně nad normou' },
  'glukóza':         { high: 'cukr v krvi nad normou',                borderline: 'cukr v krvi na horní hranici', low: 'cukr v krvi pod normou' },
  'hba1c':           { high: 'dlouhodobý cukr nad normou',            borderline: 'dlouhodobý cukr na horní hranici' },
  'inzulín':         { high: 'inzulín nad normou' },
  'crp':             { high: 'zánětlivý marker nad normou' },
  'vitamin d':       { low:  'vitamín D pod normou',                  critical: 'vitamín D výrazně pod normou' },
  'tsh':             { high: 'štítná žláza mimo normu',               low: 'štítná žláza mimo normu' },
  'ferritin':        { low:  'zásoby železa pod normou',              critical: 'zásoby železa kriticky nízké' },
  'hemoglobin':      { low:  'hemoglobin pod normou' },
  'testosterone':    { low:  'testosteron pod normou' },
  'vitamin b12':     { low:  'vitamín B12 pod normou' },
  'ves':             { high: 'srdeční rytmus s nepravidelnými stahy',  borderline: 'srdeční rytmus s nepravidelnými stahy' },
  'qtc':             { high: 'elektrický impulz srdce trvá déle',     critical: 'elektrický impulz srdce výrazně prodloužen' },
  'hrv':             { low:  'variabilita srdečního rytmu nízká',     critical: 'variabilita srdečního rytmu kriticky nízká' },
  'alt':             { high: 'jaterní marker nad normou' },
  'kreatinin':       { high: 'ledvinový marker nad normou' },
  'kyselina močová': { high: 'kyselina močová nad normou' },
  'krevní tlak':     { high: 'krevní tlak nad normou',                borderline: 'krevní tlak na horní hranici' },
};

function buildDisplay(nodeUpdates, flags) {
  const NODE_LABEL  = { zdravi: 'Zdraví', telo: 'Tělo', mysl: 'Mysl', metabolicke: 'Metabolismus', vyziva: 'Výživa' };
  const NODE_REASON = {
    zdravi: 'pohyb je teď pro srdce priorita', telo: 'síla a pohyb jsou teď priorita',
    mysl: 'spánek je teď pro hlavu priorita',  metabolicke: 'aktivita a strava jsou teď priorita',
    vyziva: 'jídelníček je teď priorita',
  };
  const intro  = flags?.includes('CONSULT_DOCTOR') ? 'Výsledky stojí za pozornost.' : 'Kontrola proběhla v pořádku.';
  const down   = nodeUpdates.filter(n => n.delta < 0).sort((a, b) => a.delta - b.delta);
  const up     = nodeUpdates.filter(n => n.delta > 0);
  let conclusion = '';
  if (down.length) {
    const labels = down.map(n => NODE_LABEL[n.node_id] || n.node_id).join(' a ');
    const verb   = down.length > 1 ? 'klesají' : 'klesá';
    const reason = NODE_REASON[down[0].node_id] || 'pohyb je teď priorita';
    conclusion = `${labels} ${verb} — ${reason}.`;
  } else if (up.length) {
    conclusion = `${up.map(n => NODE_LABEL[n.node_id] || n.node_id).join(' a ')} roste — výsledky jdou správným směrem.`;
  }
  return { intro, conclusion };
}

async function handleHealthDoc(req, res, sb) {
  const { userId, fileBase64, mediaType, fileName, date } = req.body || {};
  if (!userId)     return res.status(400).json({ error: 'userId required' });
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 required' });
  if (!mediaType)  return res.status(400).json({ error: 'mediaType required' });
  if (fileBase64.length > 4_800_000) return res.status(413).json({ error: 'Soubor je příliš velký. Maximum je ~3,5 MB.' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const contentBlock = mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: fileBase64 } };

  const userMsg = `Analyzuj tento zdravotní dokument.\nDatum nahrání: ${date || new Date().toISOString().split('T')[0]}\nNázev souboru: ${fileName || 'neznámý'}\n\nExtrahuj všechny markery, namapuj na CHJ uzly a vrať přesně JSON dle instrukcí.`;

  const response = await client.messages.create({
    model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: userMsg }] }],
  });

  const rawText  = response.content.find(b => b.type === 'text')?.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  let parsed = null;
  if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch { /* ignore */ } }

  if (!parsed?.markers || !parsed?.node_impacts) {
    return res.status(422).json({
      error: 'Dokument se nepodařilo analyzovat.',
      raw: rawText.slice(-800), raw_length: rawText.length,
    });
  }

  const docDate = parsed.doc_date || date || new Date().toISOString().split('T')[0];

  // fire-and-forget audit
  sb.from('node_inputs').insert({
    user_id: userId, node_id: 'zdravi', input_type: 'health_doc', source: parsed.doc_type, doc_date: docDate,
    data: { doc_type: parsed.doc_type, doc_date: docDate, file_name: fileName || null, summary: parsed.summary, markers: parsed.markers, node_impacts: parsed.node_impacts, constraints: parsed.constraints || [], flags: parsed.flags || [] },
  }).then(({ error }) => { if (error) console.warn('node_inputs insert failed:', error.message); });

  for (const m of parsed.markers) {
    if (m.value == null) continue;
    sb.from('user_lab_results').insert({
      user_id: userId, tested_at: docDate, marker: m.name, value: m.value, unit: m.unit || null,
      reference_min: m.reference_low ?? null, reference_max: m.reference_high ?? null, source: 'lab_pdf', notes: m.note || null,
    }).then(({ error }) => { if (error) console.warn('user_lab_results insert failed:', error.message); });
  }

  const updatedNodes = [];
  for (const impact of parsed.node_impacts) {
    if (!impact.node_id || !impact.index_delta) continue;
    const { data: current } = await sb.from('user_metrics').select('current_index')
      .eq('user_id', userId).eq('node_id', impact.node_id).eq('universe', 'longevity').maybeSingle();
    const currentIndex = current?.current_index ?? 50;
    const newIndex = applyDelta(currentIndex, impact.index_delta);
    const newState = newIndex <= 40 ? 'RED' : newIndex <= 70 ? 'YELLOW' : 'GREEN';
    await sb.from('user_metrics').upsert({ user_id: userId, node_id: impact.node_id, universe: 'longevity', current_index: newIndex, state: newState, updated_at: new Date().toISOString() }, { onConflict: 'user_id,node_id,universe' });
    sb.from('node_state_history').insert({ user_id: userId, node_id: impact.node_id, date: docDate, state: newState, current_index: newIndex })
      .then(({ error }) => { if (error && !error.message?.includes('duplicate')) console.warn('history insert failed:', error.message); });
    updatedNodes.push({ node_id: impact.node_id, previous_index: currentIndex, new_index: newIndex, delta: impact.index_delta, state: newState });
  }

  const savedConstraints = [];
  for (const c of (parsed.constraints || [])) {
    if (!c.constraint_key) continue;
    const { error } = await sb.from('user_constraints').upsert({ user_id: userId, constraint_type: 'injury', constraint_key: c.constraint_key, constraint_value: c.description || c.constraint_key }, { onConflict: 'user_id,constraint_key' });
    if (!error) savedConstraints.push(c.constraint_key);
  }

  const savedMedications = [];
  const affectsMap = { 'antikoagulace': [], 'betablocker': ['hr_unreliable'], 'rate-control': ['hr_unreliable'], 'statin': [], 'diuretikum': ['hydration'], 'inzulín': ['glucose_masked'], 'metformin': ['glucose_masked'], 'kortikosteroidy': ['muscle_loss', 'bone_density'], 'hypnotikum': ['fatigue'] };
  for (const med of (parsed.medications || [])) {
    if (!med.name) continue;
    const affectsKey = (med.affects || '').toLowerCase();
    const { error } = await sb.from('user_medications').upsert({ user_id: userId, name: med.name, dose: med.dose || null, affects: affectsMap[affectsKey] ?? [], active: true }, { onConflict: 'user_id,name' });
    if (!error) savedMedications.push(med.name);
  }

  // Save diagnoses + symptoms + labs to user_health_profile
  const newDiagnoses = (parsed.diagnoses || []).filter(d => d?.trim());
  const newSymptoms  = (parsed.symptoms  || []).filter(s => s?.trim());

  // Map parsed marker names → user_health_profile.labs keys
  const MARKER_TO_LAB = {
    'hba1c': 'hba1c', 'hba1': 'hba1c',
    'glukóza': 'fasting_glucose', 'glukoza': 'fasting_glucose', 'glukóza nalačno': 'fasting_glucose',
    'inzulín': 'fasting_insulin', 'inzulin': 'fasting_insulin', 'inzulín nalačno': 'fasting_insulin',
    'apob': 'apob', 'apo b': 'apob',
    'ldl': 'ldl', 'ldl cholesterol': 'ldl',
    'hdl': 'hdl', 'hdl cholesterol': 'hdl',
    'triglyceridy': 'triglycerides', 'triglyceridy': 'triglycerides',
    'crp': 'crp', 'hs-crp': 'crp', 'hscrp': 'crp',
    'hrv': 'hrv',
    'testosteron': 'testosterone',
    'alt': 'alt',
    'ast': 'ast',
    'psa': 'psa',
  };
  const newLabs = {};
  for (const m of (parsed.markers || [])) {
    if (m.value == null) continue;
    const key = MARKER_TO_LAB[(m.name || '').toLowerCase().trim()];
    if (key) newLabs[key] = parseFloat(m.value);
  }

  const hasUpdates = newDiagnoses.length || newSymptoms.length || Object.keys(newLabs).length;
  if (hasUpdates) {
    const { data: existingProfile } = await sb.from('user_health_profile')
      .select('diagnoses, symptoms, labs').eq('user_id', userId).maybeSingle();
    const existingDx   = existingProfile?.diagnoses || [];
    const existingSx   = existingProfile?.symptoms  || [];
    const existingLabs = existingProfile?.labs      || {};
    const mergedDx   = [...new Set([...existingDx, ...newDiagnoses])];
    const mergedSx   = [...new Set([...existingSx, ...newSymptoms])];
    const mergedLabs = { ...existingLabs, ...newLabs }; // nové hodnoty přepíší starší
    await sb.from('user_health_profile').upsert(
      { user_id: userId, diagnoses: mergedDx, symptoms: mergedSx, labs: mergedLabs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  }

  const { intro, conclusion } = buildDisplay(updatedNodes, parsed.flags);
  return res.json({
    success: true, doc_type: parsed.doc_type, doc_date: docDate, intro, conclusion,
    markers_found: parsed.markers.length, markers: parsed.markers, node_updates: updatedNodes,
    constraints_saved: savedConstraints, medications_saved: savedMedications,
    flags: parsed.flags || [], node_impacts: parsed.node_impacts,
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER — routes by source field
// ══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (req.body?.source === 'ultrahuman') {
      return await handleUltrahuman(req, res, sb);
    } else {
      return await handleHealthDoc(req, res, sb);
    }
  } catch (e) {
    console.error('parse error:', e);
    return res.status(500).json({ error: e.message });
  }
}
