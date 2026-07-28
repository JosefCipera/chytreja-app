import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Sonnet-first interaction detection.
// Input: { user_meds: string[], user_supps: string[] }
// Output: { interactions: [{ drug, reason }] }
// Sonnet identifies ALL risky combinations itself — no static KB rules.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { user_meds = [], user_supps = [] } = req.body || {};
  const all = [...user_meds, ...user_supps].filter(Boolean);
  if (all.length < 2) return res.status(200).json({ interactions: [] });

  const medsList = user_meds.map((x, i) => `${i + 1}. ${x}`).join('\n') || '(žádné)';
  const suppsList = user_supps.map((x, i) => `${i + 1}. ${x}`).join('\n') || '(žádné)';

  const system = `Jsi přátelský průvodce zdravím. Upozorňuješ jen na věci, které lékař nevidí — zejména doplňky stravy kombinované s léky. Píšeš jednoduše, bez diagnóz a lékařského žargonu. Vždy odpovídáš pouze validním JSON polem.`;

  const prompt = `Pacient bere tyto PŘEDEPSANÉ léky (lékař je zvolil záměrně, jejich vzájemné kombinace sleduje):
${medsList}

Pacient navíc bere tyto DOPLŇKY STRAVY / volně prodejné přípravky (lékař o nich nemusí vědět):
${suppsList}

Pravidla:
- Mezi předepsanými léky NEVAROVAT, pokud jde o běžnou kombinaci, kterou lékař zvolil záměrně.
- Hlavní pozornost věnuj doplňkům — ty lékař nevidí.
- Pokud žádné riziko nenajdeš, vrať prázdné pole.
- Text pište takto: 1 věta, česky, tykání, praktická rada co hlídat nebo co udělat jinak — BEZ lékařského žargonu, BEZ diagnóz, BEZ "hyperkalemie" nebo podobných termínů, BEZ "konzultuj s lékařem".

Odpověz POUZE tímto JSON polem (bez markdown, bez komentářů):
[{"drug":"název přípravku","reason":"jedna věta, tykání, praktická rada"}]`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return res.status(502).json({ error: err });
  }

  const data = await aiRes.json();
  console.log('[crt-contra] status:', data.type, 'stop:', data.stop_reason, 'content len:', data.content?.length);
  const raw = data.content?.[0]?.text?.trim() || '[]';
  console.log('[crt-contra] raw:', raw.slice(0, 200));

  let interactions = [];
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/\s*```$/,''));
    interactions = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    interactions = [];
  }

  return res.status(200).json({ interactions });
}
