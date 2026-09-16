// api/lib/nbq/evidenceExtractor.js
// Deterministic regex-based evidence extraction from Czech text.
// Covers only signals relevant to this prototype scenario.
// Never assigns hypothesis status or causality — only classifies text.

import { ET } from './scenarioEvidenceMap.js';

const PATTERNS = [
  {
    type: ET.USER_INTENTION_WEIGHT_LOSS,
    patterns: [/chci\s+zhubnout/i, /chci\s+shodit/i, /zhubnout/i, /hubn[oě]t/i, /zhubnu/i],
  },
  {
    type: ET.SELF_REPORTED_OBESITY,
    patterns: [
      /mám\s+nadváhu/i, /nadváhu/i, /nadváha/i,
      /obézní/i, /obezita/i,
      /přibral\s+jsem/i, /přibrala\s+jsem/i, /přibral\/a/i,
    ],
  },
  {
    type: ET.SELF_REPORTED_DYSPNEA,
    patterns: [
      /zadýchávám\s+se/i, /zadýchám\s+se/i,
      /dušnost/i, /dušno\b/i,
      /špatně\s+(se\s+)?dýchám/i,
    ],
  },
  {
    type: ET.EXERTIONAL_QUALIFIER,
    patterns: [
      /při\s+pohybu/i,
      /při\s+námaze/i,
      /při\s+chůzi/i,
      /při\s+(výstupu|výjezdu|schodech|cvičení|sportu)/i,
      /když\s+(vyjdu|jdu\s+do\s+schodů|chodím\s+rychle|cvičím|sportuji)/i,
      /při\s+fyzické\s+aktivitě/i,
    ],
  },
  {
    type: ET.FUNCTIONAL_THRESHOLD_STAIRS,
    patterns: [
      /dvě?\s+patra/i,
      /jedno\s+patro/i,
      /tři\s+patra/i,
      /\bpatra\b/i,
      /\bpatro\b/i,
      /schodiště/i,
      /schody/i,
    ],
  },
  {
    type: ET.RESTING_QUALIFIER,
    patterns: [
      /i\s+v\s+klidu/i,
      /i\s+v\s+sedě/i,
      /i\s+když\s+sedím/i,
      /i\s+v\s+leže/i,
      /v\s+noci\s+se\s+(zadýcháv|dusím)/i,
      /klidová\s+dušnost/i,
    ],
  },
  {
    type: ET.MALAISE_GENERAL,
    patterns: [
      /necítím\s+se\s+dobře/i,
      /cítím\s+se\s+špatně/i,
      /cítím\s+se\s+unaveně/i,
      /jsem\s+unavený/i,
      /jsem\s+unavená/i,
      /vyčerpání/i,
      /celková\s+únava/i,
    ],
  },
  {
    type: ET.ACTIVITY_LEVEL_LOW,
    patterns: [
      /skoro\s+nic\s+nesportuji/i,
      /skoro\s+nic\s+nesportuju/i,
      /vůbec\s+nesportuji/i,
      /vůbec\s+se\s+nehýbu/i,
      /hýbu\s+se\s+málo/i,
      /málo\s+se\s+hýbu/i,
      /sedavý\s+životní\s+styl/i,
      /sedavá\s+práce\b/i,
      /žádný\s+pohyb/i,
      /nikdy\s+nesportuji/i,
      /nikdy\s+nesportuju/i,
    ],
  },
  {
    type: ET.ACTIVITY_LEVEL_MEDIUM,
    patterns: [
      /snažím\s+se\s+chodit/i,
      /občas\s+sportuji/i,
      /občas\s+sportuju/i,
      /trochu\s+chodím/i,
      /pravidelné\s+procházky/i,
      /párkrát\s+týdně\s+chodím/i,
      /střední\s+aktivita/i,
    ],
  },
  {
    type: ET.ACTIVITY_LEVEL_HIGH,
    patterns: [
      /pravidelně\s+cvičím/i,
      /pravidelně\s+sportuji/i,
      /pravidelně\s+sportuju/i,
      /trénuji\s+pravidelně/i,
      /intenzivně\s+sportuji/i,
      /aktivní\s+sport\s+pravidelně/i,
    ],
  },
  {
    type: ET.DYSPNEA_STABLE,
    patterns: [
      /celé\s+roky/i,
      /vždy\s+jsem\s+byl\s+v\s+horší\s+kondici/i,
      /vždy\s+jsem\s+byla\s+v\s+horší\s+kondici/i,
      /od\s+vždy\s+to\s+tak\s+bylo/i,
      /celý\s+život\s+(se\s+zadýcháv|mám\s+problémy)/i,
      /nezhoršuje\s+se/i,
      /nemění\s+se\s+to/i,
      /stejně\s+jako\s+dřív\b/i,
      /vždy\s+jsem\s+byl\b/i,
      /vždy\s+jsem\s+byla\b/i,
    ],
  },
  {
    type: ET.DYSPNEA_PROGRESSIVE,
    patterns: [
      /hůř\s+než\s+dřív/i,
      /zhoršuje\s+se/i,
      /v\s+poslední\s+době\s+se\s+(to\s+)?zhoršil/i,
      /čím\s+dál\s+(tím\s+)?hůř/i,
      /stále\s+horší/i,
      /v\s+posledních\s+měsících\s+(se|je)\s+(to\s+)?horší/i,
      /nedávno\s+se\s+to\s+zhoršilo/i,
      /zdá\s+se\s+mi,?\s+že\s+hůř/i,
    ],
  },
];

export function extractEvidence(text) {
  if (!text || typeof text !== 'string') return [];
  const found = [];
  for (const { type, patterns } of PATTERNS) {
    if (patterns.some(p => p.test(text))) {
      found.push({ type, raw_text: text });
    }
  }
  return found;
}

export function extractEvidenceFromHistory(history) {
  const all = [];
  for (const msg of history) {
    if (msg.role === 'user') {
      all.push(...extractEvidence(msg.content));
    }
  }
  return all;
}
