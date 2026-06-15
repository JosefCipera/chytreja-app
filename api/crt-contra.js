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

  const prompt = `Uživatel bere následující léky a doplňky stravy:
${list}

Zkontroluj všechny kombinace a najdi ty, které jsou rizikové nebo nevhodné dohromady.
Pro každou rizikovou kombinaci vrať JSON objekt s klíči:
- "drug": název problematického přípravku (ten, který uživatel přidává nebo který je rizikový)
- "reason": varování ve 2 větách, česky, tykání, bez markdown, bez lékařského žargonu — konkrétní dopad a co má udělat

Vrať pouze JSON pole těchto objektů. Pokud nejsou žádné interakce, vrať prázdné pole [].
Žádný jiný text, pouze JSON.`;

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
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return res.status(502).json({ error: err });
  }

  const data = await aiRes.json();
  const raw = data.content?.[0]?.text?.trim() || '[]';

  let interactions = [];
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/\s*```$/,''));
    interactions = Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    interactions = [];
  }

  return res.status(200).json({ interactions });
}
