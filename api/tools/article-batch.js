import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const ARTICLE_PROMPT = `Napiš longevity článek pro CHJ (Chytré Já) app.

Téma: {TOPIC}
Uzel: {NODE_ID}

Vrať JSON v přesně tomto formátu (žádný jiný text):
{
  "title": "Název článku (aktivní, motivující, max 10 slov)",
  "perex": "2-3 věty. Proč je toto klíčové pro dlouhověkost.",
  "content": "Plný markdown článek se sekcemi: ## Co to je, ## Proč to funguje, ## Jak na to, ## CHJ Tip (blockquote >)",
  "node_id": "node_id uzlu",
  "killer": "SRDCE nebo IMUNITA nebo MOZEK nebo METABOLISMUS",
  "med_ids": ["MED_ID:XXX", "MED_ID:XXX", "MED_ID:XXX"],
  "tags": ["tag1", "tag2", "tag3"]
}

PRAVIDLA:
- Čeština, tykání
- Zakázaná slova: musíš, okamžitě, je důležité, měl bys, hrozí, ohrožuje, samostatnost, závislý, trpí
- Žádné názvy nemocí — infarkt → oslabení SRDCE, diabetes → problémy s METABOLISMEM, Alzheimer → ztráta funkce MOZKU
- CHJ Tip: max 15 slov, přímočará věta
- Medicine 3.0 perspektiva: být schopný v 80, ne vypadat dobře ve 40
- Med IDs: 2-3 realistické reference jako MED_ID:NNN`;

async function generateArticle(client, topic, node_id) {
  const prompt = ARTICLE_PROMPT
    .replace('{TOPIC}', topic)
    .replace('{NODE_ID}', node_id);

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  });

  return JSON.parse(response.choices[0].message.content);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { articles } = req.body;
  if (!Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({ error: 'articles must be a non-empty array of { topic, node_id }' });
  }
  if (articles.length > 20) {
    return res.status(400).json({ error: 'Max 20 articles per batch' });
  }

  const anthropic = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Generate all articles in parallel
  const results = await Promise.allSettled(
    articles.map(async ({ topic, node_id }) => {
      const article = await generateArticle(anthropic, topic, node_id);
      const { data, error } = await supabase
        .from('longevity_articles')
        .insert({
          node_id: article.node_id || node_id,
          title: article.title,
          url: `chj://articles/${node_id}/${topic.toLowerCase().replace(/\s+/g, '-')}`,
          summary: article.perex,
          tags: article.tags || [],
          lang: 'cs',
          source: 'gpt4o-mini-generated',
        })
        .select('id')
        .single();

      if (error) throw new Error(`DB error: ${error.message}`);
      return { topic, node_id, id: data.id, title: article.title };
    })
  );

  const saved = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = results
    .filter(r => r.status === 'rejected')
    .map((r, i) => ({ topic: articles[i]?.topic, error: r.reason?.message }));

  res.status(200).json({ saved, failed, total: articles.length });
}
