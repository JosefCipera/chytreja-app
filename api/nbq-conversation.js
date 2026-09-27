// api/nbq-conversation.js — CHJ NBQ Prototype #1
//
// POST { history: [{role, content}], known_facts?: {}, structured_facts?: [] }
// → { outcome, information_need?, message?, hypothesis_state, evidence_extracted, user_intention?, question_count }
//
// New endpoint — api/pre-intake.js is NOT modified.
// Scenario: weight loss / obesity / exertional dyspnea.
//
// Outcomes:
//   URGENT_EXIT          — deterministic emergency (isEmergency from pre-intake)
//   OPEN_INFORMATION_NEED — no specific hypothesis evidence yet; open question
//   ASK                  — specific information need; Haiku formulates the question
//   STOP_QUESTIONING     — no decision-changing unknown remains
//
// MAX_QUESTIONS is a technical safety cap only. It does NOT signal "enough evidence".

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { isEmergency, EMERGENCY_MESSAGE } from './pre-intake.js';
import { extractEvidenceFromHistory }      from './lib/nbq/evidenceExtractor.js';
import { computeHypothesisState, extractUserIntention } from './lib/nbq/hypothesisState.js';
import { selectInformationNeed }           from './lib/nbq/nbqSelector.js';
import { INFORMATION_NEEDS }               from './lib/nbq/scenarioEvidenceMap.js';

export const config = { maxDuration: 30 };

// Technical safety cap — not an evidence quality gate.
const MAX_QUESTIONS = 5;

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

// Haiku's sole role: formulate one natural question from the INFORMATION_NEED.
// Haiku does NOT decide what to ask — that is the NBQ selector's job.
function buildWordingPrompt(informationNeedKey, history) {
  const need = INFORMATION_NEEDS[informationNeedKey];
  const recentContext = history
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'Uživatel' : 'CHJ'}: ${m.content}`)
    .join('\n');

  return {
    system: `Jsi CHJ asistent. Tvoje JEDINÁ ÚLOHA je formulovat JEDNU přirozenou otázku v češtině (tykání).

INFORMATION NEED: ${need?.description ?? informationNeedKey}

Pravidla:
- Napiš PŘESNĚ JEDNU otázku, maximálně jednu větu
- Tykej
- Nepoužívej diagnózy ani lékařské závěry
- Nepřidávej žádnou druhou otázku ani doplnění
- Nepiš nic jiného než samotnou otázku (žádné uvozování, žádné vysvětlení)`,
    messages: [
      {
        role: 'user',
        content: `Kontext rozhovoru:\n${recentContext}\n\nFormuluj otázku pro INFORMATION NEED.`,
      },
    ],
  };
}

// Open question prompt — used when no specific hypothesis has evidence yet.
function buildOpenPrompt(history) {
  const recentContext = history
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'Uživatel' : 'CHJ'}: ${m.content}`)
    .join('\n');

  return {
    system: `Jsi CHJ asistent. Uživatel sdělil záměr, ale zatím nemáme žádné konkrétní zdravotní informace.
Tvoje JEDINÁ ÚLOHA je formulovat JEDNU otevřenou otázku v češtině (tykání), která zjistí, co stojí za tímto záměrem.

Pravidla:
- Přesně JEDNA otázka, jedna věta
- Tykej
- Nepoužívej diagnózy ani lékařské závěry
- Nepiš nic jiného než samotnou otázku`,
    messages: [
      {
        role: 'user',
        content: `Kontext:\n${recentContext}\n\nFormuluj otevřenou otázku.`,
      },
    ],
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { history = [], known_facts = {}, structured_facts = [] } = req.body ?? {};

  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'history must be a non-empty array' });
  }

  const messages = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: String(m.content ?? '') }));

  if (messages.length === 0) return res.status(400).json({ error: 'No valid messages' });

  const questionCount = messages.filter(m => m.role === 'assistant').length;

  // Technical safety cap — not evidence quality
  if (questionCount >= MAX_QUESTIONS) {
    return res.json({
      outcome:          'STOP_QUESTIONING',
      reason:           'MAX_QUESTIONS_REACHED',
      hypothesis_state: {},
      evidence_extracted: [],
      question_count:   questionCount,
    });
  }

  // Evidence extraction (all user turns, deterministic)
  const evidenceItems  = extractEvidenceFromHistory(messages);
  const evidenceTypes  = new Set(evidenceItems.map(e => e.type));
  const hypothesisState = computeHypothesisState(evidenceItems);
  const userIntention  = extractUserIntention(evidenceItems);

  // Last user text for emergency check and Haiku context
  const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';

  // NBQ selection (includes emergency check)
  const selection = selectInformationNeed(lastUserText, hypothesisState, evidenceTypes, known_facts);

  if (selection.outcome === 'URGENT_EXIT') {
    return res.json({
      outcome:          'URGENT_EXIT',
      message:          EMERGENCY_MESSAGE,
      hypothesis_state: hypothesisState,
      evidence_extracted: evidenceItems,
      question_count:   questionCount,
    });
  }

  if (selection.outcome === 'STOP_QUESTIONING') {
    return res.json({
      outcome:          'STOP_QUESTIONING',
      hypothesis_state: hypothesisState,
      evidence_extracted: evidenceItems,
      user_intention:   userIntention,
      question_count:   questionCount,
    });
  }

  // Build Haiku prompt based on selection outcome
  const prompt = selection.outcome === 'OPEN_INFORMATION_NEED'
    ? buildOpenPrompt(messages)
    : buildWordingPrompt(selection.information_need, messages);

  let questionText;
  try {
    const resp = await getClient().messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 256,
      system:     prompt.system,
      messages:   prompt.messages,
    });
    questionText = resp.content?.[0]?.text?.trim() ?? '';
  } catch (err) {
    console.error('[nbq-conversation] Haiku error:', err.message);
    return res.status(502).json({ error: 'AI service unavailable' });
  }

  return res.json({
    outcome:            selection.outcome === 'OPEN_INFORMATION_NEED' ? 'ASK' : 'ASK',
    information_need:   selection.information_need ?? null,
    message:            questionText,
    hypothesis_state:   hypothesisState,
    evidence_extracted: evidenceItems,
    user_intention:     userIntention,
    question_count:     questionCount + 1,
  });
}
