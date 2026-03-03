// update-norbekov.js  v2
// Smaže staré Norbekov záznamy a vloží nové z dat XLSX souborů.
//
// Zdrojová data (přečtena z XLSX, zde hardcoded):
//   - Norbekov cvičení pro Supabase.xlsx         (17 cviků)
//   - Norbekovovy cviky pro páteř v Supabase.xlsx (5 páteřních cviků)
//   - AI kontrola cvičení Norbekova v demu.xlsx   (instrukce_ai pro 4 cviky)
//   - Norbekovův úvod a implementace systému.xlsx  (5 úvodních segmentů)
//
// Spuštění: node scripts/update-norbekov.js

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const VIDEO_ID = 'ARZkhlxoqYY';
const SOURCE   = 'Norbekov – Kloubní Gymnastika';

const NODE_MAP = {
  POHYB:  'mobilita',
  STABIL: 'stabilita',
  KARDIO: 'kardio',
  MYSL:   'mysl',
};

// ── Parser časů ───────────────────────────────────────────────────────────

// "MM:SS" → sekundy
function parseSec(str) {
  const [m, s] = str.trim().split(':').map(Number);
  return m * 60 + (s || 0);
}

// "MM:SS – MM:SS" → { startSec, durMin }
function parseTiming(str) {
  const [startStr, endStr] = str.split('–').map(s => s.trim());
  const startSec = parseSec(startStr);
  const endSec   = parseSec(endStr);
  const durMin   = Math.max(1, Math.round((endSec - startSec) / 60));
  return { startSec, durMin };
}

// Excel časový zlomek → sekundy
function excelToSec(v) {
  return Math.round(v * 86400);
}

// ── AI instrukce (ze souboru "AI kontrola cvičení Norbekova v demu") ──────

const AI_INSTRUKCE = {
  NB_12: {
    target:    'cervical_flexion',
    motion:    'flexion',
    min_angle: 45,
    max_angle: 70,
    keypoints: ['ear', 'shoulder', 'chin'],
    desc:      'Flexe krční páteře (45°–70°). Hlídá, aby ramena zůstala v klidu.',
    feedback: {
      too_shallow: 'Hlouběji – brada chce hrudník.',
      in_range:    'Perfektní, jako opravdová želva.',
      too_deep:    'Stačí, neschovávejte se úplně.',
    },
    cue_humor: 'Do krunýře! 🐢',
  },
  NB_17: {
    target:     'thoracic_rotation',
    motion:     'rotation',
    keypoints:  ['hips', 'shoulders', 'eyes'],
    constraint: { pelvic_angle_max: 10 },
    desc:       'Torze hrudníku. Hlídá fixaci pánve (úhel pánve < 10° při rotaci ramen).',
    feedback: {
      pelvis_moving: 'Boky drží! Rotuje jen hrudník.',
      in_range:      'Výborně – páteř se raduje.',
    },
    cue_humor: 'Díváte se na své budoucí úspěchy! 🏆',
  },
  NB_06: {
    target:    'shoulder_rotation',
    motion:    'circular',
    keypoints: ['elbows', 'shoulders', 'wrist'],
    metric:    'amplitude_and_rhythm',
    desc:      'Amplituda pohybu ramen. Sleduje plynulost a rytmus (tepová odezva).',
    feedback: {
      too_small: 'Větší kruhy – z lopatek rostou křídla.',
      in_range:  'Skvěle, rytmus je váš!',
    },
    cue_humor: 'Z lopatek rostou křídla! 🦋',
  },
  NB_22: {
    target:    'posture_and_breathing',
    motion:    'static',
    keypoints: ['nose', 'chest', 'belly'],
    metric:    'vertical_axis_and_breath_depth',
    desc:      'Vertikální osa páteře. Sleduje hloubku nádechu (pohyb hrudníku/břicha).',
    feedback: {
      shallow_breath: 'Dýchejte hlouběji, až do břicha.',
      in_range:       'Výborně – klid a síla.',
    },
    cue_humor: 'Naplňte se klidem jako nádoba světlem. ✨',
  },
};

// ── Cviky (main + páteřní, seřazeny podle NB ID) ─────────────────────────
// Zdroj: Norbekov cvičení pro Supabase.xlsx + Norbekovovy cviky pro páteř v Supabase.xlsx

const CVIKY = [
  // ── MYSL ──
  {
    id: 'NB_01', uzel: 'MYSL', timing: '00:30 – 01:00',
    nazev: 'Postoj vítěze',
    script_cz: 'Narovnejte se! Postoj vítěze mění vaši chemii. Teď začíná vaše nová kapitola.',
  },
  // ── RUKY & RAMENA ──
  {
    id: 'NB_02', uzel: 'KARDIO', timing: '08:07 – 09:30',
    nazev: 'Masáž uší',
    script_cz: 'Probuďte celé tělo přes uši! Tahejte je nahoru, dolů a dozadu. Úsměv u toho není povinný, ale bez něj to nefunguje.',
  },
  {
    id: 'NB_03', uzel: 'POHYB', timing: '09:41 – 10:30',
    nazev: 'Prsty – vějíř',
    script_cz: 'Prsty jako vějíř. Každý článek musí ožít. Vyháníme tuhost a vracíme do dlaní sílu.',
  },
  {
    id: 'NB_04', uzel: 'POHYB', timing: '10:33 – 11:30',
    nazev: 'Zápěstí – kroužení',
    script_cz: 'Zápěstí je brána energie. Kroužíme plynule, jako bychom kreslili osmičky ve vzduchu.',
  },
  {
    id: 'NB_05', uzel: 'POHYB', timing: '11:33 – 12:05',
    nazev: 'Lokty – rotace',
    script_cz: 'Představte si, že lokty jsou promazané nejlepším olejem. Ramena stojí, lokty tančí.',
  },
  {
    id: 'NB_06', uzel: 'KARDIO', timing: '12:08 – 13:00',
    nazev: 'Kroužení pažemi',
    script_cz: 'Rozmáchlá křídla! Otevíráme hrudník pro život. Každý nádech vás nabíjí optimismem.',
  },
  {
    id: 'NB_07', uzel: 'KARDIO', timing: '13:03 – 14:10',
    nazev: 'Ramena – hrdost',
    script_cz: 'Ramena dopředu a pak lopatky k sobě. Narovnejte se, jste vítězové své vlastní cesty!',
  },
  // ── NOHY & KYČLE ──
  {
    id: 'NB_08', uzel: 'POHYB', timing: '15:04 – 16:55',
    nazev: 'Kotníky – špička/pata',
    script_cz: 'Noha je váš základ. Protáhněte špičku, pak patu. Cítíte tu radost v lýtkách?',
  },
  {
    id: 'NB_09', uzel: 'POHYB', timing: '17:01 – 18:35',
    nazev: 'Kolena – kroužení',
    script_cz: 'Dlaně na kolena a jemně masírujte. Posíláme kloubům jaro a lásku.',
  },
  {
    id: 'NB_10', uzel: 'STABIL', timing: '18:41 – 20:50',
    nazev: 'Kyčle – brána',
    script_cz: 'Otevíráme brány kyčlí. Jako baletka, ale s humorem. Držte rovnováhu a vnitřní sílu.',
  },
  {
    id: 'NB_11', uzel: 'POHYB', timing: '21:00 – 22:10',
    nazev: 'Chůze na hranách',
    script_cz: 'Hrajte si jako děti! Chvilku po patách, pak po hranách. Probouzíme celé chodidlo.',
  },
  // ── PÁTEŘ – KRČNÍ ──  (ze souboru páteř)
  {
    id: 'NB_12', uzel: 'POHYB', timing: '22:38 – 23:25',
    nazev: 'Krční páteř – Želva',
    script_cz: 'Bradu do krunýře! 🐢 Nerotujte hlavou, jen ji plynule zasouvejte k hrudníku. Norbekov: „Nebuďte mramorová socha, usmívejte se na své obratle!"',
  },
  {
    id: 'NB_13', uzel: 'POHYB', timing: '23:28 – 23:45',
    nazev: 'Krční páteř – Záklon (Vstříc nebi)',
    script_cz: 'Brada směřuje k nebi. Představte si, že chcete políbit slunce. Žádná křeč v šíji, jen lehkost a radost z pohybu.',
  },
  {
    id: 'NB_14', uzel: 'POHYB', timing: '23:48 – 24:15',
    nazev: 'Krční páteř – Úklony (Ucho k rameni)',
    script_cz: 'Ucho chce políbit rameno. Ale pozor, ramena jsou stydlivá, musí zůstat dole! Cítíte ten tah? To se vaše páteř probouzí k životu.',
  },
  // ── PÁTEŘ – KRČNÍ (rotace) ──  (z main souboru)
  {
    id: 'NB_15', uzel: 'POHYB', timing: '25:35 – 26:00',
    nazev: 'Krk – rotace (Sova)',
    script_cz: 'Pomalý pohled za rameno. Vidíte tam svou skvělou budoucnost? Ještě kousek dál!',
  },
  // ── PÁTEŘ – HRUDNÍ ──  (ze souboru páteř)
  {
    id: 'NB_16', uzel: 'KARDIO', timing: '27:00 – 28:30',
    nazev: 'Hrudní páteř – Luk',
    script_cz: 'Prohněte se jako luk připravený k výstřelu. Ruce v zámku, brada na prsa. Roztáhněte lopatky a dýchejte do nich novou sílu.',
  },
  {
    id: 'NB_17', uzel: 'STABIL', timing: '28:33 – 29:15',
    nazev: 'Hrudní páteř – Spirála (Rotace trupu)',
    script_cz: 'Díváme se za sebe na své budoucí úspěchy. Oči vedou pohyb, tělo následuje. Boky drží jako skála, rotuje jen radost v páteři!',
  },
  // ── BEDRA & ZÁDA ──  (z main souboru)
  {
    id: 'NB_18', uzel: 'STABIL', timing: '31:50 – 33:00',
    nazev: 'Bedra – Kočka',
    script_cz: 'Pánev dopředu a dozadu. Rozhýbejte svůj střed vesmíru. Uvolňujeme napětí v kříži.',
  },
  // ── ZÁVĚR ──
  {
    id: 'NB_19', uzel: 'POHYB', timing: '34:45 – 35:10',
    nazev: 'Úklony – protažení',
    script_cz: 'Jedna ruka k nebi, úklon. Cítíte, jak se bok nadechuje? Vychutnejte si tu délku.',
  },
  {
    id: 'NB_20', uzel: 'KARDIO', timing: '35:11 – 35:35',
    nazev: 'Vibrace – kapiláry',
    script_cz: 'Protřepat, nemíchat! 🍸 Vyklepejte ze sebe všechen stres a únavu dnešního dne.',
  },
  {
    id: 'NB_21', uzel: 'POHYB', timing: '35:36 – 38:40',
    nazev: 'Celková spirála',
    script_cz: 'Zatočte se jako šroub od hlavy až k patám. Celá páteř v jedné radostné spirále.',
  },
  {
    id: 'NB_22', uzel: 'MYSL', timing: '38:42 – 41:20',
    nazev: 'Závěrečný klid',
    script_cz: 'Zavřete oči. Naplňte se klidem a sílou. Jste připraveni na vše, co přijde.',
  },
];

// ── Úvodní segmenty (Norbekovův úvod a implementace systému.xlsx) ─────────
// Excel time fractions × 86400 = sekundy
const UVOD_SEGMENTY = [
  {
    startSec: excelToSec(0.0009490740740740741),
    nazev: 'Úvod – Není to tělocvik',
    script_cz: 'Tohle není ranní rozcvička. Jsou to speciální pohyby, které vrací ploténkám život a vaší chůzi lehkost baletky.',
  },
  {
    startSec: excelToSec(0.0018865740740740742),
    nazev: 'Úvod – 99 % vs. 1 %',
    script_cz: 'Technika tvoří jen 1 % úspěchu. Zbylých 99 % je váš vnitřní stav. Pokud se u cvičení nudíte, marníte čas.',
  },
  {
    startSec: excelToSec(0.002685185185185185),
    nazev: 'Úvod – Věk je jen výmluva',
    script_cz: 'Je vám devět nebo devadesát? Na tom nezáleží. Pružnost páteře se obnovuje v každém věku úplně stejně.',
  },
  {
    startSec: excelToSec(0.003125),
    nazev: 'Úvod – Lidská líná nátura',
    script_cz: 'Lenost je sluha smrti. Nečekejte, až vás tělo úplně zradí. Rozhýbejte se teď, dokud máte volbu.',
  },
  {
    startSec: excelToSec(0.0043055555555555555),
    nazev: 'Úvod – Nácvik radosti',
    script_cz: 'Uměle vytvořte pocit radosti. Uvolněte ramena, rozjasněte tvář. Cítíte ten příval energie? V tomhle stavu budeme cvičit.',
  },
];

// ── Sestavení records ─────────────────────────────────────────────────────

function buildRecords() {
  const records = [];

  // 1. Celé video
  records.push({
    node_id:      'mobilita',
    title:        'Norbekov – Kloubní Gymnastika (celé video)',
    type:         'video',
    url:          `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    summary:      'Kompletní kloubní gymnastika od hlavy po chodidla. Ideální ranní rutina.',
    script_cz:    'Kompletní kloubní gymnastika od hlavy po chodidla. Ideální ranní rutina.',
    instrukce_ai: null,
    tags:         ['norbekov', 'klouby', 'ranní-rutina', 'mobilita'],
    lang:         'cs',
    duration_min: 42,
    source:       SOURCE,
  });

  // 2. Cviky (NB_01 – NB_22)
  for (const cv of CVIKY) {
    const { startSec, durMin } = parseTiming(cv.timing);
    const nodeId = NODE_MAP[cv.uzel] || 'mobilita';

    records.push({
      node_id:      nodeId,
      title:        `Norbekov – ${cv.nazev}`,
      type:         'video',
      url:          `https://www.youtube.com/watch?v=${VIDEO_ID}&t=${startSec}s`,
      summary:      cv.script_cz,
      script_cz:    cv.script_cz,
      instrukce_ai: AI_INSTRUKCE[cv.id] || null,
      tags:         ['norbekov', 'klouby', nodeId],
      lang:         'cs',
      duration_min: durMin,
      source:       SOURCE,
    });
  }

  // 3. Úvodní segmenty (filozofie)
  for (const seg of UVOD_SEGMENTY) {
    records.push({
      node_id:      'mysl',
      title:        `Norbekov – ${seg.nazev}`,
      type:         'video',
      url:          `https://www.youtube.com/watch?v=${VIDEO_ID}&t=${seg.startSec}s`,
      summary:      seg.script_cz,
      script_cz:    seg.script_cz,
      instrukce_ai: null,
      tags:         ['norbekov', 'mysl', 'filosofie', 'motivace'],
      lang:         'cs',
      duration_min: 1,
      source:       SOURCE,
    });
  }

  return records;
}

// ── Hlavní průchod ────────────────────────────────────────────────────────

async function run() {
  const records = buildRecords();

  // 1. Smaž staré záznamy
  console.log('🗑️  Mažu staré Norbekov záznamy…');
  const { error: delErr, count } = await sb
    .from('longevity_media')
    .delete({ count: 'exact' })
    .eq('source', SOURCE);

  if (delErr) {
    console.error('❌ Chyba při mazání:', delErr.message);
    process.exit(1);
  }
  console.log(`   Smazáno: ${count ?? '?'} záznamů`);

  // 2. Vlož nové
  const cvCount   = CVIKY.length;
  const uvodCount = UVOD_SEGMENTY.length;
  console.log(`📦 Vkládám ${records.length} záznamů:`);
  console.log(`   1 celé video + ${cvCount} cviků + ${uvodCount} úvodních segmentů`);
  console.log(`   ✨ AI instrukce: ${Object.keys(AI_INSTRUKCE).join(', ')}`);

  const { data, error: insErr } = await sb
    .from('longevity_media')
    .insert(records)
    .select('id, node_id, title, url, instrukce_ai');

  if (insErr) {
    console.error('❌ Chyba při vkládání:', insErr.message);
    process.exit(1);
  }

  console.log(`\n✅ Vloženo ${data.length} záznamů:\n`);
  for (const r of data) {
    const t   = new URL(r.url).searchParams.get('t') || '(celé)';
    const ai  = r.instrukce_ai ? ' 🤖' : '';
    console.log(`  [${r.node_id.padEnd(10)}] ${r.title.slice(0, 52).padEnd(52)}  t=${t}${ai}`);
  }
}

run();
