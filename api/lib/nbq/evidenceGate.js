// api/lib/nbq/evidenceGate.js
// Pure NBQ gate evaluation — no HTTP, no AI calls.
// Called by api/orchestrate.js after processInput() to determine evidence sufficiency.
// Mirrors the evidence pipeline of api/nbq-conversation.js.

import { extractEvidenceFromHistory } from './evidenceExtractor.js';
import { computeHypothesisState }     from './hypothesisState.js';
import { selectInformationNeed }      from './nbqSelector.js';

// Evaluate whether the NBQ selector needs more information before an ACT response.
// nbqMessages: prior NBQ exchange from session (role/content array)
// userText:    current user turn (not yet in nbqMessages)
// knownFacts:  profile-level known facts passed to selector (Alpha: always {})
//
// Returns:
//   { outcome, information_need?, hypothesisState, evidenceItems }
//   outcome mirrors nbqSelector: OPEN_INFORMATION_NEED | ASK | STOP_QUESTIONING | URGENT_EXIT
export function evaluateGate(nbqMessages, userText, knownFacts = {}) {
  const history = [
    ...(Array.isArray(nbqMessages) ? nbqMessages : []),
    { role: 'user', content: userText },
  ];
  const evidenceItems   = extractEvidenceFromHistory(history);
  const evidenceTypes   = new Set(evidenceItems.map(e => e.type));
  const hypothesisState = computeHypothesisState(evidenceItems);
  const selection       = selectInformationNeed(userText, hypothesisState, evidenceTypes, knownFacts);
  return { ...selection, hypothesisState, evidenceItems };
}
