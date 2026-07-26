import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRUGS_DB = JSON.parse(readFileSync(join(__dirname, '../data/drugs.json'), 'utf8'));
const RXNAV = 'https://rxnav.nlm.nih.gov/REST';

// In-memory cache per serverless instance
const _rxcuiCache = {};

// ── RxNorm lookup ──────────────────────────────────────────────────────────────

async function getRxcui(term) {
  const key = term.toLowerCase().trim();
  if (_rxcuiCache[key]) return _rxcuiCache[key];
  try {
    const res = await fetch(`${RXNAV}/rxcui.json?name=${encodeURIComponent(term)}&search=1`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const rxcui = data?.idGroup?.rxnormId?.[0] || null;
    if (rxcui) _rxcuiCache[key] = rxcui;
    return rxcui;
  } catch { return null; }
}

// ── NLM Drug Interaction API ──────────────────────────────────────────────────

async function getNlmInteractions(rxcuis) {
  if (rxcuis.length < 2) return [];
  try {
    const query = rxcuis.join('+');
    const res = await fetch(`${RXNAV}/interaction/list.json?rxcuis=${query}`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    return data?.fullInteractionTypeGroup || [];
  } catch { return []; }
}

function parseInteractionGroups(groups) {
  const pairs = [];
  const seen = new Set();
  for (const g of groups) {
    for (const fit of (g.fullInteractionType || [])) {
      for (const ip of (fit.interactionPair || [])) {
        const concepts = ip.interactionConcept || [];
        const names = concepts.map(c => c.minConceptItem?.name).filter(Boolean);
        if (names.length < 2) continue;
        const key = names.slice().sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({
          drugs: names,
          severity: ip.severity || 'unknown',
          description: ip.description || '',
        });
      }
    }
  }
  return pairs;
}

// ── Haiku translation ──────────────────────────────────────────────────────────

const _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function translateToCzech(pairs) {
  if (!pairs.length) return [];
  const prompt = pairs.map((p, i) =>
    `${i + 1}. ${p.drugs.join(' + ')} (závažnost: ${p.severity}): ${p.description}`
  ).join('\n');

  const msg = await _anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Přelož tyto lékové interakce do češtiny. Každou interakci přelož jako 1–2 věty, tykání, bez markdown, bez diagnóz. Vrať pouze přeložené věty oddělené prázdným řádkem, ve stejném pořadí.\n\n${prompt}`,
    }],
  });

  const lines = (msg.content[0]?.text || '').split(/\n\n+/).map(s => s.trim()).filter(Boolean);
  return pairs.map((p, i) => ({ ...p, note_cz: lines[i] || p.description }));
}

// ── Main resolve function (exported for crt-generate.js) ─────────────────────

export async function resolveInteractionsRxNorm(medicationNames) {
  // 1. Map brand → INN → rxcui  (accept both strings and {name, dose} objects)
  const meds = await Promise.all(medicationNames.map(async raw => {
    const name = typeof raw === 'string' ? raw : (raw?.name || '');
    if (!name) return null;
    const key = name.toLowerCase().trim();
    const db    = DRUGS_DB[key] || {};
    const inn   = db.inn || name;
    const rxcui = await getRxcui(inn);
    return { name, inn, rxcui, is_supplement: db.is_supplement ?? false, db };
  }));
  const validMeds = meds.filter(Boolean);

  // 2. Get NLM interactions for all rxcuis that resolved
  const rxcuis = validMeds.map(m => m.rxcui).filter(Boolean);
  const groups  = await getNlmInteractions(rxcuis);
  const rawPairs = parseInteractionGroups(groups);

  // 3. Prefer manual CZ note from drugs.json; fall back to Haiku translation
  const needTranslation = [];
  const result = rawPairs.map(pair => {
    // Try to find manual note: check if pair.drugs[0] or pair.drugs[1] matches an INN in drugs.json
    const manualNote = Object.values(DRUGS_DB).find(d =>
      d.inn && pair.drugs.some(n => n.toLowerCase().includes(d.inn.toLowerCase())) &&
      d.interaction_note
    )?.interaction_note;

    if (manualNote) return { drugs: pair.drugs, note: manualNote, severity: pair.severity };
    needTranslation.push(pair);
    return null;
  });

  // 4. Translate pairs that don't have a manual note
  const translated = needTranslation.length ? await translateToCzech(needTranslation) : [];
  let ti = 0;
  const interactions = result.map(r => r || { drugs: translated[ti].drugs, note: translated[ti++].note_cz, severity: translated[ti - 1]?.severity });

  return { meds: validMeds, interactions };
}

// ── HTTP endpoint ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { medications } = req.body || {};
  if (!Array.isArray(medications) || !medications.length) {
    return res.status(400).json({ error: 'medications array required' });
  }

  try {
    const { meds, interactions } = await resolveInteractionsRxNorm(medications);
    return res.status(200).json({ meds, interactions });
  } catch (err) {
    console.error('[rxnorm] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
