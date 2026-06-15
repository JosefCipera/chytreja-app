import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { drug, conflicts_with, user_meds = [], user_supps = [] } = req.body || {};
  if (!drug || !conflicts_with) return res.status(400).json({ error: 'drug and conflicts_with required' });

  const allMeds = [...user_meds, ...user_supps].filter(Boolean).join(', ');

  const prompt = `Uživatel bere tyto léky a doplňky: ${allMeds}.
Chystá se vzít "${drug}", ale to je rizikové v kombinaci s jeho současnou léčbou.

Napiš varování přesně ve 2 větách. Česky, tykání. Bez markdown formátování (žádné hvězdičky, emoji, tučné písmo). Bez lékařského žargonu. Bez čísel ani dávek.
Napiš konkrétní dopad a pak co má udělat.`;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return res.status(502).json({ error: err });
  }

  const data = await aiRes.json();
  const text = data.content?.[0]?.text?.trim() || '';
  return res.status(200).json({ text });
}
