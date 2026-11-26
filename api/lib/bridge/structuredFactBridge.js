// api/lib/bridge/structuredFactBridge.js
// Structured Fact Bridge — Bridge #1 (Proof of Contract)
//
// Implements the locked UNIVERSAL STRUCTURED FACT CONTRACT #1.
// Deterministic regex-based extraction from Czech utterances.
//
// Contract rules:
//   - Bridge is a RECORDER, not an interpreter
//   - claimed_source is CLAIMED origin only — never a verified source
//   - Semantic normalization may change representation, not interpretation
//   - Does not assign: node states, hypothesis status, clinical diagnoses
//   - Does not map to Engine fields (sedentary_work, weight_kg node, etc.)
//   - When uncertain: extract less (unhandled utterances return [])

import { randomUUID } from 'crypto';

// ── Claim types (locked — Bridge #1) ─────────────────────────────────────────

export const CLAIM_TYPES = {
  USER_INTENTION:            'USER_INTENTION',
  PREFERENCE:                'PREFERENCE',
  SELF_REPORTED_STATE:       'SELF_REPORTED_STATE',
  SELF_REPORTED_BEHAVIOR:    'SELF_REPORTED_BEHAVIOR',
  SELF_REPORTED_MEASUREMENT: 'SELF_REPORTED_MEASUREMENT',
  SUBJECTIVE_SYMPTOM:        'SUBJECTIVE_SYMPTOM',
  FUNCTIONAL_ABILITY:        'FUNCTIONAL_ABILITY',
};

// ── Entity types ──────────────────────────────────────────────────────────────

export const ENTITY_TYPES = {
  PERSON_SELF:  'PERSON_SELF',
  PERSON_OTHER: 'PERSON_OTHER',
  ORGANIZATION: 'ORGANIZATION',
  DEVICE:       'DEVICE',
  PROCESS:      'PROCESS',
  ENVIRONMENT:  'ENVIRONMENT',
};

// ── Enums ─────────────────────────────────────────────────────────────────────

export const PRECISION = {
  EXACT:       'EXACT',
  APPROXIMATE: 'APPROXIMATE',
  QUALITATIVE: 'QUALITATIVE',
};

export const SPEAKER_CERTAINTY = {
  ASSERTED:  'ASSERTED',
  UNCERTAIN: 'UNCERTAIN',
};

export const CLAIMED_SOURCE_TYPES = {
  SELF:        'SELF',
  DOCTOR:      'DOCTOR',
  DEVICE:      'DEVICE',
  THIRD_PARTY: 'THIRD_PARTY',
};

export const TEMPORAL_SCOPES = {
  CURRENT:     'CURRENT',
  RECURRING:   'RECURRING',
  POINT:       'POINT',
  HISTORICAL:  'HISTORICAL',
  FUTURE:      'FUTURE',
  UNSPECIFIED: 'UNSPECIFIED',
};

// ── Global pre-processing: speaker certainty ──────────────────────────────────
// Detects whether the speaker hedges the whole utterance.
// "asi" is NOT here: it marks numerical approximation (precision=APPROXIMATE),
// not epistemic uncertainty about whether the assertion holds.

const UNCERTAINTY_PATTERNS = [
  /myslím,?\s+(že|si)\b/i,
  /zdá\s+se\s+mi\b/i,
  /\bmožná\b/i,
  /\bsnad\b/i,
  /\btuším\b/i,
  /nevím\s+jistě/i,
];

function detectSpeakerCertainty(text) {
  return UNCERTAINTY_PATTERNS.some(p => p.test(text))
    ? SPEAKER_CERTAINTY.UNCERTAIN
    : SPEAKER_CERTAINTY.ASSERTED;
}

// ── Global pre-processing: claimed source ─────────────────────────────────────
// Detects CLAIMED origin of the information — not a verified source.
// "Doktor mi diagnostikoval" → speaker claims DOCTOR origin.
// The speaker is still the one telling CHJ; claimed_source names who they cite.

const DOCTOR_SOURCE_PATTERNS = [
  /doktor\s+(mi|mě|nám)\s+(diagnostikoval|řekl|sdělil|zjistil|naměřil)/i,
  /lékař\s+(mi|mě|nám)\s+(diagnostikoval|řekl|sdělil|zjistil)/i,
  /doktor\s+mi\s+diagnostikoval/i,
  /lékař\s+mi\s+diagnostikoval/i,
];

const DEVICE_SOURCE_PATTERNS = [
  /hodinky\s+(ukázaly|měřily|naměřily|mi\s+ukázaly)/i,
  /naměřil\s+(jsem|si)\s+\d/i,
  /naměřila\s+jsem\s+si\s+\d/i,
  /měřák\s+ukázal/i,
  /přístroj\s+(ukázal|naměřil)/i,
];

function detectClaimedSource(text) {
  if (DOCTOR_SOURCE_PATTERNS.some(p => p.test(text))) {
    return { type: CLAIMED_SOURCE_TYPES.DOCTOR };
  }
  if (DEVICE_SOURCE_PATTERNS.some(p => p.test(text))) {
    return { type: CLAIMED_SOURCE_TYPES.DEVICE };
  }
  return { type: CLAIMED_SOURCE_TYPES.SELF };
}

// ── Global pre-processing: temporal scope ─────────────────────────────────────
// Provides fallback temporal for extractors that do not set one.

function detectTemporal(text) {
  if (/\bdnes\b/i.test(text)) {
    return { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'today' };
  }
  if (/\bvčera\b/i.test(text)) {
    return { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'yesterday' };
  }
  if (/minulý\s+týden/i.test(text)) {
    return { scope: TEMPORAL_SCOPES.POINT, explicit: true, reference: 'last week' };
  }
  if (/každý\s+den/i.test(text) || /\bdenně\b/i.test(text) || /každodenně/i.test(text)) {
    return { scope: TEMPORAL_SCOPES.RECURRING, explicit: true };
  }
  if (/\bpravidelně\b/i.test(text)) {
    return { scope: TEMPORAL_SCOPES.RECURRING, explicit: true };
  }
  if (/\bchci\b/i.test(text) || /\bzítra\b/i.test(text) || /\bbudu\b/i.test(text)) {
    return { scope: TEMPORAL_SCOPES.FUTURE, explicit: true };
  }
  if (/\bdřív\b/i.test(text) || /\bdříve\b/i.test(text)) {
    return { scope: TEMPORAL_SCOPES.HISTORICAL, explicit: true };
  }
  return { scope: TEMPORAL_SCOPES.CURRENT, explicit: false };
}

// ── Extractors ────────────────────────────────────────────────────────────────
// Each extractor:
//   match(text) → boolean
//   extract(text) → partial STRUCTURED_FACT or null
//
// Extractors set: claim_type, subject, entity, value, precision, temporal.
// They do NOT set: speaker_certainty, claimed_source (those come from global detection).
//
// Order matters — if two extractors match the same utterance and would produce
// the same claim_type + subject, the first one wins (deduplication in main fn).

const EXTRACTORS = [

  // ── USER_INTENTION: weight loss ──────────────────────────────────────────────
  {
    match: text => /chci\s+zhubnout/i.test(text) || /chci\s+shodit/i.test(text),
    extract: () => ({
      claim_type: CLAIM_TYPES.USER_INTENTION,
      subject:    'body_weight',
      entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
      value:      'reduce',
      precision:  PRECISION.QUALITATIVE,
      temporal:   { scope: TEMPORAL_SCOPES.FUTURE, explicit: false },
    }),
  },

  // ── SELF_REPORTED_STATE: overweight (nadváha) ─────────────────────────────────
  // Preserves what was said: "nadváhu" = overweight (person's own label).
  // Does NOT produce: BMI, numeric weight, EXCESS_ADIPOSITY node.
  {
    match: text => /mám\s+nadváhu/i.test(text) || /\bnadváhu\b/i.test(text) || /\bnadváha\b/i.test(text),
    extract: () => ({
      claim_type: CLAIM_TYPES.SELF_REPORTED_STATE,
      subject:    'body_weight_category',
      entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
      value:      'overweight',
      precision:  PRECISION.QUALITATIVE,
      temporal:   { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    }),
  },

  // ── SELF_REPORTED_MEASUREMENT: body weight with value ────────────────────────
  // "Vážím 95 kilo."      → precision = EXACT,        speaker_certainty = ASSERTED
  // "Vážím asi 95 kilo."  → precision = APPROXIMATE,  speaker_certainty = ASSERTED
  // "Myslím, že vážím 95 kilo." → precision = EXACT,  speaker_certainty = UNCERTAIN
  //
  // "asi" modifies the number (precision), not the assertion itself.
  // precision and speaker_certainty are independent: the word "asi" carries
  // precision information only; speaker_certainty comes from UNCERTAINTY_PATTERNS.
  {
    match: text => /vážím\s+(?:asi\s+)?\d/i.test(text),
    extract: text => {
      const m = text.match(/vážím\s+(asi\s+)?(\d+(?:[.,]\d+)?)\s*(kilo|kg|kilogramů)?/i);
      if (!m) return null;
      const isApproximate = !!m[1];
      const val = parseFloat(m[2].replace(',', '.'));
      return {
        claim_type: CLAIM_TYPES.SELF_REPORTED_MEASUREMENT,
        subject:    'body_weight',
        entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
        value:      val,
        unit:       'kg',
        precision:  isApproximate ? PRECISION.APPROXIMATE : PRECISION.EXACT,
        temporal:   { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
      };
    },
  },

  // ── SELF_REPORTED_STATE: blood pressure ───────────────────────────────────────
  // Covers both self-report ("myslím, že mám vysoký tlak") and
  // claimed-doctor-report ("doktor mi diagnostikoval vysoký tlak").
  // claimed_source distinction is handled globally — both yield this same extractor.
  // value = "high" preserves what the person said ("vysoký"), not clinical translation.
  {
    match: text => /vysoký\s+tlak/i.test(text) || /\bhypertenz/i.test(text),
    extract: () => ({
      claim_type: CLAIM_TYPES.SELF_REPORTED_STATE,
      subject:    'blood_pressure',
      entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
      value:      'high',
      precision:  PRECISION.QUALITATIVE,
      temporal:   { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    }),
  },

  // ── SUBJECTIVE_SYMPTOM: dyspnea ───────────────────────────────────────────────
  // Preserves explicitly stated exertional context and threshold if mentioned.
  // Does NOT infer: VO2max, cardiac cause, pulmonary cause, LOW_VO2MAX.
  {
    match: text =>
      /zadýchávám\s+se/i.test(text) ||
      /zadýchám\s+se/i.test(text) ||
      /dušnost\b/i.test(text),
    extract: text => {
      const value = { symptom: 'dyspnea' };
      const hasExertional =
        /při\s+(pohybu|námaze|chůzi|výstupu|cvičení)/i.test(text) ||
        /když\s+(vyjdu|jdu\s+do\s+schodů|chodím\s+rychle|cvičím)/i.test(text);
      const hasStairs =
        /dvě?\s+patra/i.test(text) ||
        /\bpatra\b/i.test(text) ||
        /\bschody\b/i.test(text);
      if (hasExertional) value.context  = 'exertional';
      if (hasStairs)     value.threshold = 'stairs';
      return {
        claim_type: CLAIM_TYPES.SUBJECTIVE_SYMPTOM,
        subject:    'dyspnea',
        entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
        value,
        precision:  PRECISION.QUALITATIVE,
        temporal:   { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
      };
    },
  },

  // ── SELF_REPORTED_BEHAVIOR: low physical activity ─────────────────────────────
  // Does NOT produce: sedentary_work=true, step counts, hours, PHYSICAL_INACTIVITY.
  // temporal = RECURRING because low activity is a behavioral pattern, not a point event.
  {
    match: text =>
      /málo\s+se\s+hýbu/i.test(text)          ||
      /hýbu\s+se\s+málo/i.test(text)          ||
      /vůbec\s+se\s+nehýbu/i.test(text)        ||
      /skoro\s+nic\s+nesportuj/i.test(text)    ||
      /vůbec\s+nesportuj/i.test(text),
    extract: () => ({
      claim_type: CLAIM_TYPES.SELF_REPORTED_BEHAVIOR,
      subject:    'physical_activity',
      entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
      value:      'low',
      precision:  PRECISION.QUALITATIVE,
      temporal:   { scope: TEMPORAL_SCOPES.RECURRING, explicit: false },
    }),
  },

  // ── SELF_REPORTED_STATE: planning identified as problem (business domain) ──────
  // subject = "planning" — what the person named as the problem.
  // NOT "root_cause_hypothesis" — that label belongs to the causal layer.
  // entity.type = PROCESS (about a business process, not about the person).
  {
    match: text =>
      /problém\s+je\s+v\s+plánování/i.test(text) ||
      /plánování\s+je\s+problém/i.test(text),
    extract: () => ({
      claim_type: CLAIM_TYPES.SELF_REPORTED_STATE,
      subject:    'planning',
      entity:     { ref: 'company_operations', type: ENTITY_TYPES.PROCESS },
      value:      'problematic',
      precision:  PRECISION.QUALITATIVE,
      temporal:   { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    }),
  },

  // ── FUNCTIONAL_ABILITY: unable to rise from floor ─────────────────────────────
  // CAN/CANNOT is a distinct epistemic category:
  //   not what the person typically does (SELF_REPORTED_BEHAVIOR),
  //   not a state they are in (SELF_REPORTED_STATE),
  //   but the boundary of their capability.
  {
    match: text =>
      /nevstanu\s+ze\s+země\s+bez\s+opory/i.test(text) ||
      /nemůžu\s+vstát\s+ze\s+země/i.test(text),
    extract: () => ({
      claim_type: CLAIM_TYPES.FUNCTIONAL_ABILITY,
      subject:    'floor_rise',
      entity:     { ref: 'self', type: ENTITY_TYPES.PERSON_SELF },
      value:      { ability: false, condition: 'without_support' },
      precision:  PRECISION.QUALITATIVE,
      temporal:   { scope: TEMPORAL_SCOPES.CURRENT, explicit: false },
    }),
  },

];

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * extractStructuredFacts — Bridge #1 entry point.
 *
 * @param {object} params
 * @param {string}   params.utterance        Raw user text
 * @param {number}   [params.conversationTurn=0]
 * @param {string}   [params.extractedAt]    ISO timestamp (defaults to now)
 * @param {function} [params._idFactory]     UUID factory (for deterministic tests)
 * @returns {STRUCTURED_FACT[]}
 *
 * Returns [] for unhandled utterances — never returns invented facts.
 */
export function extractStructuredFacts({
  utterance,
  conversationTurn = 0,
  extractedAt      = new Date().toISOString(),
  _idFactory       = randomUUID,
}) {
  if (!utterance || typeof utterance !== 'string' || !utterance.trim()) return [];

  const text = utterance.trim();

  const speakerCertainty = detectSpeakerCertainty(text);
  const claimedSource    = detectClaimedSource(text);
  const baseTemporal     = detectTemporal(text);

  const facts = [];

  for (const extractor of EXTRACTORS) {
    if (!extractor.match(text)) continue;

    const partial = extractor.extract(text);
    if (!partial) continue;

    // Deduplication: one fact per claim_type + subject per utterance.
    // If a more-specific extractor already emitted this pair, skip.
    const isDuplicate = facts.some(
      f => f.claim_type === partial.claim_type && f.subject === partial.subject,
    );
    if (isDuplicate) continue;

    const fact = {
      fact_id:           _idFactory(),
      source_type:       'CONVERSATION',
      source_utterance:  text,
      conversation_turn: conversationTurn,
      extracted_at:      extractedAt,

      claim_type:        partial.claim_type,
      subject:           partial.subject,
      entity:            partial.entity,
      value:             partial.value,

      // unit is optional — only include when extractor sets it
      ...(partial.unit !== undefined ? { unit: partial.unit } : {}),

      precision:         partial.precision,

      // Global qualifiers — extractor may override, global is the default
      speaker_certainty: partial.speaker_certainty ?? speakerCertainty,
      claimed_source:    partial.claimed_source    ?? claimedSource,
      temporal:          partial.temporal          ?? baseTemporal,
    };

    facts.push(fact);
  }

  return facts;
}
