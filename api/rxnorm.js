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

// ── Few-shot příklady pro Haiku — interaction i safe ─────────────────────────

const FEW_SHOT_INTERACTION = [
  { pair: 'Pradaxa + Ibalgin',  note: 'Tato kombinace výrazně zvyšuje riziko žaludečního krvácení — při bolesti raději paracetamol.' },
  { pair: 'Euthyrox + Nolpaza', note: 'Vzít s odstupem aspoň 4 hodiny od sebe — Euthyrox se jinak hůř vstřebá.' },
  { pair: 'Concor + Verapamil', note: 'Tato kombinace může zpomalit srdce příliš — řeší kardiolog.' },
  { pair: 'Pradaxa + Aspirin',  note: 'Zesiluje účinek Pradaxy — i drobné zranění může krvácet déle než běžně.' },
];

const FEW_SHOT_SAFE = [
  'Kalnormin + Pradaxa',
  'Kalnormin + Nolpaza',
  'Kalnormin + Concor',
  'Magnesium bisglycinát + Pradaxa',
  'Vitamin D3 + Warfarin',
  'Omega-3 + Metformin',
];

// ── Layer 2: Haiku pro neznámé páry ──────────────────────────────────────────

async function detectWithHaiku(unknownPairs) {
  if (!unknownPairs.length) return [];

  const fewShotInteraction = FEW_SHOT_INTERACTION
    .map(f => `"${f.pair}" → interaction: "${f.note}"`)
    .join('\n');
  const fewShotSafe = FEW_SHOT_SAFE.map(p => `"${p}" → safe`).join('\n');

  const pairsText = unknownPairs
    .map(([a, b]) => `- ${a} + ${b}`)
    .join('\n');

  const prompt = `Jsi přísný bezpečnostní kontrolor lékových interakcí. Tvoje chyba v "interaction" způsobí zbytečný strach pacienta — proto je lepší říct "safe" nebo "unknown" než hádat.

Pravidlo: Označuj "interaction" POUZE pokud jsi si jistý na 95 %+. Ve všech ostatních případech vrať "safe" nebo "unknown".

Možné hodnoty "status":
- "interaction" — prokazatelná klinická interakce (piš note)
- "safe"        — žádná klinicky relevantní interakce, nebo běžná kombinace
- "unknown"     — nemáš spolehlivá data

Příklady INTERACTION (pouze takto jasné případy):
${fewShotInteraction}

Příklady SAFE (i takovéto kombinace jsou safe):
${fewShotSafe}

Pravidla pro "note":
- 1 věta, česky, tykání
- žádné INN názvy (piš brand jméno nebo "tato kombinace")
- žádný lékařský žargon, žádné diagnózy
- praktická rada

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

  // Layer 1: statické pair_notes (bez companion párů)
  const manualPairs = detectManualInteractions(validMeds)
    .filter(p => !isCompanion(p.drugs[0], p.drugs[1]));
  const knownSet = new Set(manualPairs.map(p => [...p.drugs].sort().join('|')));

  // Layer 2: zbývající páry → Haiku (bez companion párů)
  const unknownPairs = [];
  for (let i = 0; i < validMeds.length; i++) {
    for (let j = i + 1; j < validMeds.length; j++) {
      const a = validMeds[i].name, b = validMeds[j].name;
      const key = [a, b].sort().join('|');
      if (!knownSet.has(key) && !isCompanion(a, b)) {
        unknownPairs.push([a, b]);
      }
    }
  }

  const haikuResults = await detectWithHaiku(unknownPairs);

  // Merge: statické pair_notes + AI interakce (unknown = ticho)

  const interactions = [
    ...manualPairs.map(p => ({ ...p, source: 'static' })),
    ...haikuResults
      .filter(r => r.status === 'interaction')
      .map(r => ({ drugs: r.drugs, note: r.note, source: 'ai' })),
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
