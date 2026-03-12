// === UNIVERSE-PANEL.JS ===
// Pravý panel – Chytré já brífink + smart chips + živý chat
console.log("PANEL JS LOADED");

// =====================================================
// DEMO PREVIEWS – non-black-box texty pro locked uzly
// =====================================================

const DEMO_PREVIEWS = {
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

const ACTIVE_MOTTOS = {
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

function getDemoPreview(nodeId) {
  return DEMO_PREVIEWS[nodeId] || {};
}

// =====================================================
// ČERNÍ JEZDCI – mapování uzlů na smrtelné hrozby
// =====================================================
const NODE_RIDERS = {
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

const RIDER_ICONS = {
  srdce:        '❤️',
  mozek:        '🧠',
  metabolismus: '⚡',
  rakovina:     '🎗️',
  pohyb:        '🦵',
};

function getRiders(node) {
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

// Formátování CHJ textu: 1. věta tight, každá další věta s půlřádkovým odsazením dolů
function formatChjText(text) {
  const parts = (text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return text || '';
  return parts.map((p, i) =>
    i === 0
      ? `<span style="display:block;">${p}</span>`
      : `<span style="display:block; margin-top:0.55em;">${p}</span>`
  ).join('');
}

function showLockedPanel(node) {
  const preview = getDemoPreview(node.id);

  // Nadpis
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) {
    titleEl.innerHTML = `${node.icon || ''} ${node.label || ''}`;
  }

  // Skryj chat input – gray uzly nemají AI chat
  const aiSection = document.getElementById('aiPanelSection');
  if (aiSection) aiSection.style.display = 'none';

  const card = document.createElement('div');
  card.className = 'chj-card dynamic-section';

  if (preview.vhled_1 || preview.vhled_2 || preview.doplneni) {
    // ── Nový formát: vhled / doplneni / napojeni ──
    card.innerHTML = `
      <div class="locked-panel-inner">
        <div class="locked-badge">🔒 Připravujeme pro tebe</div>
        ${(preview.vhled_1 || preview.vhled_2) ? `
        <div class="locked-section">
          <div class="locked-section-label">Vhled</div>
          ${preview.vhled_1 ? `<p class="locked-insight">${preview.vhled_1}</p>` : ''}
          ${preview.vhled_2 ? `<p class="locked-insight">${preview.vhled_2}</p>` : ''}
        </div>` : ''}
        ${preview.doplneni ? `
        <div class="locked-section">
          <div class="locked-section-label">Co budeme sledovat</div>
          <p class="locked-desc">${preview.doplneni}</p>
        </div>` : ''}
        ${preview.napojeni ? `
        <div class="locked-section">
          <div class="locked-section-label">Propojíme s</div>
          <div class="locked-sensor-item">${preview.napojeni}</div>
        </div>` : ''}
      </div>
    `;
  } else {
    // ── Starý formát: text / tracks / sensors (původní locked uzly) ──
    const { text = '', tracks = [], sensors = [] } = preview;
    card.innerHTML = `
      <div class="locked-panel-inner">
        <div class="locked-badge">🔒 Připravujeme pro tebe</div>
        <h3 class="locked-hook">Tohle tě čeká?</h3>
        ${text ? `<p class="locked-desc">${text}</p>` : ''}
        ${tracks.length ? `
        <div class="locked-section">
          <div class="locked-section-label">Co budeme sledovat</div>
          ${tracks.map(t => `<div class="locked-track-item">• ${t}</div>`).join('')}
        </div>` : ''}
        ${sensors.length ? `
        <div class="locked-section">
          <div class="locked-section-label">Propojíme s</div>
          ${sensors.map(s => `<div class="locked-sensor-item">📡 ${s}</div>`).join('')}
        </div>` : ''}
        <button class="locked-cta-btn" onclick="alert('Pro verze přijde brzy! 🚀')">Odemknout v Pro →</button>
      </div>
    `;
  }

  const panelHeader = document.querySelector('.panel-header');
  if (panelHeader) panelHeader.after(card);
}

// =====================================================
// STYLES  (injektujeme jednou při načtení modulu)
// =====================================================

if (!document.getElementById('chj-panel-styles')) {
  const s = document.createElement('style');
  s.id = 'chj-panel-styles';
  s.textContent = `
    .chj-dots {
      display: inline-block;
      color: #64748b;
      font-size: 22px;
      letter-spacing: 8px;
      animation: chj-breathe 1.2s ease-in-out infinite;
    }
    @keyframes chj-breathe {
      0%, 100% { opacity: 0.15; }
      50%       { opacity: 0.9;  }
    }
    #aiPanelInput:disabled,
    #ai-send:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Node motto (barevné uzly) ── */
    .node-motto {
      font-size: 15px;
      color: #e2e8f0;
      font-style: italic;
      line-height: 1.65;
      padding: 8px 20px 2px;
      margin: 4px 0 0;
    }

    /* ── Locked panel ── */
    .locked-panel-inner {
      background: linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%);
      border: 1px solid #312e81;
      border-radius: 14px;
      padding: 22px 20px 20px;
      margin: 15px 0;
    }
    .locked-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #fbbf24;
      background: rgba(251,191,36,0.12);
      border: 1px solid rgba(251,191,36,0.35);
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 14px;
    }
    .locked-hook {
      font-size: 21px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 10px;
      line-height: 1.25;
    }
    .locked-desc {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.65;
      margin: 0 0 20px;
    }
    .locked-section {
      margin-bottom: 16px;
    }
    .locked-section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #60a5fa;
      margin-bottom: 8px;
    }
    .locked-insight {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.65;
      margin: 0 0 10px;
    }
    .locked-track-item {
      font-size: 14px;
      color: #f1f5f9;
      padding: 4px 0;
      font-weight: 500;
      line-height: 1.4;
    }
    .locked-sensor-item {
      font-size: 13px;
      color: #94a3b8;
      padding: 3px 0;
    }
    .locked-cta-btn {
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 13px 16px;
      background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      letter-spacing: 0.4px;
      transition: opacity 0.18s;
      box-shadow: 0 4px 14px rgba(99,102,241,0.4);
    }
    .locked-cta-btn:hover { opacity: 0.82; }
  `;
  document.head.appendChild(s);
}

// =====================================================
// PANEL CORE
// =====================================================

const panelEl = document.getElementById("sidePanel");

export function closePanel() {
  if (panelEl) {
    panelEl.classList.remove("open", "visible");
    setTimeout(() => { panelEl.style.display = "none"; }, 300);
    document.body.classList.remove("panel-open");
  }
}

const closeBtn = document.getElementById("closePanel");
if (closeBtn) closeBtn.onclick = () => closePanel();
window.closePanel = closePanel;

function resetPanel() {
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) titleEl.innerHTML = "";
  document.querySelectorAll(".metric-card, .chj-card, .dynamic-section, hr.dynamic-hr").forEach(el => el.remove());
  const msgs = document.getElementById('ai-integrated-msgs');
  if (msgs) msgs.innerHTML = "";
}

export async function showPanel(node) {
  if (!panelEl) return;

  const wasOpen = panelEl.classList.contains('open');

  panelEl.style.transition = "none";
  if (!wasOpen) {
    // Fresh open – hide first so slide-in animation works
    panelEl.style.visibility = "hidden";
    panelEl.classList.remove("open", "visible");
  }

  resetPanel();

  if (node.state === 'GRAY') {
    showLockedPanel(node);
  } else {
    showGameOfLife(node);
  }

  panelEl.style.display = "block";
  panelEl.style.visibility = "visible";
  panelEl.classList.add("open", "visible");
  document.body.classList.add("panel-open");

  requestAnimationFrame(() => { panelEl.style.transition = ""; });
}

// =====================================================
// DATA FETCHING
// =====================================================

async function fetchAspiration(userId, nodeId) {
  if (nodeId === 'dlouhovekost') return null;
  try {
    const res = await fetch(`/api/aspiration?userId=${encodeURIComponent(userId)}&nodeId=${encodeURIComponent(nodeId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.aspiration || null;
  } catch {
    return null;
  }
}

async function fetchLearningSteps(nodeId) {
  try {
    const { data, error } = await window.supabaseClient
      .from('universe_nodes')
      .select('*')
      .eq('id', nodeId)
      .eq('universe_id', 'longevity')
      .maybeSingle();

    if (error) {
      console.warn(`⚠️ fetchLearningSteps(${nodeId}):`, error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('⚠️ fetchLearningSteps exception:', err);
    return null;
  }
}

// =====================================================
// WEATHER-STYLE MINI TREND (canvas, adapted from biomarkery)
// =====================================================
function drawMiniTrend(ctx, data, color) {
  if (!ctx || !data || data.length < 2) return;
  const c   = ctx.canvas;
  const w   = c.clientWidth  || c.offsetWidth  || 240;
  const h   = c.clientHeight || c.offsetHeight || 55;
  const dpr = window.devicePixelRatio || 1;
  c.width   = w * dpr;
  c.height  = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const mx = 15, my = 10;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = Math.max(1e-6, max - min);
  const pts = data.map((v, i) => ({
    x: mx + (i / (data.length - 1)) * (w - mx * 2),
    y: h - ((v - min) / rng) * (h - my * 2) - my
  }));

  // Barevná křivka trendu
  ctx.beginPath();
  ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = (color || '#22d3ee') + 'e0';
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 2; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  const last = pts.at(-1), pre = pts.at(-2);
  const endX = pre.x + (last.x - pre.x) * 0.9;
  const endY = pre.y + (last.y - pre.y) * 0.9;
  ctx.quadraticCurveTo(pre.x, pre.y, endX, endY);
  ctx.stroke();

  // Šedý "forecast" ocas
  ctx.beginPath();
  ctx.moveTo(endX + 6, endY);
  ctx.lineTo(Math.min(w - 8, endX + 220), endY);
  ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.strokeStyle = '#94a3b844';
  ctx.stroke();

  // Tečka na konci křivky
  ctx.beginPath();
  ctx.arc(endX, endY, 9, 0, Math.PI * 2);
  ctx.fillStyle = color || '#22d3ee';
  ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff';
  ctx.stroke();
}

async function fetchTrend(userId, nodeId, nodeState) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateFilter = thirtyDaysAgo.toISOString().split('T')[0];

  // 🔍 DIAGNOSTIKA – odstraň až bude trend fungovat
  console.log('📈 fetchTrend params:', { userId, nodeId, dateFilter, clientOk: !!window.supabaseClient });

  // Test: vůbec přístupná tabulka? (bez filtrů, limit 3)
  const { data: testData, error: testError } = await window.supabaseClient
    .from('node_state_history')
    .select('user_id, node_id, date, state')
    .limit(3);
  console.log('📈 test (no filter):', { testData, testError });

  const { data, error } = await window.supabaseClient
    .from('node_state_history')
    .select('date, state')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .gte('date', dateFilter)
    .order('date', { ascending: true });

  console.log('📈 filtered result:', { data, error, rowCount: data?.length });

  if (error) console.error('Trend error:', error);

  if (!data || data.length === 0) {
    return {
      html: '<div style="color:#64748b; font-size:13px; padding:16px 0;">Zatím není trend</div>',
      text: 'Stabilní', numeric: [], lineColor: '#64748b',
      trendColor: '#64748b', arrow: '→', dataLength: 0
    };
  }

  // Numerická data pro canvas (GREEN=3, YELLOW=2, RED=1)
  const numeric = data.map(d => d.state === 'GREEN' ? 3 : d.state === 'YELLOW' ? 2 : 1);

  const recent = data.slice(-7);
  const recentGreen = recent.filter(d => d.state === 'GREEN').length;
  const recentRed   = recent.filter(d => d.state === 'RED').length;

  let arrow = '→', trendText = 'Stabilní', trendColor = '#eab308';
  if (recentGreen > recentRed + 2)  { arrow = '↗️'; trendText = 'Zlepšení'; trendColor = '#22c55e'; }
  else if (recentRed > recentGreen + 2) { arrow = '↘️'; trendText = 'Zhoršení'; trendColor = '#ef4444'; }

  const lineColor = nodeState === 'GREEN' ? '#22c55e'
    : nodeState === 'YELLOW' ? '#eab308'
    : nodeState === 'RED'    ? '#ef4444'
    : '#64748b';

  return { text: trendText, numeric, lineColor, trendColor, arrow, dataLength: data.length };
}

async function generateVerdictV2(node, userId) {
  try {
    // Použij data z window.MAIN_UNIVERSE_DATA – jsou již načtena při startu,
    // není potřeba extra Supabase round-trip (ušetříme 100–300 ms latence).
    const metrics = (window.MAIN_UNIVERSE_DATA || [])
      .filter(n => n.state && ['GREEN', 'YELLOW', 'RED'].includes(n.state))
      .map(n => ({ node_id: n.id, state: n.state, current_index: n.current_index ?? 0 }));

    if (metrics.length === 0) return { text: 'Zatím nemám dost dat.' };

    const bottleneck = metrics
      .filter(m => m.state === 'RED')
      .sort((a, b) => a.current_index - b.current_index)[0];

    const payload = {
      nodeId: node.id,
      userQuestion: null,
      context: {
        state: node.state,
        userId,
        redCount: metrics.filter(m => m.state === 'RED').length,
        yellowCount: metrics.filter(m => m.state === 'YELLOW').length,
        greenCount: metrics.filter(m => m.state === 'GREEN').length,
        bottleneck: bottleneck?.node_id
      }
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return { text: `API error ${response.status}` };

    const rawText = await response.text();
    const data = JSON.parse(rawText);
    return {
      text: data?.verdict || 'API nevrátilo platnou odpověď.',
      lines: data?.verdictLines || null
    };

  } catch (err) {
    console.error('❌ generateVerdictV2:', err);
    return { text: 'Chyba při komunikaci s AI.' };
  }
}

// =====================================================
// VIEWER MODAL  (iFrame → /app/viewer.html)
// =====================================================

const TYPE_MAP = { markdown: 'md', pdf: 'pdf', video: 'video', audio: 'audio', image: 'image', gif: 'image' };

function detectType(url) {
  if (!url) return 'md';
  if (url.endsWith('.md')) return 'md';
  if (url.endsWith('.pdf')) return 'pdf';
  if (url.match(/\.(mp4|webm|mov)$/i)) return 'video';
  if (url.match(/\.(mp3|ogg|wav|m4a)$/i)) return 'audio';
  if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) return 'image';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  return 'md';
}

let _currentViewerClose = null;

window.addEventListener('message', e => {
  if (e.data === 'closeViewer' && _currentViewerClose) {
    _currentViewerClose();
  }
});

function openViewerModal(fileUrl, type, title, onBack = null, scriptCz = null) {
  document.getElementById('viewerModal')?.remove();

  // PDF → fetch+blob do modálu (blob: URL obchází X-Frame-Options a CORS)
  if (type === 'pdf') {
    const modal = document.createElement('div');
    modal.id = 'viewerModal';
    // opacity: 1 hned – žádný fade-in (zabraňuje záblesku panelu)
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      z-index: 10000;
      transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 20px; background:#0f172a; border-bottom:1px solid #1e293b; flex-shrink:0;
      ">
        <div style="display:flex;align-items:center;gap:16px;">
          <span style="color:#94a3b8; font-size:14px; font-weight:500;">📕 ${title || 'PDF'}</span>
          <a href="${fileUrl}" target="_blank" style="
            color:#60a5fa;font-size:13px;text-decoration:none;
            padding:4px 10px;border:1px solid rgba(96,165,250,0.3);border-radius:6px;
            background:rgba(96,165,250,0.08);transition:all 0.15s;
          " onmouseover="this.style.background='rgba(96,165,250,0.18)'" onmouseout="this.style.background='rgba(96,165,250,0.08)'">↗ Otevřít</a>
        </div>
        <button id="closeViewerModal" style="
          background:transparent;border:none;color:#94a3b8;
          font-size:24px;cursor:pointer;padding:4px 8px;
          border-radius:6px;line-height:1;transition:all 0.2s;
        ">&times;</button>
      </div>
      <div id="pdfContainer" style="flex:1;width:100%;background:#0a0f1e;display:flex;align-items:center;justify-content:center;">
        <div style="color:#64748b;font-size:14px;">Načítám PDF…</div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeViewer = () => {
      _currentViewerClose = null;
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 200);
    };
    _currentViewerClose = closeViewer;
    // Přechod zpět: okamžité odebrání (bez fade) aby mezi modály nebyl záblesk panelu
  const closeAndBack = () => {
    if (onBack) {
      _currentViewerClose = null;
      modal.remove();
      onBack();
    } else {
      closeViewer();
    }
  };

    const btn = document.getElementById('closeViewerModal');
    btn.onclick = closeAndBack;
    btn.onmouseenter = () => { btn.style.background = 'rgba(239,68,68,0.2)'; btn.style.color = '#ef4444'; };
    btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#94a3b8'; };
    modal.addEventListener('click', e => { if (e.target === modal) closeAndBack(); });
    const escHandler = e => {
      if (e.key === 'Escape') { closeAndBack(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    // 1. Pokus: fetch+blob → <object type="application/pdf"> (nejlépe funguje v prohlížeči)
    // 2. Fallback: Google Docs Viewer (veřejné PDF přes Google servery)
    // 3. Vždy je v hlavičce záložní odkaz "Otevřít ↗"
    fetch(fileUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(blob => {
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(pdfBlob);
        const container = document.getElementById('pdfContainer');
        if (container) {
          container.innerHTML = `<object data="${blobUrl}" type="application/pdf" style="width:100%;height:100%;border:none;"><p style="color:#94a3b8;padding:16px;text-align:center;">PDF viewer není dostupný.<br>Použij tlačítko <em>Otevřít</em> v záhlaví.</p></object>`;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
        }
      })
      .catch(() => {
        const container = document.getElementById('pdfContainer');
        if (container) {
          const gdocUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
          container.innerHTML = `<iframe src="${gdocUrl}" style="width:100%;height:100%;border:none;" allow="fullscreen"></iframe>`;
        }
      });
    return;
  }

  const isAudio = type === 'audio';
  const scriptCzParam = scriptCz ? `&script_cz=${encodeURIComponent(scriptCz)}` : '';
  const viewerSrc = `/app/viewer.html?type=${encodeURIComponent(type)}&file=${encodeURIComponent(fileUrl)}${scriptCzParam}`;

  const modal = document.createElement('div');
  modal.id = 'viewerModal';

  if (isAudio) {
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      z-index: 10000;
      transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="
        background:#1e293b; border-radius:16px; overflow:hidden;
        width:90%; max-width:480px;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
        display:flex; flex-direction:column;
      ">
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; background:#0f172a; border-bottom:1px solid #1e293b; flex-shrink:0;
        ">
          <span style="color:#94a3b8; font-size:14px; font-weight:500;">🎵 ${title || 'Audio'}</span>
          <button id="closeViewerModal" style="
            background:transparent;border:none;color:#94a3b8;
            font-size:22px;cursor:pointer;padding:4px 8px;
            border-radius:6px;line-height:1;transition:all 0.2s;
          ">&times;</button>
        </div>
        <iframe src="${viewerSrc}" style="width:100%;height:220px;border:none;background:#0f172a;overflow:hidden;" allow="autoplay"></iframe>
      </div>
    `;
  } else {
    modal.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      display: flex; flex-direction: column;
      z-index: 10000;
      transition: opacity 0.2s ease;
    `;
    modal.innerHTML = `
      <div style="
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 20px; background:#0f172a; border-bottom:1px solid #1e293b; flex-shrink:0;
      ">
        <span style="color:#94a3b8; font-size:14px; font-weight:500;">${title || ''}</span>
        <button id="closeViewerModal" style="
          background:transparent;border:none;color:#94a3b8;
          font-size:24px;cursor:pointer;padding:4px 8px;
          border-radius:6px;line-height:1;transition:all 0.2s;
        ">&times;</button>
      </div>
      <iframe src="${viewerSrc}" style="flex:1;width:100%;border:none;background:#0a0f1e;" allow="fullscreen"></iframe>
    `;
  }

  document.body.appendChild(modal);
  // žádný fade-in (modal se zobrazí okamžitě, bez záblesku panelu)

  const closeViewer = () => {
    _currentViewerClose = null;
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 200);
  };

  _currentViewerClose = closeViewer;

  // Přechod zpět: okamžité odebrání (bez fade) aby mezi modály nebyl záblesk panelu
  const closeAndBack = () => {
    if (onBack) {
      _currentViewerClose = null;
      modal.remove();
      onBack();
    } else {
      closeViewer();
    }
  };

  const btn = document.getElementById('closeViewerModal');
  btn.onclick = closeAndBack;
  btn.onmouseenter = () => { btn.style.background = 'rgba(239,68,68,0.2)'; btn.style.color = '#ef4444'; };
  btn.onmouseleave = () => { btn.style.background = 'transparent'; btn.style.color = '#94a3b8'; };

  modal.addEventListener('click', e => { if (e.target === modal) closeAndBack(); });

  const escHandler = e => {
    if (e.key === 'Escape') { closeAndBack(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

function openTextAsViewer(markdownText, title) {
  if (!markdownText) { showToast('Obsah není k dispozici.'); return; }
  const blob = new Blob([markdownText], { type: 'text/plain; charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  openViewerModal(blobUrl, 'md', title);
}

async function openResourcesViewer(node) {
  // Loading modal
  document.getElementById('viewerModal')?.remove();
  const loadingModal = document.createElement('div');
  loadingModal.id = 'viewerModal';
  loadingModal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10000;`;
  loadingModal.innerHTML = `<div style="color:#94a3b8;font-size:14px;display:flex;align-items:center;gap:10px;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
      </path>
    </svg>
    Vybírám nejlepší zdroje…
  </div>`;
  document.body.appendChild(loadingModal);

  // AI výběr zdrojů
  const userId = window.firebaseAuth?.currentUser?.uid || null;
  let all = [];
  try {
    const resp = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: node.id, state: node.state, userId }),
    });
    if (resp.ok) {
      const data = await resp.json();
      all = data.sources || [];
    }
  } catch (e) {
    console.warn('sources API failed, fallback to node data:', e);
  }

  // Fallback na pre-načtená data pokud API selže
  if (all.length === 0) {
    all = [
      ...(node.articles || []).map(a => ({ title: a.title, url: a.url, summary: a.summary, type: detectType(a.url) })),
      ...(node.media || []).map(m => ({ title: m.title, url: m.url, summary: m.summary, type: TYPE_MAP[m.type] || detectType(m.url) })),
      ...(node.docs || []).map(d => ({ title: d.title, url: d.url, summary: d.summary, type: TYPE_MAP[d.type] || detectType(d.url) })),
    ].filter(r => r.url);
  }

  loadingModal.remove();

  if (all.length === 0) { showToast('Žádné zdroje k dispozici.'); return; }
  if (all.length === 1) { openViewerModal(all[0].url, all[0].type, all[0].title, null, all[0].script_cz); return; }

  const PANEL_LIMIT = 5;
  const shown   = all.slice(0, PANEL_LIMIT);
  const hasMore = all.length > PANEL_LIMIT;

  document.getElementById('viewerModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'viewerModal';
  modal.style.cssText = `
    position:fixed; inset:0;
    background:rgba(0,0,0,0.85);
    display:flex; align-items:center; justify-content:center;
    z-index:10000;
  `;

  const icons = { md: '📄', pdf: '📕', video: '🎥', audio: '🎵', image: '🖼️' };

  modal.innerHTML = `
    <div style="
      background:#1e293b; border-radius:16px; padding:24px;
      max-width:560px; width:90%; max-height:90vh; overflow-y:auto;
      box-shadow:0 20px 60px rgba(0,0,0,0.7);
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="color:#f8fafc; margin:0; font-size:1.15em;">📚 Zdroje</h2>
        <button id="closeViewerModal" style="background:transparent;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">&times;</button>
      </div>
      ${shown.map((r, i) => `
        <div data-idx="${i}" class="res-pick" style="
          display:flex; align-items:center; gap:12px;
          padding:14px 16px; border-radius:10px; cursor:pointer;
          border:1px solid #1e293b; margin-bottom:8px;
          background:#0f172a; transition:all 0.15s ease;
        ">
          <span style="font-size:22px;">${icons[r.type] || '📎'}</span>
          <div>
            <div style="font-weight:600; color:#e2e8f0; font-size:14px;">${r.title || 'Bez názvu'}</div>
            ${r.summary ? `<div style="font-size:12px; color:#64748b; margin-top:2px;">${r.summary}</div>` : ''}
          </div>
        </div>
      `).join('')}
      ${hasMore ? `
        <a href="/app/medioteka.html?node=${encodeURIComponent(node.id)}" style="
          display:block; text-align:center; margin-top:8px;
          padding:10px; border-radius:8px;
          background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2);
          color:#60a5fa; font-size:13px; text-decoration:none;
        ">
          Mediotéka →
        </a>
      ` : `
        <div style="text-align:center; margin-top:14px;">
          <a href="/app/medioteka.html?node=${encodeURIComponent(node.id)}" style="
            color:#475569; font-size:12px; text-decoration:none;
          " onmouseover="this.style.color='#94a3b8'" onmouseout="this.style.color='#475569'">
            Mediotéka →
          </a>
        </div>
      `}
    </div>
  `;

  document.body.appendChild(modal);

  const closeViewer = () => {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 200);
  };

  document.getElementById('closeViewerModal').onclick = closeViewer;
  modal.addEventListener('click', e => { if (e.target === modal) closeViewer(); });

  const escHandler = e => {
    if (e.key === 'Escape') { closeViewer(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  modal.querySelectorAll('.res-pick').forEach(el => {
    const item = shown[parseInt(el.dataset.idx)];
    el.addEventListener('click', () => {
      modal.remove();
      openViewerModal(item.url, item.type, item.title, () => openResourcesViewer(node), item.script_cz);
    });
    el.addEventListener('mouseenter', () => {
      el.style.background = 'rgba(59,130,246,0.12)';
      el.style.borderColor = 'rgba(59,130,246,0.3)';
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = '#0f172a';
      el.style.borderColor = '#1e293b';
    });
  });
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:#1e293b; color:#94a3b8; padding:10px 20px;
    border-radius:8px; font-size:14px; z-index:99999;
    opacity:0; transition:opacity 0.2s ease; white-space:nowrap;
  `;
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; });
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 2500);
}

// =====================================================
// SHOW GAME OF LIFE  (hlavní builder panelu)
// =====================================================

/** Generuje HTML baterie pro hlavní uzel (state = GREEN / YELLOW / RED / jiný). */
function _buildBatteryHTML(state) {
  const fillPct    = state === 'GREEN' ? 80 : state === 'YELLOW' ? 50 : 20;
  const battColor  = state === 'GREEN' ? '#22c55e' : state === 'YELLOW' ? '#eab308' : '#ef4444';
  const battBorder = state === 'GREEN' ? 'rgba(34,197,94,0.35)'  : state === 'YELLOW' ? 'rgba(234,179,8,0.35)'  : 'rgba(239,68,68,0.35)';
  const battGlow   = state === 'GREEN' ? 'rgba(34,197,94,0.7)'   : state === 'YELLOW' ? 'rgba(234,179,8,0.7)'   : 'rgba(239,68,68,0.7)';
  const stateLabel = state === 'GREEN' ? 'Nabito' : state === 'YELLOW' ? 'Dobíjení' : 'Slabá baterie';
  return `
    <div style="text-align:center; padding:12px 0 4px;">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;">Tvoje životní energie</div>
      <div style="display:inline-flex; flex-direction:column; align-items:center;">
        <div style="
          width:22px; height:11px;
          border:2px solid ${battBorder};
          border-bottom:none;
          border-radius:5px 5px 0 0;
          background:linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04));
        "></div>
        <div style="
          width:62px; height:140px;
          border:2px solid ${battBorder};
          border-radius:5px 5px 8px 8px;
          background:rgba(8,8,18,0.6);
          position:relative; overflow:hidden;
          box-shadow:0 0 22px ${battBorder}, inset 0 0 12px rgba(0,0,0,0.4);
        ">
          <div style="
            position:absolute; bottom:0; left:0; right:0;
            height:${fillPct}%;
            background:linear-gradient(180deg, ${battColor}88, ${battColor}ee);
            box-shadow:0 0 30px ${battGlow};
            transition:height 1.5s ease;
          "></div>
          <div style="
            position:absolute; top:0; bottom:0; left:6px; width:9px;
            background:linear-gradient(90deg, rgba(255,255,255,0.09), transparent);
            border-radius:4px; pointer-events:none;
          "></div>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-evenly;padding:10px 0;pointer-events:none;">
            ${[0,1,2].map(() => `<div style="height:1px;background:rgba(255,255,255,0.06);margin:0 8px;"></div>`).join('')}
          </div>
        </div>
      </div>
      <div style="margin-top:14px; font-size:13px; color:#64748b; letter-spacing:0.5px;">${stateLabel}</div>
    </div>
  `;
}

async function showGameOfLife(node) {
  console.log("🎮 showGameOfLife:", node.id);
  const userId = window.firebaseAuth?.currentUser?.uid || 'demo-user-123';

  // Ukáže chat input (pro barevné uzly)
  const aiSection = document.getElementById('aiPanelSection');
  if (aiSection) aiSection.style.display = 'flex';

  // 1. Nadpis
  const titleEl = document.getElementById('nodeTitle');
  if (titleEl) {
    titleEl.innerHTML = `<span style="font-size:1.15em; margin-right:6px;">${node.icon || '🎮'}</span>${node.label || 'Hra o život'}`;
  }

  // 1b. Motto – italická věta pod nadpisem (pokud existuje)
  const motto = ACTIVE_MOTTOS[node.id];
  if (motto) {
    const mottoEl = document.createElement('div');
    mottoEl.className = 'node-motto dynamic-section';
    mottoEl.textContent = motto;
    const panelHeader = document.querySelector('.panel-header');
    if (panelHeader) panelHeader.after(mottoEl);
  }

  // 2. Metric karta – skeleton (baterie pro hlavní uzel, sparkline pro ostatní)
  console.log("🎮 showGameOfLife node.id:", node.id, "state:", node.state);
  const isMainNode = node.id === 'dlouhovekost';

  let metricCard = document.querySelector('.metric-card');
  if (metricCard) metricCard.remove();

  metricCard = document.createElement('div');
  metricCard.className = 'metric-card';
  metricCard.style.cssText = `
    background:#06b6d415; border:1px solid #06b6d433;
    border-radius:12px; padding:20px; margin:15px 0;
  `;

  // Skeleton se liší podle typu uzlu
  if (isMainNode) {
    // Stav (node.state) je znám okamžitě → vykreslíme reálnou baterii hned,
    // bez šedého placeholderu s jinými rozměry (eliminuje flicker při překreslení).
    metricCard.innerHTML = _buildBatteryHTML(node.state);
  } else {
    metricCard.innerHTML = `
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Trend (30 dní)</div>
      <div style="height:80px;background:rgba(255,255,255,0.05);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>
    `;
  }

  // Vlož metricCard za motto (pokud existuje), jinak za panelHeader
  const panelHeader = document.querySelector('.panel-header');
  const insertAfterEl = document.querySelector('.node-motto') || panelHeader;
  if (insertAfterEl) insertAfterEl.after(metricCard);

  // 3. CHJ karta – skeleton
  let chjCard = document.querySelector('.chj-card');
  if (chjCard) chjCard.remove();

  chjCard = document.createElement('div');
  chjCard.className = 'chj-card';
  chjCard.style.cssText = `
    background:#0f172a; border:1px solid #1e293b;
    border-radius:12px; padding:20px; margin:15px 0; color:#fff;
  `;
  chjCard.innerHTML = `
    <div style="height:60px;background:rgba(255,255,255,0.04);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
  `;
  metricCard.after(chjCard);

  // 4. Paralelní načtení dat (AI běží souběžně s DB dotazy)
  const [steps, trend, aspiration, verdict] = await Promise.all([
    fetchLearningSteps(node.id),
    fetchTrend(userId, node.id, node.state),
    fetchAspiration(userId, node.id),
    generateVerdictV2(node, userId)
  ]);

  const provocationText = steps?.step_provocation ?? null;
  const actionText = steps?.step_action ?? null;
  const actionTitle = steps?.step_action_title ?? steps?.step_action_label ?? null;
  const reflectionText = steps?.step_reflection ?? null;
  const reflectionTitle = steps?.step_reflection_title ?? steps?.step_reflection_label ?? null;

  // 5. Sparkline + aspiration indicator
  const aspirationHtml = aspiration ? `
    <div style="
      margin-top:10px; padding:8px 12px;
      background:${aspiration.achieved ? 'rgba(34,197,94,0.08)' : 'rgba(251,191,36,0.08)'};
      border:1px solid ${aspiration.achieved ? 'rgba(34,197,94,0.25)' : 'rgba(251,191,36,0.25)'};
      border-radius:8px; font-size:12px;
      display:flex; align-items:center; gap:8px;
    ">
      <span>🎯</span>
      <span style="color:#94a3b8;">${aspiration.label}:</span>
      <span style="color:${aspiration.achieved ? '#22c55e' : '#fbbf24'}; font-weight:500;">
        ${aspiration.achieved ? 'splněno' : 'zaostávám'}
      </span>
    </div>
  ` : '';

  // 5b. Hlavní uzel → baterie; ostatní uzly → sparkline
  if (isMainNode) {
    // Baterie je již správně vykreslena v skeleton fázi (node.state je znám okamžitě).
    // Re-renderujeme přes helper aby bylo garantovaně konzistentní (bez flickeru).
    metricCard.innerHTML = _buildBatteryHTML(node.state);
  } else {
    // 1 bod stačí – zduplikujeme ho aby drawMiniTrend měl co nakreslit (plochá čára = stabilní)
    const hasData = trend.numeric?.length >= 1;
    const chartData = hasData && trend.numeric.length === 1
      ? [trend.numeric[0], trend.numeric[0]]
      : trend.numeric;

    metricCard.innerHTML = `
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Trend (30 dní)</div>
      ${hasData
        ? `<canvas class="weather-trend-canvas" style="width:100%;height:55px;display:block;border-radius:6px;"></canvas>`
        : `<div style="color:#64748b;font-size:13px;padding:14px 0;">Zatím není trend</div>`
      }
    `;

    if (hasData) {
      requestAnimationFrame(() => {
        const canvas = metricCard.querySelector('.weather-trend-canvas');
        if (canvas) drawMiniTrend(canvas.getContext('2d'), chartData, trend.lineColor);
      });
    }
  }

  // 6. Hlavní text brífinku – AI primární, provocationText fallback
  const aiErrorTexts = ['Chyba při komunikaci s AI.', 'Zatím nemám dost dat.', 'API nevrátilo platnou odpověď.'];
  const isAiValid = verdict?.text && !verdict.text.startsWith('API error') && !aiErrorTexts.includes(verdict.text);

  let initialText;
  if (isAiValid) {
    initialText = verdict.text;
  } else if (provocationText) {
    console.warn("⚠️ AI selhalo, fallback na provokaci z DB:", node.id);
    initialText = provocationText;
  } else {
    initialText = 'Nepodařilo se načíst diagnózu.';
  }

  // Animované bubliny pro hlavní uzel (3 věty z AI)
  const verdictLines = isMainNode && verdict?.lines?.length >= 2 ? verdict.lines : null;

  // 7. Chip labely
  const chip1Label = actionTitle || 'Co mám dělat?';
  const chip2Label = reflectionTitle || 'Detailní rozbor';
  const hasResources = ((node.articles?.length || 0) + (node.media?.length || 0) + (node.docs?.length || 0)) > 0;

  // (visionHtml odstraněno)

  // 8. Sestavení CHJ karty
  // Hlavní uzel s 3 větami → animované bubliny; ostatní → jeden text
  const BUBBLE_STYLES = [
    { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.11)', color: '#e2e8f0' },   // věta 1: stav baterie
    { bg: 'rgba(234,179,8,0.07)',   border: 'rgba(234,179,8,0.28)',   color: '#fde68a' },   // věta 2: bottleneck + jezdec
    { bg: 'rgba(139,92,246,0.07)',  border: 'rgba(139,92,246,0.28)',  color: '#c4b5fd' },   // věta 3: sen
  ];

  // Bubliny: použít transition + JS setTimeout (spolehlivější než CSS animation v innerHTML)
  const chjContentHtml = verdictLines
    ? `<div id="chj-bubbles" style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        ${verdictLines.map((line, i) => {
          const s = BUBBLE_STYLES[i] || BUBBLE_STYLES[0];
          return `<div data-bubble="${i}" style="
            background:${s.bg}; border:1px solid ${s.border};
            border-radius:10px; padding:13px 16px;
            color:${s.color}; font-size:15px; line-height:1.45;
            opacity:0; transform:translateY(8px);
            transition: opacity 0.55s ease, transform 0.55s ease;
          ">${formatChjText(line)}</div>`;
        }).join('')}
      </div>`
    : `<div class="chj-message" style="
        color:#e2e8f0; font-size:16px; line-height:1.3; margin-bottom:16px;
      ">${formatChjText(initialText)}</div>`;

  chjCard.innerHTML = `
    ${chjContentHtml}
    <div class="smart-chips" style="display:flex;flex-direction:column;gap:10px;">
      <button id="chip-action" style="
        display:flex;align-items:center;gap:10px;
        background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.4);
        color:#fde68a;padding:12px 18px;border-radius:10px;
        cursor:pointer;font-size:14px;font-weight:600;
        text-align:left;transition:all 0.2s;width:100%;
      "><span style="font-size:18px;">⚡</span>${chip1Label}</button>
      <!-- chip-reflection skryt: <button id="chip-reflection" ...>🧠 Detailní rozbor</button> -->
      ${(hasResources || actionText || reflectionText) ? `
        <button id="chip-resources" style="
          display:flex;align-items:center;gap:10px;
          background:rgba(20,184,166,0.1);border:1px solid rgba(20,184,166,0.4);
          color:#5eead4;padding:12px 18px;border-radius:10px;
          cursor:pointer;font-size:14px;font-weight:600;
          text-align:left;transition:all 0.2s;width:100%;
        "><span style="font-size:18px;">📚</span>Další zdroje</button>
      ` : ''}
    </div>
  `;

  // 9a. Spustit animaci bublin přes JS transition (CSS @keyframes v innerHTML je nespolehlivé)
  if (verdictLines) {
    chjCard.querySelectorAll('[data-bubble]').forEach(el => {
      const i = parseInt(el.dataset.bubble) || 0;
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * 850 + 50); // +50ms aby měl browser čas vyrenderovat opacity:0
    });
  }

  // 9. Hover efekty čipů
  chjCard.querySelectorAll('.smart-chips button').forEach(btn => {
    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.78'; btn.style.transform = 'translateX(3px)'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; btn.style.transform = 'none'; });
  });

  // 10. TTS – čte aktuálně zobrazený text; tlačítko odstraněno, řídí se mic ikony
  const messageEl = chjCard.querySelector('.chj-message');
  const playBtn = null; // tlačítko odstraněno – zachováno kvůli if (playBtn) guardu níže
  // Pokud jsou 3 bubliny → TTS přečte všechny věty za sebou
  let currentText = verdictLines ? verdictLines.join(' ') : initialText;
  let ttsPlaying = false;

  function startTTS() {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentText);
    utterance.lang = 'cs-CZ';
    utterance.pitch = 1.2;
    utterance.rate = 1.1;
    utterance.onstart = () => {
      ttsPlaying = true;
      // Header mic → SPEAKING
      const hm = document.getElementById('header-mic-btn');
      if (hm) {
        hm.dataset.state = 'speaking';
        const hi = hm.querySelector('.header-mic-icon');
        if (hi) hi.innerHTML = '<span style="color:#60a5fa;font-weight:700">((</span> 🔊 <span style="color:#60a5fa;font-weight:700">))</span>';
      }
      // Floor mic → SPEAKING
      const fm = document.getElementById('voice-mic-btn');
      if (fm) {
        fm.dataset.state = 'speaking';
        const fi = fm.querySelector('.mic-icon');
        if (fi) fi.textContent = '🔊';
      }
    };
    utterance.onerror = (e) => {
      console.error('🔊 TTS error:', e.error, e);
      ttsPlaying = false;
      const hm = document.getElementById('header-mic-btn');
      if (hm) { hm.dataset.state = 'idle'; const hi = hm.querySelector('.header-mic-icon'); if (hi) hi.textContent = '🎤'; }
      const fm = document.getElementById('voice-mic-btn');
      if (fm) { fm.dataset.state = 'idle'; const fi = fm.querySelector('.mic-icon'); if (fi) fi.textContent = '🎤'; }
    };
    utterance.onend = () => {
      ttsPlaying = false;
      // Header mic → IDLE
      const hm = document.getElementById('header-mic-btn');
      if (hm) {
        hm.dataset.state = 'idle';
        const hi = hm.querySelector('.header-mic-icon');
        if (hi) hi.textContent = '🎤';
      }
      // Floor mic → IDLE
      const fm = document.getElementById('voice-mic-btn');
      if (fm) {
        fm.dataset.state = 'idle';
        const fi = fm.querySelector('.mic-icon');
        if (fi) fi.textContent = '🎤';
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  if (playBtn) {
    playBtn.onmouseenter = () => { playBtn.style.background = 'rgba(6,182,212,0.3)'; playBtn.style.transform = 'scale(1.1)'; };
    playBtn.onmouseleave = () => {
      playBtn.style.background = ttsPlaying ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.15)';
      playBtn.style.transform = 'none';
    };
    playBtn.onclick = () => { ttsPlaying ? speechSynthesis.cancel() : startTTS(); };
  }

  // Auto-TTS: čeká na první dotyk (primer), pak spustí po 400ms
  const _doAutoTTS = () => {
    setTimeout(() => {
      const panelOpen = document.getElementById('sidePanel')?.classList.contains('open');
      if (!ttsPlaying && panelOpen) startTTS();
    }, 400);
  };
  if (window._chjTTSPrimed) {
    _doAutoTTS(); // engine already unlocked (user touched before data loaded)
  } else {
    window._chjPendingTTS = _doAutoTTS; // queue until first touch
  }

  // 11. Chip handlery
  const chipAction = document.getElementById('chip-action');
  const chipReflection = document.getElementById('chip-reflection');
  const chipResources = document.getElementById('chip-resources');

  if (chipAction) chipAction.onclick = async () => {
    document.getElementById('actionsModal')?.remove();
    const actModal = document.createElement('div');
    actModal.id = 'actionsModal';
    actModal.style.cssText = `
      position:fixed; inset:0;
      background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      z-index:10000;
      opacity:0; transition:opacity 0.2s ease;
    `;
    actModal.innerHTML = `
      <div style="
        background:#1e293b; border-radius:16px; padding:24px;
        max-width:400px; width:90%;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="color:#fde68a; margin:0; font-size:1em; display:flex; align-items:center; gap:8px;">⚡ Co mám dělat?</h2>
          <button id="closeActModal" style="background:transparent;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">×</button>
        </div>
        <div id="actModalContent" style="color:#cbd5e1; font-size:15px; line-height:1.8;">
          <div style="height:60px;background:rgba(255,255,255,0.05);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(actModal);
    requestAnimationFrame(() => { actModal.style.opacity = '1'; });
    const closeAct = () => { actModal.style.opacity = '0'; setTimeout(() => actModal.remove(), 200); };
    document.getElementById('closeActModal').onclick = closeAct;
    actModal.addEventListener('click', e => { if (e.target === actModal) closeAct(); });
    document.addEventListener('keydown', function escAct(e) {
      if (e.key === 'Escape') { closeAct(); document.removeEventListener('keydown', escAct); }
    });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          userQuestion: 'Co mám konkrétně dělat? Napiš 2-3 konkrétní kroky.',
          context: { state: node.state, userId }
        })
      });
      const data = await res.json();
      const contentEl = document.getElementById('actModalContent');
      if (contentEl) contentEl.innerHTML = (data.verdict || 'Nepodařilo se načíst doporučení.').replace(/\n/g, '<br>');
    } catch (err) {
      const contentEl = document.getElementById('actModalContent');
      if (contentEl) contentEl.textContent = 'Chyba při načítání doporučení.';
    }
  };
  if (chipReflection) chipReflection.onclick = async () => {
    document.getElementById('reflectionModal')?.remove();
    const refModal = document.createElement('div');
    refModal.id = 'reflectionModal';
    refModal.style.cssText = `
      position:fixed; inset:0;
      background:rgba(0,0,0,0.85);
      display:flex; align-items:center; justify-content:center;
      z-index:10000;
      opacity:0; transition:opacity 0.2s ease;
    `;
    refModal.innerHTML = `
      <div style="
        background:#1e293b; border-radius:16px; padding:24px;
        max-width:400px; width:90%;
        box-shadow:0 20px 60px rgba(0,0,0,0.7);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2 style="color:#a5b4fc; margin:0; font-size:1em; display:flex; align-items:center; gap:8px;">🧠 Detailní rozbor</h2>
          <button id="closeRefModal" style="background:transparent;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1;">×</button>
        </div>
        <div id="refModalContent" style="color:#cbd5e1; font-size:15px; line-height:1.8;">
          <div style="height:60px;background:rgba(255,255,255,0.05);border-radius:8px;animation:pulse 1.5s ease-in-out infinite;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(refModal);
    requestAnimationFrame(() => { refModal.style.opacity = '1'; });
    const closeRef = () => { refModal.style.opacity = '0'; setTimeout(() => refModal.remove(), 200); };
    document.getElementById('closeRefModal').onclick = closeRef;
    refModal.addEventListener('click', e => { if (e.target === refModal) closeRef(); });
    document.addEventListener('keydown', function escRef(e) {
      if (e.key === 'Escape') { closeRef(); document.removeEventListener('keydown', escRef); }
    });
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          userQuestion: 'Napiš 3 věty: 1) které oblasti jsou nejhorší a proč je baterie vybitá, 2) proč jsou navrhované akce právě takové — kvůli jakým omezením, 3) jak to souvisí s cílem. Jen fakta, bez obecných frází.',
          context: { state: node.state, userId, chjVerdict: initialText }
        })
      });
      const data = await res.json();
      const contentEl = document.getElementById('refModalContent');
      if (contentEl) contentEl.innerHTML = (data.verdict || 'Nepodařilo se načíst vysvětlení.').replace(/\n/g, '<br>');
    } catch (err) {
      const contentEl = document.getElementById('refModalContent');
      if (contentEl) contentEl.textContent = 'Chyba při načítání vysvětlení.';
    }
  };
  if (chipResources) chipResources.onclick = () => openResourcesViewer(node);

  // 12. Živý chat – přepisování brífinku
  const chatInput = document.getElementById('aiPanelInput');
  const sendBtn = document.getElementById('ai-send');
  let chatBusy = false;

  async function submitChat(question) {
    question = (question || '').trim();
    if (!question || chatBusy) return;

    chatBusy = true;
    if (chatInput) { chatInput.value = ''; chatInput.disabled = true; }
    if (sendBtn) sendBtn.disabled = true;
    speechSynthesis.cancel();

    // Header mic → THINKING s reproduktorem (AI generuje)
    const _hm = document.getElementById('header-mic-btn');
    if (_hm) {
      _hm.dataset.state = 'thinking';
      const _hi = _hm.querySelector('.header-mic-icon');
      if (_hi) _hi.textContent = '🔊';
    }

    // Zobrazení stavu čekání
    messageEl.innerHTML = '<span style="color:#64748b;font-style:italic;">Chytré já přemýšlí...</span>';

    try {
      const url = '/api/chat';
      const payload = {
        nodeId: node.id,
        userQuestion: question,
        context: {
          state: node.state,
          userId,
          nodeLabel: node.label
        }
      };
      console.log('Sending to:', url, payload);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error('Server neodpovídá správně');
      }

      const data = await response.json();
      const answer = (data?.verdict || 'Chyba při zpracování odpovědi.').trim();

      // Přepis textu – bez nové bubliny
      currentText = answer;
      messageEl.textContent = answer;

      // Auto-TTS: přečti odpověď (header mic → 🔊 přes startTTS.onstart)
      startTTS();

    } catch (err) {
      console.error('❌ chat submit:', err);
      messageEl.textContent = 'Chyba při komunikaci s AI.';
      // Reset header mic při chybě (TTS nikdy nenastartuje)
      const _hmErr = document.getElementById('header-mic-btn');
      if (_hmErr) {
        _hmErr.dataset.state = 'idle';
        const _hiErr = _hmErr.querySelector('.header-mic-icon');
        if (_hiErr) _hiErr.textContent = '🎤';
      }
    } finally {
      chatBusy = false;
      if (chatInput) { chatInput.disabled = false; chatInput.value = ''; }
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  if (chatInput) chatInput.onkeydown = e => { if (e.key === 'Enter') submitChat(chatInput.value); };
  if (sendBtn) sendBtn.onclick = () => submitChat(chatInput?.value || '');
}

// =====================================================
// LEGACY EXPORT (kompatibilita s app/index.html)
// =====================================================
export async function updateRecommendations() {
  // Doporučení jsou nyní přístupná přes smart chips v CHJ kartě.
}
