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
    const res = await fetch(`${RXNAV}/rxcui.json?name=${encodeURIComponent(term)}&search=1`, { signal: AbortSignal.timeout(4000) });
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
        dbB?.pair_notes?.[keyA] || dbB?.pair_notes?.[innA] ||
        null;

      pairs.push({ drugs: [medA.name, medB.name], note, source: 'static' });
    });
  });

  return pairs;
}

// ── Few-shot příklady pro Haiku (tón a formát) ────────────────────────────────

const FEW_SHOT = [
  { pair: 'Pradaxa + Ibalgin',  note: 'Tato kombinace výrazně zvyšuje riziko žaludečního krvácení — při bolesti raději paracetamol.' },
  { pair: 'Euthyrox + Nolpaza', note: 'Vzít s odstupem aspoň 4 hodiny od sebe — Euthyrox se jinak hůř vstřebá.' },
  { pair: 'Concor + Verapamil', note: 'Tato kombinace může zpomalit srdce příliš — řeší kardiolog.' },
  { pair: 'Pradaxa + Aspirin',  note: 'Zesiluje účinek Pradaxy — i drobné zranění může krvácet déle než běžně.' },
  { pair: 'Warfarin + Ibalgin', note: 'Tato kombinace výrazně zvyšuje riziko krvácení — při bolesti raději paracetamol.' },
];

// ── Layer 2: Haiku pro neznámé páry ──────────────────────────────────────────

async function detectWithHaiku(unknownPairs) {
  if (!unknownPairs.length) return [];

  const fewShotText = FEW_SHOT
    .map(f => `"${f.pair}" → "${f.note}"`)
    .join('\n');

  const pairsText = unknownPairs
    .map(([a, b]) => `- ${a} + ${b}`)
    .join('\n');

  const prompt = `Jsi bezpečnostní systém lékových interakcí. Pro každý pár níže vrať JSON objekt.

Možné hodnoty "status":
- "interaction" — klinicky relevantní interakce existuje (piš note)
- "safe"        — žádná klinicky významná interakce
- "unknown"     — nemáš spolehlivá data pro tento pár

Pravidla pro "note":
- 1 věta, česky, tykání
- žádné INN názvy (piš brand jméno nebo "tato kombinace" / "tento lék")
- žádný lékařský žargon, žádné diagnózy
- praktická rada co udělat nebo na co si dát pozor

Příklady správného formátu note:
${fewShotText}

Páry ke kontrole:
${pairsText}

Odpověz POUZE validním JSON polem bez markdown:
[{"pair":"A + B","status":"interaction","note":"..."},{"pair":"C + D","status":"safe"},...]`;

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
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) throw new Error(`Haiku ${res.status}`);

    const data = await res.json();
    const raw  = data.content?.[0]?.text?.trim() || '[]';
    const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/\s*```$/,''));

    return parsed.map(item => {
      const [a, b] = item.pair.split(/\s*\+\s*/);
      return { drugs: [a?.trim(), b?.trim()].filter(Boolean), status: item.status, note: item.note || null };
    });
  } catch (e) {
    console.warn('[rxnorm] Haiku error:', e.message);
    // Při chybě: všechny páry označíme jako unknown
    return unknownPairs.map(([a, b]) => ({ drugs: [a, b], status: 'unknown', note: null }));
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

  // Layer 1: statické pair_notes
  const manualPairs = detectManualInteractions(validMeds);
  const knownSet = new Set(manualPairs.map(p => [...p.drugs].sort().join('|')));

  // Layer 2: všechny ostatní páry → Haiku
  const unknownPairs = [];
  for (let i = 0; i < validMeds.length; i++) {
    for (let j = i + 1; j < validMeds.length; j++) {
      const key = [validMeds[i].name, validMeds[j].name].sort().join('|');
      if (!knownSet.has(key)) {
        unknownPairs.push([validMeds[i].name, validMeds[j].name]);
      }
    }
  }

  const haikuResults = await detectWithHaiku(unknownPairs);

  // Merge: statické + AI interakce + AI unknown
  const UNKNOWN_NOTE = 'Tuto kombinaci nemáme ověřenou — zeptej se svého lékárníka.';

  const interactions = [
    ...manualPairs.map(p => ({ ...p, source: 'static' })),
    ...haikuResults
      .filter(r => r.status === 'interaction')
      .map(r => ({ drugs: r.drugs, note: r.note, source: 'ai' })),
    ...haikuResults
      .filter(r => r.status === 'unknown')
      .map(r => ({ drugs: r.drugs, note: UNKNOWN_NOTE, source: 'unknown' })),
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
