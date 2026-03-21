// === GAME ENGINE — hardcoded verdicts, killers, riders, demo data ===

// =====================================================
// DEMO PREVIEWS – non-black-box texty pro locked uzly
// =====================================================

export const DEMO_PREVIEWS = {
  dychani:          { vhled_1: '„Dech je jediný most k tvému nervovému systému, který můžeš ovládat."',                              doplneni: 'Trénink dechové koherence pro okamžité snížení stresu.',                                      napojeni: '📡 Mobilní mikrofon / Hrudní pás' },
  kardio:           { vhled_1: '„Rozproudění krve je ta nejrychlejší detoxikace pro tvé srdce."',                                    doplneni: 'Jak rychle se tvůj tep vrací do klidu po ranním cvičení.',                                    napojeni: '📡 Apple Health / Garmin' },
  rovnovaha:        { vhled_1: '„Kdo pevně stojí, ten se jen tak nezhroutí."',                                                       doplneni: 'Test tvé vnitřní stability a reakčního času pro jistý krok.',                                 napojeni: '📡 Gyroskop v mobilu' },
  nosni_dychani:    { vhled_1: '„Nos je pro dýchání, ústa pro mluvení; filtruj život správnou cestou."',                             doplneni: 'Podíl dýchání nosem během dne i v noci pro lepší okysličení.',                                napojeni: '📡 Oura (SpO2) / Audio analýza' },
  dechova_koherence:{ vhled_1: '„Synchronizuj svůj dech se srdcem a najdi vnitřní rytmus klidu."',                                  doplneni: 'Variabilita srdečního tepu (HRV) v přímé vazbě na rytmus dechu.',                             napojeni: '📡 Hrudní pás (BLE)' },
  butejko:          { vhled_1: '„Méně dechu znamená více života; nauč se hospodařit s kyslíkem."',                                   doplneni: 'Kontrolní pauza a efektivita tvého buněčného dýchání.',                                      napojeni: '📡 Manuální test / Časovač' },
  stres:            { vhled_1: '„Stres je palivo, pokud ho umíš zkrotit, jinak je to tvůj spalovač."',                               doplneni: 'Hladina kortizolu a reakce autonomního systému na zátěž.',                                    napojeni: '📡 HRV trendy / Wearables' },
  soustredeni:      { vhled_1: '„Tvá pozornost je nejcennější měna; investuj ji vědomě."',                                           doplneni: 'Schopnost udržet fokus na jeden úkol bez digitálního vyrušení.',                              napojeni: '📡 Screen Time / EEG čelenka' },
  vdecnost:         { vhled_1: '„Vděčnost přepíná mozek z režimu \'přežít\' do režimu \'tvořit\'."',                                doplneni: 'Pravidelnost reflexe pozitivních momentů tvého dne.',                                         napojeni: '📡 Deníkový modul (AI analýza)' },
  meditace:         { vhled_1: '„Ticho v hlavě není prázdnota, je to nejvyšší forma regenerace."',                                   doplneni: 'Dosažení stavu hlubokého klidu a alfa vln v mozku.',                                          napojeni: '📡 Meditační aplikace / EEG' },
  emoce:            { vhled_1: '„Emoce jsou barvy tvého života; nauč se je vnímat, ne jimi být."',                                   doplneni: 'Mapa tvých nálad a jejich vliv na fyzickou výkonnost.',                                      napojeni: '📡 Face-scanning AI' },
  pust:             { vhled_1: '„Občasný hlad je pozvánka pro tvé buňky k velkému úklidu (autofagii)."',                             doplneni: 'Časová okna mezi jídly a jejich vliv na tvou regeneraci.',                                    napojeni: '📡 Časovač půstu / CGM' },
  glukoza_vyziva:   { vhled_1: '„Stabilní cukr znamená stabilní emoce a výkon bez odpoledních pádů."',                              doplneni: 'Reakce tvého těla na konkrétní jídla a kombinace surovin.',                                   napojeni: '📡 CGM senzor' },
  mikronutrienty:   { vhled_1: '„Mikro detaily tvoří makro zdraví; doplň palivo pro své enzymy."',                                   doplneni: 'Hladiny vitamínů a minerálů klíčových pro tvou energii.',                                    napojeni: '📡 Krevní testy (Import)' },
  hydratace:        { vhled_1: '„Voda je médium, ve kterém probíhá veškerá tvá vnitřní magie."',                                     doplneni: 'Objem a načasování příjmu tekutin vzhledem k aktivitě.',                                      napojeni: '📡 Chytrá láhev / Manuální log' },
  casovani_jidel:   { vhled_1: '„Kdy jíš, je stejně důležité jako co jíš; sjednoť se s biorytmem."',                                doplneni: 'Soulad stravování s tvými vnitřními hodinami (cirkadiánní rytmus).',                           napojeni: '📡 Oura / Apple Health' },
  imunitni:         { vhled_1: '„Tvá imunita je armáda, která nikdy nespí; krm ji klidem a pohybem."',                               doplneni: 'Pohotovost tvého systému reagovat na vnější hrozby.',                                         napojeni: '📡 Klidový tep / Teplota' },
  obnova:           { vhled_1: '„Oprava těla probíhá v klidu, ne v boji; dej regeneraci prostor."',                                  doplneni: 'Celkové skóre připravenosti těla na další zátěž.',                                            napojeni: '📡 Readiness skóre (Oura/Garmin)' },
  biomarkery:       { vhled_1: '„Krev je vnitřní mapa, která ukazuje stav motoru dříve než kontrolka."',                             doplneni: 'Trendy v tvém krevním obraze z dlouhodobého hlediska.',                                      napojeni: '📡 Laboratorní API / PDF' },
  glukoza:          { vhled_1: '„Sleduj svou glykémii jako zrcadlo svého metabolického zdraví."',                                    doplneni: 'Dlouhodobý průměr hladiny cukru v krvi (HbA1c).',                                             napojeni: '📡 Laboratoř / CGM' },
  bilirubin:        { vhled_1: '„Čistá játra jsou filtrem tvé vitality; sleduj barvu své energie."',                                 doplneni: 'Ukazatel stavu tvých jater a efektivity zpracování látek.',                                   napojeni: '📡 Krevní testy' },
  leukocyty:        { vhled_1: '„Bílé krvinky jsou tví strážci; měj přehled o jejich počtu a síle."',                               doplneni: 'Indikace skrytých zánětů nebo přetížení organismu.',                                          napojeni: '📡 Krevní testy' },
  erytrocyty:       { vhled_1: '„Červené krvinky jsou nosiči tvého dechu; starej se o své doručovatele."',                           doplneni: 'Schopnost krve přenášet kyslík k pracujícím svalům.',                                         napojeni: '📡 Krevní testy' },
  souhrn_biomarkery:{ vhled_1: '„Celkový obraz tvého zdraví složený z tisíce drobných indicií."',                                   doplneni: 'Komplexní Longevity skóre založené na hloubkové diagnostice.',                                 napojeni: '📡 AI Diagnostika' },
};

// =====================================================
// ACTIVE MOTTOS – motto pod nadpisem pro barevné uzly
// =====================================================

export const ACTIVE_MOTTOS = {
  dlouhovekost:  '„Hra o život se nevyhrává v cíli — vyhrává se každým dnem, který prožiješ naplno."',
  telo:          '„Tvé tělo je jediný domov, ve kterém musíš vydržet celý život."',
  zdravi:        '„Zdraví není absence nemoci, ale přítomnost vitality."',
  metabolicke:   '„Stabilní cukr znamená stabilní emoce a výkon bez odpoledních pádů."',
  sila:          '„Síla je schopnost nést své vlastní tělo s naprostou lehkostí."',
  vytrvalost:    '„Tvá vytrvalost je schopnost zůstat v pohybu, i když ostatní zastaví."',
  vo2max:        '„Kapacita plic určuje, kolik života dokážeš vdechnout do každého dne."',
  mysl:          '„Postoj vítěze není póza, je to příkaz tvým buňkám k regeneraci."',
  vyziva:        '„Jídlo je informace pro tvé buňky, jak se mají dnes opravit."',
  spanek:        '„Hluboký spánek není pauza, je to tvá soukromá továrna na opravu."',
  klid:          '„Ticho v hlavě je nejvyšší forma vnitřní hygieny."',
  mobilita:      '„Rozhýbání páteře probudí tvůj nervový systém dřív než kofein."',
  bílkoviny:     '„Svaly jsou tvé brnění; bílkoviny jsou materiál pro jeho opravu."',
  stabilita:     '„Kdo pevně stojí v sobě, toho vnější svět nerozhází."',
  nervovy_system:'„Tvé nervy jsou dálnice pro signály života; udržuj je průjezdné."',
  smysl:         '„Vědět PROČ je důležitější než vědět JAK."',
};

export function getDemoPreview(nodeId) {
  return DEMO_PREVIEWS[nodeId] || {};
}

// =====================================================
// ČERNÍ JEZDCI – mapování uzlů na smrtelné hrozby
// =====================================================
export const NODE_RIDERS = {
  dlouhovekost:  [],             // počítá se dynamicky z dětí
  telo:          ['srdce'],
  mysl:          ['mozek'],
  vyziva:        ['metabolismus'],
  zdravi:        ['rakovina'],
  metabolicke:   ['metabolismus'],
  spanek:        ['mozek', 'srdce'],
  sila:          ['srdce'],
  vo2max:        ['srdce'],
  stabilita:     ['pohyb'],
  mobilita:      ['pohyb'],
  nervovy_system:['mozek'],
  kardio:        ['srdce'],
  glukoza:       ['metabolismus'],
  bilirubin:     ['rakovina'],
  leukocyty:     ['rakovina'],
  erytrocyty:    ['srdce'],
};

export const RIDER_ICONS = {
  srdce:        '❤️',
  mozek:        '🧠',
  metabolismus: '⚡',
  rakovina:     '🎗️',
  pohyb:        '🦵',
};

export function getRiders(node) {
  if (node.id === 'dlouhovekost') {
    // Hlavní uzel: jezdci ze všech RED/YELLOW dětí
    const allData = window.MAIN_UNIVERSE_DATA || [];
    const riderSet = new Set();
    allData
      .filter(n => n.parent === 'dlouhovekost' && (n.state === 'RED' || n.state === 'YELLOW'))
      .forEach(c => (NODE_RIDERS[c.id] || []).forEach(r => riderSet.add(r)));
    return [...riderSet].slice(0, 4);
  }
  return NODE_RIDERS[node.id] || [];
}

// ─── HARDCODED VERDICT ─────────────────────────────────────────────────────
// Žádný API call pro brífinky → nulová latence, konzistentní tón.
// AI se volá jen pro konverzaci (chipy, volný chat).

export const VERDICT_TEXTS = {
  telo:        { RED: 'Tělo slábne. Síla odchází.',            YELLOW: 'Tělo drží. Ale sotva.',            GREEN: 'Tělo je v kondici.' },
  mysl:        { RED: 'Hlava ztrácí ostrost.',                 YELLOW: 'Hlava funguje. Zpomaluje.',        GREEN: 'Hlava je v pohodě.' },
  vyziva:      { RED: 'Strava selhává. Tělo to ví.',          YELLOW: 'Strava není špatná. Ale nestačí.', GREEN: 'Strava je v normě.' },
  zdravi:      { RED: 'Prevence selhává. Tělo je nechráněné.', YELLOW: 'Prevence drží. Ale má mezery.',     GREEN: 'Prevence funguje.' },
  metabolicke: { RED: 'Metabolismus padá. Ztrácíš kontrolu.', YELLOW: 'Metabolismus kolísá. Zatím drží.', GREEN: 'Metabolismus v normě.' },
};

export const KILLER_TEXTS = {
  cukrovka:          'Cukrovka číhá. Tvůj tah.',
  infarkt_a_mrtvice: 'Srdce čeká na posilu.',
  demence:           'Mozek potřebuje trénink.',
  rakovina:          'Imunita rozhodne. Posilni ji.',
};

// Primary killer per node (priority=1 from node_riders)
export const NODE_KILLERS = {
  telo: 'infarkt_a_mrtvice',  mysl: 'demence',  vyziva: 'cukrovka',
  zdravi: 'rakovina',  metabolicke: 'cukrovka',
  sila: 'infarkt_a_mrtvice',  stabilita: 'demence',  kardio: 'infarkt_a_mrtvice',
  vo2max: 'infarkt_a_mrtvice',  spanek: 'demence',  stres: 'infarkt_a_mrtvice',
  nervovy_system: 'demence',  protein: 'cukrovka',
};

export function generateVerdict(node, aspiration) {
  const state = node.state || 'UNKNOWN';
  const isMainNode = node.id === 'dlouhovekost';
  const lines = [];

  if (isMainNode) {
    // Hlavní uzel: najdi bottleneck (nejhorší dítě) → killer + aspirace
    const metrics = (window.MAIN_UNIVERSE_DATA || [])
      .filter(n => n.state && ['GREEN', 'YELLOW', 'RED'].includes(n.state) && n.id !== 'dlouhovekost');
    const bottleneck = metrics.filter(m => m.state === 'RED').sort((a, b) => (a.current_index ?? 0) - (b.current_index ?? 0))[0]
                    || metrics.filter(m => m.state === 'YELLOW').sort((a, b) => (a.current_index ?? 0) - (b.current_index ?? 0))[0];

    if (bottleneck) {
      const killer = NODE_KILLERS[bottleneck.id];
      const killerLabel = killer ? KILLER_TEXTS[killer] : null;
      const bnText = VERDICT_TEXTS[bottleneck.id]?.[bottleneck.state];
      // Hlavní uzel = 1 věta: stav bottlenecku + killer
      if (bnText && killerLabel) {
        lines.push(`${bnText} ${killerLabel}`);
      } else if (bnText) {
        lines.push(bnText);
      }
    } else {
      lines.push('Všechno drží. Ale nezdržuj se.');
    }
    return { text: lines[0] || '', lines };
  }

  // Sub-uzel: Chip 1 = stav + killer (sloučené)
  const verdictText = VERDICT_TEXTS[node.id]?.[state];
  const killer = NODE_KILLERS[node.id];
  const killerText = (state !== 'GREEN' && killer) ? KILLER_TEXTS[killer] : null;

  if (verdictText && killerText) {
    lines.push(`${verdictText} ${killerText}`);
  } else if (verdictText) {
    lines.push(verdictText);
  }

  // Chip 2 = aspirace (jen RED)
  if (state === 'RED' && aspiration?.label && aspiration?.gap > 0.05) {
    lines.push(`Na ${aspiration.label} takhle zapomeň.`);
  }

  return { text: lines[0] || '', lines: lines.length ? lines : null };
}

// =====================================================
// DAILY MISSIONS — šablony akcí pro každý uzel × stav
// =====================================================
// action_type: 'timed' (stopky), 'count' (počítadlo), 'habit' (checkbox), 'photo' (kamera)
// duration_sec: délka pro timed akce
// target: cílový počet pro count akce

export const DAILY_MISSIONS = {
  telo: {
    RED:    [
      { id: 'telo_r1', label: '10 dřepů',             action_type: 'count',  target: 10,  icon: '🦵' },
      { id: 'telo_r2', label: '1 min plank',           action_type: 'timed',  duration_sec: 60,  icon: '💪' },
    ],
    YELLOW: [
      { id: 'telo_y1', label: '20 dřepů',             action_type: 'count',  target: 20,  icon: '🦵' },
      { id: 'telo_y2', label: '2 min plank',           action_type: 'timed',  duration_sec: 120, icon: '💪' },
    ],
    GREEN:  [
      { id: 'telo_g1', label: '30 dřepů + 10 kliků',  action_type: 'count',  target: 40,  icon: '🏋️' },
    ],
  },
  mysl: {
    RED:    [
      { id: 'mysl_r1', label: '2 min dýchání',        action_type: 'timed',  duration_sec: 120, icon: '🧘' },
      { id: 'mysl_r2', label: '5 min bez telefonu',    action_type: 'timed',  duration_sec: 300, icon: '📵' },
    ],
    YELLOW: [
      { id: 'mysl_y1', label: '3 min meditace',        action_type: 'timed',  duration_sec: 180, icon: '🧘' },
    ],
    GREEN:  [
      { id: 'mysl_g1', label: '5 min meditace',        action_type: 'timed',  duration_sec: 300, icon: '🧘' },
    ],
  },
  vyziva: {
    RED:    [
      { id: 'vyz_r1',  label: 'Vyfoť svůj oběd',      action_type: 'photo',  icon: '📸' },
      { id: 'vyz_r2',  label: 'Vypij sklenici vody',   action_type: 'habit',  icon: '💧' },
    ],
    YELLOW: [
      { id: 'vyz_y1',  label: 'Vyfoť svůj oběd',      action_type: 'photo',  icon: '📸' },
      { id: 'vyz_y2',  label: 'Žádný cukr dnes',       action_type: 'habit',  icon: '🚫' },
    ],
    GREEN:  [
      { id: 'vyz_g1',  label: 'Zapiš 3 jídla dne',    action_type: 'count',  target: 3,   icon: '📝' },
    ],
  },
  zdravi: {
    RED:    [
      { id: 'zdr_r1',  label: '10 min procházka',      action_type: 'timed',  duration_sec: 600, icon: '🚶' },
      { id: 'zdr_r2',  label: 'Studenou sprchu 30s',   action_type: 'timed',  duration_sec: 30,  icon: '🚿' },
    ],
    YELLOW: [
      { id: 'zdr_y1',  label: '15 min procházka',      action_type: 'timed',  duration_sec: 900, icon: '🚶' },
    ],
    GREEN:  [
      { id: 'zdr_g1',  label: 'Studená sprcha 1 min',  action_type: 'timed',  duration_sec: 60,  icon: '🚿' },
    ],
  },
  metabolicke: {
    RED:    [
      { id: 'met_r1',  label: '2 min chůze po jídle',  action_type: 'timed',  duration_sec: 120, icon: '🚶' },
      { id: 'met_r2',  label: 'Žádný cukr dnes',       action_type: 'habit',  icon: '🚫' },
    ],
    YELLOW: [
      { id: 'met_y1',  label: '5 min chůze po jídle',  action_type: 'timed',  duration_sec: 300, icon: '🚶' },
    ],
    GREEN:  [
      { id: 'met_g1',  label: '10 min chůze po jídle', action_type: 'timed',  duration_sec: 600, icon: '🚶' },
    ],
  },
};

/**
 * Pick today's mission for a node.
 * Rotates based on day-of-year so user doesn't get the same one every day.
 */
export function pickMission(nodeId, state) {
  const missions = DAILY_MISSIONS[nodeId]?.[state];
  if (!missions || missions.length === 0) return null;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return missions[dayOfYear % missions.length];
}

// =====================================================
// BIO-AGE CALCULATION (Attia: Medicine 3.0)
// =====================================================
// 4 fitness markers weighted by mortality prediction power.
// Each marker's current_index (0–100) maps to a year offset.
// Bio-age = chronological age + weighted sum of offsets.

const BIO_MARKERS = [
  { nodeId: 'vo2max',    weight: 0.40 },  // strongest mortality predictor
  { nodeId: 'sila',      weight: 0.25 },  // functional independence
  { nodeId: 'stabilita', weight: 0.20 },  // fall prevention
  { nodeId: 'mobilita',  weight: 0.15 },  // movement quality
];

// current_index → year offset (how many years this marker adds/subtracts)
// Based on Attia's age-performance tables
function indexToYearOffset(index) {
  if (index <= 20) return +20;   // critical — body aging 20 years faster
  if (index <= 40) return +10;   // poor
  if (index <= 60) return +4;    // below average
  if (index <= 75) return  0;    // population average
  if (index <= 90) return -5;    // good
  return -12;                    // elite
}

/**
 * Calculate biological age from fitness markers.
 * @param {number} chronologicalAge - user's real age
 * @param {Object} metricsMap - { nodeId: { current_index } }
 * @returns {{ bioAge: number, offset: number, markers: Array, chronologicalAge: number }}
 */
export function calcBioAge(chronologicalAge, metricsMap) {
  if (!chronologicalAge || !metricsMap) return null;

  let totalWeight = 0;
  let weightedOffset = 0;
  const markers = [];

  for (const { nodeId, weight } of BIO_MARKERS) {
    const m = metricsMap[nodeId];
    // Skip GRAY/missing markers — don't penalize unmeasured nodes
    if (!m || m.state === 'GRAY' || m.current_index === undefined) continue;

    const offset = indexToYearOffset(m.current_index);
    weightedOffset += offset * weight;
    totalWeight += weight;
    markers.push({ nodeId, index: m.current_index, offset, weight });
  }

  // If no markers measured yet, can't calculate
  if (totalWeight === 0) return null;

  // Normalize weights to sum to 1 (in case some markers are missing)
  const normalizedOffset = weightedOffset / totalWeight;
  const bioAge = Math.round(chronologicalAge + normalizedOffset);

  // Clamp to reasonable range
  const clamped = Math.max(chronologicalAge - 20, Math.min(chronologicalAge + 25, bioAge));

  return {
    bioAge: clamped,
    offset: clamped - chronologicalAge,
    chronologicalAge,
    markers,
  };
}
