import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRUGS_DB = JSON.parse(readFileSync(join(__dirname, '../data/drugs.json'), 'utf8'));
const RXNAV = 'https://rxnav.nlm.nih.gov/REST';

const _rxcuiCache = {};   // in-memory per-request cache
let _supabase = null;

function getSupabase() {
  if (!_supabase) _supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  return _supabase;
}

// ── INN resolution: drugs.json → Supabase cache → Haiku ──────────────────────

async function lookupInnWithHaiku(brandName) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 30,
        messages: [{ role: 'user', content:
          `What is the INN (International Nonproprietary Name / active ingredient) for the drug "${brandName}"?\n` +
          `Reply with ONLY the INN in English/Latin, lowercase, one word or short phrase. If unknown, reply "unknown".`
        }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').trim().toLowerCase()
      .replace(/[^a-z0-9 \-]/g, '').trim();
    if (!text || text === 'unknown' || text.length > 60) return null;
    console.log(`[rxnorm] Haiku INN lookup: "${brandName}" → "${text}"`);
    return text;
  } catch { return null; }
}

async function resolveInn(brandName) {
  const key = brandName.toLowerCase().trim();

  // 1. drugs.json (static, fastest)
  const db = DRUGS_DB[key];
  if (db?.inn) return { inn: db.inn, rxcui: null, fromDb: true };

  // 2. Supabase cache
  try {
    const { data } = await getSupabase()
      .from('drug_inn_cache')
      .select('inn, rxcui')
      .eq('name', key)
      .maybeSingle();
    if (data?.inn) {
      console.log(`[rxnorm] cache hit: "${key}" → "${data.inn}"`);
      return { inn: data.inn, rxcui: data.rxcui || null, fromDb: false };
    }
  } catch (e) { console.warn('[rxnorm] supabase cache read error:', e.message); }

  // 3. Haiku INN lookup
  const inn = await lookupInnWithHaiku(brandName);
  if (inn) {
    // Save to cache (fire and forget — don't block response)
    getSupabase()
      .from('drug_inn_cache')
      .upsert({ name: key, inn, source: 'haiku', updated_at: new Date().toISOString() })
      .then(() => {})
      .catch(() => {});
    return { inn, rxcui: null, fromDb: false };
  }

  // 4. Fallback: use brand name as-is (RxNorm might still know it)
  return { inn: brandName, rxcui: null, fromDb: false };
}

// ── RxNorm name → rxcui ───────────────────────────────────────────────────────

async function getRxcui(inn) {
  const key = inn.toLowerCase().trim();
  if (_rxcuiCache[key]) return _rxcuiCache[key];
  try {
    const res = await fetch(
      `${RXNAV}/rxcui.json?name=${encodeURIComponent(inn)}&search=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rxcui = data?.idGroup?.rxnormId?.[0] || null;
    if (rxcui) _rxcuiCache[key] = rxcui;
    return rxcui;
  } catch { return null; }
}

// ── Layer 1: statické pair_notes z drugs.json ─────────────────────────────────

function detectManualInteractions(validMeds) {
  const pairs = [];
  const seen = new Set();

  validMeds.forEach(medA => {
    const keyA = medA.name.toLowerCase();
    const dbA  = DRUGS_DB[keyA];
    if (!dbA?.interacts_with) return;

    validMeds.forEach(medB => {
      if (medA.name === medB.name) return;
      const keyB = medB.name.toLowerCase();
      const innB = medB.inn?.toLowerCase();
      const innA = medA.inn?.toLowerCase();

      const matches = dbA.interacts_with.some(iw =>
        iw.toLowerCase() === keyB || (innB && iw.toLowerCase() === innB)
      );
      if (!matches) return;

      const pairKey = [medA.name, medB.name].sort().join('|');
      if (seen.has(pairKey)) return;
      seen.add(pairKey);

      const dbB = DRUGS_DB[keyB];
      const note =
        dbA.pair_notes?.[keyB] || dbA.pair_notes?.[innB] ||
        dbB?.pair_notes?.[keyA] || dbB?.pair_notes?.[innA] || null;

      pairs.push({ drugs: [medA.name, medB.name], note, source: 'static' });
    });
  });

  return pairs;
}

// ── Layer 2: RxNorm interaction API ──────────────────────────────────────────

async function detectRxNormInteractions(validMeds, knownSet, companionSet) {
  const medsWithRxcui = validMeds.filter(m => m.rxcui);
  if (medsWithRxcui.length < 2) return [];

  const rxcuis = [...new Set(medsWithRxcui.map(m => m.rxcui))];

  try {
    const url = `${RXNAV}/interaction/list.json?rxcuis=${rxcuis.join('+')}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = await res.json();
    const groups = data?.fullInteractionTypeGroup || [];
    const results = [];
    const seen = new Set();

    for (const group of groups) {
      for (const type of (group.fullInteractionType || [])) {
        for (const pair of (type.interactionPair || [])) {
          const concepts = pair.interactionConcept || [];
          if (concepts.length < 2) continue;

          const innA = concepts[0]?.minConceptItem?.name?.toLowerCase();
          const innB = concepts[1]?.minConceptItem?.name?.toLowerCase();
          const desc = pair.description || '';
          if (!innA || !innB || !desc) continue;

          const medA = validMeds.find(m =>
            m.inn?.toLowerCase() === innA || m.name.toLowerCase() === innA
          );
          const medB = validMeds.find(m =>
            m.inn?.toLowerCase() === innB || m.name.toLowerCase() === innB
          );
          if (!medA || !medB || medA.name === medB.name) continue;

          const pairKey = [medA.name, medB.name].sort().join('|');
          if (seen.has(pairKey) || knownSet.has(pairKey) || companionSet.has(pairKey)) continue;
          seen.add(pairKey);

          results.push({ drugs: [medA.name, medB.name], description: desc });
        }
      }
    }

    return results;
  } catch (e) {
    console.warn('[rxnorm] interaction API error:', e.message);
    return [];
  }
}

// ── Layer 3: Haiku — přeložit a zlidštit klinický popis ──────────────────────

const SIMPLIFY_FEW_SHOT = [
  {
    en: 'Concurrent use of clarithromycin and simvastatin may increase the risk of myopathy and rhabdomyolysis.',
    cz: 'Antibiotikum může dočasně zablokovat odbourávání léku na cholesterol, takže se hromadí v těle a svaly mohou začít bolet nebo slabět — ozvi se lékaři, jestli cítíš bolest svalů, a zeptej se ho na alternativu na dobu léčby.',
  },
  {
    en: 'Calcium supplements may decrease the absorption of levothyroxine when taken at the same time.',
    cz: 'Vápník váže tabletu štítné žlázy v žaludku a brání jejímu vstřebání — nejjednodušší řešení je vzít tyto dva léky s aspoň čtyřhodinovým odstupem, ideálně štítnou žlázu ráno nalačno.',
  },
  {
    en: 'Lithium toxicity may be increased by concurrent use of ibuprofen due to decreased renal clearance.',
    cz: 'Ibuprofen zpomaluje vylučování lithia ledvinami, takže se může nahromadit na vyšší hladinu než je bezpečné — na bolest nebo horečku je místo ibuprofenu lepší paracetamol a lékař by o tom měl vědět.',
  },
  {
    en: 'Fluconazole may significantly increase the anticoagulant effect of warfarin, increasing bleeding risk.',
    cz: 'Antifungální lék zpomaluje rozklad léku na ředění krve, takže účinek může být silnější než obvykle — při léčbě plísní sleduj, jestli se ti netvoří modřiny snáz než dřív, a lékaři to řekni co nejdřív.',
  },
];

async function simplifyWithHaiku(rxNormItems) {
  if (!rxNormItems.length) return [];

  const fewShot = SIMPLIFY_FEW_SHOT
    .map(f => `EN: "${f.en}"\nCZ: "${f.cz}"`)
    .join('\n\n');

  const items = rxNormItems
    .map((r, i) => `${i + 1}. ${r.drugs.join(' + ')}: "${r.description}"`)
    .join('\n');

  const prompt = `Přepiš klinické popisy lékových interakcí do češtiny pro člověka bez medicínského vzdělání.
Piš jako lékárník, který mluví s pacientem — lidsky, s pochopením. Tykání.
Pravidla: 1–2 věty, vysvětli co se může stát v těle nebo co člověk pocítí, dej konkrétní praktickou radu (ne jen "poraď se s lékařem"), bez diagnóz, bez latinských nebo INN názvů léků (piš brand jméno nebo "tato kombinace").

Příklady:
${fewShot}

Přepiš (vrať POUZE JSON pole):
${items}

Formát: [{"idx":1,"note":"..."},{"idx":2,"note":"..."},...]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const raw  = data.content?.[0]?.text?.trim() || '[]';
    const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/\s*```$/,''));

    return rxNormItems
      .map((r, i) => {
        const item = Array.isArray(parsed) && parsed.find(p => p.idx === i + 1);
        return item?.note ? { ...r, note: item.note, source: 'rxnorm' } : null;
      })
      .filter(Boolean);
  } catch (e) {
    console.warn('[rxnorm] Haiku simplify error:', e.message);
    return [];
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function resolveInteractionsRxNorm(medicationNames) {
  // Resolve INN pro každý lék: drugs.json → Supabase cache → Haiku
  const validMeds = (await Promise.all(medicationNames.map(async raw => {
    const name = typeof raw === 'string' ? raw : (raw?.name || '');
    if (!name) return null;
    const key = name.toLowerCase().trim();
    const db  = DRUGS_DB[key] || {};

    const { inn, rxcui: cachedRxcui } = await resolveInn(name);
    const rxcui = cachedRxcui || await getRxcui(inn);

    // Cache rxcui back to Supabase if newly resolved
    if (rxcui && !cachedRxcui && !db.inn) {
      getSupabase()
        .from('drug_inn_cache')
        .update({ rxcui, updated_at: new Date().toISOString() })
        .eq('name', key)
        .then(() => {}).catch(() => {});
    }

    return { name, inn, rxcui, is_supplement: db.is_supplement ?? false, db };
  }))).filter(Boolean);

  // Companion páry — záměrně předepsané kombinace
  const companionSet = new Set();
  validMeds.forEach(m => {
    const companion = m.db?.companion_for?.toLowerCase();
    if (!companion) return;
    validMeds.forEach(n => {
      if (n.name.toLowerCase() === companion || n.inn?.toLowerCase() === companion) {
        companionSet.add([m.name, n.name].sort().join('|'));
      }
    });
  });
  const isCompanion = (a, b) => companionSet.has([a, b].sort().join('|'));

  // Layer 1: statické pair_notes
  const manualPairs = detectManualInteractions(validMeds)
    .filter(p => !isCompanion(p.drugs[0], p.drugs[1]));
  const knownSet = new Set(manualPairs.map(p => [...p.drugs].sort().join('|')));

  // Layer 2+3: RxNorm API → Haiku simplifikace
  const rxNormRaw  = await detectRxNormInteractions(validMeds, knownSet, companionSet);
  const rxNormFull = await simplifyWithHaiku(rxNormRaw);

  const interactions = [...manualPairs, ...rxNormFull];

  if (interactions.length) {
    console.log(`[rxnorm] interakce (${interactions.length}): ${interactions.map(i => `${i.drugs.join('+')}[${i.source}]`).join(' | ')}`);
  }

  return { meds: validMeds, interactions };
}

// ── HTTP endpoint ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { medications } = req.body || {};
  if (!Array.isArray(medications) || !medications.length)
    return res.status(400).json({ error: 'medications array required' });
  try {
    const result = await resolveInteractionsRxNorm(medications);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[rxnorm] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
