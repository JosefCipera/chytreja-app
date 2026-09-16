// api/lib/integration/bridgeToPersonModel.js
// Bridge → Person Model Integration #1
//
// Minimal pipe: utterance → Structured Fact Bridge → PersonModel.ingest()
//
// No new logic. No duplication of Bridge or Person Model behaviour.
// Does not connect to: Health Engine, NBQ, pre-intake, Supabase, UI.

import { extractStructuredFacts } from '../bridge/structuredFactBridge.js';

/**
 * ingestUtterance — pipe one utterance through Bridge into an existing PersonModel.
 *
 * @param {PersonModel} personModel   Caller-owned PersonModel instance
 * @param {string}      utterance     Raw user text
 * @param {object}      [options]
 * @param {number}      [options.conversationTurn=0]
 * @param {string}      [options.extractedAt]   ISO timestamp (defaults to now)
 * @param {string}      [options.correctionOf]  fact_id this utterance explicitly corrects
 * @returns {STRUCTURED_FACT[]}  Facts extracted and ingested (may be empty)
 */
export function ingestUtterance(personModel, utterance, options = {}) {
  const {
    conversationTurn = 0,
    extractedAt      = new Date().toISOString(),
    correctionOf,
  } = options;

  const facts = extractStructuredFacts({ utterance, conversationTurn, extractedAt });

  const intakeOptions = correctionOf ? { correction_of: correctionOf } : {};

  for (const fact of facts) {
    personModel.ingest(fact, intakeOptions);
  }

  return facts;
}
