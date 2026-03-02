// insert-norbekov.js – vloží celé video + 22 cviků Norbekova do longevity_media
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const VIDEO_ID = '61sAOYmr0wE';

const NODE_MAP = {
  POHYB:  'mobilita',
  STABIL: 'stabilita',
  KARDIO: 'kardio',
  MYSL:   'mysl',
};

// MM:SS nebo HH:MM:SS (Excel artifact) → sekundy
function toSec(ts) {
  const parts = ts.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1]; // 24:00:00 → 24 min
  return parts[0] * 60 + parts[1];
}

function durMin(start, end) {
  return Math.max(1, Math.round((toSec(end) - toSec(start)) / 60));
}

const EXERCISES = [
  { uzel: 'MYSL',   nazev: 'Postoj vítěze',          start: '0:30',  konec: '1:00',  vhled: 'Narovnejte se! Postoj vítěze mění chemii krve.' },
  { uzel: 'MYSL',   nazev: 'Vnitřní úsměv',           start: '1:05',  konec: '1:50',  vhled: 'Úsměv je příkaz buňkám k regeneraci. Nenasazujte masku mramorové sochy!' },
  { uzel: 'POHYB',  nazev: 'Zápěstí a prsty',          start: '2:15',  konec: '3:00',  vhled: 'Prsty jako vějíř. Každý kloub je důležitý.' },
  { uzel: 'POHYB',  nazev: 'Želva – krční páteř',      start: '3:40',  konec: '4:20',  vhled: 'Brada do krunýře. Pomalu, nejste na závodech F1!' },
  { uzel: 'POHYB',  nazev: 'Záklon hlavy',             start: '4:25',  konec: '4:55',  vhled: 'Vytahujeme bradu k nebi, jako byste chtěli políbit slunce.' },
  { uzel: 'POHYB',  nazev: 'Úklony – ucho k ramenu',   start: '5:15',  konec: '6:00',  vhled: 'Ucho chce políbit rameno. Ale rameno je stydlivé, nezvedejte ho!' },
  { uzel: 'POHYB',  nazev: 'Kroužení hlavou',          start: '6:10',  konec: '7:00',  vhled: 'Jemně, jako by hlava byla na olejovém polštáři.' },
  { uzel: 'KARDIO', nazev: 'Kroužení rameny',          start: '8:10',  konec: '8:50',  vhled: 'Z lopatek rostou křídla. Otevíráme hrudník pro život!' },
  { uzel: 'KARDIO', nazev: 'Propínání ramen',          start: '9:00',  konec: '9:40',  vhled: 'Ramena dopředu, jako byste se chtěli obejmout kolem světa.' },
  { uzel: 'POHYB',  nazev: 'Lokty k sobě',             start: '10:15', konec: '10:50', vhled: 'Spojujeme lokty za zády. Lopatky si mají co šeptat.' },
  { uzel: 'POHYB',  nazev: 'Úklony trupu – horní',     start: '11:15', konec: '12:00', vhled: 'Ohýbáme jen horní část, jako mladý stromek ve větru.' },
  { uzel: 'POHYB',  nazev: 'Rotace hrudníku',          start: '12:15', konec: '13:00', vhled: 'Díváme se za sebe na své úspěchy. Boky drží!' },
  { uzel: 'POHYB',  nazev: 'Úklony do stran',          start: '13:30', konec: '14:15', vhled: 'Ruka klouže po stehně. Hlouběji, s radostí!' },
  { uzel: 'STABIL', nazev: 'Rotace pánve',             start: '15:00', konec: '15:45', vhled: 'Kroužíme pánví, jako bychom kreslili slunce na podlahu.' },
  { uzel: 'POHYB',  nazev: 'Předklon – bedra',         start: '16:15', konec: '17:00', vhled: 'Ruce ke špičkám. Ne silou, ale dechem a úsměvem.' },
  { uzel: 'POHYB',  nazev: 'Záklon – bedra',           start: '17:15', konec: '17:50', vhled: 'Podepřete si kříže a podívejte se do nebe. Svoboda!' },
  { uzel: 'POHYB',  nazev: 'Protažení nohou',          start: '18:20', konec: '19:00', vhled: 'Pata tlačí do země. Probouzíme energii v drahách.' },
  { uzel: 'POHYB',  nazev: 'Kotníky – kroužení',       start: '19:30', konec: '20:10', vhled: 'Kotník je kloub svobody. Dejte mu prostor.' },
  { uzel: 'POHYB',  nazev: 'Kolena – kroužení',        start: '20:30', konec: '21:15', vhled: 'Dlaně na kolena, jemná masáž a kroužky.' },
  { uzel: 'STABIL', nazev: 'Kyčle – rotace',           start: '21:30', konec: '22:15', vhled: 'Otevíráme brány kyčlí. Jako baletka, ale s humorem.' },
  { uzel: 'MYSL',   nazev: 'Závěrečné zklidnění',      start: '23:00', konec: '23:45', vhled: 'Cítíte to teplo? To je vaše nová krev a síla.' },
  { uzel: 'KARDIO', nazev: 'Hrudní pumpa',             start: '24:00', konec: '24:30', vhled: 'Nadechněte se až do břicha. Jste naživu!' },
];

const records = [
  // Celé video
  {
    node_id:      'mobilita',
    title:        'Norbekov – Kloubní Gymnastika (celé video)',
    type:         'video',
    url:          `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    summary:      'Kompletní kloubní gymnastika od hlavy po chodidla. Ideální ranní rutina – 25 minut.',
    tags:         ['norbekov', 'klouby', 'celé video', 'ranní rutina'],
    lang:         'cs',
    duration_min: 25,
    source:       'Norbekov – Kloubní Gymnastika',
  },
  // Jednotlivé cviky
  ...EXERCISES.map(ex => ({
    node_id:      NODE_MAP[ex.uzel],
    title:        `Norbekov – ${ex.nazev}`,
    type:         'video',
    url:          `https://www.youtube.com/watch?v=${VIDEO_ID}&t=${toSec(ex.start)}s`,
    summary:      ex.vhled,
    tags:         ['norbekov', 'klouby', NODE_MAP[ex.uzel]],
    lang:         'cs',
    duration_min: durMin(ex.start, ex.konec),
    source:       'Norbekov – Kloubní Gymnastika',
  })),
];

async function run() {
  console.log(`📦 Připraveno ${records.length} záznamů (1 celé video + ${EXERCISES.length} cviků)`);

  const { data, error } = await sb
    .from('longevity_media')
    .insert(records)
    .select('id, node_id, title');

  if (error) {
    console.error('❌ Chyba:', error.message);
    process.exit(1);
  }

  console.log(`✅ Vloženo ${data.length} záznamů:`);
  data.forEach(r => console.log(`  [${r.node_id}] ${r.title}`));
}

run();
