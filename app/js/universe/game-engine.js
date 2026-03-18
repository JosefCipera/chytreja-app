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
  zdravi:      { RED: 'Obrana padá. Tělo je otevřené.',       YELLOW: 'Obrana drží. Má trhliny.',         GREEN: 'Obrana funguje.' },
  metabolicke: { RED: 'Metabolismus padá. Ztrácíš kontrolu.', YELLOW: 'Metabolismus kolísá. Zatím drží.', GREEN: 'Metabolismus v normě.' },
};

export const KILLER_TEXTS = {
  cukrovka:          'Cukrovka tiše postupuje.',
  infarkt_a_mrtvice: 'Infarkt čeká na slabinu.',
  demence:           'Demence maže stopy.',
  rakovina:          'Rakovina hledá skulinu.',
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

  // Sub-uzel: Věta 1 = stav
  const verdictText = VERDICT_TEXTS[node.id]?.[state];
  if (verdictText) lines.push(verdictText);

  // Věta 2 = killer (jen RED/YELLOW)
  if (state !== 'GREEN') {
    const killer = NODE_KILLERS[node.id];
    const killerText = killer ? KILLER_TEXTS[killer] : null;
    if (killerText) lines.push(killerText);
  }

  // Věta 3 = aspirace (jen RED)
  if (state === 'RED' && aspiration?.label && aspiration?.gap > 0.05) {
    lines.push(`Na ${aspiration.label} takhle zapomeň.`);
  }

  return { text: lines[0] || '', lines: lines.length ? lines : null };
}
