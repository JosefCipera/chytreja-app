/**
 * insert-decathlon-media.js
 * Inserts audio + video content for 11 decathlon child nodes.
 * Run: node scripts/insert-decathlon-media.js
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MEDIA = [
  // ── SÍLA ──────────────────────────────────────────────────────────────────
  {
    node_id: 'sila',
    type: 'video',
    title: 'Věda o růstu svalů, síle a regeneraci',
    url: 'https://www.youtube.com/watch?v=XLr2RKoD-oY',
    description: 'Huberman Lab #22 – jak nervový systém řídí svaly, protokoly pro hypertrofii a sílu.',
    source: 'Huberman Lab',
    duration_min: 97,
  },
  {
    node_id: 'sila',
    type: 'audio',
    title: 'Silový trénink, kardio a výživa pro maximální výsledky',
    url: 'https://traffic.megaphone.fm/SCIM6891280189.mp3?updated=1771224091',
    description: 'Dr. Lauren Colenso-Semple o efektivních protokolech pro sílu, svalovou hmotu a kondici.',
    source: 'Huberman Lab Podcast',
    duration_min: 115,
  },

  // ── VÝDRŽ (Vytrvalost) ────────────────────────────────────────────────────
  {
    node_id: 'vytrvalost',
    type: 'video',
    title: 'Jak budovat vytrvalost a zlepšit spalování tuku',
    url: 'https://www.youtube.com/watch?v=oNkDA2F7CjM',
    description: 'Dr. Andy Galpin – svalová vytrvalost, aerobní kapacita, VO2max, laktátový práh.',
    source: 'Huberman Lab Guest Series',
    duration_min: 170,
  },

  // ── MOBILITA ──────────────────────────────────────────────────────────────
  {
    node_id: 'mobilita',
    type: 'video',
    title: 'Jak zlepšit pohyblivost vědeckými protokoly',
    url: 'https://www.youtube.com/watch?v=tkH2-_jMCSk',
    description: 'Huberman Lab #76 – neurověda flexibility, protokoly statického strečinku pro ROM.',
    source: 'Huberman Lab',
    duration_min: 83,
  },
  {
    node_id: 'mobilita',
    type: 'audio',
    title: 'Věda a praxe pohybu – Ido Portal',
    url: 'https://traffic.megaphone.fm/SCIM7334257872.mp3?updated=1770860133',
    description: 'Ido Portal o pohybu jako praxi, mobilitě a přirozených pohybových vzorech.',
    source: 'Huberman Lab Essentials',
    duration_min: 32,
  },

  // ── STABILITA ─────────────────────────────────────────────────────────────
  {
    node_id: 'stabilita',
    type: 'video',
    title: 'Jak hodnotit a zlepšit všechny aspekty fyzické kondice',
    url: 'https://www.youtube.com/watch?v=zEYE-vcVKy8',
    description: 'Dr. Andy Galpin – 9 typů pohybových adaptací, testy kondice včetně stability a core.',
    source: 'Huberman Lab Guest Series',
    duration_min: 155,
  },

  // ── ROVNOVÁHA ─────────────────────────────────────────────────────────────
  {
    node_id: 'rovnovaha',
    type: 'video',
    title: 'Rovnováha, pohyb a jak se učit rychleji',
    url: 'https://www.youtube.com/watch?v=hx3U64IXFOY',
    description: 'Huberman Lab – vestibulární systém, role chyb a pohybu v neuroplasticitě a rovnováze.',
    source: 'Huberman Lab',
    duration_min: 68,
  },

  // ── KARDIO ────────────────────────────────────────────────────────────────
  {
    node_id: 'kardio',
    type: 'video',
    title: 'Jak budovat kardiovaskulární vytrvalost – 4 typy tréninku',
    url: 'https://www.youtube.com/watch?v=7MEhDlw1e9k',
    description: 'Huberman Lab Essentials – svalová vytrvalost, aerobní zóny, anaerobní intervaly, VO2max.',
    source: 'Huberman Lab Essentials',
    duration_min: 30,
  },

  // ── SPÁNEK ────────────────────────────────────────────────────────────────
  {
    node_id: 'spanek',
    type: 'video',
    title: 'Věda a praxe dokonalého spánku',
    url: 'https://www.youtube.com/watch?v=gbQFSMayJxk',
    description: 'Dr. Matthew Walker + Huberman – fáze spánku, doporučení pro kvalitu a délku, chronotypy.',
    source: 'Huberman Lab #31',
    duration_min: 211,
  },

  // ── STRES ─────────────────────────────────────────────────────────────────
  {
    node_id: 'stres',
    type: 'video',
    title: 'Nástroje pro zvládání stresu a úzkosti',
    url: 'https://www.youtube.com/watch?v=ntfcfJ28eiU',
    description: 'Huberman Lab #10 – fyziologie stresu, krátkodobý vs. chronický stres, praktické techniky.',
    source: 'Huberman Lab',
    duration_min: 80,
  },

  // ── METABOLICKÉ ZDRAVÍ ────────────────────────────────────────────────────
  {
    node_id: 'metabolicke',
    type: 'video',
    title: 'Metabolické zdraví, hormony a regulace krevního cukru',
    url: 'https://www.youtube.com/watch?v=8qaBpM73NSk',
    description: 'Dr. Casey Means – mitochondriální dysfunkce, inzulínová rezistence, CGM a intervence.',
    source: 'Huberman Lab #175',
    duration_min: 185,
  },

  // ── NERVOVÝ SYSTÉM ────────────────────────────────────────────────────────
  {
    node_id: 'nervovy_system',
    type: 'video',
    title: 'Jak trénovat mozek na změnu – neuroplasticita a fokus',
    url: 'https://www.youtube.com/watch?v=LG53Vxum0as',
    description: 'Huberman Lab #6 – jak pozornost spouští plasticity mozku, acetylcholin, dopamin.',
    source: 'Huberman Lab',
    duration_min: 75,
  },
  {
    node_id: 'nervovy_system',
    type: 'audio',
    title: 'Věda o učení a paměti',
    url: 'https://traffic.megaphone.fm/SCIM5564931565.mp3?updated=1769405666',
    description: 'Dr. David Eagleman – neuroplasticita, jak mozek kóduje vzpomínky a jak se efektivněji učit.',
    source: 'Huberman Lab Podcast',
    duration_min: 165,
  },

  // ── IMUNITNÍ ROVNOVÁHA ────────────────────────────────────────────────────
  {
    node_id: 'imunitni',
    type: 'video',
    title: 'Kortizol a adrenalin: energie, imunita a výkon',
    url: 'https://www.youtube.com/watch?v=JPX8g8ibKFc',
    description: 'Huberman Lab #18 – kortizol jako imunitní a energetický regulátor, ranní světlo, cold exposure.',
    source: 'Huberman Lab',
    duration_min: 77,
  },
];

async function run() {
  console.log(`\nInserting ${MEDIA.length} media records for decathlon nodes...\n`);
  let ok = 0, fail = 0;

  for (const item of MEDIA) {
    const { error } = await sb.from('longevity_media').insert({
      node_id: item.node_id,
      type: item.type,
      title: item.title,
      url: item.url,
      summary: item.description,
      source: item.source,
      duration_min: item.duration_min,
    });

    if (error) {
      console.error(`  ❌ ${item.node_id} (${item.type}) – ${error.message}`);
      fail++;
    } else {
      console.log(`  ✅ ${item.node_id} | ${item.type} | ${item.title.substring(0, 50)}`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} inserted, ${fail} failed.\n`);
}

run();
