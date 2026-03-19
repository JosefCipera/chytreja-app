// =====================================================
// HUD.JS — Main screen overlay: bio-age, streak, mission, subtitle
// Voice-first: CHJ speaks, HUD shows key info at a glance
// =====================================================

import { calcBioAge, KILLER_TEXTS, NODE_KILLERS } from './game-engine.js';
import { runSkill } from './skill-router.js';

// ── ELEMENTS ────────────────────────────────────────────
let els = {};

function getEls() {
  if (els._cached) return els;
  els = {
    hud: document.getElementById('chj-hud'),
    bioAge: document.getElementById('chj-bio-age'),
    streak: document.getElementById('chj-streak-badge'),
    killer: document.getElementById('chj-hud-killer'),
    subtitle: document.getElementById('chj-subtitle'),
    missionBox: document.getElementById('chj-hud-mission'),
    missionText: document.getElementById('chj-hud-mission-text'),
    _cached: true,
  };
  return els;
}

// ── PUBLIC: Initialize HUD after universe loads ─────────
export async function initHUD() {
  const e = getEls();
  if (!e.hud) return;

  const uid = window.firebaseAuth?.currentUser?.uid;
  if (!uid || uid === 'demo-user-123') {
    e.bioAge.textContent = '—';
    return;
  }

  try {
    // 1. Fetch bio-age
    const bioResult = await fetchBioAge(uid);
    if (bioResult) {
      e.bioAge.textContent = bioResult.bioAge;
      // Color based on offset
      if (bioResult.offset > 5) e.bioAge.style.color = '#ef4444';       // RED — aging fast
      else if (bioResult.offset > 0) e.bioAge.style.color = '#eab308';  // YELLOW
      else e.bioAge.style.color = '#22c55e';                            // GREEN — younger
    }

    // 2. Fetch streak
    const streak = await fetchStreak(uid);
    if (streak > 0) {
      e.streak.textContent = `🔥 ${streak}`;
      e.streak.style.display = 'inline';
    }

    // 3. Find bottleneck node → show killer + get mission
    const bottleneck = findBottleneck();
    let missionLabel = null;
    if (bottleneck) {
      // Killer text for bottleneck node
      const killerId = NODE_KILLERS[bottleneck.id];
      const killerText = killerId ? KILLER_TEXTS[killerId] : null;
      if (killerText && e.killer && (bottleneck.state === 'RED' || bottleneck.state === 'YELLOW')) {
        e.killer.textContent = killerText;
        e.killer.style.display = 'block';
        // RED = red, YELLOW = amber
        e.killer.style.color = bottleneck.state === 'RED' ? '#f87171' : '#fbbf24';
      }

      // Mission
      const skillResult = await getMission(bottleneck);
      const mission = skillResult?.mission || skillResult;
      if (mission?.label) {
        missionLabel = mission.label;
        e.missionText.textContent = `${mission.icon || '🎯'} ${mission.label}`;
        e.missionBox.style.display = 'block';
        // Click → open that node's panel
        e.missionBox.onclick = () => openNodePanel(bottleneck.id);
      }
    }

    // 4. Compose spoken greeting
    const greeting = composeGreeting(bioResult, streak, bottleneck);
    if (greeting) {
      showSubtitle(greeting);
      speak(greeting);
    }

  } catch (err) {
    console.warn('HUD init error:', err.message);
  }
}

// ── SUBTITLE ────────────────────────────────────────────
let subtitleTimer = null;

export function showSubtitle(text, durationMs = 8000) {
  const e = getEls();
  if (!e.subtitle) return;
  e.subtitle.textContent = text;
  e.subtitle.style.opacity = '1';

  clearTimeout(subtitleTimer);
  subtitleTimer = setTimeout(() => {
    e.subtitle.style.opacity = '0';
  }, durationMs);
}

// ── SPEAK (TTS) ─────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  // Cancel any existing speech
  window.speechSynthesis.cancel();

  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'cs-CZ';
  utt.rate = 1.0;
  utt.pitch = 1.0;

  // Try to find Czech voice
  const voices = window.speechSynthesis.getVoices();
  const czVoice = voices.find(v => v.lang.startsWith('cs'));
  if (czVoice) utt.voice = czVoice;

  window.speechSynthesis.speak(utt);
}

// ── COMPOSE GREETING ────────────────────────────────────
// "Bio-věk 75. Síla a kondice tě stárnou. Třetí den v řadě. Dnes: 10 dřepů."
function composeGreeting(bioResult, streak, bottleneck) {
  const parts = [];

  // Bio-age
  if (bioResult) {
    parts.push(`Bio-věk ${bioResult.bioAge}`);
  }

  // Bottleneck context
  if (bottleneck) {
    const labels = {
      telo: 'Tělo', mysl: 'Hlava', vyziva: 'Strava',
      zdravi: 'Zdraví', metabolicke: 'Metabolismus',
      sila: 'Síla', stabilita: 'Stabilita', kardio: 'Srdce',
      vo2max: 'Kondice',
    };
    const name = labels[bottleneck.id] || bottleneck.label;
    if (bottleneck.state === 'RED') {
      parts.push(`${name} tě brzdí`);
    } else if (bottleneck.state === 'YELLOW') {
      parts.push(`${name} zaostává`);
    }
  }

  // Streak
  if (streak > 0) {
    const dayWord = streak === 1 ? 'den' : streak < 5 ? 'dny' : 'dní';
    parts.push(`${streak} ${dayWord} v řadě`);
  }

  return parts.length > 0 ? parts.join('. ') + '.' : null;
}

// ── DATA FETCHERS ───────────────────────────────────────

async function fetchBioAge(uid) {
  try {
    // Get age from user_profiles
    const { data: profile } = await window.supabaseClient
      .from('user_profiles')
      .select('age')
      .eq('user_id', uid)
      .maybeSingle();

    if (!profile?.age) return null;

    // Get metrics for bio markers
    const { data: metrics } = await window.supabaseClient
      .from('user_metrics')
      .select('node_id, current_index, state')
      .eq('user_id', uid)
      .eq('universe', 'longevity');

    const metricsMap = {};
    for (const m of (metrics || [])) {
      metricsMap[m.node_id] = m;
    }

    return calcBioAge(profile.age, metricsMap);
  } catch (e) {
    console.warn('fetchBioAge error:', e.message);
    return null;
  }
}

async function fetchStreak(uid) {
  try {
    const resp = await fetch(`/api/mission-log?userId=${uid}`);
    const data = await resp.json();
    return data.streak || 0;
  } catch { return 0; }
}

function findBottleneck() {
  const nodes = window.MAIN_UNIVERSE_DATA || [];
  // Find worst non-main node
  const stateOrder = { RED: 3, YELLOW: 2, GREEN: 1, GRAY: 0 };
  let worst = null;
  for (const n of nodes) {
    if (n.id === 'dlouhovekost') continue; // skip main
    if (!n.state || n.state === 'GRAY') continue;
    if (!worst || (stateOrder[n.state] || 0) > (stateOrder[worst.state] || 0)) {
      worst = n;
    }
  }
  return worst;
}

async function getMission(node) {
  try {
    const result = await runSkill({
      nodeId: node.id,
      state: node.state || 'YELLOW',
      streak: 0,
      constraints: window.USER_CONSTRAINTS || [],
    });
    return result;
  } catch { return null; }
}

async function openNodePanel(nodeId) {
  const node = (window.MAIN_UNIVERSE_DATA || []).find(n => n.id === nodeId);
  if (!node) return;
  const { showPanel } = await import('./universe-panel.js');
  showPanel(node);
}

// ── HIDE/SHOW HUD ───────────────────────────────────────
export function hideHUD() {
  const e = getEls();
  if (e.hud) e.hud.style.display = 'none';
}

export function showHUD() {
  const e = getEls();
  if (e.hud) e.hud.style.display = 'flex';
}
