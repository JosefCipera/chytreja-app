<script>
  import HudPanel from './lib/components/HudPanel.svelte';
  import { calcVitality } from './lib/utils/vitality.js';

  // Simulate real child indices (from user_metrics)
  const childIndices = { telo: 27, zdravi: 35, mysl: 90, vyziva: 90 };

  // Simulate spánek + výživa indices for REPAIR_RATE calculation (Attia anabolism)
  const metrics = { spanek: 30, vyziva: 90 }; // spanek RED, vyziva GREEN

  // Simulate user profile + available biomarkers (determines BIO_AGE confidence)
  // Tier 1 only (onboarding filled) → EST_BIO_AGE, ~20% confidence
  const userTier1 = {
    chrono_age: 38,
    bio_available_keys: ['bmi', 'resting_hr_manual', 'sleep_hours', 'activity_level', 'smoking', 'alcohol'],
  };
  // Tier 1 + wearable (HRV + VO₂max + sleep quality) → REF_BIO_VEK, ~55% confidence
  // Biomarkers: reálné hodnoty → calcBioAgeDeltaFromMarkers (ne proxy)
  const userTier2 = {
    chrono_age: 38,
    bio_available_keys: ['bmi', 'resting_hr_manual', 'sleep_hours', 'activity_level', 'smoking', 'alcohol',
                         'hrv', 'vo2max', 'sleep_quality', 'steps_neat'],
    // Testovací hodnoty — "průměrný 38letý sedavý člověk"
    biomarkers: {
      rhr:          72,    // nad optimem (57) → +3 roky
      hrv:          28,    // pod optimem pro 38 let (~67ms) → +4 roky
      glucose:     105,    // pre-diabetické pásmo → +3 roky
      systolic:    128,    // lehce zvýšený → +2 roky
      waist_height: 0.54,  // nad optimem (0.47) → +2 roky
    },
  };

  // Hra o život — parent node
  const hlavniUzel = {
    node_id: 'dlouhovekost',
    node_label: 'Hra o život',
    node_version: 'v0.1',
    life_battery: {
      // Weighted vitality: 27×0.5 + 35×0.25 + 90×0.15 + 90×0.10 = 44.75 → 45%
      percent: calcVitality(childIndices),
      trend: 'down',
      trend_label: 'DOWN',
      repair_rate: 0.7,
      cell_vitality: calcVitality(childIndices),
    },
    killer: {
      id: 'kardio',
      label: 'SRDCE',
      energy_drain: -8,
      description: 'Srdce potřebuje pohyb.',
    },
    action: {
      id: 'plank_60s',
      label: 'Drž plank 60 sekund',
      icon: '🏋️',
      type: 'timed',
      duration: 60,
      status: 'READY',
      tier: 1,
    },
    sources: [
      { med_id: 104, type: 'STUDY', title: 'Resistance Training and Cardiovascular Health', journal: 'Nature Medicine', year: 2023, status: 'VERIFIED' },
      { med_id: 88, type: 'REVIEW', title: 'Cortisol Regulation via Breathwork', journal: 'Journal of Neuroscience', year: 2024, status: 'AUTHENTICATED' },
    ],
    verdict: 'Tělo a zdraví brzdí.',
    metrics,
    user: userTier2,  // wearable connected → REF_BIO_AGE ~55%
  };

  // Tělo — leaf node, percent = vlastní current_index
  const teloUzel = {
    node_id: 'telo',
    node_label: 'Tělo',
    node_version: 'v0.1',
    life_battery: {
      percent: childIndices.telo,  // 27 — přímo z user_metrics
      trend: 'down',
      trend_label: 'DOWN',
      repair_rate: 0.8,
      cell_vitality: childIndices.telo,
    },
    killer: {
      id: 'kardio',
      label: 'SRDCE',
      energy_drain: -8,
      description: 'Srdce potřebuje pohyb.',
    },
    action: {
      id: 'plank_60s',
      label: 'Drž plank 60 sekund',
      icon: '🏋️',
      type: 'timed',
      duration: 60,
      status: 'READY',
      tier: 1,
    },
    sources: [
      { med_id: 104, type: 'STUDY', title: 'Resistance Training and Cardiovascular Health', journal: 'Nature Medicine', year: 2023, status: 'VERIFIED' },
    ],
    verdict: 'Tělo ztrácí sílu.',
    metrics,
    user: userTier1,  // onboarding only → EST_BIO_AGE ~20%
  };

  let activeNode = $state('hlavni'); // 'hlavni' | 'telo'
  let nodeData = $derived(activeNode === 'hlavni' ? hlavniUzel : teloUzel);
</script>

<div class="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 hud-grid gap-4">
  <!-- Ambient glow -->
  <div class="fixed top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none"></div>

  <HudPanel data={nodeData}>
    <!-- Dev switcher slot — remove in production -->
    <div class="flex gap-2 px-4 pb-3">
      {#each [['hlavni','Hra o život'],['telo','Tělo']] as [id, label]}
        <button
          onclick={() => activeNode = id}
          class="hud-mono text-[10px] px-2.5 py-1 rounded border transition-all cursor-pointer {activeNode === id
            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
            : 'border-white/10 bg-white/[0.03] text-slate-600 hover:text-slate-400'}"
        >{label}</button>
      {/each}
    </div>
  </HudPanel>
</div>
