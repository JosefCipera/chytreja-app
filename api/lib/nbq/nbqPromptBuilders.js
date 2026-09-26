// api/lib/nbq/nbqPromptBuilders.js
// Shared prompt builders for NBQ question formulation.
// Used by api/nbq-conversation.js and api/orchestrate.js (NBQ gate).
// Haiku's sole role is to formulate one natural question — the selector decides WHAT to ask.

import { INFORMATION_NEEDS } from './scenarioEvidenceMap.js';

export function buildWordingPrompt(informationNeedKey, history) {
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
    messages: [{
      role: 'user',
      content: `Kontext rozhovoru:\n${recentContext}\n\nFormuluj otázku pro INFORMATION NEED.`,
    }],
  };
}

export function buildOpenPrompt(history) {
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
    messages: [{
      role: 'user',
      content: `Kontext:\n${recentContext}\n\nFormuluj otevřenou otázku.`,
    }],
  };
}
