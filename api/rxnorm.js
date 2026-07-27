import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRUGS_DB = JSON.parse(readFileSync(join(__dirname, '../data/drugs.json'), 'utf8'));
const RXNAV = 'https://rxnav.nlm.nih.gov/REST';
const _rxcuiCache = {};
const _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── RxNorm name → rxcui (používá se jen pro identifikaci, ne pro interakce) ───

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

// ── Detekce interakcí z drugs.json (deterministická) ─────────────────────────

function detectManualInteractions(validMeds) {
  const pairs = [];
  const seen = new Set();

  validMeds.forEach(medA => {
    const keyA = medA.name.toLowerCase();
    const dbA  = DRUGS_DB[keyA];
    if (!dbA?.interacts_with || !dbA.interaction_note) return;

    validMeds.forEach(medB => {
      if (medA.name === medB.name) return;
      const keyB = medB.name.toLowerCase();
      const innB = medB.inn?.toLowerCase();

      const matches = dbA.interacts_with.some(iw =>
        iw.toLowerCase() === keyB || (innB && iw.toLowerCase() === innB)
      );
      if (!matches) return;

      const pairKey = [medA.name, medB.name].sort().join('|');
      if (seen.has(pairKey)) return;
      seen.add(pairKey);

      // Preferuj kratší (specifičtější) notu — pokud B má notu pro A, použij tu kratší
      const dbB = DRUGS_DB[keyB];
      let note = dbA.interaction_note;
      if (dbB?.interaction_note && dbB.interaction_note.length < note.length) {
        const bMatchesA = dbB.interacts_with?.some(iw =>
          iw.toLowerCase() === keyA || iw.toLowerCase() === medA.inn?.toLowerCase()
        );
        if (bMatchesA) note = dbB.interaction_note;
      }

      pairs.push({ drugs: [medA.name, medB.name], note, severity: 'high' });
    });
  });

  return pairs;
}

// ── Haiku detekce pro kombinace mimo drugs.json ───────────────────────────────

async function detectWithHaiku(validMeds, knownPairKeys) {
  const rxMeds = validMeds.filter(m => !m.is_supplement);
  if (rxMeds.length < 2) return [];

  // Companion páry — záměrné kombinace, ignorovat
  const companionIgnore = new Set();
  validMeds.forEach(med => {
    const companionFor = med.db.companion_for?.toLowerCase();
    if (!companionFor) return;
    const partner = validMeds.find(m =>
      m.name.toLowerCase() === companionFor || m.inn?.toLowerCase() === companionFor
    );
    if (partner) {
      companionIgnore.add([med.name, partner.name].sort().join('|').toLowerCase());
    }
  });

  const medList = rxMeds.map(m => `${m.name} (${m.inn})`).join(', ');

  // Companion páry pro prompt (Haiku má ignorovat)
  const companionNote = companionIgnore.size > 0
    ? `\nTyto kombinace jsou záměrné lékařem — IGNORUJ je jako interakce: ${[...companionIgnore].join(', ')}.`
    : '';

  let msg;
  try {
    msg = await _anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Pacient bere: ${medList}${companionNote}

Urči závažné klinické interakce (high nebo moderate severity). Ignoruj triviální nebo hypotetické interakce.
Vrať názvy léků PŘESNĚ jak jsou uvedeny v seznamu výše (bez závorek s INN).
Vrať POUZE JSON pole, žádný jiný text:
[{"drugs": ["přesný název1", "přesný název2"], "severity": "high|moderate", "note": "1-2 věty česky, tykání, bez diagnóz"}]
Pokud žádné závažné interakce nejsou, vrať prázdné pole [].`,
      }],
    });
  } catch { return []; }

  try {
    const text = msg.content[0]?.text || '[]';
    const json = text.match(/\[[\s\S]*\]/)?.[0] || '[]';
    const parsed = JSON.parse(json);

    // Normalizuj Haiku jména: strip "(INN)" závorky, lowercase pro porovnání
    const normalize = name => name.replace(/\s*\([^)]+\)/g, '').trim().toLowerCase();

    return parsed.filter(p => {
      if (!Array.isArray(p.drugs) || p.drugs.length < 2) return false;
      const normKey = p.drugs.map(normalize).sort().join('|');
      const rawKey  = p.drugs.slice().sort().join('|').toLowerCase();
      // Přeskoč pokud už je v manuálních párech (brand nebo normalized)
      if (knownPairKeys.has(normKey) || knownPairKeys.has(rawKey)) return false;
      // Přeskoč companion páry
      if (companionIgnore.has(normKey)) return false;
      return true;
    });
  } catch { return []; }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function resolveInteractionsRxNorm(medicationNames) {
  // 1. Normalizuj vstup (string nebo {name, dose} objekt)
  const validMeds = (await Promise.all(medicationNames.map(async raw => {
    const name = typeof raw === 'string' ? raw : (raw?.name || '');
    if (!name) return null;
    const key = name.toLowerCase().trim();
    const db  = DRUGS_DB[key] || {};
    const inn = db.inn || name;
    const rxcui = await getRxcui(inn);
    return { name, inn, rxcui, is_supplement: db.is_supplement ?? false, db };
  }))).filter(Boolean);

  // 2. Detekuj interakce z drugs.json (deterministické, CZ texty)
  const manualPairs = detectManualInteractions(validMeds);

  // knownKeys: brand-name páry + INN páry (pro dedup Haiku výstupu)
  const knownKeys = new Set();
  manualPairs.forEach(p => {
    knownKeys.add(p.drugs.map(n => n.toLowerCase()).sort().join('|'));
    const inns = p.drugs.map(n => DRUGS_DB[n.toLowerCase()]?.inn?.toLowerCase() || n.toLowerCase());
    knownKeys.add(inns.sort().join('|'));
  });

  // 3. Haiku pro zbývající kombinace (doplnění o neznámé páry)
  const haikuPairs = await detectWithHaiku(validMeds, knownKeys);

  const interactions = [...manualPairs, ...haikuPairs];
  if (interactions.length) {
    console.log(`[rxnorm] interakce: ${interactions.map(i => i.drugs.join('+')).join(' | ')}`);
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
