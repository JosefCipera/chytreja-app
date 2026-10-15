import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === AKCE ===
const newActions = [
  { node_id: 'dychani',           label: 'Nosní dýchání 5 minut vědomě',                 protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: 300 },
  { node_id: 'nosni_dychani',     label: 'Zavři ústa a dýchej nosem 10 nádechů',         protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: null },
  { node_id: 'butejko',           label: 'Buteyko: zadržení dechu po výdechu',            protocol_type: 'MEDITATION_PROTOKOL', tier: 2, duration: null },
  { node_id: 'dechova_koherence', label: 'Dechová koherence 5 min (5s nádech/5s výdech)', protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: 300 },
  { node_id: 'dechova_koherence', label: 'Dechová koherence 10 minut',                    protocol_type: 'MEDITATION_PROTOKOL', tier: 2, duration: 600 },
  { node_id: 'meditace',          label: 'Meditace všímavosti 5 minut',                   protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: 300 },
  { node_id: 'meditace',          label: 'Meditace všímavosti 15 minut',                  protocol_type: 'MEDITATION_PROTOKOL', tier: 2, duration: 900 },
  { node_id: 'soustredeni',       label: 'Hluboká práce 25 minut bez rušení (Pomodoro)', protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: 1500 },
  { node_id: 'soustredeni',       label: 'Hluboká práce 50 minut bez rušení',             protocol_type: 'MEDITATION_PROTOKOL', tier: 2, duration: 3000 },
  { node_id: 'vdecnost',          label: 'Napiš 3 věci za co jsi vděčný',                 protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: null },
  { node_id: 'klid',              label: 'Procházka bez telefonu 15 minut',               protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: 900 },
  { node_id: 'emoce',             label: 'Pojmenuj emoci a zapiš ji',                     protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: null },
  { node_id: 'hydratace',         label: 'Vypij 2 sklenice vody ráno',                    protocol_type: 'NUTRITION_PROTOKOL',  tier: 1, duration: null },
  { node_id: 'hydratace',         label: 'Sleduj příjem vody celý den (cíl 2L)',           protocol_type: 'NUTRITION_PROTOKOL',  tier: 2, duration: null },
  { node_id: 'bilkoviny',         label: 'Přidej 30g proteinu ke snídani',                protocol_type: 'NUTRITION_PROTOKOL',  tier: 1, duration: null },
  { node_id: 'bilkoviny',         label: 'Zkontroluj celkový příjem bílkovin (1.6g/kg)',  protocol_type: 'NUTRITION_PROTOKOL',  tier: 2, duration: null },
  { node_id: 'mikronutrienty',    label: 'Vezmi Omega-3 a Vitamin D',                     protocol_type: 'PREVENTION_PROTOKOL', tier: 1, duration: null },
  { node_id: 'casovani_jidel',    label: 'Nejez 3 hodiny před spaním',                    protocol_type: 'NUTRITION_PROTOKOL',  tier: 1, duration: null },
  { node_id: 'glukoza_vyziva',    label: 'Procházka 10 minut po jídle',                   protocol_type: 'TRAINING_PROTOKOL',   tier: 1, duration: 600 },
  { node_id: 'imunitni',          label: 'Studená sprcha 30s na závěr',                   protocol_type: 'PREVENTION_PROTOKOL', tier: 1, duration: 30 },
  { node_id: 'imunitni',          label: 'Choď spát před půlnocí 7 dní v řadě',           protocol_type: 'SLEEP_PROTOKOL',      tier: 2, duration: null },
  { node_id: 'metabolicke',       label: 'Změř obvod pasu',                               protocol_type: 'PREVENTION_PROTOKOL', tier: 1, duration: null },
  { node_id: 'metabolicke',       label: 'Procházka 10 minut po každém jídle',            protocol_type: 'TRAINING_PROTOKOL',   tier: 1, duration: 600 },
  { node_id: 'nervovy_system',    label: 'Physiological sigh 5x po stresu',               protocol_type: 'MEDITATION_PROTOKOL', tier: 1, duration: 60 },
  { node_id: 'nervovy_system',    label: 'Ranní světlo — 10 minut venku po probuzení',    protocol_type: 'PREVENTION_PROTOKOL', tier: 1, duration: 600 },
  { node_id: 'obnova',            label: 'NSDR — lehni si na 20 minut',                   protocol_type: 'SLEEP_PROTOKOL',      tier: 1, duration: 1200 },
  { node_id: 'obnova',            label: 'Sauna 15 minut',                                protocol_type: 'PREVENTION_PROTOKOL', tier: 2, duration: 900 },
  { node_id: 'mobilita',          label: 'Protahni boky a hrudník 15 minut',              protocol_type: 'MOBILITY_PROTOKOL',   tier: 2, duration: 900 },
  { node_id: 'mobilita',          label: 'Jóga základní sekvence 20 minut',               protocol_type: 'MOBILITY_PROTOKOL',   tier: 3, duration: 1200 },
].map(a => ({ ...a, id: randomUUID() }));

const { error: actErr } = await sb.from('longevity_actions').insert(newActions);
console.log(actErr ? `x Akce: ${actErr.message}` : `OK Pridano ${newActions.length} akci`);

// === ČLÁNKY ===
const PROMPT = (topic, node_id) => `Napis longevity clanek pro CHJ app. Tema: ${topic}. Uzel: ${node_id}.
Vrat JSON: {"title":"max 10 slov","perex":"2-3 vety konkretni prinos","content":"## Co to je\n## Proc to funguje\n## Jak na to\n\n> CHJ Tip: max 15 slov","tags":["tag1","tag2"]}
PRAVIDLA: cestina, tykani, konkretni cisla, Medicine 3.0, zakazano: mysis/okamzite/je dulezite/mel bys/hrozi/trpi, zadne nazvy nemoci.`;

const topics = [
  { topic: 'Nosni dychani — zaklad zdravi a vykonu', node_id: 'dychani' },
  { topic: 'Dechova koherence — synchronizace srdce a mozku', node_id: 'dechova_koherence' },
  { topic: 'Buteyko metoda — mene dechu, vice kysliku', node_id: 'butejko' },
  { topic: 'Meditace vsimavosti — trenink pozornosti', node_id: 'meditace' },
  { topic: 'Soustredeni — jak budovat kapacitu hluboke prace', node_id: 'soustredeni' },
  { topic: 'Vdecnost — proc meni mozek a zdravi', node_id: 'vdecnost' },
  { topic: 'Emoce a zdravi — jak zpracovat stres v tele', node_id: 'emoce' },
  { topic: 'Klid a regenerace — aktivni odpocinekpro dlouhovekost', node_id: 'klid' },
  { topic: 'Hydratace — voda jako zaklad vykonu a zdravi', node_id: 'hydratace' },
  { topic: 'Bilkoviny — kolik potrebujes pro svalovou hmotu ve stari', node_id: 'bilkoviny' },
  { topic: 'Mikronutrienty — Omega-3, Vitamin D a horcik', node_id: 'mikronutrienty' },
  { topic: 'Glukoza a jidlo — jak stabilizovat hladinu cukru', node_id: 'glukoza_vyziva' },
  { topic: 'Casovani jidel — kdy jist pro lepsi metabolismus', node_id: 'casovani_jidel' },
  { topic: 'Imunita — pohyb, spanek a chlad jako stit', node_id: 'imunitni' },
  { topic: 'Metabolicke zdravi — jak cist signaly sveho tela', node_id: 'metabolicke' },
  { topic: 'Nervovy system — ranni svetlo a regulace stresu', node_id: 'nervovy_system' },
  { topic: 'Obnova — NSDR, sauna a aktivni regenerace', node_id: 'obnova' },
];

console.log(`\nGeneruji ${topics.length} clanku...`);
const results = await Promise.allSettled(topics.map(async ({ topic, node_id }) => {
  const res = await ai.chat.completions.create({
    model: 'gpt-4o-mini', max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: PROMPT(topic, node_id) }],
  });
  const a = JSON.parse(res.choices[0].message.content);
  const { error } = await sb.from('longevity_articles').insert({
    id: randomUUID(), node_id,
    title: a.title,
    url: `chj://articles/${node_id}/${node_id}-${Date.now()}`,
    summary: a.perex, content: a.content,
    tags: a.tags || [], lang: 'cs', source: 'gpt4o-mini-generated',
  });
  if (error) throw new Error(error.message);
  return `OK [${node_id}] ${a.title}`;
}));

results.forEach(r => console.log(r.status === 'fulfilled' ? r.value : `x ${r.reason?.message}`));

const { data: fa } = await sb.from('longevity_actions').select('node_id');
const { data: fr } = await sb.from('longevity_articles').select('node_id');
console.log(`\nCelkem v DB: ${fa.length} akci, ${fr.length} clanku`);
