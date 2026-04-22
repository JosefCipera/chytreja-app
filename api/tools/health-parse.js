// =====================================================
// API: /api/tools/health-parse.js — Health Document Parser
// Runtime: Vercel Edge (30s timeout, works on Hobby plan)
//
// POST /api/tools/health-parse
// Body (JSON):
//   userId       string
//   fileBase64   string  — base64-encoded file content (max ~3.5 MB)
//   mediaType    string  — "image/jpeg" | "image/png" | "application/pdf"
//   fileName     string  — original filename (for audit)
//   date?        string  — ISO date (Claude extracts from doc if missing)
//
// Supports: blood tests, Holter/ECG, doctor reports, DEXA, sleep studies
// =====================================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MODEL = 'claude-haiku-4-5';  // Haiku: 3-5s, stačí na strukturované lab PDF; pokud nestačí přepni na sonnet

// ── SYSTEM PROMPT ─────────────────────────────────────
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
  "summary": "1-2 věty pro laika — pouze co bylo zjištěno. Tykání (ty/bereš/tvůj), NE 'pacient'. Žádné zkratky (QTc, VES, HbA1c), žádné latinské termíny, žádná rekapitulace historie. BEZ závěrečné věty o uzlech — tu doplní systém automaticky. Vzory: 'Srdce jede pravidelně, ablace drží. Léky na ředění krve bereš správně.' nebo 'Cukr nalačno 6,5 mmol — na horní hranici normy. Zatím bez rizika, ale pozor na stravu.'",
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
  "flags": []
}

FLAGS: přidej "CONSULT_DOCTOR" při kritických hodnotách, QTc > 500ms nebo aktivních arytmiích.
         přidej "HIGH_STROKE_RISK" při CHADSVASc > 2.
Nestanoví diagnózu — jen extrahuj fakta a mapuj na uzly.
Medications: extrahuj všechny léky zmíněné v dokumentu (aktuální medikace pacienta).
Piš česky.`;

// ── INDEX UPDATE ─────────────────────────────────────
function applyDelta(current, delta) {
  return Math.max(0, Math.min(100, Math.round((current ?? 50) + delta)));
}

// ── CONCLUSION SENTENCE (generated from actual node data) ─────────────────
function buildConclusion(nodeUpdates) {
  const NODE_LABEL = { zdravi: 'Zdraví', telo: 'Tělo', mysl: 'Mysl', metabolicke: 'Metabolismus', vyziva: 'Výživa' };
  const NODE_REASON = {
    zdravi:      'srdce potřebuje pravidelný pohyb',
    telo:        'síla a pohyb jsou teď priorita',
    mysl:        'spánek a klid jsou teď důležité',
    metabolicke: 'pomůže pravidelná aktivita a méně cukru',
    vyziva:      'zaměř se na jídelníček',
  };

  const down = nodeUpdates.filter(n => n.delta < 0).sort((a, b) => a.delta - b.delta);
  const up   = nodeUpdates.filter(n => n.delta > 0);

  if (!down.length && !up.length) return '';

  if (!down.length && up.length) {
    const labels = up.map(n => NODE_LABEL[n.node_id] || n.node_id).join(' a ');
    return `${labels} roste — výsledky jdou správným směrem.`;
  }

  if (down.length === 1) {
    const n = down[0];
    const label  = NODE_LABEL[n.node_id] || n.node_id;
    const reason = NODE_REASON[n.node_id] || 'zaměř se na tento uzel';
    return `${label} klesá — ${reason}.`;
  }

  // Multiple nodes down — use labels + shared activity message
  const labels = down.map(n => NODE_LABEL[n.node_id] || n.node_id).join(' a ');
  return `${labels} klesají — pohyb a životní styl jsou teď priorita.`;
}

// ── MAIN HANDLER (Node.js serverless) ─────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { userId, fileBase64, mediaType, fileName, date } = req.body || {};

  if (!userId)     return res.status(400).json({ error: 'userId required' });
  if (!fileBase64) return res.status(400).json({ error: 'fileBase64 required' });
  if (!mediaType)  return res.status(400).json({ error: 'mediaType required' });

  if (fileBase64.length > 4_800_000) {
    return res.status(413).json({ error: 'Soubor je příliš velký. Maximum je ~3,5 MB.' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // ── BUILD CONTENT BLOCK ──────────────────────────
    const contentBlock = mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: fileBase64 } };

    const userMsg = `Analyzuj tento zdravotní dokument.
Datum nahrání: ${date || new Date().toISOString().split('T')[0]}
Název souboru: ${fileName || 'neznámý'}

Extrahuj všechny markery, namapuj na CHJ uzly a vrať přesně JSON dle instrukcí.`;

    // ── CLAUDE VISION CALL ────────────────────────────
    let parsed = null;
    let rawText = '';

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: userMsg }] }],
    });

    rawText = response.content.find(b => b.type === 'text')?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }

    if (!parsed?.markers || !parsed?.node_impacts) {
      return res.status(422).json({
        error: 'Dokument se nepodařilo analyzovat. Ujisti se, že jde o čitelný zdravotní dokument.',
        raw: rawText.slice(-800), // last 800 chars — shows where JSON broke off
        raw_length: rawText.length,
        has_markers: !!parsed?.markers,
        has_node_impacts: !!parsed?.node_impacts,
      });
    }

    // ── SAVE RAW RESULT (audit trail) ─────────────────
    const docDate = parsed.doc_date || date || new Date().toISOString().split('T')[0];

    // fire-and-forget — don't await to save time
    sb.from('node_inputs').insert({
      user_id: userId,
      node_id: 'zdravi',
      input_type: 'health_doc',
      source: parsed.doc_type,
      doc_date: docDate,
      data: {
        doc_type: parsed.doc_type, doc_date: docDate,
        file_name: fileName || null, summary: parsed.summary,
        markers: parsed.markers, node_impacts: parsed.node_impacts,
        constraints: parsed.constraints || [], flags: parsed.flags || [],
      },
    }).then(({ error }) => { if (error) console.warn('node_inputs insert failed:', error.message); });

    // ── SAVE MARKERS → user_lab_results ──────────────
    // user_lab_results already exists with correct schema
    for (const m of parsed.markers) {
      if (m.value == null) continue;
      sb.from('user_lab_results').insert({
        user_id: userId,
        tested_at: docDate,
        marker: m.name,
        value: m.value,
        unit: m.unit || null,
        reference_min: m.reference_low ?? null,
        reference_max: m.reference_high ?? null,
        source: 'lab_pdf',
        notes: m.note || null,
      }).then(({ error }) => {
        if (error) console.warn('user_lab_results insert failed:', error.message);
      });
    }

    // ── APPLY NODE IMPACTS → user_metrics ────────────
    const updatedNodes = [];

    for (const impact of parsed.node_impacts) {
      if (!impact.node_id || !impact.index_delta) continue;

      const { data: current } = await sb
        .from('user_metrics')
        .select('current_index')
        .eq('user_id', userId).eq('node_id', impact.node_id).eq('universe', 'longevity')
        .maybeSingle();

      const currentIndex = current?.current_index ?? 50;
      const newIndex = applyDelta(currentIndex, impact.index_delta);
      const newState = newIndex <= 40 ? 'RED' : newIndex <= 70 ? 'YELLOW' : 'GREEN';

      await sb.from('user_metrics').upsert({
        user_id: userId, node_id: impact.node_id, universe: 'longevity',
        current_index: newIndex, state: newState, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,node_id,universe' });

      // node_state_history — insert only columns that exist (user_id, node_id, date, state, current_index)
      sb.from('node_state_history').insert({
        user_id: userId,
        node_id: impact.node_id,
        date: docDate,
        state: newState,
        current_index: newIndex,
      }).then(({ error }) => {
        if (error && !error.message?.includes('duplicate')) console.warn('history insert failed:', error.message);
      });

      updatedNodes.push({ node_id: impact.node_id, previous_index: currentIndex, new_index: newIndex, delta: impact.index_delta, state: newState });
    }

    // ── SAVE CONSTRAINTS → user_constraints ──────────
    // user_constraints uses: constraint_type, constraint_key, constraint_value
    const savedConstraints = [];
    for (const c of (parsed.constraints || [])) {
      if (!c.constraint_key) continue;
      const { error } = await sb.from('user_constraints').upsert({
        user_id: userId,
        constraint_type: 'injury',
        constraint_key: c.constraint_key,
        constraint_value: c.description || c.constraint_key,
      }, { onConflict: 'user_id,constraint_key' });
      if (!error) savedConstraints.push(c.constraint_key);
    }

    // ── SAVE MEDICATIONS → user_medications ──────────
    const savedMedications = [];
    for (const med of (parsed.medications || [])) {
      if (!med.name) continue;
      // affects[] — map string hint to known enum values
      const affectsMap = {
        'antikoagulace': [],         // informational, no training effect
        'betablocker': ['hr_unreliable'],
        'rate-control': ['hr_unreliable'],
        'statin': [],
        'lipidy': [],
        'diuretikum': ['hydration'],
        'inzulín': ['glucose_masked'],
        'metformin': ['glucose_masked'],
        'kortikosteroidy': ['muscle_loss', 'bone_density'],
        'hypnotikum': ['fatigue'],
      };
      const affectsKey = (med.affects || '').toLowerCase();
      const affectsArr = affectsMap[affectsKey] ?? [];

      const { error } = await sb.from('user_medications').upsert({
        user_id: userId,
        name: med.name,
        dose: med.dose || null,
        affects: affectsArr,
        active: true,
      }, { onConflict: 'user_id,name' });
      if (!error) savedMedications.push(med.name);
      else console.warn('user_medications upsert failed:', error.message);
    }

    // ── APPEND CONCLUSION to summary (always matches node data) ──────────
    const conclusion = buildConclusion(updatedNodes);
    const fullSummary = conclusion
      ? `${parsed.summary} ${conclusion}`
      : parsed.summary;

    return res.json({
      success: true,
      doc_type: parsed.doc_type,
      doc_date: docDate,
      summary: fullSummary,
      markers_found: parsed.markers.length,
      markers: parsed.markers,
      node_updates: updatedNodes,
      constraints_saved: savedConstraints,
      medications_saved: savedMedications,
      flags: parsed.flags || [],
      node_impacts: parsed.node_impacts,
    });

  } catch (e) {
    console.error('health-parse error:', e);
    return res.status(500).json({ error: e.message });
  }
}
