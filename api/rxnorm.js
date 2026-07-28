import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRUGS_DB = JSON.parse(readFileSync(join(__dirname, '../data/drugs.json'), 'utf8'));
const RXNAV = 'https://rxnav.nlm.nih.gov/REST';
const _rxcuiCache = {};

// ── RxNorm name → rxcui ───────────────────────────────────────────────────────

async function getRxcui(term) {
  const key = term.toLowerCase().trim();
  if (_rxcuiCache[key]) return _rxcuiCache[key];
  try {
    const res = await fetch(
      `${RXNAV}/rxcui.json?name=${encodeURIComponent(term)}&search=1`,
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

          // Mapuj INN zpět na brand name uživatele
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
    en: 'Concurrent use of dabigatran and aspirin may increase the risk of bleeding.',
    cz: 'Zesiluje účinek Pradaxy — i drobné zranění může krvácet déle než běžně.',
  },
  {
    en: 'Omeprazole may decrease the absorption of levothyroxine when taken simultaneously.',
    cz: 'Vzít s odstupem aspoň 4 hodiny od sebe — tableta štítné žlázy se jinak hůř vstřebá.',
  },
  {
    en: 'The combination of metoprolol and verapamil may result in excessive bradycardia and AV block.',
    cz: 'Tato kombinace může zpomalit srdce příliš — řeší kardiolog.',
  },
  {
    en: 'Ibuprofen may increase the anticoagulant effect of warfarin and increase the risk of bleeding.',
    cz: 'Tato kombinace výrazně zvyšuje riziko krvácení — při bolesti raději paracetamol.',
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

  const prompt = `Přepiš klinické popisy lékových interakcí do češtiny pro laika.
Každý přepis musí být přesně 1 věta, česky, tykání, bez diagnóz, bez INN názvů léků (piš "tato kombinace" nebo brand jméno z dvojice), s praktickou radou.

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
  const validMeds = (await Promise.all(medicationNames.map(async raw => {
    const name = typeof raw === 'string' ? raw : (raw?.name || '');
    if (!name) return null;
    const key = name.toLowerCase().trim();
    const db  = DRUGS_DB[key] || {};
    const inn = db.inn || name;
    const rxcui = await getRxcui(inn);
    return { name, inn, rxcui, is_supplement: db.is_supplement ?? false, db };
  }))).filter(Boolean);

  // Companion páry — záměrně předepsané kombinace, nikdy nezobrazovat jako interakci
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

  // Layer 2+3: RxNorm API → Haiku simplifikace (paralelně s Layer 1)
  const rxNormRaw  = await detectRxNormInteractions(validMeds, knownSet, companionSet);
  const rxNormFull = await simplifyWithHaiku(rxNormRaw);

  const interactions = [
    ...manualPairs,
    ...rxNormFull,
  ];

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
