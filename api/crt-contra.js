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

  const list = all.map((x, i) => `${i + 1}. ${x}`).join('\n');

  const system = `Jsi klinický farmaceut. Tvůj úkol je identifikovat lékové interakce a rizika v kombinacích léků a doplňků stravy. Vždy odpovídáš pouze validním JSON polem, žádný jiný text.`;

  const prompt = `Pacient bere současně:
${list}

Které kombinace jsou klinicky rizikové? Zahrň interakce lék-lék, lék-doplněk i doplněk-doplněk.
Příklady rizik: zvýšené krvácení, srdeční arytmie, snížená účinnost léku, toxicita.

Odpověz POUZE tímto JSON polem (bez markdown, bez komentářů):
[{"drug":"název rizikového přípravku","reason":"2 věty česky, tykání, konkrétní dopad + co udělat"}]`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
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
