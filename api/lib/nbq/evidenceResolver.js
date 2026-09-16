// api/lib/nbq/evidenceResolver.js
// Checks if an information need is already KNOWN from available evidence sources.
// Prototype v1 sources: conversation evidence types + known_facts passed from frontend.
// Does NOT call Supabase — pre-intake remains stateless.

import { INFORMATION_NEEDS } from './scenarioEvidenceMap.js';

// Returns { known: boolean, value?: string, source?: string }
export function resolveInformationNeed(needKey, evidenceTypes, knownFacts) {
  const need = INFORMATION_NEEDS[needKey];
  if (!need) return { known: false };

  // Source 1: conversation evidence (extracted from history)
  for (const evType of need.resolvedBy) {
    if (evidenceTypes.has(evType)) {
      return { known: true, value: evType, source: 'conversation' };
    }
  }

  // Source 2: known_facts passed from frontend (session state the client already holds)
  if (knownFacts && typeof knownFacts === 'object' && knownFacts[needKey] !== undefined) {
    return { known: true, value: String(knownFacts[needKey]), source: 'known_facts' };
  }

  return { known: false };
}

// Returns true if the need's prerequisite evidence is present.
export function needPrerequisiteMet(needKey, evidenceTypes) {
  const need = INFORMATION_NEEDS[needKey];
  if (!need || !need.prerequisite) return true;
  return evidenceTypes.has(need.prerequisite);
}
