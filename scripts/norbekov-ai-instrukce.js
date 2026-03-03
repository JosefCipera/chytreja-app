// norbekov-ai-instrukce.js
// Přidá script_cz a instrukce_ai k Norbekov cvikům v longevity_media.
//
// Spusť PŘED tím: scripts/add-ai-instrukce.sql (v Supabase SQL editoru)
// Spusť PO:      node scripts/norbekov-ai-instrukce.js
//
// Poznámka: pokud znovu spouštíš update-norbekov.js (delete+insert),
// musíš i tento script spustit znovu.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const SOURCE = 'Norbekov – Kloubní Gymnastika';

// ── Vzorový záznam: Želva ─────────────────────────────────────────────────
// Toto je detailní "reference record" – základ pro AI guided mode.
// Ostatní cviky mají zjednodušené instrukce.

const INSTRUKCE = [

  // ── KRČNÍ PÁTEŘ ──────────────────────────────────────────────────────────

  {
    titleMatch: 'Želva',
    script_cz: 'Pomalý předklon hlavy – brada klouže po hrudníku dolů. Bez trhání, bez spěchu. Nejste na závodech F1.',
    instrukce_ai: {
      target:   'cervical_flexion',
      motion:   'flexion',
      rep_type: 'slow',          // slow / alternating / circular / hold
      min_angle: 45,             // stupně od neutrály
      max_angle: 70,
      keypoints: ['ear', 'shoulder', 'chin'],
      side:    'sagittal',       // sagittal / frontal / transversal
      cue_text:  'Bradu na hrudník',
      cue_humor: 'Do krunýře! 🐢',
      feedback: {
        too_shallow: 'Hlouběji – brada chce hrudník.',
        in_range:    'Perfektní, jako opravdová želva.',
        too_deep:    'Stačí, neschovávejte se úplně.',
      },
    },
  },

  {
    titleMatch: 'Záklon hlavy',
    script_cz: 'Pomalu zakloňte hlavu dozadu – bradu vytahujte k nebi. Bez trhnutí.',
    instrukce_ai: {
      target:   'cervical_extension',
      motion:   'extension',
      rep_type: 'slow',
      min_angle: 30,
      max_angle: 60,
      keypoints: ['ear', 'shoulder', 'chin'],
      side:    'sagittal',
      cue_text:  'Bradu k nebi',
      cue_humor: 'Políbíte slunce? ☀️',
      feedback: {
        too_shallow: 'Odvažte se trochu výš.',
        in_range:    'Přesně! Skvělý záklon.',
        too_deep:    'Pozor na krční páteř, nepřehánějte.',
      },
    },
  },

  {
    titleMatch: 'Úklony (Ucho',   // "Úklony (Ucho-Rameno)"
    script_cz: 'Ucho klesá k rameni – rameno zůstává dole. Střídejte strany pomalu.',
    instrukce_ai: {
      target:   'cervical_lateral_flexion',
      motion:   'lateral_flexion',
      rep_type: 'alternating',
      min_angle: 30,
      max_angle: 55,
      keypoints: ['ear', 'shoulder', 'nose'],
      side:    'frontal',
      cue_text:  'Ucho k rameni',
      cue_humor: 'Rameno je stydlivé – nezvedejte ho! 😄',
      feedback: {
        too_shallow: 'Trochu více na stranu.',
        in_range:    'Výborně – ucho a rameno se zdraví.',
        too_deep:    'Opatrně, nepřehánějte stranu.',
      },
    },
  },

  {
    titleMatch: 'Kroužení hlavou',
    script_cz: 'Jemné kroužení hlavou – jako na olejovém polštáři. Bez trhání.',
    instrukce_ai: {
      target:   'cervical_rotation_circle',
      motion:   'circular',
      rep_type: 'circular',
      keypoints: ['ear', 'shoulder', 'nose'],
      side:    'all',
      cue_text:  'Plynulé kruhy hlavou',
      cue_humor: 'Hlava na olejovém polštáři 🌀',
      feedback: {
        too_fast: 'Pomaleji – krk není vrtulka.',
        in_range: 'Skvěle, plynulý pohyb.',
      },
    },
  },

  // ── PÁTEŘ & TUP ──────────────────────────────────────────────────────────

  {
    titleMatch: 'Úklony trupu',
    script_cz: 'Ohýbáme jen horní část těla – jako stromek ve větru. Boky zůstávají na místě.',
    instrukce_ai: {
      target:   'thoracic_lateral_flexion',
      motion:   'lateral_flexion',
      rep_type: 'alternating',
      min_angle: 20,
      max_angle: 45,
      keypoints: ['shoulder', 'hip', 'ear'],
      side:    'frontal',
      cue_text:  'Horní část těla do strany',
      cue_humor: 'Mladý stromek ve větru 🌿',
      feedback: {
        too_shallow: 'Více do strany, uvolněte se.',
        in_range:    'Přesně – boky drží, tělo se ohýbá.',
        too_deep:    'Stačí, neztrácejte boky.',
      },
    },
  },

  {
    titleMatch: 'Rotace hrudníku',
    script_cz: 'Otáčejte horní částí těla – jako byste se dívali za sebe na své úspěchy. Boky drží.',
    instrukce_ai: {
      target:   'thoracic_rotation',
      motion:   'rotation',
      rep_type: 'alternating',
      min_angle: 30,
      max_angle: 60,
      keypoints: ['shoulder', 'hip', 'nose'],
      side:    'transversal',
      cue_text:  'Otočte se za sebe',
      cue_humor: 'Koukáte na své úspěchy! 🏆',
      feedback: {
        too_shallow: 'Trochu více otočit.',
        in_range:    'Výborně – hrudník rotuje.',
        too_deep:    'Nepřehánějte rotaci.',
      },
    },
  },

  // ── PÁNEV & BOKY ─────────────────────────────────────────────────────────

  {
    titleMatch: 'Rotace pánve',
    script_cz: 'Kroužte pánví plynule dokola – jako byste kreslili velký kruh na podlahu.',
    instrukce_ai: {
      target:   'pelvic_rotation',
      motion:   'circular',
      rep_type: 'circular',
      keypoints: ['hip_left', 'hip_right', 'navel'],
      side:    'transversal',
      cue_text:  'Velký kruh pánví',
      cue_humor: 'Kreslíte slunce na podlahu! ☀️',
      feedback: {
        too_small: 'Větší kruhy – uvolněte boky.',
        in_range:  'Skvělé, plynulá rotace.',
      },
    },
  },

  {
    titleMatch: 'Kyčle',
    script_cz: 'Otevřete kyčle pomalu do stran – nohy se přenáší váha. Jako baletka, ale s humorem.',
    instrukce_ai: {
      target:   'hip_external_rotation',
      motion:   'external_rotation',
      rep_type: 'slow',
      min_angle: 30,
      max_angle: 60,
      keypoints: ['knee', 'hip', 'ankle'],
      side:    'frontal',
      cue_text:  'Otevřete kyčle',
      cue_humor: 'Baletka s humorem! 🩰',
      feedback: {
        too_shallow: 'Trochu více ven.',
        in_range:    'Výborně – kyčle jsou volné.',
        too_deep:    'Stačí, nepřehánějte.',
      },
    },
  },

  // ── KOLENA & KOTNÍKY ─────────────────────────────────────────────────────

  {
    titleMatch: 'Kolena',
    script_cz: 'Ruce na kolena, jemné kroužení – jako byste olejovali klouby.',
    instrukce_ai: {
      target:   'knee_circles',
      motion:   'circular',
      rep_type: 'circular',
      keypoints: ['knee', 'hip', 'ankle'],
      side:    'sagittal',
      cue_text:  'Jemné kruhy koleny',
      cue_humor: 'Dlaně na kolena – kolena vám poděkují! 🦵',
      feedback: {
        too_small: 'Větší a plynulejší kruhy.',
        in_range:  'Perfektní – klouby se mazou.',
      },
    },
  },

  {
    titleMatch: 'Kotníky',
    script_cz: 'Nadzvedněte chodidlo a kroužte kotníkem – každá strana zvlášť.',
    instrukce_ai: {
      target:   'ankle_circles',
      motion:   'circular',
      rep_type: 'circular',
      keypoints: ['ankle', 'knee', 'toe'],
      side:    'sagittal',
      cue_text:  'Velké kruhy kotníkem',
      cue_humor: 'Kotník je kloub svobody – dejte mu prostor! 🦶',
      feedback: {
        too_small: 'Větší kruhy.',
        in_range:  'Výborně – kotník se probouzí.',
      },
    },
  },

  // ── MYSL & POSTOJ ────────────────────────────────────────────────────────

  {
    titleMatch: 'Postoj vítěze',
    script_cz: 'Narovnejte se – hlava nahoru, ramena dolů, hrudník vpřed. Postoj mění chemii krve.',
    instrukce_ai: {
      target:   'posture_alignment',
      motion:   'static',
      rep_type: 'hold',
      keypoints: ['ear', 'shoulder', 'hip', 'knee', 'ankle'],
      side:    'sagittal',
      cue_text:  'Narovnejte se jako vítěz',
      cue_humor: 'Postoj vítěze mění chemii krve! 💪',
      feedback: {
        slouching: 'Narovnejte se – hlava výš.',
        in_range:  'Přesně! Takto se vyhrává.',
      },
    },
  },

];

// ── Hlavní průchod ────────────────────────────────────────────────────────

async function run() {
  const { data: records, error } = await sb
    .from('longevity_media')
    .select('id, title')
    .eq('source', SOURCE);

  if (error) {
    console.error('❌ Chyba při načítání:', error.message);
    process.exit(1);
  }

  console.log(`📦 Nalezeno ${records.length} Norbekov záznamů`);
  console.log(`🎯 Instrukce připraveny pro ${INSTRUKCE.length} cviků\n`);

  let ok = 0, skip = 0, fail = 0;

  for (const rec of records) {
    const instrukce = INSTRUKCE.find(i => rec.title.includes(i.titleMatch));

    if (!instrukce) {
      process.stdout.write(`  ⏭️  ${rec.title.slice(0, 55)}\n`);
      skip++;
      continue;
    }

    const { error: updErr } = await sb
      .from('longevity_media')
      .update({
        script_cz:    instrukce.script_cz,
        instrukce_ai: instrukce.instrukce_ai,
      })
      .eq('id', rec.id);

    if (updErr) {
      console.log(`  ❌ ${rec.title.slice(0, 55)} – ${updErr.message}`);
      fail++;
    } else {
      console.log(`  ✅ ${rec.title.slice(0, 55)}`);
      ok++;
    }
  }

  console.log(`\n✅ Aktualizováno: ${ok}  ⏭️  Přeskočeno: ${skip}  ❌ Chyby: ${fail}`);

  if (ok > 0) {
    console.log('\n💡 Příště spusť po update-norbekov.js, aby se AI instrukce neztrácely.');
  }
}

run();
