// tag-media.js – automatické tagování longevity_media + longevity_articles pomocí GPT
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const sb  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Povolený slovník tagů ─────────────────────────────────────────────────────

const TEMA_TAGS = [
  // Pohyb & tělo
  'klouby', 'mobilita', 'kyčle', 'kolena', 'krční-páteř', 'záda', 'kotníky',
  'sarkopenie', 'síla', 'svaly', 'zone2', 'vo2max', 'kardio', 'vytrvalost',
  'rovnováha', 'stabilita', 'protažení', 'cvičení', 'ranní-rutina',
  // Metabolismus & výživa
  'inzulín', 'metabolismus', 'mitochondrie', 'půst', 'protein', 'strava',
  'tělesná-kompozice', 'záněty', 'glukóza',
  // Srdce & cévy
  'apoB', 'ateroskleróza', 'krevní-tlak', 'srdce',
  // Mozek & mysl
  'mozek', 'paměť', 'neuroplasticita', 'fokus', 'stres', 'kortizol',
  'spánek', 'cirkadiánní-rytmus', 'mentální-odolnost',
  // Prevence & zdraví
  'hormony', 'imunita', 'doplňky', 'krevní-markery', 'prevence',
  // Obecné
  'dlouhověkost', 'lifestyle',
];

const JEZDEC_TAGS = [
  'jezdec-kardio',       // kardiovaskulární
  'jezdec-metabolismus', // metabolický syndrom / cukrovka
  'jezdec-mozek',        // neurodegenerace
  'jezdec-rakovina',     // onkologie
];

const KONTEXT_TAGS = [
  'začátečník', 'pokročilý',
  'prevence', 'symptomy',
  'teorie', 'praxe',
];

const ALL_TAGS = [...TEMA_TAGS, ...JEZDEC_TAGS, ...KONTEXT_TAGS];

// ── GPT tagger ────────────────────────────────────────────────────────────────

async function tagItem(item) {
  const prompt = `Jsi expert na Medicine 3.0 a dlouhověkost (Peter Attia, Outlive).

Přiřaď TAGS k tomuto obsahu z přesně tohoto seznamu (nic jiného nepoužívej):
${ALL_TAGS.join(', ')}

Obsah:
- Název: ${item.title}
- Oblast (node_id): ${item.node_id}
- Popis: ${item.summary || item.source || '(bez popisu)'}

Pravidla:
- Vyber 3–6 nejrelevantnějších tagů
- Vždy přiřaď 1–2 tagy z tématu, 1 jezdec-* tag (pokud se hodí), 1 kontext tag
- Vrať POUZE JSON pole stringů, žádný jiný text

Příklad odpovědi: ["inzulín", "metabolismus", "jezdec-metabolismus", "prevence", "teorie"]`;

  const res = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 100,
  });

  const raw = res.choices[0].message.content.trim();
  try {
    const tags = JSON.parse(raw);
    // Filtruj jen povolené tagy
    return tags.filter(t => ALL_TAGS.includes(t));
  } catch {
    console.warn(`  ⚠️  Nelze parsovat: ${raw}`);
    return [];
  }
}

// ── Hlavní průchod ────────────────────────────────────────────────────────────

async function run() {
  // Načti všechny položky
  const [{ data: media }, { data: articles }] = await Promise.all([
    sb.from('longevity_media').select('id, node_id, title, summary, source'),
    sb.from('longevity_articles').select('id, node_id, title, summary, source'),
  ]);

  const allItems = [
    ...(media || []).map(r => ({ ...r, table: 'longevity_media' })),
    ...(articles || []).map(r => ({ ...r, table: 'longevity_articles' })),
  ];

  console.log(`📦 Celkem položek: ${allItems.length}`);

  let ok = 0, fail = 0;

  for (const item of allItems) {
    process.stdout.write(`  [${item.table.replace('longevity_', '')}] ${item.title.slice(0, 55)}… `);

    const tags = await tagItem(item);

    if (tags.length === 0) {
      console.log('❌ žádné tagy');
      fail++;
      continue;
    }

    const { error } = await sb
      .from(item.table)
      .update({ tags })
      .eq('id', item.id);

    if (error) {
      console.log(`❌ DB error: ${error.message}`);
      fail++;
    } else {
      console.log(`✅ ${JSON.stringify(tags)}`);
      ok++;
    }

    // Throttle – GPT rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ OK: ${ok}  ❌ Chyby: ${fail}`);
}

run();
